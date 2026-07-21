// Spending Behavior — pure analytics over real transaction history.
// UI-agnostic so the route (and future prompts) can share these computations.

import type { Transaction, Category, Budget, Loan } from "@/hooks/use-finance";

// ---------- Types ----------

export type Personality =
  | "Smart Saver"
  | "Balanced Spender"
  | "Weekend Spender"
  | "Impulse Buyer"
  | "Budget Conscious"
  | "Goal Focused";

export type PersonalityResult = {
  type: Personality;
  confidence: number; // 0-100
  explanation: string;
};

export type TrendDir = "up" | "down" | "flat";

export type BehaviorPattern = {
  key: string;
  label: string;
  percentage: number; // 0-100
  trend: TrendDir;
  reason: string;
};

export type MonthlyHabit = { text: string; tone: "positive" | "negative" | "neutral" };

export type PositiveHabit = { key: string; title: string; detail: string };

export type ImprovementHabit = {
  key: string;
  problem: string;
  estimatedMonthlySaving: number;
  difficulty: "Easy" | "Medium" | "Hard";
  scoreBoost: number;
  action: string;
};

export type Prediction = {
  nextMonthSpend: number;
  highestCategory: string | null;
  overspendRisk: "Low" | "Medium" | "High";
  expectedSavings: number;
  expectedSurvivalScore: number;
  confidence: number;
};

export type TimelineWeek = {
  weekLabel: string;
  range: string;
  spend: number;
  income: number;
  note: string;
};

export type AiInsight = {
  id: string;
  text: string;
  detail: string; // "Explain" body
  plannerTitle: string;
  plannerDetail: string;
};

export type BehaviorReport = {
  personality: PersonalityResult;
  patterns: BehaviorPattern[];
  monthlyHabits: MonthlyHabit[];
  positiveHabits: PositiveHabit[];
  improvements: ImprovementHabit[];
  prediction: Prediction;
  timeline: TimelineWeek[];
  insights: AiInsight[];
  hasEnoughData: boolean;
};

// ---------- Helpers ----------

const DAY_MS = 86_400_000;
const isExpense = (t: Transaction) => t.type === "expense";
const isIncome = (t: Transaction) => t.type === "income";

function ymKey(d: Date) {
  return `${d.getFullYear()}-${d.getMonth()}`;
}

function inMonth(d: Date, ref: Date) {
  return d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth();
}

function sum(nums: number[]) {
  return nums.reduce((a, b) => a + b, 0);
}

function pct(part: number, whole: number) {
  return whole > 0 ? Math.round((part / whole) * 100) : 0;
}

function trendOf(current: number, prior: number): TrendDir {
  if (prior <= 0 && current <= 0) return "flat";
  if (prior <= 0) return current > 0 ? "up" : "flat";
  const diff = (current - prior) / prior;
  if (diff > 0.1) return "up";
  if (diff < -0.1) return "down";
  return "flat";
}

function categoryName(id: string | null, categories: Category[]) {
  if (!id) return "Uncategorized";
  return categories.find((c) => c.id === id)?.name ?? "Uncategorized";
}

// ---------- Main builder ----------

export function buildBehaviorReport(params: {
  transactions: Transaction[];
  categories: Category[];
  budgets: Budget[];
  loans: Loan[];
  monthlySalary?: number;
  now?: Date;
}): BehaviorReport {
  const { transactions, categories, budgets, loans, monthlySalary = 0 } = params;
  const now = params.now ?? new Date();
  const hasEnoughData = transactions.length >= 5;

  const expenses = transactions.filter(isExpense);
  const incomes = transactions.filter(isIncome);

  // Split by month
  const thisMonthExp = expenses.filter((t) => inMonth(new Date(t.transaction_date), now));
  const priorMonthRef = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const priorMonthExp = expenses.filter((t) => inMonth(new Date(t.transaction_date), priorMonthRef));

  const thisMonthTotal = sum(thisMonthExp.map((t) => t.amount));
  const priorMonthTotal = sum(priorMonthExp.map((t) => t.amount));

  const thisMonthIncome = sum(
    incomes.filter((t) => inMonth(new Date(t.transaction_date), now)).map((t) => t.amount),
  );

  // ---------- Personality ----------
  const personality = detectPersonality({
    thisMonthExp,
    thisMonthTotal,
    thisMonthIncome,
    monthlySalary,
    priorMonthTotal,
    categories,
    budgets,
  });

  // ---------- Patterns ----------
  const patterns = detectPatterns({
    expenses,
    thisMonthExp,
    priorMonthExp,
    incomes,
    thisMonthTotal,
    priorMonthTotal,
  });

  // ---------- Monthly Habits ----------
  const monthlyHabits = buildMonthlyHabits({
    thisMonthExp,
    priorMonthExp,
    incomes,
    categories,
    now,
  });

  // ---------- Positive Habits ----------
  const positiveHabits = buildPositiveHabits({
    thisMonthExp,
    thisMonthIncome,
    monthlySalary,
    budgets,
    categories,
    loans,
    transactions,
    now,
  });

  // ---------- Improvements ----------
  const improvements = buildImprovements({
    thisMonthExp,
    priorMonthExp,
    monthlySalary,
    thisMonthIncome,
    categories,
  });

  // ---------- Prediction ----------
  const prediction = buildPrediction({
    expenses,
    monthlySalary,
    thisMonthIncome,
    categories,
    now,
  });

  // ---------- Timeline ----------
  const timeline = buildTimeline({ transactions, now });

  // ---------- Insights ----------
  const insights = buildAiInsights({
    patterns,
    thisMonthExp,
    priorMonthExp,
    thisMonthTotal,
    priorMonthTotal,
    monthlySalary,
    thisMonthIncome,
    categories,
  });

  return {
    personality,
    patterns,
    monthlyHabits,
    positiveHabits,
    improvements,
    prediction,
    timeline,
    insights,
    hasEnoughData,
  };
}

// ---------- Personality ----------

function detectPersonality(args: {
  thisMonthExp: Transaction[];
  thisMonthTotal: number;
  thisMonthIncome: number;
  monthlySalary: number;
  priorMonthTotal: number;
  categories: Category[];
  budgets: Budget[];
}): PersonalityResult {
  const { thisMonthExp, thisMonthTotal, thisMonthIncome, monthlySalary, priorMonthTotal, budgets } = args;
  const income = monthlySalary || thisMonthIncome;

  // Signals
  const savingsRate = income > 0 ? Math.max(0, (income - thisMonthTotal) / income) : 0;

  const weekendSpend = sum(
    thisMonthExp
      .filter((t) => {
        const d = new Date(t.transaction_date).getDay();
        return d === 0 || d === 6;
      })
      .map((t) => t.amount),
  );
  const weekendPct = pct(weekendSpend, thisMonthTotal) / 100;

  const smallTicketCount = thisMonthExp.filter((t) => t.amount < 200).length;
  const impulseSignal = smallTicketCount / Math.max(1, thisMonthExp.length);

  const budgetsWithLimit = budgets.filter((b) => b.monthly_limit > 0);
  const withinBudget = budgetsWithLimit.length > 0
    ? budgetsWithLimit.filter((b) => {
        const spent = sum(
          thisMonthExp.filter((t) => t.category_id === b.category_id).map((t) => t.amount),
        );
        return spent <= b.monthly_limit;
      }).length / budgetsWithLimit.length
    : 0;

  const monthOverMonthDrop = priorMonthTotal > 0 ? (priorMonthTotal - thisMonthTotal) / priorMonthTotal : 0;

  const scores: Record<Personality, number> = {
    "Smart Saver": savingsRate * 100 + (monthOverMonthDrop > 0 ? 20 : 0),
    "Balanced Spender": (savingsRate > 0.1 && savingsRate < 0.3 ? 60 : 20) + withinBudget * 30,
    "Weekend Spender": weekendPct > 0.4 ? 60 + weekendPct * 40 : weekendPct * 60,
    "Impulse Buyer": impulseSignal > 0.5 ? 40 + impulseSignal * 60 : impulseSignal * 40,
    "Budget Conscious": withinBudget * 80 + (budgetsWithLimit.length >= 2 ? 20 : 0),
    "Goal Focused": savingsRate * 60 + (monthOverMonthDrop > 0.05 ? 30 : 0),
  };

  const ranked = (Object.entries(scores) as [Personality, number][]).sort((a, b) => b[1] - a[1]);
  const [top, topScore] = ranked[0];
  const runnerUp = ranked[1]?.[1] ?? 0;
  const gap = Math.max(5, topScore - runnerUp);
  const confidence = Math.max(35, Math.min(95, Math.round(topScore * 0.6 + gap)));

  const explanations: Record<Personality, string> = {
    "Smart Saver": `You saved about ${Math.round(savingsRate * 100)}% of income this month — spending stays below your safe limit.`,
    "Balanced Spender": "Your spending is spread evenly across categories and mostly stays within your budgets.",
    "Weekend Spender": `About ${Math.round(weekendPct * 100)}% of this month's spending happened on weekends.`,
    "Impulse Buyer": `${Math.round(impulseSignal * 100)}% of your transactions are small unplanned purchases.`,
    "Budget Conscious": `You stayed within ${Math.round(withinBudget * 100)}% of the budgets you set.`,
    "Goal Focused": "You are consistently redirecting surplus toward savings and goals.",
  };

  return { type: top, confidence, explanation: explanations[top] };
}

// ---------- Patterns ----------

function detectPatterns(args: {
  expenses: Transaction[];
  thisMonthExp: Transaction[];
  priorMonthExp: Transaction[];
  incomes: Transaction[];
  thisMonthTotal: number;
  priorMonthTotal: number;
}): BehaviorPattern[] {
  const { expenses, thisMonthExp, priorMonthExp, incomes, thisMonthTotal, priorMonthTotal } = args;
  const out: BehaviorPattern[] = [];

  // Weekend spending
  const weekend = sum(
    thisMonthExp
      .filter((t) => {
        const d = new Date(t.transaction_date).getDay();
        return d === 0 || d === 6;
      })
      .map((t) => t.amount),
  );
  const weekendPrior = sum(
    priorMonthExp
      .filter((t) => {
        const d = new Date(t.transaction_date).getDay();
        return d === 0 || d === 6;
      })
      .map((t) => t.amount),
  );
  out.push({
    key: "weekend",
    label: "Weekend Spending",
    percentage: pct(weekend, thisMonthTotal),
    trend: trendOf(weekend, weekendPrior),
    reason: "Share of this month's spending that happens on Saturdays and Sundays.",
  });

  // Salary day spending — spend within 3 days of an income event
  const salaryDates = incomes.map((i) => new Date(i.transaction_date).getTime());
  const nearSalary = sum(
    thisMonthExp
      .filter((t) => {
        const ts = new Date(t.transaction_date).getTime();
        return salaryDates.some((s) => Math.abs(ts - s) <= 3 * DAY_MS && ts >= s);
      })
      .map((t) => t.amount),
  );
  const priorSalaryDates = incomes.map((i) => new Date(i.transaction_date).getTime());
  const nearSalaryPrior = sum(
    priorMonthExp
      .filter((t) => {
        const ts = new Date(t.transaction_date).getTime();
        return priorSalaryDates.some((s) => Math.abs(ts - s) <= 3 * DAY_MS && ts >= s);
      })
      .map((t) => t.amount),
  );
  if (salaryDates.length > 0) {
    out.push({
      key: "salary-day",
      label: "Salary Day Spending",
      percentage: pct(nearSalary, thisMonthTotal),
      trend: trendOf(nearSalary, nearSalaryPrior),
      reason: "Spending within 3 days of a salary credit.",
    });
  }

  // Night spending (via created_at)
  const night = sum(
    thisMonthExp
      .filter((t) => {
        const h = new Date(t.created_at).getHours();
        return h >= 22 || h < 5;
      })
      .map((t) => t.amount),
  );
  const nightPrior = sum(
    priorMonthExp
      .filter((t) => {
        const h = new Date(t.created_at).getHours();
        return h >= 22 || h < 5;
      })
      .map((t) => t.amount),
  );
  out.push({
    key: "night",
    label: "Night Spending",
    percentage: pct(night, thisMonthTotal),
    trend: trendOf(night, nightPrior),
    reason: "Transactions logged between 10 PM and 5 AM.",
  });

  // Payment methods
  const methodSpend = (list: Transaction[], method: string) =>
    sum(list.filter((t) => (t.payment_method || "").toLowerCase().includes(method)).map((t) => t.amount));
  const upi = methodSpend(thisMonthExp, "upi");
  const upiPrior = methodSpend(priorMonthExp, "upi");
  out.push({
    key: "upi",
    label: "UPI Usage",
    percentage: pct(upi, thisMonthTotal),
    trend: trendOf(upi, upiPrior),
    reason: "Share of spending made through UPI apps.",
  });

  const cash = methodSpend(thisMonthExp, "cash");
  const cashPrior = methodSpend(priorMonthExp, "cash");
  out.push({
    key: "cash",
    label: "Cash Usage",
    percentage: pct(cash, thisMonthTotal),
    trend: trendOf(cash, cashPrior),
    reason: "Share of spending paid in cash.",
  });

  // Food delivery — tag/notes based
  const looksLikeDelivery = (t: Transaction) => {
    const hay = `${t.notes ?? ""} ${(t.tags ?? []).join(" ")} ${t.subcategory ?? ""}`.toLowerCase();
    return /swiggy|zomato|delivery|dunzo|eatsure|blinkit|instamart/.test(hay);
  };
  const delivery = sum(thisMonthExp.filter(looksLikeDelivery).map((t) => t.amount));
  const deliveryPrior = sum(priorMonthExp.filter(looksLikeDelivery).map((t) => t.amount));
  if (delivery > 0 || deliveryPrior > 0) {
    out.push({
      key: "food-delivery",
      label: "Food Delivery Trend",
      percentage: pct(delivery, thisMonthTotal),
      trend: trendOf(delivery, deliveryPrior),
      reason: "Spending on food-delivery apps detected in notes and tags.",
    });
  }

  // Subscription growth — tags/notes based
  const looksLikeSub = (t: Transaction) => {
    const hay = `${t.notes ?? ""} ${(t.tags ?? []).join(" ")} ${t.subcategory ?? ""}`.toLowerCase();
    return /subscription|netflix|prime|hotstar|spotify|youtube|apple|icloud/.test(hay);
  };
  const subs = sum(thisMonthExp.filter(looksLikeSub).map((t) => t.amount));
  const subsPrior = sum(priorMonthExp.filter(looksLikeSub).map((t) => t.amount));
  if (subs > 0 || subsPrior > 0) {
    out.push({
      key: "subs",
      label: "Subscription Growth",
      percentage: pct(subs, thisMonthTotal),
      trend: trendOf(subs, subsPrior),
      reason: "Recurring subscriptions detected in notes and tags.",
    });
  }

  // Impulse shopping — small ticket count
  const smallCount = thisMonthExp.filter((t) => t.amount < 200).length;
  const smallCountPrior = priorMonthExp.filter((t) => t.amount < 200).length;
  out.push({
    key: "impulse",
    label: "Impulse Shopping",
    percentage: pct(smallCount, thisMonthExp.length || 1),
    trend: trendOf(smallCount, smallCountPrior),
    reason: "Share of transactions under a small-ticket threshold.",
  });

  return out;
}

// ---------- Monthly Habits ----------

function buildMonthlyHabits(args: {
  thisMonthExp: Transaction[];
  priorMonthExp: Transaction[];
  incomes: Transaction[];
  categories: Category[];
  now: Date;
}): MonthlyHabit[] {
  const { thisMonthExp, priorMonthExp, incomes, categories, now } = args;
  const habits: MonthlyHabit[] = [];

  // Weekend vs weekday premium
  const totalThis = sum(thisMonthExp.map((t) => t.amount));
  const weekendThis = sum(
    thisMonthExp
      .filter((t) => {
        const d = new Date(t.transaction_date).getDay();
        return d === 0 || d === 6;
      })
      .map((t) => t.amount),
  );
  const weekdayThis = totalThis - weekendThis;
  // Approx daily rate to compare
  const weekendDays = countDaysInMonth(now, [0, 6]);
  const weekdayDays = Math.max(1, countDaysInMonth(now) - weekendDays);
  const weekendRate = weekendDays > 0 ? weekendThis / weekendDays : 0;
  const weekdayRate = weekdayThis / weekdayDays;
  if (weekdayRate > 0 && weekendRate > weekdayRate) {
    const uplift = Math.round(((weekendRate - weekdayRate) / weekdayRate) * 100);
    if (uplift >= 10) {
      habits.push({ text: `You spend ${uplift}% more per day on weekends than weekdays.`, tone: "negative" });
    }
  }

  // Salary-day food bump
  const salaryTimes = incomes.map((i) => new Date(i.transaction_date).getTime());
  const foodCats = new Set(categories.filter((c) => /food|dining|restaurant/i.test(c.name)).map((c) => c.id));
  const foodNearSalary = sum(
    thisMonthExp
      .filter(
        (t) =>
          foodCats.has(t.category_id ?? "") &&
          salaryTimes.some((s) => {
            const ts = new Date(t.transaction_date).getTime();
            return ts >= s && ts - s <= 5 * DAY_MS;
          }),
      )
      .map((t) => t.amount),
  );
  const foodTotal = sum(thisMonthExp.filter((t) => foodCats.has(t.category_id ?? "")).map((t) => t.amount));
  if (salaryTimes.length > 0 && foodTotal > 0 && foodNearSalary / foodTotal > 0.4) {
    habits.push({
      text: `${Math.round((foodNearSalary / foodTotal) * 100)}% of food spending happens in the 5 days after salary credit.`,
      tone: "negative",
    });
  }

  // Category-level month-over-month deltas
  const byCat = (list: Transaction[]) => {
    const m = new Map<string, number>();
    list.forEach((t) => {
      const k = t.category_id ?? "uncategorized";
      m.set(k, (m.get(k) ?? 0) + t.amount);
    });
    return m;
  };
  const cur = byCat(thisMonthExp);
  const prev = byCat(priorMonthExp);
  const deltas: { name: string; delta: number; ratio: number }[] = [];
  cur.forEach((v, k) => {
    const p = prev.get(k) ?? 0;
    if (p === 0 && v === 0) return;
    const name = categories.find((c) => c.id === k)?.name ?? "Uncategorized";
    const ratio = p > 0 ? (v - p) / p : v > 0 ? 1 : 0;
    deltas.push({ name, delta: v - p, ratio });
  });
  deltas.sort((a, b) => Math.abs(b.ratio) - Math.abs(a.ratio));
  for (const d of deltas.slice(0, 3)) {
    if (Math.abs(d.ratio) < 0.1) continue;
    if (d.ratio > 0) {
      habits.push({
        text: `${d.name} spending increased ${Math.round(d.ratio * 100)}% compared to last month.`,
        tone: "negative",
      });
    } else {
      habits.push({
        text: `${d.name} spending reduced ${Math.round(Math.abs(d.ratio) * 100)}% compared to last month.`,
        tone: "positive",
      });
    }
  }

  // Stable category
  const stable = deltas.find((d) => Math.abs(d.ratio) < 0.05 && d.name !== "Uncategorized");
  if (stable) habits.push({ text: `${stable.name} expenses remain stable this month.`, tone: "neutral" });

  return habits.slice(0, 6);
}

function countDaysInMonth(ref: Date, filterDays?: number[]) {
  const y = ref.getFullYear();
  const m = ref.getMonth();
  const last = new Date(y, m + 1, 0).getDate();
  let n = 0;
  for (let d = 1; d <= last; d++) {
    const day = new Date(y, m, d).getDay();
    if (!filterDays || filterDays.includes(day)) n++;
  }
  return n;
}

// ---------- Positive Habits ----------

function buildPositiveHabits(args: {
  thisMonthExp: Transaction[];
  thisMonthIncome: number;
  monthlySalary: number;
  budgets: Budget[];
  categories: Category[];
  loans: Loan[];
  transactions: Transaction[];
  now: Date;
}): PositiveHabit[] {
  const { thisMonthExp, thisMonthIncome, monthlySalary, budgets, categories, loans, transactions, now } = args;
  const out: PositiveHabit[] = [];

  // Budget adherence
  const withLimit = budgets.filter((b) => b.monthly_limit > 0 && b.category_id);
  if (withLimit.length > 0) {
    const under = withLimit.filter((b) => {
      const spent = sum(
        thisMonthExp.filter((t) => t.category_id === b.category_id).map((t) => t.amount),
      );
      return spent <= b.monthly_limit;
    });
    if (under.length === withLimit.length) {
      out.push({ key: "under-budget", title: "Stayed under budget", detail: `All ${withLimit.length} tracked categories within limits.` });
    } else if (under.length / withLimit.length >= 0.7) {
      out.push({
        key: "mostly-budget",
        title: "Mostly on budget",
        detail: `${under.length} of ${withLimit.length} categories stayed within limits.`,
      });
    }
  }

  // Investment streak
  const invCats = new Set(categories.filter((c) => /invest|sip|mutual|stock/i.test(c.name)).map((c) => c.id));
  const monthsWithInv = new Set<string>();
  transactions
    .filter((t) => invCats.has(t.category_id ?? "") || /sip|invest/i.test(t.notes ?? ""))
    .forEach((t) => monthsWithInv.add(ymKey(new Date(t.transaction_date))));
  if (monthsWithInv.size >= 2) {
    out.push({ key: "invest", title: "Investment streak", detail: `Invested in ${monthsWithInv.size} of the last months.` });
  }

  // No EMI default
  const anyOverdue = loans.some((l) => Number(l.remaining_balance) > 0 && l.due_day < now.getDate() - 3);
  if (loans.length > 0 && !anyOverdue) {
    out.push({ key: "emi-clean", title: "No EMI default", detail: "All active loans appear on schedule this month." });
  }

  // Saved before spending — first income of month precedes first big expense
  const monthTx = transactions.filter((t) => inMonth(new Date(t.transaction_date), now));
  const firstIncome = monthTx.find((t) => t.type === "income");
  const firstBigExp = monthTx.find((t) => t.type === "expense" && t.amount >= 500);
  if (firstIncome && firstBigExp && new Date(firstIncome.transaction_date) <= new Date(firstBigExp.transaction_date)) {
    out.push({ key: "save-first", title: "Saved before spending", detail: "Income was recorded before your first large expense." });
  }

  // Bills paid on time
  const billCats = new Set(categories.filter((c) => /bill|utility|rent/i.test(c.name)).map((c) => c.id));
  const billsThisMonth = thisMonthExp.filter((t) => billCats.has(t.category_id ?? ""));
  if (billsThisMonth.length > 0 && billsThisMonth.every((t) => new Date(t.transaction_date).getDate() <= 15)) {
    out.push({ key: "bills-on-time", title: "Bills paid on time", detail: "All bill payments cleared in the first half of the month." });
  }

  // Emergency fund growing — income > expense this month
  const income = monthlySalary || thisMonthIncome;
  if (income > 0 && income - sum(thisMonthExp.map((t) => t.amount)) > income * 0.1) {
    out.push({ key: "emergency-grow", title: "Emergency fund growing", detail: "You saved more than 10% of your income this month." });
  }

  return out.slice(0, 6);
}

// ---------- Improvements ----------

function buildImprovements(args: {
  thisMonthExp: Transaction[];
  priorMonthExp: Transaction[];
  monthlySalary: number;
  thisMonthIncome: number;
  categories: Category[];
}): ImprovementHabit[] {
  const { thisMonthExp, priorMonthExp, monthlySalary, thisMonthIncome, categories } = args;
  const income = monthlySalary || thisMonthIncome || 1;

  const byCat = (list: Transaction[]) => {
    const m = new Map<string, number>();
    list.forEach((t) => {
      const k = t.category_id ?? "uncategorized";
      m.set(k, (m.get(k) ?? 0) + t.amount);
    });
    return m;
  };
  const cur = byCat(thisMonthExp);
  const prev = byCat(priorMonthExp);

  const rows: ImprovementHabit[] = [];
  cur.forEach((v, k) => {
    const p = prev.get(k) ?? 0;
    const name = categories.find((c) => c.id === k)?.name ?? "Uncategorized";
    if (name === "Uncategorized" && v < 500) return;
    const growth = p > 0 ? (v - p) / p : 0;
    const share = v / income;
    // Score by growth + share
    const priorityScore = Math.max(0, growth) * 60 + share * 100;
    if (priorityScore < 15) return;
    const saving = Math.max(200, Math.round((v * 0.1) / 50) * 50);
    const difficulty: ImprovementHabit["difficulty"] = share > 0.3 ? "Hard" : share > 0.15 ? "Medium" : "Easy";
    const boost = Math.min(10, Math.round(share * 20 + Math.max(0, growth) * 5));
    rows.push({
      key: k,
      problem:
        growth > 0.1
          ? `${name} spending grew ${Math.round(growth * 100)}% vs last month and now takes ${Math.round(share * 100)}% of income.`
          : `${name} takes ${Math.round(share * 100)}% of your income — the largest reducible outflow.`,
      estimatedMonthlySaving: saving,
      difficulty,
      scoreBoost: Math.max(1, boost),
      action: `Cap ${name} at ${Math.round((v - saving) / 100) * 100} next month`,
    });
  });
  rows.sort((a, b) => b.scoreBoost - a.scoreBoost || b.estimatedMonthlySaving - a.estimatedMonthlySaving);
  return rows.slice(0, 3);
}

// ---------- Prediction ----------

function buildPrediction(args: {
  expenses: Transaction[];
  monthlySalary: number;
  thisMonthIncome: number;
  categories: Category[];
  now: Date;
}): Prediction {
  const { expenses, monthlySalary, thisMonthIncome, categories, now } = args;
  const income = monthlySalary || thisMonthIncome;

  // Average of last 3 completed months (or fewer)
  const months: number[] = [];
  const catTotals = new Map<string, number>();
  let sampleMonths = 0;
  for (let i = 1; i <= 3; i++) {
    const ref = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const list = expenses.filter((t) => inMonth(new Date(t.transaction_date), ref));
    if (list.length === 0) continue;
    sampleMonths++;
    months.push(sum(list.map((t) => t.amount)));
    list.forEach((t) => {
      const k = t.category_id ?? "uncategorized";
      catTotals.set(k, (catTotals.get(k) ?? 0) + t.amount);
    });
  }
  const avg = months.length > 0 ? sum(months) / months.length : 0;
  const nextMonthSpend = Math.round(avg);
  const topEntry = [...catTotals.entries()].sort((a, b) => b[1] - a[1])[0];
  const highestCategory = topEntry ? categoryName(topEntry[0], categories) : null;

  const overspendRisk: Prediction["overspendRisk"] =
    income > 0 && nextMonthSpend > income ? "High" : income > 0 && nextMonthSpend > income * 0.85 ? "Medium" : "Low";

  const expectedSavings = Math.max(0, income - nextMonthSpend);
  const savingsRate = income > 0 ? expectedSavings / income : 0;
  const expectedSurvivalScore = Math.max(
    10,
    Math.min(100, Math.round(50 + savingsRate * 60 - (nextMonthSpend > income ? 25 : 0))),
  );
  const confidence = Math.max(30, Math.min(90, 40 + sampleMonths * 15));

  return {
    nextMonthSpend,
    highestCategory,
    overspendRisk,
    expectedSavings,
    expectedSurvivalScore,
    confidence,
  };
}

// ---------- Timeline ----------

function buildTimeline(args: { transactions: Transaction[]; now: Date }): TimelineWeek[] {
  const { transactions, now } = args;
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const weeks: TimelineWeek[] = [];

  for (let w = 0; w < 4; w++) {
    const start = new Date(monthStart);
    start.setDate(1 + w * 7);
    if (start > monthEnd) break;
    const end = new Date(start);
    end.setDate(Math.min(monthEnd.getDate(), start.getDate() + 6));
    const list = transactions.filter((t) => {
      const d = new Date(t.transaction_date);
      return d >= start && d <= end;
    });
    const spend = sum(list.filter(isExpense).map((t) => t.amount));
    const income = sum(list.filter(isIncome).map((t) => t.amount));
    weeks.push({
      weekLabel: `Week ${w + 1}`,
      range: `${start.getDate()}–${end.getDate()} ${start.toLocaleString(undefined, { month: "short" })}`,
      spend,
      income,
      note: describeWeek(list, income, spend, weeks),
    });
  }
  return weeks;
}

function describeWeek(list: Transaction[], income: number, spend: number, prior: TimelineWeek[]): string {
  if (list.length === 0) return "No activity recorded.";
  if (income > 0 && income >= spend) return "Salary received";
  const priorSpend = prior[prior.length - 1]?.spend ?? 0;
  if (priorSpend > 0 && spend > priorSpend * 1.2) return "Spending increased vs last week";
  if (priorSpend > 0 && spend < priorSpend * 0.8) return "Spending reduced vs last week";
  return "Spending stayed steady";
}

// ---------- AI Insights ----------

function buildAiInsights(args: {
  patterns: BehaviorPattern[];
  thisMonthExp: Transaction[];
  priorMonthExp: Transaction[];
  thisMonthTotal: number;
  priorMonthTotal: number;
  monthlySalary: number;
  thisMonthIncome: number;
  categories: Category[];
}): AiInsight[] {
  const { patterns, thisMonthExp, priorMonthExp, thisMonthTotal, priorMonthTotal, monthlySalary, thisMonthIncome, categories } = args;
  const out: AiInsight[] = [];
  const income = monthlySalary || thisMonthIncome;

  // 1. Weekend overspend
  const wknd = patterns.find((p) => p.key === "weekend");
  if (wknd && wknd.percentage >= 30) {
    out.push({
      id: "insight-weekend",
      text: `You usually overspend during weekends (${wknd.percentage}% of monthly spend).`,
      detail: `Weekend transactions total more than one-third of the month. Capping Saturday–Sunday spend could redirect meaningful money to savings.`,
      plannerTitle: "Set a weekend spending cap",
      plannerDetail: "Decide a fixed Sat+Sun budget before the weekend starts.",
    });
  }

  // 2. Salary day food bump
  const sal = patterns.find((p) => p.key === "salary-day");
  if (sal && sal.percentage >= 30) {
    out.push({
      id: "insight-salary-day",
      text: `Food and discretionary spending rise soon after salary day (${sal.percentage}% within 3 days).`,
      detail: `A big share of the month's spend clusters in the first days after salary. Moving savings on salary day protects that surplus.`,
      plannerTitle: "Auto-move savings on salary day",
      plannerDetail: "Transfer 10% of salary to savings before spending starts.",
    });
  }

  // 3. MoM trend
  if (priorMonthTotal > 0) {
    const ratio = (thisMonthTotal - priorMonthTotal) / priorMonthTotal;
    if (Math.abs(ratio) >= 0.1) {
      out.push({
        id: "insight-mom",
        text:
          ratio > 0
            ? `Overall spending is up ${Math.round(ratio * 100)}% vs last month.`
            : `Overall spending dropped ${Math.round(Math.abs(ratio) * 100)}% vs last month — nice control.`,
        detail: `This month total is ${Math.round(thisMonthTotal)} vs ${Math.round(priorMonthTotal)} last month.`,
        plannerTitle: ratio > 0 ? "Review top growing category" : "Lock in this month's savings",
        plannerDetail: ratio > 0 ? "Set a lower cap on the fastest-growing category." : "Move the saved amount to your goal account.",
      });
    }
  }

  // 4. Investment consistency
  const invCats = new Set(categories.filter((c) => /invest|sip|mutual/i.test(c.name)).map((c) => c.id));
  const invThis = thisMonthExp.filter((t) => invCats.has(t.category_id ?? "")).length;
  const invPrev = priorMonthExp.filter((t) => invCats.has(t.category_id ?? "")).length;
  if (invThis > 0 && invThis >= invPrev) {
    out.push({
      id: "insight-invest",
      text: "Investment consistency improved this month.",
      detail: `You logged ${invThis} investment transactions this month vs ${invPrev} last month.`,
      plannerTitle: "Increase SIP by a small step",
      plannerDetail: "Consider a 5–10% bump to your monthly SIP.",
    });
  }

  // 5. Balance/savings signal (income-relative)
  if (income > 0 && thisMonthTotal > 0 && thisMonthTotal < income * 0.7) {
    out.push({
      id: "insight-buffer",
      text: `You save more when spending stays below ${Math.round(income * 0.7).toLocaleString("en-IN")} — you're on track this month.`,
      detail: `Spending is at ${Math.round((thisMonthTotal / income) * 100)}% of income. Keeping it below 70% preserves your buffer.`,
      plannerTitle: "Protect the buffer this month",
      plannerDetail: "Delay any large discretionary purchase to next cycle.",
    });
  }

  return out.slice(0, 5);
}
