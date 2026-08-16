import { analyzeMock, type CoachAnalysisInput } from "@/lib/ai-coach-analysis";
import { MockCoachProvider } from "@/lib/coach-provider";
import { classifyIntent } from "@/lib/coach-intent";
import { buildCoachSnapshot } from "@/lib/coach-prompt-builder";
import { checkCoachReply } from "@/lib/coach-guardrails";

const real: CoachAnalysisInput = {
  monthlySalary: 60000, salaryDate: "2026-09-01", currentAccountBalance: 21000,
  monthlyRent: 15000, monthlyFood: 9000, monthlyTransport: 3000, monthlyEmi: 8000,
  monthlyBills: 2500, monthlyInvestments: 5000, currentSavings: 40000,
  otherMonthlyExpenses: 4000, financialGoal: "Emergency Fund",
};
const empty: CoachAnalysisInput = {
  monthlySalary: 0, salaryDate: "", currentAccountBalance: 0, monthlyRent: 0, monthlyFood: 0,
  monthlyTransport: 0, monthlyEmi: 0, monthlyBills: 0, monthlyInvestments: 0, currentSavings: 0,
  otherMonthlyExpenses: 0, financialGoal: "Emergency Fund",
};
const qs = [
  "How am I doing this month?",
  "Where am I spending too much?",
  "Can I buy something for ₹2,000?",
  "Why is my Survival Score 88?",
  "How much can I safely spend today?",
  "What should I do before salary day?",
  "How can I reach my emergency fund goal?",
  "What is my biggest financial problem?",
];
async function run(name: string, input: CoachAnalysisInput) {
  const analysis = analyzeMock(input);
  console.log(`\n===== ${name} | score=${analysis.healthScore} exp=${analysis.totalExpenses} surplus=${analysis.monthlySurplus} safeDaily=${(analysis as any).safeDailySpend} =====`);
  const snap = buildCoachSnapshot(input, analysis, "en");
  console.log("SNAPSHOT:", JSON.stringify(snap).slice(0, 700));
  for (const q of qs) {
    const r = await MockCoachProvider.send(q, { input, analysis, lang: "en" });
    console.log(`\nQ: ${q}\n  intent=${classifyIntent(q)} conf=${r.confidence} data=${JSON.stringify(r.dataUsed)}`);
    console.log("  A:", r.shortAnswer, "\n  WHY:", r.why, "\n  ACT:", r.action, "\n  IMPACT:", r.monthlyImpact ?? "-", "\n  NOTE:", r.note ?? "-");
    const g = checkCoachReply({ shortAnswer: r.shortAnswer, why: r.why, action: r.action }, snap, r);
    if (!g.ok) console.log("  !!GUARDRAIL SELF-FAIL:", g.reason);
  }
}
await run("REAL", real);
await run("EMPTY", empty);
// fabricated reply test
const analysis = analyzeMock(real);
const snap = buildCoachSnapshot(real, analysis, "en");
const draft = await MockCoachProvider.send("How am I doing this month?", { input: real, analysis, lang: "en" });
console.log("\nFABRICATION TEST:", JSON.stringify(checkCoachReply({ shortAnswer: "You can save ₹98,765", why: "Your auto-debit for Netflix subscription", action: "cancel it" }, snap, draft)));
