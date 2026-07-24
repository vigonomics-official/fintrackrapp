// Home Dashboard intelligence — derives Daily Status, Today's Mission,
// Salary Health Breakdown, and Upcoming Risks from real user data only.
// UI-agnostic: pure functions consumed by the Dashboard route.

import type { Survival } from "@/lib/survival";
import type { Transaction, Category, Budget, Loan } from "@/hooks/use-finance";
import type { FinancialProfile } from "@/lib/financial-profile";
import { formatCurrency } from "@/lib/currency";

// ---------- Category bucketing (uses real category names) ----------

function nameFor(id: string | null, categories: Category[]): string {
  if (!id) return "";
  return categories.find((c) => c.id === id)?.name ?? "";
}

export type SalaryBucket = "needs" | "savings" | "investments" | "lifestyle";

export function bucketForCategory(name: string): SalaryBucket {
  const n = name.toLowerCase();
  if (/rent|emi|loan|bill|utilit|electric|water|gas|internet|mobile|recharge|insurance|health|medic|grocer|childcare|school|tuition/.test(n)) return "needs";
  if (/saving|deposit|\bfd\b|\brd\b|emergency/.test(n)) return "savings";
  if (/invest|stock|mutual|\bsip\b|equity|crypto|gold|bond|nps/.test(n)) return "investments";
  return "lifestyle";
}

// ---------- FEATURE 1: Daily Survival Status ----------

export type DailyStatusLevel = "safe" | "careful" | "danger";

export type DailyStatus = {
  level: DailyStatusLevel;
  dot: string;
  headline: string;
  detail: string;
};

export function computeDailyStatus(opts: {
  survival: Survival;
  billsDueSoonDays: number | null;
  recentDailyAvg: number;
  currency: string;
}): DailyStatus {
  const { survival, billsDueSoonDays, recentDailyAvg, currency } = opts;
  const { salaryLeft, safeDaily, spentToday, days, score, hasIncome } = survival;

  const overspendToday = safeDaily > 0 && spentToday > safeDaily * 1.5;
  const paceHigh = safeDaily > 0 && recentDailyAvg > safeDaily * 1.2;
  const criticalBill = billsDueSoonDays != null && billsDueSoonDays <= 2;
  const noBuffer = hasIncome && salaryLeft <= 0;

  let level: DailyStatusLevel;
  if (noBuffer || score < 45 || overspendToday || criticalBill) level = "danger";
  else if (score < 70 || (safeDaily > 0 && spentToday > safeDaily) || paceHigh || (billsDueSoonDays != null && billsDueSoonDays <= 5)) level = "careful";
  else level = "safe";

  const dot = level === "safe" ? "🟢" : level === "careful" ? "🟡" : "🔴";
  const headline =
    level === "safe" ? "You are safely on track"
    : level === "careful" ? "Slow down spending today"
    : "Spending risk detected";

  const parts: string[] = [];
  if (hasIncome) parts.push(`${formatCurrency(salaryLeft, currency)} left`);
  if (safeDaily > 0) parts.push(`safe ${formatCurrency(safeDaily, currency)}/day`);
  parts.push(days <= 0 ? "salary today" : `${days} day${days === 1 ? "" : "s"} to salary`);
  if (criticalBill) parts.push(`bill in ${billsDueSoonDays}d`);

  return { level, dot, headline, detail: parts.join(" · ") };
}

// ---------- FEATURE 2: Today's Mission ----------

export type TodayMission = {
  id: string;
  title: string;
  saving: number;
  scoreBoost: number;
  minutes: number;
  detail: string;
};

function recentCategoryAverages(
  transactions: Transaction[],
  categories: Category[],
  days: number,
  now: Date,
): { category: string; avgDaily: number; total: number }[] {
  const cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (days - 1));
  const map = new Map<string, number>();
  for (const t of transactions) {
    if (t.type !== "expense") continue;
    const d = new Date(t.transaction_date);
    if (d < cutoff) continue;
    const name = nameFor(t.category_id, categories) || "Other";
    map.set(name, (map.get(name) ?? 0) + t.amount);
  }
  return [...map.entries()]
    .map(([category, total]) => ({ category, total, avgDaily: total / days }))
    .sort((a, b) => b.total - a.total);
}

export function computeTodayMission(opts: {
  survival: Survival;
  transactions: Transaction[];
  categories: Category[];
  now: Date;
  currency: string;
}): TodayMission | null {
  const { survival, transactions, categories, now, currency } = opts;
  const { salary, safeDaily, spentToday, salaryLeft } = survival;

  const recents = recentCategoryAverages(transactions, categories, 7, now);
  const discretionary = recents.find((r) => bucketForCategory(r.category) === "lifestyle" && r.avgDaily > 0);

  // Primary: cut top lifestyle category today
  if (discretionary && discretionary.avgDaily >= 50) {
    const saving = Math.round(discretionary.avgDaily);
    const boost = salary > 0 ? Math.min(5, Math.max(1, Math.round((saving / salary) * 40))) : 2;
    return {
      id: `skip-${discretionary.category.toLowerCase().replace(/\s+/g, "-")}`,
      title: `Skip ${discretionary.category} today`,
      saving,
      scoreBoost: boost,
      minutes: 5,
      detail: `You've averaged ${formatCurrency(saving, currency)}/day on ${discretionary.category} over the last 7 days.`,
    };
  }

  // If already overspent today: pause discretionary
  if (safeDaily > 0 && spentToday > safeDaily) {
    const over = Math.round(spentToday - safeDaily);
    return {
      id: "pause-discretionary",
      title: "Pause discretionary spending today",
      saving: over,
      scoreBoost: 3,
      minutes: 2,
      detail: `Already ${formatCurrency(over, currency)} over your safe daily limit.`,
    };
  }

  // No expenses logged today: log them
  const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const anyToday = transactions.some((t) => t.transaction_date.slice(0, 10) === todayKey);
  if (!anyToday && salary > 0) {
    return {
      id: "log-today",
      title: "Log today's expenses",
      saving: 0,
      scoreBoost: 1,
      minutes: 3,
      detail: "Accurate tracking keeps your Safe Daily Spend meaningful.",
    };
  }

  // Otherwise: nudge a small transfer to savings
  if (salary > 0 && salaryLeft > safeDaily * 2) {
    const move = Math.round(Math.min(salaryLeft * 0.05, safeDaily));
    if (move >= 50) {
      return {
        id: "move-to-savings",
        title: `Move ${formatCurrency(move, currency)} to savings today`,
        saving: move,
        scoreBoost: 2,
        minutes: 5,
        detail: "Small automatic transfers compound your survival buffer.",
      };
    }
  }
  return null;
}

// ---------- FEATURE 3: Salary Health Breakdown ----------

export type SalaryHealthSlice = {
  bucket: SalaryBucket | "remaining";
  label: string;
  amount: number;
  pct: number;
};

export function computeSalaryHealth(opts: {
  survival: Survival;
  transactions: Transaction[];
  categories: Category[];
  now: Date;
}): { salary: number; slices: SalaryHealthSlice[] } {
  const { survival, transactions, categories, now } = opts;
  const salary = survival.salary;
  const totals: Record<SalaryBucket, number> = { needs: 0, savings: 0, investments: 0, lifestyle: 0 };

  for (const t of transactions) {
    if (t.type !== "expense") continue;
    const d = new Date(t.transaction_date);
    if (d.getMonth() !== now.getMonth() || d.getFullYear() !== now.getFullYear()) continue;
    const b = bucketForCategory(nameFor(t.category_id, categories));
    totals[b] += t.amount;
  }

  const spent = totals.needs + totals.savings + totals.investments + totals.lifestyle;
  const remaining = Math.max(0, salary - spent);
  const denom = salary > 0 ? salary : Math.max(1, spent);
  const pct = (n: number) => Math.round((n / denom) * 100);

  const slices: SalaryHealthSlice[] = [
    { bucket: "needs", label: "Needs", amount: totals.needs, pct: pct(totals.needs) },
    { bucket: "savings", label: "Savings", amount: totals.savings, pct: pct(totals.savings) },
    { bucket: "investments", label: "Investments", amount: totals.investments, pct: pct(totals.investments) },
    { bucket: "lifestyle", label: "Lifestyle", amount: totals.lifestyle, pct: pct(totals.lifestyle) },
    { bucket: "remaining", label: "Remaining", amount: remaining, pct: salary > 0 ? pct(remaining) : 0 },
  ];
  return { salary, slices };
}

// ---------- FEATURE 4: Upcoming Financial Risks ----------

export type Urgency = "High" | "Medium" | "Low";
export type Confidence = "High" | "Medium" | "Low";

export type UpcomingRisk = {
  id: string;
  title: string;
  moneyImpact: number;
  moneyLabel: string;
  urgency: Urgency;
  urgencyDays: number | null;
  suggestion: string;
  confidence: Confidence;
};

function urgencyForDays(days: number): Urgency {
  if (days <= 2) return "High";
  if (days <= 7) return "Medium";
  return "Low";
}

export function computeUpcomingRisks(opts: {
  survival: Survival;
  transactions: Transaction[];
  categories: Category[];
  budgets: Budget[];
  loans: Loan[];
  profile: FinancialProfile;
  now: Date;
  currency: string;
}): UpcomingRisk[] {
  const { survival, transactions, categories, budgets, loans, profile, now, currency } = opts;
  const risks: UpcomingRisk[] = [];

  // 1) Loan EMIs due within 14 days
  for (const l of loans) {
    if (Number(l.remaining_balance) <= 0) continue;
    const dueDay = Math.min(28, Math.max(1, l.due_day));
    const due = new Date(now.getFullYear(), now.getMonth(), dueDay);
    if (due < new Date(now.getFullYear(), now.getMonth(), now.getDate())) due.setMonth(due.getMonth() + 1);
    const days = Math.ceil((due.getTime() - now.getTime()) / 86_400_000);
    if (days > 14) continue;
    risks.push({
      id: `loan-${l.id}`,
      title: `${l.loan_name || "EMI"} due in ${days} day${days === 1 ? "" : "s"}`,
      moneyImpact: l.emi_amount,
      moneyLabel: `${formatCurrency(l.emi_amount, currency)} EMI`,
      urgency: urgencyForDays(days),
      urgencyDays: days,
      suggestion: `Set aside ${formatCurrency(l.emi_amount, currency)} before ${due.toLocaleDateString()}`,
      confidence: "High",
    });
  }

  // 2) Recurring rent from profile if no rent tx this month yet
  if (profile.monthlyRent && profile.monthlyRent > 0) {
    const paid = transactions.some((t) => {
      if (t.type !== "expense") return false;
      const d = new Date(t.transaction_date);
      if (d.getMonth() !== now.getMonth() || d.getFullYear() !== now.getFullYear()) return false;
      return /rent/i.test(nameFor(t.category_id, categories));
    });
    if (!paid) {
      const totalDays = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const daysLeft = Math.max(0, totalDays - now.getDate());
      risks.push({
        id: "rent-upcoming",
        title: "Rent due this month",
        moneyImpact: profile.monthlyRent,
        moneyLabel: `${formatCurrency(profile.monthlyRent, currency)} rent`,
        urgency: urgencyForDays(daysLeft),
        urgencyDays: daysLeft,
        suggestion: `Reserve ${formatCurrency(profile.monthlyRent, currency)} from Salary Left`,
        confidence: "Medium",
      });
    }
  }

  // 3) Budget overages this month
  const monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const seenBudget = new Set<string>();
  for (const b of budgets) {
    if (!b.category_id || seenBudget.has(b.category_id)) continue;
    seenBudget.add(b.category_id);
    const spent = transactions
      .filter((t) => t.type === "expense" && t.category_id === b.category_id && t.transaction_date.startsWith(monthPrefix))
      .reduce((s, t) => s + t.amount, 0);
    const over = spent - b.monthly_limit;
    if (over > 0) {
      const cName = nameFor(b.category_id, categories) || "Category";
      risks.push({
        id: `budget-${b.id}`,
        title: `${cName} budget overspent`,
        moneyImpact: over,
        moneyLabel: `${formatCurrency(over, currency)} over`,
        urgency: "High",
        urgencyDays: 0,
        suggestion: `Pause ${cName} spending for the rest of the cycle`,
        confidence: "High",
      });
    }
  }

  // 4) Salary buffer pressure — spending pace too fast
  if (survival.hasIncome && survival.forecastBalance < 0 && survival.days > 2) {
    const gap = Math.abs(survival.forecastBalance);
    risks.push({
      id: "pace-risk",
      title: "Spending pace exceeds salary",
      moneyImpact: gap,
      moneyLabel: `${formatCurrency(gap, currency)} projected shortfall`,
      urgency: survival.days <= 7 ? "High" : "Medium",
      urgencyDays: survival.days,
      suggestion: `Cap daily spend at ${formatCurrency(Math.max(0, survival.safeDaily), currency)} to recover`,
      confidence: "Medium",
    });
  }

  // 5) Low emergency fund
  if (profile.monthlySalary && profile.monthlySalary > 0) {
    // treat "savings this month" as proxy when nothing else is remembered
    const savedThisMonth = transactions
      .filter((t) => {
        if (t.type !== "expense") return false;
        const d = new Date(t.transaction_date);
        if (d.getMonth() !== now.getMonth() || d.getFullYear() !== now.getFullYear()) return false;
        return bucketForCategory(nameFor(t.category_id, categories)) === "savings";
      })
      .reduce((s, t) => s + t.amount, 0);
    const target = profile.monthlySalary * 0.1;
    if (savedThisMonth < target) {
      const gap = target - savedThisMonth;
      risks.push({
        id: "low-savings",
        title: "Emergency fund below 10% target",
        moneyImpact: gap,
        moneyLabel: `${formatCurrency(gap, currency)} short this month`,
        urgency: "Low",
        urgencyDays: null,
        suggestion: `Move ${formatCurrency(gap, currency)} to savings before salary day`,
        confidence: "Medium",
      });
    }
  }

  const rank = (u: Urgency) => (u === "High" ? 0 : u === "Medium" ? 1 : 2);
  risks.sort((a, b) => {
    const r = rank(a.urgency) - rank(b.urgency);
    if (r !== 0) return r;
    const ad = a.urgencyDays ?? 99;
    const bd = b.urgencyDays ?? 99;
    if (ad !== bd) return ad - bd;
    return b.moneyImpact - a.moneyImpact;
  });

  return risks.slice(0, 3);
}

// ---------- Small utility for Daily Status recent avg ----------

export function recentDailyAverage(transactions: Transaction[], days: number, now: Date): number {
  const cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (days - 1));
  let total = 0;
  for (const t of transactions) {
    if (t.type !== "expense") continue;
    const d = new Date(t.transaction_date);
    if (d < cutoff) continue;
    total += t.amount;
  }
  return total / days;
}

export function nextBillDueDays(loans: Loan[], now: Date): number | null {
  let best: number | null = null;
  for (const l of loans) {
    if (Number(l.remaining_balance) <= 0) continue;
    const dueDay = Math.min(28, Math.max(1, l.due_day));
    const due = new Date(now.getFullYear(), now.getMonth(), dueDay);
    if (due < new Date(now.getFullYear(), now.getMonth(), now.getDate())) due.setMonth(due.getMonth() + 1);
    const days = Math.ceil((due.getTime() - now.getTime()) / 86_400_000);
    if (best == null || days < best) best = days;
  }
  return best;
}
