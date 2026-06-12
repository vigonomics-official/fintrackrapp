import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight, Sparkles, Plus, Trash2, TrendingDown, BellRing,
  CheckCircle2, Flame, Target as TargetIcon, ShieldCheck,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { PageHeader } from "@/components/finance/PageHeader";
import { FinancialJourney } from "@/components/finance/FinancialJourney";
import { useTransactions, useLoans, useProfile } from "@/hooks/use-finance";
import { useSalarySettings } from "@/hooks/use-salary-settings";
import { computeSurvival } from "@/lib/survival";
import { formatCurrency } from "@/lib/currency";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/planner")({
  component: PlannerPage,
  head: () => ({
    meta: [
      { title: "Planner — FinTrackr" },
      { name: "description", content: "Salary-aware month-end forecast and safe daily spend planner." },
      { property: "og:title", content: "Planner — FinTrackr" },
      { property: "og:description", content: "Salary-aware month-end forecast and safe daily spend planner." },
      { property: "og:url", content: "https://fintrackrapp.lovable.app/planner" },
      { name: "twitter:title", content: "Planner — FinTrackr" },
      { name: "twitter:description", content: "Salary-aware month-end forecast and safe daily spend planner." },
    ],
    links: [{ rel: "canonical", href: "https://fintrackrapp.lovable.app/planner" }],
  }),
});

type TabKey = "monthly" | "allocation" | "loans" | "bills" | "goals" | "cibt";

const TABS: { key: TabKey; label: string }[] = [
  { key: "monthly", label: "Plan" },
  { key: "allocation", label: "Allocate" },
  { key: "loans", label: "Loans" },
  { key: "bills", label: "Bills" },
  { key: "goals", label: "Goals" },
  { key: "cibt", label: "Buy" },
];

function PlannerPage() {
  const [tab, setTab] = useState<TabKey>("monthly");

  return (
    <div className="w-full overflow-x-hidden pb-10">
      <PageHeader title="Planner" subtitle="Plan • Save • Survive" />

      {/* Tab strip */}
      <div className="sticky top-0 z-10 border-b bg-card/80 backdrop-blur">
        <div className="no-scrollbar mx-auto flex max-w-3xl gap-1 overflow-x-auto px-3 py-1.5 sm:px-6 md:px-10">
          {TABS.map((t) => {
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={cn(
                  "shrink-0 rounded-full px-3 py-1 text-[12px] font-medium transition-colors",
                  active
                    ? "bg-primary text-primary-foreground shadow-soft"
                    : "text-muted-foreground hover:bg-muted/60"
                )}
              >
                <span className="whitespace-nowrap">{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mx-auto w-full max-w-3xl space-y-4 px-4 py-5 sm:px-6 md:px-10">
        {tab === "monthly" && <MonthlyPlan />}
        {tab === "allocation" && <SalaryAllocation />}
        {tab === "loans" && <LoansTab />}
        {tab === "bills" && <BillsTab />}
        {tab === "goals" && <GoalsTab />}
        {tab === "cibt" && <CanIBuyThisTab />}
      </div>
    </div>
  );
}

/* ============================ Shared survival math ============================ */

function useSurvival(extraSpend = 0) {
  const { data: profile } = useProfile();
  const { data: transactions = [] } = useTransactions();
  const { data: loans = [] } = useLoans();
  const { settings: salarySettings } = useSalarySettings();
  const currency = profile?.currency ?? "INR";

  const data = useMemo(() => {
    const s = computeSurvival({ transactions, loans, salarySettings, extraSpend });
    return { currency, ...s };
  }, [transactions, loans, extraSpend, currency, salarySettings]);

  return data;
}

/* ============================ Monthly Plan ============================ */

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-xl border bg-card p-3">
      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={cn("mt-1 font-display text-base font-bold tabular-nums", tone)}>{value}</p>
    </div>
  );
}

function MonthlyPlan() {
  const s = useSurvival();
  const { data: loans = [] } = useLoans();
  const outstanding = loans.reduce((a, l) => a + Number(l.remaining_balance || 0), 0);
  const forecast = s.forecastBalance;
  const forecastTone =
    forecast >= 1000
      ? "text-success"
      : forecast >= 0
        ? "text-gold-foreground"
        : "text-destructive";
  const forecastBorder =
    forecast >= 1000
      ? "border-success/30 bg-success/5"
      : forecast >= 0
        ? "border-gold/30 bg-gold/10"
        : "border-destructive/30 bg-destructive/5";
  const forecastLabel =
    forecast >= 1000
      ? `${formatCurrency(forecast, s.currency)} expected at month end 🎯`
      : forecast >= 0
        ? "Barely breaking even ⚠️"
        : "Reduce daily spend to recover";
  const safe = forecast >= 0;
  const zone =
    s.score >= 70
      ? { dot: "🟢", label: "Safe Zone", tone: "bg-success/20 text-success" }
      : s.score >= 40
        ? { dot: "🟡", label: "Watch Spending", tone: "bg-gold/20 text-gold-foreground" }
        : { dot: "🔴", label: "Danger Zone", tone: "bg-destructive/20 text-destructive" };

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden border-none bg-gradient-primary text-primary-foreground shadow-elegant">
        <CardContent className="space-y-3 p-5">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] opacity-80">Salary Left</p>
            <p className="mt-1 font-display text-3xl font-bold">
              {s.hasIncome ? formatCurrency(s.salaryLeft, s.currency) : "—"}
            </p>
            <p className="mt-1 text-xs opacity-85">
              {s.hasIncome
                ? s.isSalaryToday
                  ? `Salary Today 🎉 · ${formatCurrency(s.safeDaily, s.currency)} safe today`
                  : `${s.days} day${s.days === 1 ? "" : "s"} left · ${formatCurrency(s.safeDaily, s.currency)}/day safe`
                : "Add this month's salary to unlock your plan."}
            </p>
          </div>
          {s.hasIncome && (
            <span className={cn("inline-flex w-fit items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-semibold backdrop-blur")}>
              {zone.dot} {zone.label}
            </span>
          )}
        </CardContent>
      </Card>

      <FinancialJourney
        monthlyEmi={s.monthlyEmi}
        salary={s.salary}
        outstanding={outstanding}
        currency={s.currency}
      />

      <div className="grid grid-cols-2 gap-2.5">
        <Stat label="Days Left" value={s.hasIncome ? (s.isSalaryToday ? "Today 🎉" : `${s.days}`) : "—"} />
        <Stat label="Survival Score" value={`${s.score}/100`} />
        <Stat label="Monthly EMI" value={formatCurrency(s.monthlyEmi, s.currency)} />
        <Stat
          label="EMI Pressure"
          value={s.emiLevel}
          tone={s.emiLevel === "High" ? "text-destructive" : s.emiLevel === "Medium" ? "text-gold-foreground" : "text-success"}
        />
      </div>

      {/* Month-End Forecast */}
      <Card className={cn("border shadow-soft", forecastBorder)}>
        <CardContent className="space-y-1 p-4">
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Month-End Forecast</p>
          <p className={cn("font-display text-2xl font-bold tabular-nums", s.hasIncome ? forecastTone : "")}>
            {s.hasIncome ? formatCurrency(forecast, s.currency) : "—"}
          </p>
          <p className="text-xs text-muted-foreground">
            {!s.hasIncome ? "Add salary to forecast your month-end balance." : forecastLabel}
          </p>
        </CardContent>
      </Card>

      {/* Next Action */}
      {s.hasIncome && <NextActionCard s={s} outstanding={outstanding} />}

      {/* Financial Health Score */}
      {s.hasIncome && <HealthScoreCard s={s} outstanding={outstanding} />}

      <Card className="border-primary/20 bg-primary/5 shadow-soft">
        <CardContent className="space-y-1.5 p-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">AI Planner Insight</p>
          </div>
          <p className="text-sm leading-relaxed text-foreground">
            {!s.hasIncome
              ? "Add this month's salary so we can guide your spending until next payday."
              : safe
                ? `At your current pace, you'll finish the month with about ${formatCurrency(Math.max(0, s.forecastBalance), s.currency)} left. Keep daily spending under ${formatCurrency(s.safeDaily, s.currency)}.`
                : `At your current pace, you may run short before salary. Trim daily spending below ${formatCurrency(s.safeDaily, s.currency)} to recover into a safe zone.`}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

/* ---------- Next Action & Health Score ---------- */

function NextActionCard({ s, outstanding }: { s: ReturnType<typeof useSurvival>; outstanding: number }) {
  const actions: string[] = [];
  if (s.forecastBalance < 0) actions.push(`Stay below ${formatCurrency(s.safeDaily, s.currency)}/day to recover`);
  if (outstanding > 0 && s.monthlyEmi > 0) actions.push(`Add ${formatCurrency(Math.round(s.monthlyEmi * 0.1), s.currency)} extra EMI to close loans faster`);
  if (s.salary > 0) actions.push(`Save ${formatCurrency(Math.round(s.salary * 0.1), s.currency)} this month (10% rule)`);
  if (s.salaryLeft > 0) actions.push(`Avoid purchases above ${formatCurrency(Math.round(s.salaryLeft * 0.25), s.currency)}`);
  const top = actions.slice(0, 3);

  return (
    <Card className="border-primary/20 shadow-soft">
      <CardContent className="space-y-2 p-4">
        <div className="flex items-center gap-2">
          <Flame className="h-3.5 w-3.5 text-primary" />
          <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">Next Actions</p>
        </div>
        <ul className="space-y-1.5">
          {top.map((a, i) => (
            <li key={i} className="flex items-start gap-2 text-sm">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
              <span className="leading-snug">{a}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function HealthScoreCard({ s, outstanding }: { s: ReturnType<typeof useSurvival>; outstanding: number }) {
  const savings = s.salary > 0 ? Math.min(25, Math.max(0, (s.salaryLeft / s.salary) * 25)) : 0;
  const debt = s.salary > 0 ? Math.max(0, 25 - (s.monthlyEmi / s.salary) * 50) : 25;
  const bills = 20; // assume on-track until billing data integrated
  const survival = Math.min(30, s.score * 0.3);
  const total = Math.round(savings + debt + bills + survival);
  const tip =
    total >= 80
      ? "You're financially healthy — keep saving consistently."
      : total >= 60
        ? `Boost savings to ${formatCurrency(Math.round(s.salary * 0.2), s.currency)}/mo and reduce EMI load to reach 80+.`
        : "Cut a high-interest loan or trim discretionary spend to climb above 60.";

  const bars: { label: string; val: number; max: number }[] = [
    { label: "Savings", val: Math.round(savings), max: 25 },
    { label: "Debt", val: Math.round(debt), max: 25 },
    { label: "Bills", val: bills, max: 20 },
    { label: "Survival", val: Math.round(survival), max: 30 },
  ];

  return (
    <Card className="shadow-soft">
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-3.5 w-3.5 text-primary" />
            <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">Financial Health</p>
          </div>
          <p className="font-display text-xl font-bold tabular-nums">{total}<span className="text-xs text-muted-foreground">/100</span></p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {bars.map((b) => (
            <div key={b.label}>
              <div className="flex justify-between text-[11px]">
                <span className="text-muted-foreground">{b.label}</span>
                <span className="tabular-nums">{b.val}/{b.max}</span>
              </div>
              <Progress value={(b.val / b.max) * 100} className="h-1" />
            </div>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground">{tip}</p>
      </CardContent>
    </Card>
  );
}


/* ============================ Salary Allocation ============================ */

type Alloc = { rent: number; food: number; travel: number; emi: number; savings: number };
const ALLOC_KEY = "fintrackr_alloc_v1";
const defaultAlloc: Alloc = { rent: 30, food: 15, travel: 10, emi: 20, savings: 20 };

function loadAlloc(): Alloc {
  if (typeof window === "undefined") return defaultAlloc;
  try {
    const raw = localStorage.getItem(ALLOC_KEY);
    return raw ? { ...defaultAlloc, ...JSON.parse(raw) } : defaultAlloc;
  } catch { return defaultAlloc; }
}

function SalaryAllocation() {
  const s = useSurvival();
  const [alloc, setAlloc] = useState<Alloc>(defaultAlloc);

  useEffect(() => { setAlloc(loadAlloc()); }, []);
  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem(ALLOC_KEY, JSON.stringify(alloc));
  }, [alloc]);

  const totalPct = alloc.rent + alloc.food + alloc.travel + alloc.emi + alloc.savings;
  const over = totalPct > 100;
  const remainingPct = Math.max(0, 100 - totalPct);
  const remainingAmt = (s.salary * remainingPct) / 100;

  const rows: { key: keyof Alloc; label: string; tip: string }[] = [
    { key: "rent", label: "Rent", tip: "Keep under 30%" },
    { key: "food", label: "Food", tip: "Aim for 10–15%" },
    { key: "travel", label: "Travel", tip: "Aim for 5–10%" },
    { key: "emi", label: "EMI", tip: "Stay under 40%" },
    { key: "savings", label: "Savings", tip: "Target 20%+" },
  ];

  return (
    <div className="space-y-4">
      <Card className="shadow-soft">
        <CardContent className="space-y-1 p-4">
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">This month's salary</p>
          <p className="font-display text-2xl font-bold">{formatCurrency(s.salary, s.currency)}</p>
          {!s.hasIncome && <p className="text-xs text-muted-foreground">Add income to see allocation amounts.</p>}
        </CardContent>
      </Card>

      <div className="space-y-2.5">
        {rows.map((r) => {
          const pct = alloc[r.key];
          const amt = (s.salary * pct) / 100;
          return (
            <Card key={r.key} className="shadow-soft">
              <CardContent className="space-y-2 p-3.5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold">{r.label}</p>
                    <p className="text-[11px] text-muted-foreground">{r.tip}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-display text-base font-bold tabular-nums">{formatCurrency(amt, s.currency)}</p>
                    <p className="text-[11px] text-muted-foreground">{pct}%</p>
                  </div>
                </div>
                <input
                  type="range" min={0} max={60} value={pct}
                  onChange={(e) => setAlloc((p) => ({ ...p, [r.key]: Number(e.target.value) }))}
                  className="w-full accent-primary"
                />
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card
        className={cn(
          "border shadow-soft",
          over ? "border-destructive/40 bg-destructive/5" : "border-success/30 bg-success/5"
        )}
      >
        <CardContent className="space-y-1 p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Remaining Balance</p>
            <span className={cn("text-[11px] font-semibold", over ? "text-destructive" : "text-success")}>
              {totalPct}% allocated
            </span>
          </div>
          <p className="font-display text-xl font-bold tabular-nums">
            {over ? "Over-allocated" : formatCurrency(remainingAmt, s.currency)}
          </p>
          <p className="text-xs text-muted-foreground">
            {over
              ? "⚠ You've allocated more than 100%. Reduce a category."
              : remainingPct === 0
                ? "Perfectly allocated."
                : `${remainingPct}% unassigned — consider moving to savings.`}
          </p>
        </CardContent>
      </Card>

      {/* Allocation Health Score */}
      {(() => {
        const insights: { tone: "ok" | "warn"; text: string }[] = [];
        if (alloc.savings >= 20) insights.push({ tone: "ok", text: "Savings healthy" });
        else insights.push({ tone: "warn", text: `Savings low — target 20% (now ${alloc.savings}%)` });
        if (alloc.food > 20) insights.push({ tone: "warn", text: "Food spending high" });
        if (alloc.travel > 15) insights.push({ tone: "warn", text: "Travel budget needs review" });
        if (alloc.rent > 35) insights.push({ tone: "warn", text: "Rent above 35% — heavy load" });
        if (alloc.emi > 40) insights.push({ tone: "warn", text: "EMI above 40% — debt stress" });
        const penalty = insights.filter((i) => i.tone === "warn").length * 8 + (over ? 20 : 0);
        const score = Math.max(0, Math.min(100, 100 - penalty));
        return (
          <Card className="shadow-soft">
            <CardContent className="space-y-2 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">Allocation Health</p>
                </div>
                <p className="font-display text-xl font-bold tabular-nums">
                  {score}<span className="text-xs text-muted-foreground">/100</span>
                </p>
              </div>
              <ul className="space-y-1">
                {insights.map((i, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-xs">
                    <span>{i.tone === "ok" ? "✓" : "⚠"}</span>
                    <span className={i.tone === "ok" ? "text-success" : "text-muted-foreground"}>{i.text}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        );
      })()}
    </div>
  );
}

/* ============================ Loans & EMI ============================ */

function LoansTab() {
  const { data: profile } = useProfile();
  const { data: loans = [] } = useLoans();
  const { data: txs = [] } = useTransactions();
  const currency = profile?.currency ?? "INR";

  const [extra, setExtra] = useState("");
  const extraAmt = Number(extra) || 0;

  const totals = useMemo(() => {
    const outstanding = loans.reduce((s, l) => s + l.remaining_balance, 0);
    const monthlyEmi = loans.reduce(
      (s, l) => s + (l.remaining_balance > 0 ? l.emi_amount : 0), 0);
    const now = new Date();
    const monthIncome = txs
      .filter((t) => {
        const d = new Date(t.transaction_date);
        return t.type === "income" && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      })
      .reduce((s, t) => s + t.amount, 0);
    const ratio = monthIncome > 0 ? (monthlyEmi / monthIncome) * 100 : 0;
    const pressure = ratio < 20 ? "Low" : ratio < 40 ? "Medium" : "High";
    const monthsToFree = monthlyEmi > 0 ? Math.ceil(outstanding / monthlyEmi) : 0;
    const debtFree = monthsToFree > 0
      ? new Date(now.getFullYear(), now.getMonth() + monthsToFree)
      : null;

    // Simulator with extra
    const monthsToFreeFast = (monthlyEmi + extraAmt) > 0
      ? Math.ceil(outstanding / (monthlyEmi + extraAmt))
      : 0;
    const monthsSaved = Math.max(0, monthsToFree - monthsToFreeFast);
    const avgRate = loans.length
      ? loans.reduce((s, l) => s + (l.interest_rate || 0), 0) / loans.length
      : 0;
    const interestSaved = Math.round((monthsSaved * monthlyEmi * avgRate) / 1200);

    return { outstanding, monthlyEmi, pressure, debtFree, monthsToFree, monthsToFreeFast, monthsSaved, interestSaved };
  }, [loans, txs, extraAmt]);

  function nextDue(due_day: number) {
    const t = new Date();
    const d = new Date(t.getFullYear(), t.getMonth(), Math.min(due_day, 28));
    if (d < t) d.setMonth(d.getMonth() + 1);
    return d;
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2.5">
        <Stat label="Total Loans" value={`${loans.length}`} />
        <Stat label="Outstanding" value={formatCurrency(totals.outstanding, currency)} />
        <Stat label="Monthly EMI" value={formatCurrency(totals.monthlyEmi, currency)} />
        <Stat
          label="EMI Pressure"
          value={totals.pressure}
          tone={totals.pressure === "High" ? "text-destructive" : totals.pressure === "Medium" ? "text-gold-foreground" : "text-success"}
        />
        <div className="col-span-2">
          <Stat
            label="Debt-Free By"
            value={totals.debtFree ? totals.debtFree.toLocaleDateString(undefined, { month: "short", year: "numeric" }) : "—"}
          />
        </div>
      </div>

      {loans.length === 0 ? (
        <Card className="border-success/30 bg-success/5 shadow-soft">
          <CardContent className="space-y-3 p-5 text-center">
            <p className="text-sm font-semibold">🎉 No active loans</p>
            <p className="text-xs text-muted-foreground">Great — now build an emergency fund of 3–6 months of expenses.</p>
            <Button asChild size="sm" variant="outline">
              <Link to="/loans">Add a loan</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
        {/* Loan Priority Engine */}
        {(() => {
          const ranked = [...loans]
            .filter((l) => l.remaining_balance > 0)
            .map((l) => ({
              l,
              // Avalanche score: prioritise high rate + small balance for quick wins
              score: (Number(l.interest_rate) || 0) * 10 - Math.log10(Math.max(1, l.remaining_balance)),
            }))
            .sort((a, b) => b.score - a.score)
            .slice(0, 3);
          if (ranked.length === 0) return null;
          const top = ranked[0].l;
          const monthsCut = totals.monthlyEmi > 0 ? Math.max(1, Math.ceil(top.remaining_balance / (top.emi_amount * 2))) : 0;
          const intSaved = Math.round((monthsCut * top.emi_amount * (top.interest_rate || 0)) / 1200);
          return (
            <Card className="border-primary/20 bg-primary/5 shadow-soft">
              <CardContent className="space-y-2.5 p-4">
                <div className="flex items-center gap-2">
                  <TargetIcon className="h-3.5 w-3.5 text-primary" />
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">Close This First</p>
                </div>
                <ol className="space-y-1 text-sm">
                  {ranked.map((r, i) => (
                    <li key={r.l.id} className="flex items-center justify-between">
                      <span><span className="font-semibold">#{i + 1}</span> {r.l.loan_name}</span>
                      <span className="text-[11px] text-muted-foreground tabular-nums">{formatCurrency(r.l.remaining_balance, currency)} @ {r.l.interest_rate}%</span>
                    </li>
                  ))}
                </ol>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div className="rounded-lg bg-background p-2">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Interest Saved</p>
                    <p className="font-display text-sm font-bold tabular-nums">{formatCurrency(intSaved, currency)}</p>
                  </div>
                  <div className="rounded-lg bg-background p-2">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Months Reduced</p>
                    <p className="font-display text-sm font-bold tabular-nums">~{monthsCut} mo</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })()}
        <div className="space-y-2.5">
          {loans.map((l) => {
            const paid = l.total_amount - l.remaining_balance;
            const pct = Math.min(100, (paid / l.total_amount) * 100);
            const emisLeft = Math.max(0, Math.ceil(l.remaining_balance / Math.max(1, l.emi_amount)));
            const due = nextDue(l.due_day);
            return (
              <Card key={l.id} className="shadow-soft">
                <CardContent className="space-y-2 p-3.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{l.loan_name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        EMI {formatCurrency(l.emi_amount, currency)} · {emisLeft} left · Due {due.toLocaleDateString(undefined, { day: "numeric", month: "short" })}
                      </p>
                    </div>
                    <p className="shrink-0 font-display text-sm font-bold tabular-nums">
                      {formatCurrency(l.remaining_balance, currency)}
                    </p>
                  </div>
                  <Progress value={pct} className="h-1.5" />
                  <p className="text-[11px] text-muted-foreground">{pct.toFixed(0)}% paid</p>
                </CardContent>
              </Card>
            );
          })}
          <Button asChild variant="outline" size="sm" className="w-full">
            <Link to="/loans">Manage loans</Link>
          </Button>
        </div>
        </>
      )}

      {/* Fast Payoff Simulator */}
      {loans.length > 0 && totals.monthlyEmi > 0 && (
        <Card className="border-primary/20 bg-primary/5 shadow-soft">
          <CardContent className="space-y-3 p-4">
            <div className="flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-primary" />
              <p className="text-sm font-semibold">Fast Payoff Simulator</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Extra monthly payment ({currency})</Label>
              <Input
                type="number" inputMode="decimal" placeholder="1000"
                value={extra} onChange={(e) => setExtra(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg bg-background p-2.5">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Debt-Free Earlier</p>
                <p className="mt-0.5 font-display text-base font-bold">
                  {extraAmt > 0 ? `${totals.monthsSaved} mo` : "—"}
                </p>
              </div>
              <div className="rounded-lg bg-background p-2.5">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Interest Saved</p>
                <p className="mt-0.5 font-display text-base font-bold">
                  {extraAmt > 0 ? formatCurrency(totals.interestSaved, currency) : "—"}
                </p>
              </div>
            </div>
            <p className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
              <Sparkles className="mt-0.5 h-3 w-3 shrink-0 text-gold" />
              Tip: Paying ₹1,000 extra/month can close small EMIs months earlier and save real interest.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* ============================ Bills & Subscriptions ============================ */

type Bill = {
  id: string;
  name: string;
  amount: number;
  dueDay: number;
  autoRenew: boolean;
};
const BILLS_KEY = "fintrackr_bills_v1";

function loadBills(): Bill[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(BILLS_KEY) || "[]"); } catch { return []; }
}

function BillsTab() {
  const s = useSurvival();
  const [bills, setBills] = useState<Bill[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", amount: "", dueDay: "5", autoRenew: true });

  useEffect(() => { setBills(loadBills()); }, []);
  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem(BILLS_KEY, JSON.stringify(bills));
  }, [bills]);

  const totalBills = bills.reduce((acc, b) => acc + b.amount, 0);
  const afterBills = Math.max(0, s.salaryLeft - totalBills);

  function add() {
    if (!form.name || !form.amount) return;
    setBills((p) => [
      ...p,
      {
        id: crypto.randomUUID(),
        name: form.name.trim(),
        amount: Number(form.amount),
        dueDay: Math.min(28, Math.max(1, Number(form.dueDay) || 1)),
        autoRenew: form.autoRenew,
      },
    ]);
    setForm({ name: "", amount: "", dueDay: "5", autoRenew: true });
    setOpen(false);
  }

  const today = new Date();
  const sorted = [...bills].sort((a, b) => {
    const da = new Date(today.getFullYear(), today.getMonth(), a.dueDay);
    if (da < today) da.setMonth(da.getMonth() + 1);
    const db = new Date(today.getFullYear(), today.getMonth(), b.dueDay);
    if (db < today) db.setMonth(db.getMonth() + 1);
    return da.getTime() - db.getTime();
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2.5">
        <Stat label="Upcoming Bills" value={formatCurrency(totalBills, s.currency)} />
        <Stat
          label="Left After Bills"
          value={s.hasIncome ? formatCurrency(afterBills, s.currency) : "—"}
          tone={afterBills <= 0 && s.hasIncome ? "text-destructive" : ""}
        />
      </div>

      {!open ? (
        <Button onClick={() => setOpen(true)} size="sm" variant="outline" className="w-full gap-1">
          <Plus className="h-4 w-4" /> Add bill / subscription
        </Button>
      ) : (
        <Card className="shadow-soft">
          <CardContent className="space-y-2.5 p-4">
            <div className="grid grid-cols-2 gap-2">
              <div className="col-span-2 space-y-1">
                <Label className="text-xs">Name</Label>
                <Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="Netflix" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Amount</Label>
                <Input type="number" inputMode="decimal" value={form.amount} onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Due day (1–28)</Label>
                <Input type="number" min={1} max={28} value={form.dueDay} onChange={(e) => setForm((p) => ({ ...p, dueDay: e.target.value }))} />
              </div>
            </div>
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox" checked={form.autoRenew}
                onChange={(e) => setForm((p) => ({ ...p, autoRenew: e.target.checked }))}
                className="accent-primary"
              />
              Auto-renews
            </label>
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" className="flex-1" onClick={() => setOpen(false)}>Cancel</Button>
              <Button size="sm" className="flex-1 bg-gradient-primary" onClick={add}>Add</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {sorted.length === 0 ? (
        <Card className="shadow-soft">
          <CardContent className="p-5 text-center text-sm text-muted-foreground">
            Add recurring bills (rent, electricity, OTT) to improve forecasting.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {sorted.map((b) => {
            const due = new Date(today.getFullYear(), today.getMonth(), b.dueDay);
            if (due < today) due.setMonth(due.getMonth() + 1);
            const days = Math.ceil((due.getTime() - today.getTime()) / 86_400_000);
            return (
              <Card key={b.id} className="shadow-soft">
                <CardContent className="flex items-center gap-3 p-3.5">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <BellRing className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{b.name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      Due {due.toLocaleDateString(undefined, { day: "numeric", month: "short" })} · {days === 0 ? "Today" : `in ${days}d`}
                      {b.autoRenew ? " · Auto-renews" : ""}
                    </p>
                  </div>
                  <p className="shrink-0 font-display text-sm font-bold tabular-nums">
                    {formatCurrency(b.amount, s.currency)}
                  </p>
                  <button
                    onClick={() => setBills((p) => p.filter((x) => x.id !== b.id))}
                    className="text-muted-foreground hover:text-destructive"
                    aria-label="Remove"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ============================ Goals ============================ */

type SimpleGoal = { id: string; name: string; current: number; target: number; deadline?: string };
const GOALS_KEY = "fintrackr_goals_v1";

function loadSimpleGoals(): SimpleGoal[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = JSON.parse(localStorage.getItem(GOALS_KEY) || "[]");
    return (raw as any[]).map((g) => ({
      id: g.id, name: g.name,
      current: Number(g.current) || 0,
      target: Number(g.target) || 0,
      deadline: g.deadline,
    }));
  } catch { return []; }
}

function GoalsTab() {
  const { data: profile } = useProfile();
  const currency = profile?.currency ?? "INR";
  const [goals, setGoals] = useState<SimpleGoal[]>([]);
  const [form, setForm] = useState({ name: "", target: "", deadline: "" });
  const [open, setOpen] = useState(false);

  useEffect(() => { setGoals(loadSimpleGoals()); }, []);

  function persist(next: SimpleGoal[]) {
    setGoals(next);
    if (typeof window !== "undefined") {
      // Merge with existing keys to stay compatible with /goals page schema
      try {
        const existing: any[] = JSON.parse(localStorage.getItem(GOALS_KEY) || "[]");
        const map = new Map(existing.map((g) => [g.id, g]));
        next.forEach((g) =>
          map.set(g.id, {
            id: g.id, name: g.name, kind: "savings",
            target: g.target, current: g.current, monthly: 0,
            deadline: g.deadline, createdAt: new Date().toISOString(),
          })
        );
        localStorage.setItem(GOALS_KEY, JSON.stringify([...map.values()]));
      } catch { /* noop */ }
    }
  }

  function add() {
    if (!form.name || !Number(form.target)) return;
    persist([
      { id: crypto.randomUUID(), name: form.name.trim(), current: 0, target: Number(form.target), deadline: form.deadline || undefined },
      ...goals,
    ]);
    setForm({ name: "", target: "", deadline: "" });
    setOpen(false);
  }

  return (
    <div className="space-y-3">
      {!open ? (
        <Button onClick={() => setOpen(true)} size="sm" variant="outline" className="w-full gap-1">
          <Plus className="h-4 w-4" /> Add goal
        </Button>
      ) : (
        <Card className="shadow-soft">
          <CardContent className="space-y-2.5 p-4">
            <div className="space-y-1">
              <Label className="text-xs">Goal name</Label>
              <Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="Emergency fund" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Target ({currency})</Label>
                <Input type="number" value={form.target} onChange={(e) => setForm((p) => ({ ...p, target: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Target date</Label>
                <Input type="date" value={form.deadline} onChange={(e) => setForm((p) => ({ ...p, deadline: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" className="flex-1" onClick={() => setOpen(false)}>Cancel</Button>
              <Button size="sm" className="flex-1 bg-gradient-primary" onClick={add}>Add</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {goals.length === 0 ? (
        <Card className="shadow-soft">
          <CardContent className="p-5 text-center text-sm text-muted-foreground">
            Create your first savings goal — even ₹5,000 builds momentum.
          </CardContent>
        </Card>
      ) : (
        goals.map((g) => {
          const pct = g.target > 0 ? Math.min(100, (g.current / g.target) * 100) : 0;
          return (
            <Card key={g.id} className="shadow-soft">
              <CardContent className="space-y-2 p-4">
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{g.name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {formatCurrency(g.current, currency)} of {formatCurrency(g.target, currency)}
                      {g.deadline ? ` · by ${new Date(g.deadline).toLocaleDateString(undefined, { month: "short", year: "numeric" })}` : ""}
                    </p>
                  </div>
                  <p className="text-xs font-semibold text-primary">{pct.toFixed(0)}%</p>
                </div>
                <Progress value={pct} className="h-1.5" />
              </CardContent>
            </Card>
          );
        })
      )}
      <Button asChild variant="ghost" size="sm" className="w-full text-xs text-muted-foreground">
        <Link to="/goals">Open full Goals page</Link>
      </Button>
    </div>
  );
}

/* ============================ Can I Buy This ============================ */

function CanIBuyThisTab() {
  const [item, setItem] = useState("");
  const [amountStr, setAmountStr] = useState("");
  const amount = Number(amountStr) || 0;

  const before = useSurvival(0);
  const after = useSurvival(amount);

  const dropPct = before.score > 0 ? ((before.score - after.score) / before.score) * 100 : 0;
  const ratio = before.salaryLeft > 0 ? amount / before.salaryLeft : amount > 0 ? 1 : 0;

  const verdict =
    amount === 0
      ? { tone: "neutral" as const, dot: "⚪", title: "Enter an amount", msg: "Tell us how much this costs." }
      : amount > before.salaryLeft
        ? { tone: "danger" as const, dot: "🔴", title: "Not Recommended", msg: "More than what's left till salary." }
        : ratio > 0.4 || dropPct > 25
          ? { tone: "danger" as const, dot: "🔴", title: "Not Recommended", msg: "Likely affects your month-end survival." }
          : ratio > 0.2 || dropPct > 12
            ? { tone: "careful" as const, dot: "🟡", title: "Think Twice", msg: "You can afford it, but you'll feel the squeeze." }
            : { tone: "safe" as const, dot: "🟢", title: "Safe Purchase", msg: "Comfortably within your safe spend." };

  const toneCls =
    verdict.tone === "danger"
      ? "border-destructive/30 bg-destructive/5 text-destructive"
      : verdict.tone === "careful"
        ? "border-gold/30 bg-gold/10 text-gold-foreground"
        : verdict.tone === "safe"
          ? "border-success/30 bg-success/10 text-success"
          : "border-border bg-muted/40 text-foreground";

  return (
    <div className="space-y-4">
      <Card className="shadow-soft">
        <CardContent className="space-y-2.5 p-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Item name</Label>
            <Input placeholder="e.g. Running shoes" value={item} onChange={(e) => setItem(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Price ({before.currency})</Label>
            <Input type="number" inputMode="decimal" placeholder="2499" value={amountStr} onChange={(e) => setAmountStr(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      {amount > 0 && (
        <Card className="shadow-soft">
          <CardContent className="space-y-2.5 p-4">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              If you buy {item.trim() || "this"}
            </p>
            <Row label="Salary left" before={formatCurrency(before.salaryLeft, before.currency)} after={formatCurrency(after.salaryLeft, before.currency)} />
            <Row label="Safe daily spend" before={formatCurrency(before.safeDaily, before.currency)} after={formatCurrency(after.safeDaily, before.currency)} />
            <Row label="Survival score" before={`${before.score}/100`} after={`${after.score}/100`} />
          </CardContent>
        </Card>
      )}

      <Card className={cn("border shadow-soft", toneCls)}>
        <CardContent className="flex items-start gap-2 p-4">
          <span className="text-lg leading-none">{verdict.dot}</span>
          <div className="text-sm">
            <p className="font-semibold">{verdict.title}</p>
            <p className="opacity-90">{verdict.msg}</p>
            {amount > 0 && (
              <p className="mt-1 text-xs opacity-80">
                This purchase may affect your month-end survival budget.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, before, after }: { label: string; before: string; after: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="flex items-center gap-1.5 font-medium tabular-nums">
        <span className="text-muted-foreground line-through opacity-70">{before}</span>
        <ArrowRight className="h-3 w-3 text-muted-foreground" />
        <span>{after}</span>
      </span>
    </div>
  );
}
