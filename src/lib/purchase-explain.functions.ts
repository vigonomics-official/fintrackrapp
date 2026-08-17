// Server-side Gemini explanation for a purchase decision.
//
// The decision is ALREADY made by checkPurchaseAffordability(). Gemini only
// rewrites the "why" and the "suggestion" in simple language. It never sees
// raw transactions, emails, or ids — only the compact decision payload.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const numberish = z.number().finite();

const payloadSchema = z.object({
  itemName: z.string().min(1).max(60),
  purchaseAmount: numberish,
  currency: z.string().max(8),
  decision: z.enum(["SAFE", "CAREFUL", "NOT_SAFE"]),
  confidence: z.enum(["high", "medium", "low"]),
  reasonCodes: z.array(z.string().max(40)).max(12),
  deterministicWhy: z.string().min(1).max(1200),
  deterministicSuggestion: z.string().min(1).max(600),
  values: z.record(z.string().max(30), z.union([numberish, z.string().max(20)])),
  facts: z.object({
    hasEmi: z.boolean(),
    hasSavings: z.boolean(),
    hasBudget: z.boolean(),
    hasCategory: z.boolean(),
    hasSpendData: z.boolean(),
  }),
});

export type PurchaseExplainPayload = z.infer<typeof payloadSchema>;
export type PurchaseExplainResult =
  | { ok: true; why: string; suggestion: string }
  | { ok: false; error: string };

const MODEL = "google/gemini-2.5-flash";
const TIMEOUT_MS = 30_000;

const SYSTEM_PROMPT = `You explain a purchase decision that has ALREADY been made by FinTrackr's deterministic financial engine.

ABSOLUTE RULES
- Never change, recompute, or question the decision (SAFE / BE CAREFUL / NOT SAFE RIGHT NOW).
- Never invent or alter any number. Only reuse numbers present in the payload.
- Never state or guess an item category; only mention a category if payload.values.category exists, and use it verbatim.
- Never compute affordability or budget remaining yourself.
- Never claim the user has a loan, EMI, subscription, auto-debit, investment, credit card, emergency fund or savings unless the payload's facts say so.
- No financial jargon. Short, warm, everyday language. Indian rupee context.
- 2 short sentences maximum per field.

Return ONLY JSON: {"why": string, "suggestion": string}
"why" explains the main reason for the decision. "suggestion" gives ONE practical next step.`;

const replySchema = z.object({
  why: z.string().min(1).max(600),
  suggestion: z.string().min(1).max(600),
});

function extractJson(text: string): unknown {
  const cleaned = text.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const s = cleaned.indexOf("{");
    const e = cleaned.lastIndexOf("}");
    if (s >= 0 && e > s) {
      try {
        return JSON.parse(cleaned.slice(s, e + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

export const explainPurchaseAi = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => payloadSchema.parse(data))
  .handler(async ({ data }): Promise<PurchaseExplainResult> => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) return { ok: false, error: "ai_not_configured" };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Lovable-API-Key": apiKey,
          "X-Lovable-AIG-SDK": "fetch",
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: MODEL,
          temperature: 0.3,
          max_tokens: 400,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: JSON.stringify(data) },
          ],
        }),
      });

      if (!res.ok) {
        console.error("[purchase-ai] gateway error", res.status);
        return { ok: false, error: res.status === 429 ? "rate_limited" : "gateway_error" };
      }
      const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const parsed = replySchema.safeParse(extractJson(json.choices?.[0]?.message?.content ?? ""));
      if (!parsed.success) return { ok: false, error: "invalid_response" };
      return { ok: true, ...parsed.data };
    } catch (err) {
      const aborted = err instanceof Error && err.name === "AbortError";
      console.error("[purchase-ai] request failed", aborted ? "timeout" : err);
      return { ok: false, error: aborted ? "timeout" : "network_error" };
    } finally {
      clearTimeout(timer);
    }
  });
