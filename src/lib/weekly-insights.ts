import type { Survival } from "./survival";

type Tx = {
  type: "income" | "expense" | string;
  amount: number;
  transaction_date: string;
  category_id?: string | null;
};

type Category = { id: string; name: string };

export type WeeklyStatus = {
  label: "Excellent" | "Stable" | "Needs Attention" | "High Risk";
  emoji: "🟢" | "🟡" | "🟠" | "🔴";
  tone: "success" | "warning" | "danger" | "muted";
};

export type WeeklyScore = {
  score: number;
  status: WeeklyStatus;
  factors: {
    adherence: number;   // 0..40
    pace: number;        // 0..25
    salaryBuffer: number;// 0..20
    daysCover: number;   // 0..15
  };
};

export function computeWeeklyScore(opts: {
  weekSpent: number;
  weekBudget: number;
  safeDaily: number;
  salaryLeft: number;
  salary: number;
  daysRemaining: number;
  avgDailyThisWeek: number;
}): WeeklyScore {
  const { weekSpent, weekBudget, safeDaily, salaryLeft, salary, daysRemaining, avgDailyThisWeek } = opts;

  // 1. Budget adherence (40)
  let adherence = 40;
  if (weekBudget > 0) {
    const ratio = weekSpent / weekBudget;
    if (ratio <= 1) adherence = 40 * (1 - ratio * 0.4); // stay high while under
    else adherence = Math.max(0, 40 - (ratio - 1) * 80);
  }

  // 2. Pace vs safe daily (25)
  let pace = 25;
  if (safeDaily > 0 && avgDailyThisWeek > 0) {
    const r = avgDailyThisWeek / safeDaily;
    if (r <= 1) pace = 25;
    else pace = Math.max(0, 25 - (r - 1) * 30);
  }

  // 3. Salary buffer (20)
  const salaryBuffer = salary > 0
    ? Math.max(0, Math.min(20, (salaryLeft / salary) * 20))
    : 10;

  // 4. Days cover (15) — can salaryLeft cover daysRemaining at avg pace?
  let daysCover = 15;
  if (daysRemaining > 0 && avgDailyThisWeek > 0) {
    const projected = avgDailyThisWeek * daysRemaining;
    if (projected <= salaryLeft) daysCover = 15;
    else {
      const shortfallRatio = (projected - salaryLeft) / Math.max(1, salaryLeft);
      daysCover = Math.max(0, 15 - shortfallRatio * 25);
    }
  }

  const raw = adherence + pace + salaryBuffer + daysCover;
  const score = Math.max(0, Math.min(100, Math.round(raw)));

  const status: WeeklyStatus =
    score >= 80 ? { label: "Excellent", emoji: "🟢", tone: "success" } :
    score >= 60 ? { label: "Stable", emoji: "🟡", tone: "warning" } :
    score >= 40 ? { label: "Needs Attention", emoji: "🟠", tone: "warning" } :
                  { label: "High Risk", emoji: "🔴", tone: "danger" };

  return {
    score,
    status,
    factors: {
      adherence: Math.round(adherence),
      pace: Math.round(pace),
      salaryBuffer: Math.round(salaryBuffer),
      daysCover: Math.round(daysCover),
    },
  };
}

function topCategory(txs: Tx[], categories: Category[]): { name: string; amount: number } | null {
  if (txs.length === 0) return null;
  const map = new Map<string, number>();
  for (const t of txs) {
    const k = t.category_id ?? "uncategorized";
    map.set(k, (map.get(k) ?? 0) + Number(t.amount));
  }
  const [id, amt] = [...map.entries()].sort((a, b) => b[1] - a[1])[0];
  const name = categories.find(c => c.id === id)?.name ?? "Uncategorized";
  return { name, amount: amt };
}

export function buildWeeklySummary(opts: {
  weekSpent: number;
  weekBudget: number;
  weekTxs: Tx[];
  categories: Category[];
  survival: Survival;
  fmt: (n: number) => string;
}): { headline: string; detail: string; tone: "success" | "warning" | "danger" | "muted" } {
  const { weekSpent, weekBudget, weekTxs, categories, survival, fmt } = opts;

  if (weekBudget <= 0) {
    return {
      tone: "muted",
      headline: "Set a salary to unlock weekly budget insights.",
      detail: "Add your salary in Settings so we can calculate a Safe Daily Spend for the week.",
    };
  }

  const top = topCategory(weekTxs, categories);
  const diff = weekBudget - weekSpent;
  const pct = Math.round((weekSpent / weekBudget) * 100);

  if (weekSpent === 0) {
    return {
      tone: "success",
      headline: "No spending logged this week yet.",
      detail: `You have ${fmt(survival.salaryLeft)} left with ${survival.daysRemaining} day(s) until salary — a safe daily spend of ${fmt(survival.safeDaily)}.`,
    };
  }

  if (weekSpent <= weekBudget) {
    const underPct = Math.round(((weekBudget - weekSpent) / weekBudget) * 100);
    const because = top ? ` Your largest category was ${top.name} (${fmt(top.amount)}).` : "";
    return {
      tone: "success",
      headline: `You spent ${underPct}% below your weekly budget.`,
      detail: `Spent ${fmt(weekSpent)} of ${fmt(weekBudget)} — ${fmt(diff)} remaining.${because} On track to reach salary day.`,
    };
  }

  // Overspending
  const over = weekSpent - weekBudget;
  const because = top
    ? `${top.name} was the largest driver at ${fmt(top.amount)}.`
    : "Multiple small expenses added up.";
  const action = survival.daysRemaining > 0
    ? `Cap the next ${survival.daysRemaining} day(s) at ${fmt(Math.max(0, survival.salaryLeft / Math.max(1, survival.daysRemaining)))}/day to recover.`
    : "New salary cycle starts today — reset limits from tomorrow.";
  return {
    tone: over / weekBudget > 0.2 ? "danger" : "warning",
    headline: `You went ${pct - 100}% over the weekly budget (${fmt(over)} above).`,
    detail: `${because} ${action}`,
  };
}

export function buildComparison(opts: {
  weekSpent: number;
  prevSpent: number;
  weekTxs: Tx[];
  prevTxs: Tx[];
  categories: Category[];
  weeklyScore: number;
  prevWeeklyScore: number;
  safeDaily: number;
  prevSafeDaily: number;
  fmt: (n: number) => string;
}): string {
  const { weekSpent, prevSpent, weekTxs, prevTxs, categories, weeklyScore, prevWeeklyScore, safeDaily, prevSafeDaily, fmt } = opts;

  if (prevSpent <= 0 && weekSpent <= 0) return "No spending recorded in either week to compare.";
  if (prevSpent <= 0) return `No spending was recorded last week. This week you've spent ${fmt(weekSpent)}.`;

  const diff = weekSpent - prevSpent;
  const absDiff = Math.abs(diff);
  const direction = diff > 0 ? "more" : diff < 0 ? "less" : "the same as";

  // Category deltas
  const catTotal = (txs: Tx[]) => {
    const m = new Map<string, number>();
    for (const t of txs) {
      const k = t.category_id ?? "uncategorized";
      m.set(k, (m.get(k) ?? 0) + Number(t.amount));
    }
    return m;
  };
  const cur = catTotal(weekTxs);
  const prev = catTotal(prevTxs);
  const allIds = new Set([...cur.keys(), ...prev.keys()]);
  let biggest: { id: string; delta: number } | null = null;
  for (const id of allIds) {
    const d = (cur.get(id) ?? 0) - (prev.get(id) ?? 0);
    if (!biggest || Math.abs(d) > Math.abs(biggest.delta)) biggest = { id, delta: d };
  }

  const catName = biggest
    ? (categories.find(c => c.id === biggest!.id)?.name ?? "Uncategorized")
    : null;

  const scoreDelta = weeklyScore - prevWeeklyScore;
  const safeDelta = safeDaily - prevSafeDaily;

  const reason = biggest && catName && Math.abs(biggest.delta) >= 1
    ? ` because ${catName} spending ${biggest.delta > 0 ? "increased" : "decreased"} by ${fmt(Math.abs(biggest.delta))}`
    : "";

  const scoreBit = prevWeeklyScore > 0
    ? ` Survival Score ${scoreDelta >= 0 ? "improved" : "dropped"} by ${Math.abs(scoreDelta)} pts.`
    : "";

  const safeBit = prevSafeDaily > 0
    ? ` Safe Daily Spend ${safeDelta >= 0 ? "rose" : "fell"} by ${fmt(Math.abs(safeDelta))}.`
    : "";

  if (diff === 0) return `You spent the same as last week (${fmt(weekSpent)}).${scoreBit}${safeBit}`;
  return `You spent ${fmt(absDiff)} ${direction} than last week${reason}.${scoreBit}${safeBit}`;
}
