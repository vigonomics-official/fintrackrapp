import { MockCoachProvider, buildContext } from "@/lib/coach-provider";
import type { CoachAnalysisInput } from "@/lib/ai-coach-analysis";

const empty: CoachAnalysisInput = {
  monthlySalary: 0, salaryDate: "", currentAccountBalance: 0, monthlyRent: 0,
  monthlyFood: 0, monthlyTransport: 0, monthlyEmi: 0, monthlyBills: 0,
  monthlyInvestments: 0, currentSavings: 0, otherMonthlyExpenses: 0,
  financialGoal: "Emergency Fund",
};
const full: CoachAnalysisInput = {
  ...empty, monthlySalary: 50000, salaryDate: "1", currentAccountBalance: 18000,
  monthlyRent: 12000, monthlyFood: 8000, monthlyTransport: 3000, monthlyEmi: 6000,
  monthlyBills: 2500, monthlyInvestments: 3000, currentSavings: 40000, otherMonthlyExpenses: 2000,
};
const qs = [
 "How am I doing this month?","Where am I spending too much?","Can I buy something for ₹2,000?",
 "Why is my Survival Score 88?","How much can I safely spend today?","What should I do before salary day?",
 "How can I reach my emergency fund goal?","What is my biggest financial problem?",
 "How long until my goal?","I have a loan, what should I do?","I already have auto-debit set up",
 "I invested ₹10,000 last month","Should I invest in mutual funds?",
];
for (const label of ["EMPTY","FULL"] as const) {
  const ctx = buildContext(label === "EMPTY" ? empty : full, "en");
  console.log("\n=====", label, "=====");
  for (const q of qs) {
    const r = await MockCoachProvider.send(q, ctx);
    console.log(`\nQ: ${q}\n  A: ${r.shortAnswer}\n  why: ${r.why}\n  conf: ${r.confidence} impact: ${r.monthlyImpact ?? "-"} note: ${r.note ?? "-"}`);
  }
}
