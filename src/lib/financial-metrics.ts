// Single source of truth for FinSurvive's cross-screen financial metrics:
// Emergency Fund, Savings Rate, Net Worth, planned savings target and the one
// user-facing Financial Score. Pure: callers pass already-loaded data.
// Consumed through useSafeDailySurvival() so every screen shows the same values.

import type { Survival } from "@/lib/survival";
import type { Obligations } from "@/lib/safe-daily";
import type { SurvivalPreferences } from "@/lib/survival-preferences";

type Tx = { type: string; amount: number | string; transaction_date: string; category_id?: string | null };
type LoanLike = { remaining_balance: number | string };
type GoalLike = { kind: string; current: number | string };

export type ScoreComponent = { value: number | null; max: 25; label: string; detail: string };

export type FinancialMetrics = {
  /** Trailing average monthly spending, excluding money moved to savings. */
  avgMonthlyExpenses: number | null;
  emergency: {
    saved: number;
    target: number;
    targetMonths: number;
    /** Months of expenses covered by money actually in Emergency Fund goals. */
    monthsCovered: number | null;
    /** monthsCovered capped at targetMonths, for display. */
    monthsDisplay: number | null;
    pct: number;
    achieved: boolean;
    status: "Achieved" | "In Progress" | "Not Started" | "Set a target";
    basis: "expenses" | "salary" | "custom" | "none";
  };
  savings: {
    /** Recorded savings transactions this salary cycle (counted once). */
    actual: number;
    income: number;
    /** actual / income × 100, rounded; null without income. */
    rate: number | null;
    /** Planner → Allocate savings amount for this salary (planned, not saved). */
    target: number;
    targetPct: number | null;
  };
  netWorth: {
    /** Cash/savings not earmarked to a goal. */
    savings: number;
    /** Funded (non-investment) goal balances. */
    goalsBalance: number;
    investments: number;
    assets: number;
    liabilities: number;
    netWorth: number;
    hasSignal: boolean;
  };
  score: {
    total: number | null;
    components: { emergency: ScoreComponent; savings: ScoreComponent; debt: ScoreComponent; discipline: ScoreComponent };
  };
};

const clamp01 = (n: number) => (Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0);

/** Average monthly expenses over the trailing 90 days. Null if <30 days of data. */
export function averageMonthlyExpenses(transactions: Tx[], excludeCategoryIds: string[] = [], now = new Date()): number | null {
  const skip = new Set(excludeCategoryIds);
  const cutoff = now.getTime() - 90 * 86_400_000;
  const recent = transactions.filter(
    (t) =>
      t.type === "expense" &&
      !(t.category_id && skip.has(t.category_id)) &&
      new Date(t.transaction_date).getTime() >= cutoff &&
      new Date(t.transaction_date).getTime() <= now.getTime(),
  );
  if (recent.length === 0) return null;
  const total = recent.reduce((s, t) => s + Number(t.amount), 0);
  const firstTs = Math.min(...recent.map((t) => new Date(t.transaction_date).getTime()));
  const spanDays = Math.max(1, Math.round((now.getTime() - firstTs) / 86_400_000));
  if (spanDays < 30) return null;
  return (total / spanDays) * 30;
}

export function computeFinancialMetrics(opts: {
  survival: Survival;
  obligations: Obligations;
  transactions: Tx[];
  loans: LoanLike[];
  goals: GoalLike[];
  savingsCategoryIds: string[];
  savingsPct: number | null;
  rememberedSavings: number | null;
  prefs: SurvivalPreferences;
  now?: Date;
}): FinancialMetrics {
  const { survival: s, obligations, transactions, loans, goals, savingsCategoryIds, savingsPct, rememberedSavings, prefs } = opts;

  // ---- Emergency Fund: only money in Emergency Fund goals counts.
  const avgExp = averageMonthlyExpenses(transactions, savingsCategoryIds, opts.now);
  const efSaved = goals.filter((g) => g.kind === "emergency").reduce((a, g) => a + Math.max(0, Number(g.current) || 0), 0);
  const monthlyBase = avgExp != null && avgExp > 0 ? avgExp : s.salary > 0 ? s.salary : 0;
  let basis: FinancialMetrics["emergency"]["basis"] = avgExp != null && avgExp > 0 ? "expenses" : s.salary > 0 ? "salary" : "none";
  let targetMonths = prefs.emergencyFundMode === "3m" ? 3 : 6;
  let efTarget = Math.round(monthlyBase * targetMonths);
  if (prefs.emergencyFundMode === "custom" && (prefs.emergencyFundCustom ?? 0) > 0) {
    efTarget = Math.round(prefs.emergencyFundCustom!);
    basis = "custom";
    targetMonths = monthlyBase > 0 ? efTarget / monthlyBase : 6;
  }
  const monthsCovered = monthlyBase > 0 ? efSaved / monthlyBase : null;
  const efAchieved = efTarget > 0 && efSaved >= efTarget;
  const efPct = efTarget > 0 ? Math.min(100, Math.round((efSaved / efTarget) * 100)) : 0;
  const emergency: FinancialMetrics["emergency"] = {
    saved: efSaved,
    target: efTarget,
    targetMonths,
    monthsCovered,
    monthsDisplay: monthsCovered == null ? null : Math.min(targetMonths, monthsCovered),
    pct: efPct,
    achieved: efAchieved,
    status: efTarget <= 0 ? "Set a target" : efAchieved ? "Achieved" : efSaved > 0 ? "In Progress" : "Not Started",
    basis,
  };

  // ---- Savings Rate: recorded savings this cycle ÷ income this cycle.
  const income = s.salary > 0 ? s.salary : 0;
  const actual = Math.max(0, obligations.alreadySaved);
  const savings: FinancialMetrics["savings"] = {
    actual,
    income,
    rate: income > 0 ? Math.round((actual / income) * 100) : null,
    target: obligations.plannedSavings,
    targetPct: savingsPct,
  };

  // ---- Net Worth. Goal balances (except investments) are treated as earmarked
  // parts of cash savings, so they are never added on top of the same money.
  const investments = goals.filter((g) => g.kind === "investment").reduce((a, g) => a + Math.max(0, Number(g.current) || 0), 0);
  const goalsBalance = goals.filter((g) => g.kind !== "investment").reduce((a, g) => a + Math.max(0, Number(g.current) || 0), 0);
  const cash = Math.max(0, rememberedSavings ?? 0);
  const unearmarked = Math.max(0, cash - goalsBalance);
  const assets = unearmarked + goalsBalance + investments;
  const liabilities = loans.reduce((a, l) => a + Math.max(0, Number(l.remaining_balance) || 0), 0);
  const netWorth: FinancialMetrics["netWorth"] = {
    savings: unearmarked,
    goalsBalance,
    investments,
    assets,
    liabilities,
    netWorth: assets - liabilities,
    hasSignal: assets > 0 || liabilities > 0 || rememberedSavings != null,
  };

  // ---- Financial Score: 4 × 25 points.
  const comp = (label: string, ratio: number | null, detail: string): ScoreComponent => ({
    value: ratio == null ? null : Math.round(clamp01(ratio) * 25),
    max: 25,
    label,
    detail,
  });
  const emergencyC = comp(
    "Emergency Fund",
    efTarget > 0 ? efSaved / efTarget : null,
    efTarget > 0 ? `${(emergency.monthsDisplay ?? 0).toFixed(1)} of ${Number(targetMonths.toFixed(1))} months covered` : "Add salary to unlock",
  );
  const savingsBenchmark = obligations.plannedSavings > 0 ? obligations.plannedSavings : income * 0.2;
  const savingsC = comp(
    "Savings",
    income > 0 && savingsBenchmark > 0 ? actual / savingsBenchmark : null,
    income > 0 ? `${savings.rate}% of income saved this cycle` : "Add salary to unlock",
  );
  const hasLoans = liabilities > 0;
  const debtC = comp(
    "Debt",
    income > 0 ? 1 - s.emiRatio / 40 : hasLoans ? 0 : 1,
    hasLoans ? (income > 0 ? `EMI ${s.emiRatio.toFixed(0)}% of salary` : "Loans with no salary recorded") : "No active loans",
  );
  const elapsed = Math.max(1, s.cycleDaysElapsed);
  const disciplineC = comp(
    "Spending Discipline",
    income > 0 ? (s.overLimit ? 0 : s.daysUnderBudget / elapsed) : null,
    income > 0
      ? s.overLimit
        ? "Spending is over this cycle's limit"
        : `${s.daysUnderBudget} of ${elapsed} days within daily budget`
      : "Add salary to unlock",
  );

  const w = prefs.scoreWeights;
  const enabled = [
    w.emergency ? emergencyC : null,
    w.savings ? savingsC : null,
    w.debt ? debtC : null,
    w.discipline ? disciplineC : null,
  ].filter((c): c is ScoreComponent => !!c && c.value != null);
  const total = enabled.length
    ? Math.round((enabled.reduce((a, c) => a + (c.value as number), 0) / (enabled.length * 25)) * 100)
    : null;

  return {
    avgMonthlyExpenses: avgExp,
    emergency,
    savings,
    netWorth,
    score: { total, components: { emergency: emergencyC, savings: savingsC, debt: debtC, discipline: disciplineC } },
  };
}

/* ---- Latest shared metrics, for non-React engines (AI Coach analysis). ---- */
let latest: { score: number | null; savingsRate: number | null; savingsTarget: number } | null = null;
export function publishSharedMetrics(v: typeof latest) {
  latest = v;
}
export function getSharedMetrics() {
  return latest;
}
