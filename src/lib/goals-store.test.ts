import { beforeEach, describe, expect, mock, test } from "bun:test";

const storage = new Map<string, string>();
const client = { auth: { getSession: async () => ({ data: { session: null } }) } };
mock.module("@/integrations/supabase/client", () => ({ supabase: client }));
Object.assign(globalThis, {
  window: { dispatchEvent: () => true },
  localStorage: {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  },
});
const { activateGoalAccount, loadGoals, saveGoals, GOALS_KEY } = await import("./goals-store");
const { computeFutureActions } = await import("./future-insights");
const { computeFinancialMetrics } = await import("./financial-metrics");
const goal = { id: "test-goal", name: "Test Emergency", kind: "emergency" as const, target: 60000, current: 29000, monthly: 0, createdAt: "2026-10-17" };

beforeEach(() => { activateGoalAccount(null); storage.clear(); });

describe("account goal cache", () => {
  test("B cannot see A's saved goal, and A's amount is preserved", () => {
    activateGoalAccount("A"); saveGoals([goal]);
    activateGoalAccount("B"); expect(loadGoals()).toEqual([]);
    activateGoalAccount("A"); expect(loadGoals()[0]?.current).toBe(29000);
  });
  test("signed out cannot read active goals", () => {
    activateGoalAccount("A"); saveGoals([goal]); activateGoalAccount(null);
    expect(loadGoals()).toEqual([]); expect(storage.has(GOALS_KEY)).toBe(false);
  });
  test("unowned legacy data is preserved but not assigned to B", () => {
    storage.set(GOALS_KEY, JSON.stringify([goal])); activateGoalAccount("B");
    expect(loadGoals()).toEqual([]);
    expect(JSON.parse(storage.get(`${GOALS_KEY}:account:unassigned`) ?? "[]")[0].current).toBe(29000);
  });
});

describe("shared Emergency Fund threshold", () => {
  function actions(saved: number) {
    const survival = { salary: 20800, salaryLeft: 18000, hasIncome: true, monthlyEmi: 0, emiRatio: 0, score: 80, cycleDaysElapsed: 1, daysUnderBudget: 1 };
    const metrics = computeFinancialMetrics({
      survival: survival as Parameters<typeof computeFinancialMetrics>[0]["survival"],
      obligations: { alreadySaved: 5824, plannedSavings: 5824 } as Parameters<typeof computeFinancialMetrics>[0]["obligations"],
      transactions: [], loans: [], goals: [{ ...goal, current: saved }], savingsCategoryIds: [], savingsPct: 28,
      rememberedSavings: 0, essentialMonthly: 10000,
      prefs: { emergencyFundMode: "6m", scoreWeights: { emergency: true, savings: true, debt: true, discipline: true } } as Parameters<typeof computeFinancialMetrics>[0]["prefs"],
    });
    return { metrics, list: computeFutureActions({ survival: survival as Parameters<typeof computeFutureActions>[0]["survival"], transactions: [], loans: [], goals: [{ ...goal, current: saved }], metrics }) };
  }
  test("SIP hidden below 3 months", () => { expect(actions(29999).list.some(a => a.id === "sip")).toBe(false); });
  test("SIP available at exactly 3 months", () => { expect(actions(30000).list.some(a => a.id === "sip")).toBe(true); });
  test("SIP available above 3 months", () => { expect(actions(31000).list.some(a => a.id === "sip")).toBe(true); });
  test("six-month target and Allocate advice use shared concrete values", () => {
    const { metrics, list } = actions(30000);
    expect(metrics.emergency.saved).toBe(30000); expect(metrics.emergency.recommendedTarget).toBe(60000);
    expect(metrics.emergency.monthsCovered).toBe(3); expect(metrics.savings.target).toBe(5824);
    expect(list.find(a => a.id === "emergency")?.impactAmount).toBe(5824);
  });
});