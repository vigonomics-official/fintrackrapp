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

export type RiskLevel = "Low" | "Medium" | "High";

export type RiskItem = {
  key: "cashflow" | "emergency" | "overspending" | "emi";
  label: string;
  level: RiskLevel;
  explanation: string;
};

export type Priority = {
  title: string;
  detail: string;
};

export type Opportunity = {
  title: string;
  detail: string;
  potentialSavings: number;
  timeframe: "month" | "year";
};

export type GoalForecast = {
  goal: string;
  monthlyTarget: number;
  targetAmount: number;
  etaMonths: number;
  estimatedCompletion: string; // ISO date
  confidence: number; // 0-100
  note: string;
};

export type WeeklyPlanDay = { day: string; task: string };

export type MonthlyChallenge = {
  title: string;
  description: string;
  potentialSavings: number;
};

export type CoachAnalysisResult = {
  healthScore: number;
  totalExpenses: number;
  monthlySurplus: number;
  savingsRate: number;
  emiRatio: number;
  breakdown: { label: string; amount: number; pct: number }[];
  summary: string;
  priorities: Priority[];
  risks: RiskItem[];
  opportunity: Opportunity;
  goalForecast: GoalForecast;
  weeklyPlan: WeeklyPlanDay[];
  monthlyChallenge: MonthlyChallenge;
  motivation: string;
  // legacy fields kept so any older consumer keeps compiling
  highlights: string[];
  recommendations: string[];
  goalPlan: { title: string; monthlyTarget: number; etaMonths: number; note: string };
};

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
const round = (n: number) => Math.round(n);

function riskFrom(score: number): RiskLevel {
  if (score >= 66) return "High";
  if (score >= 33) return "Medium";
  return "Low";
}

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
    currentSavings,
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
  const foodRatio = monthlySalary > 0 ? (monthlyFood / monthlySalary) * 100 : 0;
  const transportRatio = monthlySalary > 0 ? (monthlyTransport / monthlySalary) * 100 : 0;

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
  const healthScore = clamp(round(50 + buffer * 0.4 + emiScore * 0.6), 0, 100);

  // ---------- Summary ----------
  const topCat = breakdown[0];
  const summaryBits: string[] = [];
  if (monthlySurplus > 0 && savingsRate >= 20) {
    summaryBits.push(`You're managing your salary well with a savings rate of ${round(savingsRate)}%.`);
  } else if (monthlySurplus > 0) {
    summaryBits.push(`You have a small monthly surplus, but your savings rate of ${round(savingsRate)}% is on the lower side.`);
  } else {
    summaryBits.push("Your monthly expenses are exceeding your salary — cash flow needs attention.");
  }
  if (topCat && topCat.pct > 30) summaryBits.push(`${topCat.label} is your largest outflow at ${round(topCat.pct)}% of spending.`);
  if (monthlyInvestments > 0) summaryBits.push("Your consistent investing habit is compounding in your favour.");
  summaryBits.push(
    monthlySurplus > 0
      ? `You are on track to reach your ${financialGoal} goal if you maintain this pace.`
      : `Reaching your ${financialGoal} goal will require freeing up cash flow first.`,
  );
  const summary = summaryBits.join(" ");

  // ---------- Priorities ----------
  const priorities: Priority[] = [];
  if (foodRatio > 15 && monthlyFood > 0) {
    const cut = Math.max(300, round(monthlyFood * 0.1 / 100) * 100);
    priorities.push({ title: `Reduce food spending by ~${cut}/month`, detail: "Plan a weekly grocery list and cap food delivery to twice a week." });
  }
  if (currentSavings < totalExpenses * 3) {
    const bump = Math.max(500, round(monthlySalary * 0.02 / 100) * 100);
    priorities.push({ title: `Increase emergency savings by ${bump}/month`, detail: "Auto-transfer on salary day so it happens before spending." });
  }
  if (emiRatio >= 30) {
    priorities.push({ title: "Prepay your highest-interest loan", detail: `EMIs are ${round(emiRatio)}% of salary — chip away with any surplus.` });
  }
  if (monthlyInvestments === 0 && monthlySurplus > 0) {
    priorities.push({ title: "Start a small monthly SIP", detail: "Even 5% of your salary builds long-term wealth." });
  } else if (monthlyInvestments > 0) {
    priorities.push({ title: "Continue your current investment habit", detail: `You're investing ${round((monthlyInvestments / Math.max(monthlySalary, 1)) * 100)}% each month — keep it steady.` });
  }
  if (transportRatio > 12) {
    priorities.push({ title: "Trim transport costs", detail: "Try pooling or a monthly pass to shave a few hundred off every month." });
  }
  if (priorities.length === 0) {
    priorities.push({ title: "Maintain your current rhythm", detail: "Your plan is balanced — focus on staying consistent." });
  }
  const topPriorities = priorities.slice(0, 3);

  // ---------- Risks ----------
  const cashflowScore = monthlySurplus < 0 ? 90 : savingsRate < 10 ? 55 : 15;
  const emergencyMonths = totalExpenses > 0 ? currentSavings / totalExpenses : 0;
  const emergencyScore = emergencyMonths >= 6 ? 10 : emergencyMonths >= 3 ? 40 : 80;
  const overspendingScore = topCat && topCat.pct > 45 ? 75 : topCat && topCat.pct > 35 ? 45 : 15;
  const emiScoreRisk = emiRatio >= 40 ? 85 : emiRatio >= 25 ? 50 : 15;

  const risks: RiskItem[] = [
    {
      key: "cashflow",
      label: "Cash Flow Risk",
      level: riskFrom(cashflowScore),
      explanation:
        monthlySurplus < 0
          ? "Expenses exceed salary — you're leaking money each month."
          : savingsRate < 10
            ? "Very little buffer between income and spending."
            : "Healthy gap between salary and expenses.",
    },
    {
      key: "emergency",
      label: "Emergency Fund Risk",
      level: riskFrom(emergencyScore),
      explanation:
        emergencyMonths >= 6
          ? `You have ~${emergencyMonths.toFixed(1)} months of expenses saved.`
          : `You have only ~${emergencyMonths.toFixed(1)} months of expenses saved — aim for 6.`,
    },
    {
      key: "overspending",
      label: "Overspending Risk",
      level: riskFrom(overspendingScore),
      explanation: topCat
        ? `${topCat.label} takes ${round(topCat.pct)}% of your spend.`
        : "Spending is well distributed across categories.",
    },
    {
      key: "emi",
      label: "EMI Risk",
      level: riskFrom(emiScoreRisk),
      explanation:
        monthlyEmi === 0
          ? "You have no active EMIs — full flexibility."
          : `EMIs consume ${round(emiRatio)}% of salary.`,
    },
  ];

  // ---------- Opportunity ----------
  let opportunity: Opportunity;
  if (transportRatio > 8 && monthlyTransport > 0) {
    const monthly = round(monthlyTransport * 0.1);
    opportunity = {
      title: "Cut transport by 10%",
      detail: `Trimming transport by 10% frees up ${monthly}/month.`,
      potentialSavings: monthly * 12,
      timeframe: "year",
    };
  } else if (foodRatio > 15 && monthlyFood > 0) {
    const monthly = round(monthlyFood * 0.1);
    opportunity = {
      title: "Cook one extra meal at home per week",
      detail: `Reducing food spend by 10% saves ${monthly}/month.`,
      potentialSavings: monthly * 12,
      timeframe: "year",
    };
  } else if (monthlyBills > 0) {
    const monthly = round(monthlyBills * 0.1);
    opportunity = {
      title: "Audit your subscriptions",
      detail: `Cutting 10% off bills recovers ${monthly}/month.`,
      potentialSavings: monthly * 12,
      timeframe: "year",
    };
  } else {
    const monthly = Math.max(500, round(monthlySalary * 0.02));
    opportunity = {
      title: "Redirect a small slice to investing",
      detail: `Moving ${monthly}/month into a SIP compounds strongly over time.`,
      potentialSavings: monthly * 12,
      timeframe: "year",
    };
  }

  // ---------- Goal forecast ----------
  const goalTargets: Record<FinancialGoal, number> = {
    "Emergency Fund": Math.max(totalExpenses * 6, 30_000),
    "Gold Savings": 100_000,
    Bike: 150_000,
    House: 2_000_000,
    Vacation: 80_000,
    "Custom Goal": 50_000,
  };
  const target = goalTargets[financialGoal];
  const monthlyTarget = Math.max(500, round(Math.max(monthlySurplus, monthlySalary * 0.1) * 0.6));
  const etaMonths = monthlyTarget > 0 ? Math.ceil(target / monthlyTarget) : 0;
  const completion = new Date();
  completion.setMonth(completion.getMonth() + etaMonths);
  const confidence = clamp(
    round(45 + savingsRate * 0.8 - Math.max(0, emiRatio - 20) * 0.6 + (monthlyInvestments > 0 ? 8 : 0)),
    10,
    95,
  );

  const goalForecast: GoalForecast = {
    goal: financialGoal,
    monthlyTarget,
    targetAmount: target,
    etaMonths,
    estimatedCompletion: completion.toISOString(),
    confidence,
    note:
      monthlySurplus <= 0
        ? "Free up cash flow before committing to this goal."
        : `Set aside ${monthlyTarget}/month to reach it in about ${etaMonths} months.`,
  };

  // ---------- Weekly plan ----------
  const weeklyPlan: WeeklyPlanDay[] = [
    { day: "Monday", task: "Review last week's spending in FinTrackr for 5 minutes." },
    { day: "Tuesday", task: "Move surplus cash to savings or investment account." },
    { day: "Wednesday", task: "Pack lunch or cook at home to cut food delivery." },
    { day: "Thursday", task: "Check one recurring bill or subscription you can cancel." },
    { day: "Friday", task: "Set a weekend spending cap before it starts." },
    { day: "Weekend", task: "Plan next week's groceries and log any pending expenses." },
  ];

  // ---------- Monthly challenge ----------
  let monthlyChallenge: MonthlyChallenge;
  if (foodRatio > 12 && monthlyFood > 0) {
    monthlyChallenge = {
      title: "No Food Delivery Week",
      description: "Skip food delivery for one week and cook or eat in.",
      potentialSavings: Math.max(300, round(monthlyFood * 0.15)),
    };
  } else if (transportRatio > 8) {
    monthlyChallenge = {
      title: "Two-Wheel Week",
      description: "Walk, cycle or pool for one week to slash transport spend.",
      potentialSavings: Math.max(300, round(monthlyTransport * 0.2)),
    };
  } else {
    monthlyChallenge = {
      title: "No-Spend Weekend",
      description: "Pick one weekend this month with zero discretionary spending.",
      potentialSavings: Math.max(500, round(monthlySalary * 0.02)),
    };
  }

  // ---------- Motivation ----------
  const motivation =
    healthScore >= 70
      ? "You're closer to financial freedom than you think. Stay consistent."
      : healthScore >= 40
        ? "Small steady moves are compounding — trust the process and keep going."
        : "Every rupee you redirect today buys back tomorrow. You've got this.";

  // Legacy fields
  const highlights = priorities.slice(0, 2).map((p) => p.title);
  const recommendations = priorities.map((p) => p.title);

  return {
    healthScore,
    totalExpenses,
    monthlySurplus,
    savingsRate,
    emiRatio,
    breakdown,
    summary,
    priorities: topPriorities,
    risks,
    opportunity,
    goalForecast,
    weeklyPlan,
    monthlyChallenge,
    motivation,
    highlights,
    recommendations,
    goalPlan: {
      title: financialGoal,
      monthlyTarget,
      etaMonths,
      note: goalForecast.note,
    },
  };
}
