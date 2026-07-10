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
  tone: string; // tailwind bg-* token
};

export type WeeklyLimit = {
  week: number;
  label: string; // "Week 1"
  range: string; // "1–7 Jul"
  limit: number;
};

export type BillItem = {
  id: string;
  name: string;
  amount: number;
  dueDate: string; // ISO
  dueLabel: string; // "15 Jul"
  status: BillStatus;
};

export type GoalProgress = {
  goal: string;
  target: number;
  current: number;
  monthlyTarget: number;
  estimatedCompletion: string; // ISO
  etaMonths: number;
  progressPct: number;
};

export type TopAction = {
  id: string;
  title: string;
  detail: string;
  priority: ActionPriority;
  monthlySavings: number;
  difficulty: ActionDifficulty;
};

export type MonthlyPlan = {
  summary: PlanSummary;
  allocation: AllocationSlice[];
  weeklyLimits: WeeklyLimit[];
  bills: BillItem[];
  goal: GoalProgress;
  actions: TopAction[];
  generatedAt: string;
};

// -------- helpers --------
const round = (n: number) => Math.round(n);
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

function parseDate(s: string): Date {
  const d = new Date(s);
  return isNaN(d.getTime()) ? new Date() : d;
}

function fmtDay(d: Date): string {
  const m = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${d.getDate()} ${m[d.getMonth()]}`;
}

function daysInMonth(y: number, m: number): number {
  return new Date(y, m + 1, 0).getDate();
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function billStatus(due: Date, today: Date): BillStatus {
  if (sameDay(due, today)) return "Due Today";
  if (due.getTime() < today.setHours(0, 0, 0, 0)) return "Paid";
  return "Upcoming";
}

// -------- core generator --------
export function generatePlanMock(
  input: CoachAnalysisInput,
  analysis?: CoachAnalysisResult,
): MonthlyPlan {
  const a = analysis ?? analyzeMock(input);
  const salary = Math.max(0, input.monthlySalary);

  // ----- Summary -----
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

  // ----- Allocation (50/20/20/10 tuned to actuals) -----
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

  // ----- Weekly limits (variable spend = food + transport + lifestyle) -----
  const variablePool = Math.max(0, input.monthlyFood + input.monthlyTransport + lifestyle + input.otherMonthlyExpenses);
  const y = cycleStart.getFullYear();
  const m = cycleStart.getMonth();
  const dim = daysInMonth(y, m);
  const weekBase = variablePool / 4;
  // Slightly front-load week 1 and taper — nudges the user to save at month-end.
  const weights = [1.1, 1.05, 0.95, 0.9];
  const weeklyLimits: WeeklyLimit[] = [1, 2, 3, 4].map((w, i) => {
    const startDay = (w - 1) * 7 + 1;
    const endDay = w === 4 ? dim : w * 7;
    const startD = new Date(y, m, Math.min(startDay, dim));
    const endD = new Date(y, m, Math.min(endDay, dim));
    return {
      week: w,
      label: `Week ${w}`,
      range: `${startD.getDate()}–${endD.getDate()} ${["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][m]}`,
      limit: round(weekBase * weights[i]),
    };
  });

  // ----- Bills timeline -----
  const salaryDay = salaryDate.getDate();
  const bills: BillItem[] = [];
  const push = (name: string, amount: number, offsetDays: number) => {
    if (amount <= 0) return;
    const d = new Date(y, m, clamp(salaryDay + offsetDays, 1, dim));
    bills.push({
      id: `${name.toLowerCase().replace(/\s+/g, "-")}-${d.toISOString().slice(0, 10)}`,
      name,
      amount: round(amount),
      dueDate: d.toISOString(),
      dueLabel: fmtDay(d),
      status: billStatus(new Date(d), new Date()),
    });
  };
  push("Rent", input.monthlyRent, 0);
  push("Bills & Utilities", input.monthlyBills, 5);
  push("EMI", input.monthlyEmi, 10);
  push("Investments / SIP", input.monthlyInvestments, 2);
  bills.sort((x, z) => x.dueDate.localeCompare(z.dueDate));

  // ----- Goal progress -----
  const gf = a.goalForecast;
  const goal: GoalProgress = {
    goal: gf.goal,
    target: gf.targetAmount,
    current: Math.max(0, input.currentSavings),
    monthlyTarget: gf.monthlyTarget,
    estimatedCompletion: gf.estimatedCompletion,
    etaMonths: gf.etaMonths,
    progressPct: clamp(round((input.currentSavings / Math.max(1, gf.targetAmount)) * 100), 0, 100),
  };

  // ----- Top 5 AI Action Plan -----
  const actions = buildActions(input, a);

  return {
    summary,
    allocation,
    weeklyLimits,
    bills,
    goal,
    actions,
    generatedAt: new Date().toISOString(),
  };
}

function buildActions(input: CoachAnalysisInput, a: CoachAnalysisResult): TopAction[] {
  const salary = Math.max(1, input.monthlySalary);
  const list: TopAction[] = [];

  if (input.monthlyFood / salary > 0.15) {
    list.push({
      id: "cut-food",
      title: "Reduce food delivery this week",
      detail: "Cap delivery to twice a week and cook the rest.",
      priority: "High",
      monthlySavings: Math.max(300, Math.round(input.monthlyFood * 0.15)),
      difficulty: "Easy",
    });
  }
  if (input.otherMonthlyExpenses / salary > 0.08) {
    list.push({
      id: "skip-shopping",
      title: "Skip unnecessary shopping",
      detail: "Delay non-essentials until after the salary date.",
      priority: "Medium",
      monthlySavings: Math.max(300, Math.round(input.otherMonthlyExpenses * 0.2)),
      difficulty: "Easy",
    });
  }
  if (a.monthlySurplus > 0) {
    list.push({
      id: "bump-sip",
      title: "Increase SIP by ₹500 next month",
      detail: "Automate the bump the day after your salary lands.",
      priority: "Medium",
      monthlySavings: 500,
      difficulty: "Easy",
    });
  }
  if (input.monthlyBills > 0) {
    list.push({
      id: "audit-subs",
      title: "Review subscriptions on Sunday",
      detail: "Cancel anything unused in the last 30 days.",
      priority: "Low",
      monthlySavings: Math.max(200, Math.round(input.monthlyBills * 0.1)),
      difficulty: "Easy",
    });
  }
  list.push({
    id: "maintain-emergency",
    title: "Maintain emergency savings",
    detail: "Keep at least 3 months of expenses parked liquid.",
    priority: a.risks.find((r) => r.key === "emergency")?.level === "High" ? "High" : "Medium",
    monthlySavings: Math.max(500, Math.round(salary * 0.05)),
    difficulty: "Medium",
  });

  if (input.monthlyEmi / salary >= 0.3) {
    list.unshift({
      id: "prepay-emi",
      title: "Prepay the highest-interest EMI",
      detail: "EMIs are eating a big chunk — pay down the priciest one.",
      priority: "High",
      monthlySavings: Math.max(500, Math.round(input.monthlyEmi * 0.05)),
      difficulty: "Hard",
    });
  }

  // Ensure exactly 5.
  const filler: TopAction[] = [
    {
      id: "weekly-review",
      title: "Do a 10-minute weekly money review",
      detail: "Every Sunday, review last week's spending in FinTrackr.",
      priority: "Low",
      monthlySavings: Math.max(300, Math.round(salary * 0.01)),
      difficulty: "Easy",
    },
    {
      id: "cash-only-weekends",
      title: "Cash-only weekends",
      detail: "Withdraw a weekend cap in cash to curb impulse buys.",
      priority: "Low",
      monthlySavings: 500,
      difficulty: "Medium",
    },
  ];
  while (list.length < 5 && filler.length) list.push(filler.shift()!);
  return list.slice(0, 5);
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

// -------- Can I Buy This? (lightweight, plan-scoped) --------
export type BuyVerdict = "Safe to Buy" | "Wait Until Salary" | "Not Recommended";

export type BuyCheckResult = {
  verdict: BuyVerdict;
  reason: string;
  scoreImpact: number; // negative = drop
  newSafeDailySpend: number;
};

export function evaluatePurchase(
  price: number,
  plan: MonthlyPlan,
  input: CoachAnalysisInput,
): BuyCheckResult {
  if (price <= 0) {
    return {
      verdict: "Safe to Buy",
      reason: "Enter a price to evaluate the impact.",
      scoreImpact: 0,
      newSafeDailySpend: plan.summary.safeDailySpend,
    };
  }
  const newBalance = input.currentAccountBalance - price;
  const daysLeft = Math.max(1, Math.round((new Date(plan.weeklyLimits[3]?.range ? new Date() : new Date()).getTime()) / 1) || 1);
  // Simple: reduce safe daily proportionally.
  const drop = Math.round((price / Math.max(1, plan.summary.safeDailySpend * 30)) * 15);
  const newSafeDailySpend = Math.max(0, Math.round(plan.summary.safeDailySpend - price / 30));

  if (newBalance < 0 || price > plan.summary.expectedMonthEndBalance + input.currentAccountBalance) {
    return {
      verdict: "Not Recommended",
      reason: "This purchase pushes your balance into the red before next salary.",
      scoreImpact: -Math.max(20, drop),
      newSafeDailySpend,
    };
  }
  if (price > plan.summary.safeDailySpend * daysLeft * 0.5 || drop >= 10) {
    return {
      verdict: "Wait Until Salary",
      reason: "You can afford it, but it noticeably tightens the rest of the month.",
      scoreImpact: -Math.max(10, drop),
      newSafeDailySpend,
    };
  }
  return {
    verdict: "Safe to Buy",
    reason: "Comfortably within your safe spend for the month.",
    scoreImpact: -drop,
    newSafeDailySpend,
  };
}
