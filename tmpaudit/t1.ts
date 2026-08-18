import { computeSurvival } from "@/lib/survival";
import { checkPurchaseAffordability, validatePurchaseInput } from "@/lib/purchase-affordability";
import { buildReportSnapshot } from "@/lib/report-snapshot";
import { buildDeterministicReport } from "@/lib/report-engine";

const empty = { transactions: [] as any[], loans: [] as any[], salarySettings: {} as any };
const zero = computeSurvival(empty as any);
console.log("ZERO survival:", JSON.stringify({score: zero.score, salary: zero.salary, salaryLeft: zero.salaryLeft, days: zero.days, safeDaily: (zero as any).safeDailySpend, forecast: (zero as any).forecast}));

for (const p of [500, 2000, 10000, 20000]) {
  const before = zero, after = computeSurvival({ ...empty, extraSpend: p } as any);
  const r = checkPurchaseAffordability({ itemName: "thing", price: p, before, after, currency: "INR", savings: null, emergencyTarget: null, budgetRemaining: null, category: null } as any);
  console.log("ZERO-DATA buy", p, "=>", r.decision, "|", r.why.slice(0,90));
}
for (const bad of ["0","-5","abc",""]) console.log("validate", JSON.stringify(bad), JSON.stringify(validatePurchaseInput("x", bad)));

const snapEmpty = buildReportSnapshot({ transactions: [], categories: [], budgets: [], loans: [], salarySettings: {} as any, goals: [], currency: "INR", period: "monthly" } as any);
const repEmpty = buildDeterministicReport(snapEmpty);
console.log("ZERO report:", repEmpty.available, repEmpty.message, repEmpty.missing);

// PARTIAL: salary but no spending
const sal = { payDay: 1, monthlySalary: 50000 } as any;
const s2 = computeSurvival({ transactions: [], loans: [], salarySettings: sal } as any);
console.log("salary-only survival:", s2.score, s2.salary, s2.salaryLeft, s2.days);
const snap2 = buildReportSnapshot({ transactions: [], categories: [], budgets: [], loans: [], salarySettings: sal, goals: [], currency: "INR", period: "monthly" } as any);
const r2 = buildDeterministicReport(snap2);
console.log("salary-only report:", r2.available, r2.message ?? "", r2.missing);

// spending but no salary
const today = new Date().toISOString().slice(0,10);
const txs = Array.from({length: 12}, (_,i) => ({ id: String(i), type: "expense", amount: 300, transaction_date: today, category_id: "c1" }));
const s3 = computeSurvival({ transactions: txs, loans: [], salarySettings: {} } as any);
console.log("spend-only survival:", s3.score, s3.salary, s3.salaryLeft);
const snap3 = buildReportSnapshot({ transactions: txs, categories: [{id:"c1",name:"Food"}], budgets: [], loans: [], salarySettings: {} as any, goals: [], currency: "INR", period: "monthly" } as any);
const r3 = buildDeterministicReport(snap3);
console.log("spend-only report:", r3.available, JSON.stringify(r3.missing), r3.insights?.map((i:any)=>i.code));
console.log("snap3 metrics:", JSON.stringify({savingsRate: snap3.savingsRate, salary: snap3.salary, forecast: (snap3 as any).forecast}));
