import { buildReportSnapshot } from "@/lib/report-snapshot";
import { buildDeterministicReport } from "@/lib/report-engine";
import { buildReportPayload, checkReportNarration, deterministicNarration, explainReport } from "@/lib/report-explain";

const now = new Date(2026, 7, 18);
const d = (day: number) => `2026-08-${String(day).padStart(2, "0")}`;
let id = 0;
const tx = (amount: number, category_id: string | null, day: number, type: "expense" | "income" = "expense") =>
  ({ id: `t${++id}`, amount, category_id, transaction_date: d(day), type, note: "x" }) as any;

const cats = [
  { id: "c-food", name: "Food & Dining", color: "#f00" },
  { id: "c-tr", name: "Transport", color: "#0f0" },
  { id: "c-sh", name: "Shopping", color: "#00f" },
] as any[];

const salarySettings = (salary: number) => ({ amount: salary > 0 ? salary : null, payDay: 1, employmentType: "salaried" }) as any;

function run(name: string, input: any) {
  const snap = buildReportSnapshot({ now, savedSoFar: null, goals: [], budgets: [], loans: [], categories: cats, salarySettings: salarySettings(0), transactions: [], period: "monthly", ...input });
  const rep = buildDeterministicReport(snap);
  console.log("\n=== " + name);
  if (!rep.available) { console.log("UNAVAILABLE:", rep.message, "| missing:", rep.missing.join(",")); return { snap, rep }; }
  console.log("codes:", rep.insights.map(i => `${i.code}/${i.severity}`).join(", "));
  console.log("conf:", rep.confidence, "| savingsRate:", snap.savingsRate, "| spent:", snap.totalSpent, "| salary:", snap.salary, "| score:", snap.score, "| forecast:", snap.forecastBalance, "| safeDaily:", snap.safeDaily, "| emi:", snap.monthlyEmi, "| ef:", snap.emergencyFund, "/", snap.emergencyFundTarget);
  console.log("recs:", rep.recommendations.length, "| sections:", rep.sections.map(s=>s.id).join(","));
  return { snap, rep };
}

// 1 healthy
run("1 healthy profile", { salarySettings: salarySettings(60000), transactions: [tx(3000,"c-food",2),tx(2000,"c-tr",3),tx(4000,"c-sh",5),tx(1000,"c-food",8),tx(1500,"c-tr",10)] });
// 2 high transport
run("2 high transport", { salarySettings: salarySettings(50000), transactions: [tx(9000,"c-tr",2),tx(2000,"c-food",3),tx(1000,"c-sh",5),tx(500,"c-food",6)] });
// 3 budget near limit
run("3 budget near limit", { salarySettings: salarySettings(50000), budgets: [{id:"b1",category_id:"c-food",monthly_limit:5000,month:"2026-08"} as any], transactions:[tx(4200,"c-food",2),tx(300,"c-tr",3),tx(400,"c-sh",4)] });
// 4 budget exceeded
run("4 budget exceeded", { salarySettings: salarySettings(50000), budgets: [{id:"b1",category_id:"c-food",monthly_limit:2000,month:"2026-08"} as any], transactions:[tx(4200,"c-food",2),tx(300,"c-tr",3),tx(400,"c-sh",4)] });
// 5 negative forecast
run("5 negative forecast", { salarySettings: salarySettings(20000), transactions:[tx(9000,"c-food",2),tx(8000,"c-sh",3),tx(2000,"c-tr",4),tx(500,"c-food",5)] });
// 6 low emergency fund
run("6 low emergency fund", { salarySettings: salarySettings(50000), savedSoFar: 5000, transactions:[tx(3000,"c-food",2),tx(1000,"c-tr",3),tx(800,"c-sh",4)] });
// 7 high EMI
run("7 high EMI", { salarySettings: salarySettings(40000), loans:[{id:"l1",name:"Car",emi_amount:20000,remaining_balance:300000} as any], transactions:[tx(3000,"c-food",2),tx(1000,"c-tr",3),tx(800,"c-sh",4)] });
// 8 strong savings
run("8 strong savings", { salarySettings: salarySettings(80000), transactions:[tx(1000,"c-food",2),tx(500,"c-tr",3),tx(700,"c-sh",4)] });
// 9/10 trend
const prev = [tx(2000,"c-food",-0)];
run("9 spending increased", { salarySettings: salarySettings(50000), transactions:[
  {id:"p1",amount:1000,category_id:"c-food",transaction_date:"2026-07-20",type:"expense"} as any,
  {id:"p2",amount:1000,category_id:"c-tr",transaction_date:"2026-07-25",type:"expense"} as any,
  tx(6000,"c-food",2),tx(2000,"c-tr",3),tx(1000,"c-sh",4)] });
run("10 spending decreased(weekly)", { period:"weekly", salarySettings: salarySettings(50000), transactions:[
  tx(3000,"c-food",6),tx(3000,"c-tr",7),tx(2000,"c-sh",8),
  tx(200,"c-food",14),tx(150,"c-tr",15),tx(100,"c-sh",16)] });
// 11 missing salary
run("11 missing salary", { salarySettings: salarySettings(0), transactions:[tx(3000,"c-food",2),tx(1000,"c-tr",3),tx(800,"c-sh",4)] });
// 12 salary, no transactions
run("12 salary no txs", { salarySettings: salarySettings(50000), transactions: [] });
// 13 empty
run("13 empty profile", {});
// 14 goals
const g = run("14 with goals", { salarySettings: salarySettings(50000), goals:[{name:"Laptop",target:60000,current:12000,progress:20}], transactions:[tx(3000,"c-food",2),tx(1000,"c-tr",3),tx(800,"c-sh",4)] });

// determinism
const a = JSON.stringify(run("15 determinism A", { salarySettings: salarySettings(50000), transactions:[tx(3000,"c-food",2),tx(1000,"c-tr",3),tx(800,"c-sh",4)] }).rep);
const b = JSON.stringify(run("15 determinism B", { salarySettings: salarySettings(50000), transactions:[tx(3000,"c-food",2),tx(1000,"c-tr",3),tx(800,"c-sh",4)] }).rep);
console.log("\nDETERMINISM identical:", a === b);

// guardrails
const { snap, rep } = g as any;
if (rep.available) {
  const payload = buildReportPayload(rep, snap);
  console.log("payload keys:", Object.keys(payload), "| values:", JSON.stringify(payload.values).slice(0,300));
  const tests: [string, boolean][] = [
    ["invented amount", checkReportNarration("You will save ₹18,432 next month.", payload)],
    ["invented subscriptions", checkReportNarration("Cancel your subscriptions.", payload)],
    ["invented investments", checkReportNarration("Your investments are down.", payload)],
    ["valid restatement", checkReportNarration(payload.insights[0]?.fact ?? "ok", payload)],
  ];
  tests.forEach(([n, r]) => console.log(`guardrail ${n}: ${r ? "ACCEPTED" : "REJECTED"}`));
}
