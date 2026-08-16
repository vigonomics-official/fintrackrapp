// "Can I Buy This?" — deterministic affordability engine.
//
// HARD RULE: this module makes the decision. Gemini never does. Every number
// shown to the user originates here, from FinTrackr's own survival math.
// Thresholds live in PURCHASE_THRESHOLDS so they can be tuned in one place.

import type { Survival } from "@/lib/survival";

export type PurchaseDecision = "SAFE" | "CAREFUL" | "NOT_SAFE" | "INSUFFICIENT_DATA";

export type PurchaseConfidence = "high" | "medium" | "low";

/** Machine-readable reasons behind the decision (also drive the copy). */
export type PurchaseReasonCode =
  | "exceeds_salary_left"
  | "large_vs_safe_daily"
  | "moderate_vs_safe_daily"
  | "eats_salary_left"
  | "breaks_forecast"
  | "hurts_forecast"
  | "score_drop_large"
  | "score_drop_moderate"
  | "over_budget_remaining"
  | "high_emi_pressure"
  | "long_wait_to_salary"
  | "weak_emergency_fund"
  | "comfortably_within_capacity"
  | "salary_day_close";

export const PURCHASE_THRESHOLDS = {
  /** price / safeDaily above this = a big one-off relative to daily capacity. */
  safeDailyHigh: 3,
  safeDailyMedium: 1.5,
  /** price / salaryLeft */
  salaryLeftHigh: 0.4,
  salaryLeftMedium: 0.2,
  /** survival score points lost */
  scoreDropHigh: 20,
  scoreDropMedium: 10,
  /** EMI ratio (%) considered heavy */
  emiHeavy: 40,
  /** emergency fund coverage below this is "thin" */
  emergencyThin: 0.5,
  /** days left in cycle above this counts as "long stretch ahead" */
  longWaitDays: 12,
  /** days left at/below this counts as close to salary day */
  salaryCloseDays: 3,
  /** risk points → decision */
  notSafeAt: 5,
  carefulAt: 2,
} as const;

export type PurchaseCheckInput = {
  itemName: string;
  price: number;
  /** Survival snapshot without the purchase. */
  before: Survival;
  /** Survival snapshot recomputed with the purchase as extra spend. */
  after: Survival;
  currency: string;
  /** Remembered savings, null when FinTrackr has none on record. */
  savings: number | null;
  /** Emergency fund target from the user's survival preferences (0 when unknown). */
  emergencyTarget: number;
  /** Remaining budget for the relevant period, null when no budget is set. */
  budgetRemaining: number | null;
  /** Active risk labels detected elsewhere in FinTrackr (may be empty). */
  risks?: string[];
};

export type PurchaseCheckResult = {
  decision: PurchaseDecision;
  itemName: string;
  purchaseAmount: number;
  currency: string;
  confidence: PurchaseConfidence;
  reasonCodes: PurchaseReasonCode[];
  /** Plain-language headline + reason produced deterministically. */
  headline: string;
  why: string;
  suggestion: string;
  /** Only keys with real data are present. */
  values: {
    salaryLeft?: number;
    salaryLeftAfter?: number;
    safeDailySpend?: number;
    safeDailySpendAfter?: number;
    daysRemaining?: number;
    totalSpent?: number;
    budgetRemaining?: number;
    forecastBefore?: number;
    forecastAfter?: number;
    survivalScore?: number;
    survivalScoreAfter?: number;
    emiPressure?: "Low" | "Medium" | "High";
  };
  dataUsed: string[];
  missing: string[];
};

export type PurchaseValidation =
  | { ok: true; itemName: string; price: number }
  | { ok: false; message: string };

export const INVALID_PURCHASE_MESSAGE = "Please enter a valid item and price.";
export const NOT_ENOUGH_PURCHASE_DATA =
  "I don't have enough data to confirm whether this purchase is safe.";

export function validatePurchaseInput(itemName: string, priceInput: string | number): PurchaseValidation {
  const name = String(itemName ?? "").trim();
  if (name.length === 0) return { ok: false, message: INVALID_PURCHASE_MESSAGE };

  const raw = typeof priceInput === "number" ? priceInput : String(priceInput ?? "").replace(/[,\s₹]/g, "");
  if (raw === "" || raw === null) return { ok: false, message: INVALID_PURCHASE_MESSAGE };
  const price = Number(raw);
  if (!Number.isFinite(price) || price <= 0) return { ok: false, message: INVALID_PURCHASE_MESSAGE };

  return { ok: true, itemName: name.slice(0, 60), price: Math.round(price * 100) / 100 };
}

const DECISION_LABEL: Record<PurchaseDecision, string> = {
  SAFE: "SAFE TO BUY",
  CAREFUL: "BE CAREFUL",
  NOT_SAFE: "NOT SAFE RIGHT NOW",
  INSUFFICIENT_DATA: "NOT ENOUGH DATA",
};

export function decisionLabel(d: PurchaseDecision): string {
  return DECISION_LABEL[d];
}

export function checkPurchaseAffordability(input: PurchaseCheckInput): PurchaseCheckResult {
  const { before, after, price, currency, itemName } = input;

  const hasSalary = before.hasIncome && before.salary > 0;
  const hasSpendData = before.totalSpent > 0;
  const hasCycle = Number.isFinite(before.daysRemaining);

  const missing: string[] = [];
  if (!hasSalary) missing.push("Salary or income");
  if (!hasSpendData) missing.push("Spending history");
  if (input.savings == null) missing.push("Savings amount");
  if (input.budgetRemaining == null) missing.push("Monthly budget");

  // FIX 7 — without salary/balance there is nothing to decide against.
  if (!hasSalary) {
    return {
      decision: "INSUFFICIENT_DATA",
      itemName,
      purchaseAmount: price,
      currency,
      confidence: "low",
      reasonCodes: [],
      headline: DECISION_LABEL.INSUFFICIENT_DATA,
      why: NOT_ENOUGH_PURCHASE_DATA,
      suggestion:
        "Add your salary in Salary Settings (and a few transactions) so FinTrackr can check purchases for you.",
      values: {},
      dataUsed: [],
      missing,
    };
  }

  const salaryLeft = Math.round(before.salaryLeft);
  const salaryLeftAfter = Math.round(after.salaryLeft);
  const safeDaily = Math.round(before.safeDaily);
  const safeDailyAfter = Math.round(after.safeDaily);
  const days = before.daysRemaining;
  const forecastBefore = Math.round(before.forecastBalance);
  const forecastAfter = Math.round(after.forecastBalance);
  const scoreDrop = before.score - after.score;

  const codes: PurchaseReasonCode[] = [];
  let points = 0;

  // A — can it come out of what's left at all?
  if (price > salaryLeft) {
    points += 6;
    codes.push("exceeds_salary_left");
  } else {
    const share = salaryLeft > 0 ? price / salaryLeft : 1;
    if (share >= PURCHASE_THRESHOLDS.salaryLeftHigh) {
      points += 3;
      codes.push("eats_salary_left");
    } else if (share >= PURCHASE_THRESHOLDS.salaryLeftMedium) {
      points += 1;
      codes.push("eats_salary_left");
    }
  }

  // G — unusually large versus daily capacity.
  const dailyRatio = safeDaily > 0 ? price / safeDaily : price > 0 ? Infinity : 0;
  if (dailyRatio >= PURCHASE_THRESHOLDS.safeDailyHigh) {
    points += 2;
    codes.push("large_vs_safe_daily");
  } else if (dailyRatio >= PURCHASE_THRESHOLDS.safeDailyMedium) {
    points += 1;
    codes.push("moderate_vs_safe_daily");
  }

  // F — month-end forecast.
  if (hasSpendData) {
    if (forecastAfter < 0 && forecastBefore >= 0) {
      points += 3;
      codes.push("breaks_forecast");
    } else if (forecastAfter < 0) {
      points += 2;
      codes.push("breaks_forecast");
    } else if (forecastBefore > 0 && forecastAfter < forecastBefore * 0.5) {
      points += 1;
      codes.push("hurts_forecast");
    }
  }

  // B — survival score impact.
  if (scoreDrop >= PURCHASE_THRESHOLDS.scoreDropHigh) {
    points += 2;
    codes.push("score_drop_large");
  } else if (scoreDrop >= PURCHASE_THRESHOLDS.scoreDropMedium) {
    points += 1;
    codes.push("score_drop_moderate");
  }

  // C — budget remaining.
  if (input.budgetRemaining != null && price > input.budgetRemaining) {
    points += 2;
    codes.push("over_budget_remaining");
  }

  // D — active risks / EMI pressure.
  if (before.emiRatio >= PURCHASE_THRESHOLDS.emiHeavy) {
    points += 1;
    codes.push("high_emi_pressure");
  }
  if (
    input.savings != null &&
    input.emergencyTarget > 0 &&
    input.savings < input.emergencyTarget * PURCHASE_THRESHOLDS.emergencyThin &&
    price > safeDaily
  ) {
    points += 1;
    codes.push("weak_emergency_fund");
  }

  // E — how far salary day is.
  if (days >= PURCHASE_THRESHOLDS.longWaitDays && price > salaryLeft * 0.25) {
    points += 1;
    codes.push("long_wait_to_salary");
  } else if (days <= PURCHASE_THRESHOLDS.salaryCloseDays && price <= salaryLeft) {
    points -= 1;
    codes.push("salary_day_close");
  }

  const decision: PurchaseDecision =
    points >= PURCHASE_THRESHOLDS.notSafeAt ? "NOT_SAFE" : points >= PURCHASE_THRESHOLDS.carefulAt ? "CAREFUL" : "SAFE";

  if (decision === "SAFE" && codes.length === 0) codes.push("comfortably_within_capacity");

  const values: PurchaseCheckResult["values"] = {
    salaryLeft,
    salaryLeftAfter,
    safeDailySpend: safeDaily,
    safeDailySpendAfter: safeDailyAfter,
    survivalScore: before.score,
    survivalScoreAfter: after.score,
    emiPressure: before.emiLevel,
  };
  if (hasCycle) values.daysRemaining = days;
  if (hasSpendData) {
    values.totalSpent = Math.round(before.totalSpent);
    values.forecastBefore = forecastBefore;
    values.forecastAfter = forecastAfter;
  }
  if (input.budgetRemaining != null) values.budgetRemaining = Math.round(input.budgetRemaining);

  const dataUsed = ["Salary left", "Safe daily spend"];
  if (hasCycle) dataUsed.push("Days remaining");
  if (hasSpendData) dataUsed.push("Spending this cycle", "Month-end forecast");
  dataUsed.push("Survival Score");
  if (before.monthlyEmi > 0) dataUsed.push("EMI pressure");
  if (input.budgetRemaining != null) dataUsed.push("Budget remaining");
  if (input.savings != null) dataUsed.push("Savings");

  const signals = dataUsed.length;
  const confidence: PurchaseConfidence =
    hasSalary && hasSpendData && signals >= 5 ? "high" : hasSalary && signals >= 3 ? "medium" : "low";

  return {
    decision,
    itemName,
    purchaseAmount: price,
    currency,
    confidence,
    reasonCodes: codes,
    headline: DECISION_LABEL[decision],
    why: buildWhy(decision, codes, { price, salaryLeft, safeDaily, days, dailyRatio, scoreDrop, forecastAfter }),
    suggestion: buildSuggestion(decision, codes, days),
    values,
    dataUsed,
    missing,
  };
}

function money(n: number): string {
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

function buildWhy(
  decision: PurchaseDecision,
  codes: PurchaseReasonCode[],
  v: {
    price: number; salaryLeft: number; safeDaily: number; days: number;
    dailyRatio: number; scoreDrop: number; forecastAfter: number;
  },
): string {
  const has = (c: PurchaseReasonCode) => codes.includes(c);
  const parts: string[] = [];

  if (has("exceeds_salary_left")) {
    parts.push(`${money(v.price)} is more than the ${money(v.salaryLeft)} you have left until salary day.`);
  } else if (has("eats_salary_left")) {
    parts.push(`This takes a big share of the ${money(v.salaryLeft)} left in this cycle.`);
  } else {
    parts.push(`You have ${money(v.salaryLeft)} left in this cycle, so the amount itself fits.`);
  }

  if (has("large_vs_safe_daily") || has("moderate_vs_safe_daily")) {
    if (Number.isFinite(v.dailyRatio) && v.safeDaily > 0) {
      parts.push(`It is about ${v.dailyRatio.toFixed(1)}x your safe daily spend of ${money(v.safeDaily)}.`);
    }
  }
  if (has("breaks_forecast")) parts.push(`Your month-end forecast turns negative at ${money(v.forecastAfter)}.`);
  else if (has("hurts_forecast")) parts.push(`Your month-end forecast drops to ${money(v.forecastAfter)}.`);
  if (has("over_budget_remaining")) parts.push("It is above the budget you have left.");
  if (has("score_drop_large") || has("score_drop_moderate")) {
    parts.push(`Your Survival Score would fall by ${Math.round(v.scoreDrop)} points.`);
  }
  if (has("high_emi_pressure")) parts.push("Your EMI load is already heavy this month.");
  if (has("weak_emergency_fund")) parts.push("Your savings are still below your emergency fund target.");
  if (has("long_wait_to_salary")) parts.push(`There are still ${v.days} days to cover before your next salary.`);
  if (decision === "SAFE" && has("salary_day_close")) parts.push(`Salary day is only ${v.days} day(s) away.`);

  return parts.join(" ");
}

function buildSuggestion(decision: PurchaseDecision, codes: PurchaseReasonCode[], days: number): string {
  if (decision === "NOT_SAFE") {
    return codes.includes("exceeds_salary_left")
      ? "Wait until your next salary, or save for it across two cycles instead of buying now."
      : `Hold this for now. If you still want it after salary day (${days} day(s) away), check again then.`;
  }
  if (decision === "CAREFUL") {
    return "You can manage this, but trim another expense this week or split it over two cycles to stay comfortable.";
  }
  return "Go ahead, and keep the rest of your spending within your safe daily limit.";
}
