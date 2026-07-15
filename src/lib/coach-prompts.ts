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

// ---------- Standard follow-ups shown after every recommendation ----------
export const STANDARD_FOLLOWUPS = ["Compare purchases", "What if?", "Explain more"];

function withFollowUps(r: CoachResponse, extra: string[] = []): CoachResponse {
  return { ...r, followUps: Array.from(new Set([...(r.followUps ?? []), ...extra, ...STANDARD_FOLLOWUPS])) };
}

// Backfill: ensure a `calculation` and `followUps` exist on every response.
export function ensureExplainable(r: CoachResponse, input: CoachAnalysisInput | null): CoachResponse {
  const out = { ...r };
  if (!out.calculation && input) {
    out.calculation = `Based on Salary ${inr(input.monthlySalary)} and known monthly outflows.`;
  }
  if (!out.followUps || out.followUps.length === 0) {
    out.followUps = STANDARD_FOLLOWUPS;
  }
  return out;
}

// ---------- Explain This Number ----------
export type MetricKey = "survivalScore" | "safeDailySpend" | "safePurchase" | "savingsTarget" | "goalForecast";

export function replyExplainMetric(
  lang: CoachLanguage,
  input: CoachAnalysisInput,
  analysis: CoachAnalysisResult,
  metric: MetricKey,
): CoachResponse {
  switch (metric) {
    case "survivalScore": {
      const buffer = Math.max(-50, Math.min(50, analysis.savingsRate));
      const emiPart = Math.max(0, 30 - analysis.emiRatio * 0.5);
      return withFollowUps({
        shortAnswer: `Your Survival Score is ${analysis.healthScore}/100.`,
        why: `It blends your savings rate (${Math.round(analysis.savingsRate)}%) with EMI pressure (${Math.round(analysis.emiRatio)}%).`,
        action: `Push savings rate above 20% and keep EMIs under 30% of salary.`,
        monthlyImpact: `A 5% savings-rate bump lifts the score by ~2 points.`,
        confidence: "high",
        dataUsed: baseDataUsed(lang, input),
        calculation:
          `Step 1 · Buffer = clamp(savingsRate ${Math.round(analysis.savingsRate)}%, -50, 50) = ${Math.round(buffer)}\n` +
          `Step 2 · EMI score = clamp(30 − EMI% × 0.5, 0, 30) = ${Math.round(emiPart)}\n` +
          `Step 3 · Score = 50 + Buffer × 0.4 + EMIscore × 0.6 = ${analysis.healthScore}`,
      });
    }
    case "safeDailySpend": {
      const salary = input.monthlySalary;
      const fixed = input.monthlyRent + input.monthlyEmi + input.monthlyBills;
      const daily = Math.max(0, Math.round((salary - fixed) / 30));
      return withFollowUps({
        shortAnswer: `Your Safe Daily Spend is about ${inr(daily)}.`,
        why: `Salary minus fixed obligations, spread across 30 days.`,
        action: `Track daily variable spend against this line.`,
        confidence: "high",
        dataUsed: baseDataUsed(lang, input),
        calculation:
          `Step 1 · Fixed = Rent ${inr(input.monthlyRent)} + EMI ${inr(input.monthlyEmi)} + Bills ${inr(input.monthlyBills)} = ${inr(fixed)}\n` +
          `Step 2 · Spendable = Salary ${inr(salary)} − Fixed ${inr(fixed)} = ${inr(salary - fixed)}\n` +
          `Step 3 · Daily = Spendable ÷ 30 = ${inr(daily)}`,
      });
    }
    case "safePurchase": {
      const safe = Math.max(0, Math.round(analysis.monthlySurplus * 0.5));
      return withFollowUps({
        shortAnswer: `Safe one-time purchase limit: ${inr(safe)}.`,
        why: `Half of your monthly surplus keeps the other half working for savings.`,
        action: `Split anything bigger across 2–3 months.`,
        confidence: "high",
        dataUsed: baseDataUsed(lang, input),
        calculation:
          `Step 1 · Surplus = Salary ${inr(input.monthlySalary)} − Expenses ${inr(analysis.totalExpenses)} = ${inr(analysis.monthlySurplus)}\n` +
          `Step 2 · Safe = Surplus × 50% = ${inr(safe)}`,
      });
    }
    case "savingsTarget": {
      const target = Math.max(500, Math.round((input.monthlySalary * 0.2) / 100) * 100);
      return withFollowUps({
        shortAnswer: `Aim to save ${inr(target)}/month.`,
        why: `A 20% savings rate is a widely-recommended floor.`,
        action: `Auto-transfer ${inr(target)} on salary day.`,
        monthlyImpact: `${inr(target * 12)} banked in 12 months.`,
        confidence: "high",
        dataUsed: baseDataUsed(lang, input),
        calculation: `Salary ${inr(input.monthlySalary)} × 20% = ${inr(target)} per month`,
      });
    }
    case "goalForecast": {
      const g = analysis.goalForecast;
      return withFollowUps({
        shortAnswer: `~${g.etaMonths} months to your ${g.goal} goal.`,
        why: `Monthly contribution ${inr(g.monthlyTarget)} vs target ${inr(g.targetAmount)}.`,
        action: `Automate the transfer on salary day.`,
        confidence: g.confidence >= 66 ? "high" : g.confidence >= 33 ? "medium" : "low",
        dataUsed: baseDataUsed(lang, input),
        calculation:
          `Step 1 · Target = ${inr(g.targetAmount)}\n` +
          `Step 2 · Monthly = ${inr(g.monthlyTarget)}\n` +
          `Step 3 · ETA = Target ÷ Monthly = ${g.etaMonths} months`,
      });
    }
  }
}

// ---------- Compare two purchases ----------
type PurchaseSpec = { name: string; amount: number };

function parseComparison(text: string): [PurchaseSpec, PurchaseSpec] | null {
  // Try to find two "name @amount" pairs, or "A ₹X vs B ₹Y".
  const m = text.match(/([A-Za-z][\w\s]{0,30})\s*[₹Rs.]*\s*(\d[\d,]{2,})\s*(?:vs|versus|or|,)\s*([A-Za-z][\w\s]{0,30})\s*[₹Rs.]*\s*(\d[\d,]{2,})/i);
  if (m) {
    return [
      { name: m[1].trim(), amount: Number(m[2].replace(/,/g, "")) },
      { name: m[3].trim(), amount: Number(m[4].replace(/,/g, "")) },
    ];
  }
  return null;
}

export function replyCompare(
  lang: CoachLanguage,
  input: CoachAnalysisInput,
  analysis: CoachAnalysisResult,
  userText: string,
): CoachResponse {
  const parsed = parseComparison(userText);
  if (!parsed) {
    return withFollowUps({
      shortAnswer: `Tell me both options with prices, e.g. "Phone A 25000 vs Phone B 32000".`,
      why: `I compare purchases on budget fit, goal delay, and month-end balance.`,
      action: `Reply with the two options and their prices.`,
      confidence: "low",
      dataUsed: baseDataUsed(lang, input),
    });
  }
  const [a, b] = parsed;
  const surplus = Math.max(1, analysis.monthlySurplus);
  const monthlyGoal = analysis.goalForecast.monthlyTarget;
  const delayA = Math.ceil(a.amount / Math.max(1, monthlyGoal));
  const delayB = Math.ceil(b.amount / Math.max(1, monthlyGoal));
  const scoreDropA = Math.round((a.amount / surplus) * 5);
  const scoreDropB = Math.round((b.amount / surplus) * 5);
  const winner = a.amount <= b.amount ? a : b;
  const loser = winner === a ? b : a;
  return withFollowUps({
    shortAnswer: `Pick ${winner.name} — cheaper by ${inr(loser.amount - winner.amount)}.`,
    why: `${a.name} costs ${inr(a.amount)}, ${b.name} costs ${inr(b.amount)}. Your monthly surplus is ${inr(analysis.monthlySurplus)}.`,
    action: `Choose ${winner.name}; put the difference toward your ${analysis.goalForecast.goal} goal.`,
    monthlyImpact: `Saves ${inr(loser.amount - winner.amount)} vs the other option.`,
    confidence: "high",
    dataUsed: baseDataUsed(lang, input),
    calculation:
      `${a.name}: cost ${inr(a.amount)} · goal delay ~${delayA} month(s) · score impact ~-${scoreDropA}\n` +
      `${b.name}: cost ${inr(b.amount)} · goal delay ~${delayB} month(s) · score impact ~-${scoreDropB}\n` +
      `Winner = lower cost + smaller goal delay = ${winner.name}`,
  });
}

// ---------- Goal-aware purchase impact ----------
export function replyGoalDelay(
  lang: CoachLanguage,
  input: CoachAnalysisInput,
  analysis: CoachAnalysisResult,
  amount: number,
): CoachResponse {
  const monthly = Math.max(1, analysis.goalForecast.monthlyTarget);
  const delayMonths = amount / monthly;
  const delayDays = Math.round(delayMonths * 30);
  const better = new Date();
  better.setMonth(better.getMonth() + Math.max(1, Math.ceil(delayMonths)));
  const betterLabel = better.toLocaleDateString(undefined, { month: "short", year: "numeric" });
  return withFollowUps({
    shortAnswer: `That purchase delays your ${analysis.goalForecast.goal} goal by ~${delayMonths.toFixed(1)} months (${delayDays} days).`,
    why: `You're saving ${inr(monthly)}/month toward the goal; spending ${inr(amount)} pushes the finish line out.`,
    action: `Wait until ${betterLabel} or split the purchase across ${Math.ceil(delayMonths)} months.`,
    monthlyImpact: `Preserves ${inr(monthly)}/month goal contribution.`,
    confidence: "high",
    dataUsed: baseDataUsed(lang, input),
    calculation:
      `Step 1 · Monthly goal contribution = ${inr(monthly)}\n` +
      `Step 2 · Delay = Purchase ${inr(amount)} ÷ Monthly ${inr(monthly)} = ${delayMonths.toFixed(2)} months\n` +
      `Step 3 · Better date = today + ${Math.ceil(delayMonths)} month(s) → ${betterLabel}`,
  });
}

// ---------- What if? ----------
export type WhatIfScenario = "saveMore" | "skipShopping" | "increaseSip" | "buyAfterSalary";

export function replyWhatIf(
  lang: CoachLanguage,
  input: CoachAnalysisInput,
  analysis: CoachAnalysisResult,
  scenario: WhatIfScenario,
  amount = 1000,
): CoachResponse {
  const monthly = Math.max(1, analysis.goalForecast.monthlyTarget);
  switch (scenario) {
    case "saveMore": {
      const newSurplus = analysis.monthlySurplus + amount;
      const newRate = input.monthlySalary > 0 ? (newSurplus / input.monthlySalary) * 100 : 0;
      const scoreDelta = Math.round((newRate - analysis.savingsRate) * 0.4);
      const etaCut = amount / monthly;
      return withFollowUps({
        shortAnswer: `Saving ${inr(amount)} more lifts your score by ~${scoreDelta} points.`,
        why: `Savings rate moves from ${Math.round(analysis.savingsRate)}% to ${Math.round(newRate)}%.`,
        action: `Automate an extra ${inr(amount)} transfer on salary day.`,
        monthlyImpact: `Goal reached ~${etaCut.toFixed(1)} months sooner.`,
        confidence: "high",
        dataUsed: baseDataUsed(lang, input),
        calculation:
          `Step 1 · New surplus = ${inr(analysis.monthlySurplus)} + ${inr(amount)} = ${inr(newSurplus)}\n` +
          `Step 2 · New savings rate = ${Math.round(newRate)}%\n` +
          `Step 3 · Score change ≈ ΔRate × 0.4 = +${scoreDelta}`,
      });
    }
    case "skipShopping": {
      const top = analysis.breakdown[0];
      const saved = top ? Math.round(top.amount * 0.25) : Math.round(input.monthlySalary * 0.05);
      return withFollowUps({
        shortAnswer: `Skipping shopping frees ~${inr(saved)}/month.`,
        why: top ? `${top.label} is your biggest outflow at ${inr(top.amount)}.` : `Rough estimate at 5% of salary.`,
        action: `Redirect ${inr(saved)} to your ${analysis.goalForecast.goal} goal.`,
        monthlyImpact: `Goal reached ~${(saved / monthly).toFixed(1)} months sooner.`,
        confidence: "medium",
        dataUsed: baseDataUsed(lang, input),
        calculation: top
          ? `${top.label} ${inr(top.amount)} × 25% cut = ${inr(saved)}/month`
          : `Salary ${inr(input.monthlySalary)} × 5% = ${inr(saved)}/month`,
      });
    }
    case "increaseSip": {
      const bump = Math.max(500, Math.round((input.monthlySalary * 0.05) / 100) * 100);
      const year = bump * 12;
      return withFollowUps({
        shortAnswer: `Add ${inr(bump)}/month to your SIP.`,
        why: `Even 5% of salary compounds strongly.`,
        action: `Increase SIP mandate to +${inr(bump)}.`,
        monthlyImpact: `${inr(year)} extra invested in 12 months (before returns).`,
        confidence: "medium",
        dataUsed: baseDataUsed(lang, input),
        calculation: `Salary ${inr(input.monthlySalary)} × 5% = ${inr(bump)} · × 12 = ${inr(year)}`,
      });
    }
    case "buyAfterSalary": {
      return withFollowUps({
        shortAnswer: `Buying right after salary keeps your buffer intact.`,
        why: `Balance is highest post-credit; late-month spends erode the emergency cushion.`,
        action: `Schedule the purchase within 3 days of salary date (${input.salaryDate}).`,
        confidence: "high",
        dataUsed: baseDataUsed(lang, input),
        calculation: `Timing shift: end-of-month spend → salary-day spend, keeping surplus ${inr(analysis.monthlySurplus)} untouched later in the cycle.`,
      });
    }
  }
}

