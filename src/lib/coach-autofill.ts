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
  /** Overrides the Financial Profile lookup (used only for testing). */
  profile?: FinancialProfile;
  /**
   * Minimum number of expense transactions in a bucket before we trust the
   * derived monthly total. Below this the bucket is reported as unknown and
   * the user is asked for just that field.
   */
  minBucketTx?: number;
}): CoachAutofill {
  const { transactions = [], categories = [], salary, minBucketTx = 2 } = args;
  const profile = args.profile ?? getFinancialProfile();
  const catById = new Map(categories.map((c) => [c.id, c]));

  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();

  // Current-month, deduped transactions only.
  const monthTx = dedupe(transactions.filter((t) => isInMonth(t.transaction_date, y, m)));

  const values: Partial<CoachAnalysisInput> = {};
  const filled = new Set<AutofillKey>();
  const sources: Partial<Record<AutofillKey, CoachDataSource>> = {};

  // Track how many expense txs contributed to each bucket, to decide whether
  // we have "enough" history to trust the derived total.
  let salaryTotal = 0;
  const bucketTotals: Record<string, number> = {};
  const bucketCount: Record<string, number> = {};
  let otherExpense = 0;
  let otherCount = 0;

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
      bucketCount[bucket] = (bucketCount[bucket] ?? 0) + 1;
    } else {
      otherExpense += t.amount;
      otherCount += 1;
    }
  }

  // ── Salary: Profile → salary settings → income total.
  if (profile.monthlySalary != null && profile.monthlySalary > 0) {
    values.monthlySalary = profile.monthlySalary;
    filled.add("monthlySalary");
    sources.monthlySalary = "profile";
  } else if (salary.amount != null && salary.amount > 0) {
    values.monthlySalary = salary.amount;
    filled.add("monthlySalary");
    sources.monthlySalary = "profile";
  } else if (salaryTotal > 0) {
    values.monthlySalary = Math.round(salaryTotal);
    filled.add("monthlySalary");
    sources.monthlySalary = "auto";
  } else {
    values.monthlySalary = 0;
  }

  // ── Salary date: Profile → salary settings.
  if (profile.salaryDate) {
    values.salaryDate = profile.salaryDate;
    filled.add("salaryDate");
    sources.salaryDate = "profile";
  } else if (salary.payDay != null) {
    const d = payDayInMonth(y, m, salary.payDay);
    values.salaryDate = d.toISOString().slice(0, 10);
    filled.add("salaryDate");
    sources.salaryDate = "profile";
  }

  // ── Rent + EMI: Profile takes priority (permanent monthly commitments).
  if (profile.monthlyRent != null) {
    values.monthlyRent = profile.monthlyRent;
    filled.add("monthlyRent");
    sources.monthlyRent = "profile";
  } else if ((bucketCount["monthlyRent"] ?? 0) >= 1) {
    values.monthlyRent = Math.round(bucketTotals["monthlyRent"] ?? 0);
    filled.add("monthlyRent");
    sources.monthlyRent = "auto";
  }
  if (profile.monthlyEmi != null) {
    values.monthlyEmi = profile.monthlyEmi;
    filled.add("monthlyEmi");
    sources.monthlyEmi = "profile";
  } else if ((bucketCount["monthlyEmi"] ?? 0) >= 1) {
    values.monthlyEmi = Math.round(bucketTotals["monthlyEmi"] ?? 0);
    filled.add("monthlyEmi");
    sources.monthlyEmi = "auto";
  } else {
    values.monthlyEmi = 0;
    filled.add("monthlyEmi");
    sources.monthlyEmi = "auto";
  }

  // ── Variable categories: require enough transaction history to trust.
  const variableKeys: AutofillKey[] = [
    "monthlyFood",
    "monthlyTransport",
    "monthlyBills",
    "monthlyInvestments",
  ];
  for (const k of variableKeys) {
    if ((bucketCount[k] ?? 0) >= minBucketTx) {
      (values as Record<string, number>)[k] = Math.round(bucketTotals[k] ?? 0);
      filled.add(k);
      sources[k] = "auto";
    }
    // else: leave undefined so the UI can ask only for this field.
  }

  // Other expenses: report when we saw at least a couple of uncategorised txs.
  if (otherCount >= minBucketTx) {
    values.otherMonthlyExpenses = Math.round(otherExpense);
    filled.add("otherMonthlyExpenses");
    sources.otherMonthlyExpenses = "auto";
  } else {
    values.otherMonthlyExpenses = Math.round(otherExpense);
    filled.add("otherMonthlyExpenses");
    sources.otherMonthlyExpenses = otherCount > 0 ? "auto" : "manual";
  }

  // ── Financial goal from Profile.
  if (profile.financialGoal) {
    values.financialGoal = profile.financialGoal;
    if (profile.customGoalNote) values.customGoalNote = profile.customGoalNote;
  }

  // ── Current Account Balance: last remembered value → FinTrackr net balance.
  const remembered = getRememberedBalance();
  if (remembered != null && remembered > 0) {
    values.currentAccountBalance = remembered;
    filled.add("currentAccountBalance");
    sources.currentAccountBalance = "profile";
  } else {
    let netAll = 0;
    for (const t of dedupe(transactions)) {
      if (t.type === "income") netAll += t.amount;
      else if (t.type === "expense") netAll -= t.amount;
    }
    const derived = Math.max(0, Math.round(netAll));
    values.currentAccountBalance = derived;
    if (derived > 0) {
      filled.add("currentAccountBalance");
      sources.currentAccountBalance = "auto";
    }
  }

  // ── Current Savings: remembered → derived → 0.
  const rememberedSavings = getRememberedSavings();
  if (rememberedSavings != null) {
    values.currentSavings = rememberedSavings;
    filled.add("currentSavings");
    sources.currentSavings = "profile";
  } else if ((bucketCount["currentSavings"] ?? 0) >= 1) {
    values.currentSavings = Math.round(bucketTotals["currentSavings"] ?? 0);
    filled.add("currentSavings");
    sources.currentSavings = "auto";
  } else {
    values.currentSavings = 0;
    filled.add("currentSavings");
    sources.currentSavings = "manual";
  }

  const missing = REQUIRED_FOR_SKIP.filter((k) => {
    const v = (values as Record<string, unknown>)[k];
    if (k === "salaryDate") return !v;
    if (k === "monthlySalary" || k === "currentAccountBalance") {
      return typeof v !== "number" || v <= 0;
    }
    return typeof v !== "number" || v < 0;
  });
  const hasEnough = missing.length === 0;

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

