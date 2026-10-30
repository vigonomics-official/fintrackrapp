// Pure budget helpers shared by the Budgets page and its tests.
export type BudgetTx = { type: string; amount: number; category_id: string | null; transaction_date: string };
export type BudgetCat = { id: string; name: string; type: string };

export const STANDARD_BUDGET_CATEGORIES: { name: string; aliases: string[]; starterPct: number }[] = [
  { name: "Housing & Rent", aliases: ["rent", "room rent", "housing", "house rent"], starterPct: 25 },
  { name: "Food & Dining", aliases: ["food", "dining", "restaurant"], starterPct: 8 },
  { name: "Groceries", aliases: ["grocery"], starterPct: 8 },
  { name: "Transport", aliases: ["fuel", "commute"], starterPct: 5 },
  { name: "Healthcare", aliases: ["health", "medical"], starterPct: 3 },
  { name: "Education", aliases: [], starterPct: 0 },
  { name: "Insurance", aliases: [], starterPct: 3 },
  { name: "EMI & Loans", aliases: ["emi", "loan", "loans"], starterPct: 0 },
  { name: "Entertainment", aliases: [], starterPct: 3 },
  { name: "Utilities", aliases: ["bills & utilities", "bills", "electricity"], starterPct: 4 },
  { name: "Shopping", aliases: [], starterPct: 4 },
  { name: "Travel", aliases: [], starterPct: 2 },
  { name: "Subscriptions", aliases: [], starterPct: 1 },
  { name: "Personal Care", aliases: [], starterPct: 2 },
  { name: "Other Expenses", aliases: ["other", "misc", "miscellaneous"], starterPct: 2 },
];

const norm = (s: string) => s.trim().toLowerCase();

/** Investment allocations and card repayments move money rather than spend it; never budget them. */
export function isNonSpendingCategory(name: string): boolean {
  return /\b(sip|mutual fund|investment|invest|savings|deposit|fd|rd|credit card (bills?|repayments?|payments?)|card repayments?|transfers?)\b/i.test(name);
}

/** Find the user's existing category for a standard name (exact name or known alias). */
export function matchStandard(cats: BudgetCat[], standardName: string): BudgetCat | undefined {
  const std = STANDARD_BUDGET_CATEGORIES.find((s) => s.name === standardName);
  const names = [norm(standardName), ...(std?.aliases ?? []).map(norm)];
  const exp = cats.filter((c) => c.type === "expense");
  for (const n of names) {
    const hit = exp.find((c) => norm(c.name) === n);
    if (hit) return hit;
  }
  return undefined;
}

/** month = "YYYY-MM-01". Only expense transactions count; transfers are excluded by type. */
export function spentByCategory(txs: BudgetTx[], month: string): Map<string, number> {
  const prefix = month.slice(0, 7);
  const out = new Map<string, number>();
  for (const t of txs) {
    if (t.type !== "expense" || !t.category_id) continue;
    if (!t.transaction_date.startsWith(prefix)) continue;
    const amt = Number(t.amount);
    if (!Number.isFinite(amt) || amt <= 0) continue;
    out.set(t.category_id, (out.get(t.category_id) ?? 0) + amt);
  }
  return out;
}

export function budgetRow(limit: number, spent: number) {
  const remaining = limit - spent;
  const pct = limit > 0 ? (spent / limit) * 100 : null;
  const over = spent > limit;
  return { limit, spent, remaining, pct, over };
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

export type Suggestion = { categoryId: string | null; name: string; amount: number; basis: "history" | "starter" };

/**
 * History basis: average of the previous 3 months that actually have spending in that category.
 * Starter basis (only when there is no spending history at all and income is known): percentage of income.
 */
export function suggestBudget(
  txs: BudgetTx[], cats: BudgetCat[], month: string, income: number | null,
): { items: Suggestion[]; hasHistory: boolean } {
  const totals = new Map<string, { sum: number; months: number }>();
  for (let i = 1; i <= 3; i++) {
    for (const [cid, amt] of spentByCategory(txs, shiftMonth(month, -i))) {
      const t = totals.get(cid) ?? { sum: 0, months: 0 };
      t.sum += amt; t.months += 1; totals.set(cid, t);
    }
  }
  const items: Suggestion[] = [];
  let eligibleHistory = false;
  for (const [cid, t] of totals) {
    const c = cats.find((x) => x.id === cid);
    if (!c || c.type !== "expense" || isNonSpendingCategory(c.name)) continue;
    eligibleHistory = true;
    const amount = Math.round(t.sum / t.months / 100) * 100;
    if (amount > 0) items.push({ categoryId: cid, name: c.name, amount, basis: "history" });
  }
  if (eligibleHistory) return { items: items.sort((a, b) => b.amount - a.amount), hasHistory: true };
  if (!income || income <= 0) return { items: [], hasHistory: false };
  for (const s of STANDARD_BUDGET_CATEGORIES) {
    if (s.starterPct <= 0) continue;
    const existing = matchStandard(cats, s.name);
    if (existing && isNonSpendingCategory(existing.name)) continue;
    items.push({
      categoryId: existing?.id ?? null, name: existing?.name ?? s.name,
      amount: Math.round((income * s.starterPct) / 100 / 100) * 100, basis: "starter",
    });
  }
  return { items, hasHistory: false };
}