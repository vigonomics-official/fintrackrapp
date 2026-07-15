// Structured coach response — used by the provider and rendered by the
// chat UI. Keeping this separate makes swapping Mock → Gemini a
// data-shape mapping, not a UI change.

import type { CoachAnalysisInput, CoachAnalysisResult } from "@/lib/ai-coach-analysis";
import { t, type CoachLanguage } from "@/lib/coach-language";

export type CoachConfidence = "high" | "medium" | "low";

export type CoachResponse = {
  shortAnswer: string;
  why: string;
  action: string;
  monthlyImpact?: string; // formatted, e.g. "Save around ₹450/month."
  confidence: CoachConfidence;
  dataUsed: string[]; // labels
  calculation?: string; // step-by-step "How it was calculated" breakdown
  followUps?: string[]; // suggested follow-up prompts (Compare / What If? / Explain)
};

const inr = (n: number) => `₹${Math.round(Math.max(0, n)).toLocaleString("en-IN")}`;

function baseDataUsed(lang: CoachLanguage, input: CoachAnalysisInput | null): string[] {
  if (!input) return [];
  return [t(lang, "july"), t(lang, "monthlyBudget"), t(lang, "salaryProfile"), t(lang, "spendingHistory")];
}

// ---------- Intent handlers ----------

export function replyNoContext(lang: CoachLanguage): CoachResponse {
  return {
    shortAnswer: t(lang, "noContext"),
    why: "No analysis is available yet.",
    action: "Run Analyze first so I can use your real numbers.",
    confidence: "low",
    dataUsed: [],
  };
}

export function replyAffordability(
  lang: CoachLanguage,
  input: CoachAnalysisInput,
  analysis: CoachAnalysisResult,
): CoachResponse {
  const surplus = analysis.monthlySurplus;
  if (surplus <= 0) {
    return {
      shortAnswer: `A new purchase isn't safe right now.`,
      why: `Your expenses (${inr(analysis.totalExpenses)}) already meet or exceed your salary (${inr(input.monthlySalary)}).`,
      action: `Free up cash flow first — trim your biggest category before spending on wants.`,
      monthlyImpact: `Protects ${inr(Math.abs(surplus))}/month from further drift.`,
      confidence: "high",
      dataUsed: baseDataUsed(lang, input),
      calculation: `Salary ${inr(input.monthlySalary)} − Expenses ${inr(analysis.totalExpenses)} = ${inr(surplus)}`,
    };
  }
  const safe = Math.round(surplus * 0.5);
  return {
    shortAnswer: `Yes — up to about ${inr(safe)} in one go.`,
    why: `You have ${inr(surplus)} of monthly surplus, so a one-time spend under ${inr(safe)} keeps your buffer intact.`,
    action: `For anything larger, split it across 2–3 months or run "Can I Buy This?" in the Plan tab.`,
    monthlyImpact: `Keeps at least ${inr(surplus - safe)}/month for savings.`,
    confidence: "high",
    dataUsed: baseDataUsed(lang, input),
    calculation: `Surplus ${inr(surplus)} × 50% safe-spend rule = ${inr(safe)}`,
  };
}

export function replyImproveScore(
  lang: CoachLanguage,
  input: CoachAnalysisInput,
  analysis: CoachAnalysisResult,
): CoachResponse {
  const top = analysis.priorities.slice(0, 3).map((p, i) => `${i + 1}. ${p.title}`).join(" • ");
  return {
    shortAnswer: `Your Survival Score is ${analysis.healthScore}/100. Focus on 2–3 levers.`,
    why: top || "A balanced plan is already in place.",
    action: analysis.priorities[0]?.detail ?? "Maintain your current rhythm.",
    monthlyImpact: `+5 to +12 points expected within 2 months.`,
    confidence: "medium",
    dataUsed: baseDataUsed(lang, input),
  };
}

export function replyReduceFood(
  lang: CoachLanguage,
  input: CoachAnalysisInput,
): CoachResponse {
  if (input.monthlyFood <= 0) {
    return {
      shortAnswer: `No food budget on record.`,
      why: `I need a monthly food figure to model cuts.`,
      action: `Add food spending in Analyze and I'll suggest a target.`,
      confidence: "low",
      dataUsed: baseDataUsed(lang, input),
    };
  }
  const target = Math.round((input.monthlyFood * 0.85) / 100) * 100;
  const saving = input.monthlyFood - target;
  return {
    shortAnswer: `Trim food spending to ${inr(target)}.`,
    why: `You currently spend ${inr(input.monthlyFood)}. A 15% cut is realistic without pain.`,
    action: `Plan weekly groceries; cap delivery to twice a week.`,
    monthlyImpact: `Save around ${inr(saving)}/month.`,
    confidence: "high",
    dataUsed: baseDataUsed(lang, input),
    calculation: `${inr(input.monthlyFood)} × 15% = ${inr(saving)} monthly saving`,
  };
}

export function replyEmergency(
  lang: CoachLanguage,
  input: CoachAnalysisInput,
  analysis: CoachAnalysisResult,
): CoachResponse {
  const months = analysis.totalExpenses > 0 ? input.currentSavings / analysis.totalExpenses : 0;
  const target = analysis.totalExpenses * 6;
  const gap = Math.max(0, target - input.currentSavings);
  const monthly = Math.max(500, Math.round((input.monthlySalary * 0.05) / 100) * 100);
  return {
    shortAnswer: `You have about ${months.toFixed(1)} months of expenses saved.`,
    why: `Target is 6 months (${inr(target)}) — a ${inr(gap)} gap remains.`,
    action: `Auto-transfer ${inr(monthly)} on salary day.`,
    monthlyImpact: `Closes the gap in ~${Math.max(1, Math.ceil(gap / monthly))} months.`,
    confidence: "high",
    dataUsed: baseDataUsed(lang, input),
    calculation: `Target ${inr(target)} − Savings ${inr(input.currentSavings)} = Gap ${inr(gap)}`,
  };
}

export function replyGoal(
  lang: CoachLanguage,
  input: CoachAnalysisInput,
  analysis: CoachAnalysisResult,
): CoachResponse {
  const g = analysis.goalForecast;
  return {
    shortAnswer: `~${g.etaMonths} months to your ${g.goal} goal.`,
    why: `You need ${inr(g.monthlyTarget)}/month to reach ${inr(g.targetAmount)}.`,
    action: `Automate ${inr(g.monthlyTarget)} on salary day and treat it as a bill.`,
    monthlyImpact: `Locks in progress every month.`,
    confidence: g.confidence >= 66 ? "high" : g.confidence >= 33 ? "medium" : "low",
    dataUsed: baseDataUsed(lang, input),
    calculation: `Target ${inr(g.targetAmount)} ÷ ${inr(g.monthlyTarget)}/mo = ${g.etaMonths} months`,
  };
}

export function replyBudget(
  lang: CoachLanguage,
  input: CoachAnalysisInput,
  analysis: CoachAnalysisResult,
): CoachResponse {
  const top = analysis.breakdown.slice(0, 3).map((b) => `${b.label} ${inr(b.amount)}`).join(", ");
  return {
    shortAnswer: `Surplus ${inr(analysis.monthlySurplus)} at ${Math.round(analysis.savingsRate)}% savings rate.`,
    why: `Top outflows: ${top || "spread across categories"}.`,
    action: `Cap the top category at 30% of salary; auto-save the rest.`,
    monthlyImpact: `+${inr(Math.max(0, analysis.monthlySurplus * 0.1))} added to savings.`,
    confidence: "high",
    dataUsed: baseDataUsed(lang, input),
    calculation: `Salary ${inr(input.monthlySalary)} − Expenses ${inr(analysis.totalExpenses)} = ${inr(analysis.monthlySurplus)}`,
  };
}

export function replyReduceFirst(
  lang: CoachLanguage,
  input: CoachAnalysisInput,
  analysis: CoachAnalysisResult,
): CoachResponse {
  const top = analysis.breakdown[0];
  if (!top) {
    return {
      shortAnswer: `Spending is well spread — no single category dominates.`,
      why: `No category exceeds 25% of your outflows.`,
      action: `Focus on the savings rate instead of individual cuts.`,
      confidence: "medium",
      dataUsed: baseDataUsed(lang, input),
    };
  }
  return {
    shortAnswer: `Start with ${top.label}.`,
    why: `It is ${Math.round(top.pct)}% of your spend at ${inr(top.amount)}.`,
    action: `Aim for a 10% trim next month.`,
    monthlyImpact: `Save around ${inr(top.amount * 0.1)}/month.`,
    confidence: "high",
    dataUsed: baseDataUsed(lang, input),
    calculation: `${inr(top.amount)} × 10% = ${inr(top.amount * 0.1)}`,
  };
}

export function replyGeneric(
  lang: CoachLanguage,
  input: CoachAnalysisInput,
  analysis: CoachAnalysisResult,
  userText: string,
): CoachResponse {
  const base = replyBudget(lang, input, analysis);
  return {
    ...base,
    shortAnswer: `Here's how "${userText.trim().slice(0, 40)}" fits your finances.`,
    why: base.shortAnswer + " " + base.why,
    confidence: "medium",
  };
}
