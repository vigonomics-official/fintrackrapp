import { describe, expect, it } from "bun:test";
import { budgetRow, spentByCategory, suggestBudget, shiftMonth, matchStandard, isNonSpendingCategory } from "./budget";

const cats = [
  { id: "food", name: "Food", type: "expense" },
  { id: "rent", name: "Rent", type: "expense" },
  { id: "sip", name: "Mutual fund SIP", type: "expense" },
];

describe("budget rules", () => {
  it("remaining = limit - spent and percentage = spent / limit × 100", () => {
    expect(budgetRow(5000, 2000)).toMatchObject({ remaining: 3000, pct: 40, over: false });
  });
  it("shows overspending as a negative remaining", () => {
    expect(budgetRow(1000, 1500)).toMatchObject({ remaining: -500, pct: 150, over: true });
  });
  it("zero budget has no percentage and any spend is over", () => {
    expect(budgetRow(0, 0)).toMatchObject({ pct: null, over: false });
    expect(budgetRow(0, 10).over).toBe(true);
  });
  it("counts only expenses in the selected month, never transfers", () => {
    const m = spentByCategory([
      { type: "expense", amount: 100, category_id: "food", transaction_date: "2026-10-05" },
      { type: "transfer", amount: 900, category_id: "food", transaction_date: "2026-10-05" },
      { type: "income", amount: 50, category_id: "food", transaction_date: "2026-10-05" },
      { type: "expense", amount: 70, category_id: "food", transaction_date: "2026-09-30" },
    ], "2026-10-01");
    expect(m.get("food")).toBe(100);
  });
  it("month shifting crosses years", () => {
    expect(shiftMonth("2026-01-01", -1)).toBe("2025-12-01");
  });
  it("suggests from real history averages and skips investment categories", () => {
    const r = suggestBudget([
      { type: "expense", amount: 3000, category_id: "food", transaction_date: "2026-09-10" },
      { type: "expense", amount: 5000, category_id: "food", transaction_date: "2026-08-10" },
      { type: "expense", amount: 2000, category_id: "sip", transaction_date: "2026-09-10" },
    ], cats, "2026-10-01", 50000);
    expect(r.hasHistory).toBe(true);
    expect(r.items).toEqual([{ categoryId: "food", name: "Food", amount: 4000, basis: "history" }]);
  });
  it("without history, starter suggestions use income and map to existing categories", () => {
    const r = suggestBudget([], cats, "2026-10-01", 40000);
    expect(r.hasHistory).toBe(false);
    expect(r.items.find((i) => i.categoryId === "rent")?.amount).toBe(10000);
  });
  it("no history and no income gives no invented suggestions", () => {
    expect(suggestBudget([], cats, "2026-10-01", null).items).toEqual([]);
  });
  it("standard names match aliases; card repayments are non-spending", () => {
    expect(matchStandard(cats, "Housing & Rent")?.id).toBe("rent");
    expect(isNonSpendingCategory("Credit card bill")).toBe(true);
    expect(isNonSpendingCategory("Groceries")).toBe(false);
  });
});