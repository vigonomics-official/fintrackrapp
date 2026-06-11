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

  // --- 1. Pay-cycle window driven by Salary Settings (single source of truth)
  const payDay = salarySettings.payDay;
  const last =
    payDay != null
      ? cycleLastSalaryDate(payDay, now)
      : new Date(now.getFullYear(), now.getMonth(), 1);
  const next =
    payDay != null
      ? cycleNextSalaryDate(payDay, now)
      : new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const daysRemaining =
    payDay != null
      ? cycleDaysUntilSalary(payDay, now)
      : Math.max(0, Math.ceil((next.getTime() - now.getTime()) / 86_400_000));

  // --- 2. Restrict ALL planner math to the current pay cycle (last salary → today).
  // String-based YYYY-MM-DD comparison avoids timezone drift from `new Date("YYYY-MM-DD")`
  // parsing as UTC midnight (which in IST is the previous day) and guarantees historical
  // imports from earlier months never bleed into current-cycle calculations.
  const toKey = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const lastKey = toKey(last);
  const todayKey = toKey(now);
  const inCurrentCycle = (t: Tx) => {
    const k = String(t.transaction_date).slice(0, 10);
    return k >= lastKey && k <= todayKey;
  };
  const cycleTxs = transactions.filter(inCurrentCycle);

  // Salary amount: prefer configured settings; fall back to income in this cycle only.
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

  // safe-daily: divide by remaining days; on the salary day itself, the
  // remaining balance is what's safe to spend today.
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

  // --- 6. Forecast
  const cycleLengthDays = Math.max(1, Math.round((next.getTime() - last.getTime()) / 86_400_000));
  const daysElapsed = Math.max(1, cycleLengthDays - daysRemaining);
  const avgDaily = expensesSinceSalary / daysElapsed;
  const forecastBalance = Math.round(salaryLeft - avgDaily * Math.max(1, daysRemaining));

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
