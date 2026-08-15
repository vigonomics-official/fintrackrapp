// Gemini-backed CoachProvider.
//
// It never replaces FinTrackr's math: the deterministic MockCoachProvider
// produces the answer (with all numbers, calculation trace, data-used labels
// and follow-ups), and Gemini only rewrites the narrative fields.
// Any failure -> the deterministic reply is returned unchanged.

import { askCoachAi } from "@/lib/coach-ai.functions";
import { checkCoachReply } from "@/lib/coach-guardrails";
import { classifyIntent } from "@/lib/coach-intent";
import { buildCoachSnapshot, buildCoachUserPrompt, COACH_SYSTEM_PROMPT } from "@/lib/coach-prompt-builder";
import type { CoachResponse } from "@/lib/coach-prompts";
import type { ChatContext, CoachProvider } from "@/lib/coach-provider";
import { MockCoachProvider } from "@/lib/coach-provider";
import { finalizeResponse, INTENT_DATA } from "@/lib/coach-structure";

function isNonEmpty(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

export const GeminiCoachProvider: CoachProvider = {
  name: "gemini",
  async send(userText, ctx: ChatContext): Promise<CoachResponse> {
    // Deterministic answer first — this is the source of truth and the fallback.
    const draft = await MockCoachProvider.send(userText, ctx);
    if (!ctx.input || !ctx.analysis) return draft;
    // Zero-data answers stay deterministic: nothing for the model to narrate,
    // and narration is exactly where invented facts creep in.
    if (draft.shortAnswer.startsWith(NOT_ENOUGH_DATA)) return draft;

    const intent = classifyIntent(userText);


    try {
      const snapshot = buildCoachSnapshot(ctx.input, ctx.analysis, ctx.lang);
      const result = await askCoachAi({
        data: {
          question: userText.slice(0, 500),
          systemPrompt: COACH_SYSTEM_PROMPT,
          userPrompt: buildCoachUserPrompt(userText, snapshot, draft, intent),
          snapshot,
        },
      });

      if (!result.ok) return draft;
      if (!isNonEmpty(result.shortAnswer) || !isNonEmpty(result.why) || !isNonEmpty(result.action)) return draft;

      const candidate = {
        shortAnswer: result.shortAnswer.trim(),
        why: result.why.trim(),
        action: result.action.trim(),
      };

      // Reject invented facts / numbers: fall back to the deterministic reply.
      const check = checkCoachReply(candidate, snapshot, draft);
      if (!check.ok) {
        if (typeof console !== "undefined") console.warn("[gemini-provider] guardrail", check.reason);
        return draft;
      }

      // Merge: narrative from Gemini, every computed field from the engine,
      // then re-apply the structure/confidence/impact/disclaimer rules.
      return finalizeResponse(
        { ...draft, ...candidate },
        userText,
        INTENT_DATA[intent] ?? INTENT_DATA.generic,
        ctx.input,
        ctx.analysis,
      );

    } catch (err) {
      if (typeof console !== "undefined") console.error("[gemini-provider] falling back", err);
      return draft;
    }
  },
};

