// Derives AI Coach input values from the user's FinTrackr history.
// Kept UI-agnostic and Gemini-ready — swap the source of `transactions` later
// without changing consumers.

import type { Transaction, Category } from "@/hooks/use-finance";
import type { SalarySettings } from "@/hooks/use-salary-settings";
import { payDayInMonth } from "@/lib/salary-cycle";
import type { CoachAnalysisInput } from "@/lib/ai-coach-analysis";

export type AutofillKey =
  | "monthlySalary"
  | "salaryDate"
  | "currentAccountBalance"
  | "monthlyRent"
  | "monthlyFood"
  | "monthlyTransport"
  | "monthlyEmi"
  | "monthlyBills"
  | "monthlyInvestments"
  | "currentSavings"
  | "otherMonthlyExpenses";

export type CoachAutofill = {
  values: Partial<CoachAnalysisInput>;
  filled: Set<AutofillKey>;
  /** True when we have enough to skip the manual form. */
  hasEnough: boolean;
  /** Fields the user still needs to provide. */
  missing: AutofillKey[];
};

const BUCKET_KEYWORDS: Record<Exclude<AutofillKey, "monthlySalary" | "salaryDate" | "currentAccountBalance" | "currentSavings" | "otherMonthlyExpenses">, string[]> = {
  monthlyRent: ["rent", "housing", "mortgage"],
  monthlyFood: ["food", "grocery", "groceries", "restaurant", "dining", "meal"],
  monthlyTransport: ["transport", "fuel", "petrol", "uber", "ola", "cab", "commute", "travel"],
  monthlyEmi: ["emi", "loan", "credit card"],
  monthlyBills: ["bill", "utility", "utilities", "electric", "water", "internet", "phone", "mobile", "subscription"],
  monthlyInvestments: ["invest", "sip", "mutual", "stock", "equity", "fd", "rd"],
};

const REQUIRED_FOR_SKIP: AutofillKey[] = [
  "monthlySalary",
  "salaryDate",
  "currentAccountBalance",
  "monthlyRent",
  "monthlyFood",
  "monthlyTransport",
  "monthlyBills",
  "currentSavings",
];

function matchBucket(catName: string | undefined, sub: string | null): AutofillKey | null {
  const hay = `${catName ?? ""} ${sub ?? ""}`.toLowerCase();
  for (const [key, words] of Object.entries(BUCKET_KEYWORDS)) {
    if (words.some((w) => hay.includes(w))) return key as AutofillKey;
  }
  return null;
}

export function buildCoachAutofill(args: {
  transactions: Transaction[] | undefined;
  categories: Category[] | undefined;
  salary: SalarySettings;
}): CoachAutofill {
  const { transactions = [], categories = [], salary } = args;
  const catById = new Map(categories.map((c) => [c.id, c]));

  // Consider the last 90 days for monthly averages.
  const now = new Date();
  const since = new Date(now);
  since.setDate(since.getDate() - 90);
  const recent = transactions.filter((t) => new Date(t.transaction_date) >= since);

  const buckets: Record<AutofillKey, number> = {
    monthlySalary: 0,
    salaryDate: 0,
    currentAccountBalance: 0,
    monthlyRent: 0,
    monthlyFood: 0,
    monthlyTransport: 0,
    monthlyEmi: 0,
    monthlyBills: 0,
    monthlyInvestments: 0,
    currentSavings: 0,
    otherMonthlyExpenses: 0,
  };
  let otherExpense = 0;

  for (const t of recent) {
    if (t.type !== "expense") continue;
    const cat = t.category_id ? catById.get(t.category_id) : undefined;
    const bucket = matchBucket(cat?.name, t.subcategory);
    if (bucket && bucket in buckets) buckets[bucket] += t.amount;
    else otherExpense += t.amount;
  }

  // Convert 90-day totals to monthly averages.
  const toMonthly = (n: number) => Math.round(n / 3);
  const values: Partial<CoachAnalysisInput> = {};
  const filled = new Set<AutofillKey>();

  const expenseKeys: AutofillKey[] = [
    "monthlyRent",
    "monthlyFood",
    "monthlyTransport",
    "monthlyEmi",
    "monthlyBills",
    "monthlyInvestments",
  ];
  for (const k of expenseKeys) {
    if (buckets[k] > 0) {
      (values as Record<string, number>)[k] = toMonthly(buckets[k]);
      filled.add(k);
    }
  }
  if (otherExpense > 0) {
    values.otherMonthlyExpenses = toMonthly(otherExpense);
    filled.add("otherMonthlyExpenses");
  }

  // Salary + salary date from settings.
  if (salary.amount != null && salary.amount > 0) {
    values.monthlySalary = salary.amount;
    filled.add("monthlySalary");
  }
  if (salary.payDay != null) {
    const d = payDayInMonth(now.getFullYear(), now.getMonth(), salary.payDay);
    values.salaryDate = d.toISOString().slice(0, 10);
    filled.add("salaryDate");
  }

  // Approximate balances from all-time net cash flow (income - expense).
  let netAll = 0;
  for (const t of transactions) {
    if (t.type === "income") netAll += t.amount;
    else if (t.type === "expense") netAll -= t.amount;
  }
  if (netAll > 0) {
    values.currentAccountBalance = Math.round(netAll);
    filled.add("currentAccountBalance");
    // Rough split — treat 60% as savings buffer.
    values.currentSavings = Math.round(netAll * 0.6);
    filled.add("currentSavings");
  }

  const missing = REQUIRED_FOR_SKIP.filter((k) => !filled.has(k));
  const hasEnough = missing.length === 0;

  return { values, filled, hasEnough, missing };
}
