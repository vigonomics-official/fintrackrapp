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

  // Previous cycle survival — approximate by prior month window
  const prevScore = useMemo(() => {
    const prevNow = new Date(survival.lastSalaryDate);
    prevNow.setDate(prevNow.getDate() - 1);
    const s = computeSurvival({ transactions: txs, loans, salarySettings: settings, now: prevNow });
    return s.score;
  }, [txs, loans, settings, survival.lastSalaryDate]);

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

  // Days under budget
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

  // Category rollup
  const catRows = useMemo(() => {
    const map = new Map<string, number>();
    expenses.forEach(t => {
      const k = t.category_id ?? "uncategorized";
      map.set(k, (map.get(k) ?? 0) + t.amount);
    });
    return [...map.entries()].map(([cid, spent]) => {
      const cat = categories.find(c => c.id === cid);
      const budget = budgets.find(b => b.category_id === cid)?.monthly_limit ?? 0;
      const pct = budget > 0 ? (spent / budget) * 100 : 0;
      return {
        id: cid,
        name: cat?.name ?? "Uncategorized",
        color: cat?.color ?? "#9ca3af",
        spent, budget, pct,
      };
    }).sort((a, b) => b.spent - a.spent);
  }, [expenses, categories, budgets]);

  // Biggest win: category most under budget (by absolute saving)
  const biggestWin = useMemo(() => {
    const wins = catRows
      .filter(r => r.budget > 0 && r.spent < r.budget)
      .map(r => ({ name: r.name, saved: r.budget - r.spent, pct: Math.round((1 - r.spent / r.budget) * 100) }))
      .sort((a, b) => b.saved - a.saved);
    return wins[0] ?? null;
  }, [catRows]);

  // Biggest overspend for tip
  const biggestOver = useMemo(() => {
    const overs = catRows.filter(r => r.budget > 0 && r.spent > r.budget)
      .sort((a, b) => (b.spent - b.budget) - (a.spent - a.budget));
    return overs[0] ?? null;
  }, [catRows]);

  // Weekly breakdown (up to 4 weeks from cycle start)
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

  // Highest spending week for story line 1
  const heaviestWeek = useMemo(() => {
    const past = weeks.filter(w => !w.upcoming);
    if (!past.length) return null;
    return past.reduce((m, w) => (w.spent > m.spent ? w : m), past[0]);
  }, [weeks]);

  const monthName = now.toLocaleString(undefined, { month: "long" });
  const monthYearShort = now.toLocaleString(undefined, { month: "long", year: "numeric" });
  const status = statusForScore(survival.score);

  const momentum =
    survival.score > prevScore ? "↑ Better than last month 💪"
    : survival.score === prevScore ? "Consistent performance 👍"
    : "Room to improve next month 📈";

  // Story line 3
  const tip = useMemo(() => {
    if (!biggestOver) return "Keep it up! Try saving ₹500 more next month.";
    const n = biggestOver.name.toLowerCase();
    if (n.includes("food") || n.includes("dining")) return "Next month, cook 3 meals/week to save ₹800 more.";
    if (n.includes("transport") || n.includes("travel")) return "Consider carpooling to reduce travel costs.";
    if (n.includes("shopping")) return "Try a no-shopping week to reset your spending habit.";
    return `Trim ${biggestOver.name} next month to boost your score.`;
  }, [biggestOver]);

  const shareRef = useRef<HTMLDivElement>(null);
  const [saving, setSaving] = useState(false);

  const shareText = `I survived ${monthYearShort} with a Survival Score of ${survival.score}/100 on FinTrackr! 💪 #FinTrackr #SalarySurvival`;

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

  const spendingTarget = biggestOver ? Math.round(totalSpent * 0.95) : totalSpent;
  const savingsTarget = Math.round(survival.salary * 0.1);

  return (
    <div className="w-full overflow-x-hidden" style={{ backgroundColor: "#FAFAF7" }}>
      <PageHeader title={`${monthYearShort} · Report Card`} subtitle="Your salary survival story" />
      <div className="mx-auto w-full max-w-3xl space-y-4 px-4 py-5">

        {/* SECTION 1 — Hero */}
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
          <div className="mt-3 inline-block rounded-full bg-white/15 px-3 py-1 text-sm font-semibold">
            {status.label}
          </div>
          <p className="mt-2 text-sm text-white/85">{momentum}</p>
        </div>

        {/* SECTION 2 — Key Stats Grid */}
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
            icon="🏆"
            label="Biggest Win"
            value={biggestWin ? `${biggestWin.name} -${biggestWin.pct}%` : "—"}
            sub={biggestWin ? "vs budget" : "Set budgets to unlock"}
          />
        </div>

        {/* SECTION 3 — Category Report */}
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

        {/* SECTION 4 — Month Story */}
        <div>
          <h2 className="mb-2 text-base font-bold">Your Month in 3 Lines</h2>
          <Card
            className="p-4 shadow-soft"
            style={{ borderRadius: 12, borderLeft: "4px solid #16a34a" }}
          >
            <ul className="space-y-2 text-sm">
              <li>
                {heaviestWeek
                  ? <>Your heaviest spending was in <b>Week {heaviestWeek.i}</b> ({heaviestWeek.label}).</>
                  : "Not enough weekly data yet."}
              </li>
              <li>
                {biggestWin
                  ? <>You saved the most on <b>{biggestWin.name}</b>, spending {fmt(biggestWin.saved, currency)} less than budget.</>
                  : "Set category budgets to spot your biggest wins."}
              </li>
              <li>{tip}</li>
            </ul>
          </Card>
        </div>

        {/* SECTION 5 — Weekly Breakdown */}
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

        {/* SECTION 6 — Shareable */}
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
              <p className="mt-1 text-sm text-white/85">Survival Score</p>
              <p className="mt-1 text-sm font-semibold">{status.label}</p>
            </div>
            <div className="my-3 h-px bg-white/20" />
            <ul className="space-y-1 text-sm">
              <li>💰 Saved {fmt(totalSaved, currency)}</li>
              <li>📅 Under budget {daysUnderBudget} days</li>
              <li>🏆 Best: {biggestWin?.name ?? "—"}</li>
            </ul>
            <div className="my-3 h-px bg-white/20" />
            <p className="text-center text-[11px] text-white/70">
              Made with FinTrackr · Track your salary survival
            </p>
          </div>
          <div className="mt-3 space-y-2">
            <Button
              onClick={onShare}
              className="w-full text-white"
              style={{ backgroundColor: "#16a34a", borderRadius: 12 }}
            >
              📤 Share My Report
            </Button>
            <Button
              onClick={onSaveImage}
              disabled={saving}
              variant="outline"
              className="w-full"
              style={{ borderColor: "#16a34a", color: "#16a34a", borderRadius: 12 }}
            >
              {saving ? "Saving…" : "💾 Save as Image"}
            </Button>
          </div>
        </div>

        {/* SECTION 7 — Next Month Targets */}
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
      <p className="mt-0.5 truncate font-display text-base font-bold">{value}</p>
      {sub && <p className={`mt-0.5 text-[10px] ${subClass ?? "text-muted-foreground"}`}>{sub}</p>}
    </Card>
  );
}
