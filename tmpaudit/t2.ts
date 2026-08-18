import { computeSurvival } from "@/lib/survival";
import { checkPurchaseAffordability } from "@/lib/purchase-affordability";
import { checkNarration, buildExplainPayload } from "@/lib/purchase-explain";
import { buildReportSnapshot } from "@/lib/report-snapshot";
import { buildDeterministicReport } from "@/lib/report-engine";
import { checkReportNarration, buildReportPayload } from "@/lib/report-explain";

const today = new Date();
const d = (o:number)=> new Date(today.getTime()-o*86400000).toISOString().slice(0,10);
const txs = Array.from({length: 20}, (_,i)=>({id:String(i),type:"expense",amount:400,transaction_date:d(i%16),category_id:"c1"}));
const sal = { amount: 30000, payDay: 1, employmentType: "salaried" } as any;
const loans = [{ id:"l1", monthly_emi: 6000, outstanding_amount: 100000, name:"Bike" }] as any;
const before = computeSurvival({ transactions: txs, loans, salarySettings: sal } as any);
console.log("survival:", JSON.stringify({score:before.score,salary:before.salary,left:Math.round(before.salaryLeft),safe:Math.round(before.safeDaily),fc:before.forecastBalance,emi:before.emiRatio}));
for (const p of [500,2000,10000,20000]) {
  const after = computeSurvival({ transactions: txs, loans, salarySettings: sal, extraSpend: p } as any);
  const r = checkPurchaseAffordability({itemName:"item",price:p,before,after,currency:"INR",savings:null,emergencyTarget:null,budgetRemaining:null,category:null} as any);
  console.log(p, "=>", r.decision, r.confidence, r.signalCodes.join(","));
  const pl = buildExplainPayload(r);
  console.log("   guard fabricated:", checkNarration("You can afford this; your subscriptions cost 1234 and savings are 99999.", r));
  console.log("   guard clean:", checkNarration(r.why + " " + r.suggestion, r));
}
const snap = buildReportSnapshot({transactions:txs,categories:[{id:"c1",name:"Food"}],budgets:[{category_id:"c1",monthly_limit:5000}],loans,salarySettings:sal,goals:[],currency:"INR",period:"monthly"} as any);
const rep = buildDeterministicReport(snap);
const rp = buildReportPayload(rep, snap);
console.log("report ok:", rep.available, rep.confidence, rep.insights.map(i=>i.code+":"+i.severity).join(" | "));
console.log("metrics:", JSON.stringify({salary:snap.salary,spent:snap.totalSpent,savingsRate:snap.savingsRate,budgetUtil:(snap as any).budgetUtilization,emi:snap.monthlyEmi,fc:snap.forecastBalance,score:snap.score}));
console.log("parity score:", snap.score===before.score, "salary:", snap.salary===before.salary, "fc:", snap.forecastBalance===before.forecastBalance);
console.log("guard fabricated report:", checkReportNarration("Your subscriptions cost 7777 and your investments dropped.", rp));
console.log("guard clean report:", checkReportNarration(rep.insights.map(i=>i.fact).join(" "), rp));
