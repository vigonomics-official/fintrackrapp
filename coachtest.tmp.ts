import { MockCoachProvider, buildContext } from "@/lib/coach-provider";
import { checkCoachReply } from "@/lib/coach-guardrails";
import { buildCoachSnapshot } from "@/lib/coach-prompt-builder";
import { analyzeMock } from "@/lib/ai-coach-analysis";

const input: any = {
  monthlySalary: 50000, monthlyRent: 12000, monthlyFood: 8000, monthlyTransport: 3000,
  monthlyEmi: 5000, monthlyBills: 2500, monthlyInvestments: 4000, otherMonthlyExpenses: 2000,
  currentAccountBalance: 21000, currentSavings: 60000, goal: "Emergency fund", salaryDay: 1,
};
const ctx = buildContext(input, "en");
const qs = ["How am I doing this month?","Where am I spending too much?","Can I buy something for ₹2,000?","Why is my Survival Score 88?","How much can I safely spend today?","What should I do before salary day?","How can I reach my emergency fund goal?"];
for (const q of qs) {
  const r = await MockCoachProvider.send(q, ctx);
  console.log("Q:", q, "\n ->", r.shortAnswer.slice(0,140), "| conf:", (r as any).confidence);
}
// empty-data case
const empty = buildContext({ monthlySalary:0,monthlyRent:0,monthlyFood:0,monthlyTransport:0,monthlyEmi:0,monthlyBills:0,monthlyInvestments:0,otherMonthlyExpenses:0,currentAccountBalance:0,currentSavings:0,goal:"" } as any, "en");
console.log("EMPTY ->", (await MockCoachProvider.send("Should I invest in stocks?", empty)).shortAnswer.slice(0,160));
// guardrails
const snap = buildCoachSnapshot(input, analyzeMock(input), "en");
const draft = { shortAnswer:"a", why:"b", action:"c" };
console.log("invent:", checkCoachReply({shortAnswer:"You will save ₹98765 monthly",why:"x",action:"y"}, snap, draft));
console.log("claim:", checkCoachReply({shortAnswer:"Cancel your subscriptions",why:"x",action:"y"}, snap, draft));
console.log("valid:", checkCoachReply({shortAnswer:"Your rent is 12000.",why:"x",action:"y"}, snap, draft));
