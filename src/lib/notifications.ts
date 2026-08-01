// Smart Notifications engine for FinTrackr.
// Pure function over real user data — salary settings, transactions, and the
// stored FinancialProfile (rent / bills / EMI). Nothing is hardcoded and no
// values are invented; if a data point is missing the related notification is
// simply omitted.

import type { Loan, Transaction, Category } from "@/hooks/use-finance";
import type { SalarySettings } from "@/hooks/use-salary-settings";
import {
  getFinancialProfile,
  getRememberedSavings,
  onProfileUpdated,
} from "@/lib/financial-profile";
import { computeSurvival } from "@/lib/survival";
import { computeWeeklyBudget } from "@/lib/survival-preferences";
import {
  daysUntilSalary,
  lastSalaryDate,
  payDayInMonth,
} from "@/lib/salary-cycle";

export type NotifPriority = "High" | "Medium" | "Low";
export type NotifGroup = "Today" | "Upcoming" | "Completed";
export type NotifKind = "salary" | "budget" | "bill" | "emi" | "ai" | "goal" | "risk";

export type NotifActionKind = "link" | "coach" | "planner" | "done";

export type NotifAction = {
  label: string;
  to?: string; // internal route
  /** Behaviour of the button. Defaults to "link" when `to` is set. */
  kind?: NotifActionKind;
  /** Payload used when kind === "planner". */
  plannerTask?: { id: string; title: string; detail?: string };
};


export type NotificationItem = {
  id: string;
  kind: NotifKind;
  title: string;
  message: string;
  priority: NotifPriority;
  group: NotifGroup;
  /** ISO timestamp — when the *event* the notification is about occurs. */
  eventAt: string;
  /** ISO timestamp — when the notification was generated. */
  generatedAt: string;
  action?: NotifAction;
  /** Extra secondary actions (Ask AI Coach / Apply to Planner / Mark Done). */
  actions?: NotifAction[];

};

// ----------------- persistence -----------------

const DISMISSED_KEY = "fintrackr:notifications:dismissed:v1";
const COMPLETED_KEY = "fintrackr:notifications:completed:v1";
const UPDATED_EVENT = "fintrackr:notifications:updated";

function readSet(key: string): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(key);
    return new Set<string>(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}
function writeSet(key: string, set: Set<string>) {
  try {
    localStorage.setItem(key, JSON.stringify([...set]));
    window.dispatchEvent(new Event(UPDATED_EVENT));
  } catch {
    /* ignore */
  }
}

export function getDismissed(): Set<string> {
  return readSet(DISMISSED_KEY);
}
export function getCompleted(): Set<string> {
  return readSet(COMPLETED_KEY);
}
export function dismissNotification(id: string) {
  const s = getDismissed();
  s.add(id);
  writeSet(DISMISSED_KEY, s);
}
export function completeNotification(id: string) {
  const s = getCompleted();
  s.add(id);
  writeSet(COMPLETED_KEY, s);
}
export function undoDismiss(id: string) {
  const s = getDismissed();
  s.delete(id);
  writeSet(DISMISSED_KEY, s);
}

/** Fire a manual refresh of every notification consumer. */
export function notifyNotificationsChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(UPDATED_EVENT));
}

export function onNotificationsChanged(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = () => cb();
  window.addEventListener(UPDATED_EVENT, handler);
  window.addEventListener("storage", handler);
  // Goals / bills / planner data live in localStorage and are edited on other
  // screens in the same tab (no `storage` event), so re-derive on focus too.
  window.addEventListener("focus", handler);
  document.addEventListener("visibilitychange", handler);
  window.addEventListener("fintrackr:salary-updated", handler);
  const off = onProfileUpdated(cb);
  return () => {
    window.removeEventListener(UPDATED_EVENT, handler);
    window.removeEventListener("storage", handler);
    window.removeEventListener("focus", handler);
    document.removeEventListener("visibilitychange", handler);
    window.removeEventListener("fintrackr:salary-updated", handler);
    off();
  };
}

// ----------------- helpers -----------------

const DAY_MS = 86_400_000;

export type RiskLevel = "Safe" | "Careful" | "Danger";

const SCORE_SNAPSHOT_KEY = "fintrackr:notifications:score:v1";
const GOALS_KEY = "fintrackr_goals_v1";

type ScoreSnapshot = { score: number; risk: RiskLevel; dateKey: string };

function readScoreSnapshot(): ScoreSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(SCORE_SNAPSHOT_KEY);
    return raw ? (JSON.parse(raw) as ScoreSnapshot) : null;
  } catch {
    return null;
  }
}
function writeScoreSnapshot(s: ScoreSnapshot) {
  if (typeof window === "undefined") return;
  const prev = readScoreSnapshot();
  // Only roll the baseline forward once per day so deltas stay meaningful.
  if (prev && prev.dateKey === s.dateKey) return;
  try {
    localStorage.setItem(SCORE_SNAPSHOT_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

export type StoredGoal = {
  id: string;
  name: string;
  target: number;
  current: number;
  monthly: number;
};

function readGoals(): StoredGoal[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(GOALS_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? (arr as StoredGoal[]) : [];
  } catch {
    return [];
  }
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function toKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function daysBetween(a: Date, b: Date): number {
  return Math.round((startOfDay(a).getTime() - startOfDay(b).getTime()) / DAY_MS);

}

// ----------------- generator -----------------

export type NotificationInputs = {
  salarySettings: SalarySettings;
  transactions: Transaction[];
  loans?: Loan[];
  categories?: Category[];
  now?: Date;
};


export function computeNotifications({
  salarySettings,
  transactions,
  loans = [],
  categories = [],
  now = new Date(),
}: NotificationInputs): NotificationItem[] {

  const today = startOfDay(now);
  const todayKey = toKey(today);
  const profile = getFinancialProfile();
  const items: NotificationItem[] = [];

  // -------- SALARY --------
  const payDay = salarySettings.payDay ?? (profile.salaryDate
    ? new Date(profile.salaryDate).getDate()
    : null);
  const salaryAmount = salarySettings.amount ?? profile.monthlySalary ?? null;

  if (payDay != null) {
    const nextSalary =
      daysUntilSalary(payDay, today) === 0
        ? today
        : new Date(today.getTime() + daysUntilSalary(payDay, today) * DAY_MS);
    const daysToPay = daysBetween(nextSalary, today);
    const lastPay = lastSalaryDate(payDay, today);

    // Detect if salary was credited this cycle: any income tx on/after lastPay
    const cycleIncome = transactions.filter(
      (t) =>
        t.type === "income" &&
        String(t.transaction_date).slice(0, 10) >= toKey(lastPay) &&
        String(t.transaction_date).slice(0, 10) <= todayKey,
    );
    const salaryCreditedThisCycle = cycleIncome.length > 0;
    const lastIncomeKey = cycleIncome
      .map((t) => String(t.transaction_date).slice(0, 10))
      .sort()
      .pop();

    if (daysToPay === 0) {
      items.push({
        id: `salary-today-${toKey(nextSalary)}`,
        kind: "salary",
        title: salaryCreditedThisCycle ? "Salary received today 🎉" : "Payday is today",
        message: salaryCreditedThisCycle
          ? salaryAmount
            ? `Your salary of ₹${salaryAmount.toLocaleString()} looks credited. Time to plan the month.`
            : "Salary appears credited. Time to plan the month."
          : "Your salary is expected today. We'll confirm once we see the credit.",
        priority: "High",
        group: "Today",
        eventAt: nextSalary.toISOString(),
        generatedAt: now.toISOString(),
        action: { label: "Open Planner", to: "/planner" },
      });
    } else if (daysToPay === 1) {
      items.push({
        id: `salary-tomorrow-${toKey(nextSalary)}`,
        kind: "salary",
        title: "Payday tomorrow",
        message: salaryAmount
          ? `₹${salaryAmount.toLocaleString()} lands tomorrow. Review pending bills before it hits.`
          : "Salary lands tomorrow. Review pending bills before it hits.",
        priority: "Medium",
        group: "Today",
        eventAt: nextSalary.toISOString(),
        generatedAt: now.toISOString(),
        action: { label: "Review Bills", to: "/insights/ai-coach" },
      });
    } else if (daysToPay > 0 && daysToPay <= 3) {
      items.push({
        id: `salary-in-${daysToPay}d-${toKey(nextSalary)}`,
        kind: "salary",
        title: `${daysToPay} days until payday`,
        message: "Stretch what you have — check your safe daily spend.",
        priority: "Medium",
        group: "Upcoming",
        eventAt: nextSalary.toISOString(),
        generatedAt: now.toISOString(),
        action: { label: "Safe Spend", to: "/planner" },
      });
    }

    // Salary delayed: it's already past payDay this month and no income yet.
    const thisMonthPay = payDayInMonth(today.getFullYear(), today.getMonth(), payDay);
    if (
      thisMonthPay.getTime() <= today.getTime() &&
      !salaryCreditedThisCycle &&
      daysBetween(today, thisMonthPay) >= 1
    ) {
      const late = daysBetween(today, thisMonthPay);
      items.push({
        id: `salary-delayed-${toKey(thisMonthPay)}`,
        kind: "salary",
        title: `Salary delayed by ${late} day${late === 1 ? "" : "s"}`,
        message: "We haven't seen your salary credit yet. Consider stretching essentials.",
        priority: "High",
        group: "Today",
        eventAt: thisMonthPay.toISOString(),
        generatedAt: now.toISOString(),
        action: { label: "Adjust Plan", to: "/planner" },
      });
    }

    // Salary credited (today's income tx date)
    if (salaryCreditedThisCycle && lastIncomeKey === todayKey) {
      const total = cycleIncome
        .filter((t) => String(t.transaction_date).slice(0, 10) === todayKey)
        .reduce((s, t) => s + Number(t.amount), 0);
      items.push({
        id: `salary-credited-${todayKey}`,
        kind: "salary",
        title: "Salary credited",
        message: `₹${total.toLocaleString()} received today. Log fixed bills first.`,
        priority: "High",
        group: "Today",
        eventAt: now.toISOString(),
        generatedAt: now.toISOString(),
        action: { label: "Add Bills", to: "/transactions" },
      });
    }
  }

  // -------- WEEKLY BUDGET --------
  // Week starts Monday. Weekly budget = discretionary share of monthly salary
  // (salary − rent − bills − EMI) divided by ~4.33.
  if (salaryAmount && salaryAmount > 0) {
    const fixed =
      (profile.monthlyRent ?? 0) +
      (profile.monthlyEmi ?? 0) +
      // Bills are variable-ish, but we treat them as fixed for the weekly
      // discretionary calc so we don't overstate the budget.
      0;
    const discretionaryMonthly = Math.max(0, salaryAmount - fixed);
    const weeklyBudget = computeWeeklyBudget(discretionaryMonthly);

    if (weeklyBudget > 0) {
      const dayOfWeek = (today.getDay() + 6) % 7; // Mon=0
      const weekStart = new Date(today.getTime() - dayOfWeek * DAY_MS);
      const weekStartKey = toKey(weekStart);

      const spent = transactions
        .filter(
          (t) =>
            t.type === "expense" &&
            String(t.transaction_date).slice(0, 10) >= weekStartKey &&
            String(t.transaction_date).slice(0, 10) <= todayKey,
        )
        .reduce((s, t) => s + Number(t.amount), 0);

      const pct = (spent / weeklyBudget) * 100;
      const left = Math.max(0, weeklyBudget - spent);
      const daysLeftInWeek = 7 - dayOfWeek;
      const safeDaily = left / Math.max(1, daysLeftInWeek);

      const tier =
        pct >= 100 ? 100 : pct >= 90 ? 90 : pct >= 75 ? 75 : pct >= 50 ? 50 : 0;
      if (tier > 0) {
        const suggestion =
          tier >= 100
            ? "Pause discretionary spends until next Monday."
            : tier >= 90
              ? "Only essentials for the rest of the week."
              : tier >= 75
                ? `Keep spends under ₹${Math.round(safeDaily).toLocaleString()}/day.`
                : `You still have ₹${Math.round(left).toLocaleString()} — pace yourself.`;
        items.push({
          id: `budget-${weekStartKey}-${tier}`,
          kind: "budget",
          title:
            tier >= 100
              ? "Weekly budget maxed out"
              : `Weekly budget at ${tier}%`,
          message: `₹${Math.round(left).toLocaleString()} left · safe daily ₹${Math.round(safeDaily).toLocaleString()} · ${suggestion}`,
          priority: tier >= 90 ? "High" : tier >= 75 ? "Medium" : "Low",
          group: "Today",
          eventAt: now.toISOString(),
          generatedAt: now.toISOString(),
          action: { label: "See Planner", to: "/planner" },
        });
      }
    }
  }

  // -------- BILLS & EMI --------
  // Derived from FinancialProfile — same offsets used by coach-plan.
  if (payDay != null) {
    const bills: Array<{ name: string; amount: number; offset: number; kind: NotifKind }> = [];
    if ((profile.monthlyRent ?? 0) > 0)
      bills.push({ name: "Rent", amount: profile.monthlyRent!, offset: 0, kind: "bill" });
    // Bills/utilities are only present when explicitly stored on the profile.
    // We surface EMI separately.
    if ((profile.monthlyEmi ?? 0) > 0)
      bills.push({ name: "EMI", amount: profile.monthlyEmi!, offset: 10, kind: "emi" });

    for (const b of bills) {
      // Compute this cycle's due date: payDay of current month + offset,
      // roll to next month if already past.
      const base = payDayInMonth(today.getFullYear(), today.getMonth(), payDay);
      let due = new Date(base.getTime() + b.offset * DAY_MS);
      if (due.getTime() < today.getTime() - 3 * DAY_MS) {
        const nextBase = payDayInMonth(
          today.getFullYear(),
          today.getMonth() + 1,
          payDay,
        );
        due = new Date(nextBase.getTime() + b.offset * DAY_MS);
      }
      const diff = daysBetween(due, today);
      const dueKey = toKey(due);
      const label = b.kind === "emi" ? "EMI" : b.name;

      const push = (
        suffix: string,
        title: string,
        message: string,
        priority: NotifPriority,
        group: NotifGroup,
      ) => {
        items.push({
          id: `${b.kind}-${label.toLowerCase()}-${dueKey}-${suffix}`,
          kind: b.kind,
          title,
          message,
          priority,
          group,
          eventAt: due.toISOString(),
          generatedAt: now.toISOString(),
          action: { label: "Mark Paid", to: "/insights/ai-coach" },
        });
      };

      if (diff === 7) {
        push(
          "7d",
          `${label} due in 7 days`,
          `₹${b.amount.toLocaleString()} due on ${due.toLocaleDateString(undefined, { day: "numeric", month: "short" })}.`,
          "Low",
          "Upcoming",
        );
      } else if (diff === 3) {
        push(
          "3d",
          `${label} due in 3 days`,
          `₹${b.amount.toLocaleString()} — set aside cash to avoid a squeeze.`,
          "Medium",
          "Upcoming",
        );
      } else if (diff === 1) {
        push(
          "1d",
          `${label} due tomorrow`,
          `Pay ₹${b.amount.toLocaleString()} to stay on track.`,
          "High",
          "Upcoming",
        );
      } else if (diff === 0) {
        push(
          "today",
          b.kind === "emi" ? "EMI due today" : `${label} due today`,
          `₹${b.amount.toLocaleString()} is due today.`,
          "High",
          "Today",
        );
      } else if (diff < 0 && diff >= -3) {
        push(
          `overdue-${Math.abs(diff)}`,
          `${label} overdue by ${Math.abs(diff)} day${diff === -1 ? "" : "s"}`,
          `₹${b.amount.toLocaleString()} — pay now to avoid late fees.`,
          "High",
          "Today",
        );
      }
    }
  }

  // -------- SURVIVAL SNAPSHOT (real data) --------
  const survival = computeSurvival({
    transactions,
    loans: loans.map((l) => ({
      remaining_balance: l.remaining_balance,
      emi_amount: l.emi_amount,
    })),
    salarySettings,
    now,
  });
  const riskLevel: RiskLevel =
    survival.score >= 70 ? "Safe" : survival.score >= 45 ? "Careful" : "Danger";

  const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

  // -------- FEATURE 5: AI RECOMMENDATIONS --------
  // Every item below is derived from actual spend / salary / savings data.
  const catName = new Map(categories.map((c) => [c.id, c.name]));
  const cycleStartKey = toKey(survival.lastSalaryDate);
  const cycleExpenses = transactions.filter(
    (t) =>
      t.type === "expense" &&
      String(t.transaction_date).slice(0, 10) >= cycleStartKey &&
      String(t.transaction_date).slice(0, 10) <= todayKey,
  );
  const daysElapsed = Math.max(1, daysBetween(today, survival.lastSalaryDate) + 1);

  // 5a. Category overspend today vs its own cycle daily average.
  const byCat = new Map<string, { total: number; todayTotal: number }>();
  for (const t of cycleExpenses) {
    const name = (t.category_id && catName.get(t.category_id)) || t.subcategory || "Other";
    const cur = byCat.get(name) ?? { total: 0, todayTotal: 0 };
    cur.total += Number(t.amount);
    if (String(t.transaction_date).slice(0, 10) === todayKey) cur.todayTotal += Number(t.amount);
    byCat.set(name, cur);
  }
  const topOver = [...byCat.entries()]
    .map(([name, v]) => ({ name, ...v, avg: v.total / daysElapsed }))
    .filter((c) => c.avg > 0 && c.todayTotal > c.avg * 1.5)
    .sort((a, b) => b.todayTotal - a.todayTotal)[0];
  if (topOver) {
    items.push({
      id: `ai-category-${todayKey}-${topOver.name.toLowerCase()}`,
      kind: "ai",
      title: `Reduce ${topOver.name} spending today`,
      message: `${inr(topOver.todayTotal)} on ${topOver.name} today vs your ${inr(topOver.avg)}/day average this cycle.`,
      priority: "Medium",
      group: "Today",
      eventAt: now.toISOString(),
      generatedAt: now.toISOString(),
      action: { label: "View Details", to: "/insights/behavior" },
      actions: [
        { label: "Ask AI Coach", to: "/insights/ai-coach", kind: "coach" },
        {
          label: "Apply to Planner",
          kind: "planner",
          plannerTask: {
            id: `notif-cat-${topOver.name.toLowerCase()}`,
            title: `Cap ${topOver.name} at ${inr(topOver.avg)}/day`,
            detail: `Suggested after spending ${inr(topOver.todayTotal)} today.`,
          },
        },
      ],
    });
  }

  // 5b. Skip discretionary shopping when today's spend exceeds the safe daily.
  if (survival.safeDaily > 0 && survival.spentToday > survival.safeDaily) {
    const over = survival.spentToday - survival.safeDaily;
    items.push({
      id: `ai-skip-shopping-${todayKey}`,
      kind: "ai",
      title: "Skip unnecessary shopping today",
      message: `You're ${inr(over)} over your safe daily spend of ${inr(survival.safeDaily)} with ${survival.daysRemaining} day${survival.daysRemaining === 1 ? "" : "s"} to payday.`,
      priority: over > survival.safeDaily ? "High" : "Medium",
      group: "Today",
      eventAt: now.toISOString(),
      generatedAt: now.toISOString(),
      action: { label: "View Details", to: "/planner" },
      actions: [{ label: "Ask AI Coach", to: "/insights/ai-coach", kind: "coach" }],
    });
  }

  // 5c. Emergency-fund top-up sized from the user's real surplus.
  const savings = getRememberedSavings();
  const monthlySalary = salaryAmount ?? survival.salary ?? null;
  if (monthlySalary && monthlySalary > 0) {
    const targetFund = monthlySalary * 3;
    const cycleSpend = cycleExpenses.reduce((s, t) => s + Number(t.amount), 0);
    const surplus = monthlySalary - cycleSpend;
    if (savings != null && savings < targetFund && surplus > 0) {
      const topUp = Math.max(100, Math.round((surplus * 0.1) / 100) * 100);
      items.push({
        id: `ai-emergency-${todayKey}`,
        kind: "ai",
        title: `Increase emergency fund by ${inr(topUp)}`,
        message: `Fund is ${inr(savings)} of a ${inr(targetFund)} (3-month) target. You have ${inr(surplus)} unspent this cycle.`,
        priority: "Low",
        group: "Today",
        eventAt: now.toISOString(),
        generatedAt: now.toISOString(),
        action: { label: "View Details", to: "/goals" },
        actions: [
          {
            label: "Apply to Planner",
            kind: "planner",
            plannerTask: {
              id: "notif-emergency-topup",
              title: `Move ${inr(topUp)} to emergency fund`,
              detail: `Current ${inr(savings)} → target ${inr(targetFund)}.`,
            },
          },
        ],
      });
    }
  }

  // 5d. Weekly review — only when the week actually has transactions.
  const dow = (today.getDay() + 6) % 7; // Mon = 0
  const weekStart = new Date(today.getTime() - dow * DAY_MS);
  const weekTx = transactions.filter(
    (t) =>
      t.type === "expense" &&
      String(t.transaction_date).slice(0, 10) >= toKey(weekStart) &&
      String(t.transaction_date).slice(0, 10) <= todayKey,
  );
  if (dow >= 5 && weekTx.length > 0) {
    const weekSpend = weekTx.reduce((s, t) => s + Number(t.amount), 0);
    items.push({
      id: `ai-weekly-review-${toKey(weekStart)}`,
      kind: "ai",
      title: "Review this week's spending",
      message: `${weekTx.length} expense${weekTx.length === 1 ? "" : "s"} totalling ${inr(weekSpend)} this week.`,
      priority: "Low",
      group: "Today",
      eventAt: now.toISOString(),
      generatedAt: now.toISOString(),
      action: { label: "View Details", to: "/insights/weekly" },
    });
  }

  // 5e. Survival Score improved (compared against the stored previous score).
  const prev = readScoreSnapshot();
  if (prev && prev.dateKey !== todayKey) {
    const delta = survival.score - prev.score;
    if (delta >= 5) {
      items.push({
        id: `ai-score-up-${todayKey}`,
        kind: "ai",
        title: "Your Survival Score improved 🎉",
        message: `Up ${delta} points to ${survival.score}/100 since ${prev.dateKey}. Keep the same pace.`,
        priority: "Low",
        group: "Today",
        eventAt: now.toISOString(),
        generatedAt: now.toISOString(),
        action: { label: "View Details", to: "/insights/ai-coach" },
      });
    } else if (delta <= -5) {
      items.push({
        id: `risk-score-drop-${todayKey}`,
        kind: "risk",
        title: `Survival Score dropped ${Math.abs(delta)} points`,
        message: `Now ${survival.score}/100 (was ${prev.score}). Spending pace or buffer weakened.`,
        priority: "High",
        group: "Today",
        eventAt: now.toISOString(),
        generatedAt: now.toISOString(),
        action: { label: "View Details", to: "/insights/alerts" },
        actions: [{ label: "Ask AI Coach", to: "/insights/ai-coach", kind: "coach" }],
      });
    }
    if (prev.risk !== riskLevel) {
      items.push({
        id: `risk-level-${todayKey}-${riskLevel.toLowerCase()}`,
        kind: "risk",
        title: `Risk level changed to ${riskLevel}`,
        message: `Previously ${prev.risk}. Based on ${inr(survival.salaryLeft)} left over ${survival.daysRemaining} day${survival.daysRemaining === 1 ? "" : "s"}.`,
        priority: riskLevel === "Danger" ? "High" : "Medium",
        group: "Today",
        eventAt: now.toISOString(),
        generatedAt: now.toISOString(),
        action: { label: "View Details", to: "/insights/alerts" },
      });
    }
  }
  writeScoreSnapshot({ score: survival.score, risk: riskLevel, dateKey: todayKey });

  // -------- FEATURE 6: GOAL PROGRESS ALERTS --------
  for (const g of readGoals()) {
    if (!g || !(g.target > 0)) continue;
    const pct = (g.current / g.target) * 100;
    const tier = pct >= 100 ? 100 : pct >= 75 ? 75 : pct >= 50 ? 50 : pct >= 25 ? 25 : 0;
    if (tier === 0) continue;
    const remaining = Math.max(0, g.target - g.current);
    const monthly = Number(g.monthly) || 0;
    const etaMonths = remaining > 0 && monthly > 0 ? Math.ceil(remaining / monthly) : null;
    const eta =
      remaining <= 0
        ? "Completed"
        : etaMonths != null
          ? `~${etaMonths} month${etaMonths === 1 ? "" : "s"} at ${inr(monthly)}/mo`
          : "Add a monthly contribution for an ETA";
    items.push({
      id: `goal-${g.id}-${tier}`,
      kind: "goal",
      title:
        tier === 100
          ? `Goal reached: ${g.name} 🎉`
          : `${g.name} is ${tier}% funded`,
      message: `${inr(g.current)} of ${inr(g.target)} · ${inr(remaining)} remaining · ETA ${eta}`,
      priority: tier === 100 ? "High" : tier >= 75 ? "Medium" : "Low",
      group: tier === 100 ? "Today" : "Upcoming",
      eventAt: now.toISOString(),
      generatedAt: now.toISOString(),
      action: { label: "View Details", to: "/goals" },
      actions:
        tier === 100
          ? []
          : [
              {
                label: "Apply to Planner",
                kind: "planner",
                plannerTask: {
                  id: `notif-goal-${g.id}`,
                  title: `Fund ${g.name}${monthly > 0 ? ` — ${inr(monthly)} this month` : ""}`,
                  detail: `${inr(remaining)} remaining of ${inr(g.target)}.`,
                },
              },
            ],
    });
  }

  // -------- FEATURE 7: FINANCIAL RISK ALERTS --------
  // 7a. Emergency fund too low (< 1 month of salary).
  if (monthlySalary && monthlySalary > 0 && savings != null && savings < monthlySalary) {
    items.push({
      id: `risk-emergency-low-${todayKey}`,
      kind: "risk",
      title: "Emergency fund too low",
      message: `${inr(savings)} saved — under one month of salary (${inr(monthlySalary)}).`,
      priority: "Medium",
      group: "Today",
      eventAt: now.toISOString(),
      generatedAt: now.toISOString(),
      action: { label: "View Details", to: "/goals" },
      actions: [{ label: "Ask AI Coach", to: "/insights/ai-coach", kind: "coach" }],
    });
  }

  // 7b. Weekly overspending vs the safe daily pace.
  if (survival.safeDaily > 0 && weekTx.length > 0) {
    const weekSpend = weekTx.reduce((s, t) => s + Number(t.amount), 0);
    const weekPace = survival.safeDaily * (dow + 1);
    if (weekSpend > weekPace * 1.2) {
      items.push({
        id: `risk-week-overspend-${toKey(weekStart)}`,
        kind: "risk",
        title: "Weekly overspending detected",
        message: `${inr(weekSpend)} spent vs ${inr(weekPace)} planned for this week so far.`,
        priority: "High",
        group: "Today",
        eventAt: now.toISOString(),
        generatedAt: now.toISOString(),
        action: { label: "View Details", to: "/insights/weekly" },
        actions: [{ label: "Ask AI Coach", to: "/insights/ai-coach", kind: "coach" }],
      });
    }
  }

  // 7c. Salary may not last / upcoming cash shortage (forecast based).
  if (survival.hasIncome && survival.daysRemaining > 0) {
    if (survival.forecastBalance < 0) {
      items.push({
        id: `risk-shortage-${todayKey}`,
        kind: "risk",
        title: "Upcoming cash shortage",
        message: `At your current pace you end the cycle ${inr(Math.abs(survival.forecastBalance))} short, ${survival.daysRemaining} day${survival.daysRemaining === 1 ? "" : "s"} before payday.`,
        priority: "High",
        group: "Today",
        eventAt: survival.nextSalary.toISOString(),
        generatedAt: now.toISOString(),
        action: { label: "View Details", to: "/planner" },
        actions: [{ label: "Ask AI Coach", to: "/insights/ai-coach", kind: "coach" }],
      });
    } else if (survival.salaryLeft < survival.safeDaily * survival.daysRemaining * 0.6) {
      items.push({
        id: `risk-salary-last-${todayKey}`,
        kind: "risk",
        title: "Salary may not last the cycle",
        message: `${inr(survival.salaryLeft)} left for ${survival.daysRemaining} day${survival.daysRemaining === 1 ? "" : "s"} — about ${inr(survival.salaryLeft / Math.max(1, survival.daysRemaining))}/day.`,
        priority: "Medium",
        group: "Today",
        eventAt: survival.nextSalary.toISOString(),
        generatedAt: now.toISOString(),
        action: { label: "View Details", to: "/planner" },
      });
    }
  }

  // 7d. High EMI pressure.
  if (survival.monthlyEmi > 0 && survival.emiLevel === "High") {
    items.push({
      id: `risk-emi-${todayKey}`,
      kind: "risk",
      title: "High EMI pressure",
      message: `EMIs of ${inr(survival.monthlyEmi)} take ${Math.round(survival.emiRatio)}% of your salary.`,
      priority: "High",
      group: "Today",
      eventAt: now.toISOString(),
      generatedAt: now.toISOString(),
      action: { label: "View Details", to: "/loans" },
      actions: [{ label: "Ask AI Coach", to: "/insights/ai-coach", kind: "coach" }],
    });
  }


  // -------- filter dismissed / mark completed --------
  const dismissed = getDismissed();
  const completed = getCompleted();
  const filtered = items
    .filter((n) => !dismissed.has(n.id))
    .map((n) =>
      completed.has(n.id) ? { ...n, group: "Completed" as NotifGroup } : n,
    );

  // Sort: High > Medium > Low, then eventAt asc
  const rank: Record<NotifPriority, number> = { High: 0, Medium: 1, Low: 2 };
  filtered.sort((a, b) => {
    if (a.group !== b.group) {
      const g: Record<NotifGroup, number> = { Today: 0, Upcoming: 1, Completed: 2 };
      return g[a.group] - g[b.group];
    }
    if (rank[a.priority] !== rank[b.priority]) return rank[a.priority] - rank[b.priority];
    return a.eventAt.localeCompare(b.eventAt);
  });

  return filtered;
}

export function groupNotifications(items: NotificationItem[]) {
  return {
    Today: items.filter((i) => i.group === "Today"),
    Upcoming: items.filter((i) => i.group === "Upcoming"),
    Completed: items.filter((i) => i.group === "Completed"),
  };
}

export function unreadCount(items: NotificationItem[]): number {
  return items.filter((i) => i.group !== "Completed").length;
}
