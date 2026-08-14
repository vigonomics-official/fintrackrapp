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

/**
 * Deterministic savings rate — the single source of truth for the percentage.
 * Returns null when salary or total spend is unavailable, so nothing is shown.
 */
export function computeSavingsRate(salary: number, totalSpent: number): number | null {
  if (!Number.isFinite(salary) || salary <= 0) return null;
  if (!Number.isFinite(totalSpent) || totalSpent < 0) return null;
  return Math.round(((salary - totalSpent) / salary) * 100);
}

/** Whitelist-only projection. Never pass raw DB rows or PII here. */
export function buildCoachSnapshot(
  input: CoachAnalysisInput,
  analysis: CoachAnalysisResult,
  lang: CoachLanguage,
): CoachSnapshot {
  const salary = r(input.monthlySalary);
  const totalExpenses = r(analysis.totalExpenses);
  const hasSalary = salary > 0;
  const hasSpendData = totalExpenses > 0;

  const facts = {
    hasSalary,
    hasSpendData,
    hasSavings: r(input.currentSavings) > 0,
    hasBalance: Number.isFinite(input.currentAccountBalance),
    hasLoanOrEmi: r(input.monthlyEmi) > 0,
    hasInvestments: r(input.monthlyInvestments) > 0,
    hasGoal: Boolean(input.financialGoal),
    hasEmergencyFund: r(input.currentSavings) > 0,
  };

  const unavailable: string[] = [
    "auto-debit mandates",
    "bank account details or bank features",
    "subscriptions",
    "individual transactions or merchants",
    "credit score",
  ];
  if (!facts.hasLoanOrEmi) unavailable.push("loans or EMIs");
  if (!facts.hasInvestments) unavailable.push("investment products");
  if (!facts.hasSavings) unavailable.push("savings or emergency fund balance");
  if (!hasSalary) unavailable.push("monthly salary");
  if (!hasSpendData) unavailable.push("total spend");

  return {
    lang,
    currency: "INR",
    goal: input.financialGoal,
    monthlySalary: salary,
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
    totalExpenses,
    monthlySurplus: r(analysis.monthlySurplus),
    savingsRate: computeSavingsRate(salary, totalExpenses),
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
    facts,
    unavailable,
  };
}

export const COACH_SYSTEM_PROMPT = [
  "You are FinTrackr's Salary Survival Coach for an Indian salaried user.",
  "The app has ALREADY calculated every number deterministically.",
  "You MUST NOT calculate, estimate, change or invent any number.",
  "Only reuse numbers exactly as given in the snapshot or the deterministic draft.",
  "Never recompute salary, salary left, total spent, savings, safe daily spend, days remaining,",
  "survival score, month-end forecast, EMI, loan balance, budget limits or remaining, goal amount",
  "or progress, emergency fund, or transaction totals — these are FinTrackr's authoritative values.",
  "SAVINGS RATE: use snapshot.savingsRate exactly as given. If it is null, do not state any savings percentage.",
  "NO INVENTED FACTS: never claim the user has an auto-debit, a bank account feature, an investment product,",
  "a loan, a subscription, a goal, or made any transaction unless that fact is present and true in the snapshot",
  "(see snapshot.facts and snapshot.unavailable).",
  'If the information needed is not in the snapshot, say exactly: "I don\'t have enough data to confirm that."',
  "Never fill missing financial information with assumptions.",
  "EVERY recommendation must cite at least one real snapshot data point (a category amount, a risk,",
  "the emergency fund, a budget figure). Do not give generic advice that the data does not support.",
  "ANSWER THE ACTUAL QUESTION: address exactly what was asked using the relevant snapshot fields.",
  "Never reply with a generic financial lecture when a specific question was asked.",
  "Priority of sources: (1) the user's question, (2) FinTrackr financial data, (3) recent spending categories,",
  "(4) current budget, (5) salary cycle, (6) goals, (7) emergency fund, (8) loans/EMIs.",
  "Only give general guidance when the snapshot has no relevant data.",
  "SEPARATE FACTS FROM ADVICE:",
  "- shortAnswer (Summary): briefly answers the question.",
  "- why (Why): ONLY verified FinTrackr facts from the snapshot. No advice, no speculation.",
  "- action (Recommended Action): your practical advice, derived from those facts.",
  "EXPECTED IMPACT: FinTrackr computes it; never state an exact rupee impact of your own.",
  "If an impact cannot be derived from the snapshot, omit it rather than guessing.",
  "Do not add legal or investment disclaimers — the app attaches a contextual note when required.",
  "Be warm, concrete and practical. Amounts use the ₹ symbol.",
  "Reply with STRICT JSON only, no markdown fences, shaped as:",
  '{"shortAnswer": string, "why": string, "action": string}',
  "shortAnswer: 1-2 sentences directly answering the question.",
  "why: 1-2 sentences of verified facts grounded in the snapshot, naming the data point used.",
  "action: one specific next step the user can do this week, supported by the snapshot.",
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
    "FINANCIAL SNAPSHOT (authoritative, already calculated — the ONLY facts you may use):",
    JSON.stringify(snapshot),
    "",
    "FACTS FINTRACKR HAS NO DATA ABOUT (never assert these exist):",
    snapshot.unavailable.join(", "),
    "",
    snapshot.savingsRate == null
      ? "SAVINGS RATE IS UNAVAILABLE — do not mention any savings percentage."
      : `SAVINGS RATE (authoritative): ${snapshot.savingsRate}%`,
    "",
    "DETERMINISTIC DRAFT ANSWER (numbers here are correct — rephrase, do not change them):",
    JSON.stringify({ shortAnswer: draft.shortAnswer, why: draft.why, action: draft.action }),
    "",
    "Return the JSON object now.",
  ].join("\n");
}

