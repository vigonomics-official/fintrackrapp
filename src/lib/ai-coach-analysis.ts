// Shared types + mock analyzer for the AI Salary Survival Coach.
// Kept provider-agnostic so a Gemini call can slot in later without UI changes.

export const FINANCIAL_GOALS = [
  "Emergency Fund",
  "Gold Savings",
  "Bike",
  "House",
  "Vacation",
  "Custom Goal",
] as const;

export type FinancialGoal = (typeof FINANCIAL_GOALS)[number];

export type CoachAnalysisInput = {
  monthlySalary: number;
  salaryDate: string;
  currentAccountBalance: number;
  monthlyRent: number;
  monthlyFood: number;
  monthlyTransport: number;
  monthlyEmi: number;
  monthlyBills: number;
  monthlyInvestments: number;
  currentSavings: number;
  otherMonthlyExpenses: number;
  financialGoal: FinancialGoal;
  customGoalNote?: string;
};

export type CoachAnalysisResult = {
  healthScore: number;
  totalExpenses: number;
  monthlySurplus: number;
  savingsRate: number;
  emiRatio: number;
  breakdown: { label: string; amount: number; pct: number }[];
  highlights: string[];
  risks: string[];
  recommendations: string[];
  goalPlan: { title: string; monthlyTarget: number; etaMonths: number; note: string };
};

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

export function analyzeMock(input: CoachAnalysisInput): CoachAnalysisResult {
  const {
    monthlySalary,
    monthlyRent,
    monthlyFood,
    monthlyTransport,
    monthlyEmi,
    monthlyBills,
    monthlyInvestments,
    otherMonthlyExpenses,
    financialGoal,
  } = input;

  const totalExpenses =
    monthlyRent +
    monthlyFood +
    monthlyTransport +
    monthlyEmi +
    monthlyBills +
    monthlyInvestments +
    otherMonthlyExpenses;

  const monthlySurplus = monthlySalary - totalExpenses;
  const savingsRate = monthlySalary > 0 ? (monthlySurplus / monthlySalary) * 100 : 0;
  const emiRatio = monthlySalary > 0 ? (monthlyEmi / monthlySalary) * 100 : 0;

  const parts: [string, number][] = [
    ["Rent", monthlyRent],
    ["Food", monthlyFood],
    ["Transport", monthlyTransport],
    ["EMI", monthlyEmi],
    ["Bills", monthlyBills],
    ["Investments", monthlyInvestments],
    ["Other", otherMonthlyExpenses],
  ];
  const breakdown = parts
    .filter(([, v]) => v > 0)
    .map(([label, amount]) => ({
      label,
      amount,
      pct: totalExpenses > 0 ? (amount / totalExpenses) * 100 : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  const buffer = clamp(savingsRate, -50, 50);
  const emiScore = clamp(30 - emiRatio * 0.5, 0, 30);
  const healthScore = clamp(Math.round(50 + buffer * 0.4 + emiScore * 0.6), 0, 100);

  const highlights: string[] = [];
  const risks: string[] = [];
  const recommendations: string[] = [];

  if (savingsRate >= 20) highlights.push(`You're saving ${savingsRate.toFixed(0)}% of your salary — great pace.`);
  else if (savingsRate > 0) highlights.push(`You have a small monthly surplus of ${Math.round(monthlySurplus)}.`);
  if (emiRatio < 20 && monthlyEmi > 0) highlights.push("EMI load is well under control.");
  if (monthlyInvestments > 0) highlights.push("You're investing consistently every month.");

  if (monthlySurplus < 0) risks.push("Your monthly expenses exceed your salary.");
  if (emiRatio >= 40) risks.push(`EMIs consume ${emiRatio.toFixed(0)}% of salary — high stress zone.`);
  if (savingsRate < 10 && monthlySurplus >= 0) risks.push("Savings rate is below 10% — vulnerable to shocks.");
  const topCat = breakdown[0];
  if (topCat && topCat.pct > 40) risks.push(`${topCat.label} alone is ${topCat.pct.toFixed(0)}% of your outflow.`);

  if (savingsRate < 20) recommendations.push("Aim to save at least 20% of monthly salary.");
  if (emiRatio >= 30) recommendations.push("Prioritise closing your highest-interest loan first.");
  if (monthlyInvestments === 0) recommendations.push("Start a small monthly SIP — even 5% of salary compounds.");
  if (topCat && topCat.label === "Food" && topCat.pct > 25) recommendations.push("Trim food spend with a weekly grocery plan.");
  if (recommendations.length === 0) recommendations.push("Keep going — your plan looks balanced.");

  // Goal plan (mock heuristic)
  const goalTargets: Record<FinancialGoal, number> = {
    "Emergency Fund": totalExpenses * 6,
    "Gold Savings": 100_000,
    Bike: 150_000,
    House: 2_000_000,
    Vacation: 80_000,
    "Custom Goal": 50_000,
  };
  const target = goalTargets[financialGoal];
  const monthlyTarget = Math.max(500, Math.round(Math.max(monthlySurplus, monthlySalary * 0.1) * 0.6));
  const etaMonths = monthlyTarget > 0 ? Math.ceil(target / monthlyTarget) : 0;

  return {
    healthScore,
    totalExpenses,
    monthlySurplus,
    savingsRate,
    emiRatio,
    breakdown,
    highlights,
    risks,
    recommendations,
    goalPlan: {
      title: financialGoal,
      monthlyTarget,
      etaMonths,
      note:
        monthlySurplus <= 0
          ? "Free up cash flow before committing to this goal."
          : `Set aside ${monthlyTarget} every month to reach it in about ${etaMonths} months.`,
    },
  };
}
