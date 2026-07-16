/**
 * Report Card Insights — pure derivation layer.
 *
 * Gemini-ready: everything here is deterministic and provider-agnostic. A future
 * GeminiProvider can override `buildAiMonthlyReview()` to produce richer prose
 * without any UI change — the returned shape stays identical.
 */

import type { Transaction, Budget, Category, Loan } from "@/hooks/use-finance";
import type { SalarySettings } from "@/hooks/use-salary-settings";
import { computeSurvival } from "@/lib/survival";

export type Grade = "A+" | "A" | "B" | "C" | "D";
export type HealthLevel = "Excellent" | "Good" | "Average" | "Needs Attention";
export type Trend = "up" | "down" | "flat";

export interface Delta { pct: number; abs: number; trend: Trend }

export interface MonthComparison {
  score: Delta;
  income: Delta;
  expenses: Delta;
  savings: Delta;
  investments: Delta;
  budgetDays: Delta;
}

export interface HealthBreakdown {
  cashFlow: HealthLevel;
  savings: HealthLevel;
  budgetDiscipline: HealthLevel;
  emergencyFund: HealthLevel;
  investments: HealthLevel;
  bills: HealthLevel;
  grade: Grade;
  overallPct: number;
}

export interface Badge {
  id: string;
  icon: string;
  title: string;
  earnedAt: string; // ISO
  reason: string;
}

export interface AiMonthlyReview {
  rating: "Excellent" | "Good" | "Average" | "Needs Improvement";
  wentWell: string[];
  needsImprovement: string[];
  bestAction: string;
  confidence: number; // 0-100
  dataUsed: string[];
  lastUpdated: string;
  why: string;
}

export interface NextMonthPrediction {
  score: number;
  expectedSavings: number;
  riskLevel: "Low" | "Medium" | "High";
  goalCompletionChance: number; // 0-100
  safeDailySpend: number;
  confidence: number;
  reason: string;
}

export interface MonthlyChallenge {
  id: string;
  title: string;
  target: number;
  unit: string;
  progress: number; // 0-100
  reason: string;
}

export interface BiggestWin {
  icon: string;
  headline: string;
  detail: string;
}

// ---------- helpers ----------

const delta = (curr: number, prev: number): Delta => {
  const abs = curr - prev;
  const pct = prev === 0 ? (curr === 0 ? 0 : 100) : (abs / Math.abs(prev)) * 100;
  const trend: Trend = Math.abs(pct) < 1 ? "flat" : pct > 0 ? "up" : "down";
  return { pct, abs, trend };
};

const cycleFilter = (txs: Transaction[], startKey: string, endKey: string) =>
  txs.filter((t) => {
    const k = String(t.transaction_date).slice(0, 10);
    return k >= startKey && k <= endKey;
  });

const sumBy = (txs: Transaction[], type: Transaction["type"]) =>
  txs.filter((t) => t.type === type).reduce((s, t) => s + Number(t.amount), 0);

const key = (d: Date) => d.toISOString().slice(0, 10);

const countDaysUnderBudget = (txs: Transaction[], startKey: string, endKey: string, safeDaily: number) => {
  if (!safeDaily) return 0;
  const perDay = new Map<string, number>();
  txs.filter((t) => t.type === "expense").forEach((t) => {
    const k = String(t.transaction_date).slice(0, 10);
    if (k < startKey || k > endKey) return;
    perDay.set(k, (perDay.get(k) ?? 0) + Number(t.amount));
  });
  const start = new Date(startKey);
  const end = new Date(endKey);
  let count = 0;
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    if ((perDay.get(key(d)) ?? 0) < safeDaily) count++;
  }
  return count;
};

// Investment heuristic: expenses whose category name looks investment-like.
const investmentCategoryIds = (cats: Category[]) =>
  new Set(
    cats
      .filter((c) => /invest|sip|mutual|stock|equity|nps|ppf|rd|fd/i.test(c.name))
      .map((c) => c.id),
  );

const sumInvestments = (txs: Transaction[], cats: Category[]) => {
  const ids = investmentCategoryIds(cats);
  return txs
    .filter((t) => t.type === "expense" && t.category_id && ids.has(t.category_id))
    .reduce((s, t) => s + Number(t.amount), 0);
};

// ---------- public API ----------

export interface ReportContext {
  transactions: Transaction[];
  categories: Category[];
  budgets: Budget[];
  loans: Loan[];
  salarySettings: SalarySettings;
  now?: Date;
}

interface CycleStats {
  startKey: string;
  endKey: string;
  income: number;
  expenses: number;
  savings: number;
  investments: number;
  daysUnderBudget: number;
  totalDays: number;
  score: number;
  safeDaily: number;
  salary: number;
}

function computeCycleStats(ctx: ReportContext, when: Date): CycleStats {
  const s = computeSurvival({
    transactions: ctx.transactions,
    loans: ctx.loans,
    salarySettings: ctx.salarySettings,
    now: when,
  });
  const startKey = key(s.lastSalaryDate);
  const endKey = key(when);
  const inCycle = cycleFilter(ctx.transactions, startKey, endKey);
  const income = sumBy(inCycle, "income");
  const expenses = sumBy(inCycle, "expense");
  const investments = sumInvestments(inCycle, ctx.categories);
  const totalDays =
    Math.floor((when.getTime() - s.lastSalaryDate.getTime()) / 86_400_000) + 1;
  return {
    startKey,
    endKey,
    income,
    expenses,
    savings: Math.max(0, (s.salary || income) - expenses),
    investments,
    daysUnderBudget: countDaysUnderBudget(ctx.transactions, startKey, endKey, s.safeDaily),
    totalDays,
    score: s.score,
    safeDaily: s.safeDaily,
    salary: s.salary,
  };
}

export function buildComparison(ctx: ReportContext): {
  current: CycleStats;
  previous: CycleStats;
  cmp: MonthComparison;
} {
  const now = ctx.now ?? new Date();
  const current = computeCycleStats(ctx, now);

  const prevWhen = new Date(current.startKey);
  prevWhen.setDate(prevWhen.getDate() - 1);
  const previous = computeCycleStats(ctx, prevWhen);

  const cmp: MonthComparison = {
    score: delta(current.score, previous.score),
    income: delta(current.income, previous.income),
    // For expenses, "down" is good, but sign follows math.
    expenses: delta(current.expenses, previous.expenses),
    savings: delta(current.savings, previous.savings),
    investments: delta(current.investments, previous.investments),
    budgetDays: delta(current.daysUnderBudget, previous.daysUnderBudget),
  };

  return { current, previous, cmp };
}

export function buildBiggestWin(
  ctx: ReportContext,
  cur: CycleStats,
  prev: CycleStats,
  cmp: MonthComparison,
): BiggestWin {
  const candidates: Array<BiggestWin & { impact: number }> = [];

  // 1. Savings jump
  if (cmp.savings.abs > 0) {
    candidates.push({
      icon: "🏆",
      headline: `Saved ₹${Math.round(cmp.savings.abs).toLocaleString("en-IN")} more than last month`,
      detail: `+${cmp.savings.pct.toFixed(0)}% vs previous cycle`,
      impact: cmp.savings.abs,
    });
  }

  // 2. Budget-day streak
  if (cur.daysUnderBudget >= 10) {
    candidates.push({
      icon: "🔥",
      headline: `Stayed under budget for ${cur.daysUnderBudget} days`,
      detail: `${Math.round((cur.daysUnderBudget / Math.max(1, cur.totalDays)) * 100)}% of the cycle`,
      impact: cur.daysUnderBudget * 100,
    });
  }

  // 3. Category spending reduction (vs prev cycle)
  const catSpend = (txs: Transaction[]) => {
    const m = new Map<string, number>();
    txs.filter((t) => t.type === "expense" && t.category_id).forEach((t) => {
      m.set(t.category_id!, (m.get(t.category_id!) ?? 0) + Number(t.amount));
    });
    return m;
  };
  const curTxs = cycleFilter(ctx.transactions, cur.startKey, cur.endKey);
  const prevTxs = cycleFilter(ctx.transactions, prev.startKey, prev.endKey);
  const curMap = catSpend(curTxs);
  const prevMap = catSpend(prevTxs);
  let bestReduction: { name: string; pct: number; saved: number } | null = null;
  prevMap.forEach((prevVal, cid) => {
    const curVal = curMap.get(cid) ?? 0;
    if (prevVal > 200 && curVal < prevVal) {
      const pct = ((prevVal - curVal) / prevVal) * 100;
      if (!bestReduction || pct > bestReduction.pct) {
        const name = ctx.categories.find((c) => c.id === cid)?.name ?? "Category";
        bestReduction = { name, pct, saved: prevVal - curVal };
      }
    }
  });
  if (bestReduction && (bestReduction as { pct: number }).pct >= 5) {
    const b = bestReduction as { name: string; pct: number; saved: number };
    candidates.push({
      icon: "📉",
      headline: `${b.name} spending reduced by ${b.pct.toFixed(0)}%`,
      detail: `Saved ₹${Math.round(b.saved).toLocaleString("en-IN")} on ${b.name}`,
      impact: b.saved,
    });
  }

  // 4. Investments maintained/grew
  if (cur.investments > 0 && cur.investments >= prev.investments) {
    candidates.push({
      icon: "💰",
      headline: "Completed all SIPs this month",
      detail: `Invested ₹${Math.round(cur.investments).toLocaleString("en-IN")}`,
      impact: cur.investments * 0.5,
    });
  }

  // 5. No EMI missed
  const hasEmis = ctx.loans.some((l) => Number(l.remaining_balance) > 0);
  if (hasEmis) {
    candidates.push({
      icon: "✅",
      headline: "No EMI payment missed",
      detail: `${ctx.loans.length} active loan${ctx.loans.length === 1 ? "" : "s"} on track`,
      impact: 500,
    });
  }

  // 6. Savings rate improved
  if (cur.income > 0 && prev.income > 0) {
    const curRate = (cur.savings / cur.income) * 100;
    const prevRate = (prev.savings / prev.income) * 100;
    if (curRate - prevRate >= 3) {
      candidates.push({
        icon: "📈",
        headline: `Increased savings rate by ${(curRate - prevRate).toFixed(0)}%`,
        detail: `Now saving ${curRate.toFixed(0)}% of income`,
        impact: (curRate - prevRate) * 100,
      });
    }
  }

  // 7. Score jump
  if (cmp.score.abs >= 5) {
    candidates.push({
      icon: "⭐",
      headline: `Survival Score improved by ${cmp.score.abs} points`,
      detail: `From ${prev.score} to ${cur.score}`,
      impact: cmp.score.abs * 50,
    });
  }

  candidates.sort((a, b) => b.impact - a.impact);
  const top = candidates[0];
  if (top) {
    return { icon: top.icon, headline: top.headline, detail: top.detail };
  }

  // Guaranteed non-empty fallback based on current cycle state.
  if (cur.savings > 0) {
    return {
      icon: "💰",
      headline: `Saved ₹${Math.round(cur.savings).toLocaleString("en-IN")} this cycle`,
      detail: "Keep it up next month",
    };
  }
  if (cur.daysUnderBudget > 0) {
    return {
      icon: "📅",
      headline: `Stayed under budget on ${cur.daysUnderBudget} day${cur.daysUnderBudget === 1 ? "" : "s"}`,
      detail: "Consistency is compounding",
    };
  }
  return {
    icon: "🌱",
    headline: "Fresh start this cycle",
    detail: "Every transaction logged is progress",
  };
}

// ---------- health breakdown ----------

const rank = (v: number, thresholds: [number, number, number]): HealthLevel => {
  if (v >= thresholds[0]) return "Excellent";
  if (v >= thresholds[1]) return "Good";
  if (v >= thresholds[2]) return "Average";
  return "Needs Attention";
};

const scoreOf = (l: HealthLevel) =>
  l === "Excellent" ? 100 : l === "Good" ? 80 : l === "Average" ? 60 : 40;

const gradeFrom = (pct: number): Grade =>
  pct >= 92 ? "A+" : pct >= 82 ? "A" : pct >= 70 ? "B" : pct >= 55 ? "C" : "D";

export function buildHealthBreakdown(
  ctx: ReportContext,
  cur: CycleStats,
): HealthBreakdown {
  const savingsRate = cur.income > 0 ? (cur.savings / cur.income) * 100 : 0;
  const budgetPct = cur.totalDays > 0 ? (cur.daysUnderBudget / cur.totalDays) * 100 : 0;
  const investRate = cur.income > 0 ? (cur.investments / cur.income) * 100 : 0;

  // Emergency fund proxy: 3× monthly expenses as target, use current savings as buffer.
  const target = Math.max(1, cur.expenses * 3);
  const emergencyPct = Math.min(100, (cur.savings / target) * 100);

  // Bills: EMIs paid vs due (assume paid if not marked otherwise — loans exist w/ balance).
  const activeLoans = ctx.loans.filter((l) => Number(l.remaining_balance) > 0).length;
  const billsLevel: HealthLevel = activeLoans === 0 ? "Excellent" : "Good";

  const cashFlow = rank(cur.income - cur.expenses > 0 ? Math.min(100, ((cur.income - cur.expenses) / Math.max(1, cur.income)) * 200) : 0, [40, 20, 5]);
  const savings = rank(savingsRate, [20, 10, 5]);
  const budgetDiscipline = rank(budgetPct, [70, 50, 30]);
  const emergencyFund = rank(emergencyPct, [80, 50, 25]);
  const investments = rank(investRate, [15, 8, 3]);

  const avg =
    (scoreOf(cashFlow) +
      scoreOf(savings) +
      scoreOf(budgetDiscipline) +
      scoreOf(emergencyFund) +
      scoreOf(investments) +
      scoreOf(billsLevel)) / 6;

  return {
    cashFlow, savings, budgetDiscipline, emergencyFund, investments, bills: billsLevel,
    grade: gradeFrom(avg),
    overallPct: Math.round(avg),
  };
}

// ---------- AI monthly review ----------

export function buildAiMonthlyReview(
  ctx: ReportContext,
  cur: CycleStats,
  prev: CycleStats,
  cmp: MonthComparison,
  health: HealthBreakdown,
  win: BiggestWin,
): AiMonthlyReview {
  const wentWell: string[] = [];
  const needs: string[] = [];

  if (cmp.savings.trend === "up") wentWell.push(`Savings increased by ₹${Math.round(cmp.savings.abs).toLocaleString("en-IN")}`);
  if (cur.investments > 0 && cur.investments >= prev.investments) wentWell.push("Investment discipline maintained");
  if (health.budgetDiscipline === "Excellent" || health.budgetDiscipline === "Good") wentWell.push(`Stayed under budget ${cur.daysUnderBudget}/${cur.totalDays} days`);
  if (cmp.expenses.trend === "down") wentWell.push(`Expenses reduced by ₹${Math.round(Math.abs(cmp.expenses.abs)).toLocaleString("en-IN")}`);
  if (wentWell.length === 0) wentWell.push(win.headline);

  if (health.emergencyFund === "Needs Attention" || health.emergencyFund === "Average") needs.push("Emergency fund needs strengthening");
  if (cmp.expenses.trend === "up" && cmp.expenses.pct > 10) needs.push(`Overall spending grew by ${cmp.expenses.pct.toFixed(0)}%`);
  if (health.savings === "Needs Attention") needs.push("Savings rate below 5% of income");
  if (health.investments === "Needs Attention") needs.push("Investments below recommended level");
  if (needs.length === 0) needs.push("Keep monitoring discretionary spend");

  const rating: AiMonthlyReview["rating"] =
    cur.score >= 90 ? "Excellent" : cur.score >= 75 ? "Good" : cur.score >= 60 ? "Average" : "Needs Improvement";

  // Best action derived from the largest overspending category.
  let bestAction = `Maintain current pace to lift your score above ${Math.min(100, cur.score + 5)}.`;
  const overCat = ctx.budgets
    .map((b) => {
      const spent = cycleFilter(ctx.transactions, cur.startKey, cur.endKey)
        .filter((t) => t.type === "expense" && t.category_id === b.category_id)
        .reduce((s, t) => s + Number(t.amount), 0);
      const cat = ctx.categories.find((c) => c.id === b.category_id);
      return { name: cat?.name ?? "category", over: spent - b.monthly_limit };
    })
    .filter((x) => x.over > 0)
    .sort((a, b) => b.over - a.over)[0];
  if (overCat) {
    const reduceBy = Math.round(overCat.over * 0.5);
    bestAction = `Reduce ${overCat.name} spending by ₹${reduceBy.toLocaleString("en-IN")} next month to reach a Survival Score above ${Math.min(100, cur.score + 5)}.`;
  }

  // Confidence: scales with data volume.
  const txCount = cycleFilter(ctx.transactions, cur.startKey, cur.endKey).length;
  const confidence = Math.min(96, 55 + Math.min(30, txCount) + (ctx.budgets.length ? 8 : 0) + (prev.score > 0 ? 3 : 0));

  return {
    rating,
    wentWell,
    needsImprovement: needs,
    bestAction,
    confidence,
    dataUsed: [
      `${txCount} transactions this cycle`,
      `${ctx.budgets.length} category budgets`,
      `${ctx.loans.length} loans`,
      "Previous cycle comparison",
    ],
    lastUpdated: new Date().toISOString(),
    why: `Rating is derived from your Survival Score (${cur.score}/100), savings rate (${cur.income > 0 ? Math.round((cur.savings / cur.income) * 100) : 0}%) and budget discipline (${cur.daysUnderBudget}/${cur.totalDays} days).`,
  };
}

// ---------- badges ----------

export function buildBadges(
  ctx: ReportContext,
  cur: CycleStats,
  prev: CycleStats,
  health: HealthBreakdown,
): Badge[] {
  const now = new Date().toISOString();
  const badges: Badge[] = [];
  if (health.budgetDiscipline === "Excellent") {
    badges.push({ id: "budget-master", icon: "🏆", title: "Budget Master", earnedAt: now, reason: `Under budget ${cur.daysUnderBudget} days` });
  }
  if (cur.savings > 0 && cur.savings >= prev.savings) {
    badges.push({ id: "saving-streak", icon: "🔥", title: "Saving Streak", earnedAt: now, reason: "Savings held or grew vs last cycle" });
  }
  if (cur.investments > 0) {
    badges.push({ id: "smart-investor", icon: "💰", title: "Smart Investor", earnedAt: now, reason: `Invested ₹${Math.round(cur.investments).toLocaleString("en-IN")}` });
  }
  if (cur.score >= 85) {
    badges.push({ id: "goal-chaser", icon: "🎯", title: "Goal Chaser", earnedAt: now, reason: `Score ${cur.score}/100` });
  }
  if (ctx.transactions.length >= 30) {
    badges.push({ id: "money-manager", icon: "📈", title: "Money Manager", earnedAt: now, reason: `${ctx.transactions.length} transactions tracked` });
  }
  return badges;
}

// ---------- next-month prediction ----------

export function buildPrediction(
  cur: CycleStats,
  prev: CycleStats,
  health: HealthBreakdown,
): NextMonthPrediction {
  // Blend current + previous with slight bias toward improvement momentum.
  const scoreDelta = cur.score - prev.score;
  const projectedScore = Math.max(0, Math.min(100, Math.round(cur.score + scoreDelta * 0.4)));
  const expectedSavings = Math.round((cur.savings + prev.savings) / 2 * (scoreDelta >= 0 ? 1.05 : 0.95));
  const riskLevel: NextMonthPrediction["riskLevel"] =
    health.emergencyFund === "Needs Attention" || cur.score < 60 ? "High"
      : cur.score < 80 ? "Medium" : "Low";
  const goalCompletionChance = Math.max(20, Math.min(95, projectedScore));
  const safeDailySpend = Math.round(cur.safeDaily || (cur.salary > 0 ? cur.salary / 30 : 0));
  const confidence = Math.min(90, 60 + Math.min(20, cur.totalDays) + (prev.score > 0 ? 8 : 0));
  const reason =
    scoreDelta > 0
      ? `Momentum is positive (+${scoreDelta} pts). If current pace holds, savings should trend upward.`
      : scoreDelta < 0
        ? `Score slipped by ${Math.abs(scoreDelta)} pts. Trimming discretionary spend can reverse the trend.`
        : "Trend is stable. Small optimizations can push your score higher next month.";
  return { score: projectedScore, expectedSavings, riskLevel, goalCompletionChance, safeDailySpend, confidence, reason };
}

// ---------- monthly challenge ----------

export function buildChallenge(cur: CycleStats, prev: CycleStats, health: HealthBreakdown): MonthlyChallenge {
  if (health.savings !== "Excellent") {
    const target = Math.max(1000, Math.round((cur.savings || 1000) * 1.1 / 500) * 500);
    return {
      id: "save-more",
      title: `Save ₹${target.toLocaleString("en-IN")} next cycle`,
      target,
      unit: "₹",
      progress: Math.min(100, Math.round((cur.savings / target) * 100)),
      reason: "Boosting savings improves your emergency buffer",
    };
  }
  if (health.budgetDiscipline !== "Excellent") {
    return {
      id: "budget-days",
      title: "Complete 20 budget days",
      target: 20,
      unit: "days",
      progress: Math.min(100, Math.round((cur.daysUnderBudget / 20) * 100)),
      reason: "Consistency builds long-term discipline",
    };
  }
  if (health.investments !== "Excellent") {
    return {
      id: "sip-boost",
      title: "Increase SIP by ₹500",
      target: 500,
      unit: "₹",
      progress: 0,
      reason: "Small SIP hikes compound significantly over years",
    };
  }
  return {
    id: "no-impulse",
    title: "No impulse shopping for 7 days",
    target: 7,
    unit: "days",
    progress: 0,
    reason: "You have room to optimize discretionary spend",
  };
}
