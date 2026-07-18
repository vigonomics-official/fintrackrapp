/**
 * Smart Risk Engine for the Danger Alerts screen.
 *
 * Pure functions only. No React, no I/O. UI is responsible for reading
 * transactions/loans/budgets/goals and calling `detectAlerts()`.
 *
 * Gemini-ready: a future provider can override `narrate()` / add its own
 * detectors, but the shape below stays stable.
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

export interface DangerAlert {
  /** Stable id, used to dedupe across renders and persist dismiss/resolve state. */
  id: string;
  kind: AlertKind;
  priority: AlertPriority;
  title: string;
  problem: string;
  why: string;
  impact: string;
  suggestion: string;
  estimatedSavings: number;
  confidence: number; // 0-100
  dataUsed: string[];
  lastUpdated: number;
  priorityReason: string;
  calculation: string;
  /** true → an active problem, false → a predictive nudge. */
  isPredictive: boolean;
  /** Contextual route hints for one-tap actions. */
  context?: {
    categoryId?: string;
    loanId?: string;
    goalId?: string;
  };
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
const dayKey = (d: Date | string) => String(typeof d === "string" ? d : d.toISOString()).slice(0, 10);
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

  // 1. Low account balance
  if (survival.hasIncome && survival.salary > 0 && survival.daysRemaining > 0) {
    const ratio = survival.salaryLeft / survival.salary;
    if (ratio < 0.3) {
      const priority: AlertPriority = ratio < 0.1 ? "critical" : ratio < 0.2 ? "high" : "medium";
      alerts.push({
        id: "low-balance",
        kind: "low-balance",
        priority,
        title: "Low Salary Balance",
        problem: `Only ₹${Math.round(survival.salaryLeft).toLocaleString("en-IN")} left for ${survival.daysRemaining} day${survival.daysRemaining === 1 ? "" : "s"} until next salary.`,
        why: `You have spent ${Math.round((1 - ratio) * 100)}% of this month's salary before the cycle ended.`,
        impact: `At current pace you may run out ${Math.max(1, Math.floor(survival.salaryLeft / Math.max(1, survival.safeDaily)))} days before salary.`,
        suggestion: `Cap daily spend at ₹${Math.round(survival.safeDaily).toLocaleString("en-IN")} until salary day.`,
        estimatedSavings: Math.max(0, Math.round(survival.spentToday - survival.safeDaily) * survival.daysRemaining),
        confidence: 92,
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
    alerts.push({
      id: "safe-daily-exceeded",
      kind: "safe-daily-exceeded",
      priority: overPct > 100 ? "high" : overPct > 50 ? "medium" : "low",
      title: "Safe Daily Spend Exceeded",
      problem: `You've spent ₹${Math.round(survival.spentToday).toLocaleString("en-IN")} today — ₹${Math.round(over).toLocaleString("en-IN")} over your safe limit.`,
      why: `Your safe daily = remaining salary ÷ days until next credit.`,
      impact: `Continuing at this rate reduces salary left by an extra ₹${Math.round(over * survival.daysRemaining).toLocaleString("en-IN")} by cycle end.`,
      suggestion: `Skip discretionary spending tomorrow to reset the average.`,
      estimatedSavings: Math.round(over),
      confidence: 88,
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
    const expected = survival.salary * monthProgress * 0.75; // healthy pace
    if (monthExpense > expected * 1.15) {
      const over = monthExpense - expected;
      alerts.push({
        id: "overspending-month",
        kind: "overspending",
        priority: monthExpense > survival.salary ? "critical" : "high",
        title: "Overspending Detected This Month",
        problem: `₹${Math.round(monthExpense).toLocaleString("en-IN")} spent by day ${dayOfMonth} — above healthy pace.`,
        why: `A healthy pace uses ≤75% of your salary in linear proportion to the days elapsed.`,
        impact: `Projected month-end spend: ₹${Math.round((monthExpense / monthProgress)).toLocaleString("en-IN")}.`,
        suggestion: `Reduce this week's discretionary spend by ₹${Math.round(over / 4).toLocaleString("en-IN")}.`,
        estimatedSavings: Math.round(over),
        confidence: 84,
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
      alerts.push({
        id: `budget-exceeded:${b.id}`,
        kind: "budget-exceeded",
        priority: pct >= 130 ? "critical" : "high",
        title: `${cname} Budget Exceeded`,
        problem: `Spent ₹${Math.round(spent).toLocaleString("en-IN")} of ₹${Math.round(b.monthly_limit).toLocaleString("en-IN")} (${Math.round(pct)}%).`,
        why: `Purchases in ${cname} exceeded the monthly budget on day ${dayOfMonth}.`,
        impact: `Additional ₹${Math.round(spent - b.monthly_limit).toLocaleString("en-IN")} pulled from other categories.`,
        suggestion: `Pause ${cname} spending for ${Math.max(1, dim - dayOfMonth)} days.`,
        estimatedSavings: Math.max(0, Math.round(spent - b.monthly_limit)),
        confidence: 96,
        dataUsed: [`${cname} budget`, `${cname} transactions this month`],
        lastUpdated: ts,
        priorityReason: `Utilization at ${Math.round(pct)}% of budget.`,
        calculation: `spent ÷ budget = ${Math.round(spent)} ÷ ${Math.round(b.monthly_limit)} = ${Math.round(pct)}%`,
        isPredictive: false,
        context: { categoryId: b.category_id },
        actions: ["view-transactions", "ask-coach", "create-budget", "remind-later", "dismiss"],
      });
    } else if (pct >= 70 && dayOfMonth <= dim - 3) {
      // Predictive: at current pace, when will we cross?
      const perDay = spent / Math.max(1, dayOfMonth);
      const daysToExceed = perDay > 0 ? Math.ceil((b.monthly_limit - spent) / perDay) : Infinity;
      const willExceed = dayOfMonth + daysToExceed <= dim;
      if (willExceed) {
        alerts.push({
          id: `budget-forecast:${b.id}`,
          kind: "budget-forecast",
          priority: pct >= 90 ? "high" : "medium",
          title: `${cname} Budget Forecast`,
          problem: `At current pace you'll exceed the ${cname} budget in ${daysToExceed} day${daysToExceed === 1 ? "" : "s"}.`,
          why: `Daily average in ${cname} is ₹${Math.round(perDay).toLocaleString("en-IN")}, which crosses ₹${Math.round(b.monthly_limit).toLocaleString("en-IN")} before month end.`,
          impact: `Projected month-end ${cname} spend: ₹${Math.round(perDay * dim).toLocaleString("en-IN")}.`,
          suggestion: `Cap ${cname} at ₹${Math.round((b.monthly_limit - spent) / Math.max(1, dim - dayOfMonth)).toLocaleString("en-IN")}/day.`,
          estimatedSavings: Math.round(Math.max(0, perDay * dim - b.monthly_limit)),
          confidence: 78,
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
      why: `Monthly EMI ₹${Math.round(survival.monthlyEmi).toLocaleString("en-IN")} vs salary ₹${Math.round(survival.salary).toLocaleString("en-IN")}.`,
      impact: `Leaves little room for savings, investments, or unexpected expenses.`,
      suggestion: `Prioritise closing the highest-interest loan; avoid new EMIs.`,
      estimatedSavings: 0,
      confidence: 95,
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
      alerts.push({
        id: `emi-due:${l.id}`,
        kind: "emi-due",
        priority: days <= 1 ? "critical" : days <= 3 ? "high" : "medium",
        title: isCard ? "Credit Card Payment Due" : "EMI Due Soon",
        problem: `₹${Math.round(Number(l.emi_amount)).toLocaleString("en-IN")} (${l.loan_name}) due in ${days} day${days === 1 ? "" : "s"}.`,
        why: `Loan due day is the ${dueDay}${dueDay === 1 ? "st" : dueDay === 2 ? "nd" : dueDay === 3 ? "rd" : "th"} of each month.`,
        impact: `Missing this ${isCard ? "card payment" : "EMI"} may add late fees and hurt credit score.`,
        suggestion: `Ensure ₹${Math.round(Number(l.emi_amount)).toLocaleString("en-IN")} is available before ${due.toLocaleDateString()}.`,
        estimatedSavings: Math.round(Number(l.emi_amount) * 0.02),
        confidence: 99,
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

  // 7. Emergency fund below target
  const emergency = goals.find((g) => /emergency/i.test(g.name));
  if (emergency && emergency.target > 0) {
    const pct = (emergency.current / emergency.target) * 100;
    if (pct < 50) {
      alerts.push({
        id: `emergency-fund:${emergency.id}`,
        kind: "emergency-fund-low",
        priority: pct < 20 ? "high" : "medium",
        title: "Emergency Fund Below Target",
        problem: `Emergency fund at ${Math.round(pct)}% of ₹${Math.round(emergency.target).toLocaleString("en-IN")}.`,
        why: `Recommended cushion is 3–6 months of expenses; you're below half.`,
        impact: `Unexpected expenses could force loans or missed EMIs.`,
        suggestion: `Redirect ₹${Math.max(500, Math.round((emergency.target - emergency.current) / 12)).toLocaleString("en-IN")}/month to emergency fund.`,
        estimatedSavings: 0,
        confidence: 82,
        dataUsed: ["Emergency goal target", "Emergency goal balance"],
        lastUpdated: ts,
        priorityReason: `Fund is below 50% of target.`,
        calculation: `current ÷ target = ${Math.round(emergency.current)} ÷ ${Math.round(emergency.target)} = ${pct.toFixed(1)}%`,
        isPredictive: false,
        context: { goalId: emergency.id },
        actions: ["ask-coach", "apply-planner", "remind-later", "dismiss"],
      });
    }
  }

  // 8. Goal falling behind (monthly plan vs elapsed months)
  for (const g of goals) {
    if (!g.deadline || g.target <= 0) continue;
    const deadline = new Date(g.deadline);
    const monthsLeft = Math.max(0, (deadline.getFullYear() - y) * 12 + (deadline.getMonth() - m));
    if (monthsLeft === 0) continue;
    const needed = (g.target - g.current) / monthsLeft;
    if (g.monthly > 0 && needed > g.monthly * 1.25) {
      alerts.push({
        id: `goal-behind:${g.id}`,
        kind: "goal-behind",
        priority: needed > g.monthly * 2 ? "high" : "medium",
        title: `${g.name} Falling Behind`,
        problem: `Need ₹${Math.round(needed).toLocaleString("en-IN")}/month to hit target; currently saving ₹${Math.round(g.monthly).toLocaleString("en-IN")}.`,
        why: `Remaining ₹${Math.round(g.target - g.current).toLocaleString("en-IN")} over ${monthsLeft} months requires a higher monthly contribution.`,
        impact: `Deadline may slip by ~${Math.max(1, Math.round(needed / Math.max(1, g.monthly)))} months.`,
        suggestion: `Increase monthly contribution by ₹${Math.round(needed - g.monthly).toLocaleString("en-IN")}.`,
        estimatedSavings: Math.round(needed - g.monthly),
        confidence: 80,
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

  // 9. Investment skipped (no investment tx this month, but was in last month)
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
  const lastMonthInv = transactions.some((t) => {
    if (t.type !== "expense") return false;
    const d = new Date(t.transaction_date);
    const pm = m === 0 ? 11 : m - 1;
    const py = m === 0 ? y - 1 : y;
    return d.getFullYear() === py && d.getMonth() === pm && isInvestmentCat(t.category_id);
  });
  if (!thisMonthInv && lastMonthInv && dayOfMonth > 20) {
    alerts.push({
      id: "investment-skipped",
      kind: "investment-skipped",
      priority: "medium",
      title: "Investment Skipped This Month",
      problem: `No investment transaction logged this month.`,
      why: `You invested last month, but nothing appears this month past the 20th.`,
      impact: `Skipping one SIP can delay financial goals and break compounding.`,
      suggestion: `Log or schedule a SIP contribution before month-end.`,
      estimatedSavings: 0,
      confidence: 70,
      dataUsed: ["Investment category transactions"],
      lastUpdated: ts,
      priorityReason: `Pattern break vs previous month.`,
      calculation: `count(investment tx this month) = 0; last month > 0`,
      isPredictive: true,
      actions: ["ask-coach", "apply-planner", "mark-resolved", "dismiss"],
    });
  }

  // 10. Salary delay
  if (survival.hasIncome && salarySettings.payDay != null) {
    const expectedDay = salarySettings.payDay === 0 ? dim : Math.min(salarySettings.payDay, dim);
    if (dayOfMonth > expectedDay + 1) {
      // Was salary credited within last 5 days?
      const recentIncome = transactions.some((t) => {
        if (t.type !== "income") return false;
        const d = new Date(t.transaction_date);
        return (now.getTime() - d.getTime()) / 86_400_000 < 5;
      });
      if (!recentIncome) {
        alerts.push({
          id: "salary-delay",
          kind: "salary-delay",
          priority: "high",
          title: "Salary Appears Delayed",
          problem: `Expected salary on day ${expectedDay} — not detected as of day ${dayOfMonth}.`,
          why: `No income transaction logged within the last 5 days.`,
          impact: `Cash flow, EMIs and SIPs may be affected.`,
          suggestion: `Verify salary credit and log it once received.`,
          estimatedSavings: 0,
          confidence: 65,
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

  // 11. Unusual spending (single transaction > 3× category average)
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
    alerts.push({
      id: `unusual:${recentBig.id}`,
      kind: "unusual-spending",
      priority: "medium",
      title: "Unusual Transaction Detected",
      problem: `₹${Math.round(Number(recentBig.amount)).toLocaleString("en-IN")} in ${cname} — ${(Number(recentBig.amount) / avg).toFixed(1)}× your usual.`,
      why: `Amount is more than 3× the average ${cname} transaction.`,
      impact: `One-off spikes can quietly break the monthly budget.`,
      suggestion: `Review and re-categorise if needed.`,
      estimatedSavings: 0,
      confidence: 72,
      dataUsed: [`${cname} transactions history`],
      lastUpdated: ts,
      priorityReason: `Amount exceeds 3× rolling average.`,
      calculation: `amount ÷ avg = ${Math.round(Number(recentBig.amount))} ÷ ${Math.round(avg)} = ${(Number(recentBig.amount) / avg).toFixed(1)}×`,
      isPredictive: false,
      context: { categoryId: recentBig.category_id ?? undefined },
      actions: ["view-transactions", "ask-coach", "mark-resolved", "dismiss"],
    });
  }

  // 12. Subscription increase (same merchant/notes repeats > last month)
  // Heuristic: expenses with identical notes appearing both last and this month, amount up.
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
      alerts.push({
        id: `sub-increase:${k}`,
        kind: "subscription-increase",
        priority: "low",
        title: "Subscription Price Increased",
        problem: `"${k}" charged ₹${Math.round(cur).toLocaleString("en-IN")} this month, up from ₹${Math.round(prev).toLocaleString("en-IN")}.`,
        why: `Same recurring entry as last month, but ${Math.round(((cur - prev) / prev) * 100)}% higher.`,
        impact: `Small increases compound — ₹${Math.round((cur - prev) * 12).toLocaleString("en-IN")}/year if kept.`,
        suggestion: `Review the subscription; downgrade or cancel if unused.`,
        estimatedSavings: Math.round((cur - prev) * 12),
        confidence: 68,
        dataUsed: ["Transaction notes", "Last month expenses"],
        lastUpdated: ts,
        priorityReason: `Recurring charge up >15%.`,
        calculation: `now − prev = ${Math.round(cur)} − ${Math.round(prev)} = ${Math.round(cur - prev)}`,
        isPredictive: false,
        actions: ["view-transactions", "ask-coach", "mark-resolved", "dismiss"],
      });
      break; // one is enough
    }
  }

  // 13. Predictive survival score drop
  if (survival.score > 0 && survival.spentToday > survival.safeDaily * 1.5 && survival.daysRemaining > 3) {
    const projectedDrop = Math.min(30, Math.round((survival.spentToday / Math.max(1, survival.safeDaily) - 1) * 8));
    if (projectedDrop >= 3) {
      alerts.push({
        id: "predictive-score",
        kind: "predictive-score",
        priority: projectedDrop >= 10 ? "high" : "medium",
        title: "Survival Score at Risk",
        problem: `If today's pace continues, Survival Score may drop by ~${projectedDrop} points.`,
        why: `Overshooting safe daily consistently reduces the buffer and pace components.`,
        impact: `Lower score → tighter safe daily → less flexibility for the rest of the cycle.`,
        suggestion: `Skip one discretionary purchase to protect the score.`,
        estimatedSavings: Math.round(survival.spentToday - survival.safeDaily),
        confidence: 74,
        dataUsed: ["Today's spend", "Safe daily", "Days remaining"],
        lastUpdated: ts,
        priorityReason: `Sustained overshoot for ${survival.daysRemaining} days.`,
        calculation: `drop = min(30, (spent/safe − 1) × 8) = ${projectedDrop}`,
        isPredictive: true,
        actions: ["ask-coach", "apply-planner", "dismiss"],
      });
    }
  }

  // Sort: highest priority first, then predictive last within same tier
  alerts.sort((a, b) => {
    const w = PRIORITY_META[b.priority].weight - PRIORITY_META[a.priority].weight;
    if (w !== 0) return w;
    return Number(a.isPredictive) - Number(b.isPredictive);
  });

  return alerts;
}

// ---------- summary ----------
export interface AlertsSummary {
  totalActive: number;
  highestPriority: AlertPriority | null;
  potentialSavings: number;
  /** 0-100, higher = more risk */
  financialRiskScore: number;
}

export function summarize(alerts: DangerAlert[]): AlertsSummary {
  const totalActive = alerts.length;
  const highestPriority = alerts[0]?.priority ?? null;
  const potentialSavings = alerts.reduce((s, a) => s + (a.estimatedSavings || 0), 0);
  const raw = alerts.reduce((s, a) => s + PRIORITY_META[a.priority].weight * 8, 0);
  const financialRiskScore = Math.min(100, raw);
  return { totalActive, highestPriority, potentialSavings, financialRiskScore };
}
