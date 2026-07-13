// Provider-agnostic chat abstraction for the AI Salary Survival Coach.
// A future GeminiProvider can implement ChatProvider without any UI changes.

import type { CoachAnalysisInput, CoachAnalysisResult } from "@/lib/ai-coach-analysis";
import { analyzeMock } from "@/lib/ai-coach-analysis";

export type ChatRole = "user" | "assistant";

export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: number;
};

export type ChatContext = {
  input: CoachAnalysisInput | null;
  analysis: CoachAnalysisResult | null;
};

export interface ChatProvider {
  name: string;
  send(userText: string, ctx: ChatContext, history: ChatMessage[]): Promise<string>;
}

export const CHAT_HISTORY_KEY = "fintrackr:ai-coach:chat-history";
export const MAX_HISTORY = 10 * 2; // 10 exchanges = 20 messages

export const SUGGESTED_CHIPS = [
  "Can I Buy This?",
  "Improve Survival Score",
  "Reduce Food Expense",
  "Emergency Fund",
  "Goal Progress",
  "Monthly Budget",
] as const;

export const EXAMPLE_QUESTIONS = [
  "Can I afford a new phone?",
  "How can I save ₹2,000 this month?",
  "Why is my Survival Score low?",
  "Which expense should I reduce first?",
  "How long until I reach my Gold goal?",
] as const;

export const WELCOME_MESSAGE =
  "Hi! I'm your AI Salary Survival Coach. Ask me anything about your money.";

const inr = (n: number) =>
  `₹${Math.round(Math.max(0, n)).toLocaleString("en-IN")}`;

function noContextReply(): string {
  return [
    "I don't have your latest financial analysis yet.",
    "",
    "Run **Analyze** first and I'll be able to answer with your actual salary, expenses, and goal.",
  ].join("\n");
}

function affordReply(ctx: ChatContext): string {
  const { input, analysis } = ctx;
  if (!input || !analysis) return noContextReply();
  const surplus = analysis.monthlySurplus;
  if (surplus <= 0) {
    return `Right now your expenses (${inr(analysis.totalExpenses)}) already meet or exceed your salary (${inr(input.monthlySalary)}). A new purchase would come out of savings — I'd hold off until you free up cash flow.`;
  }
  return `You have about ${inr(surplus)} of monthly surplus. A one-time purchase under ~${inr(surplus * 0.5)} is comfortable; anything larger, spread across 2–3 months or use the "Can I Buy This?" tool in the **Plan** tab for a precise impact preview.`;
}

function improveScoreReply(ctx: ChatContext): string {
  const { analysis } = ctx;
  if (!analysis) return noContextReply();
  const bits = [
    `Your current Survival Score is **${analysis.healthScore}/100**.`,
    "",
    "Biggest levers right now:",
  ];
  analysis.priorities.slice(0, 3).forEach((p, i) => {
    bits.push(`${i + 1}. **${p.title}** — ${p.detail}`);
  });
  return bits.join("\n");
}

function reduceFoodReply(ctx: ChatContext): string {
  const { input } = ctx;
  if (!input) return noContextReply();
  if (input.monthlyFood <= 0) {
    return "You haven't logged a food budget yet, so I can't estimate cuts. Add it in Analyze and I'll suggest a target.";
  }
  const target = Math.round(input.monthlyFood * 0.85 / 100) * 100;
  const saving = input.monthlyFood - target;
  return `You currently spend ${inr(input.monthlyFood)} on food. A realistic 15% cut brings it to ${inr(target)} — saving ~${inr(saving)}/month. Plan weekly groceries and cap delivery to twice a week.`;
}

function emergencyFundReply(ctx: ChatContext): string {
  const { input, analysis } = ctx;
  if (!input || !analysis) return noContextReply();
  const months = analysis.totalExpenses > 0 ? input.currentSavings / analysis.totalExpenses : 0;
  const target = analysis.totalExpenses * 6;
  const gap = Math.max(0, target - input.currentSavings);
  const monthly = Math.max(500, Math.round(input.monthlySalary * 0.05 / 100) * 100);
  return `You have ${inr(input.currentSavings)} in savings — roughly **${months.toFixed(1)} months** of expenses. Aim for 6 months (${inr(target)}). Auto-transfer ${inr(monthly)} on salary day and you'll close the ${inr(gap)} gap in ~${Math.ceil(gap / monthly)} months.`;
}

function goalProgressReply(ctx: ChatContext): string {
  const { analysis } = ctx;
  if (!analysis) return noContextReply();
  const g = analysis.goalForecast;
  return `For your **${g.goal}** goal, you'd need about ${inr(g.monthlyTarget)}/month to reach ${inr(g.targetAmount)}. At your current pace, ETA is around **${g.etaMonths} months** (${new Date(g.estimatedCompletion).toLocaleDateString("en-IN", { month: "short", year: "numeric" })}). Confidence: ${g.confidence}%.`;
}

function monthlyBudgetReply(ctx: ChatContext): string {
  const { input, analysis } = ctx;
  if (!input || !analysis) return noContextReply();
  const bits = [
    `**Salary:** ${inr(input.monthlySalary)}`,
    `**Expenses:** ${inr(analysis.totalExpenses)}`,
    `**Surplus:** ${inr(analysis.monthlySurplus)} (${Math.round(analysis.savingsRate)}% savings rate)`,
    "",
    "Top categories:",
    ...analysis.breakdown.slice(0, 4).map((b) => `• ${b.label}: ${inr(b.amount)} (${Math.round(b.pct)}%)`),
  ];
  return bits.join("\n");
}

function reduceFirstReply(ctx: ChatContext): string {
  const { analysis } = ctx;
  if (!analysis) return noContextReply();
  const top = analysis.breakdown[0];
  if (!top) return "Your spending is spread thin — no single category dominates.";
  return `Your largest outflow is **${top.label}** at ${inr(top.amount)} (${Math.round(top.pct)}% of spending). Trimming this by 10% saves ${inr(top.amount * 0.1)}/month.`;
}

function whyScoreLowReply(ctx: ChatContext): string {
  const { analysis } = ctx;
  if (!analysis) return noContextReply();
  if (analysis.healthScore >= 70) {
    return `Your score is actually healthy at **${analysis.healthScore}/100**. Keep the current rhythm.`;
  }
  const highRisks = analysis.risks.filter((r) => r.level === "High");
  const bits = [`Your Survival Score is **${analysis.healthScore}/100**. Main reasons:`];
  const list = (highRisks.length ? highRisks : analysis.risks).slice(0, 3);
  list.forEach((r) => bits.push(`• **${r.label}** (${r.level}) — ${r.explanation}`));
  return bits.join("\n");
}

// Very light keyword router — replace with Gemini later.
function classify(text: string): keyof typeof INTENT_HANDLERS | "generic" {
  const q = text.toLowerCase();
  if (/(afford|buy|purchase|phone|laptop|can i)/.test(q)) return "afford";
  if (/(survival score|improve score|health score)/.test(q)) return "improveScore";
  if (/(why.*(low|bad|down)|score.*low)/.test(q)) return "whyLow";
  if (/food|grocer|eating|delivery/.test(q)) return "reduceFood";
  if (/emergency|rainy day|safety net/.test(q)) return "emergency";
  if (/goal|gold|bike|house|vacation|target/.test(q)) return "goal";
  if (/budget|breakdown|where.*money|expense.*split/.test(q)) return "budget";
  if (/reduce|cut|which expense|first/.test(q)) return "reduceFirst";
  if (/save.*(\d|₹)/.test(q) || /how.*save/.test(q)) return "reduceFirst";
  return "generic";
}

const INTENT_HANDLERS = {
  afford: affordReply,
  improveScore: improveScoreReply,
  whyLow: whyScoreLowReply,
  reduceFood: reduceFoodReply,
  emergency: emergencyFundReply,
  goal: goalProgressReply,
  budget: monthlyBudgetReply,
  reduceFirst: reduceFirstReply,
} as const;

function genericReply(ctx: ChatContext, text: string): string {
  if (!ctx.analysis) return noContextReply();
  return [
    `Here's a quick read on your finances related to "${text.trim()}":`,
    "",
    monthlyBudgetReply(ctx),
    "",
    "Ask about **affordability**, **your Survival Score**, a **specific expense**, or **goal progress** for a sharper answer.",
  ].join("\n");
}

export const MockChatProvider: ChatProvider = {
  name: "mock",
  async send(userText, ctx) {
    // simulate a small latency so the "Thinking..." indicator is visible
    await new Promise((r) => setTimeout(r, 500 + Math.random() * 400));
    const intent = classify(userText);
    if (intent === "generic") return genericReply(ctx, userText);
    return INTENT_HANDLERS[intent](ctx);
  },
};

// Convenience: hydrate analysis on the fly if the caller only has input.
export function buildContext(input: CoachAnalysisInput | null): ChatContext {
  if (!input) return { input: null, analysis: null };
  try {
    return { input, analysis: analyzeMock(input) };
  } catch {
    return { input, analysis: null };
  }
}

export function loadHistory(): ChatMessage[] {
  try {
    const raw = localStorage.getItem(CHAT_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ChatMessage[];
    return Array.isArray(parsed) ? parsed.slice(-MAX_HISTORY) : [];
  } catch {
    return [];
  }
}

export function saveHistory(messages: ChatMessage[]): void {
  try {
    localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(messages.slice(-MAX_HISTORY)));
  } catch {
    /* ignore quota */
  }
}

export function clearHistory(): void {
  try {
    localStorage.removeItem(CHAT_HISTORY_KEY);
  } catch {
    /* ignore */
  }
}
