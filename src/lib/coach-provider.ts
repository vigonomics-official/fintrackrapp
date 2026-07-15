// Provider abstraction — Mock today, Gemini tomorrow.
// The UI only knows about ChatProvider + CoachResponse; the specific
// implementation can be swapped without touching CoachChatSheet.

import type { CoachAnalysisInput, CoachAnalysisResult } from "@/lib/ai-coach-analysis";
import { analyzeMock } from "@/lib/ai-coach-analysis";
import type { CoachLanguage } from "@/lib/coach-language";
import {
  ensureExplainable,
  replyAffordability,
  replyBudget,
  replyCompare,
  replyEmergency,
  replyExplainMetric,
  replyGeneric,
  replyGoal,
  replyGoalDelay,
  replyImproveScore,
  replyNoContext,
  replyReduceFirst,
  replyReduceFood,
  replyWhatIf,
  type CoachResponse,
  type MetricKey,
  type WhatIfScenario,
} from "@/lib/coach-prompts";

export type ChatContext = {
  input: CoachAnalysisInput | null;
  analysis: CoachAnalysisResult | null;
  lang: CoachLanguage;
};

export interface CoachProvider {
  name: string;
  send(userText: string, ctx: ChatContext): Promise<CoachResponse>;
}

type Intent =
  | "afford"
  | "improveScore"
  | "reduceFood"
  | "emergency"
  | "goal"
  | "budget"
  | "reduceFirst"
  | "compare"
  | "whatIf"
  | "explainMetric"
  | "goalDelay"
  | "generic";

function classify(text: string): Intent {
  const q = text.toLowerCase();
  if (/\bvs\b|versus|compare/.test(q)) return "compare";
  if (/what if|what-if|whatif/.test(q)) return "whatIf";
  if (/explain (my |this )?(score|number|safe daily|safe purchase|savings target|goal forecast)/.test(q))
    return "explainMetric";
  if (/(delay|push (out|back)|when should i buy|better date)/.test(q)) return "goalDelay";
  if (/(afford|buy|purchase|phone|laptop|weekend budget|weekend)/.test(q)) return "afford";
  if (/(survival score|improve score|health score|why.*low)/.test(q)) return "improveScore";
  if (/food|grocer|eating|delivery/.test(q)) return "reduceFood";
  if (/emergency|rainy day|safety net|bills due/.test(q)) return "emergency";
  if (/goal|gold|bike|house|vacation|target|sip|investment/.test(q)) return "goal";
  if (/budget|breakdown|where.*money|expense.*split/.test(q)) return "budget";
  if (/reduce|cut|which expense|save|first/.test(q)) return "reduceFirst";
  return "generic";
}

function classifyMetric(text: string): MetricKey {
  const q = text.toLowerCase();
  if (/safe daily/.test(q)) return "safeDailySpend";
  if (/safe purchase|purchase limit/.test(q)) return "safePurchase";
  if (/savings target/.test(q)) return "savingsTarget";
  if (/goal forecast|goal eta/.test(q)) return "goalForecast";
  return "survivalScore";
}

function classifyWhatIf(text: string): { scenario: WhatIfScenario; amount: number } {
  const q = text.toLowerCase();
  const m = q.match(/(?:₹|rs\.?\s*)?(\d[\d,]{2,})/);
  const amount = m ? Number(m[1].replace(/,/g, "")) : 1000;
  if (/skip.*(shop|spend)/.test(q)) return { scenario: "skipShopping", amount };
  if (/sip|invest/.test(q)) return { scenario: "increaseSip", amount };
  if (/after salary|salary day/.test(q)) return { scenario: "buyAfterSalary", amount };
  return { scenario: "saveMore", amount };
}

function extractAmount(text: string): number | null {
  const m = text.match(/(?:₹|rs\.?\s*)?(\d[\d,]{3,})/i);
  return m ? Number(m[1].replace(/,/g, "")) : null;
}

export const MockCoachProvider: CoachProvider = {
  name: "mock",
  async send(userText, ctx) {
    await new Promise((r) => setTimeout(r, 500 + Math.random() * 400));
    if (!ctx.input || !ctx.analysis) return replyNoContext(ctx.lang);
    const intent = classify(userText);
    let reply: CoachResponse;
    switch (intent) {
      case "compare":
        reply = replyCompare(ctx.lang, ctx.input, ctx.analysis, userText);
        break;
      case "whatIf": {
        const w = classifyWhatIf(userText);
        reply = replyWhatIf(ctx.lang, ctx.input, ctx.analysis, w.scenario, w.amount);
        break;
      }
      case "explainMetric":
        reply = replyExplainMetric(ctx.lang, ctx.input, ctx.analysis, classifyMetric(userText));
        break;
      case "goalDelay": {
        const amt = extractAmount(userText) ?? Math.round(ctx.input.monthlySalary * 0.5);
        reply = replyGoalDelay(ctx.lang, ctx.input, ctx.analysis, amt);
        break;
      }
      case "afford":
        reply = replyAffordability(ctx.lang, ctx.input, ctx.analysis);
        break;
      case "improveScore":
        reply = replyImproveScore(ctx.lang, ctx.input, ctx.analysis);
        break;
      case "reduceFood":
        reply = replyReduceFood(ctx.lang, ctx.input);
        break;
      case "emergency":
        reply = replyEmergency(ctx.lang, ctx.input, ctx.analysis);
        break;
      case "goal":
        reply = replyGoal(ctx.lang, ctx.input, ctx.analysis);
        break;
      case "budget":
        reply = replyBudget(ctx.lang, ctx.input, ctx.analysis);
        break;
      case "reduceFirst":
        reply = replyReduceFirst(ctx.lang, ctx.input, ctx.analysis);
        break;
      default:
        reply = replyGeneric(ctx.lang, ctx.input, ctx.analysis, userText);
    }
    return ensureExplainable(reply, ctx.input);
  },
};

export function buildContext(input: CoachAnalysisInput | null, lang: CoachLanguage): ChatContext {
  if (!input) return { input: null, analysis: null, lang };
  try {
    return { input, analysis: analyzeMock(input), lang };
  } catch {
    return { input, analysis: null, lang };
  }
}
