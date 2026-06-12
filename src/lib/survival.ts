import {
  lastSalaryDate as cycleLastSalaryDate,
  nextSalaryDate as cycleNextSalaryDate,
  daysUntilSalary as cycleDaysUntilSalary,
} from "./salary-cycle";
import type { SalarySettings } from "@/hooks/use-salary-settings";

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

  const safeDaily = daysRemaining <= 0 ? salaryLeft : salaryLeft / Math.max(1, daysRemaining);

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

  // --- 5. Survival score
  const buffer = salary > 0 ? Math.min(50, (salaryLeft / salary) * 50) : 25;
  const emiScore = Math.max(0, 30 - emiRatio * 0.5);
  const pace =
    spentToday <= safeDaily
      ? 20
      : Math.max(0, 20 - ((spentToday - safeDaily) / Math.max(1, safeDaily)) * 20);
  const score = Math.round(buffer + emiScore + pace);

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

  if (typeof console !== "undefined") {
    // Temporary debug — verify cycle math
    // eslint-disable-next-line no-console
    console.log("[Planner] cycle debug", {
      cycleStart: cycleStartKey,
      today: todayKey,
      daysElapsed,
      daysRemaining,
      cycleExpenses: expensesSinceSalary,
      avgDaily: Math.round(avgDaily),
      projectedRemaining: Math.round(projectedRemaining),
      salary,
      forecastBalance,
    });
  }

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
  };
}
