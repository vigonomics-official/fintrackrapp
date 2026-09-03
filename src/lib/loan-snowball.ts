import type { Loan } from "@/hooks/use-finance";

/**
 * Read-only debt-snowball projection.
 *
 * Nothing here writes to the database — it only simulates, from the existing
 * loan rows, what would happen if the user paid every minimum EMI plus an
 * optional extra amount on the smallest outstanding balance first, rolling
 * freed-up payments into the next smallest loan.
 */

export type SnowballStep = {
  id: string;
  name: string;
  balance: number;
  emi: number;
  rate: number;
  /** Months from now when this loan is projected to close (estimate). */
  monthsToClose: number;
  payoffDate: Date | null;
};

export type PayoffStrategy = "snowball" | "avalanche";

export type SnowballPlan = {
  strategy: PayoffStrategy;
  order: SnowballStep[];
  target: SnowballStep | null;
  extraApplied: number;
  monthlyEmi: number;
  totalOutstanding: number;
  /** Months to clear every active loan with the extra payment applied. */
  monthsToDebtFree: number;
  debtFreeDate: Date | null;
  /** Months to clear every active loan with minimum EMIs only. */
  baselineMonths: number;
  baselineDate: Date | null;
  monthsSaved: number;
  /** % of the original borrowed amount already repaid across active loans. */
  progressPct: number;
};

const MAX_MONTHS = 600;

function addMonths(months: number): Date | null {
  if (!Number.isFinite(months) || months <= 0) return null;
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + Math.ceil(months), 1);
}

type Sim = { id: string; balance: number; emi: number; rate: number; closedAt: number | null };

function sorter(strategy: PayoffStrategy) {
  return (a: { balance: number; rate: number }, b: { balance: number; rate: number }) =>
    strategy === "avalanche" ? b.rate - a.rate || a.balance - b.balance : a.balance - b.balance;
}

function simulate(loans: Loan[], extra: number, strategy: PayoffStrategy) {
  const sim: Sim[] = loans
    .map((l) => ({
      id: l.id,
      balance: Number(l.remaining_balance) || 0,
      emi: Math.max(0, Number(l.emi_amount) || 0),
      rate: Math.max(0, Number(l.interest_rate) || 0),
      closedAt: null as number | null,
    }))
    .sort(sorter(strategy));

  let month = 0;
  let stalled = false;

  while (sim.some((s) => s.balance > 0) && month < MAX_MONTHS) {
    month += 1;
    // Freed-up EMIs from closed loans roll into the snowball.
    let pool = extra + sim.filter((s) => s.balance <= 0).reduce((a, s) => a + s.emi, 0);
    let anyPaid = false;

    for (const s of sim) {
      if (s.balance <= 0) continue;
      const interest = (s.balance * s.rate) / 1200;
      s.balance += interest;
      let pay = s.emi;
      if (pool > 0) {
        // Target = first (smallest) still-open loan in snowball order.
        const isTarget = sim.find((x) => x.balance > 0)?.id === s.id;
        if (isTarget) {
          pay += pool;
          pool = 0;
        }
      }
      if (pay > 0) anyPaid = true;
      s.balance = Math.max(0, s.balance - pay);
      if (s.balance <= 0 && s.closedAt === null) s.closedAt = month;
    }

    if (!anyPaid) {
      stalled = true;
      break;
    }
  }

  return { sim, months: stalled ? 0 : month };
}

export function buildSnowballPlan(
  allLoans: Loan[],
  extra = 0,
  strategy: PayoffStrategy = "snowball",
): SnowballPlan {
  const active = allLoans.filter((l) => Number(l.remaining_balance) > 0);
  const extraApplied = Math.max(0, Number(extra) || 0);
  const monthlyEmi = active.reduce((s, l) => s + (Number(l.emi_amount) || 0), 0);
  const totalOutstanding = active.reduce((s, l) => s + (Number(l.remaining_balance) || 0), 0);
  const borrowed = active.reduce((s, l) => s + (Number(l.total_amount) || 0), 0);

  const withExtra = simulate(active, extraApplied, strategy);
  const baseline = extraApplied > 0 ? simulate(active, 0, strategy) : withExtra;

  const ordered = [...active]
    .map((l) => ({
      loan: l,
      balance: Number(l.remaining_balance) || 0,
      rate: Number(l.interest_rate) || 0,
    }))
    .sort(sorter(strategy))
    .map((x) => x.loan);

  const order: SnowballStep[] = ordered.map((l) => {
    const s = withExtra.sim.find((x) => x.id === l.id);
    const monthsToClose = s?.closedAt ?? 0;
    return {
      id: l.id,
      name: l.loan_name,
      balance: Number(l.remaining_balance) || 0,
      emi: Number(l.emi_amount) || 0,
      rate: Number(l.interest_rate) || 0,
      monthsToClose,
      payoffDate: addMonths(monthsToClose),
    };
  });

  return {
    strategy,
    order,
    target: order[0] ?? null,
    extraApplied,
    monthlyEmi,
    totalOutstanding,
    monthsToDebtFree: withExtra.months,
    debtFreeDate: addMonths(withExtra.months),
    baselineMonths: baseline.months,
    baselineDate: addMonths(baseline.months),
    monthsSaved: Math.max(0, baseline.months - withExtra.months),
    progressPct: borrowed > 0 ? Math.min(100, ((borrowed - totalOutstanding) / borrowed) * 100) : 0,
  };
}
