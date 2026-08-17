/**
 * AI Financial Report — deterministic insight + report engine.
 *
 * Everything a user sees is produced here from the verified snapshot.
 * Gemini (see report-ai.ts) may only rewrite the prose; it can never change a
 * number, a severity, or a section.
 */

import type { ReportSnapshot } from "@/lib/report-snapshot";
import { formatCurrency } from "@/lib/currency";

export type InsightSeverity = "critical" | "warning" | "info" | "positive";
export type Confidence = "high" | "medium" | "low";

export type InsightCode =
  | "HIGH_TRANSPORT_SPENDING"
  | "HIGH_FOOD_SPENDING"
  | "HIGH_CATEGORY_SPENDING"
  | "BUDGET_NEAR_LIMIT"
  | "BUDGET_EXCEEDED"
  | "HEALTHY_SAVINGS"
  | "LOW_SAVINGS"
  | "NEGATIVE_FORECAST"
  | "LOW_EMERGENCY_FUND"
  | "HIGH_EMI_PRESSURE"
  | "STRONG_FINANCIAL_DISCIPLINE"
  | "SPENDING_INCREASED"
  | "SPENDING_DECREASED"
  | "GOAL_PROGRESS";

export type ReportInsight = {
  code: InsightCode;
  severity: InsightSeverity;
  /** Short deterministic sentence built only from snapshot values. */
  fact: string;
  /** Machine-readable numbers backing the insight. */
  numbers: Record<string, number | string>;
  /** Which snapshot fields were used. */
  dataUsed: string[];
  /** Extra context Gemini may paraphrase. */
  context: string;
  confidence: Confidence;
  /** Deterministic recommendation attached to this insight, when one exists. */
  recommendation?: string;
  /** Only set when the amount is calculable from the snapshot. */
  impactAmount?: number;
  impactText: string;
};

export type ReportSection = {
  id:
    | "executiveSummary"
    | "spendingOverview"
    | "savingsOverview"
    | "budgetPerformance"
    | "financialRisks"
    | "positiveProgress"
    | "recommendedActions";
  title: string;
  lines: string[];
};

export type DeterministicReport = {
  available: true;
  period: ReportSnapshot["period"];
  sections: ReportSection[];
  insights: ReportInsight[];
  recommendations: { text: string; from: InsightCode; impactText: string; impactAmount?: number }[];
  dataUsed: string[];
  confidence: Confidence;
  metrics: ReportMetrics;
};

export type UnavailableReport = {
  available: false;
  reason: string;
  message: string;
  missing: string[];
};

export type ReportResult = DeterministicReport | UnavailableReport;

export type ReportMetrics = {
  savingsRate?: number;
  budgetUtilization?: number;
  emiRatio?: number;
  emergencyFundCoverage?: number;
  topCategoryShare?: number;
  avgDailySpend?: number;
};

const THRESHOLDS = {
  categoryShareHigh: 30,
  budgetNearLimit: 80,
  budgetExceeded: 100,
  savingsRateHealthy: 20,
  savingsRateLow: 10,
  emergencyCoverageLow: 50,
  emiRatioHigh: 40,
  trendSignificant: 10,
  minTransactionsForReport: 3,
};

const TRANSPORT = /transport|travel|commute|fuel|petrol|cab|taxi|auto/i;
const FOOD = /food|dining|restaurant|grocer|eat|swiggy|zomato/i;

const NOT_ENOUGH_DATA = "I don't have enough data to generate a reliable report yet.";

// ---------- deterministic metrics ----------

export function computeReportMetrics(s: ReportSnapshot): ReportMetrics {
  const m: ReportMetrics = {};
  if (s.savingsRate != null) m.savingsRate = s.savingsRate;
  if (s.budgetTotal != null && s.budgetTotal > 0 && s.budgetSpent != null) {
    m.budgetUtilization = Math.round((s.budgetSpent / s.budgetTotal) * 1000) / 10;
  }
  if (s.monthlyEmi != null && s.salary != null && s.salary > 0) {
    m.emiRatio = Math.round((s.monthlyEmi / s.salary) * 1000) / 10;
  }
  if (s.emergencyFund != null && s.emergencyFundTarget != null && s.emergencyFundTarget > 0) {
    m.emergencyFundCoverage = Math.round((s.emergencyFund / s.emergencyFundTarget) * 1000) / 10;
  }
  const top = s.categories[0];
  if (top?.share != null) m.topCategoryShare = top.share;
  if (s.expenseCount > 0 && s.period.days > 0) {
    m.avgDailySpend = Math.round(s.totalSpent / s.period.days);
  }
  return m;
}

// ---------- insights ----------

export function buildReportInsights(s: ReportSnapshot, m: ReportMetrics): ReportInsight[] {
  const out: ReportInsight[] = [];
  const cur = (n: number) => formatCurrency(Math.round(n), s.currency).replace(/\.00$/, "");

  // --- category concentration
  const top = s.categories[0];
  if (top && top.share != null && top.share >= THRESHOLDS.categoryShareHigh && s.expenseCount >= 3) {
    const code: InsightCode = TRANSPORT.test(top.name)
      ? "HIGH_TRANSPORT_SPENDING"
      : FOOD.test(top.name)
        ? "HIGH_FOOD_SPENDING"
        : "HIGH_CATEGORY_SPENDING";
    out.push({
      code,
      severity: top.share >= 45 ? "warning" : "info",
      fact: `${top.name} is ${top.share.toFixed(0)}% of your spending this period (${cur(top.spent)} of ${cur(s.totalSpent)}).`,
      numbers: { category: top.name, spent: top.spent, share: top.share, totalSpent: s.totalSpent },
      dataUsed: ["Category spending", "Total spent"],
      context: "Category share = category spent / total spent x 100.",
      confidence: s.expenseCount >= 8 ? "high" : "medium",
      recommendation: `${top.name} is your largest spending category this period. Review it and cut the avoidable part first.`,
      impactText: "Trimming this category would improve your month-end surplus.",
    });
  }

  // --- budgets
  for (const c of s.categories) {
    if (c.utilization == null || c.budget == null) continue;
    if (c.utilization >= THRESHOLDS.budgetExceeded) {
      out.push({
        code: "BUDGET_EXCEEDED",
        severity: "critical",
        fact: `${c.name} is over budget: ${cur(c.spent)} spent against a ${cur(c.budget)} budget.`,
        numbers: { category: c.name, spent: c.spent, budget: c.budget, utilization: c.utilization },
        dataUsed: ["Category spending", "Category budget"],
        context: "Budget utilization = category spent / category budget x 100.",
        confidence: "high",
        recommendation: `Pause non-essential ${c.name} spending — this category is already past its budget.`,
        impactAmount: Math.round(c.spent - c.budget),
        impactText: `You are ${cur(c.spent - c.budget)} over the ${c.name} budget.`,
      });
    } else if (c.utilization >= THRESHOLDS.budgetNearLimit) {
      out.push({
        code: "BUDGET_NEAR_LIMIT",
        severity: "warning",
        fact: `${c.name} has used ${c.utilization.toFixed(0)}% of its budget, ${cur(c.budgetRemaining ?? 0)} left.`,
        numbers: { category: c.name, spent: c.spent, budget: c.budget, remaining: c.budgetRemaining ?? 0 },
        dataUsed: ["Category spending", "Category budget"],
        context: "Budget utilization = category spent / category budget x 100.",
        confidence: "high",
        recommendation: `Keep ${c.name} under ${cur(c.budgetRemaining ?? 0)} for the rest of this period to stay inside budget.`,
        impactAmount: Math.round(c.budgetRemaining ?? 0),
        impactText: `${cur(c.budgetRemaining ?? 0)} of the ${c.name} budget is left.`,
      });
    }
  }

  // --- savings
  if (s.savingsRate != null && s.totalSavings != null) {
    if (s.savingsRate >= THRESHOLDS.savingsRateHealthy) {
      out.push({
        code: "HEALTHY_SAVINGS",
        severity: "positive",
        fact: `You have kept ${cur(s.totalSavings)} of your ${cur(s.salary ?? 0)} salary — a ${s.savingsRate.toFixed(0)}% savings rate.`,
        numbers: { savings: s.totalSavings, salary: s.salary ?? 0, savingsRate: s.savingsRate },
        dataUsed: ["Salary", "Total spent"],
        context: "Savings rate = (salary - total spent) / salary x 100.",
        confidence: "high",
        impactText: "Holding this rate keeps your cycle comfortable.",
      });
    } else if (s.savingsRate < THRESHOLDS.savingsRateLow) {
      out.push({
        code: "LOW_SAVINGS",
        severity: s.savingsRate < 0 ? "critical" : "warning",
        fact: `Your savings rate is ${s.savingsRate.toFixed(0)}% — ${cur(s.totalSavings)} left from ${cur(s.salary ?? 0)}.`,
        numbers: { savings: s.totalSavings, salary: s.salary ?? 0, savingsRate: s.savingsRate },
        dataUsed: ["Salary", "Total spent"],
        context: "Savings rate = (salary - total spent) / salary x 100.",
        confidence: "high",
        recommendation: "Cut back on your largest flexible category so more of this salary survives the cycle.",
        impactText: "Lower spending here directly raises what is left at month end.",
      });
    }
  }

  // --- forecast
  if (s.forecastBalance != null && s.salary != null) {
    if (s.forecastBalance < 0) {
      out.push({
        code: "NEGATIVE_FORECAST",
        severity: "critical",
        fact: `At your current pace the cycle ends at ${cur(s.forecastBalance)}.`,
        numbers: { forecastBalance: s.forecastBalance, safeDaily: s.safeDaily ?? 0, daysRemaining: s.daysRemaining ?? 0 },
        dataUsed: ["Month-end forecast", "Safe daily spend"],
        context: "Forecast comes from FinTrackr's salary-cycle projection.",
        confidence: s.expenseCount >= 5 ? "high" : "medium",
        recommendation:
          s.safeDaily != null
            ? `Hold daily spending under ${cur(s.safeDaily)} for the remaining ${s.daysRemaining ?? 0} day(s) to pull the forecast back up.`
            : "Slow down daily spending to pull the forecast back up.",
        impactAmount: Math.abs(Math.round(s.forecastBalance)),
        impactText: `You are projected to fall short by ${cur(Math.abs(s.forecastBalance))}.`,
      });
    } else if (s.forecastBalance > 0 && s.score != null && s.score >= 70) {
      out.push({
        code: "STRONG_FINANCIAL_DISCIPLINE",
        severity: "positive",
        fact: `Survival Score is ${s.score} and the cycle is projected to end at ${cur(s.forecastBalance)}.`,
        numbers: { score: s.score, forecastBalance: s.forecastBalance },
        dataUsed: ["Survival Score", "Month-end forecast"],
        context: "Score and forecast come straight from FinTrackr's survival engine.",
        confidence: "high",
        impactText: "Your current pace is sustainable.",
      });
    }
  }

  // --- emergency fund
  if (m.emergencyFundCoverage != null && m.emergencyFundCoverage < THRESHOLDS.emergencyCoverageLow) {
    const gap = Math.round((s.emergencyFundTarget ?? 0) - (s.emergencyFund ?? 0));
    out.push({
      code: "LOW_EMERGENCY_FUND",
      severity: "warning",
      fact: `Your emergency fund is ${cur(s.emergencyFund ?? 0)} against a ${cur(s.emergencyFundTarget ?? 0)} target (${m.emergencyFundCoverage.toFixed(0)}%).`,
      numbers: { emergencyFund: s.emergencyFund ?? 0, target: s.emergencyFundTarget ?? 0, coverage: m.emergencyFundCoverage },
      dataUsed: ["Emergency fund", "Emergency fund target"],
      context: "Coverage = emergency fund / target x 100 (target from your Survival Preferences).",
      confidence: "medium",
      recommendation: "Move a fixed amount into your emergency fund on salary day, before spending starts.",
      impactAmount: gap > 0 ? gap : undefined,
      impactText: gap > 0 ? `${cur(gap)} still needed to reach the target.` : "Building this buffer reduces risk.",
    });
  }

  // --- EMI pressure
  if (m.emiRatio != null && m.emiRatio >= THRESHOLDS.emiRatioHigh) {
    out.push({
      code: "HIGH_EMI_PRESSURE",
      severity: "warning",
      fact: `EMIs take ${m.emiRatio.toFixed(0)}% of your salary (${cur(s.monthlyEmi ?? 0)} of ${cur(s.salary ?? 0)}).`,
      numbers: { monthlyEmi: s.monthlyEmi ?? 0, salary: s.salary ?? 0, emiRatio: m.emiRatio, loanBalance: s.loanBalance ?? 0 },
      dataUsed: ["Total EMI", "Salary", "Loan balance"],
      context: "EMI ratio = monthly EMI / salary x 100.",
      confidence: "high",
      recommendation: "Avoid taking on any new EMI this cycle — a large share of your salary is already committed.",
      impactText: "Reducing loan pressure frees up monthly cash flow.",
    });
  }

  // --- trend
  if (s.spendingTrend && Math.abs(s.spendingTrend.pct) >= THRESHOLDS.trendSignificant) {
    const t = s.spendingTrend;
    const up = t.direction === "up";
    out.push({
      code: up ? "SPENDING_INCREASED" : "SPENDING_DECREASED",
      severity: up ? "warning" : "positive",
      fact: `Spending is ${Math.abs(t.pct).toFixed(0)}% ${up ? "higher" : "lower"} than the previous ${s.period.days} day(s): ${cur(s.totalSpent)} vs ${cur(t.previousSpent)}.`,
      numbers: { totalSpent: s.totalSpent, previousSpent: t.previousSpent, changePct: t.pct },
      dataUsed: ["Total spent", "Previous period spending"],
      context: "Trend = (this period - previous period) / previous period x 100.",
      confidence: s.expenseCount >= 5 ? "high" : "medium",
      recommendation: up
        ? "Compare this period's top category with the previous one and bring the increase back down."
        : undefined,
      impactAmount: Math.abs(Math.round(s.totalSpent - t.previousSpent)),
      impactText: up
        ? `${cur(Math.abs(s.totalSpent - t.previousSpent))} more spent than the previous period.`
        : `${cur(Math.abs(s.totalSpent - t.previousSpent))} less spent than the previous period.`,
    });
  }

  // --- goals
  const goal = s.goals.find((g) => g.target > 0);
  if (goal) {
    out.push({
      code: "GOAL_PROGRESS",
      severity: goal.progress >= 50 ? "positive" : "info",
      fact: `${goal.name} is ${goal.progress.toFixed(0)}% funded (${cur(goal.current)} of ${cur(goal.target)}).`,
      numbers: { goal: goal.name, current: goal.current, target: goal.target, progress: goal.progress },
      dataUsed: ["Goal progress"],
      context: "Progress = saved / target x 100.",
      confidence: "medium",
      impactText: "Every rupee saved this cycle moves this goal closer.",
    });
  }

  const order: Record<InsightSeverity, number> = { critical: 0, warning: 1, info: 2, positive: 3 };
  return out.sort((a, b) => order[a.severity] - order[b.severity]);
}

// ---------- report assembly ----------

function overallConfidence(s: ReportSnapshot, insights: ReportInsight[]): Confidence {
  const signals = [
    s.salary != null,
    s.expenseCount >= 8,
    s.budgetTotal != null,
    s.spendingTrend != null,
    s.score != null,
  ].filter(Boolean).length;
  const highs = insights.filter((i) => i.confidence === "high").length;
  if (signals >= 4 && highs >= 2) return "high";
  if (signals >= 2) return "medium";
  return "low";
}

export function buildDeterministicReport(s: ReportSnapshot): ReportResult {
  const missing: string[] = [];
  if (s.salary == null) missing.push("Salary");
  if (s.expenseCount === 0) missing.push("Spending history");

  if (s.transactionCount === 0 || s.expenseCount < THRESHOLDS.minTransactionsForReport) {
    return {
      available: false,
      reason: "insufficient_data",
      message: NOT_ENOUGH_DATA,
      missing: missing.length ? missing : ["Spending history"],
    };
  }
  if (s.salary == null && s.totalSpent === 0) {
    return { available: false, reason: "insufficient_data", message: NOT_ENOUGH_DATA, missing };
  }

  const metrics = computeReportMetrics(s);
  const insights = buildReportInsights(s, metrics);
  const cur = (n: number) => formatCurrency(Math.round(n), s.currency).replace(/\.00$/, "");

  const sections: ReportSection[] = [];
  const push = (id: ReportSection["id"], title: string, lines: (string | null | undefined)[]) => {
    const clean = lines.filter((l): l is string => !!l);
    if (clean.length) sections.push({ id, title, lines: clean });
  };

  // 1. Executive summary
  push("executiveSummary", "Executive summary", [
    `${s.period.label}: ${cur(s.totalSpent)} spent across ${s.expenseCount} expense${s.expenseCount === 1 ? "" : "s"}.`,
    s.salary != null ? `Salary ${cur(s.salary)}, ${cur(s.salaryLeft ?? 0)} left.` : null,
    s.score != null ? `Survival Score ${s.score}.` : null,
    s.forecastBalance != null ? `Month-end forecast ${cur(s.forecastBalance)}.` : null,
  ]);

  // 2. Spending overview
  push("spendingOverview", "Spending overview", [
    metrics.avgDailySpend != null ? `Average daily spend ${cur(metrics.avgDailySpend)} over ${s.period.days} day(s).` : null,
    ...s.categories.slice(0, 3).map((c) =>
      c.share != null ? `${c.name}: ${cur(c.spent)} (${c.share.toFixed(0)}% of spending).` : `${c.name}: ${cur(c.spent)}.`,
    ),
    s.spendingTrend
      ? `Versus the previous ${s.period.days} day(s): ${s.spendingTrend.pct > 0 ? "+" : ""}${s.spendingTrend.pct.toFixed(0)}%.`
      : null,
  ]);

  // 3. Savings overview
  push("savingsOverview", "Savings overview", [
    s.totalSavings != null && s.savingsRate != null
      ? `${cur(s.totalSavings)} unspent so far — a ${s.savingsRate.toFixed(0)}% savings rate.`
      : null,
    s.safeDaily != null ? `Safe daily spend ${cur(s.safeDaily)} for the remaining ${s.daysRemaining ?? 0} day(s).` : null,
    metrics.emergencyFundCoverage != null
      ? `Emergency fund at ${metrics.emergencyFundCoverage.toFixed(0)}% of target (${cur(s.emergencyFund ?? 0)} of ${cur(s.emergencyFundTarget ?? 0)}).`
      : null,
  ]);

  // 4. Budget performance
  push("budgetPerformance", "Budget performance", [
    s.budgetTotal != null && s.budgetRemaining != null
      ? `Budgets total ${cur(s.budgetTotal)}, ${cur(s.budgetRemaining)} remaining${metrics.budgetUtilization != null ? ` (${metrics.budgetUtilization.toFixed(0)}% used)` : ""}.`
      : null,
    ...s.categories
      .filter((c) => c.utilization != null)
      .slice(0, 4)
      .map((c) => `${c.name}: ${c.utilization!.toFixed(0)}% of ${cur(c.budget!)} used.`),
  ]);

  // 5. Financial risks
  push(
    "financialRisks",
    "Financial risks",
    insights.filter((i) => i.severity === "critical" || i.severity === "warning").map((i) => i.fact),
  );

  // 6. Positive progress
  push(
    "positiveProgress",
    "Positive progress",
    insights.filter((i) => i.severity === "positive").map((i) => i.fact),
  );

  // 7. Recommended actions — every recommendation references an insight.
  const recommendations = insights
    .filter((i) => !!i.recommendation)
    .slice(0, 5)
    .map((i) => ({
      text: i.recommendation!,
      from: i.code,
      impactText: i.impactText,
      impactAmount: i.impactAmount,
    }));
  push("recommendedActions", "Recommended actions", recommendations.map((r) => r.text));

  const dataUsed = [...new Set(insights.flatMap((i) => i.dataUsed))];
  if (!dataUsed.length) {
    if (s.salary != null) dataUsed.push("Salary");
    dataUsed.push("Total spent");
  }

  return {
    available: true,
    period: s.period,
    sections,
    insights,
    recommendations,
    dataUsed,
    confidence: overallConfidence(s, insights),
    metrics,
  };
}

export const REPORT_NOT_ENOUGH_DATA = NOT_ENOUGH_DATA;
