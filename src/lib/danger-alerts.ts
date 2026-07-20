/**
 * Smart Risk Engine for the Danger Alerts screen.
 *
 * Pure functions only. No React, no I/O.
 *
 * Each alert exposes: priority + urgency + fixTime + real financial
 * impact metrics + confidence factors + optional goal progress, so the UI
 * can render measurable, decision-ready cards.
 */

import type { Budget, Category, Loan, Transaction } from "@/hooks/use-finance";
import type { SalarySettings } from "@/hooks/use-salary-settings";
import type { Survival } from "@/lib/survival";

export type AlertPriority = "critical" | "high" | "medium" | "low";

export const PRIORITY_META: Record<
  AlertPriority,
  { emoji: string; label: string; bar: string; chip: string; weight: number }
> = {
  critical: { emoji: "🔴", label: "Critical", bar: "bg-destructive", chip: "bg-destructive/10 text-destructive", weight: 4 },
  high:     { emoji: "🟠", label: "High",     bar: "bg-gold",        chip: "bg-gold/15 text-gold",              weight: 3 },
  medium:   { emoji: "🟡", label: "Medium",   bar: "bg-primary",     chip: "bg-primary/10 text-primary",        weight: 2 },
  low:      { emoji: "🟢", label: "Low",      bar: "bg-success",     chip: "bg-success/15 text-success",        weight: 1 },
};

export type UrgencyKey = "today" | "3days" | "salary" | "week" | "later";
export interface UrgencyMeta { key: UrgencyKey; emoji: string; label: string; sortDays: number; }

export const URGENCY: Record<UrgencyKey, UrgencyMeta> = {
  today:   { key: "today",   emoji: "🔥", label: "Act Today",         sortDays: 0 },
  "3days": { key: "3days",   emoji: "⏳", label: "Within 3 Days",     sortDays: 3 },
  salary:  { key: "salary",  emoji: "📅", label: "Before Salary Day", sortDays: 7 },
  week:    { key: "week",    emoji: "✅", label: "This Week",         sortDays: 7 },
  later:   { key: "later",   emoji: "🗓️", label: "This Month",        sortDays: 30 },
};

export type AlertKind =
  | "overspending"
  | "low-balance"
  | "safe-daily-exceeded"
  | "emergency-fund-low"
  | "high-emi-ratio"
  | "budget-exceeded"
  | "budget-forecast"
  | "subscription-increase"
  | "unusual-spending"
  | "salary-delay"
  | "goal-behind"
  | "investment-skipped"
  | "emi-due"
  | "predictive-score";

export type AlertAction =
  | "view-transactions"
  | "ask-coach"
  | "create-budget"
  | "apply-planner"
  | "dismiss"
  | "remind-later"
  | "mark-resolved";

export interface AlertImpactMetrics {
  /** Change to Safe Daily Spend (₹/day). Negative = reduced. */
  safeDailyDelta?: number;
  /** Survival Score change (points). Negative = drops. */
  scoreDelta?: number;
  /** Current score, when scoreDelta is present. */
  scoreCurrent?: number;
  /** Rupees at risk / potentially lost this cycle. */
  savingsDelta?: number;
  /** Goal ETA delay in months (positive = delayed). */
  goalDelayMonths?: number;
  /** Recommended monthly saving to close the gap. */
  monthlyRecommend?: number;
}

export interface AlertConfidenceFactors {
  label: "High" | "Medium" | "Low";
  present: string[];
  missing: string[];
}

export interface AlertGoalProgress {
  name: string;
  current: number;
  target: number;
  pct: number;
  monthly?: number;
  etaMonths?: number;
  etaDate?: string;
}

export interface DangerAlert {
  id: string;
  kind: AlertKind;
  priority: AlertPriority;
  title: string;
  problem: string;
  /** One-line reason shown on the compact card. */
  oneLineReason: string;
  why: string;
  impact: string;
  suggestion: string;
  estimatedSavings: number;
  /** Money at risk / lost if ignored (₹). Used for smart sorting. */
  moneyAtRisk: number;
  confidence: number; // 0-100
  confidenceFactors: AlertConfidenceFactors;
  urgency: UrgencyMeta;
  /** Realistic time to resolve. */
  fixTime: string;
  fixTimeMinutes: number;
  impactMetrics: AlertImpactMetrics;
  goalProgress?: AlertGoalProgress;
  dataUsed: string[];
  lastUpdated: number;
  priorityReason: string;
  calculation: string;
  isPredictive: boolean;
  context?: { categoryId?: string; loanId?: string; goalId?: string };
  actions: AlertAction[];
}

export interface AlertContext {
  transactions: Transaction[];
  categories: Category[];
  budgets: Budget[];
  loans: Loan[];
  salarySettings: SalarySettings;
  survival: Survival;
  goals?: Array<{ id: string; name: string; target: number; current: number; monthly: number; deadline?: string }>;
  now: Date;
}

// ---------- helpers ----------
const daysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();

function pushMonthlyExpenses(txs: Transaction[], y: number, m: number) {
  const key = `${y}-${m}`;
  const byCat = new Map<string, number>();
  let total = 0;
  for (const t of txs) {
    if (t.type !== "expense") continue;
    const d = new Date(t.transaction_date);
    if (`${d.getFullYear()}-${d.getMonth()}` !== key) continue;
    total += Number(t.amount);
    const k = t.category_id ?? "uncategorized";
    byCat.set(k, (byCat.get(k) ?? 0) + Number(t.amount));
  }
  return { total, byCat };
}

function confidenceFromScore(score: number, present: string[], missing: string[]): AlertConfidenceFactors {
  const label = score >= 85 ? "High" : score >= 65 ? "Medium" : "Low";
  return { label, present, missing };
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

// ---------- detectors ----------
export function detectAlerts(ctx: AlertContext): DangerAlert[] {
  const { transactions, categories, budgets, loans, survival, salarySettings, goals = [], now } = ctx;
  const alerts: DangerAlert[] = [];
  const ts = now.getTime();
  const y = now.getFullYear();
  const m = now.getMonth();
  const dim = daysInMonth(y, m);
  const dayOfMonth = now.getDate();
  const monthProgress = dayOfMonth / dim;

  const { total: monthExpense, byCat: spendByCat } = pushMonthlyExpenses(transactions, y, m);

  const hasRecentTx = transactions.some((t) => (now.getTime() - new Date(t.transaction_date).getTime()) / 86_400_000 <= 7);
  const hasSalarySetting = !!(salarySettings.amount && salarySettings.amount > 0);
  const hasBudgets = budgets.length > 0;
  const hasSalaryCredit = survival.hasIncome;

  // 1. Low account balance
  if (survival.hasIncome && survival.salary > 0 && survival.daysRemaining > 0) {
    const ratio = survival.salaryLeft / survival.salary;
    if (ratio < 0.3) {
      const priority: AlertPriority = ratio < 0.1 ? "critical" : ratio < 0.2 ? "high" : "medium";
      const projectedShortfallDays = Math.max(1, Math.floor(survival.salaryLeft / Math.max(1, survival.safeDaily)));
      const safeDailyIfCut = survival.salaryLeft / Math.max(1, survival.daysRemaining);
      alerts.push({
        id: "low-balance",
        kind: "low-balance",
        priority,
        title: "Low Salary Balance",
        problem: `Only ₹${Math.round(survival.salaryLeft).toLocaleString("en-IN")} left for ${survival.daysRemaining} day${survival.daysRemaining === 1 ? "" : "s"} until next salary.`,
        oneLineReason: `${Math.round((1 - ratio) * 100)}% of salary spent — cycle not over.`,
        why: `You have spent ${Math.round((1 - ratio) * 100)}% of this month's salary before the cycle ended.`,
        impact: `At current pace you may run out ${projectedShortfallDays} days before salary.`,
        suggestion: `Cap daily spend at ₹${Math.round(safeDailyIfCut).toLocaleString("en-IN")} until salary day.`,
        estimatedSavings: Math.max(0, Math.round(survival.spentToday - survival.safeDaily) * survival.daysRemaining),
        moneyAtRisk: Math.max(0, Math.round(survival.salary * 0.1 - survival.salaryLeft)),
        confidence: 92,
        confidenceFactors: confidenceFromScore(
          92,
          ["Recent transactions", "Salary pattern", "Days until salary"].filter((_, i) => [hasRecentTx, hasSalarySetting, true][i]),
          [!hasRecentTx && "Recent transactions", !hasSalarySetting && "Salary pattern"].filter(Boolean) as string[],
        ),
        urgency: URGENCY[priority === "critical" ? "today" : "3days"],
        fixTime: "10 minutes",
        fixTimeMinutes: 10,
        impactMetrics: {
          safeDailyDelta: Math.round(safeDailyIfCut - survival.safeDaily),
          scoreDelta: -Math.min(20, Math.round((0.3 - ratio) * 50)),
          scoreCurrent: survival.score,
          savingsDelta: -Math.max(0, Math.round((survival.spentToday - survival.safeDaily) * survival.daysRemaining)),
        },
        dataUsed: ["Salary settings", "This cycle's transactions", "Days until salary"],
        lastUpdated: ts,
        priorityReason: `Salary left is ${Math.round(ratio * 100)}% of monthly salary.`,
        calculation: `salaryLeft ÷ salary = ${Math.round(survival.salaryLeft)} ÷ ${Math.round(survival.salary)} = ${(ratio * 100).toFixed(1)}%`,
        isPredictive: false,
        actions: ["view-transactions", "ask-coach", "apply-planner", "remind-later", "dismiss"],
      });
    }
  }

  // 2. Safe daily spend exceeded
  if (survival.safeDaily > 0 && survival.spentToday > survival.safeDaily) {
    const over = survival.spentToday - survival.safeDaily;
    const overPct = (over / survival.safeDaily) * 100;
    const priority: AlertPriority = overPct > 100 ? "high" : overPct > 50 ? "medium" : "low";
    const projectedCycleLoss = Math.round(over * survival.daysRemaining);
    alerts.push({
      id: "safe-daily-exceeded",
      kind: "safe-daily-exceeded",
      priority,
      title: "Safe Daily Spend Exceeded",
      problem: `You've spent ₹${Math.round(survival.spentToday).toLocaleString("en-IN")} today — ₹${Math.round(over).toLocaleString("en-IN")} over your safe limit.`,
      oneLineReason: `Today's spend is ${overPct.toFixed(0)}% above the safe daily target.`,
      why: `Your safe daily = remaining salary ÷ days until next credit.`,
      impact: `Continuing at this rate reduces salary left by an extra ₹${projectedCycleLoss.toLocaleString("en-IN")} by cycle end.`,
      suggestion: `Skip discretionary spending tomorrow to reset the average.`,
      estimatedSavings: Math.round(over),
      moneyAtRisk: projectedCycleLoss,
      confidence: 88,
      confidenceFactors: confidenceFromScore(88, ["Today's transactions", "Safe daily target"], []),
      urgency: URGENCY.today,
      fixTime: "5 minutes",
      fixTimeMinutes: 5,
      impactMetrics: {
        safeDailyDelta: -Math.round(over / Math.max(1, survival.daysRemaining)),
        savingsDelta: -projectedCycleLoss,
        scoreDelta: -Math.min(15, Math.round(overPct / 10)),
        scoreCurrent: survival.score,
      },
      dataUsed: ["Today's expenses", "Safe daily target"],
      lastUpdated: ts,
      priorityReason: `Overshoot is ${overPct.toFixed(0)}% of the safe limit.`,
      calculation: `spentToday − safeDaily = ${Math.round(survival.spentToday)} − ${Math.round(survival.safeDaily)} = ${Math.round(over)}`,
      isPredictive: false,
      actions: ["view-transactions", "ask-coach", "apply-planner", "remind-later", "dismiss"],
    });
  }

  // 3. Overspending vs month pace
  if (survival.salary > 0 && monthProgress > 0.15) {
    const expected = survival.salary * monthProgress * 0.75;
    if (monthExpense > expected * 1.15) {
      const over = monthExpense - expected;
      const projMonthEnd = Math.round(monthExpense / monthProgress);
      const priority: AlertPriority = monthExpense > survival.salary ? "critical" : "high";
      alerts.push({
        id: "overspending-month",
        kind: "overspending",
        priority,
        title: "Overspending Detected This Month",
        problem: `₹${Math.round(monthExpense).toLocaleString("en-IN")} spent by day ${dayOfMonth} — above healthy pace.`,
        oneLineReason: `Projected month-end: ₹${projMonthEnd.toLocaleString("en-IN")}.`,
        why: `A healthy pace uses ≤75% of your salary in linear proportion to the days elapsed.`,
        impact: `Projected month-end spend: ₹${projMonthEnd.toLocaleString("en-IN")}.`,
        suggestion: `Reduce this week's discretionary spend by ₹${Math.round(over / 4).toLocaleString("en-IN")}.`,
        estimatedSavings: Math.round(over),
        moneyAtRisk: Math.max(0, projMonthEnd - Math.round(survival.salary * 0.75)),
        confidence: 84,
        confidenceFactors: confidenceFromScore(
          84,
          ["Recent transactions", "Salary pattern", "Days elapsed"],
          [!hasBudgets && "Category budgets"].filter(Boolean) as string[],
        ),
        urgency: priority === "critical" ? URGENCY.today : URGENCY["3days"],
        fixTime: "30 minutes",
        fixTimeMinutes: 30,
        impactMetrics: {
          savingsDelta: -Math.round(over),
          safeDailyDelta: -Math.round(over / Math.max(1, dim - dayOfMonth)),
          scoreDelta: -Math.min(20, Math.round((monthExpense / Math.max(1, survival.salary)) * 15)),
          scoreCurrent: survival.score,
        },
        dataUsed: ["This month's transactions", "Salary", "Days elapsed"],
        lastUpdated: ts,
        priorityReason: `Spent > 115% of expected pace at day ${dayOfMonth}/${dim}.`,
        calculation: `expected = salary × ${(monthProgress).toFixed(2)} × 0.75 = ${Math.round(expected)}; actual = ${Math.round(monthExpense)}`,
        isPredictive: false,
        actions: ["view-transactions", "ask-coach", "create-budget", "apply-planner", "dismiss"],
      });
    }
  }

  // 4. Budget exceeded / forecast to exceed
  for (const b of budgets) {
    if (!b.category_id || b.monthly_limit <= 0) continue;
    const spent = spendByCat.get(b.category_id) ?? 0;
    const pct = (spent / b.monthly_limit) * 100;
    const c = categories.find((x) => x.id === b.category_id);
    const cname = c?.name ?? "Category";

    if (pct >= 100) {
      const over = spent - b.monthly_limit;
      const priority: AlertPriority = pct >= 130 ? "critical" : "high";
      alerts.push({
        id: `budget-exceeded:${b.id}`,
        kind: "budget-exceeded",
        priority,
        title: `${cname} Budget Exceeded`,
        problem: `Spent ₹${Math.round(spent).toLocaleString("en-IN")} of ₹${Math.round(b.monthly_limit).toLocaleString("en-IN")} (${Math.round(pct)}%).`,
        oneLineReason: `Over budget by ₹${Math.round(over).toLocaleString("en-IN")}.`,
        why: `Purchases in ${cname} exceeded the monthly budget on day ${dayOfMonth}.`,
        impact: `Additional ₹${Math.round(over).toLocaleString("en-IN")} pulled from other categories.`,
        suggestion: `Pause ${cname} spending for ${Math.max(1, dim - dayOfMonth)} days.`,
        estimatedSavings: Math.max(0, Math.round(over)),
        moneyAtRisk: Math.round(over),
        confidence: 96,
        confidenceFactors: confidenceFromScore(96, [`${cname} budget`, `${cname} transactions`], []),
        urgency: priority === "critical" ? URGENCY.today : URGENCY["3days"],
        fixTime: "10 minutes",
        fixTimeMinutes: 10,
        impactMetrics: {
          savingsDelta: -Math.round(over),
          safeDailyDelta: -Math.round(over / Math.max(1, dim - dayOfMonth)),
          scoreDelta: -Math.min(10, Math.round(pct / 20)),
          scoreCurrent: survival.score,
        },
        dataUsed: [`${cname} budget`, `${cname} transactions this month`],
        lastUpdated: ts,
        priorityReason: `Utilization at ${Math.round(pct)}% of budget.`,
        calculation: `spent ÷ budget = ${Math.round(spent)} ÷ ${Math.round(b.monthly_limit)} = ${Math.round(pct)}%`,
        isPredictive: false,
        context: { categoryId: b.category_id },
        actions: ["view-transactions", "ask-coach", "create-budget", "remind-later", "dismiss"],
      });
    } else if (pct >= 70 && dayOfMonth <= dim - 3) {
      const perDay = spent / Math.max(1, dayOfMonth);
      const daysToExceed = perDay > 0 ? Math.ceil((b.monthly_limit - spent) / perDay) : Infinity;
      const willExceed = dayOfMonth + daysToExceed <= dim;
      if (willExceed) {
        const projected = perDay * dim;
        const projOver = Math.max(0, projected - b.monthly_limit);
        const priority: AlertPriority = pct >= 90 ? "high" : "medium";
        alerts.push({
          id: `budget-forecast:${b.id}`,
          kind: "budget-forecast",
          priority,
          title: `${cname} Budget Forecast`,
          problem: `At current pace you'll exceed the ${cname} budget in ${daysToExceed} day${daysToExceed === 1 ? "" : "s"}.`,
          oneLineReason: `Projected overshoot ₹${Math.round(projOver).toLocaleString("en-IN")} this month.`,
          why: `Daily average in ${cname} is ₹${Math.round(perDay).toLocaleString("en-IN")}, which crosses ₹${Math.round(b.monthly_limit).toLocaleString("en-IN")} before month end.`,
          impact: `Projected month-end ${cname} spend: ₹${Math.round(projected).toLocaleString("en-IN")}.`,
          suggestion: `Cap ${cname} at ₹${Math.round((b.monthly_limit - spent) / Math.max(1, dim - dayOfMonth)).toLocaleString("en-IN")}/day.`,
          estimatedSavings: Math.round(projOver),
          moneyAtRisk: Math.round(projOver),
          confidence: 78,
          confidenceFactors: confidenceFromScore(78, [`${cname} spend so far`, `${cname} budget`, "Days elapsed"], []),
          urgency: daysToExceed <= 3 ? URGENCY["3days"] : URGENCY.week,
          fixTime: "10 minutes",
          fixTimeMinutes: 10,
          impactMetrics: {
            savingsDelta: -Math.round(projOver),
            safeDailyDelta: -Math.round(projOver / Math.max(1, dim - dayOfMonth)),
            scoreCurrent: survival.score,
          },
          dataUsed: [`${cname} spend so far`, `${cname} budget`, "Days elapsed"],
          lastUpdated: ts,
          priorityReason: `${Math.round(pct)}% used with ${dim - dayOfMonth} days remaining.`,
          calculation: `(budget − spent) ÷ perDay = (${Math.round(b.monthly_limit)} − ${Math.round(spent)}) ÷ ${Math.round(perDay)} = ${daysToExceed} days`,
          isPredictive: true,
          context: { categoryId: b.category_id },
          actions: ["view-transactions", "ask-coach", "create-budget", "apply-planner", "dismiss"],
        });
      }
    }
  }

  // 5. High EMI ratio
  if (survival.salary > 0 && survival.emiRatio >= 40) {
    alerts.push({
      id: "high-emi",
      kind: "high-emi-ratio",
      priority: survival.emiRatio >= 55 ? "critical" : "high",
      title: "High EMI Load",
      problem: `EMIs consume ${survival.emiRatio.toFixed(0)}% of your salary.`,
      oneLineReason: `Monthly EMI ₹${Math.round(survival.monthlyEmi).toLocaleString("en-IN")} of ₹${Math.round(survival.salary).toLocaleString("en-IN")}.`,
      why: `Monthly EMI ₹${Math.round(survival.monthlyEmi).toLocaleString("en-IN")} vs salary ₹${Math.round(survival.salary).toLocaleString("en-IN")}.`,
      impact: `Leaves little room for savings, investments, or unexpected expenses.`,
      suggestion: `Prioritise closing the highest-interest loan; avoid new EMIs.`,
      estimatedSavings: 0,
      moneyAtRisk: Math.round(Math.max(0, (survival.emiRatio - 40) / 100) * survival.salary),
      confidence: 95,
      confidenceFactors: confidenceFromScore(95, ["Active loans", "Salary"], []),
      urgency: URGENCY.later,
      fixTime: "1 day",
      fixTimeMinutes: 1440,
      impactMetrics: {
        savingsDelta: -Math.round(survival.monthlyEmi * 12 * 0.05),
        scoreCurrent: survival.score,
      },
      dataUsed: ["Active loans", "Salary"],
      lastUpdated: ts,
      priorityReason: `EMI ratio > 40% is considered unhealthy.`,
      calculation: `emi ÷ salary = ${Math.round(survival.monthlyEmi)} ÷ ${Math.round(survival.salary)} = ${survival.emiRatio.toFixed(1)}%`,
      isPredictive: false,
      actions: ["ask-coach", "apply-planner", "remind-later", "dismiss"],
    });
  }

  // 6. EMI / credit card payment due
  const today = new Date(y, m, dayOfMonth);
  for (const l of loans) {
    if (Number(l.remaining_balance) <= 0) continue;
    const dueDay = Math.min(Math.max(1, l.due_day || 1), 28);
    let due = new Date(y, m, dueDay);
    if (due < today) due = new Date(y, m + 1, dueDay);
    const days = Math.round((due.getTime() - today.getTime()) / 86_400_000);
    if (days <= 7) {
      const isCard = l.loan_type === "credit_card";
      const priority: AlertPriority = days <= 1 ? "critical" : days <= 3 ? "high" : "medium";
      const lateFee = Math.round(Number(l.emi_amount) * 0.02);
      alerts.push({
        id: `emi-due:${l.id}`,
        kind: "emi-due",
        priority,
        title: isCard ? "Credit Card Payment Due" : "EMI Due Soon",
        problem: `₹${Math.round(Number(l.emi_amount)).toLocaleString("en-IN")} (${l.loan_name}) due in ${days} day${days === 1 ? "" : "s"}.`,
        oneLineReason: `Due ${due.toLocaleDateString()} — late fee ~₹${lateFee.toLocaleString("en-IN")} if missed.`,
        why: `Loan due day is the ${dueDay}${dueDay === 1 ? "st" : dueDay === 2 ? "nd" : dueDay === 3 ? "rd" : "th"} of each month.`,
        impact: `Missing this ${isCard ? "card payment" : "EMI"} may add late fees and hurt credit score.`,
        suggestion: `Ensure ₹${Math.round(Number(l.emi_amount)).toLocaleString("en-IN")} is available before ${due.toLocaleDateString()}.`,
        estimatedSavings: lateFee,
        moneyAtRisk: lateFee,
        confidence: 99,
        confidenceFactors: confidenceFromScore(99, ["Loan due day", "EMI amount"], []),
        urgency: days <= 0 ? URGENCY.today : days <= 3 ? URGENCY["3days"] : URGENCY.salary,
        fixTime: "2 minutes",
        fixTimeMinutes: 2,
        impactMetrics: {
          savingsDelta: -lateFee,
          scoreCurrent: survival.score,
        },
        dataUsed: ["Loan due day", "Loan EMI amount"],
        lastUpdated: ts,
        priorityReason: `${days} day${days === 1 ? "" : "s"} until due.`,
        calculation: `due − today = ${due.toLocaleDateString()} − ${today.toLocaleDateString()} = ${days} days`,
        isPredictive: days > 0,
        context: { loanId: l.id },
        actions: ["view-transactions", "ask-coach", "apply-planner", "mark-resolved", "remind-later"],
      });
    }
  }

  // 7 + 8. Emergency fund — merged behind-target detector
  const emergency = goals.find((g) => /emergency/i.test(g.name));
  if (emergency && emergency.target > 0) {
    const pct = (emergency.current / emergency.target) * 100;
    const remaining = Math.max(0, emergency.target - emergency.current);
    // Prefer deadline math; fall back to current monthly plan; then to 12-month default.
    let monthsLeft = 12;
    let etaDateStr: string | undefined;
    if (emergency.deadline) {
      const dl = new Date(emergency.deadline);
      monthsLeft = Math.max(1, (dl.getFullYear() - y) * 12 + (dl.getMonth() - m));
    }
    const recommendedMonthly = Math.max(500, Math.ceil(remaining / monthsLeft));
    const etaMonthsAtCurrent =
      emergency.monthly > 0 ? Math.ceil(remaining / emergency.monthly) : Infinity;
    const goalDelay =
      emergency.deadline && Number.isFinite(etaMonthsAtCurrent)
        ? Math.max(0, etaMonthsAtCurrent - monthsLeft)
        : undefined;
    if (Number.isFinite(etaMonthsAtCurrent)) {
      etaDateStr = addMonths(now, etaMonthsAtCurrent).toLocaleDateString(undefined, { month: "short", year: "numeric" });
    }
    if (pct < 100) {
      const priority: AlertPriority = pct < 20 ? "high" : pct < 50 ? "medium" : "low";
      alerts.push({
        id: `emergency-fund:${emergency.id}`,
        kind: "emergency-fund-low",
        priority,
        title: "Emergency Fund Behind Target",
        problem: `₹${Math.round(emergency.current).toLocaleString("en-IN")} of ₹${Math.round(emergency.target).toLocaleString("en-IN")} (${Math.round(pct)}%).`,
        oneLineReason: `₹${Math.round(remaining).toLocaleString("en-IN")} remaining • Save ₹${recommendedMonthly.toLocaleString("en-IN")}/month.`,
        why: `Recommended cushion is 3–6 months of expenses; you're behind schedule.`,
        impact: `Unexpected expenses could force loans or missed EMIs.`,
        suggestion: `Set up a ₹${recommendedMonthly.toLocaleString("en-IN")}/month auto-transfer to emergency fund.`,
        estimatedSavings: 0,
        moneyAtRisk: Math.round(remaining * 0.1),
        confidence: 86,
        confidenceFactors: confidenceFromScore(
          86,
          ["Emergency goal target", "Emergency goal balance", emergency.deadline ? "Deadline" : ""].filter(Boolean),
          [!emergency.monthly && "Monthly plan"].filter(Boolean) as string[],
        ),
        urgency: URGENCY.week,
        fixTime: "10 minutes",
        fixTimeMinutes: 10,
        impactMetrics: {
          monthlyRecommend: recommendedMonthly,
          goalDelayMonths: goalDelay,
          scoreCurrent: survival.score,
        },
        goalProgress: {
          name: emergency.name,
          current: emergency.current,
          target: emergency.target,
          pct,
          monthly: emergency.monthly,
          etaMonths: Number.isFinite(etaMonthsAtCurrent) ? etaMonthsAtCurrent : undefined,
          etaDate: etaDateStr,
        },
        dataUsed: ["Emergency goal target", "Emergency goal balance", "Monthly contribution"],
        lastUpdated: ts,
        priorityReason: pct < 20 ? "Fund below 20% of target." : pct < 50 ? "Fund below 50% of target." : "Behind planned schedule.",
        calculation: `remaining ÷ monthsLeft = ${Math.round(remaining)} ÷ ${monthsLeft} = ₹${recommendedMonthly}/month`,
        isPredictive: false,
        context: { goalId: emergency.id },
        actions: ["ask-coach", "apply-planner", "remind-later", "dismiss"],
      });
    }
  }

  // 8. Goal falling behind — skip the emergency goal (merged above)
  for (const g of goals) {
    if (!g.deadline || g.target <= 0) continue;
    if (emergency && g.id === emergency.id) continue;
    const deadline = new Date(g.deadline);
    const monthsLeft = Math.max(0, (deadline.getFullYear() - y) * 12 + (deadline.getMonth() - m));
    if (monthsLeft === 0) continue;
    const remaining = Math.max(0, g.target - g.current);
    const needed = remaining / monthsLeft;
    if (g.monthly > 0 && needed > g.monthly * 1.25) {
      const etaMonthsAtCurrent = Math.ceil(remaining / Math.max(1, g.monthly));
      const goalDelayMonths = Math.max(0, etaMonthsAtCurrent - monthsLeft);
      const pct = (g.current / g.target) * 100;
      alerts.push({
        id: `goal-behind:${g.id}`,
        kind: "goal-behind",
        priority: needed > g.monthly * 2 ? "high" : "medium",
        title: `${g.name} Falling Behind`,
        problem: `Need ₹${Math.round(needed).toLocaleString("en-IN")}/month; currently saving ₹${Math.round(g.monthly).toLocaleString("en-IN")}.`,
        oneLineReason: `Deadline may slip by ~${goalDelayMonths} month${goalDelayMonths === 1 ? "" : "s"}.`,
        why: `Remaining ₹${Math.round(remaining).toLocaleString("en-IN")} over ${monthsLeft} months requires a higher monthly contribution.`,
        impact: `Deadline may slip by ~${goalDelayMonths} months.`,
        suggestion: `Increase monthly contribution by ₹${Math.round(needed - g.monthly).toLocaleString("en-IN")}.`,
        estimatedSavings: Math.round(needed - g.monthly),
        moneyAtRisk: Math.round((needed - g.monthly) * Math.min(6, monthsLeft)),
        confidence: 80,
        confidenceFactors: confidenceFromScore(80, ["Goal target", "Goal balance", "Deadline", "Monthly plan"], []),
        urgency: monthsLeft <= 1 ? URGENCY["3days"] : URGENCY.week,
        fixTime: "10 minutes",
        fixTimeMinutes: 10,
        impactMetrics: {
          monthlyRecommend: Math.round(needed),
          goalDelayMonths,
          scoreCurrent: survival.score,
        },
        goalProgress: {
          name: g.name,
          current: g.current,
          target: g.target,
          pct,
          monthly: g.monthly,
          etaMonths: etaMonthsAtCurrent,
          etaDate: addMonths(now, etaMonthsAtCurrent).toLocaleDateString(undefined, { month: "short", year: "numeric" }),
        },
        dataUsed: ["Goal target", "Goal balance", "Deadline", "Monthly plan"],
        lastUpdated: ts,
        priorityReason: `Required monthly is >125% of planned.`,
        calculation: `(target − current) ÷ months = (${Math.round(g.target)} − ${Math.round(g.current)}) ÷ ${monthsLeft} = ${Math.round(needed)}`,
        isPredictive: true,
        context: { goalId: g.id },
        actions: ["ask-coach", "apply-planner", "remind-later", "dismiss"],
      });
    }
  }

  // 9. Investment skipped
  const isInvestmentCat = (id: string | null) => {
    if (!id) return false;
    const c = categories.find((x) => x.id === id);
    return !!c && /invest|sip|mutual|stock|equity/i.test(c.name);
  };
  const thisMonthInv = transactions.some((t) => {
    if (t.type !== "expense") return false;
    const d = new Date(t.transaction_date);
    return d.getFullYear() === y && d.getMonth() === m && isInvestmentCat(t.category_id);
  });
  const lastMonthInvAmt = transactions
    .filter((t) => {
      if (t.type !== "expense") return false;
      const d = new Date(t.transaction_date);
      const pm = m === 0 ? 11 : m - 1;
      const py = m === 0 ? y - 1 : y;
      return d.getFullYear() === py && d.getMonth() === pm && isInvestmentCat(t.category_id);
    })
    .reduce((s, t) => s + Number(t.amount), 0);
  if (!thisMonthInv && lastMonthInvAmt > 0 && dayOfMonth > 20) {
    alerts.push({
      id: "investment-skipped",
      kind: "investment-skipped",
      priority: "medium",
      title: "Investment Skipped This Month",
      problem: `No investment logged this month (₹${Math.round(lastMonthInvAmt).toLocaleString("en-IN")} last month).`,
      oneLineReason: `Skipping breaks compounding on ₹${Math.round(lastMonthInvAmt).toLocaleString("en-IN")}/month.`,
      why: `You invested last month, but nothing appears this month past the 20th.`,
      impact: `One skipped SIP ~= ₹${Math.round(lastMonthInvAmt * 12).toLocaleString("en-IN")}/year of missed contributions if repeated.`,
      suggestion: `Log or schedule a SIP contribution before month-end.`,
      estimatedSavings: Math.round(lastMonthInvAmt),
      moneyAtRisk: Math.round(lastMonthInvAmt * 0.08),
      confidence: 70,
      confidenceFactors: confidenceFromScore(70, ["Investment category history"], ["Broker/SIP integration"]),
      urgency: URGENCY["3days"],
      fixTime: "5 minutes",
      fixTimeMinutes: 5,
      impactMetrics: {
        savingsDelta: -Math.round(lastMonthInvAmt),
        goalDelayMonths: 1,
        scoreCurrent: survival.score,
      },
      dataUsed: ["Investment category transactions"],
      lastUpdated: ts,
      priorityReason: `Pattern break vs previous month.`,
      calculation: `count(investment tx this month) = 0; last month total = ₹${Math.round(lastMonthInvAmt)}`,
      isPredictive: true,
      actions: ["ask-coach", "apply-planner", "mark-resolved", "dismiss"],
    });
  }

  // 10. Salary delay
  if (survival.hasIncome && salarySettings.payDay != null) {
    const expectedDay = salarySettings.payDay === 0 ? dim : Math.min(salarySettings.payDay, dim);
    if (dayOfMonth > expectedDay + 1) {
      const recentIncome = transactions.some((t) => {
        if (t.type !== "income") return false;
        const d = new Date(t.transaction_date);
        return (now.getTime() - d.getTime()) / 86_400_000 < 5;
      });
      if (!recentIncome) {
        const daysLate = dayOfMonth - expectedDay;
        alerts.push({
          id: "salary-delay",
          kind: "salary-delay",
          priority: "high",
          title: "Salary Appears Delayed",
          problem: `Expected salary on day ${expectedDay} — ${daysLate} day${daysLate === 1 ? "" : "s"} late.`,
          oneLineReason: `No income transaction detected in the last 5 days.`,
          why: `No income transaction logged within the last 5 days.`,
          impact: `EMIs, SIPs and safe daily cap all shift — expect ₹${Math.round(survival.monthlyEmi).toLocaleString("en-IN")} in EMIs at risk.`,
          suggestion: `Verify salary credit and log it once received.`,
          estimatedSavings: 0,
          moneyAtRisk: Math.round(survival.monthlyEmi * 0.02),
          confidence: 65,
          confidenceFactors: confidenceFromScore(
            65,
            ["Salary settings"],
            ["Salary credit", "Recent income transactions"],
          ),
          urgency: URGENCY.today,
          fixTime: "5 minutes",
          fixTimeMinutes: 5,
          impactMetrics: {
            safeDailyDelta: -Math.round(survival.safeDaily * 0.3),
            scoreCurrent: survival.score,
          },
          dataUsed: ["Salary settings", "Recent income transactions"],
          lastUpdated: ts,
          priorityReason: `Past expected pay day with no income.`,
          calculation: `today (${dayOfMonth}) > payDay (${expectedDay}) + 1 and no income in last 5 days`,
          isPredictive: false,
          actions: ["view-transactions", "ask-coach", "mark-resolved", "dismiss"],
        });
      }
    }
  }

  // 11. Unusual spending
  const catAvg = new Map<string, { count: number; sum: number }>();
  for (const t of transactions) {
    if (t.type !== "expense") continue;
    const key = t.category_id ?? "uncategorized";
    const e = catAvg.get(key) ?? { count: 0, sum: 0 };
    e.count++;
    e.sum += Number(t.amount);
    catAvg.set(key, e);
  }
  const recentBig = transactions
    .filter((t) => {
      if (t.type !== "expense") return false;
      const d = new Date(t.transaction_date);
      return (now.getTime() - d.getTime()) / 86_400_000 <= 3;
    })
    .find((t) => {
      const key = t.category_id ?? "uncategorized";
      const e = catAvg.get(key);
      if (!e || e.count < 4) return false;
      const avg = e.sum / e.count;
      return Number(t.amount) > avg * 3 && Number(t.amount) > 500;
    });
  if (recentBig) {
    const cname = categories.find((c) => c.id === recentBig.category_id)?.name ?? "Uncategorized";
    const e = catAvg.get(recentBig.category_id ?? "uncategorized")!;
    const avg = e.sum / e.count;
    const over = Number(recentBig.amount) - avg;
    alerts.push({
      id: `unusual:${recentBig.id}`,
      kind: "unusual-spending",
      priority: "medium",
      title: "Unusual Transaction Detected",
      problem: `₹${Math.round(Number(recentBig.amount)).toLocaleString("en-IN")} in ${cname} — ${(Number(recentBig.amount) / avg).toFixed(1)}× your usual.`,
      oneLineReason: `₹${Math.round(over).toLocaleString("en-IN")} above your ${cname} average.`,
      why: `Amount is more than 3× the average ${cname} transaction.`,
      impact: `One-off spikes can quietly break the monthly budget.`,
      suggestion: `Review and re-categorise if needed.`,
      estimatedSavings: 0,
      moneyAtRisk: Math.round(over),
      confidence: 72,
      confidenceFactors: confidenceFromScore(72, [`${cname} history`, "Recent transactions"], []),
      urgency: URGENCY["3days"],
      fixTime: "2 minutes",
      fixTimeMinutes: 2,
      impactMetrics: {
        savingsDelta: -Math.round(over),
        scoreCurrent: survival.score,
      },
      dataUsed: [`${cname} transactions history`],
      lastUpdated: ts,
      priorityReason: `Amount exceeds 3× rolling average.`,
      calculation: `amount ÷ avg = ${Math.round(Number(recentBig.amount))} ÷ ${Math.round(avg)} = ${(Number(recentBig.amount) / avg).toFixed(1)}×`,
      isPredictive: false,
      context: { categoryId: recentBig.category_id ?? undefined },
      actions: ["view-transactions", "ask-coach", "mark-resolved", "dismiss"],
    });
  }

  // 12. Subscription increase
  const notesThis = new Map<string, number>();
  const notesLast = new Map<string, number>();
  for (const t of transactions) {
    if (t.type !== "expense" || !t.notes) continue;
    const d = new Date(t.transaction_date);
    const key = t.notes.trim().toLowerCase();
    if (!key || key.length < 3) continue;
    if (d.getFullYear() === y && d.getMonth() === m) notesThis.set(key, Math.max(notesThis.get(key) ?? 0, Number(t.amount)));
    const pm = m === 0 ? 11 : m - 1;
    const py = m === 0 ? y - 1 : y;
    if (d.getFullYear() === py && d.getMonth() === pm) notesLast.set(key, Math.max(notesLast.get(key) ?? 0, Number(t.amount)));
  }
  for (const [k, cur] of notesThis) {
    const prev = notesLast.get(k);
    if (prev && cur > prev * 1.15 && cur - prev >= 50) {
      const yearly = Math.round((cur - prev) * 12);
      alerts.push({
        id: `sub-increase:${k}`,
        kind: "subscription-increase",
        priority: "low",
        title: "Subscription Price Increased",
        problem: `"${k}" charged ₹${Math.round(cur).toLocaleString("en-IN")} this month, up from ₹${Math.round(prev).toLocaleString("en-IN")}.`,
        oneLineReason: `+₹${Math.round(cur - prev).toLocaleString("en-IN")}/month, ~₹${yearly.toLocaleString("en-IN")}/year.`,
        why: `Same recurring entry as last month, but ${Math.round(((cur - prev) / prev) * 100)}% higher.`,
        impact: `Small increases compound — ₹${yearly.toLocaleString("en-IN")}/year if kept.`,
        suggestion: `Review the subscription; downgrade or cancel if unused.`,
        estimatedSavings: yearly,
        moneyAtRisk: yearly,
        confidence: 68,
        confidenceFactors: confidenceFromScore(68, ["Transaction notes", "Last month expenses"], ["Merchant metadata"]),
        urgency: URGENCY.week,
        fixTime: "10 minutes",
        fixTimeMinutes: 10,
        impactMetrics: {
          savingsDelta: -yearly,
          scoreCurrent: survival.score,
        },
        dataUsed: ["Transaction notes", "Last month expenses"],
        lastUpdated: ts,
        priorityReason: `Recurring charge up >15%.`,
        calculation: `now − prev = ${Math.round(cur)} − ${Math.round(prev)} = ${Math.round(cur - prev)}`,
        isPredictive: false,
        actions: ["view-transactions", "ask-coach", "mark-resolved", "dismiss"],
      });
      break;
    }
  }

  // 13. Predictive survival score drop
  if (survival.score > 0 && survival.spentToday > survival.safeDaily * 1.5 && survival.daysRemaining > 3) {
    const projectedDrop = Math.min(30, Math.round((survival.spentToday / Math.max(1, survival.safeDaily) - 1) * 8));
    if (projectedDrop >= 3) {
      const priority: AlertPriority = projectedDrop >= 10 ? "high" : "medium";
      alerts.push({
        id: "predictive-score",
        kind: "predictive-score",
        priority,
        title: "Survival Score at Risk",
        problem: `Score could drop from ${survival.score} → ${Math.max(0, survival.score - projectedDrop)} at today's pace.`,
        oneLineReason: `Sustained overshoot for ${survival.daysRemaining} days.`,
        why: `Overshooting safe daily consistently reduces the buffer and pace components.`,
        impact: `Lower score → tighter safe daily → less flexibility for the rest of the cycle.`,
        suggestion: `Skip one discretionary purchase to protect the score.`,
        estimatedSavings: Math.round(survival.spentToday - survival.safeDaily),
        moneyAtRisk: Math.round((survival.spentToday - survival.safeDaily) * survival.daysRemaining),
        confidence: 74,
        confidenceFactors: confidenceFromScore(74, ["Today's spend", "Safe daily", "Days remaining"], []),
        urgency: URGENCY.today,
        fixTime: "5 minutes",
        fixTimeMinutes: 5,
        impactMetrics: {
          scoreDelta: -projectedDrop,
          scoreCurrent: survival.score,
          safeDailyDelta: -Math.round((survival.spentToday - survival.safeDaily) / Math.max(1, survival.daysRemaining)),
          savingsDelta: -Math.round((survival.spentToday - survival.safeDaily) * survival.daysRemaining),
        },
        dataUsed: ["Today's spend", "Safe daily", "Days remaining"],
        lastUpdated: ts,
        priorityReason: `Sustained overshoot for ${survival.daysRemaining} days.`,
        calculation: `drop = min(30, (spent/safe − 1) × 8) = ${projectedDrop}`,
        isPredictive: true,
        actions: ["ask-coach", "apply-planner", "dismiss"],
      });
    }
  }

  // ---------- Deduplicate ----------
  // Same problem class (kind + context target) → keep the strongest priority
  // + higher money-at-risk.
  const dedup = new Map<string, DangerAlert>();
  for (const a of alerts) {
    const key = `${a.kind}::${a.context?.categoryId ?? a.context?.goalId ?? a.context?.loanId ?? ""}`;
    const prev = dedup.get(key);
    if (!prev) { dedup.set(key, a); continue; }
    const better =
      PRIORITY_META[a.priority].weight > PRIORITY_META[prev.priority].weight ||
      (PRIORITY_META[a.priority].weight === PRIORITY_META[prev.priority].weight && a.moneyAtRisk > prev.moneyAtRisk);
    if (better) dedup.set(key, a);
  }
  const unique = Array.from(dedup.values());

  // ---------- Smart sort ----------
  // Order (per spec):
  //   1. Highest financial loss (moneyAtRisk / |savingsDelta|)
  //   2. Nearest deadline (urgency.sortDays ascending)
  //   3. Highest urgency emoji tier
  //   4. Highest confidence
  //   5. Highest impact on Survival Score (|scoreDelta|)
  // Priority label is only a tie-breaker, not a dominant factor.
  unique.sort((a, b) => compositeScore(b) - compositeScore(a));

  return unique;
}

function compositeScore(a: DangerAlert): number {
  const loss = Math.max(
    Math.abs(a.moneyAtRisk || 0),
    Math.abs(a.impactMetrics.savingsDelta || 0),
    Math.abs(a.estimatedSavings || 0),
  );
  // Cap at 5L so a single huge alert can't crush the other criteria.
  const lossScore = Math.min(500_000, loss) * 20;           // ~1e7 range
  const deadlineScore = (30 - Math.min(30, a.urgency.sortDays)) * 20_000; // ~6e5
  const urgencyTier: Record<UrgencyKey, number> = {
    today: 5, "3days": 4, salary: 3, week: 2, later: 1,
  };
  const urgencyScore = urgencyTier[a.urgency.key] * 5_000;  // ~2.5e4
  const confScore = a.confidence * 50;                       // ~5e3
  const scoreImpact = Math.min(50, Math.abs(a.impactMetrics.scoreDelta || 0)) * 20; // ~1e3
  const priorityTiebreak = PRIORITY_META[a.priority].weight; // ~4
  return lossScore + deadlineScore + urgencyScore + confScore + scoreImpact + priorityTiebreak;
}

// ---------- summary ----------
export interface AlertsSummary {
  totalActive: number;
  highestPriority: AlertPriority | null;
  potentialSavings: number;
  financialRiskScore: number;
}

export function summarize(alerts: DangerAlert[]): AlertsSummary {
  const totalActive = alerts.length;
  const highestPriority = alerts[0]?.priority ?? null;
  const potentialSavings = alerts.reduce((s, a) => s + (a.moneyAtRisk || a.estimatedSavings || 0), 0);
  const raw = alerts.reduce((s, a) => s + PRIORITY_META[a.priority].weight * 8, 0);
  const financialRiskScore = Math.min(100, raw);
  return { totalActive, highestPriority, potentialSavings, financialRiskScore };
}
