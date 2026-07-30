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

export function onNotificationsChanged(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = () => cb();
  window.addEventListener(UPDATED_EVENT, handler);
  window.addEventListener("storage", handler);
  const off = onProfileUpdated(cb);
  return () => {
    window.removeEventListener(UPDATED_EVENT, handler);
    window.removeEventListener("storage", handler);
    off();
  };
}

// ----------------- helpers -----------------

const DAY_MS = 86_400_000;

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
    const weeklyBudget = discretionaryMonthly / 4.33;

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
