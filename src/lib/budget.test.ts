import { describe, expect, test } from "bun:test";
import { budgetIncome, budgetRow, spentByCategory, suggestBudget, shiftMonth, matchStandard, isNonSpendingCategory } from "./budget";

const cats = [
  { id: "food", name: "Food", type: "expense" },
  { id: "rent", name: "Rent", type: "expense" },
  { id: "sip", name: "Mutual fund SIP", type: "expense" },
];

describe("budget rules", () => {
  test("remaining = limit - spent and percentage = spent / limit × 100", () => {
    expect((({remaining,pct,over})=>({remaining,pct,over}))(budgetRow(5000, 2000))).toEqual({ remaining: 3000, pct: 40, over: false });
  });
  test("shows overspending as a negative remaining", () => {
    expect((({remaining,pct,over})=>({remaining,pct,over}))(budgetRow(1000, 1500))).toEqual({ remaining: -500, pct: 150, over: true });
  });
  test("zero budget has no percentage and any spend is over", () => {
    expect((({pct,over})=>({pct,over}))(budgetRow(0, 0))).toEqual({ pct: null, over: false });
    expect(budgetRow(0, 10).over).toBe(true);
  });
  test("counts only expenses in the selected month, never transfers", () => {
    const m = spentByCategory([
      { type: "expense", amount: 100, category_id: "food", transaction_date: "2026-10-05" },
      { type: "transfer", amount: 900, category_id: "food", transaction_date: "2026-10-05" },
      { type: "income", amount: 50, category_id: "food", transaction_date: "2026-10-05" },
      { type: "expense", amount: 70, category_id: "food", transaction_date: "2026-09-30" },
    ], "2026-10-01");
    expect(m.get("food")).toBe(100);
  });
  test("month shifting crosses years", () => {
    expect(shiftMonth("2026-01-01", -1)).toBe("2025-12-01");
  });
  test("suggests from real history averages and skips investment categories", () => {
    const r = suggestBudget([
      { type: "expense", amount: 3000, category_id: "food", transaction_date: "2026-09-10" },
      { type: "expense", amount: 5000, category_id: "food", transaction_date: "2026-08-10" },
      { type: "expense", amount: 2000, category_id: "sip", transaction_date: "2026-09-10" },
    ], cats, "2026-10-01", 50000);
    expect(r.hasHistory).toBe(true);
    expect(r.items).toEqual([{ categoryId: "food", name: "Food", amount: 4000, basis: "history" }]);
  });
  test("without history, starter suggestions use income and map to existing categories", () => {
    const r = suggestBudget([], cats, "2026-10-01", 40000);
    expect(r.hasHistory).toBe(false);
    expect(r.items.find((i) => i.categoryId === "rent")?.amount).toBe(10000);
  });
  test("no history and no income gives no invented suggestions", () => {
    expect(suggestBudget([], cats, "2026-10-01", null).items).toEqual([]);
  });
  test("standard names match aliases; card repayments are non-spending", () => {
    expect(matchStandard(cats, "Housing & Rent")?.id).toBe("rent");
    expect(isNonSpendingCategory("Credit card bill")).toBe(true);
    expect(isNonSpendingCategory("Groceries")).toBe(false);
  });
  test("excludes investment and repayment expenses but includes card purchases", () => {
    const categories = [...cats, { id: "card", name: "Credit card repayments", type: "expense" }];
    const txs = [
      { type: "expense", amount: 300, category_id: "food", transaction_date: "2026-10-01" },
      { type: "expense", amount: 600, category_id: "sip", transaction_date: "2026-10-01" },
      { type: "expense", amount: 900, category_id: "card", transaction_date: "2026-10-01" },
    ];
    expect([...spentByCategory(txs, "2026-10-01", categories)]).toEqual([["food", 300]]);
  });
  test("edited and deleted transactions recalculate without a stored spending total", () => {
    const tx = { type: "expense", amount: 100, category_id: "food", transaction_date: "2026-10-01" };
    expect(spentByCategory([{ ...tx, amount: 250 }], "2026-10-01").get("food")).toBe(250);
    expect(spentByCategory([], "2026-10-01").size).toBe(0);
  });
  test("tiny real spending does not become invented salary history", () => {
    const r = suggestBudget([{ type: "expense", amount: 5, category_id: "food", transaction_date: "2026-09-01" }], cats, "2026-10-01", 40000);
    expect(r.hasHistory).toBe(true);
    expect(r.items).toEqual([]);
  });
  test("suggestion income prefers actual monthly income and never counts transfers", () => {
    const txs = [
      { type: "income", amount: 30000, category_id: null, transaction_date: "2026-10-01" },
      { type: "transfer", amount: 80000, category_id: null, transaction_date: "2026-10-01" },
    ];
    expect(budgetIncome(txs, "2026-10-01", 50000)).toBe(30000);
    expect(budgetIncome([], "2026-10-01", null)).toBe(null);
  });
});