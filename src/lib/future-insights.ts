// Future tab insights — reuses existing calculations from Planner (survival),
// Goals (localStorage), Loans, Financial Profile, and Transactions.
// No new business logic; pure aggregation for the "Future" tab.

import type { Survival } from "@/lib/survival";
import { getRememberedSavings, getFinancialProfile } from "@/lib/financial-profile";

export type Grade = "A+" | "A" | "B+" | "B" | "C" | "D";

export type FutureGoal = {
  id: string;
  name: string;
  kind: string;
  target: number;
  current: number;
  monthly: number;
  deadline?: string;
};

const GOALS_KEY = "fintrackr_goals_v1";

export function loadFutureGoals(): FutureGoal[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(GOALS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

type Tx = { type: string; amount: number | string; transaction_date: string };
type Loan = { remaining_balance: number | string; emi_amount: number | string };

/** Average monthly expenses over the trailing 90 days. Null if <30 days of data. */
export function avgMonthlyExpenses(transactions: Tx[]): number | null {
  if (!transactions.length) return null;
  const now = Date.now();
  const cutoff = now - 90 * 86_400_000;
  const recent = transactions.filter(
    (t) => t.type === "expense" && new Date(t.transaction_date).getTime() >= cutoff,
  );
  if (recent.length === 0) return null;
  const total = recent.reduce((s, t) => s + Number(t.amount), 0);
  const firstTs = Math.min(...recent.map((t) => new Date(t.transaction_date).getTime()));
  const spanDays = Math.max(1, Math.round((now - firstTs) / 86_400_000));
  if (spanDays < 30) return null;
  return (total / spanDays) * 30;
}

export type FutureComponent = { value: number | null; max: number; label: string; detail: string };

export type FutureScore = {
  total: number | null;
  grade: Grade | null;
  headline: string;
  components: {
    emergency: FutureComponent;
    savings: FutureComponent;
    debt: FutureComponent;
    discipline: FutureComponent;
  };
};

function gradeOf(pct: number): Grade {
  if (pct >= 90) return "A+";
  if (pct >= 80) return "A";
  if (pct >= 70) return "B+";
  if (pct >= 60) return "B";
  if (pct >= 45) return "C";
  return "D";
}

export function computeFutureScore(opts: {
  survival: Survival;
  transactions: Tx[];
  loans: Loan[];
  goals: FutureGoal[];
}): FutureScore {
  const { survival, transactions, loans, goals } = opts;
  const rememberedSavings = getRememberedSavings();
  const savingsGoalTotal = goals
    .filter((g) => g.kind === "savings" || g.kind === "emergency" || g.kind === "investment")
    .reduce((s, g) => s + Number(g.current || 0), 0);
  const totalSavings =
    (rememberedSavings ?? 0) + savingsGoalTotal;
  const hasSavingsSignal = rememberedSavings != null || savingsGoalTotal > 0;

  const avgExp = avgMonthlyExpenses(transactions);

  // 1. Emergency Fund — months covered (target: 6 months)
  let emergency: FutureComponent = {
    value: null,
    max: 25,
    label: "Emergency Fund",
    detail: "Add savings + 60d of expenses to unlock",
  };
  if (avgExp != null && hasSavingsSignal) {
    const months = totalSavings / Math.max(1, avgExp);
    const pct = Math.max(0, Math.min(1, months / 6));
    emergency = {
      value: Math.round(pct * 25),
      max: 25,
      label: "Emergency Fund",
      detail: `${months.toFixed(1)} of 6 months covered`,
    };
  }

  // 2. Savings Rate — from current pay cycle (reuse survival)
  let savings: FutureComponent = {
    value: null,
    max: 25,
    label: "Savings Rate",
    detail: "Add salary to unlock",
  };
  if (survival.hasIncome) {
    const rate = survival.salaryLeft / survival.salary; // 0..1
    const pct = Math.max(0, Math.min(1, rate / 0.2)); // 20%+ = full marks
    savings = {
      value: Math.round(pct * 25),
      max: 25,
      label: "Savings Rate",
      detail: `${Math.round(rate * 100)}% of salary unspent`,
    };
  }

  // 3. Debt Ratio — EMI as % of salary (reuse survival.emiRatio)
  let debt: FutureComponent = {
    value: null,
    max: 25,
    label: "Debt Ratio",
    detail: "Add salary to unlock",
  };
  if (survival.hasIncome) {
    const outstanding = loans.reduce((s, l) => s + Number(l.remaining_balance || 0), 0);
    // Full marks at 0% EMI, zero at 40%+
    const pct = Math.max(0, Math.min(1, 1 - survival.emiRatio / 40));
    debt = {
      value: Math.round(pct * 25),
      max: 25,
      label: "Debt Ratio",
      detail:
        outstanding > 0
          ? `EMI ${survival.emiRatio.toFixed(0)}% of salary`
          : "No active loans",
    };
  }

  // 4. Spending Discipline — reuse survival score
  const discipline: FutureComponent = survival.hasIncome
    ? {
        value: Math.round((survival.score / 100) * 25),
        max: 25,
        label: "Spending Discipline",
        detail: `Survival score ${survival.score}/100`,
      }
    : {
        value: null,
        max: 25,
        label: "Spending Discipline",
        detail: "Add salary to unlock",
      };

  const parts = [emergency, savings, debt, discipline];
  const known = parts.filter((p) => p.value != null) as (FutureComponent & { value: number })[];
  if (known.length === 0) {
    return {
      total: null,
      grade: null,
      headline: "Complete your Salary Profile to see your Future Score.",
      components: { emergency, savings, debt, discipline },
    };
  }

  // Scale partial results to /100 so a missing pillar doesn't fake a low score.
  const knownMax = known.reduce((s, p) => s + p.max, 0);
  const knownVal = known.reduce((s, p) => s + p.value, 0);
  const total = Math.round((knownVal / knownMax) * 100);
  const grade = gradeOf(total);

  const headline =
    total >= 80
      ? "You're on a strong path to financial freedom."
      : total >= 60
        ? "Solid foundation — small tweaks will accelerate you."
        : total >= 40
          ? "Focus on savings and reducing EMI load."
          : "Rebuild your buffer before taking on new commitments.";

  return {
    total,
    grade,
    headline: known.length < 4 ? `${headline} (based on ${known.length}/4 pillars)` : headline,
    components: { emergency, savings, debt, discipline },
  };
}

/* =========================== Milestones =========================== */

export type MilestoneStatus = "achieved" | "on-track" | "behind" | "locked";

export type Milestone = {
  key: string;
  title: string;
  current: number | null;
  target: number | null;
  monthsToGo: number | null;
  eta: Date | null;
  status: MilestoneStatus;
  lockedReason?: string;
  progressPct: number; // 0..100
  detail: string;
};

function eta(months: number | null): Date | null {
  if (months == null || !Number.isFinite(months) || months < 0) return null;
  const d = new Date();
  d.setMonth(d.getMonth() + Math.ceil(months));
  return d;
}

export function computeMilestones(opts: {
  survival: Survival;
  transactions: Tx[];
  loans: Loan[];
  goals: FutureGoal[];
}): Milestone[] {
  const { survival, transactions, loans, goals } = opts;
  const profile = getFinancialProfile();
  const rememberedSavings = getRememberedSavings();
  const avgExp = avgMonthlyExpenses(transactions);

  // Aggregate current savings signal
  const savingsGoalsCurrent = goals
    .filter((g) => g.kind === "savings" || g.kind === "emergency" || g.kind === "investment")
    .reduce((s, g) => s + Number(g.current || 0), 0);
  const totalSavings = (rememberedSavings ?? 0) + savingsGoalsCurrent;
  const savingsKnown = rememberedSavings != null || savingsGoalsCurrent > 0;

  // Monthly savings capacity: prefer sum of goal monthly commits, else salaryLeft.
  const goalMonthly = goals.reduce((s, g) => s + Number(g.monthly || 0), 0);
  const monthlySave =
    goalMonthly > 0
      ? goalMonthly
      : survival.hasIncome
        ? Math.max(0, survival.salaryLeft)
        : 0;

  // Loans
  const outstanding = loans.reduce((s, l) => s + Number(l.remaining_balance || 0), 0);
  const monthlyEmi = survival.monthlyEmi;

  const out: Milestone[] = [];

  // 1. Emergency Fund — 6 months of expenses
  if (avgExp != null && avgExp > 0) {
    const target = Math.round(avgExp * 6);
    const current = savingsKnown ? totalSavings : 0;
    const remaining = Math.max(0, target - current);
    const months = monthlySave > 0 ? remaining / monthlySave : null;
    const achieved = current >= target;
    out.push({
      key: "emergency",
      title: "Emergency Fund (6 months)",
      current,
      target,
      monthsToGo: achieved ? 0 : months,
      eta: achieved ? null : eta(months),
      status: achieved ? "achieved" : months != null && months <= 24 ? "on-track" : "behind",
      progressPct: target > 0 ? Math.min(100, (current / target) * 100) : 0,
      detail: achieved
        ? "6 months of expenses secured"
        : `${(current / avgExp).toFixed(1)} of 6 months covered`,
    });
  } else {
    out.push({
      key: "emergency",
      title: "Emergency Fund (6 months)",
      current: null,
      target: null,
      monthsToGo: null,
      eta: null,
      status: "locked",
      progressPct: 0,
      detail: "Add expenses & savings to estimate",
      lockedReason: "Complete your Salary Profile to unlock this milestone.",
    });
  }

  // 2. Debt Free — reuse Planner loan math
  if (outstanding <= 0) {
    out.push({
      key: "debt-free",
      title: "Debt Free",
      current: 0,
      target: 0,
      monthsToGo: 0,
      eta: null,
      status: "achieved",
      progressPct: 100,
      detail: "No active loans",
    });
  } else if (monthlyEmi > 0) {
    const months = Math.ceil(outstanding / monthlyEmi);
    out.push({
      key: "debt-free",
      title: "Debt Free",
      current: 0,
      target: outstanding,
      monthsToGo: months,
      eta: eta(months),
      status: months <= 36 ? "on-track" : "behind",
      progressPct: 0,
      detail: `${months} EMI payment${months === 1 ? "" : "s"} remaining`,
    });
  } else {
    out.push({
      key: "debt-free",
      title: "Debt Free",
      current: 0,
      target: outstanding,
      monthsToGo: null,
      eta: null,
      status: "locked",
      progressPct: 0,
      detail: "Set EMI on your loans to estimate",
      lockedReason: "Add EMI amounts to your loans to unlock.",
    });
  }

  // 3. ₹1 Lakh Savings
  {
    const target = 100_000;
    if (savingsKnown) {
      const remaining = Math.max(0, target - totalSavings);
      const achieved = totalSavings >= target;
      const months = achieved ? 0 : monthlySave > 0 ? remaining / monthlySave : null;
      out.push({
        key: "one-lakh",
        title: "₹1 Lakh Savings",
        current: totalSavings,
        target,
        monthsToGo: months,
        eta: achieved ? null : eta(months),
        status: achieved ? "achieved" : months != null ? "on-track" : "behind",
        progressPct: Math.min(100, (totalSavings / target) * 100),
        detail: achieved ? "Milestone reached" : `${((totalSavings / target) * 100).toFixed(0)}% of ₹1,00,000`,
      });
    } else {
      out.push({
        key: "one-lakh",
        title: "₹1 Lakh Savings",
        current: null,
        target,
        monthsToGo: null,
        eta: null,
        status: "locked",
        progressPct: 0,
        detail: "Add savings to track",
        lockedReason: "Complete your Salary Profile to unlock this milestone.",
      });
    }
  }

  // 4. ₹5 Lakh Net Worth = savings + goal balances − loan outstanding
  {
    const target = 500_000;
    if (savingsKnown || outstanding > 0) {
      const netWorth = totalSavings - outstanding;
      const achieved = netWorth >= target;
      const remaining = Math.max(0, target - netWorth);
      const months = achieved
        ? 0
        : monthlySave > 0
          ? remaining / monthlySave
          : null;
      out.push({
        key: "net-worth",
        title: "₹5 Lakh Net Worth",
        current: netWorth,
        target,
        monthsToGo: months,
        eta: achieved ? null : eta(months),
        status: achieved ? "achieved" : months != null && months <= 60 ? "on-track" : "behind",
        progressPct: Math.max(0, Math.min(100, (netWorth / target) * 100)),
        detail: achieved
          ? "Milestone reached"
          : netWorth >= 0
            ? `Net worth ~${Math.round(netWorth).toLocaleString()}`
            : `Debt exceeds savings by ${Math.abs(Math.round(netWorth)).toLocaleString()}`,
      });
    } else {
      out.push({
        key: "net-worth",
        title: "₹5 Lakh Net Worth",
        current: null,
        target,
        monthsToGo: null,
        eta: null,
        status: "locked",
        progressPct: 0,
        detail: "Add savings & loans to estimate",
        lockedReason: "Complete your Salary Profile to unlock this milestone.",
      });
    }
  }

  // 5. Financial Freedom (FIRE) — 25x annual expenses
  if (avgExp != null && avgExp > 0) {
    const target = Math.round(avgExp * 12 * 25);
    const current = savingsKnown ? totalSavings : 0;
    const achieved = current >= target;
    const remaining = Math.max(0, target - current);
    const months = achieved ? 0 : monthlySave > 0 ? remaining / monthlySave : null;
    out.push({
      key: "fire",
      title: "Financial Freedom (FIRE)",
      current,
      target,
      monthsToGo: months,
      eta: achieved ? null : eta(months),
      status: achieved ? "achieved" : months != null && months <= 300 ? "on-track" : "behind",
      progressPct: Math.min(100, (current / target) * 100),
      detail: achieved
        ? "You are financially free"
        : `${((current / target) * 100).toFixed(1)}% of 25× annual expenses`,
    });
  } else {
    out.push({
      key: "fire",
      title: "Financial Freedom (FIRE)",
      current: null,
      target: null,
      monthsToGo: null,
      eta: null,
      status: "locked",
      progressPct: 0,
      detail: "Requires expense history",
      lockedReason: "Complete your Salary Profile to unlock this milestone.",
    });
  }

  // Silence unused var lint
  void profile;

  return out;
}

/* =========================== Future Actions =========================== */

export type FutureAction = {
  id: "emergency" | "savings" | "extra-emi" | "sip" | "reduce-spend";
  priority: "High" | "Medium" | "Low";
  title: string;
  why: string;
  impactAmount: number; // monthly ₹ impact
  impactLabel: string;
  timeSaved: string;
  plannerTitle: string;
  plannerDetail: string;
  coachPrompt: string;
};

export function computeFutureActions(opts: {
  survival: Survival;
  transactions: Tx[];
  loans: Loan[];
  goals: FutureGoal[];
}): FutureAction[] {
  const { survival, transactions, loans, goals } = opts;
  const rememberedSavings = getRememberedSavings();
  const savingsGoalCurrent = goals
    .filter((g) => g.kind === "savings" || g.kind === "emergency" || g.kind === "investment")
    .reduce((s, g) => s + Number(g.current || 0), 0);
  const totalSavings = (rememberedSavings ?? 0) + savingsGoalCurrent;
  const avgExp = avgMonthlyExpenses(transactions);
  const outstanding = loans.reduce((s, l) => s + Number(l.remaining_balance || 0), 0);
  const monthlyEmi = survival.monthlyEmi;
  const salaryLeft = survival.hasIncome ? Math.max(0, survival.salaryLeft) : 0;
  const savingsRate = survival.hasIncome ? salaryLeft / Math.max(1, survival.salary) : 0;
  const hasInvestmentGoal = goals.some((g) => g.kind === "investment");

  const candidates: (FutureAction & { rank: number })[] = [];

  // 1. Emergency Fund
  if (avgExp != null && avgExp > 0) {
    const months = totalSavings / avgExp;
    if (months < 6) {
      const target = avgExp * 6;
      const gap = Math.max(0, target - totalSavings);
      const monthly = Math.max(500, Math.round(Math.min(gap / 12, salaryLeft > 0 ? salaryLeft * 0.4 : gap / 12)));
      const monthsToDone = Math.ceil(gap / Math.max(1, monthly));
      candidates.push({
        id: "emergency",
        priority: months < 2 ? "High" : months < 4 ? "Medium" : "Low",
        title: "Build Emergency Fund",
        why: `You have ~${months.toFixed(1)} months of expenses saved. Target is 6 months to stay safe from job loss or big surprises.`,
        impactAmount: monthly,
        impactLabel: `Save ~${inr(monthly)}/mo`,
        timeSaved: `Fully funded in ~${monthsToDone} mo`,
        plannerTitle: "Grow emergency fund",
        plannerDetail: `Set aside ~${inr(monthly)}/mo toward 6-month buffer (${inr(target)})`,
        coachPrompt: "How do I build an emergency fund faster?",
        rank: (6 - months) * 20,
      });
    }
  }

  // 2. Pay Extra EMI
  if (outstanding > 0 && monthlyEmi > 0) {
    const extra = Math.max(500, Math.round(Math.min(monthlyEmi * 0.2, salaryLeft * 0.25 || monthlyEmi * 0.2)));
    const baseMonths = Math.ceil(outstanding / monthlyEmi);
    const newMonths = Math.ceil(outstanding / (monthlyEmi + extra));
    const saved = Math.max(0, baseMonths - newMonths);
    candidates.push({
      id: "extra-emi",
      priority: survival.emiRatio > 30 ? "High" : "Medium",
      title: "Pay Extra EMI",
      why: `EMIs are ${survival.emiRatio.toFixed(0)}% of your salary. Adding ~${inr(extra)}/mo cuts interest and closes loans sooner.`,
      impactAmount: extra,
      impactLabel: `+${inr(extra)}/mo prepayment`,
      timeSaved: saved > 0 ? `~${saved} mo earlier` : "Faster debt free",
      plannerTitle: "Pay extra EMI",
      plannerDetail: `Prepay ~${inr(extra)}/mo on existing loans`,
      coachPrompt: "Which loan should I prepay first?",
      rank: survival.emiRatio,
    });
  }

  // 3. Increase Monthly Savings
  if (survival.hasIncome && savingsRate < 0.2) {
    const target = Math.round(survival.salary * 0.2);
    const gap = Math.max(500, target - salaryLeft);
    candidates.push({
      id: "savings",
      priority: savingsRate < 0.05 ? "High" : "Medium",
      title: "Increase Monthly Savings",
      why: `You're saving ~${Math.round(savingsRate * 100)}% of salary. Reaching 20% (${inr(target)}/mo) accelerates every future milestone.`,
      impactAmount: gap,
      impactLabel: `+${inr(gap)}/mo saved`,
      timeSaved: `+${inr(gap * 12)}/yr`,
      plannerTitle: "Raise monthly savings",
      plannerDetail: `Target ${inr(target)}/mo (20% of salary)`,
      coachPrompt: "Where can I cut spend to save more each month?",
      rank: (0.2 - savingsRate) * 100,
    });
  }

  // 4. Start SIP
  if (!hasInvestmentGoal && salaryLeft > 500) {
    const sip = Math.max(500, Math.round(Math.min(salaryLeft * 0.15, survival.salary * 0.1)));
    candidates.push({
      id: "sip",
      priority: "Medium",
      title: "Start a SIP",
      why: "You have no active investment goal. A small monthly SIP compounds into long-term wealth.",
      impactAmount: sip,
      impactLabel: `${inr(sip)}/mo SIP`,
      timeSaved: `~${inr(sip * 12 * 10)} in 10 yrs @ 12%`,
      plannerTitle: "Start monthly SIP",
      plannerDetail: `Invest ${inr(sip)}/mo in a diversified fund`,
      coachPrompt: "How do I start my first SIP?",
      rank: 25,
    });
  }

  // 5. Reduce Weekly Spending
  if (survival.hasIncome && (survival.score < 60 || salaryLeft < survival.salary * 0.1)) {
    const cut = Math.max(200, Math.round(survival.salary * 0.02));
    candidates.push({
      id: "reduce-spend",
      priority: survival.score < 40 ? "High" : "Medium",
      title: "Reduce Weekly Spending",
      why: `Survival score is ${survival.score}/100. Trimming ~${inr(cut)}/week frees ${inr(cut * 4)}/mo for savings.`,
      impactAmount: cut * 4,
      impactLabel: `${inr(cut)}/wk cut`,
      timeSaved: `+${inr(cut * 52)}/yr`,
      plannerTitle: "Cut weekly spend",
      plannerDetail: `Trim ~${inr(cut)}/week from lifestyle categories`,
      coachPrompt: "Which category is bleeding my weekly budget?",
      rank: (60 - survival.score),
    });
  }

  return candidates
    .sort((a, b) => b.rank - a.rank)
    .slice(0, 3)
    .map(({ rank: _r, ...rest }) => rest);
}

function inr(n: number): string {
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

/* =========================== Net Worth =========================== */

export type NetWorth = {
  savings: number;
  goalsBalance: number;
  investments: number;
  assets: number;
  liabilities: number;
  netWorth: number;
  futureFundGoal: number;
  progressPct: number;
  hasSignal: boolean;
};

/** Reuses rememberedSavings + goals + loan outstanding. No new business logic. */
export function computeNetWorth(opts: {
  survival: Survival;
  transactions: Tx[];
  loans: Loan[];
  goals: FutureGoal[];
}): NetWorth {
  const { survival, transactions, loans, goals } = opts;
  const rememberedSavings = getRememberedSavings() ?? 0;
  const investments = goals
    .filter((g) => g.kind === "investment")
    .reduce((s, g) => s + Number(g.current || 0), 0);
  const goalsBalance = goals
    .filter((g) => g.kind !== "investment")
    .reduce((s, g) => s + Number(g.current || 0), 0);
  const assets = rememberedSavings + goalsBalance + investments;
  const liabilities = loans.reduce((s, l) => s + Number(l.remaining_balance || 0), 0);
  const netWorth = assets - liabilities;

  // Future Fund Goal = 25× annual expenses (FIRE) when available, else ₹5L default.
  const avgExp = avgMonthlyExpenses(transactions);
  const futureFundGoal = avgExp && avgExp > 0 ? Math.round(avgExp * 12 * 25) : 500_000;
  const progressPct = Math.max(0, Math.min(100, (netWorth / futureFundGoal) * 100));

  const hasSignal =
    rememberedSavings > 0 ||
    goalsBalance > 0 ||
    investments > 0 ||
    liabilities > 0 ||
    survival.hasIncome;

  return {
    savings: rememberedSavings,
    goalsBalance,
    investments,
    assets,
    liabilities,
    netWorth,
    futureFundGoal,
    progressPct,
    hasSignal,
  };
}
