import { describe, expect, test } from "bun:test";
import { monthlyEssentialExpenses, computeFinancialMetrics } from "./financial-metrics";
import { computeSurvival } from "./survival";
import { checkPurchaseAffordability } from "./purchase-affordability";
import { computeFutureActions } from "./future-insights";
import { getSurvivalPreferences } from "./survival-preferences";

const now = new Date("2026-10-21T12:00:00Z");
const recent = [
  { type: "expense", amount: 20000, category_id: "rent", transaction_date: "2026-10-07" },
  { type: "expense", amount: 10000, category_id: "food", transaction_date: "2026-10-07" },
];
const essentialInputs = { transactions: recent, essentialCategoryIds: ["rent", "food"], loans: [{ remaining_balance: 100000, emi_amount: 10000 }], bills: [{ amount: 2000, recurring: true }], now };
const salarySettings = { amount: 60000, payDay: 1, employmentType: "salaried" as const };
const obligations = { bills: 2000, emis: 10000, savings: 5824, plannedSavings: 5824, alreadySaved: 0, billItems: [], emiItems: [] };
const prefs = getSurvivalPreferences();

describe("first-month essential expenses", () => {
  test("two-week rent and food are included alongside EMI and bills", () => {
    expect(monthlyEssentialExpenses(essentialInputs)).toBe(42000);
  });
  test("first-day essentials are not omitted or multiplied by thirty", () => {
    expect(monthlyEssentialExpenses({ ...essentialInputs, transactions: recent.map(t => ({ ...t, transaction_date: "2026-10-21" })) })).toBe(42000);
  });
  test("established-history averaging stays unchanged", () => {
    expect(monthlyEssentialExpenses({ ...essentialInputs, transactions: [{ ...recent[0], amount: 60000, transaction_date: "2026-08-22" }] })).toBe((60000 / 61) * 30 + 12000);
  });
  test("no transaction signal retains bill/EMI-only data; no data stays unknown", () => {
    expect(monthlyEssentialExpenses({ ...essentialInputs, transactions: [] })).toBe(12000);
    expect(monthlyEssentialExpenses({ ...essentialInputs, transactions: [], loans: [], bills: [] })).toBe(null);
  });
  test("partial-history savings cannot falsely achieve the target or unlock SIP", () => {
    const survival = computeSurvival({ transactions: recent, loans: essentialInputs.loans, salarySettings, obligations, now });
    const goals = [{ kind: "emergency" as const, current: 80000, id: "test", name: "Emergency", target: 252000, monthly: 0, createdAt: "2026-10-01" }];
    const metrics = computeFinancialMetrics({ survival, obligations, transactions: recent, loans: essentialInputs.loans, goals, savingsCategoryIds: [], savingsPct: 28, rememberedSavings: 0, prefs, essentialMonthly: monthlyEssentialExpenses(essentialInputs), now });
    expect(metrics.emergency.recommendedTarget).toBe(252000);
    expect(metrics.emergency.monthsCovered).toBe(80000 / 42000);
    expect(metrics.emergency.achieved).toBe(false);
    expect(metrics.score.components.emergency.value).toBe(8);
    expect(metrics.savings.target).toBe(5824);
    expect(computeFutureActions({ survival, transactions: recent, loans: [], goals, metrics }).some(a => a.id === "sip")).toBe(false);
  });
});

describe("purchase Financial Score", () => {
  const transactions = [{ type: "expense", amount: 100, transaction_date: "2026-10-21" }];
  function snapshot(price: number) {
    const survival = computeSurvival({ transactions, loans: [], salarySettings, obligations, now, extraSpend: price });
    const metrics = computeFinancialMetrics({ survival, obligations, transactions, loans: [], goals: [{ kind: "emergency", current: 29000 }], savingsCategoryIds: [], savingsPct: 28, rememberedSavings: 0, prefs, essentialMonthly: 10000, now });
    return { ...survival, score: metrics.score.total ?? 0 };
  }
  test("zero-price snapshot matches the shared score", () => { expect(snapshot(0).score).toBe(62); });
  test("hypothetical purchase lowers discipline on the same scale without changing transactions", () => {
    const before = snapshot(0), after = snapshot(5000);
    const result = checkPurchaseAffordability({ itemName: "Test purchase", price: 5000, before, after, currency: "INR", savings: 29000, emergencyTarget: 60000, budgetRemaining: null });
    expect(after.score).toBe(61);
    expect(result.values.survivalScore).toBe(before.score);
    expect(result.values.survivalScoreAfter).toBe(after.score);
    expect(transactions[0]?.amount).toBe(100);
  });
  test("unaffordable purchase cannot increase the score and safe daily becomes zero", () => {
    const before = snapshot(0), after = snapshot(100000);
    expect(after.score <= before.score).toBe(true);
    expect(after.safeDaily).toBe(0);
    expect(after.overLimit).toBe(true);
  });
});