// Upcoming obligations that must be reserved before Safe Daily Spend.
// Only counts bills / EMIs that are unpaid, fall due inside the current
// salary cycle (today → before next salary), and are not already recorded
// as an expense or loan payment this cycle — so nothing is counted twice.

type Tx = { type: string; amount: number | string; transaction_date: string; notes?: string | null; subcategory?: string | null; category_id?: string | null };
type BillLike = { id: string; name: string; amount: number; due_day: number };
type LoanLike = { id: string; loan_name: string; emi_amount: number | string; remaining_balance: number | string; due_day: number };
type PaymentLike = { loan_id: string; payment_date: string; payment_status: string };

export type ObligationItem = { label: string; amount: number; due: Date };
export type Obligations = {
  bills: number;
  emis: number;
  savings: number;
  plannedSavings: number;
  alreadySaved: number;
  billItems: ObligationItem[];
  emiItems: ObligationItem[];
};

const key = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function dueInMonth(y: number, m: number, day: number) {
  const last = new Date(y, m + 1, 0).getDate();
  return new Date(y, m, Math.min(Math.max(1, day || 1), last));
}

/**
 * Due date inside the current cycle (cycleStart → before next salary), or null.
 * A due date already passed this cycle is still returned: bills have no paid
 * flag, so a bill only counts as paid when a matching expense/payment exists.
 */
function dueThisCycle(day: number, cycleStart: Date, nextSalary: Date): Date | null {
  let d = dueInMonth(cycleStart.getFullYear(), cycleStart.getMonth(), day);
  if (d < cycleStart) d = dueInMonth(cycleStart.getFullYear(), cycleStart.getMonth() + 1, day);
  return d < nextSalary ? d : null;
}

type CatLike = { id: string; name: string; type: string };
export const emiCategoryIds = (cats: CatLike[]) =>
  cats.filter((c) => c.type === "expense" && /emi|loan/i.test(c.name)).map((c) => c.id);
export const savingsCategoryIds = (cats: CatLike[]) =>
  cats.filter((c) => c.type === "expense" && /saving|sip|deposit/i.test(c.name)).map((c) => c.id);

export function computeObligations(opts: {
  transactions: Tx[];
  bills: BillLike[];
  loans: LoanLike[];
  loanPayments: PaymentLike[];
  emiCategoryIds?: string[];
  savingsCategoryIds?: string[];
  cycleStart: Date;
  nextSalary: Date;
  salary: number;
  savingsPct: number | null;
  now?: Date;
}): Obligations {
  const now = opts.now ?? new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const cycleStartDay = new Date(opts.cycleStart.getFullYear(), opts.cycleStart.getMonth(), opts.cycleStart.getDate());
  const startKey = key(opts.cycleStart);
  const todayKey = key(today);
  const cycleExpenses = opts.transactions.filter((t) => {
    const k = String(t.transaction_date).slice(0, 10);
    return t.type === "expense" && k >= startKey && k <= todayKey;
  });
  const text = (t: Tx) => `${t.notes ?? ""} ${t.subcategory ?? ""}`.toLowerCase();
  const recorded = (name: string) => {
    const n = name.trim().toLowerCase();
    return n.length > 0 && cycleExpenses.some((t) => text(t).includes(n));
  };

  const billItems: ObligationItem[] = [];
  for (const b of opts.bills) {
    const amt = Number(b.amount);
    if (!(amt > 0)) continue;
    const due = dueThisCycle(Number(b.due_day), cycleStartDay, opts.nextSalary);
    if (!due || recorded(b.name)) continue;
    billItems.push({ label: b.name, amount: amt, due });
  }

  const emiCats = new Set(opts.emiCategoryIds ?? []);
  const usedEmiTx = new Set<Tx>();
  const emiItems: ObligationItem[] = [];
  for (const l of opts.loans) {
    const emi = Number(l.emi_amount);
    if (!(Number(l.remaining_balance) > 0) || !(emi > 0)) continue;
    const due = dueThisCycle(Number(l.due_day), cycleStartDay, opts.nextSalary);
    if (!due) continue;
    const paidViaPayment = opts.loanPayments.some((p) => {
      const k = String(p.payment_date).slice(0, 10);
      return p.loan_id === l.id && p.payment_status === "paid" && k >= startKey && k <= todayKey;
    });
    if (paidViaPayment || recorded(l.loan_name)) continue;
    // An EMI-category expense of roughly this EMI amount counts as paid.
    const match = cycleExpenses.find(
      (t) => !usedEmiTx.has(t) && t.category_id && emiCats.has(t.category_id) &&
        Math.abs(Number(t.amount) - emi) <= Math.max(1, emi * 0.05),
    );
    if (match) { usedEmiTx.add(match); continue; }
    emiItems.push({ label: l.loan_name, amount: emi, due });
  }

  // Planned savings minus savings already recorded this cycle (those
  // expenses already reduce Salary Left, so don't reserve them twice).
  const planned =
    opts.savingsPct != null && opts.savingsPct > 0 && opts.salary > 0
      ? Math.round((opts.salary * opts.savingsPct) / 100)
      : 0;
  const saveCats = new Set(opts.savingsCategoryIds ?? []);
  const alreadySaved = cycleExpenses
    .filter((t) => t.category_id && saveCats.has(t.category_id))
    .reduce((s, t) => s + Number(t.amount), 0);
  const savings = Math.max(0, planned - alreadySaved);

  return {
    bills: billItems.reduce((s, i) => s + i.amount, 0),
    emis: emiItems.reduce((s, i) => s + i.amount, 0),
    savings,
    plannedSavings: planned,
    alreadySaved,
    billItems,
    emiItems,
  };
}
