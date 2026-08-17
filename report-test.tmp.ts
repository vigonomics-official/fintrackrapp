import { buildReportSnapshot } from "@/lib/report-snapshot";
import { buildDeterministicReport } from "@/lib/report-engine";

const now = new Date(2026, 0, 20); // Jan 20 2026
const settings: any = { salaryAmount: 60000, salaryDay: 1, enabled: true, payFrequency: "monthly" };
const cats = [
  { id: "c1", name: "Transport", type: "expense" },
  { id: "c2", name: "Food & Dining", type: "expense" },
  { id: "c3", name: "Shopping", type: "expense" },
] as any[];
const tx = (id: string, amount: number, day: number, cat: string | null, type = "expense") =>
  ({ id, user_id: "u", type, amount, category_id: cat, subcategory: null, payment_method: "upi", notes: null, tags: [], transaction_date: `2026-01-${String(day).padStart(2, "0")}`, created_at: "" }) as any;

const run = (name: string, input: any) => {
  const snap = buildReportSnapshot({ categories: cats, budgets: [], loans: [], salarySettings: settings, goals: [], savedSoFar: null, period: "monthly", now, ...input });
  const rep = buildDeterministicReport(snap);
  console.log(`\n=== ${name}`);
  if (!rep.available) { console.log("  UNAVAILABLE:", rep.message, "| missing:", rep.missing.join(",")); return { snap, rep }; }
  console.log("  codes:", rep.insights.map(i => `${i.code}(${i.severity})`).join(", "));
  console.log("  conf:", rep.confidence, "| savingsRate:", snap.savingsRate, "| spent:", snap.totalSpent, "| forecast:", snap.forecastBalance);
  console.log("  recs:", rep.recommendations.map(r => r.from).join(", "));
  return { snap, rep };
};

const base = [tx("1", 12000, 3, "c1"), tx("2", 4000, 5, "c2"), tx("3", 2000, 8, "c3"), tx("4", 1500, 12, "c2"), tx("5", 1000, 15, "c1"), tx("6", 60000, 1, null, "income")];

run("1 healthy profile", { transactions: [tx("a", 2000, 3, "c2"), tx("b", 1500, 6, "c3"), tx("c", 1200, 9, "c1"), tx("d", 900, 14, "c2"), tx("e", 60000, 1, null, "income")] });
run("2 high transport", { transactions: base });
run("3 budget near limit", { transactions: base, budgets: [{ id: "b1", user_id: "u", category_id: "c1", monthly_limit: 15000, month: "2026-01-01" }] as any });
run("4 budget exceeded", { transactions: base, budgets: [{ id: "b1", user_id: "u", category_id: "c1", monthly_limit: 8000, month: "2026-01-01" }] as any });
run("5 negative forecast", { transactions: [...base, tx("7", 40000, 18, "c3")] });
run("6 low emergency fund", { transactions: base, savedSoFar: 5000 });
run("7 high EMI", { transactions: base, loans: [{ id: "l1", user_id: "u", loan_name: "Home", loan_type: "home", total_amount: 500000, interest_rate: 8, emi_amount: 30000, tenure_months: 60, remaining_balance: 400000, start_date: "2024-01-01", due_day: 5, notes: null, created_at: "", updated_at: "" }] as any });
run("8 strong savings", { transactions: [tx("a", 1500, 4, "c2"), tx("b", 900, 7, "c3"), tx("c", 600, 11, "c1"), tx("d", 60000, 1, null, "income")] });
const withPrev = [...base, tx("p1", 500, 2, "c2")];
run("9 spending increased (weekly)", { transactions: [...base, tx("w1", 3000, 19, "c3"), tx("w2", 2500, 20, "c3"), tx("w3", 300, 10, "c2")], period: "weekly" });
run("10 spending decreased (weekly)", { transactions: [tx("x1", 200, 18, "c2"), tx("x2", 150, 19, "c2"), tx("x3", 120, 20, "c2"), tx("y1", 4000, 12, "c3"), tx("y2", 3000, 13, "c3"), tx("y3", 2000, 14, "c3")], period: "weekly" });
run("11 missing salary", { transactions: base.filter(t => t.type === "expense"), salarySettings: { salaryAmount: 0, salaryDay: 1, enabled: false, payFrequency: "monthly" } });
run("12 missing spending history", { transactions: [tx("i", 60000, 1, null, "income")] });
run("13 empty profile", { transactions: [] });
run("14 goals + all signals", { transactions: base, goals: [{ name: "Bike", target: 100000, current: 20000, progress: 20 }] });
