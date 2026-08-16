// Response structure, confidence and contextual-disclaimer rules.
//
// A coach reply is always shaped as:
//   1. Summary (shortAnswer)  2. Why (verified FinTrackr facts only)
//   3. Recommended Action     4. Expected Impact (only when calculable)
//   5. Confidence             6. Data Used
//
// This module is the single enforcement point: it derives confidence from the
// quality of the data actually available, drops impacts that cannot be
// calculated reliably, and attaches the investment-only contextual note.

import type { CoachAnalysisInput, CoachAnalysisResult } from "@/lib/ai-coach-analysis";
import { isInvestmentQuestion } from "@/lib/coach-intent";
import type { CoachConfidence, CoachResponse } from "@/lib/coach-prompts";

export const INVESTMENT_NOTE =
  "General information based on your FinTrackr data, not personalized investment advice.";

/** FinTrackr data categories, used for the "Data Used" section. */
export const DATA_LABELS = {
  salary: "Salary profile",
  spending: "Spending history",
  budget: "Monthly budget",
  balance: "Current balance",
  savings: "Savings & emergency fund",
  goal: "Goal progress",
  emi: "Loans & EMIs",
  cycle: "Salary cycle",
  score: "Survival Score",
} as const;

export type DataKey = keyof typeof DATA_LABELS;

/** Which of the requested categories FinTrackr actually has data for. */
export function availability(
  input: CoachAnalysisInput | null,
  analysis: CoachAnalysisResult | null,
): Record<DataKey, boolean> {
  return {
    salary: !!input && input.monthlySalary > 0,
    spending: !!analysis && analysis.totalExpenses > 0,
    budget: !!input && input.monthlyRent + input.monthlyBills + input.monthlyFood > 0,
    balance: !!input && Number.isFinite(input.currentAccountBalance) && input.currentAccountBalance !== 0,
    savings: !!input && input.currentSavings > 0,
    goal: !!analysis && analysis.goalForecast.targetAmount > 0,
    emi: !!input && input.monthlyEmi > 0,
    cycle: !!input && !!input.salaryDate,
    score: !!analysis && Number.isFinite(analysis.healthScore),
  };
}

/**
 * HIGH   — backed by 2+ reliable data points, none of them missing.
 * MEDIUM — supported by available data, but something relevant is missing.
 * LOW    — only limited information available.
 * Assumptions never reach HIGH.
 */
export function deriveConfidence(
  keys: DataKey[],
  avail: Record<DataKey, boolean>,
): { confidence: CoachConfidence; used: DataKey[]; missing: DataKey[] } {
  const used = keys.filter((k) => avail[k]);
  const missing = keys.filter((k) => !avail[k]);
  let confidence: CoachConfidence;
  if (used.length >= 2 && missing.length === 0) confidence = "high";
  else if (used.length >= 2) confidence = "medium";
  else if (used.length === 1) confidence = missing.length <= 1 ? "medium" : "low";
  else confidence = "low";
  return { confidence, used, missing };
}

export function dataUsedLabels(keys: DataKey[], avail: Record<DataKey, boolean>): string[] {
  return keys.filter((k) => avail[k]).map((k) => DATA_LABELS[k]);
}

/** An impact line is only trustworthy when it can be computed from real data. */
function impactIsReliable(
  impact: string | undefined,
  confidence: CoachConfidence,
  avail: Record<DataKey, boolean>,
): boolean {
  if (!impact) return false;
  const hasRupeeFigure = /₹\s?\d/.test(impact);
  if (!hasRupeeFigure) return true; // qualitative impact is fine
  if (!avail.salary || !avail.spending) return false; // no reliable base to compute from
  return confidence !== "low";
}

/**
 * Final gate applied to every reply (deterministic or Gemini-narrated).
 * - normalises confidence against the data that actually exists
 * - drops an Expected Impact that cannot be calculated reliably
 * - attaches the contextual note only for investment questions
 */
export function finalizeResponse(
  reply: CoachResponse,
  question: string,
  keys: DataKey[],
  input: CoachAnalysisInput | null,
  analysis: CoachAnalysisResult | null,
): CoachResponse {
  const avail = availability(input, analysis);
  const { confidence, used } = deriveConfidence(keys, avail);

  // An "I don't have enough data" answer used nothing — never list data for it.
  const isNoData = reply.shortAnswer.trim().startsWith("I don't have enough data");

  // Never upgrade a builder's own cautious confidence, never let an
  // assumption-based reply claim HIGH.
  const rank: Record<CoachConfidence, number> = { low: 0, medium: 1, high: 2 };
  const finalConfidence = rank[reply.confidence] < rank[confidence] ? reply.confidence : confidence;

  const out: CoachResponse = {
    ...reply,
    confidence: isNoData ? "low" : finalConfidence,
    dataUsed: isNoData ? [] : used.length > 0 ? used.map((k) => DATA_LABELS[k]) : reply.dataUsed,
  };


  if (!impactIsReliable(out.monthlyImpact, finalConfidence, avail)) delete out.monthlyImpact;
  if (isInvestmentQuestion(question)) out.note = INVESTMENT_NOTE;
  else delete out.note;

  return out;
}

/** Data categories that matter for each intent, in priority order. */
export const INTENT_DATA: Record<string, DataKey[]> = {
  monthStatus: ["salary", "spending", "score", "cycle"],
  overspend: ["spending", "budget", "salary"],
  affordAmount: ["salary", "spending", "balance"],
  saveHowMuch: ["salary", "spending"],
  safeToday: ["salary", "budget", "cycle"],
  beforeSalary: ["balance", "cycle", "spending"],
  emergencyGoal: ["savings", "spending", "salary"],
  biggestProblem: ["spending", "salary", "score"],
  compare: ["salary", "spending", "goal"],
  whatIf: ["salary", "spending"],
  explainMetric: ["salary", "spending", "score"],
  goalDelay: ["goal", "salary"],
  afford: ["salary", "spending"],
  improveScore: ["score", "salary", "spending"],
  reduceFood: ["spending", "budget"],
  emergency: ["savings", "spending"],
  goal: ["goal", "salary"],
  budget: ["budget", "salary", "spending"],
  reduceFirst: ["spending", "budget"],
  generic: ["salary", "spending"],
};
