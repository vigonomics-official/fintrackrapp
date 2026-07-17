import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/finance/PageHeader";
import {
  useTransactions, useCategories, useBudgets, useLoans, useProfile, monthKey,
} from "@/hooks/use-finance";
import { useSalarySettings } from "@/hooks/use-salary-settings";
import { computeSurvival } from "@/lib/survival";
import { formatCurrency } from "@/lib/currency";
import {
  buildComparison, buildBiggestWin, buildHealthBreakdown, buildAiMonthlyReview,
  buildBadges, buildPrediction, buildChallenge,
  type HealthLevel, type Trend,
} from "@/lib/report-insights";
import { Info, Sparkles, Printer, Download, Share2, Image as ImageIcon, ChevronDown } from "lucide-react";

export const Route = createFileRoute("/_authenticated/insights/report")({
  component: ReportPage,
  head: () => ({ meta: [{ title: "Monthly Report Card — FinTrackr" }] }),
});

const fmt = (n: number, currency = "INR") => formatCurrency(n, currency).replace(/\.00$/, "");

function statusForScore(score: number) {
  if (score >= 90) return { label: "🏆 Excellent Survivor" };
  if (score >= 75) return { label: "🟢 Financially Healthy" };
  if (score >= 60) return { label: "🟡 Getting There" };
  return { label: "🔴 Needs Attention" };
}

function weekRange(cycleStart: Date, idx: number) {
  const start = new Date(cycleStart);
  start.setDate(start.getDate() + idx * 7);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const f = (d: Date) => d.toLocaleString(undefined, { day: "numeric", month: "short" });
  return { start, end, label: `${f(start)}–${f(end)}` };
}

function ReportPage() {
  const { data: txs = [] } = useTransactions();
  const { data: categories = [] } = useCategories();
  const { data: budgets = [] } = useBudgets(monthKey());
  const { data: loans = [] } = useLoans();
  const { data: profile } = useProfile();
  const { settings } = useSalarySettings();
  const currency = profile?.currency ?? "INR";

  const now = useMemo(() => new Date(), []);
  const survival = useMemo(
    () => computeSurvival({ transactions: txs, loans, salarySettings: settings, now }),
    [txs, loans, settings, now],
  );

  // Insights (all Gemini-ready pure derivations)
  const insights = useMemo(() => {
    const ctx = { transactions: txs, categories, budgets, loans, salarySettings: settings, now };
    const { current, previous, cmp, salaryCredited, cycleMature } = buildComparison(ctx);
    const win = buildBiggestWin(ctx, current, previous, cmp);
    const health = buildHealthBreakdown(ctx, current);
    const review = buildAiMonthlyReview(ctx, current, previous, cmp, health, win);
    const badges = buildBadges(ctx, current, previous, health);
    const prediction = buildPrediction(current, previous, health);
    const challenge = buildChallenge(current, previous, health, ctx);
    return { current, previous, cmp, win, health, review, badges, prediction, challenge, salaryCredited, cycleMature };
  }, [txs, categories, budgets, loans, settings, now]);

  const cycleStart = survival.lastSalaryDate;
  const cycleTxs = useMemo(() => {
    const startKey = cycleStart.toISOString().slice(0, 10);
    const todayKey = now.toISOString().slice(0, 10);
    return txs.filter(t => {
      const k = String(t.transaction_date).slice(0, 10);
      return k >= startKey && k <= todayKey;
    });
  }, [txs, cycleStart, now]);

  const expenses = cycleTxs.filter(t => t.type === "expense");
  const totalSpent = expenses.reduce((s, t) => s + t.amount, 0);
  const totalSaved = Math.max(0, survival.salary - totalSpent);

  const cycleDays = useMemo(() => {
    const days: string[] = [];
    const d = new Date(cycleStart);
    while (d <= now) {
      days.push(d.toISOString().slice(0, 10));
      d.setDate(d.getDate() + 1);
    }
    return days;
  }, [cycleStart, now]);
  const safeDaily = survival.safeDaily || (survival.salary > 0 ? survival.salary / 30 : 0);
  const daysUnderBudget = useMemo(() => {
    if (!safeDaily) return 0;
    const perDay = new Map<string, number>();
    expenses.forEach(t => {
      const k = String(t.transaction_date).slice(0, 10);
      perDay.set(k, (perDay.get(k) ?? 0) + t.amount);
    });
    return cycleDays.filter(k => (perDay.get(k) ?? 0) < safeDaily).length;
  }, [expenses, cycleDays, safeDaily]);

  const catRows = useMemo(() => {
    const map = new Map<string, number>();
    expenses.forEach(t => {
      const k = t.category_id ?? "uncategorized";
      map.set(k, (map.get(k) ?? 0) + t.amount);
    });
    const HIDDEN_NAMES = /^(uncategorized|other|unknown)$/i;
    const rows = [...map.entries()].map(([cid, spent]) => {
      const cat = categories.find(c => c.id === cid);
      const budget = budgets.find(b => b.category_id === cid)?.monthly_limit ?? 0;
      const pct = budget > 0 ? (spent / budget) * 100 : 0;
      const name = cat?.name ?? "Uncategorized";
      const hidden = HIDDEN_NAMES.test(name) && budget === 0 && spent < 100;
      return {
        id: cid,
        name,
        color: cat?.color ?? "#9ca3af",
        spent, budget, pct, hidden,
      };
    }).sort((a, b) => b.spent - a.spent);
    return rows;
  }, [expenses, categories, budgets]);
  const visibleCatRows = useMemo(() => catRows.filter(r => !r.hidden), [catRows]);
  const hiddenCatRows = useMemo(() => catRows.filter(r => r.hidden), [catRows]);
  const [showHiddenCats, setShowHiddenCats] = useState(false);

  const weeks = useMemo(() => {
    const weeklyBudget = survival.salary > 0 ? survival.salary / 4 : 0;
    return Array.from({ length: 4 }).map((_, i) => {
      const { start, end, label } = weekRange(cycleStart, i);
      const spent = expenses.reduce((s, t) => {
        const d = new Date(t.transaction_date);
        return d >= start && d <= end ? s + t.amount : s;
      }, 0);
      const upcoming = start > now;
      return { i: i + 1, label, spent, budget: weeklyBudget, upcoming };
    });
  }, [expenses, cycleStart, now, survival.salary]);

  const monthName = now.toLocaleString(undefined, { month: "long" });
  const monthYearShort = now.toLocaleString(undefined, { month: "long", year: "numeric" });
  const status = statusForScore(survival.score);

  const momentum =
    insights.cmp.score.trend === "up" ? "↑ Better than last month 💪"
    : insights.cmp.score.trend === "flat" ? "Consistent performance 👍"
    : "Room to improve next month 📈";

  const shareRef = useRef<HTMLDivElement>(null);
  const [saving, setSaving] = useState(false);
  const [savingPdf, setSavingPdf] = useState(false);

  const shareText = `I survived ${monthYearShort} with a Survival Score of ${survival.score}/100 (Grade ${insights.health.grade}) on FinTrackr! 💪 #FinTrackr #SalarySurvival`;

  const onShare = async () => {
    try {
      if (navigator.share) await navigator.share({ text: shareText });
      else await navigator.clipboard.writeText(shareText);
    } catch {}
  };

  const onSaveImage = async () => {
    if (!shareRef.current) return;
    setSaving(true);
    try {
      const mod = await import("html-to-image");
      const dataUrl = await mod.toPng(shareRef.current, { pixelRatio: 2, backgroundColor: "#0d3d2a" });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `FinTrackr-${monthName}-${now.getFullYear()}.png`;
      a.click();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const onDownloadPdf = async () => {
    if (!shareRef.current) return;
    setSavingPdf(true);
    try {
      const mod = await import("html-to-image");
      const dataUrl = await mod.toJpeg(shareRef.current, { pixelRatio: 2, backgroundColor: "#0d3d2a", quality: 0.92 });
      const win = window.open("", "_blank");
      if (win) {
        win.document.write(`<html><head><title>FinTrackr ${monthYearShort}</title>
          <style>@page{margin:16mm}body{margin:0;display:flex;justify-content:center;padding:20px;background:#fff}img{max-width:100%;height:auto}</style>
          </head><body onload="window.print();"><img src="${dataUrl}" /></body></html>`);
        win.document.close();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSavingPdf(false);
    }
  };

  const onPrint = () => window.print();

  if (!txs.length) {
    return (
      <div className="w-full overflow-x-hidden" style={{ backgroundColor: "#FAFAF7" }}>
        <PageHeader title={`${monthYearShort} · Report Card`} subtitle="Your salary survival story" />
        <div className="mx-auto w-full max-w-3xl px-4 py-5">
          <Card className="p-5 text-center shadow-soft">
            <p className="text-sm font-semibold">No data yet for this month</p>
            <p className="mt-1 text-xs text-muted-foreground">Add a few expenses to generate your report card.</p>
          </Card>
        </div>
      </div>
    );
  }

  const spendingTarget = Math.round(totalSpent * 0.95);
  const savingsTarget = Math.round(survival.salary * 0.1);

  return (
    <div className="w-full overflow-x-hidden" style={{ backgroundColor: "#FAFAF7" }}>
      <PageHeader title={`${monthYearShort} · Report Card`} subtitle="Your salary survival story" />
      <div className="mx-auto w-full max-w-3xl space-y-4 px-4 py-5">

        {/* HERO */}
        <div
          className="rounded-2xl p-6 text-center text-white shadow-soft"
          style={{ background: "linear-gradient(180deg, #1a6b4a 0%, #0d3d2a 100%)", borderRadius: 16 }}
        >
          <p className="text-[12px] font-semibold uppercase tracking-wide text-white/70">
            {monthYearShort.toUpperCase()} SURVIVAL SCORE
          </p>
          <div className="mt-3 flex items-baseline justify-center">
            <span className="font-display font-extrabold" style={{ fontSize: 72, lineHeight: 1 }}>
              {survival.hasIncome ? survival.score : "—"}
            </span>
            {survival.hasIncome && (
              <span className="ml-1 font-semibold text-white/70" style={{ fontSize: 28 }}>/100</span>
            )}
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            <span className="inline-block rounded-full bg-white/15 px-3 py-1 text-sm font-semibold">
              {status.label}
            </span>
            <span className="inline-block rounded-full bg-white/15 px-3 py-1 text-sm font-semibold">
              Grade {insights.health.grade}
            </span>
          </div>
          <p className="mt-2 text-sm text-white/85">{momentum}</p>
        </div>

        {/* CELEBRATION */}
        <CelebrationCard score={survival.score} biggestWin={insights.win.headline} />

        {/* KEY STATS */}
        <div className="grid grid-cols-2 gap-3">
          <StatCard
            icon="📅"
            label="Days Under Budget"
            value={`${daysUnderBudget} of ${cycleDays.length} days`}
            sub={daysUnderBudget >= cycleDays.length * 0.6 ? "✅ Good discipline" : "Keep pushing"}
          />
          <StatCard
            icon="💰"
            label="Total Saved"
            value={totalSaved > 0 ? fmt(totalSaved, currency) : fmt(0, currency)}
            subClass={totalSaved > 0 ? "text-success" : "text-destructive"}
            sub={totalSaved > 0 ? "This cycle" : "Overspent"}
          />
          <StatCard icon="📊" label="Total Spent" value={fmt(totalSpent, currency)} sub="This cycle" />
          <StatCard
            icon={insights.win.icon}
            label="Biggest Win"
            value={insights.win.headline}
            sub={insights.win.detail}
          />
        </div>

        {/* AI MONTHLY REVIEW */}
        <AiReviewCard review={insights.review} />

        {/* MONTH-TO-MONTH COMPARISON */}
        <ComparisonCard
          cmp={insights.cmp}
          currency={currency}
          salaryCredited={insights.salaryCredited}
          cycleMature={insights.cycleMature}
          currentIncome={insights.current.income}
        />


        {/* FINANCIAL HEALTH BREAKDOWN */}
        <HealthCard health={insights.health} />

        {/* CATEGORY BREAKDOWN */}
        <div>
          <h2 className="mb-2 text-base font-bold">Where Your Money Went</h2>
          <Card className="p-4 shadow-soft" style={{ borderRadius: 12 }}>
            {catRows.length === 0 ? (
              <p className="text-sm text-muted-foreground">No categorized expenses yet.</p>
            ) : (
              <ul className="space-y-3">
                {catRows.slice(0, 6).map(r => {
                  const pct = r.budget > 0 ? Math.min(100, r.pct) : 0;
                  const barColor =
                    r.budget === 0 ? "#9ca3af"
                    : r.pct > 100 ? "#dc2626"
                    : r.pct >= 80 ? "#f97316"
                    : "#16a34a";
                  const statusText =
                    r.budget === 0 ? { t: "— Set budget", c: "text-muted-foreground" }
                    : r.pct > 100 ? { t: "🔴 Over budget", c: "text-destructive" }
                    : r.pct >= 80 ? { t: "⚠️ Near limit", c: "text-gold-foreground" }
                    : { t: "✅ Under budget", c: "text-success" };
                  return (
                    <li key={r.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: r.color }} />
                          <span className="truncate text-sm font-semibold">{r.name}</span>
                        </div>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {r.budget > 0
                            ? `${fmt(r.spent, currency)} of ${fmt(r.budget, currency)} budget`
                            : `${fmt(r.spent, currency)} · no budget`}
                        </p>
                        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: barColor }} />
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold">{fmt(r.spent, currency)}</p>
                        <p className={`text-[10px] ${statusText.c}`}>{statusText.t}</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            {catRows.length > 6 && (
              <Link to="/transactions" className="mt-3 block text-right text-xs font-semibold text-success">
                View all →
              </Link>
            )}
          </Card>
        </div>

        {/* ACHIEVEMENT BADGES */}
        <BadgesCard badges={insights.badges} />

        {/* NEXT MONTH PREDICTION */}
        <PredictionCard prediction={insights.prediction} currency={currency} />

        {/* MONTHLY CHALLENGE */}
        <ChallengeCard challenge={insights.challenge} />

        {/* WEEKLY BREAKDOWN */}
        <div>
          <h2 className="mb-2 text-base font-bold">Week by Week</h2>
          <Card className="p-4 shadow-soft" style={{ borderRadius: 12 }}>
            <ul className="space-y-3">
              {weeks.map(w => {
                const pct = w.budget > 0 ? Math.min(100, (w.spent / w.budget) * 100) : 0;
                const over = w.budget > 0 && w.spent > w.budget;
                return (
                  <li key={w.i} className="grid grid-cols-[auto_1fr_auto] items-center gap-3">
                    <span className="text-xs font-semibold whitespace-nowrap">Week {w.i} · {w.label}</span>
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${pct}%`, backgroundColor: over ? "#dc2626" : "#16a34a" }}
                      />
                    </div>
                    <span className="text-right text-xs font-semibold whitespace-nowrap">
                      {w.upcoming ? "— Upcoming" : `${fmt(w.spent, currency)} ${over ? "🔴" : "✅"}`}
                    </span>
                  </li>
                );
              })}
            </ul>
          </Card>
        </div>

        {/* SHAREABLE */}
        <div>
          <h2 className="text-base font-bold">Share Your Report</h2>
          <p className="mb-2 text-xs text-muted-foreground">Show how well you managed this month 💪</p>
          <div
            ref={shareRef}
            className="rounded-2xl p-6 text-white shadow-soft"
            style={{ background: "linear-gradient(180deg, #1a6b4a 0%, #0d3d2a 100%)", borderRadius: 16 }}
          >
            <div className="flex items-center justify-between">
              <span className="font-display text-lg font-bold">FinTrackr</span>
              <span className="text-xl">🏆</span>
            </div>
            <p className="mt-0.5 text-xs text-white/80">{monthYearShort} · Report Card</p>
            <div className="my-3 h-px bg-white/20" />
            <div className="py-2 text-center">
              <p className="font-display text-5xl font-extrabold">
                {survival.hasIncome ? survival.score : "—"}<span className="text-2xl text-white/70">/100</span>
              </p>
              <p className="mt-1 text-sm text-white/85">Survival Score · Grade {insights.health.grade}</p>
              <p className="mt-1 text-sm font-semibold">{status.label}</p>
            </div>
            <div className="my-3 h-px bg-white/20" />
            <ul className="space-y-1 text-sm">
              <li>💰 Saved {fmt(totalSaved, currency)}</li>
              <li>📅 Under budget {daysUnderBudget}/{cycleDays.length} days</li>
              <li>{insights.win.icon} {insights.win.headline}</li>
              <li>🎯 Goal chance next month: {insights.prediction.goalCompletionChance}%</li>
            </ul>
            <div className="my-3 h-px bg-white/20" />
            <p className="text-center text-[11px] text-white/70">
              Made with FinTrackr · Track your salary survival
            </p>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 print:hidden">
            <Button
              onClick={onShare}
              className="w-full text-white"
              style={{ backgroundColor: "#16a34a", borderRadius: 12 }}
            >
              <Share2 className="mr-1.5 h-4 w-4" /> Share
            </Button>
            <Button
              onClick={onSaveImage}
              disabled={saving}
              variant="outline"
              className="w-full"
              style={{ borderColor: "#16a34a", color: "#16a34a", borderRadius: 12 }}
            >
              <ImageIcon className="mr-1.5 h-4 w-4" /> {saving ? "Saving…" : "Save Image"}
            </Button>
            <Button
              onClick={onDownloadPdf}
              disabled={savingPdf}
              variant="outline"
              className="w-full"
              style={{ borderColor: "#16a34a", color: "#16a34a", borderRadius: 12 }}
            >
              <Download className="mr-1.5 h-4 w-4" /> {savingPdf ? "Preparing…" : "Download PDF"}
            </Button>
            <Button
              onClick={onPrint}
              variant="outline"
              className="w-full"
              style={{ borderColor: "#16a34a", color: "#16a34a", borderRadius: 12 }}
            >
              <Printer className="mr-1.5 h-4 w-4" /> Print
            </Button>
          </div>
        </div>

        {/* NEXT MONTH TARGETS */}
        <div>
          <h2 className="mb-2 text-base font-bold">Next Month Targets</h2>
          <Card className="p-4 shadow-soft" style={{ borderRadius: 12 }}>
            <ul className="space-y-3 text-sm">
              <li className="flex items-center gap-3">
                <span className="text-lg">🎯</span>
                <span>Keep spending under <b>{fmt(spendingTarget, currency)}</b></span>
              </li>
              <li className="flex items-center gap-3">
                <span className="text-lg">💰</span>
                <span>Save at least <b>{fmt(savingsTarget, currency)}</b></span>
              </li>
              <li className="flex items-center gap-3">
                <span className="text-lg">🔥</span>
                <span>Maintain <b>20+ day streak</b></span>
              </li>
            </ul>
            <Link
              to="/planner"
              className="mt-3 inline-block text-xs font-semibold"
              style={{ color: "#16a34a" }}
            >
              Set as My Goals →
            </Link>
          </Card>
        </div>

      </div>
    </div>
  );
}

function StatCard({
  icon, label, value, sub, subClass,
}: { icon: string; label: string; value: string; sub?: string; subClass?: string }) {
  return (
    <Card className="p-4 shadow-soft" style={{ borderRadius: 12 }}>
      <div className="text-lg leading-none">{icon}</div>
      <p className="mt-1.5 text-[11px] text-muted-foreground">{label}</p>
      <p className="mt-0.5 line-clamp-2 font-display text-sm font-bold leading-tight">{value}</p>
      {sub && <p className={`mt-0.5 line-clamp-2 text-[10px] ${subClass ?? "text-muted-foreground"}`}>{sub}</p>}
    </Card>
  );
}

/* ---------------- Sub-cards ---------------- */

function CelebrationCard({ score, biggestWin }: { score: number; biggestWin: string }) {
  const tone =
    score >= 90
      ? { emoji: "🎉", title: "Excellent Month!", body: `Outstanding financial discipline. ${biggestWin}.`, bg: "#dcfce7", fg: "#065f46", border: "#16a34a" }
      : score >= 75
        ? { emoji: "👍", title: "Good Progress", body: `You're on the right track. ${biggestWin}.`, bg: "#fef3c7", fg: "#78350f", border: "#f59e0b" }
        : { emoji: "💪", title: "Let's Improve Next Month", body: "Small consistent changes will move the needle. You've got this.", bg: "#dbeafe", fg: "#1e3a8a", border: "#3b82f6" };
  return (
    <Card
      className="p-4 shadow-soft"
      style={{ borderRadius: 12, backgroundColor: tone.bg, borderLeft: `4px solid ${tone.border}` }}
    >
      <div className="flex items-start gap-3">
        <span className="text-2xl leading-none">{tone.emoji}</span>
        <div className="min-w-0">
          <p className="font-display text-sm font-bold" style={{ color: tone.fg }}>{tone.title}</p>
          <p className="mt-0.5 text-xs" style={{ color: tone.fg }}>{tone.body}</p>
        </div>
      </div>
    </Card>
  );
}

function AiReviewCard({ review }: { review: ReturnType<typeof buildAiMonthlyReview> }) {
  const [showWhy, setShowWhy] = useState(false);
  const ratingColor =
    review.rating === "Excellent" ? "text-success"
    : review.rating === "Good" ? "text-success"
    : review.rating === "Average" ? "text-gold-foreground"
    : "text-destructive";
  return (
    <div>
      <h2 className="mb-2 flex items-center gap-1.5 text-base font-bold">
        <Sparkles className="h-4 w-4 text-primary" /> AI Monthly Review
      </h2>
      <Card className="p-4 shadow-soft" style={{ borderRadius: 12, borderLeft: "4px solid #16a34a" }}>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-xs font-semibold text-muted-foreground">Overall Rating</p>
          <p className={`font-display text-lg font-bold ${ratingColor}`}>{review.rating}</p>
        </div>

        <div className="mt-3 space-y-3 text-sm">
          <div>
            <p className="text-xs font-semibold text-success">✓ What went well</p>
            <ul className="mt-1 space-y-1">
              {review.wentWell.map((w, i) => <li key={i} className="text-xs">• {w}</li>)}
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold text-destructive">⚠ Needs Improvement</p>
            <ul className="mt-1 space-y-1">
              {review.needsImprovement.map((w, i) => <li key={i} className="text-xs">• {w}</li>)}
            </ul>
          </div>
          <div className="rounded-lg bg-muted/50 p-3">
            <p className="text-xs font-semibold">🎯 Best Action for Next Month</p>
            <p className="mt-1 text-xs">{review.bestAction}</p>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
          <span className="rounded-full bg-primary/10 px-2 py-0.5 font-semibold text-primary">
            Confidence {review.confidence}%
          </span>
          <span>Updated {new Date(review.lastUpdated).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}</span>
          <button
            type="button"
            onClick={() => setShowWhy(v => !v)}
            className="inline-flex items-center gap-0.5 font-semibold text-primary"
          >
            <Info className="h-3 w-3" /> Why? <ChevronDown className={`h-3 w-3 transition-transform ${showWhy ? "rotate-180" : ""}`} />
          </button>
        </div>

        {showWhy && (
          <div className="mt-2 rounded-lg border border-border/60 bg-background/60 p-3 text-[11px] text-muted-foreground">
            <p className="font-semibold text-foreground">Explain calculation</p>
            <p className="mt-1">{review.why}</p>
            <p className="mt-2 font-semibold text-foreground">Data used</p>
            <ul className="mt-1 space-y-0.5">
              {review.dataUsed.map((d, i) => <li key={i}>• {d}</li>)}
            </ul>
          </div>
        )}
      </Card>
    </div>
  );
}

function TrendIcon({ trend, invert = false }: { trend: Trend; invert?: boolean }) {
  if (trend === "flat") return <span className="text-muted-foreground">▬</span>;
  // For expenses, "up" is bad, "down" is good. Use invert.
  const isGood = invert ? trend === "down" : trend === "up";
  return (
    <span className={isGood ? "text-success" : "text-destructive"}>
      {trend === "up" ? "▲" : "▼"}
    </span>
  );
}

function ComparisonCard({
  cmp, currency,
}: { cmp: ReturnType<typeof buildComparison>["cmp"]; currency: string }) {
  const rows: Array<{ label: string; d: (typeof cmp)[keyof typeof cmp]; invert?: boolean; money?: boolean }> = [
    { label: "Survival Score", d: cmp.score },
    { label: "Income", d: cmp.income, money: true },
    { label: "Expenses", d: cmp.expenses, money: true, invert: true },
    { label: "Savings", d: cmp.savings, money: true },
    { label: "Investments", d: cmp.investments, money: true },
    { label: "Budget Days", d: cmp.budgetDays },
  ];
  return (
    <div>
      <h2 className="mb-2 text-base font-bold">Month-to-Month Comparison</h2>
      <Card className="p-4 shadow-soft" style={{ borderRadius: 12 }}>
        <ul className="space-y-2.5">
          {rows.map(r => (
            <li key={r.label} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
              <span className="truncate text-xs font-semibold">{r.label}</span>
              <span className="flex items-center gap-1.5 text-xs font-semibold whitespace-nowrap">
                <TrendIcon trend={r.d.trend} invert={r.invert} />
                <span>{r.d.trend === "flat" ? "0%" : `${r.d.pct > 0 ? "+" : ""}${r.d.pct.toFixed(0)}%`}</span>
                <span className="text-muted-foreground">
                  ({r.d.abs > 0 ? "+" : ""}{r.money ? fmt(r.d.abs, currency) : Math.round(r.d.abs)})
                </span>
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

function HealthPill({ level }: { level: HealthLevel }) {
  const map: Record<HealthLevel, { bg: string; fg: string }> = {
    Excellent: { bg: "#dcfce7", fg: "#065f46" },
    Good: { bg: "#dbeafe", fg: "#1e3a8a" },
    Average: { bg: "#fef3c7", fg: "#78350f" },
    "Needs Attention": { bg: "#fee2e2", fg: "#991b1b" },
  };
  const s = map[level];
  return (
    <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap"
      style={{ backgroundColor: s.bg, color: s.fg }}>
      {level}
    </span>
  );
}

function HealthCard({ health }: { health: ReturnType<typeof buildHealthBreakdown> }) {
  const rows: Array<{ label: string; level: HealthLevel }> = [
    { label: "Cash Flow", level: health.cashFlow },
    { label: "Savings", level: health.savings },
    { label: "Budget Discipline", level: health.budgetDiscipline },
    { label: "Emergency Fund", level: health.emergencyFund },
    { label: "Investments", level: health.investments },
    { label: "Bills", level: health.bills },
  ];
  return (
    <div>
      <h2 className="mb-2 text-base font-bold">Financial Health Breakdown</h2>
      <Card className="p-4 shadow-soft" style={{ borderRadius: 12 }}>
        <div className="mb-3 flex items-center justify-between rounded-lg bg-primary/5 px-3 py-2">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Financial Grade</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">Overall score {health.overallPct}%</p>
          </div>
          <p className="font-display text-3xl font-extrabold text-primary">{health.grade}</p>
        </div>
        <ul className="space-y-2">
          {rows.map(r => (
            <li key={r.label} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
              <span className="truncate text-xs font-semibold">{r.label}</span>
              <HealthPill level={r.level} />
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

function BadgesCard({ badges }: { badges: ReturnType<typeof buildBadges> }) {
  if (!badges.length) return null;
  return (
    <div>
      <h2 className="mb-2 text-base font-bold">Achievements Unlocked</h2>
      <Card className="p-4 shadow-soft" style={{ borderRadius: 12 }}>
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {badges.map(b => (
            <li key={b.id} className="rounded-lg border border-border/60 bg-background p-2.5">
              <div className="flex items-center gap-1.5">
                <span className="text-lg leading-none">{b.icon}</span>
                <span className="truncate text-xs font-bold">{b.title}</span>
              </div>
              <p className="mt-1 line-clamp-2 text-[10px] text-muted-foreground">{b.reason}</p>
              <p className="mt-0.5 text-[10px] text-muted-foreground">
                Earned {new Date(b.earnedAt).toLocaleDateString(undefined, { day: "numeric", month: "short" })}
              </p>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

function PredictionCard({
  prediction, currency,
}: { prediction: ReturnType<typeof buildPrediction>; currency: string }) {
  const [showWhy, setShowWhy] = useState(false);
  const riskColor =
    prediction.riskLevel === "Low" ? "text-success"
    : prediction.riskLevel === "Medium" ? "text-gold-foreground"
    : "text-destructive";
  return (
    <div>
      <h2 className="mb-2 flex items-center gap-1.5 text-base font-bold">
        <Sparkles className="h-4 w-4 text-primary" /> Next Month Prediction
      </h2>
      <Card className="p-4 shadow-soft" style={{ borderRadius: 12 }}>
        <div className="grid grid-cols-2 gap-3">
          <PredStat label="Survival Score" value={`${prediction.score}/100`} />
          <PredStat label="Expected Savings" value={fmt(prediction.expectedSavings, currency)} />
          <PredStat label="Risk Level" value={prediction.riskLevel} valueClass={riskColor} />
          <PredStat label="Goal Completion" value={`${prediction.goalCompletionChance}%`} />
          <PredStat label="Safe Daily Spend" value={fmt(prediction.safeDailySpend, currency)} />
          <PredStat label="Confidence" value={`${prediction.confidence}%`} />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
          <span className="rounded-full bg-primary/10 px-2 py-0.5 font-semibold text-primary">AI Prediction</span>
          <button
            type="button"
            onClick={() => setShowWhy(v => !v)}
            className="inline-flex items-center gap-0.5 font-semibold text-primary"
          >
            <Info className="h-3 w-3" /> Why? <ChevronDown className={`h-3 w-3 transition-transform ${showWhy ? "rotate-180" : ""}`} />
          </button>
        </div>
        {showWhy && (
          <p className="mt-2 rounded-lg border border-border/60 bg-background/60 p-3 text-[11px] text-muted-foreground">
            {prediction.reason}
          </p>
        )}
      </Card>
    </div>
  );
}

function PredStat({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="rounded-lg border border-border/50 bg-background p-2.5">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className={`mt-0.5 font-display text-sm font-bold ${valueClass ?? ""}`}>{value}</p>
    </div>
  );
}

function ChallengeCard({ challenge }: { challenge: ReturnType<typeof buildChallenge> }) {
  return (
    <div>
      <h2 className="mb-2 text-base font-bold">Monthly Challenge</h2>
      <Card className="p-4 shadow-soft" style={{ borderRadius: 12, borderLeft: "4px solid #f59e0b" }}>
        <div className="flex items-start gap-3">
          <span className="text-2xl leading-none">🚀</span>
          <div className="min-w-0 flex-1">
            <p className="font-display text-sm font-bold">{challenge.title}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">{challenge.reason}</p>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full" style={{ width: `${challenge.progress}%`, backgroundColor: "#f59e0b" }} />
            </div>
            <p className="mt-1 text-[10px] text-muted-foreground">Progress {challenge.progress}%</p>
          </div>
        </div>
      </Card>
    </div>
  );
}
