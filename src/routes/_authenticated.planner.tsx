import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight, Sparkles, Plus, Trash2, TrendingDown, BellRing,
  CheckCircle2, Flame, Target as TargetIcon, ShieldCheck, Rocket, Lock, CheckCircle,
  Wallet, MessageSquare, TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { PageHeader } from "@/components/finance/PageHeader";
import { FinancialJourney } from "@/components/finance/FinancialJourney";
import { useTransactions, useLoans, useProfile, useCategories, type Loan } from "@/hooks/use-finance";
import {
  LoanFormSheet, LoanDetailSheet, loanTypeMeta, nextLoanDueDate,
} from "@/components/finance/LoanSheets";
import { buildSnowballPlan } from "@/lib/loan-snowball";
import { useSalarySettings } from "@/hooks/use-salary-settings";
import { computeSurvival } from "@/lib/survival";
import { formatCurrency } from "@/lib/currency";
import { cn } from "@/lib/utils";
import {
  computeFutureScore, computeMilestones, computeFutureActions, computeNetWorth,
  loadFutureGoals, type Milestone, type FutureAction, type NetWorth,
} from "@/lib/future-insights";
import { enqueuePlannerTask } from "@/lib/coach-plan";
import { onProfileUpdated } from "@/lib/financial-profile";
import { PurchaseCheckPanel } from "@/components/finance/PurchaseCheckPanel";
import { GoalFormSheet, GoalDetailSheet } from "@/components/finance/GoalSheets";
import {
  loadGoals, upsertGoal, isCompleted, computeGoalPlan,
  GOALS_EVENT, GOAL_STATUS_LABEL, type Goal,
} from "@/lib/goals-store";

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

type TabKey = "monthly" | "allocation" | "loans" | "bills" | "goals" | "cibt" | "future";

const TABS: { key: TabKey; label: string }[] = [
  { key: "monthly", label: "Plan" },
  { key: "allocation", label: "Allocate" },
  { key: "loans", label: "Loans" },
  { key: "bills", label: "Bills" },
  { key: "goals", label: "Goals" },
  { key: "cibt", label: "Buy" },
  { key: "future", label: "Future" },
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
        {tab === "future" && <FutureTab />}
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
  // GREEN if positive; ORANGE if 0 to -2000; RED if < -2000
  const forecastTone =
    forecast > 0
      ? "text-success"
      : forecast >= -2000
        ? "text-gold-foreground"
        : "text-destructive";
  const forecastBorder =
    forecast > 0
      ? "border-success/30 bg-success/5"
      : forecast >= -2000
        ? "border-gold/30 bg-gold/10"
        : "border-destructive/30 bg-destructive/5";
  const forecastLabel =
    forecast > 0
      ? `You may save ${formatCurrency(forecast, s.currency)} this month 🎯`
      : forecast >= -2000
        ? "Slight overspend risk ⚠️"
        : "Reduce daily spend to recover";
  
  const zone =
    s.score >= 70
      ? { dot: "🟢", label: "Safe Zone", tone: "bg-success/20 text-success" }
      : s.score >= 40
        ? { dot: "🟡", label: "Watch Spending", tone: "bg-gold/20 text-gold-foreground" }
        : { dot: "🔴", label: "Danger Zone", tone: "bg-destructive/20 text-destructive" };

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden border-none bg-gradient-primary text-primary-foreground shadow-elegant">
        <CardContent className="space-y-2 p-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] opacity-90">Salary Left</p>
            <p className="mt-1 font-display text-[28px] font-bold leading-none">
              {s.hasIncome ? formatCurrency(s.salaryLeft, s.currency) : "—"}
            </p>
            <p className="mt-1.5 text-xs font-medium opacity-95">
              {s.hasIncome
                ? s.isSalaryToday
                  ? `Salary Today 🎉 · ${formatCurrency(s.safeDaily, s.currency)} safe today`
                  : `${s.days} day${s.days === 1 ? "" : "s"} left · ${formatCurrency(s.safeDaily, s.currency)}/day safe`
                : "Add this month's salary to unlock your plan."}
            </p>
            {s.hasIncome && s.days <= 5 && s.safeDaily > 3000 && (
              <p className="mt-1 text-[11px] font-medium opacity-90">Most expenses already covered ✓</p>
            )}
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

      {/* Weekly budget tracker */}
      {s.hasIncome && <WeeklyBudget salary={s.salary} currency={s.currency} cycleStart={s.lastSalaryDate} />}

      {/* Smart Next Actions — personalized from real data */}
      {s.hasIncome && <SmartNextActions s={s} outstanding={outstanding} />}

      {/* Financial Health Score */}
      {s.hasIncome && <HealthScoreCard s={s} outstanding={outstanding} />}

      <Link
        to="/insights/coach"
        preload="intent"
        className="flex items-center gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-3.5 shadow-soft transition-colors hover:bg-primary/10"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
          <Sparkles className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">Want personalized advice?</p>
          <p className="truncate text-xs text-muted-foreground">Visit AI Salary Survival Coach in Insights</p>
        </div>
        <ArrowRight className="h-4 w-4 shrink-0 text-primary" />
      </Link>
    </div>
  );
}

/* ---------- Next Action & Health Score ---------- */

/* ---------- Smart Next Actions, Weekly Budget & Health Score ---------- */

function SmartNextActions({ s, outstanding }: { s: ReturnType<typeof useSurvival>; outstanding: number }) {
  const { data: txs = [] } = useTransactions();
  const { data: cats = [] } = useCategories();
  const { data: loans = [] } = useLoans();

  const tips = useMemo(() => {
    const out: { icon: string; text: string }[] = [];
    const toKey = (d: Date) => d.toISOString().slice(0, 10);
    const cycleStartKey = toKey(s.lastSalaryDate);
    const todayKey = toKey(new Date());

    const cycleExpenses = txs.filter(
      (t) =>
        t.type === "expense" &&
        String(t.transaction_date).slice(0, 10) >= cycleStartKey &&
        String(t.transaction_date).slice(0, 10) <= todayKey,
    );

    // Smallest active loan → snowball tip
    const activeLoans = loans.filter((l) => Number(l.remaining_balance) > 0);
    if (activeLoans.length > 0) {
      const smallest = [...activeLoans].sort((a, b) => a.remaining_balance - b.remaining_balance)[0];
      const monthsNow = Math.max(1, Math.ceil(smallest.remaining_balance / Math.max(1, smallest.emi_amount)));
      const monthsFast = Math.max(1, Math.ceil(smallest.remaining_balance / Math.max(1, smallest.emi_amount + 500)));
      const saved = Math.max(0, monthsNow - monthsFast);
      out.push({
        icon: "🎯",
        text: `Pay ${formatCurrency(500, s.currency)} extra on ${smallest.loan_name} this month. You'll close it ${saved || 1} month${saved === 1 ? "" : "s"} early.`,
      });
    }

    // Food overspend check (food > 20% of salary)
    const foodCatIds = new Set(
      cats.filter((c) => /food|dining|eat/i.test(c.name)).map((c) => c.id),
    );
    const foodSpend = cycleExpenses
      .filter((t) => t.category_id && foodCatIds.has(t.category_id))
      .reduce((a, t) => a + Number(t.amount), 0);
    if (s.salary > 0 && foodSpend > s.salary * 0.2) {
      out.push({
        icon: "🍔",
        text: `Your food spend is ${formatCurrency(foodSpend, s.currency)} this cycle. Cook 3 meals at home to save ~${formatCurrency(800, s.currency)}.`,
      });
    }

    // No emergency fund — proxy: no savings goal progress and overall salaryLeft low
    const hasNoSavingsBuffer = s.salary > 0 && s.salaryLeft < s.salary * 0.1;
    if (hasNoSavingsBuffer && activeLoans.length === 0) {
      out.push({
        icon: "🛡️",
        text: `Start an emergency fund with ${formatCurrency(500, s.currency)}/month — that's only ${formatCurrency(17, s.currency)}/day.`,
      });
    }

    // Forecast-driven tips
    if (s.forecastBalance < -2000) {
      out.push({
        icon: "🔻",
        text: `Stay under ${formatCurrency(s.safeDaily, s.currency)}/day to recover before salary.`,
      });
    } else if (s.forecastBalance >= 0 && s.score >= 70) {
      out.push({
        icon: "✅",
        text: `You're doing great this month! Consider investing ${formatCurrency(Math.max(500, Math.round(s.salary * 0.05)), s.currency)} in an SIP.`,
      });
    }

    // 10% savings nudge always (fills slot)
    if (s.salary > 0) {
      out.push({
        icon: "💰",
        text: `Save ${formatCurrency(Math.round(s.salary * 0.1), s.currency)} this month (10% rule).`,
      });
    }

    return out.slice(0, 3);
  }, [txs, cats, loans, s, outstanding]);

  return (
    <Card className="border-primary/20 shadow-soft">
      <CardContent className="space-y-2 p-4">
        <div className="flex items-center gap-2">
          <Flame className="h-3.5 w-3.5 text-primary" />
          <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">Next Actions</p>
        </div>
        <ul className="space-y-1.5">
          {tips.map((a, i) => (
            <li key={i} className="flex items-start gap-2 text-sm">
              <span className="mt-0.5 text-sm leading-none">{a.icon}</span>
              <span className="leading-snug">{a.text}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function WeeklyBudget({ salary, currency, cycleStart }: { salary: number; currency: string; cycleStart: Date }) {
  const { data: txs = [] } = useTransactions();
  const weeklyBudget = salary / 4;
  const today = new Date();
  const todayKey = today.toISOString().slice(0, 10);

  const weeks = useMemo(() => {
    const arr: { idx: number; start: Date; end: Date; spent: number; upcoming: boolean }[] = [];
    for (let i = 0; i < 4; i++) {
      const start = new Date(cycleStart);
      start.setDate(cycleStart.getDate() + i * 7);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      const sk = start.toISOString().slice(0, 10);
      const ek = end.toISOString().slice(0, 10);
      const upcoming = todayKey < sk;
      // Only count spending for weeks that have started; never project into the future.
      const spent = upcoming
        ? 0
        : txs
            .filter((t) => {
              const k = String(t.transaction_date).slice(0, 10);
              return t.type === "expense" && k >= sk && k <= ek && k <= todayKey;
            })
            .reduce((a, t) => a + Number(t.amount), 0);
      arr.push({ idx: i + 1, start, end, spent, upcoming });
    }
    return arr;
  }, [txs, cycleStart, todayKey]);

  const fmtRange = (a: Date, b: Date) =>
    `${a.toLocaleDateString(undefined, { day: "numeric", month: "short" })}–${b.toLocaleDateString(undefined, { day: "numeric", month: "short" })}`;

  return (
    <Card className="shadow-soft rounded-2xl">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">This Cycle's Weekly Budget</p>
          <p className="text-[13px] font-bold text-success tabular-nums">{formatCurrency(weeklyBudget, currency)}/week</p>
        </div>
        <ul className="flex flex-col gap-3.5">
          {weeks.map((w, i) => {
            const diff = weeklyBudget - w.spent;
            const over = !w.upcoming && diff < 0;
            const reached = !w.upcoming && diff === 0 && w.spent > 0;
            const absDiff = Math.abs(diff);
            const pct = w.upcoming ? 0 : Math.min(100, (w.spent / weeklyBudget) * 100);

            const statusLabel = w.upcoming ? "Upcoming" : over ? "⚠️ Over" : "✅ Under";
            const statusColor = w.upcoming ? "text-muted-foreground" : over ? "text-gold-foreground" : "text-success";
            const trackStyle = { backgroundColor: "var(--muted)" };
            const fillColor = w.upcoming ? "var(--muted)" : over ? "var(--warning)" : "var(--success)";

            let rightDetail: React.ReactNode;
            if (w.upcoming) {
              rightDetail = <span className="text-muted-foreground">Not started</span>;
            } else if (over) {
              rightDetail = <span className="text-gold-foreground">Over by {formatCurrency(absDiff, currency)}</span>;
            } else if (reached) {
              rightDetail = <span className="text-success">Budget reached 🎯</span>;
            } else {
              rightDetail = <span className="text-success">{formatCurrency(absDiff, currency)} left</span>;
            }

            return (
              <li
                key={w.idx}
                className={cn("space-y-1.5", i > 0 && "border-t pt-3.5")}
              >
                <div className="flex items-center justify-between text-[13px]">
                  <span className="font-medium text-foreground/80">
                    Week {w.idx} · {fmtRange(w.start, w.end)}
                  </span>
                  <span className={cn("font-medium", statusColor)}>{statusLabel}</span>
                </div>
                <div className="w-full overflow-hidden" style={{ height: 5, borderRadius: 3, ...trackStyle }}>
                  <div className="h-full transition-all" style={{ width: `${pct}%`, borderRadius: 3, backgroundColor: fillColor }} />
                </div>
                <div className="flex items-center justify-between text-[13px] tabular-nums">
                  <span className={cn(w.upcoming ? "text-muted-foreground" : "text-foreground")}>
                    Spent {formatCurrency(w.spent, currency)}
                  </span>
                  {rightDetail}
                </div>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}


/**
 * Survival sub-score (max 30) built from real cycle data:
 * days under budget (12) + month-end forecast health (10) + spending rate (8).
 */
function survivalSubScore(s: ReturnType<typeof useSurvival>): number {
  // Step 1 — days under budget (max 12)
  const elapsed = Math.max(1, s.daysElapsed);
  const ratio = s.daysUnderBudget / elapsed;
  const stepDays = ratio >= 0.9 ? 12 : ratio >= 0.7 ? 9 : ratio >= 0.5 ? 6 : 3;

  // Step 2 — forecast health (max 10), reusing the existing forecast + salary
  const forecastPct = s.salary > 0 ? s.forecastBalance / s.salary : 0;
  const stepForecast =
    s.forecastBalance <= 0 ? 0 : forecastPct > 0.2 ? 10 : forecastPct > 0.1 ? 8 : 5;

  // Step 3 — spending rate (max 8)
  const rate = s.salary > 0 ? s.totalSpent / s.salary : 1;
  const stepRate = rate < 0.2 ? 8 : rate < 0.4 ? 6 : rate < 0.6 ? 4 : 2;

  return Math.min(30, stepDays + stepForecast + stepRate);
}

function HealthScoreCard({ s, outstanding }: { s: ReturnType<typeof useSurvival>; outstanding: number }) {
  const savings = s.salary > 0 ? Math.min(25, Math.max(0, (s.salaryLeft / s.salary) * 25)) : 0;
  const debt = s.salary > 0 ? Math.max(0, 25 - (s.monthlyEmi / s.salary) * 50) : 25;
  const bills = 20; // assume on-track until billing data integrated
  const survival = survivalSubScore(s);
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

  const updatedLabel = new Date().toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

  return (
    <Card className="border-teal/30 shadow-soft">
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-3.5 w-3.5 text-teal" />
              <p className="text-[11px] font-semibold uppercase tracking-wider text-teal">Financial Health</p>
            </div>
            <p className="mt-1 text-[10.5px] font-medium text-muted-foreground">Last updated · Today, {updatedLabel}</p>
          </div>
          <p className="font-display text-xl font-bold tabular-nums">{total}<span className="text-xs font-medium text-muted-foreground">/100</span></p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {bars.map((b) => (
            <div key={b.label}>
              <div className="flex justify-between text-[11px] font-medium">
                <span className="text-muted-foreground">{b.label}</span>
                <span className="tabular-nums text-foreground/85">{b.val}/{b.max}</span>
              </div>
              <Progress value={(b.val / b.max) * 100} className="h-1" />
            </div>
          ))}
        </div>
        <p className="text-[11.5px] font-medium text-foreground/80">{tip}</p>
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

  const [addOpen, setAddOpen] = useState(false);
  const [selected, setSelected] = useState<Loan | null>(null);
  const [extra, setExtra] = useState("");
  const extraAmt = Math.max(0, Number(extra) || 0);

  const active = useMemo(
    () => loans.filter((l) => Number(l.remaining_balance) > 0),
    [loans],
  );
  const closed = useMemo(
    () => loans.filter((l) => Number(l.remaining_balance) <= 0),
    [loans],
  );

  // Keep the existing summary calculation logic untouched in behaviour.
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
    return { outstanding, monthlyEmi, pressure, debtFree, monthsToFree };
  }, [loans, txs]);

  // Read-only snowball projection — never writes to any loan or transaction.
  const plan = useMemo(() => buildSnowballPlan(active, extraAmt), [active, extraAmt]);

  return (
    <div className="space-y-4">
      {/* 1 — Current debt situation */}
      <div className="grid grid-cols-2 gap-2.5">
        <Stat label="Total Loans" value={`${active.length}`} />
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

      {active.length === 0 ? (
        <Card className="border-success/30 bg-success/5 shadow-soft">
          <CardContent className="space-y-3 p-5 text-center">
            <p className="text-sm font-semibold">🎉 No active loans</p>
            <p className="text-xs text-muted-foreground">
              Great — now build an emergency fund of 3–6 months of expenses.
            </p>
            <Button size="sm" variant="outline" onClick={() => setAddOpen(true)}>
              <Plus className="mr-1.5 h-4 w-4" />Add a loan
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* 2 — Active loans */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                My Loans
              </p>
              <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => setAddOpen(true)}>
                <Plus className="mr-1 h-3.5 w-3.5" />Add loan
              </Button>
            </div>

            {active.map((l) => {
              const paid = Math.max(0, l.total_amount - l.remaining_balance);
              const pct = l.total_amount > 0 ? Math.min(100, (paid / l.total_amount) * 100) : 0;
              const emisLeft = l.emi_amount > 0
                ? Math.max(0, Math.ceil(l.remaining_balance / l.emi_amount))
                : 0;
              const due = nextLoanDueDate(l.due_day);
              const Icon = loanTypeMeta(l.loan_type).icon;
              return (
                <Card key={l.id} className="shadow-soft">
                  <CardContent className="space-y-2 p-3.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex min-w-0 items-start gap-2.5">
                        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <Icon className="h-4 w-4" />
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">{l.loan_name}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {loanTypeMeta(l.loan_type).label}
                            {l.interest_rate > 0 ? ` · ${l.interest_rate}% p.a.` : ""}
                          </p>
                        </div>
                      </div>
                      <p className="shrink-0 font-display text-sm font-bold tabular-nums">
                        {formatCurrency(l.remaining_balance, currency)}
                      </p>
                    </div>
                    <Progress value={pct} className="h-1.5" />
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
                      <span>{pct.toFixed(0)}% repaid</span>
                      <span>·</span>
                      <span>EMI {formatCurrency(l.emi_amount, currency)}</span>
                      <span>·</span>
                      <span>{emisLeft} left</span>
                      <span>·</span>
                      <span>Next {due.toLocaleDateString(undefined, { day: "numeric", month: "short" })}</span>
                    </div>
                    <Button
                      size="sm" variant="outline" className="w-full"
                      onClick={() => setSelected(l)}
                    >
                      View / Manage
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* 4 — Payoff strategy (read-only estimate) */}
          <Card className="border-primary/20 bg-primary/5 shadow-soft">
            <CardContent className="space-y-3 p-4">
              <div className="flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-primary" />
                <p className="text-sm font-semibold">Debt Payoff Plan</p>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Snowball method: keep paying every minimum EMI, then put any extra money on the
                smallest balance first. When it closes, roll that payment into the next loan.
              </p>

              <div className="space-y-1.5">
                <Label className="text-xs">Extra monthly payment ({currency}) — optional</Label>
                <Input
                  type="number" inputMode="decimal" placeholder="1000"
                  value={extra} onChange={(e) => setExtra(e.target.value)}
                />
              </div>

              {plan.target && (
                <div className="rounded-lg bg-background p-2.5">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Current target loan</p>
                  <p className="mt-0.5 text-sm font-semibold">{plan.target.name}</p>
                  <p className="text-[11px] text-muted-foreground tabular-nums">
                    {formatCurrency(plan.target.balance, currency)} outstanding · EMI{" "}
                    {formatCurrency(plan.target.emi, currency)}
                    {extraAmt > 0 ? ` + ${formatCurrency(extraAmt, currency)} extra` : ""}
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-background p-2.5">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Est. debt-free by</p>
                  <p className="mt-0.5 font-display text-sm font-bold">
                    {plan.debtFreeDate
                      ? plan.debtFreeDate.toLocaleDateString(undefined, { month: "short", year: "numeric" })
                      : "—"}
                  </p>
                </div>
                <div className="rounded-lg bg-background p-2.5">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    {extraAmt > 0 ? "Est. months saved" : "Est. months left"}
                  </p>
                  <p className="mt-0.5 font-display text-sm font-bold tabular-nums">
                    {extraAmt > 0
                      ? `${plan.monthsSaved} mo`
                      : plan.monthsToDebtFree > 0 ? `${plan.monthsToDebtFree} mo` : "—"}
                  </p>
                </div>
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>Estimated payoff progress</span>
                  <span className="tabular-nums">{plan.progressPct.toFixed(0)}%</span>
                </div>
                <Progress value={plan.progressPct} className="h-1.5" />
              </div>

              <div className="space-y-1.5">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Recommended payoff order
                </p>
                <ol className="space-y-1.5">
                  {plan.order.map((s, i) => (
                    <li key={s.id} className="rounded-lg bg-background p-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <p className="min-w-0 truncate text-sm font-semibold">
                          #{i + 1} {s.name}
                        </p>
                        <p className="shrink-0 text-sm font-bold tabular-nums">
                          {formatCurrency(s.balance, currency)}
                        </p>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        {s.monthsToClose > 0
                          ? `Est. closes ${s.payoffDate?.toLocaleDateString(undefined, { month: "short", year: "numeric" })} (~${s.monthsToClose} mo)`
                          : "Add an EMI amount to estimate a closing date"}
                      </p>
                    </li>
                  ))}
                </ol>
              </div>

              <p className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
                <Sparkles className="mt-0.5 h-3 w-3 shrink-0 text-gold" />
                These are estimates only. Nothing here changes your real balances, transactions or
                budgets — record a payment from a loan to update it for real.
              </p>
            </CardContent>
          </Card>
        </>
      )}

      {/* 5 — Closed loans (kept as history) */}
      {closed.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Closed Loans
          </p>
          {closed.map((l) => (
            <Card key={l.id} className="border-dashed shadow-none">
              <CardContent className="flex items-center justify-between gap-2 p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{l.loan_name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    Paid off · Borrowed {formatCurrency(l.total_amount, currency)}
                  </p>
                </div>
                <Button
                  size="sm" variant="ghost" className="h-7 shrink-0 px-2 text-xs"
                  onClick={() => setSelected(l)}
                >
                  View
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <LoanFormSheet open={addOpen} onOpenChange={setAddOpen} />
      {selected && (
        <LoanDetailSheet
          key={selected.id}
          loan={loans.find((l) => l.id === selected.id) ?? selected}
          currency={currency}
          open
          onOpenChange={(v) => { if (!v) setSelected(null); }}
        />
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

function GoalsTab() {
  const { data: profile } = useProfile();
  const currency = profile?.currency ?? "INR";
  const [goals, setGoals] = useState<Goal[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Goal | undefined>(undefined);
  const [detailId, setDetailId] = useState<string | null>(null);

  useEffect(() => {
    const refresh = () => setGoals(loadGoals());
    refresh();
    window.addEventListener(GOALS_EVENT, refresh);
    let alive = true;
    syncGoalsFromCloud()
      .then((cloud) => { if (alive) setGoals(cloud); })
      .catch(() => toast.error("Couldn't load your saved goals from the cloud"));
    return () => { alive = false; window.removeEventListener(GOALS_EVENT, refresh); };
  }, []);

  function save(goal: Goal) {
    const previous = goals;
    setGoals(upsertGoal(goal));
    persistGoal(goal).catch(() => {
      setGoals(previous);
      saveGoals(previous);
      toast.error("Couldn't save your goal. Please check your connection and try again.");
    });
  }


  const active = goals.filter((g) => !isCompleted(g));
  const completed = goals.filter((g) => isCompleted(g));
  const detail = goals.find((g) => g.id === detailId) ?? null;

  return (
    <div className="space-y-3">
      <Button
        onClick={() => { setEditing(undefined); setFormOpen(true); }}
        size="sm" variant="outline" className="w-full gap-1"
      >
        <Plus className="h-4 w-4" /> Add goal
      </Button>

      {goals.length === 0 && (
        <Card className="shadow-soft">
          <CardContent className="p-5 text-center text-sm text-muted-foreground">
            Create your first savings goal — even a small monthly amount builds momentum.
          </CardContent>
        </Card>
      )}

      {active.length > 0 && (
        <section className="space-y-2">
          <h3 className="px-0.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            My Goals
          </h3>
          {active.map((g) => (
            <GoalCard key={g.id} goal={g} currency={currency} onOpen={() => setDetailId(g.id)} />
          ))}
        </section>
      )}

      {completed.length > 0 && (
        <section className="space-y-2 pt-1">
          <h3 className="px-0.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Completed Goals
          </h3>
          {completed.map((g) => (
            <GoalCard key={g.id} goal={g} currency={currency} onOpen={() => setDetailId(g.id)} />
          ))}
        </section>
      )}

      <p className="px-1 text-[10px] text-muted-foreground">
        Goal figures are planning estimates. Nothing here creates transactions or changes balances.
      </p>

      <GoalFormSheet
        open={formOpen}
        onOpenChange={(o) => { setFormOpen(o); if (!o) setEditing(undefined); }}
        initial={editing}
        currency={currency}
        onSave={save}
      />
      <GoalDetailSheet
        goal={detail}
        onOpenChange={() => setDetailId(null)}
        currency={currency}
        onSave={save}
        onEdit={(g) => { setDetailId(null); setEditing(g); setFormOpen(true); }}
      />
    </div>
  );
}

function GoalCard({ goal, currency, onOpen }: { goal: Goal; currency: string; onOpen: () => void }) {
  const plan = computeGoalPlan(goal);
  const tone =
    plan.status === "completed" ? "bg-success/15 text-success"
      : plan.status === "behind" ? "bg-destructive/15 text-destructive"
        : plan.status === "on_track" ? "bg-primary/15 text-primary"
          : "bg-muted text-muted-foreground";

  return (
    <Card className="shadow-soft">
      <CardContent className="space-y-2 p-4">
        <button type="button" onClick={onOpen} className="w-full text-left">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{goal.name}</p>
              <p className="text-[11px] text-muted-foreground">
                {formatCurrency(goal.current, currency)} of {formatCurrency(goal.target, currency)}
                {goal.deadline ? ` · by ${new Date(goal.deadline).toLocaleDateString(undefined, { month: "short", year: "numeric" })}` : ""}
              </p>
            </div>
            <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider", tone)}>
              {GOAL_STATUS_LABEL[plan.status]}
            </span>
          </div>
          <Progress value={plan.progressPct} className="mt-2 h-1.5" />
          <div className="mt-1.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
            <span>{plan.progressPct.toFixed(0)}% · {formatCurrency(plan.remaining, currency)} left</span>
            {plan.requiredMonthly != null && (
              <span>Need {formatCurrency(plan.requiredMonthly, currency)}/mo</span>
            )}
          </div>
          {goal.monthly > 0 && (
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Your plan: {formatCurrency(goal.monthly, currency)}/month
            </p>
          )}
        </button>
      </CardContent>
    </Card>
  );
}


/* ============================ Can I Buy This ============================ */

function CanIBuyThisTab() {
  return <PurchaseCheckPanel />;
}

/* ============================ Future Tab ============================ */

function FutureTab() {
  const s = useSurvival();
  const { data: transactions = [] } = useTransactions();
  const { data: loans = [] } = useLoans();
  const [goals, setGoals] = useState(loadFutureGoals());

  // Re-read goals/profile on focus and profile updates so the tab stays fresh.
  useEffect(() => {
    const refresh = () => setGoals(loadFutureGoals());
    const off = onProfileUpdated(refresh);
    window.addEventListener("focus", refresh);
    return () => { off(); window.removeEventListener("focus", refresh); };
  }, []);

  const score = useMemo(
    () => computeFutureScore({ survival: s, transactions, loans, goals }),
    [s, transactions, loans, goals],
  );
  const milestones = useMemo(
    () => computeMilestones({ survival: s, transactions, loans, goals }),
    [s, transactions, loans, goals],
  );
  const actions = useMemo(
    () => computeFutureActions({ survival: s, transactions, loans, goals }),
    [s, transactions, loans, goals],
  );
  const netWorth = useMemo(
    () => computeNetWorth({ survival: s, transactions, loans, goals }),
    [s, transactions, loans, goals],
  );

  return (
    <div className="space-y-4">
      <FutureScoreCard score={score} />
      <FutureActionsCard actions={actions} />
      <NetWorthCard nw={netWorth} currency={s.currency} />
      <FutureMilestonesCard milestones={milestones} currency={s.currency} />
    </div>
  );
}

function FutureActionsCard({ actions }: { actions: FutureAction[] }) {
  if (actions.length === 0) {
    return (
      <Card className="shadow-soft">
        <CardContent className="p-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">
              Actions to Build Your Future
            </p>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            You're on track — no urgent actions right now. Keep saving consistently.
          </p>
        </CardContent>
      </Card>
    );
  }

  const priTone = (p: FutureAction["priority"]) =>
    p === "High"
      ? "bg-destructive/15 text-destructive"
      : p === "Medium"
        ? "bg-gold/15 text-gold-foreground"
        : "bg-primary/15 text-primary";

  return (
    <Card className="shadow-soft">
      <CardContent className="space-y-3 p-4">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">
              Actions to Build Your Future
            </p>
          </div>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Top 3 moves ranked by financial impact
          </p>
        </div>

        <ul className="space-y-2.5">
          {actions.map((a) => (
            <li key={a.id} className="rounded-xl border bg-card p-3">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold">{a.title}</p>
                <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold", priTone(a.priority))}>
                  {a.priority}
                </span>
              </div>
              <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{a.why}</p>
              <div className="mt-2 flex flex-wrap gap-1.5 text-[10px]">
                <span className="rounded-full bg-success/10 px-2 py-0.5 font-medium text-success">
                  {a.impactLabel}
                </span>
                <span className="rounded-full bg-muted px-2 py-0.5 font-medium text-muted-foreground">
                  {a.timeSaved}
                </span>
              </div>
              <div className="mt-2.5 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  className="h-7 rounded-full px-3 text-[11px]"
                  onClick={() => {
                    enqueuePlannerTask({
                      id: `future-action-${a.id}`,
                      title: a.plannerTitle,
                      detail: a.plannerDetail,
                    });
                    toast.success("Added to Planner");
                  }}
                >
                  <Plus className="mr-1 h-3 w-3" /> Apply to Planner
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  asChild
                  className="h-7 rounded-full px-3 text-[11px]"
                >
                  <Link
                    to="/insights/ai-coach"
                    search={{ q: a.coachPrompt } as never}
                  >
                    <MessageSquare className="mr-1 h-3 w-3" /> Ask AI Coach
                  </Link>
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function NetWorthCard({ nw, currency }: { nw: NetWorth; currency: string }) {
  if (!nw.hasSignal) {
    return (
      <Card className="shadow-soft">
        <CardContent className="p-4">
          <div className="flex items-center gap-2">
            <Wallet className="h-3.5 w-3.5 text-primary" />
            <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">Net Worth</p>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Complete your Salary Profile and add savings, goals or loans to see your net worth.
          </p>
        </CardContent>
      </Card>
    );
  }

  const nwTone =
    nw.netWorth > 0 ? "text-success" : nw.netWorth < 0 ? "text-destructive" : "text-foreground";

  return (
    <Card className="shadow-soft">
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <Wallet className="h-3.5 w-3.5 text-primary" />
              <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">Net Worth</p>
            </div>
            <p className="mt-0.5 text-[11px] text-muted-foreground">Assets − Liabilities</p>
          </div>
          <p className={cn("font-display text-2xl font-bold tabular-nums", nwTone)}>
            {formatCurrency(nw.netWorth, currency)}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg border bg-card p-2.5">
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Assets</p>
            <p className="mt-1 text-sm font-semibold tabular-nums text-success">
              {formatCurrency(nw.assets, currency)}
            </p>
            <p className="mt-0.5 text-[10px] text-muted-foreground">
              Savings {formatCurrency(nw.savings, currency)} · Goals {formatCurrency(nw.goalsBalance, currency)} · Inv {formatCurrency(nw.investments, currency)}
            </p>
          </div>
          <div className="rounded-lg border bg-card p-2.5">
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Liabilities</p>
            <p className="mt-1 text-sm font-semibold tabular-nums text-destructive">
              {formatCurrency(nw.liabilities, currency)}
            </p>
            <p className="mt-0.5 text-[10px] text-muted-foreground">Outstanding loans</p>
          </div>
        </div>

        <div className="rounded-lg border bg-muted/30 p-2.5">
          <div className="flex items-center justify-between text-[11px]">
            <span className="flex items-center gap-1 text-muted-foreground">
              <TrendingUp className="h-3 w-3" /> Future Fund Goal
            </span>
            <span className="font-medium tabular-nums">
              {formatCurrency(nw.futureFundGoal, currency)}
            </span>
          </div>
          <Progress value={nw.progressPct} className="mt-1.5 h-1" />
          <p className="mt-1 text-[10px] text-muted-foreground">
            {nw.progressPct.toFixed(1)}% toward Financial Future
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function FutureScoreCard({ score }: { score: ReturnType<typeof computeFutureScore> }) {
  const tone =
    score.total == null
      ? "text-muted-foreground"
      : score.total >= 80
        ? "text-success"
        : score.total >= 60
          ? "text-primary"
          : score.total >= 40
            ? "text-gold-foreground"
            : "text-destructive";
  const gradeTone =
    score.grade == null
      ? "bg-muted text-muted-foreground"
      : score.total! >= 80
        ? "bg-success/15 text-success"
        : score.total! >= 60
          ? "bg-primary/15 text-primary"
          : score.total! >= 40
            ? "bg-gold/15 text-gold-foreground"
            : "bg-destructive/15 text-destructive";

  const pillars = [
    score.components.emergency,
    score.components.savings,
    score.components.debt,
    score.components.discipline,
  ];

  return (
    <Card className="shadow-soft">
      <CardContent className="space-y-4 p-4">
        <div>
          <div className="flex items-center gap-2">
            <Rocket className="h-3.5 w-3.5 text-primary" />
            <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">Financial Future Score</p>
          </div>
          <p className="mt-0.5 text-[11px] text-muted-foreground">Based on your real financial data</p>
        </div>

        <div className="flex items-end justify-between gap-3">
          <div>
            <p className={cn("font-display text-4xl font-bold tabular-nums", tone)}>
              {score.total ?? "—"}
              <span className="ml-1 text-sm text-muted-foreground">/100</span>
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{score.headline}</p>
          </div>
          <span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold", gradeTone)}>
            Grade {score.grade ?? "—"}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {pillars.map((p) => (
            <div key={p.label} className="rounded-lg border bg-card p-2.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground">{p.label}</span>
                <span className="font-medium tabular-nums">
                  {p.value == null ? "—" : `${p.value}/${p.max}`}
                </span>
              </div>
              <Progress value={p.value == null ? 0 : (p.value / p.max) * 100} className="mt-1.5 h-1" />
              <p className="mt-1 text-[10px] leading-tight text-muted-foreground">{p.detail}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function FutureMilestonesCard({ milestones, currency }: { milestones: Milestone[]; currency: string }) {
  return (
    <Card className="shadow-soft">
      <CardContent className="space-y-3 p-4">
        <div>
          <div className="flex items-center gap-2">
            <TargetIcon className="h-3.5 w-3.5 text-primary" />
            <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">Your Financial Milestones</p>
          </div>
          <p className="mt-0.5 text-[11px] text-muted-foreground">Estimated from your salary, savings, loans & goals</p>
        </div>

        <ul className="space-y-2.5">
          {milestones.map((m) => (
            <MilestoneRow key={m.key} m={m} currency={currency} />
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function MilestoneRow({ m, currency }: { m: Milestone; currency: string }) {
  const locked = m.status === "locked";
  const achieved = m.status === "achieved";
  const etaLabel = m.eta
    ? m.eta.toLocaleDateString(undefined, { month: "short", year: "numeric" })
    : null;

  const statusChip = achieved ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-semibold text-success">
      <CheckCircle className="h-3 w-3" /> Achieved
    </span>
  ) : locked ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
      <Lock className="h-3 w-3" /> Locked
    </span>
  ) : m.status === "on-track" ? (
    <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary">On track</span>
  ) : (
    <span className="rounded-full bg-gold/15 px-2 py-0.5 text-[10px] font-semibold text-gold-foreground">Needs push</span>
  );

  return (
    <li className={cn("rounded-xl border p-3", locked ? "bg-muted/30" : "bg-card")}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold">{m.title}</p>
        {statusChip}
      </div>

      {locked ? (
        <p className="mt-1 text-[11px] text-muted-foreground">{m.lockedReason ?? m.detail}</p>
      ) : (
        <>
          <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
            <span className="tabular-nums">
              {m.current != null ? formatCurrency(Math.max(0, m.current), currency) : "—"}
              {m.target != null && m.target > 0 ? (
                <> · of {formatCurrency(m.target, currency)}</>
              ) : null}
            </span>
            <span>
              {achieved ? "Complete" : etaLabel ? `ETA ${etaLabel}` : "—"}
            </span>
          </div>
          <Progress value={m.progressPct} className="mt-1.5 h-1" />
          <p className="mt-1 text-[11px] text-muted-foreground">{m.detail}</p>
        </>
      )}
    </li>
  );
}
