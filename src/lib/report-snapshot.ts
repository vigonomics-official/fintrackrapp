/**
 * AI Financial Report — deterministic snapshot layer.
 *
 * This module is the ONLY source of financial truth for the report engine.
 * It reuses FinTrackr's existing calculations (computeSurvival, salary-cycle,
 * survival-preferences) and never invents a value: any field that cannot be
 * derived from real data stays `undefined`.
 */

import type { Transaction, Category, Budget, Loan } from "@/hooks/use-finance";
import type { SalarySettings } from "@/hooks/use-salary-settings";
import { computeSurvival } from "@/lib/survival";
import { emergencyFundTarget, getSurvivalPreferences } from "@/lib/survival-preferences";
import { getRememberedSavings } from "@/lib/financial-profile";

export type ReportPeriodType = "weekly" | "monthly";

export type ReportPeriod = {
  type: ReportPeriodType;
  /** inclusive yyyy-mm-dd */
  startKey: string;
  /** inclusive yyyy-mm-dd */
  endKey: string;
  /** number of calendar days covered (>=1) */
  days: number;
  label: string;
};

export type ReportCategory = {
  id: string;
  name: string;
  spent: number;
  /** % of total spend in the period — only when totalSpent > 0 */
  share?: number;
  budget?: number;
  budgetRemaining?: number;
  /** % of the category budget used — only when a budget exists */
  utilization?: number;
};

export type ReportGoal = {
  name: string;
  target: number;
  current: number;
  /** 0-100 */
  progress: number;
};

export type SpendingTrend = {
  direction: "up" | "down" | "flat";
  pct: number;
  previousSpent: number;
};

export type ReportSnapshot = {
  currency: string;
  generatedAt: string;
  period: ReportPeriod;

  salary?: number;
  salaryLeft?: number;
  totalSpent: number;
  totalIncome: number;
  totalSavings?: number;
  savingsRate?: number;
  safeDaily?: number;
  daysRemaining?: number;
  score?: number;
  forecastBalance?: number;

  monthlyEmi?: number;
  loanBalance?: number;

  budgetTotal?: number;
  budgetSpent?: number;
  budgetRemaining?: number;

  categories: ReportCategory[];

  emergencyFund?: number;
  emergencyFundTarget?: number;

  goals: ReportGoal[];

  transactionCount: number;
  expenseCount: number;
  spendingTrend?: SpendingTrend;
};

export type ReportSnapshotInput = {
  transactions: Transaction[];
  categories: Category[];
  budgets: Budget[];
  loans: Loan[];
  salarySettings: SalarySettings;
  goals?: ReportGoal[];
  /** localStorage-backed savings; pass explicitly for tests */
  savedSoFar?: number | null;
  currency?: string;
  period: ReportPeriodType;
  now?: Date;
};

const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const addDays = (d: Date, n: number) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

const daysBetween = (a: string, b: string) =>
  Math.max(1, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000) + 1);

const inRange = (t: Transaction, startKey: string, endKey: string) => {
  const k = String(t.transaction_date).slice(0, 10);
  return k >= startKey && k <= endKey;
};

const sum = (txs: Transaction[], type: Transaction["type"]) =>
  txs.filter((t) => t.type === type).reduce((s, t) => s + Number(t.amount), 0);

const round = (n: number) => Math.round(n * 100) / 100;

/** Goals persisted by the Goals page (localStorage). Never throws. */
export function readStoredGoals(): ReportGoal[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem("fintrackr_goals_v1");
    const parsed = raw ? (JSON.parse(raw) as { name?: string; target?: number; current?: number }[]) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((g) => g && typeof g.name === "string" && Number(g.target) > 0)
      .map((g) => {
        const target = Number(g.target);
        const current = Math.max(0, Number(g.current ?? 0));
        return { name: g.name!, target, current, progress: Math.min(100, (current / target) * 100) };
      });
  } catch {
    return [];
  }
}

/**
 * Builds the verified report snapshot. Uses the existing salary-cycle engine
 * for the monthly period; the weekly period is the last 7 days (clamped to the
 * current cycle start) so both views stay inside one salary cycle.
 */
export function buildReportSnapshot(input: ReportSnapshotInput): ReportSnapshot {
  const now = input.now ?? new Date();
  const currency = input.currency ?? "INR";
  const survival = computeSurvival({
    transactions: input.transactions,
    loans: input.loans,
    salarySettings: input.salarySettings,
    now,
  });

  const cycleStartKey = dayKey(survival.lastSalaryDate);
  const todayKey = dayKey(now);

  let startKey = cycleStartKey;
  if (input.period === "weekly") {
    const weekStart = dayKey(addDays(now, -6));
    startKey = weekStart > cycleStartKey ? weekStart : cycleStartKey;
  }
  const endKey = todayKey;
  const days = daysBetween(startKey, endKey);
  const period: ReportPeriod = {
    type: input.period,
    startKey,
    endKey,
    days,
    label:
      input.period === "weekly"
        ? `Last ${days} day${days === 1 ? "" : "s"}`
        : "Current salary cycle",
  };

  const periodTxs = input.transactions.filter((t) => inRange(t, startKey, endKey));
  const totalSpent = round(sum(periodTxs, "expense"));
  const totalIncome = round(sum(periodTxs, "income"));
  const expenseCount = periodTxs.filter((t) => t.type === "expense").length;

  const hasSalary = survival.salary > 0;
  const salary = hasSalary ? round(survival.salary) : undefined;

  // Savings & savings rate only exist when a salary is known AND the period
  // covers the whole cycle (a 7-day slice cannot be compared to a full salary).
  let totalSavings: number | undefined;
  let savingsRate: number | undefined;
  if (hasSalary && input.period === "monthly") {
    totalSavings = round(survival.salary - totalSpent);
    savingsRate = round(((survival.salary - totalSpent) / survival.salary) * 100);
  }

  // Previous comparable window (same length, immediately before).
  const prevEnd = dayKey(addDays(new Date(startKey), -1));
  const prevStart = dayKey(addDays(new Date(startKey), -days));
  const prevTxs = input.transactions.filter((t) => inRange(t, prevStart, prevEnd));
  const previousSpent = round(sum(prevTxs, "expense"));
  let spendingTrend: SpendingTrend | undefined;
  if (previousSpent > 0 && expenseCount > 0) {
    const pct = round(((totalSpent - previousSpent) / previousSpent) * 100);
    spendingTrend = {
      direction: Math.abs(pct) < 5 ? "flat" : pct > 0 ? "up" : "down",
      pct,
      previousSpent,
    };
  }

  // Category spend within the period.
  const spendByCat = new Map<string, number>();
  periodTxs
    .filter((t) => t.type === "expense")
    .forEach((t) => {
      const k = t.category_id ?? "uncategorized";
      spendByCat.set(k, (spendByCat.get(k) ?? 0) + Number(t.amount));
    });

  const categories: ReportCategory[] = [...spendByCat.entries()]
    .map(([id, spentRaw]) => {
      const spent = round(spentRaw);
      const cat = input.categories.find((c) => c.id === id);
      const budgetRow = input.budgets.find((b) => b.category_id === id);
      const budget = budgetRow && Number(budgetRow.monthly_limit) > 0
        ? round(Number(budgetRow.monthly_limit))
        : undefined;
      const row: ReportCategory = { id, name: cat?.name ?? "Uncategorized", spent };
      if (totalSpent > 0) row.share = round((spent / totalSpent) * 100);
      if (budget != null) {
        row.budget = budget;
        row.budgetRemaining = round(budget - spent);
        row.utilization = round((spent / budget) * 100);
      }
      return row;
    })
    .sort((a, b) => b.spent - a.spent);

  const budgetRows = input.budgets.filter((b) => Number(b.monthly_limit) > 0);
  const budgetTotal = budgetRows.length
    ? round(budgetRows.reduce((s, b) => s + Number(b.monthly_limit), 0))
    : undefined;
  // Only spending inside budgeted categories counts against the budget totals —
  // unbudgeted categories must not inflate utilization.
  const budgetSpent = budgetTotal != null
    ? round(budgetRows.reduce((s, b) => s + (spendByCat.get(b.category_id) ?? 0), 0))
    : undefined;
  const budgetRemaining =
    budgetTotal != null && budgetSpent != null ? round(budgetTotal - budgetSpent) : undefined;

  const activeLoans = input.loans.filter((l) => Number(l.remaining_balance) > 0);
  const monthlyEmi = activeLoans.length ? round(survival.monthlyEmi) : undefined;
  const loanBalance = activeLoans.length
    ? round(activeLoans.reduce((s, l) => s + Number(l.remaining_balance), 0))
    : undefined;

  const savedSoFar = input.savedSoFar !== undefined ? input.savedSoFar : getRememberedSavings();
  const efTarget = hasSalary
    ? round(emergencyFundTarget(survival.salary, getSurvivalPreferences()))
    : undefined;

  return {
    currency,
    generatedAt: now.toISOString(),
    period,
    salary,
    salaryLeft: hasSalary ? round(survival.salaryLeft) : undefined,
    totalSpent,
    totalIncome,
    totalSavings,
    savingsRate,
    safeDaily: hasSalary ? round(survival.safeDaily) : undefined,
    daysRemaining: survival.daysRemaining,
    score: hasSalary ? survival.score : undefined,
    forecastBalance: hasSalary ? round(survival.forecastBalance) : undefined,
    monthlyEmi,
    loanBalance,
    budgetTotal,
    budgetSpent,
    budgetRemaining,
    categories,
    emergencyFund: savedSoFar != null ? round(savedSoFar) : undefined,
    emergencyFundTarget: efTarget && efTarget > 0 ? efTarget : undefined,
    goals: input.goals ?? [],
    transactionCount: periodTxs.length,
    expenseCount,
    spendingTrend,
  };
}
