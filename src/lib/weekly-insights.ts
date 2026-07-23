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

// ---------- FIX 5: Next Week Outlook ----------

export type NextWeekOutlook = {
  riskLevel: "Low" | "Medium" | "High";
  riskTone: "success" | "warning" | "danger";
  expectedWeeklyBudget: number;
  expectedSpend: number;
  billsDue: { name: string; amount: number; dueLabel: string }[];
  billsTotal: number;
  safeDaily: number;
  daysUntilSalary: number;
  confidence: "Low" | "Medium" | "High";
  confidenceReasons: string[];
  trend: "up" | "down" | "flat";
  trendPct: number;
};

export function computeNextWeekOutlook(opts: {
  weekSpent: number;
  prevSpent: number;
  weekBudget: number;
  safeDaily: number;
  salaryLeft: number;
  daysUntilSalary: number;
  weeksOfHistory: number;
  recurringMonthly: { name: string; amount: number; day?: number }[];
  nextWeekStart: Date;
}): NextWeekOutlook {
  const {
    weekSpent, prevSpent, weekBudget, safeDaily, salaryLeft,
    daysUntilSalary, weeksOfHistory, recurringMonthly, nextWeekStart,
  } = opts;

  const trendPct = prevSpent > 0
    ? Math.round(((weekSpent - prevSpent) / prevSpent) * 100)
    : 0;
  const trend: "up" | "down" | "flat" =
    trendPct > 5 ? "up" : trendPct < -5 ? "down" : "flat";

  // Blend last 2 weeks (recent weight) as baseline; fall back to current week/budget.
  const baseline = prevSpent > 0 && weekSpent > 0
    ? (weekSpent * 0.6 + prevSpent * 0.4)
    : (weekSpent > 0 ? weekSpent : weekBudget);
  const expectedSpend = Math.round(baseline);

  // Bills falling in the next 7 days
  const nextEnd = new Date(nextWeekStart);
  nextEnd.setDate(nextEnd.getDate() + 6);
  const y = nextWeekStart.getFullYear();
  const m = nextWeekStart.getMonth();
  const dim = new Date(y, m + 1, 0).getDate();
  const billsDue: { name: string; amount: number; dueLabel: string }[] = [];
  for (const r of recurringMonthly) {
    if (!(r.amount > 0) || !r.day) continue;
    const d = new Date(y, m, Math.min(Math.max(1, r.day), dim));
    if (d >= nextWeekStart && d <= nextEnd) {
      billsDue.push({
        name: r.name,
        amount: r.amount,
        dueLabel: `${d.getDate()} ${d.toLocaleString(undefined, { month: "short" })}`,
      });
    }
  }
  const billsTotal = billsDue.reduce((s, b) => s + b.amount, 0);

  // Risk: variable expected spend + bills vs salary-left runway
  const projectedNextWeek = expectedSpend + billsTotal;
  const runway = Math.max(0, salaryLeft);
  const ratio = weekBudget > 0 ? projectedNextWeek / (weekBudget + billsTotal) : 1;
  const runwayRatio = runway > 0 ? projectedNextWeek / runway : 2;

  const riskLevel: "Low" | "Medium" | "High" =
    ratio > 1.15 || runwayRatio > 0.9 ? "High"
    : ratio > 0.95 || runwayRatio > 0.6 ? "Medium"
    : "Low";
  const riskTone = riskLevel === "High" ? "danger" : riskLevel === "Medium" ? "warning" : "success";

  // Confidence: driven by history depth + recurring known
  const reasons: string[] = [];
  if (weeksOfHistory >= 4) reasons.push("4+ weeks of transaction history");
  else if (weeksOfHistory >= 2) reasons.push(`${weeksOfHistory} weeks of history`);
  else reasons.push("Limited transaction history");
  if (recurringMonthly.some(r => r.amount > 0)) reasons.push("Recurring bills detected");
  else reasons.push("No recurring bills configured");
  if (weekBudget > 0) reasons.push("Weekly budget set from salary");
  else reasons.push("No salary configured");

  const confidence: "Low" | "Medium" | "High" =
    weeksOfHistory >= 4 && weekBudget > 0 ? "High"
    : weeksOfHistory >= 2 && weekBudget > 0 ? "Medium"
    : "Low";

  return {
    riskLevel,
    riskTone,
    expectedWeeklyBudget: Math.round(weekBudget),
    expectedSpend,
    billsDue,
    billsTotal,
    safeDaily: Math.round(safeDaily),
    daysUntilSalary,
    confidence,
    confidenceReasons: reasons,
    trend,
    trendPct,
  };
}

// ---------- FIX 6: Weekly Achievements ----------

export type WeeklyAchievement = {
  id: string;
  emoji: string;
  title: string;
  detail: string;
};

export function buildWeeklyAchievements(opts: {
  weekSpent: number;
  weekBudget: number;
  prevSpent: number;
  prevWeekBudget: number;
  weeklyScore: number;
  prevWeeklyScore: number;
  billsDueSoFar: { name: string; amount: number; dueDate: string; paid: boolean }[];
  investmentThisCycle: number;
  underBudgetStreak: number;
  fmt: (n: number) => string;
}): WeeklyAchievement[] {
  const {
    weekSpent, weekBudget, prevSpent, prevWeekBudget,
    weeklyScore, prevWeeklyScore, billsDueSoFar, investmentThisCycle,
    underBudgetStreak, fmt,
  } = opts;

  const out: WeeklyAchievement[] = [];

  if (weekBudget > 0 && weekSpent > 0 && weekSpent <= weekBudget) {
    out.push({
      id: "under-budget",
      emoji: "✅",
      title: "Stayed Under Budget",
      detail: `Spent ${fmt(weekSpent)} of ${fmt(weekBudget)}.`,
    });
  }

  const dueOrPast = billsDueSoFar.filter(b => new Date(b.dueDate) <= new Date());
  if (dueOrPast.length > 0 && dueOrPast.every(b => b.paid)) {
    out.push({
      id: "bills-on-time",
      emoji: "✅",
      title: "Bills Paid On Time",
      detail: `${dueOrPast.length} bill${dueOrPast.length > 1 ? "s" : ""} settled by due date.`,
    });
  }

  if (investmentThisCycle > 0) {
    out.push({
      id: "investment-maintained",
      emoji: "✅",
      title: "Investment Maintained",
      detail: `${fmt(investmentThisCycle)} moved to investments this cycle.`,
    });
  }

  if (prevWeekBudget > 0 && prevSpent > 0 && weekSpent < prevSpent) {
    const saved = prevSpent - weekSpent;
    out.push({
      id: "spent-less",
      emoji: "🎯",
      title: "Spent Less Than Last Week",
      detail: `Saved ${fmt(saved)} vs. last week.`,
    });
  }

  if (weeklyScore >= 80) {
    out.push({
      id: "excellent-score",
      emoji: "🌟",
      title: "Excellent Survival Score",
      detail: `Scored ${weeklyScore}/100 this week.`,
    });
  } else if (prevWeeklyScore > 0 && weeklyScore - prevWeeklyScore >= 10) {
    out.push({
      id: "score-jumped",
      emoji: "📈",
      title: "Score Improved",
      detail: `+${weeklyScore - prevWeeklyScore} points vs. last week.`,
    });
  }

  if (underBudgetStreak >= 2) {
    out.push({
      id: "streak",
      emoji: "🔥",
      title: `${underBudgetStreak} Week Survival Streak`,
      detail: `Under budget for ${underBudgetStreak} weeks in a row.`,
    });
  }

  return out;
}

// ---------- FIX 7: Smart Recommendations ----------

export type WeeklyRecommendation = {
  id: string;
  title: string;
  why: string;
  monthlySaving: number;
  scoreDelta: number;
  timeToComplete: string;
  plannerTitle: string;
  plannerDetail: string;
  askAiQuestion: string;
};

export function buildWeeklyRecommendations(opts: {
  weekSpent: number;
  weekBudget: number;
  prevSpent: number;
  weekTxs: Tx[];
  prevTxs: Tx[];
  categories: Category[];
  weeklyScore: number;
  salary: number;
  salaryLeft: number;
  safeDaily: number;
  avgDailyThisWeek: number;
  daysRemaining: number;
  billsTotal: number;
  fmt: (n: number) => string;
}): WeeklyRecommendation[] {
  const {
    weekSpent, weekBudget, prevSpent, weekTxs, prevTxs, categories,
    weeklyScore, salary, salaryLeft, safeDaily, avgDailyThisWeek,
    daysRemaining, billsTotal, fmt,
  } = opts;

  const recs: WeeklyRecommendation[] = [];

  const catMap = (txs: Tx[]) => {
    const m = new Map<string, number>();
    for (const t of txs) {
      const k = t.category_id ?? "uncategorized";
      m.set(k, (m.get(k) ?? 0) + Number(t.amount));
    }
    return m;
  };
  const cur = catMap(weekTxs);
  const prev = catMap(prevTxs);
  const nameOf = (id: string) => categories.find(c => c.id === id)?.name ?? "Uncategorized";

  // 1. Overspending category vs last week
  let biggestJump: { id: string; delta: number } | null = null;
  for (const [id, amt] of cur.entries()) {
    const d = amt - (prev.get(id) ?? 0);
    if (d > 0 && (!biggestJump || d > biggestJump.delta)) biggestJump = { id, delta: d };
  }
  if (biggestJump && biggestJump.delta >= Math.max(100, weekBudget * 0.1)) {
    const name = nameOf(biggestJump.id);
    const monthlySaving = Math.round(biggestJump.delta * 4 * 0.5);
    recs.push({
      id: "trim-jump",
      title: `Cut ${name} spending by half`,
      why: `${name} rose ${fmt(biggestJump.delta)} vs. last week — the biggest jump this week.`,
      monthlySaving,
      scoreDelta: Math.min(10, Math.round((monthlySaving / Math.max(1, salary)) * 40)),
      timeToComplete: "This week",
      plannerTitle: `Trim ${name} by 50%`,
      plannerDetail: `Target saving ~${fmt(monthlySaving)}/mo`,
      askAiQuestion: `How can I reduce my ${name} spending?`,
    });
  }

  // 2. Pace over safe daily
  if (safeDaily > 0 && avgDailyThisWeek > safeDaily * 1.1 && daysRemaining > 0) {
    const overshoot = avgDailyThisWeek - safeDaily;
    const monthlySaving = Math.round(overshoot * 30);
    const cap = Math.round(salaryLeft / Math.max(1, daysRemaining));
    recs.push({
      id: "cap-daily",
      title: `Cap daily spend at ${fmt(cap)}`,
      why: `Your ${fmt(Math.round(avgDailyThisWeek))}/day pace is above the safe daily of ${fmt(Math.round(safeDaily))}.`,
      monthlySaving,
      scoreDelta: 8,
      timeToComplete: `Next ${daysRemaining} day${daysRemaining > 1 ? "s" : ""}`,
      plannerTitle: `Daily cap ${fmt(cap)} until salary`,
      plannerDetail: `${daysRemaining} days to salary · saves ~${fmt(monthlySaving)}/mo`,
      askAiQuestion: "Where can I cut back to hit my safe daily spend?",
    });
  }

  // 3. Build weekly bill buffer when bills coming
  if (billsTotal > 0 && salaryLeft < billsTotal * 1.2 && salary > 0) {
    const buffer = Math.round(billsTotal * 0.25);
    recs.push({
      id: "bill-buffer",
      title: `Set aside ${fmt(buffer)} for upcoming bills`,
      why: `${fmt(billsTotal)} in bills due soon vs. ${fmt(salaryLeft)} salary left — a small buffer avoids overdraft.`,
      monthlySaving: 0,
      scoreDelta: 6,
      timeToComplete: "Before next bill date",
      plannerTitle: `Reserve ${fmt(buffer)} for bills`,
      plannerDetail: `Covers 25% of ${fmt(billsTotal)} in upcoming bills`,
      askAiQuestion: "How do I plan for upcoming bills without hurting my goal?",
    });
  }

  // 4. Fallback if score is low but no specific drivers
  if (recs.length < 3 && weeklyScore < 60 && weekBudget > 0) {
    const target = Math.round(weekBudget * 0.9);
    recs.push({
      id: "tighten-week",
      title: `Aim for ${fmt(target)}/week`,
      why: `Weekly score is ${weeklyScore}/100 — trimming 10% off the weekly budget lifts adherence quickly.`,
      monthlySaving: Math.round((weekBudget - target) * 4),
      scoreDelta: 7,
      timeToComplete: "Next 7 days",
      plannerTitle: `Weekly limit ${fmt(target)}`,
      plannerDetail: `10% below current weekly budget`,
      askAiQuestion: "What's the fastest way to lift my weekly survival score?",
    });
  }

  // 5. Positive reinforcement if very healthy
  if (recs.length < 3 && weeklyScore >= 80 && salaryLeft > 0 && daysRemaining > 0) {
    const extra = Math.round(Math.min(salaryLeft * 0.1, salary * 0.05));
    if (extra > 0) {
      recs.push({
        id: "boost-savings",
        title: `Move ${fmt(extra)} to savings`,
        why: `Score ${weeklyScore}/100 with ${fmt(salaryLeft)} left — you can safely lock away a slice.`,
        monthlySaving: extra,
        scoreDelta: 3,
        timeToComplete: "This week",
        plannerTitle: `Sweep ${fmt(extra)} to savings`,
        plannerDetail: `From current salary surplus`,
        askAiQuestion: "How should I invest my extra savings this month?",
      });
    }
  }

  return recs.slice(0, 3);
}

