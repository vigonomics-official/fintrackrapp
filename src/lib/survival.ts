import {
  lastSalaryDate as cycleLastSalaryDate,
  nextSalaryDate as cycleNextSalaryDate,
  daysUntilSalary as cycleDaysUntilSalary,
} from "./salary-cycle";
import type { SalarySettings } from "@/hooks/use-salary-settings";
import {
  computeSafeDaily,
  emergencyFundTarget,
  getSurvivalPreferences,
  weightedScore,
} from "./survival-preferences";
import { getRememberedSavings } from "./financial-profile";

type Tx = {
  type: "income" | "expense" | string;
  amount: number | string;
  transaction_date: string;
};

type Loan = {
  remaining_balance: number | string;
  emi_amount: number | string;
};

export type Survival = {
  salary: number;
  salaryLeft: number;
  /** Days until next salary. 0 means today is salary day. */
  days: number;
  /** Same as `days`, kept for readability at call sites. */
  daysRemaining: number;
  safeDaily: number;
  spentToday: number;
  monthlyEmi: number;
  emiRatio: number;
  emiLevel: "Low" | "Medium" | "High";
  score: number;
  forecastBalance: number;
  nextSalary: Date;
  lastSalaryDate: Date;
  hasIncome: boolean;
  isSalaryToday: boolean;
  /** Whole days elapsed in the current pay cycle (min 1). */
  daysElapsed: number;
  /** Total expenses recorded in the current pay cycle. */
  totalSpent: number;
  /** Elapsed cycle days whose spend stayed at/below the even daily budget. */
  daysUnderBudget: number;
};

export function computeSurvival(opts: {
  transactions: Tx[];
  loans: Loan[];
  salarySettings: SalarySettings;
  extraSpend?: number;
  now?: Date;
}): Survival {
  const { transactions, loans, salarySettings, extraSpend = 0, now = new Date() } = opts;

  // --- 1. Determine cycle start. Prefer the most recent INCOME transaction date
  // (real salary credit). Fall back to the payDay from Salary Settings, then to
  // first-of-month. Use the more recent of (settings-derived last salary day) and
  // (latest income tx) so an early/late actual credit always wins.
  const payDay = salarySettings.payDay;
  const toKey = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const todayKey = toKey(now);

  const settingsLast =
    payDay != null
      ? cycleLastSalaryDate(payDay, now)
      : new Date(now.getFullYear(), now.getMonth(), 1);
  const next =
    payDay != null
      ? cycleNextSalaryDate(payDay, now)
      : new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const incomeKeys = transactions
    .filter((t) => t.type === "income")
    .map((t) => String(t.transaction_date).slice(0, 10))
    .filter((k) => k <= todayKey)
    .sort();
  const latestIncomeKey = incomeKeys.length ? incomeKeys[incomeKeys.length - 1] : null;

  const settingsLastKey = toKey(settingsLast);
  const cycleStartKey =
    latestIncomeKey && latestIncomeKey > settingsLastKey ? latestIncomeKey : settingsLastKey;
  const [csY, csM, csD] = cycleStartKey.split("-").map(Number);
  const last = new Date(csY, csM - 1, csD);

  const daysRemaining =
    payDay != null
      ? cycleDaysUntilSalary(payDay, now)
      : Math.max(0, Math.ceil((next.getTime() - now.getTime()) / 86_400_000));

  // --- 2. Restrict ALL planner math to the current pay cycle (cycle start → today).
  const inCurrentCycle = (t: Tx) => {
    const k = String(t.transaction_date).slice(0, 10);
    return k >= cycleStartKey && k <= todayKey;
  };
  const cycleTxs = transactions.filter(inCurrentCycle);

  const cycleIncome = cycleTxs
    .filter((t) => t.type === "income")
    .reduce((s, t) => s + Number(t.amount), 0);
  const salary =
    salarySettings.amount != null && salarySettings.amount > 0
      ? salarySettings.amount
      : cycleIncome;

  // --- 3. Spending this cycle / today (current cycle only — historical txs excluded)
  const expensesSinceSalary =
    cycleTxs
      .filter((t) => t.type === "expense")
      .reduce((s, t) => s + Number(t.amount), 0) + extraSpend;
  const salaryLeft = Math.max(0, salary - expensesSinceSalary);

  const prefs = getSurvivalPreferences();
  const safeDaily = computeSafeDaily(salaryLeft, daysRemaining, now, prefs);

  const spentToday =
    cycleTxs
      .filter((t) => t.type === "expense" && String(t.transaction_date).slice(0, 10) === todayKey)
      .reduce((s, t) => s + Number(t.amount), 0) + extraSpend;

  // --- 4. EMI pressure
  const monthlyEmi = loans.reduce(
    (s, l) => s + (Number(l.remaining_balance) > 0 ? Number(l.emi_amount) : 0),
    0
  );
  const emiRatio = salary > 0 ? (monthlyEmi / salary) * 100 : 0;
  const emiLevel: "Low" | "Medium" | "High" =
    emiRatio < 20 ? "Low" : emiRatio < 40 ? "Medium" : "High";

  // --- 5. Survival score (weighted by the user's Survival Preferences)
  const savingsHealth = salary > 0 ? salaryLeft / salary : 0.5;
  const debtHealth = 1 - Math.min(1, emiRatio / 60);
  const disciplineHealth =
    spentToday <= safeDaily
      ? 1
      : Math.max(0, 1 - (spentToday - safeDaily) / Math.max(1, safeDaily));
  const savedSoFar = getRememberedSavings();
  const efTarget = emergencyFundTarget(salary, prefs);
  const emergencyHealth =
    savedSoFar != null && efTarget > 0 ? savedSoFar / efTarget : undefined;

  const score = weightedScore(
    {
      emergency: emergencyHealth,
      savings: savingsHealth,
      debt: debtHealth,
      discipline: disciplineHealth,
    },
    prefs,
  );


  // --- 5b. Days under budget (real per-day spend vs even daily budget)
  const cycleDaysTotal = Math.max(1, daysElapsedForBudget(last, now) + Math.max(0, daysRemaining));
  const baselineDaily = salary > 0 ? salary / cycleDaysTotal : 0;
  const perDay = new Map<string, number>();
  for (const t of cycleTxs) {
    if (t.type !== "expense") continue;
    const k = String(t.transaction_date).slice(0, 10);
    perDay.set(k, (perDay.get(k) ?? 0) + Number(t.amount));
  }
  const elapsedDayCount = daysElapsedForBudget(last, now);
  let daysUnderBudget = 0;
  for (let i = 0; i < elapsedDayCount; i++) {
    const d = new Date(last.getFullYear(), last.getMonth(), last.getDate() + i);
    const spend = perDay.get(toKey(d)) ?? 0;
    if (baselineDaily > 0 && spend <= baselineDaily) daysUnderBudget += 1;
  }

  // --- 6. Forecast: avgDaily × daysRemaining is projected remaining spend.
  // daysElapsed counts whole days since cycle start, minimum 1.
  const msPerDay = 86_400_000;
  const daysElapsed = Math.max(
    1,
    Math.floor((now.getTime() - last.getTime()) / msPerDay) || 1,
  );
  const avgDaily = expensesSinceSalary / daysElapsed;
  const projectedRemaining = avgDaily * Math.max(0, daysRemaining);
  const forecastBalance = Math.round(salary - expensesSinceSalary - projectedRemaining);


  return {
    salary,
    salaryLeft,
    days: daysRemaining,
    daysRemaining,
    safeDaily,
    spentToday,
    monthlyEmi,
    emiRatio,
    emiLevel,
    score,
    forecastBalance,
    nextSalary: next,
    lastSalaryDate: last,
    hasIncome: salary > 0,
    isSalaryToday: daysRemaining === 0,
    daysElapsed,
    totalSpent: expensesSinceSalary,
    daysUnderBudget,
  };
}

/** Whole days elapsed in the cycle, counting today, minimum 1. */
function daysElapsedForBudget(cycleStart: Date, now: Date): number {
  const ms = 86_400_000;
  const a = new Date(cycleStart.getFullYear(), cycleStart.getMonth(), cycleStart.getDate()).getTime();
  const b = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.max(1, Math.floor((b - a) / ms) + 1);
}
