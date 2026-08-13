// Builds a CONTROLLED financial snapshot + prompt for Gemini.
//
// Hard rule: FinTrackr's deterministic engine is the single source of truth for
// every number. Gemini only receives already-computed values and is instructed
// to explain them — never to recompute salary, salary left, safe daily spend,
// survival score, month-end forecast, EMI or budget totals.
//
// Nothing raw from the database is ever sent: only the whitelisted fields below.

import type { CoachAnalysisInput, CoachAnalysisResult } from "@/lib/ai-coach-analysis";
import type { CoachLanguage } from "@/lib/coach-language";
import type { CoachResponse } from "@/lib/coach-prompts";

export type CoachSnapshot = {
  lang: CoachLanguage;
  currency: "INR";
  goal: string;
  // deterministic inputs (rounded, no identifiers, no transaction rows)
  monthlySalary: number;
  monthlyRent: number;
  monthlyFood: number;
  monthlyTransport: number;
  monthlyEmi: number;
  monthlyBills: number;
  monthlyInvestments: number;
  otherMonthlyExpenses: number;
  currentAccountBalance: number;
  currentSavings: number;
  // deterministic outputs
  healthScore: number;
  totalExpenses: number;
  monthlySurplus: number;
  /**
   * Deterministic: (salary - totalExpenses) / salary * 100.
   * null when salary or total spend is unavailable — in that case NO savings
   * percentage may be shown or stated.
   */
  savingsRate: number | null;
  emiRatio: number;
  topCategories: { label: string; amount: number; pct: number }[];
  risks: { label: string; level: string }[];
  goalForecast: { goal: string; monthlyTarget: number; targetAmount: number; etaMonths: number; confidence: number };
  /** What FinTrackr actually knows about this user. Anything false = unknown. */
  facts: {
    hasSalary: boolean;
    hasSpendData: boolean;
    hasSavings: boolean;
    hasBalance: boolean;
    hasLoanOrEmi: boolean;
    hasInvestments: boolean;
    hasGoal: boolean;
    hasEmergencyFund: boolean;
  };
  /** Things FinTrackr has NO data about — never assert these exist. */
  unavailable: string[];
};


const r = (n: number) => Math.round(Number.isFinite(n) ? n : 0);

/** Whitelist-only projection. Never pass raw DB rows or PII here. */
export function buildCoachSnapshot(
  input: CoachAnalysisInput,
  analysis: CoachAnalysisResult,
  lang: CoachLanguage,
): CoachSnapshot {
  return {
    lang,
    currency: "INR",
    goal: input.financialGoal,
    monthlySalary: r(input.monthlySalary),
    monthlyRent: r(input.monthlyRent),
    monthlyFood: r(input.monthlyFood),
    monthlyTransport: r(input.monthlyTransport),
    monthlyEmi: r(input.monthlyEmi),
    monthlyBills: r(input.monthlyBills),
    monthlyInvestments: r(input.monthlyInvestments),
    otherMonthlyExpenses: r(input.otherMonthlyExpenses),
    currentAccountBalance: r(input.currentAccountBalance),
    currentSavings: r(input.currentSavings),
    healthScore: r(analysis.healthScore),
    totalExpenses: r(analysis.totalExpenses),
    monthlySurplus: r(analysis.monthlySurplus),
    savingsRate: r(analysis.savingsRate),
    emiRatio: r(analysis.emiRatio),
    topCategories: analysis.breakdown.slice(0, 5).map((b) => ({ label: b.label, amount: r(b.amount), pct: r(b.pct) })),
    risks: analysis.risks.map((x) => ({ label: x.label, level: x.level })),
    goalForecast: {
      goal: analysis.goalForecast.goal,
      monthlyTarget: r(analysis.goalForecast.monthlyTarget),
      targetAmount: r(analysis.goalForecast.targetAmount),
      etaMonths: r(analysis.goalForecast.etaMonths),
      confidence: r(analysis.goalForecast.confidence),
    },
  };
}

export const COACH_SYSTEM_PROMPT = [
  "You are FinTrackr's Salary Survival Coach for an Indian salaried user.",
  "The app has ALREADY calculated every number deterministically.",
  "You MUST NOT calculate, estimate, change or invent any number.",
  "Only reuse numbers exactly as given in the snapshot or the deterministic draft.",
  "Never recompute salary, salary left, safe daily spend, survival score, month-end forecast, EMI or budget totals.",
  "Be warm, concrete and practical. Amounts use the ₹ symbol.",
  "Reply with STRICT JSON only, no markdown fences, shaped as:",
  '{"shortAnswer": string, "why": string, "action": string}',
  "shortAnswer: 1-2 sentences directly answering the question.",
  "why: 1-2 sentences of reasoning grounded in the snapshot.",
  "action: one specific next step the user can do this week.",
].join(" ");

export function buildCoachUserPrompt(
  question: string,
  snapshot: CoachSnapshot,
  draft: CoachResponse,
): string {
  const langLine = snapshot.lang === "ta" ? "Answer in Tamil." : "Answer in English.";
  return [
    langLine,
    "",
    "USER QUESTION:",
    question.slice(0, 500),
    "",
    "FINANCIAL SNAPSHOT (authoritative, already calculated):",
    JSON.stringify(snapshot),
    "",
    "DETERMINISTIC DRAFT ANSWER (numbers here are correct — rephrase, do not change them):",
    JSON.stringify({ shortAnswer: draft.shortAnswer, why: draft.why, action: draft.action }),
    "",
    "Return the JSON object now.",
  ].join("\n");
}
