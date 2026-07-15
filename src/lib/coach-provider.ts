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
  | "generic";

function classify(text: string): Intent {
  const q = text.toLowerCase();
  if (/(afford|buy|purchase|phone|laptop|weekend budget|weekend)/.test(q)) return "afford";
  if (/(survival score|improve score|health score|why.*low)/.test(q)) return "improveScore";
  if (/food|grocer|eating|delivery/.test(q)) return "reduceFood";
  if (/emergency|rainy day|safety net|bills due/.test(q)) return "emergency";
  if (/goal|gold|bike|house|vacation|target|sip|investment/.test(q)) return "goal";
  if (/budget|breakdown|where.*money|expense.*split/.test(q)) return "budget";
  if (/reduce|cut|which expense|save|first/.test(q)) return "reduceFirst";
  return "generic";
}

export const MockCoachProvider: CoachProvider = {
  name: "mock",
  async send(userText, ctx) {
    await new Promise((r) => setTimeout(r, 500 + Math.random() * 400));
    if (!ctx.input || !ctx.analysis) return replyNoContext(ctx.lang);
    const intent = classify(userText);
    switch (intent) {
      case "afford":
        return replyAffordability(ctx.lang, ctx.input, ctx.analysis);
      case "improveScore":
        return replyImproveScore(ctx.lang, ctx.input, ctx.analysis);
      case "reduceFood":
        return replyReduceFood(ctx.lang, ctx.input);
      case "emergency":
        return replyEmergency(ctx.lang, ctx.input, ctx.analysis);
      case "goal":
        return replyGoal(ctx.lang, ctx.input, ctx.analysis);
      case "budget":
        return replyBudget(ctx.lang, ctx.input, ctx.analysis);
      case "reduceFirst":
        return replyReduceFirst(ctx.lang, ctx.input, ctx.analysis);
      default:
        return replyGeneric(ctx.lang, ctx.input, ctx.analysis, userText);
    }
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
