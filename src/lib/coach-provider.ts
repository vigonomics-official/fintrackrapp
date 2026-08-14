// Provider abstraction — Mock today, Gemini tomorrow.
// The UI only knows about ChatProvider + CoachResponse; the specific
// implementation can be swapped without touching CoachChatSheet.

import type { CoachAnalysisInput, CoachAnalysisResult } from "@/lib/ai-coach-analysis";
import { analyzeMock } from "@/lib/ai-coach-analysis";
import type { CoachLanguage } from "@/lib/coach-language";
import { classifyIntent, extractAmount, type CoachIntent } from "@/lib/coach-intent";
import { finalizeResponse, INTENT_DATA } from "@/lib/coach-structure";
import {
  ensureExplainable,
  replyAffordAmount,
  replyAffordability,
  replyBeforeSalary,
  replyBiggestProblem,
  replyBudget,
  replyCompare,
  replyEmergency,
  replyExplainMetric,
  replyGeneric,
  replyGoal,
  replyGoalDelay,
  replyImproveScore,
  replyMonthStatus,
  replyNoContext,
  replyOverspend,
  replyReduceFirst,
  replyReduceFood,
  replySafeToday,
  replySaveHowMuch,
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

export type { CoachIntent };

/** Exposed so the Gemini provider can reuse the exact same intent routing. */
export function classify(text: string): CoachIntent {
  return classifyIntent(text);
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


export const MockCoachProvider: CoachProvider = {
  name: "mock",
  async send(userText, ctx) {
    await new Promise((r) => setTimeout(r, 500 + Math.random() * 400));
    if (!ctx.input || !ctx.analysis) return replyNoContext(ctx.lang);
    const intent = classify(userText);
    let reply: CoachResponse;
    switch (intent) {
      case "monthStatus":
        reply = replyMonthStatus(ctx.lang, ctx.input, ctx.analysis);
        break;
      case "overspend":
        reply = replyOverspend(ctx.lang, ctx.input, ctx.analysis);
        break;
      case "affordAmount":
        reply = replyAffordAmount(
          ctx.lang,
          ctx.input,
          ctx.analysis,
          extractAmount(userText) ?? Math.max(0, Math.round(ctx.analysis.monthlySurplus * 0.5)),
        );
        break;
      case "saveHowMuch":
        reply = replySaveHowMuch(ctx.lang, ctx.input, ctx.analysis);
        break;
      case "safeToday":
        reply = replySafeToday(ctx.lang, ctx.input, ctx.analysis);
        break;
      case "beforeSalary":
        reply = replyBeforeSalary(ctx.lang, ctx.input, ctx.analysis);
        break;
      case "emergencyGoal":
        reply = replyEmergency(ctx.lang, ctx.input, ctx.analysis);
        break;
      case "biggestProblem":
        reply = replyBiggestProblem(ctx.lang, ctx.input, ctx.analysis);
        break;
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
    return finalizeResponse(
      ensureExplainable(reply, ctx.input),
      userText,
      INTENT_DATA[intent] ?? INTENT_DATA.generic,
      ctx.input,
      ctx.analysis,
    );
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

/**
 * Provider used by the UI: Gemini narration on top of the deterministic engine,
 * with an automatic fallback to MockCoachProvider on any failure.
 * Lazy import keeps the server-function module out of the initial chunk.
 */
export const defaultCoachProvider: CoachProvider = {
  name: "gemini+mock",
  async send(userText, ctx) {
    try {
      const { GeminiCoachProvider } = await import("@/lib/gemini-provider");
      return await GeminiCoachProvider.send(userText, ctx);
    } catch (err) {
      if (typeof console !== "undefined") console.error("[coach-provider] fallback to mock", err);
      return MockCoachProvider.send(userText, ctx);
    }
  },
};
