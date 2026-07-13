// Derives AI Coach input values from the user's FinTrackr history.
// Uses ONLY the current calendar month, grouped by category totals.
// Kept UI-agnostic and Gemini-ready — swap the source of `transactions` later
// without changing consumers.

import type { Transaction, Category } from "@/hooks/use-finance";
import type { SalarySettings } from "@/hooks/use-salary-settings";
import { payDayInMonth } from "@/lib/salary-cycle";
import type { CoachAnalysisInput } from "@/lib/ai-coach-analysis";
import {
  getFinancialProfile,
  getRememberedBalance,
  getRememberedSavings,
  type FinancialProfile,
} from "@/lib/financial-profile";

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

/** Where a value ultimately came from. Kept as a small union so future
 *  providers (SMS parser, CSV importer, planner) can slot in without UI
 *  changes. */
export type CoachDataSource = "auto" | "profile" | "sms" | "manual" | "planner" | "csv";

export type CoachAutofill = {
  values: Partial<CoachAnalysisInput>;
  filled: Set<AutofillKey>;
  /** Source per autofilled field. */
  sources: Partial<Record<AutofillKey, CoachDataSource>>;
  /** True when we have enough to skip the manual form. */
  hasEnough: boolean;
  /** Fields the user still needs to provide. */
  missing: AutofillKey[];
  /** Number of transactions considered this month (post-dedupe). */
  transactionCount: number;
  /** When these values were computed. */
  computedAt: string; // ISO
};

// Category-name matchers. Case-insensitive; matches whole-word tokens so
// "Rent" doesn't collide with "Rental Income".
const CATEGORY_BUCKETS: Record<
  Exclude<
    AutofillKey,
    | "monthlySalary"
    | "salaryDate"
    | "currentAccountBalance"
    | "otherMonthlyExpenses"
  >,
  string[]
> = {
  monthlyRent: ["rent"],
  monthlyFood: ["food", "groceries", "grocery", "dining", "restaurant"],
  monthlyTransport: ["transport", "transportation", "fuel", "commute", "travel"],
  monthlyEmi: ["emi", "loan"],
  monthlyBills: ["bills", "bill", "utilities", "utility"],
  monthlyInvestments: ["investment", "investments", "invest", "sip"],
  currentSavings: ["savings", "saving"],
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

function bucketForCategory(catName: string | undefined): AutofillKey | null {
  if (!catName) return null;
  const name = catName.trim().toLowerCase();
  for (const [key, words] of Object.entries(CATEGORY_BUCKETS)) {
    if (words.some((w) => name === w || name.includes(w))) return key as AutofillKey;
  }
  return null;
}

/** True when the transaction date falls in the given calendar month. */
function isInMonth(dateStr: string, year: number, month: number): boolean {
  const d = new Date(dateStr);
  return d.getFullYear() === year && d.getMonth() === month;
}

/** Drop obvious duplicates (same date + amount + category + type + notes). */
function dedupe(transactions: Transaction[]): Transaction[] {
  const seen = new Set<string>();
  const out: Transaction[] = [];
  for (const t of transactions) {
    const key = [
      t.transaction_date,
      t.type,
      t.amount,
      t.category_id ?? "",
      t.subcategory ?? "",
      (t.notes ?? "").trim(),
    ].join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}

export function buildCoachAutofill(args: {
  transactions: Transaction[] | undefined;
  categories: Category[] | undefined;
  salary: SalarySettings;
}): CoachAutofill {
  const { transactions = [], categories = [], salary } = args;
  const catById = new Map(categories.map((c) => [c.id, c]));

  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();

  // Current-month, deduped transactions only.
  const monthTx = dedupe(transactions.filter((t) => isInMonth(t.transaction_date, y, m)));

  const values: Partial<CoachAnalysisInput> = {};
  const filled = new Set<AutofillKey>();

  // Salary = sum of all income transactions this month.
  let salaryTotal = 0;
  const bucketTotals: Record<string, number> = {};
  let otherExpense = 0;

  for (const t of monthTx) {
    if (t.type === "income") {
      salaryTotal += t.amount;
      continue;
    }
    if (t.type !== "expense") continue;
    const cat = t.category_id ? catById.get(t.category_id) : undefined;
    const bucket = bucketForCategory(cat?.name);
    if (bucket) {
      bucketTotals[bucket] = (bucketTotals[bucket] ?? 0) + t.amount;
    } else {
      otherExpense += t.amount;
    }
  }

  // Prefer the user's saved salary amount from Profile; fall back to income total.
  if (salary.amount != null && salary.amount > 0) {
    values.monthlySalary = salary.amount;
    filled.add("monthlySalary");
  } else if (salaryTotal > 0) {
    values.monthlySalary = Math.round(salaryTotal);
    filled.add("monthlySalary");
  } else {
    values.monthlySalary = 0;
  }

  // Salary date from Profile only. Leave blank if unavailable.
  if (salary.payDay != null) {
    const d = payDayInMonth(y, m, salary.payDay);
    values.salaryDate = d.toISOString().slice(0, 10);
    filled.add("salaryDate");
  }

  // Category totals (always report, defaulting to 0 when the category is absent).
  const expenseKeys: AutofillKey[] = [
    "monthlyRent",
    "monthlyFood",
    "monthlyTransport",
    "monthlyEmi",
    "monthlyBills",
    "monthlyInvestments",
    "currentSavings",
  ];
  for (const k of expenseKeys) {
    const total = Math.round(bucketTotals[k] ?? 0);
    (values as Record<string, number>)[k] = total;
    filled.add(k);
  }
  values.otherMonthlyExpenses = Math.round(otherExpense);
  filled.add("otherMonthlyExpenses");

  // Current Account Balance = FinTrackr net balance (all-time income − expense).
  let netAll = 0;
  for (const t of dedupe(transactions)) {
    if (t.type === "income") netAll += t.amount;
    else if (t.type === "expense") netAll -= t.amount;
  }
  values.currentAccountBalance = Math.max(0, Math.round(netAll));
  filled.add("currentAccountBalance");

  const missing = REQUIRED_FOR_SKIP.filter((k) => {
    const v = (values as Record<string, unknown>)[k];
    if (k === "salaryDate") return !v;
    // Salary + balance still require a positive value to consider "enough".
    if (k === "monthlySalary" || k === "currentAccountBalance") {
      return typeof v !== "number" || v <= 0;
    }
    // Other categories: ₹0 is a KNOWN value, so it counts as filled.
    return typeof v !== "number" || v < 0;
  });
  const hasEnough = missing.length === 0;

  // Every field that we populated came from the transaction/profile pipeline.
  const sources: Partial<Record<AutofillKey, CoachDataSource>> = {};
  for (const k of filled) sources[k] = "auto";

  return {
    values,
    filled,
    sources,
    hasEnough,
    missing,
    transactionCount: monthTx.length,
    computedAt: now.toISOString(),
  };
}
