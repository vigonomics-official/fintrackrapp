// Provider-agnostic advice generator for the AI Salary Survival Coach.
// Produces the full Advice tab payload from an analysed CoachAnalysisInput.
// Kept isolated so a Gemini provider can slot in behind `generateAdvice`
// without touching the UI.

import {
  analyzeMock,
  type CoachAnalysisInput,
  type CoachAnalysisResult,
} from "@/lib/ai-coach-analysis";

export type Difficulty = "Easy" | "Medium" | "Hard";
export type Priority = "High" | "Medium" | "Low";

export type FeaturedAdvice = {
  id: string;
  icon: string;
  message: string;
  why: string;
  priority: Priority;
  estimatedSavings: number;
  estimatedTime: string;
  confidence: number; // 0-100
  dataUsed: string[];
};

export type Recommendation = {
  id: string;
  title: string;
  explanation: string;
  why: string;
  monthlySavings: number;
  difficulty: Difficulty;
  estimatedTime: string;
  priority: Priority;
  dataUsed: string[];
};

export type QuickWin = { id: string; text: string };
export type HabitNote = { id: string; text: string };

export type CoachAdvice = {
  featured: FeaturedAdvice;
  recommendations: Recommendation[]; // 5
  goodHabits: HabitNote[];
  improvements: HabitNote[];
  quickWins: QuickWin[];
  motivation: string;
};

const round = (n: number) => Math.round(n);
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

function pickDifficulty(monthlySavings: number, salary: number): Difficulty {
  const pct = salary > 0 ? (monthlySavings / salary) * 100 : 0;
  if (pct < 3) return "Easy";
  if (pct < 8) return "Medium";
  return "Hard";
}

function computeConfidence(input: CoachAnalysisInput, result: CoachAnalysisResult): number {
  // More filled fields + a healthier score → higher confidence in advice.
  const base = 55 + result.healthScore * 0.25;
  const salaryBoost = input.monthlySalary > 0 ? 8 : 0;
  const investBoost = input.monthlyInvestments > 0 ? 5 : 0;
  return clamp(round(base + salaryBoost + investBoost), 30, 95);
}

export function generateAdviceMock(input: CoachAnalysisInput): CoachAdvice {
  const result = analyzeMock(input);
  const {
    monthlySalary,
    monthlyFood,
    monthlyTransport,
    monthlyBills,
    monthlyInvestments,
    monthlyEmi,
    otherMonthlyExpenses,
    currentSavings,
  } = input;

  const totalExpenses = result.totalExpenses;
  const savingsRate = result.savingsRate;
  const foodRatio = monthlySalary > 0 ? (monthlyFood / monthlySalary) * 100 : 0;
  const transportRatio = monthlySalary > 0 ? (monthlyTransport / monthlySalary) * 100 : 0;
  const emergencyMonths = totalExpenses > 0 ? currentSavings / totalExpenses : 0;

  // ---------- Featured ----------
  let featured: FeaturedAdvice;
  if (foodRatio > 12 && monthlyFood > 0) {
    const save = Math.max(200, round(monthlyFood * 0.1));
    featured = {
      id: "featured-food",
      icon: "💡",
      message: `Skip food delivery twice this week to save approximately ₹${save}.`,
      priority: foodRatio > 20 ? "High" : "Medium",
      estimatedSavings: save,
      confidence: computeConfidence(input, result),
    };
  } else if (transportRatio > 8 && monthlyTransport > 0) {
    const save = Math.max(150, round(monthlyTransport * 0.15));
    featured = {
      id: "featured-transport",
      icon: "🚌",
      message: `Pool or use public transport this week to save around ₹${save}.`,
      priority: "Medium",
      estimatedSavings: save,
      confidence: computeConfidence(input, result),
    };
  } else if (result.monthlySurplus > 0 && monthlyInvestments === 0) {
    const save = Math.max(500, round(monthlySalary * 0.05));
    featured = {
      id: "featured-invest",
      icon: "📈",
      message: `Start a small SIP of ₹${save}/month — future you will thank you.`,
      priority: "High",
      estimatedSavings: save,
      confidence: computeConfidence(input, result),
    };
  } else {
    const save = Math.max(300, round(monthlySalary * 0.02));
    featured = {
      id: "featured-default",
      icon: "💡",
      message: `Trim one small recurring expense this week to save around ₹${save}.`,
      priority: "Low",
      estimatedSavings: save,
      confidence: computeConfidence(input, result),
    };
  }

  // ---------- Recommendations (5) ----------
  const pool: Recommendation[] = [];
  if (monthlyFood > 0) {
    const save = Math.max(300, round(monthlyFood * 0.12));
    pool.push({
      id: "rec-food",
      title: "Reduce food delivery",
      explanation: "Cook one extra meal at home per week and cap delivery to twice weekly.",
      monthlySavings: save,
      difficulty: pickDifficulty(save, monthlySalary),
    });
  }
  if (monthlyBills > 0) {
    const save = Math.max(150, round(monthlyBills * 0.1));
    pool.push({
      id: "rec-subs",
      title: "Audit subscriptions",
      explanation: "Cancel one streaming or app subscription you rarely use.",
      monthlySavings: save,
      difficulty: "Easy",
    });
  }
  if (monthlyTransport > 0) {
    const save = Math.max(200, round(monthlyTransport * 0.12));
    pool.push({
      id: "rec-transport",
      title: "Lower transport costs",
      explanation: "Try a monthly pass, carpool, or cycle two days a week.",
      monthlySavings: save,
      difficulty: pickDifficulty(save, monthlySalary),
    });
  }
  if (monthlyEmi > 0 && result.emiRatio >= 25) {
    const save = Math.max(500, round(monthlyEmi * 0.05));
    pool.push({
      id: "rec-emi",
      title: "Prepay highest-interest EMI",
      explanation: "Use any surplus to shave months off your most expensive loan.",
      monthlySavings: save,
      difficulty: "Hard",
    });
  }
  if (emergencyMonths < 6) {
    const save = Math.max(500, round(monthlySalary * 0.05));
    pool.push({
      id: "rec-emergency",
      title: "Build emergency buffer",
      explanation: "Auto-transfer a fixed amount on salary day before you spend.",
      monthlySavings: save,
      difficulty: "Medium",
    });
  }
  if (monthlyInvestments === 0 && result.monthlySurplus > 0) {
    const save = Math.max(500, round(monthlySalary * 0.05));
    pool.push({
      id: "rec-sip",
      title: "Start a monthly SIP",
      explanation: "Even 5% of your salary compounds strongly over years.",
      monthlySavings: save,
      difficulty: "Easy",
    });
  }
  if (otherMonthlyExpenses > monthlySalary * 0.1) {
    const save = Math.max(300, round(otherMonthlyExpenses * 0.15));
    pool.push({
      id: "rec-other",
      title: "Trim discretionary spending",
      explanation: "Set a weekly cap for impulse buys and review it every Sunday.",
      monthlySavings: save,
      difficulty: "Medium",
    });
  }
  // Always-available fallbacks so we can reach 5.
  pool.push({
    id: "rec-review",
    title: "Weekly 10-minute money review",
    explanation: "Skim last week's transactions to catch leaks early.",
    monthlySavings: Math.max(200, round(monthlySalary * 0.01)),
    difficulty: "Easy",
  });
  pool.push({
    id: "rec-cap",
    title: "Set a weekend spend cap",
    explanation: "Decide your Saturday-Sunday budget before Friday evening.",
    monthlySavings: Math.max(300, round(monthlySalary * 0.015)),
    difficulty: "Easy",
  });

  const recommendations = pool.slice(0, 5);

  // ---------- Good habits ----------
  const goodHabits: HabitNote[] = [];
  if (monthlyInvestments > 0) goodHabits.push({ id: "h-invest", text: "You invested this month — great long-term habit." });
  if (savingsRate >= 20) goodHabits.push({ id: "h-save", text: "You maintained a healthy savings rate." });
  if (transportRatio <= 8 && monthlyTransport > 0) goodHabits.push({ id: "h-transport", text: "You stayed within your transport budget." });
  if (monthlyEmi === 0) goodHabits.push({ id: "h-noemi", text: "You're EMI-free — full financial flexibility." });
  if (goodHabits.length === 0) goodHabits.push({ id: "h-track", text: "You're tracking your money — that's already a win." });

  // ---------- Things to improve ----------
  const improvements: HabitNote[] = [];
  if (foodRatio > 15) improvements.push({ id: "i-food", text: "Food spending is high compared to your salary." });
  if (transportRatio > 12) improvements.push({ id: "i-transport", text: "Transport spending is above the healthy range." });
  if (savingsRate < 15) improvements.push({ id: "i-save", text: "Savings rate is below the recommended 15–20% target." });
  if (emergencyMonths < 3) improvements.push({ id: "i-emergency", text: "Emergency fund covers less than 3 months of expenses." });
  if (result.emiRatio >= 40) improvements.push({ id: "i-emi", text: "EMIs are eating a large share of your salary." });
  if (improvements.length === 0) improvements.push({ id: "i-none", text: "Nothing urgent — keep an eye on lifestyle inflation." });

  // ---------- Quick wins ----------
  const quickWins: QuickWin[] = [
    { id: "q-lunch", text: "Pack lunch tomorrow." },
    { id: "q-delay", text: "Delay any non-essential shopping by 48 hours." },
    { id: "q-subs", text: "Review your subscriptions today." },
    { id: "q-upi", text: "Limit UPI impulse purchases this evening." },
  ];

  // ---------- Motivation ----------
  const target = Math.max(500, round(monthlySalary * 0.2));
  const gap = Math.max(0, target - Math.max(0, result.monthlySurplus));
  const motivation =
    gap > 0
      ? `You're only ₹${gap} away from reaching this month's savings target.`
      : result.healthScore >= 70
        ? "You're closer to financial freedom than you think. Stay consistent."
        : "Small steady moves are compounding — trust the process.";

  return { featured, recommendations, goodHabits, improvements, quickWins, motivation };
}

// Storage keys for locally-persisted user actions on advice cards.
export const COACH_ADVICE_SAVED_KEY = "fintrackr:ai-coach:advice-saved";
export const COACH_ADVICE_DISMISSED_KEY = "fintrackr:ai-coach:advice-dismissed";
