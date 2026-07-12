// Monthly Plan generator for the AI Salary Survival Coach.
// Pure business logic, provider-agnostic — the UI never computes anything here.
// A Gemini provider can replace `generatePlanMock` without touching the tab.

import {
  analyzeMock,
  type CoachAnalysisInput,
  type CoachAnalysisResult,
} from "@/lib/ai-coach-analysis";

export type BillStatus = "Upcoming" | "Due Today" | "Paid";
export type ActionPriority = "High" | "Medium" | "Low";
export type ActionDifficulty = "Easy" | "Medium" | "Hard";
export type RiskLevelLite = "Low" | "Medium" | "High";

export type PlanSummary = {
  safeDailySpend: number;
  monthlySavingsTarget: number;
  expectedMonthEndBalance: number;
  survivalScore: number;
};

export type AllocationSlice = {
  key: "needs" | "savings" | "investments" | "lifestyle";
  label: string;
  amount: number;
  pct: number;
  tone: string;
};

export type WeeklyLimit = {
  week: number;
  label: string;
  range: string;
  limit: number;
};

export type BillItem = {
  id: string;
  name: string;
  amount: number;
  dueDate: string;
  dueLabel: string;
  status: BillStatus;
};

export type GoalProgress = {
  goal: string;
  target: number;
  current: number;
  monthlyTarget: number;
  estimatedCompletion: string;
  etaMonths: number;
  progressPct: number;
  daysRemaining: number;
  aheadOfSchedule: boolean;
  motivation: string;
};

export type DataUsedField =
  | "Salary"
  | "Current Balance"
  | "Monthly Spending"
  | "Investments"
  | "Bills"
  | "EMI"
  | "Food"
  | "Transport"
  | "Other Expenses"
  | "Savings"
  | "Goal"
  | "Previous Transactions";

export type TopAction = {
  id: string;
  title: string;
  detail: string;
  reason: string;
  whyMatters: string[];
  dataUsed: DataUsedField[];
  estimatedTime: string;
  priority: ActionPriority;
  monthlySavings: number;
  scoreBoost: number;
  difficulty: ActionDifficulty;
};

export type DailySummary = {
  spendingStatus: string;
  expectedMonthEndSavings: number;
  riskLevel: RiskLevelLite;
  goalStatus: "On Track" | "Behind" | "Ahead" | "At Risk";
  confidence: number;
};

export type WeeklyChallenge = {
  id: string;
  title: string;
  description: string;
  reward: string;
};

export type Achievement = {
  id: string;
  emoji: string;
  title: string;
};

export type MonthlyPlan = {
  summary: PlanSummary;
  daily: DailySummary;
  allocation: AllocationSlice[];
  weeklyLimits: WeeklyLimit[];
  bills: BillItem[];
  goal: GoalProgress;
  actions: TopAction[];
  challenges: WeeklyChallenge[];
  achievements: Achievement[];
  monthLabel: string;
  generatedAt: string;
};

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const MONTHS_LONG = ["January","February","March","April","May","June","July","August","September","October","November","December"];

const round = (n: number) => Math.round(n);
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

function parseDate(s: string): Date {
  const d = new Date(s);
  return isNaN(d.getTime()) ? new Date() : d;
}

function fmtDay(d: Date): string {
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

function daysInMonth(y: number, m: number): number {
  return new Date(y, m + 1, 0).getDate();
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function billStatus(due: Date, today: Date): BillStatus {
  const t = new Date(today); t.setHours(0, 0, 0, 0);
  if (sameDay(due, today)) return "Due Today";
  if (due.getTime() < t.getTime()) return "Paid";
  return "Upcoming";
}

// -------- Bills paid persistence --------
export const BILLS_PAID_KEY = "fintrackr:ai-coach:paid-bills";

function readPaidIds(): Set<string> {
  try {
    const raw = localStorage.getItem(BILLS_PAID_KEY);
    return new Set<string>(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}
function writePaidIds(ids: Set<string>) {
  try { localStorage.setItem(BILLS_PAID_KEY, JSON.stringify([...ids])); } catch { /* ignore */ }
}
export function markBillPaid(id: string) {
  const ids = readPaidIds(); ids.add(id); writePaidIds(ids);
}
export function unmarkBillPaid(id: string) {
  const ids = readPaidIds(); ids.delete(id); writePaidIds(ids);
}
export function getPaidBills(): Set<string> { return readPaidIds(); }

// -------- core generator --------
export function generatePlanMock(
  input: CoachAnalysisInput,
  analysis?: CoachAnalysisResult,
): MonthlyPlan {
  const a = analysis ?? analyzeMock(input);
  const salary = Math.max(0, input.monthlySalary);

  // Cycle math
  const today = new Date();
  const salaryDate = parseDate(input.salaryDate);
  const cycleStart = new Date(salaryDate);
  const cycleEnd = new Date(cycleStart);
  cycleEnd.setMonth(cycleEnd.getMonth() + 1);
  const totalDays = Math.max(1, Math.round((cycleEnd.getTime() - cycleStart.getTime()) / 86_400_000));
  const daysRemaining = Math.max(1, Math.round((cycleEnd.getTime() - today.getTime()) / 86_400_000));

  const disposable = Math.max(0, input.currentAccountBalance - (a.totalExpenses - (a.totalExpenses * (totalDays - daysRemaining) / totalDays)));
  const safeDailySpend = round(Math.max(0, disposable / daysRemaining));
  const monthlySavingsTarget = round(Math.max(0, a.monthlySurplus > 0 ? a.monthlySurplus * 0.7 : salary * 0.1));
  const expectedMonthEndBalance = round(input.currentAccountBalance + a.monthlySurplus - a.totalExpenses * (daysRemaining / totalDays));

  const summary: PlanSummary = {
    safeDailySpend,
    monthlySavingsTarget,
    expectedMonthEndBalance,
    survivalScore: a.healthScore,
  };

  // Allocation
  const needs = input.monthlyRent + input.monthlyBills + input.monthlyEmi + input.monthlyFood + input.monthlyTransport;
  const savings = Math.max(0, monthlySavingsTarget);
  const investments = Math.max(0, input.monthlyInvestments || round(salary * 0.1));
  const lifestyle = Math.max(0, salary - needs - savings - investments);
  const total = Math.max(1, needs + savings + investments + lifestyle);
  const allocation: AllocationSlice[] = [
    { key: "needs", label: "Needs", amount: round(needs), pct: round((needs / total) * 100), tone: "bg-primary" },
    { key: "savings", label: "Savings", amount: round(savings), pct: round((savings / total) * 100), tone: "bg-success" },
    { key: "investments", label: "Investments", amount: round(investments), pct: round((investments / total) * 100), tone: "bg-gold" },
    { key: "lifestyle", label: "Lifestyle", amount: round(lifestyle), pct: round((lifestyle / total) * 100), tone: "bg-muted-foreground/60" },
  ];

  // Weekly limits
  const variablePool = Math.max(0, input.monthlyFood + input.monthlyTransport + lifestyle + input.otherMonthlyExpenses);
  const y = cycleStart.getFullYear();
  const m = cycleStart.getMonth();
  const dim = daysInMonth(y, m);
  const weekBase = variablePool / 4;
  const weights = [1.1, 1.05, 0.95, 0.9];
  const weeklyLimits: WeeklyLimit[] = [1, 2, 3, 4].map((w, i) => {
    const startDay = (w - 1) * 7 + 1;
    const endDay = w === 4 ? dim : w * 7;
    const startD = new Date(y, m, Math.min(startDay, dim));
    const endD = new Date(y, m, Math.min(endDay, dim));
    return {
      week: w,
      label: `Week ${w}`,
      range: `${startD.getDate()}–${endD.getDate()} ${MONTHS[m]}`,
      limit: round(weekBase * weights[i]),
    };
  });

  // Bills
  const salaryDay = salaryDate.getDate();
  const paidIds = readPaidIds();
  const bills: BillItem[] = [];
  const push = (name: string, amount: number, offsetDays: number) => {
    if (amount <= 0) return;
    const d = new Date(y, m, clamp(salaryDay + offsetDays, 1, dim));
    const id = `${name.toLowerCase().replace(/\s+/g, "-")}-${d.toISOString().slice(0, 10)}`;
    const status = paidIds.has(id) ? "Paid" : billStatus(new Date(d), new Date());
    bills.push({ id, name, amount: round(amount), dueDate: d.toISOString(), dueLabel: fmtDay(d), status });
  };
  push("Rent", input.monthlyRent, 0);
  push("Bills & Utilities", input.monthlyBills, 5);
  push("EMI", input.monthlyEmi, 10);
  push("Investments / SIP", input.monthlyInvestments, 2);
  bills.sort((x, z) => x.dueDate.localeCompare(z.dueDate));

  // Goal progress
  const gf = a.goalForecast;
  const progressPct = clamp(round((input.currentSavings / Math.max(1, gf.targetAmount)) * 100), 0, 100);
  const completionDate = parseDate(gf.estimatedCompletion);
  const goalDaysRemaining = Math.max(0, Math.round((completionDate.getTime() - today.getTime()) / 86_400_000));
  // "Expected pct by now" heuristic — linear over etaMonths from a start of 0.
  const totalEtaDays = Math.max(1, gf.etaMonths * 30);
  const elapsedDays = Math.max(0, totalEtaDays - goalDaysRemaining);
  const expectedPct = clamp(round((elapsedDays / totalEtaDays) * 100), 0, 100);
  const aheadOfSchedule = progressPct >= expectedPct;
  const gap = expectedPct - progressPct;
  const motivation = aheadOfSchedule
    ? "You're ahead of schedule. Keep the momentum."
    : gap > 20
      ? `Increase savings by ₹${Math.max(300, round(gf.monthlyTarget * 0.2))}/month to stay on target.`
      : "You're close to on track — a small nudge this month gets you there.";

  const goal: GoalProgress = {
    goal: gf.goal,
    target: gf.targetAmount,
    current: Math.max(0, input.currentSavings),
    monthlyTarget: gf.monthlyTarget,
    estimatedCompletion: gf.estimatedCompletion,
    etaMonths: gf.etaMonths,
    progressPct,
    daysRemaining: goalDaysRemaining,
    aheadOfSchedule,
    motivation,
  };

  // Actions
  const actions = buildActions(input, a);

  // Daily summary
  const paidExpenseTotal = Array.from(paidIds).reduce((sum, id) => {
    const b = bills.find((x) => x.id === id);
    return sum + (b ? b.amount : 0);
  }, 0);
  const spendingStatus =
    a.monthlySurplus < 0
      ? "You're spending above your salary this month — tighten discretionary spend."
      : safeDailySpend > 0
        ? "You are safely within your spending limit."
        : "Spend carefully — daily buffer is tight.";
  const riskLevel: RiskLevelLite = a.healthScore >= 70 ? "Low" : a.healthScore >= 40 ? "Medium" : "High";
  const goalStatus: DailySummary["goalStatus"] =
    a.monthlySurplus <= 0 ? "At Risk" : aheadOfSchedule ? "Ahead" : gap > 15 ? "Behind" : "On Track";
  const daily: DailySummary = {
    spendingStatus,
    expectedMonthEndSavings: Math.max(0, round(a.monthlySurplus + paidExpenseTotal * 0)),
    riskLevel,
    goalStatus,
    confidence: gf.confidence,
  };

  // Challenges (up to 4 weekly)
  const challenges: WeeklyChallenge[] = [
    {
      id: "no-delivery",
      title: "No Food Delivery Week",
      description: "Skip food delivery for 7 days and cook or eat in.",
      reward: `Save ₹${Math.max(300, round(input.monthlyFood * 0.15))}`,
    },
    {
      id: "no-spend-weekend",
      title: "No-Spend Weekend",
      description: "One weekend with zero discretionary spending.",
      reward: `Save ₹${Math.max(500, round(salary * 0.02))}`,
    },
    {
      id: "review-subs",
      title: "Subscription Audit",
      description: "Cancel one unused subscription this week.",
      reward: `Save ₹${Math.max(200, round(input.monthlyBills * 0.1))}/mo`,
    },
    {
      id: "two-wheel",
      title: "Two-Wheel Week",
      description: "Walk, cycle or pool for one week.",
      reward: `Save ₹${Math.max(300, round(input.monthlyTransport * 0.2))}`,
    },
  ];

  // Achievements — up to 3
  const allAchievements: Achievement[] = [];
  if (a.monthlySurplus > 0) allAchievements.push({ id: "under-budget", emoji: "🏆", title: "Stayed under budget" });
  if (input.monthlyInvestments > 0) allAchievements.push({ id: "invest-streak", emoji: "🏆", title: "Investment Streak" });
  if (input.monthlyEmi === 0) allAchievements.push({ id: "no-emi", emoji: "🏆", title: "No EMI this month" });
  if (a.savingsRate >= 20) allAchievements.push({ id: "budget-champ", emoji: "🏆", title: "Budget Champion" });
  const achievements = allAchievements.slice(0, 3);

  return {
    summary,
    daily,
    allocation,
    weeklyLimits,
    bills,
    goal,
    actions,
    challenges,
    achievements,
    monthLabel: `${MONTHS_LONG[m]} Transactions`,
    generatedAt: new Date().toISOString(),
  };
}

function buildActions(input: CoachAnalysisInput, a: CoachAnalysisResult): TopAction[] {
  const salary = Math.max(1, input.monthlySalary);
  const list: TopAction[] = [];
  const foodPct = Math.round((input.monthlyFood / salary) * 100);
  const emiPct = Math.round((input.monthlyEmi / salary) * 100);
  const otherPct = Math.round((input.otherMonthlyExpenses / salary) * 100);

  if (input.monthlyFood / salary > 0.15) {
    list.push({
      id: "cut-food",
      title: "Reduce food delivery this week",
      detail: "Cap delivery to twice a week and cook the rest.",
      reason: `Food is ${foodPct}% of your salary — above the 15% healthy cap.`,
      whyMatters: [
        `Food spending is ${foodPct}% of your salary vs a 15% healthy cap.`,
        "Cutting this frees cash for savings and your goal.",
        "Delivery is the easiest lever to pull this week.",
      ],
      dataUsed: ["Salary", "Food", "Monthly Spending"],
      estimatedTime: "This week",
      priority: "High",
      monthlySavings: Math.max(300, Math.round(input.monthlyFood * 0.15)),
      scoreBoost: 6,
      difficulty: "Easy",
    });
  }
  if (input.otherMonthlyExpenses / salary > 0.08) {
    list.push({
      id: "skip-shopping",
      title: "Skip unnecessary shopping",
      detail: "Delay non-essentials until after the salary date.",
      reason: "Discretionary spending is trending above a healthy share of income.",
      whyMatters: [
        `Other spending is ${otherPct}% of your salary — above the 8% cap.`,
        "A 48-hour delay filters most impulse buys.",
      ],
      dataUsed: ["Salary", "Other Expenses", "Current Balance"],
      estimatedTime: "This week",
      priority: "Medium",
      monthlySavings: Math.max(300, Math.round(input.otherMonthlyExpenses * 0.2)),
      scoreBoost: 4,
      difficulty: "Easy",
    });
  }
  if (a.monthlySurplus > 0) {
    list.push({
      id: "bump-sip",
      title: "Increase SIP by ₹500 next month",
      detail: "Automate the bump the day after your salary lands.",
      reason: "You have monthly surplus — compound it before it leaks.",
      whyMatters: [
        `You end the month with about ${formatShort(a.monthlySurplus)} surplus.`,
        "Automated SIP bumps compound quietly over years.",
      ],
      dataUsed: ["Salary", "Investments", "Monthly Spending", "Goal"],
      estimatedTime: "Next month",
      priority: "Medium",
      monthlySavings: 500,
      scoreBoost: 3,
      difficulty: "Easy",
    });
  }
  if (input.monthlyBills > 0) {
    list.push({
      id: "audit-subs",
      title: "Review subscriptions on Sunday",
      detail: "Cancel anything unused in the last 30 days.",
      reason: "Subscriptions quietly compound — a 10-minute audit usually finds one.",
      whyMatters: [
        "Bills include recurring subscriptions that renew silently.",
        "One cancellation typically saves 10% of monthly bills.",
      ],
      dataUsed: ["Bills", "Previous Transactions"],
      estimatedTime: "10 minutes this week",
      priority: "Low",
      monthlySavings: Math.max(200, Math.round(input.monthlyBills * 0.1)),
      scoreBoost: 2,
      difficulty: "Easy",
    });
  }
  list.push({
    id: "maintain-emergency",
    title: "Maintain emergency savings",
    detail: "Keep at least 3 months of expenses parked liquid.",
    reason: "Buffers protect your score when the unexpected hits.",
    whyMatters: [
      "Your emergency buffer directly drives your survival score.",
      "Auto-transfer on salary day makes it effortless.",
    ],
    dataUsed: ["Salary", "Savings", "Monthly Spending"],
    estimatedTime: "Ongoing",
    priority: a.risks.find((r) => r.key === "emergency")?.level === "High" ? "High" : "Medium",
    monthlySavings: Math.max(500, Math.round(salary * 0.05)),
    scoreBoost: 5,
    difficulty: "Medium",
  });

  if (input.monthlyEmi / salary >= 0.3) {
    list.unshift({
      id: "prepay-emi",
      title: "Prepay the highest-interest EMI",
      detail: "EMIs are eating a big chunk — pay down the priciest one.",
      reason: `EMIs are ${emiPct}% of your salary.`,
      whyMatters: [
        `EMIs are ${emiPct}% of your salary — above the 30% risk line.`,
        "Prepaying the priciest loan first cuts total interest fastest.",
      ],
      dataUsed: ["Salary", "EMI", "Current Balance"],
      estimatedTime: "This month",
      priority: "High",
      monthlySavings: Math.max(500, Math.round(input.monthlyEmi * 0.05)),
      scoreBoost: 8,
      difficulty: "Hard",
    });
  }

  const filler: TopAction[] = [
    {
      id: "weekly-review",
      title: "Do a 10-minute weekly money review",
      detail: "Every Sunday, review last week's spending in FinTrackr.",
      reason: "Small habits compound faster than big overhauls.",
      whyMatters: ["Weekly reviews catch leaks before they grow."],
      dataUsed: ["Previous Transactions", "Monthly Spending"],
      estimatedTime: "10 min / week",
      priority: "Low",
      monthlySavings: Math.max(300, Math.round(salary * 0.01)),
      scoreBoost: 2,
      difficulty: "Easy",
    },
    {
      id: "cash-only-weekends",
      title: "Cash-only weekends",
      detail: "Withdraw a weekend cap in cash to curb impulse buys.",
      reason: "Cash friction reduces small impulse purchases.",
      whyMatters: ["Cash creates friction that curbs impulse buys."],
      dataUsed: ["Salary", "Other Expenses"],
      estimatedTime: "This weekend",
      priority: "Low",
      monthlySavings: 500,
      scoreBoost: 2,
      difficulty: "Medium",
    },
  ];
  while (list.length < 5 && filler.length) list.push(filler.shift()!);

  // Dedupe by id and by title (case-insensitive), preserving order.
  const seenId = new Set<string>();
  const seenTitle = new Set<string>();
  const deduped: TopAction[] = [];
  for (const a of list) {
    const t = a.title.trim().toLowerCase();
    if (seenId.has(a.id) || seenTitle.has(t)) continue;
    seenId.add(a.id);
    seenTitle.add(t);
    deduped.push(a);
  }
  return deduped.slice(0, 5);
}

function formatShort(n: number): string {
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

// -------- Planner integration --------
export const PLANNER_QUEUE_KEY = "fintrackr:planner:pending-tasks";

export type PlannerQueueTask = {
  id: string;
  title: string;
  detail?: string;
  source: "ai-coach-plan";
  createdAt: string;
};

export function enqueuePlannerTask(task: Omit<PlannerQueueTask, "createdAt" | "source">): PlannerQueueTask {
  const entry: PlannerQueueTask = {
    ...task,
    source: "ai-coach-plan",
    createdAt: new Date().toISOString(),
  };
  try {
    const raw = localStorage.getItem(PLANNER_QUEUE_KEY);
    const arr: PlannerQueueTask[] = raw ? JSON.parse(raw) : [];
    const filtered = Array.isArray(arr) ? arr.filter((t) => t.id !== entry.id) : [];
    filtered.push(entry);
    localStorage.setItem(PLANNER_QUEUE_KEY, JSON.stringify(filtered));
  } catch {
    /* ignore */
  }
  return entry;
}

// -------- Can I Buy This? --------
export type BuyVerdict = "Safe to Buy" | "Wait Until Salary" | "Not Recommended";

export type BuyCheckResult = {
  verdict: BuyVerdict;
  reason: string;
  currentBalance: number;
  balanceAfter: number;
  newSurvivalScore: number;
  scoreImpact: number;
  newSafeDailySpend: number;
  monthlyBudgetImpactPct: number;
  goalDelayDays: number;
};

export function evaluatePurchase(
  price: number,
  plan: MonthlyPlan,
  input: CoachAnalysisInput,
): BuyCheckResult {
  const currentBalance = input.currentAccountBalance;
  if (price <= 0) {
    return {
      verdict: "Safe to Buy",
      reason: "Enter a price to evaluate the impact.",
      currentBalance,
      balanceAfter: currentBalance,
      newSurvivalScore: plan.summary.survivalScore,
      scoreImpact: 0,
      newSafeDailySpend: plan.summary.safeDailySpend,
      monthlyBudgetImpactPct: 0,
      goalDelayDays: 0,
    };
  }

  const today = new Date();
  const cycleEnd = new Date(parseDate(input.salaryDate));
  cycleEnd.setMonth(cycleEnd.getMonth() + 1);
  const daysLeft = Math.max(1, Math.round((cycleEnd.getTime() - today.getTime()) / 86_400_000));

  const balanceAfter = currentBalance - price;
  const newSafeDailySpend = Math.max(0, Math.round(plan.summary.safeDailySpend - price / daysLeft));
  const monthlyBudgetImpactPct = clamp(round((price / Math.max(1, input.monthlySalary)) * 100), 0, 100);
  const goalDelayDays = plan.goal.monthlyTarget > 0
    ? Math.max(0, Math.round((price / plan.goal.monthlyTarget) * 30))
    : 0;
  const scoreImpact = -Math.min(40, Math.max(2, Math.round(monthlyBudgetImpactPct * 0.5) + Math.round(goalDelayDays / 3)));
  const newSurvivalScore = clamp(plan.summary.survivalScore + scoreImpact, 0, 100);

  const goalName = plan.goal.goal;
  const explain = (base: string) =>
    goalDelayDays > 0
      ? `${base} Buying this delays your ${goalName} goal by ${goalDelayDays} day${goalDelayDays === 1 ? "" : "s"}.`
      : base;

  if (balanceAfter < 0 || price > currentBalance + plan.summary.expectedMonthEndBalance) {
    return {
      verdict: "Not Recommended",
      reason: explain("This purchase pushes your balance into the red before next salary."),
      currentBalance, balanceAfter, newSurvivalScore, scoreImpact, newSafeDailySpend,
      monthlyBudgetImpactPct, goalDelayDays,
    };
  }
  if (price > plan.summary.safeDailySpend * daysLeft * 0.5 || monthlyBudgetImpactPct >= 15) {
    return {
      verdict: "Wait Until Salary",
      reason: explain("You can afford it, but it noticeably tightens the rest of the month."),
      currentBalance, balanceAfter, newSurvivalScore, scoreImpact, newSafeDailySpend,
      monthlyBudgetImpactPct, goalDelayDays,
    };
  }
  return {
    verdict: "Safe to Buy",
    reason: explain("Comfortably within your safe spend for the month."),
    currentBalance, balanceAfter, newSurvivalScore, scoreImpact, newSafeDailySpend,
    monthlyBudgetImpactPct, goalDelayDays,
  };
}
