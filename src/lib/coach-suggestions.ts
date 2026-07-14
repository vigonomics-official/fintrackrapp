// Snapshot + dynamic suggestions + proactive insights, derived from the
// latest analysis. Pure functions so both the UI and future Gemini prompts
// can reuse the same computations.

import type { CoachAnalysisInput, CoachAnalysisResult } from "@/lib/ai-coach-analysis";
import { computeConfidence } from "@/lib/coach-confidence";
import { t, type CoachLanguage } from "@/lib/coach-language";

export type CoachSnapshot = {
  survivalScore: number | null;
  safeDailySpend: number | null;
  currentBalance: number | null;
  daysUntilSalary: number | null;
  confidenceScore: number | null;
};

export function daysUntilNextSalary(salaryDate: string | undefined | null): number | null {
  if (!salaryDate) return null;
  const parsed = new Date(salaryDate);
  if (isNaN(parsed.getTime())) return null;
  const day = parsed.getDate();
  const now = new Date();
  let next = new Date(now.getFullYear(), now.getMonth(), day);
  if (next.getTime() <= now.setHours(0, 0, 0, 0)) {
    next = new Date(new Date().getFullYear(), new Date().getMonth() + 1, day);
  }
  const diff = Math.ceil((next.getTime() - new Date().setHours(0, 0, 0, 0)) / (1000 * 60 * 60 * 24));
  return Math.max(0, diff);
}

export function computeSnapshot(
  input: CoachAnalysisInput | null,
  analysis: CoachAnalysisResult | null,
): CoachSnapshot {
  if (!input || !analysis) {
    return {
      survivalScore: null,
      safeDailySpend: null,
      currentBalance: null,
      daysUntilSalary: null,
      confidenceScore: null,
    };
  }
  const days = daysUntilNextSalary(input.salaryDate) ?? 30;
  const balance = input.currentAccountBalance ?? 0;
  const upcomingFixed = (input.monthlyRent + input.monthlyEmi + input.monthlyBills) * (days / 30);
  const spendable = Math.max(0, balance - upcomingFixed);
  const safeDaily = days > 0 ? Math.round(spendable / days) : 0;
  const confidence = computeConfidence(input).score;
  return {
    survivalScore: analysis.healthScore,
    safeDailySpend: safeDaily,
    currentBalance: balance,
    daysUntilSalary: days,
    confidenceScore: confidence,
  };
}

export function personalizedGreeting(lang: CoachLanguage, snap: CoachSnapshot): { title: string; subtitle: string } {
  const hour = new Date().getHours();
  const title =
    hour < 12 ? t(lang, "goodMorning") : hour < 17 ? t(lang, "goodAfternoon") : t(lang, "goodEvening");
  let subtitle = "";
  if (snap.daysUntilSalary !== null && snap.daysUntilSalary <= 7) {
    subtitle = t(lang, "daysLeft", { n: snap.daysUntilSalary });
  } else if (snap.safeDailySpend !== null && snap.safeDailySpend > 0) {
    subtitle = t(lang, "availableToday", { amt: `₹${snap.safeDailySpend.toLocaleString("en-IN")}` });
  } else {
    subtitle = t(lang, "safeToday");
  }
  return { title, subtitle };
}

// ---------- Suggested questions (dynamic) ----------

export function buildSmartSuggestions(
  input: CoachAnalysisInput | null,
  analysis: CoachAnalysisResult | null,
): string[] {
  if (!input || !analysis) {
    return [
      "How can I plan my salary better?",
      "What should I track first?",
      "How do I build an emergency fund?",
      "How much should I save each month?",
      "Which expense category matters most?",
    ];
  }
  const out: string[] = [];
  const top = analysis.breakdown[0];
  if (top) out.push(`Why did my ${top.label} spending grow?`);
  if (analysis.monthlySurplus > 500) out.push(`How much can I safely spend this weekend?`);
  out.push(`Can I buy a new phone?`);
  if (input.monthlyInvestments > 0) out.push(`Can I increase my SIP?`);
  else out.push(`Should I start a small SIP now?`);
  const saveTarget = Math.max(1000, Math.round((input.monthlySalary * 0.05) / 500) * 500);
  out.push(`How can I save ₹${saveTarget.toLocaleString("en-IN")} this month?`);
  out.push(`How long until I reach my ${input.financialGoal} goal?`);
  // Deduplicate + cap to 5
  return Array.from(new Set(out)).slice(0, 5);
}

// ---------- Quick action chips ----------

export const QUICK_ACTIONS: string[] = [
  "Can I Buy This?",
  "Reduce Expenses",
  "Increase Savings",
  "Emergency Fund",
  "Investment Tips",
  "Bills Due",
  "Goal Progress",
  "Weekend Budget",
];

// ---------- Proactive insight ----------

export function buildProactiveInsight(
  input: CoachAnalysisInput | null,
  analysis: CoachAnalysisResult | null,
): string | null {
  if (!input || !analysis) return null;
  const days = daysUntilNextSalary(input.salaryDate);
  if (days !== null && days <= 7) return `Salary arrives in ${days} day${days === 1 ? "" : "s"}. Tighten discretionary spend this week.`;
  if (analysis.monthlySurplus < 0) return `Expenses exceed salary by ₹${Math.abs(Math.round(analysis.monthlySurplus)).toLocaleString("en-IN")}. Trim your biggest category first.`;
  if (analysis.savingsRate >= 25) return `Your savings rate is excellent at ${Math.round(analysis.savingsRate)}%. Keep the momentum.`;
  const top = analysis.breakdown[0];
  if (top && top.pct > 35) return `${top.label} is ${Math.round(top.pct)}% of your spend — a 10% trim frees ₹${Math.round(top.amount * 0.1).toLocaleString("en-IN")}/month.`;
  const dayOfWeek = new Date().getDay();
  if (dayOfWeek === 5 || dayOfWeek === 6) return `Weekend spending can quickly overshoot budget — set a cap before you head out.`;
  return `You're below your monthly spending limit — a good time to boost savings.`;
}
