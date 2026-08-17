// Server-side Gemini narration for the AI Financial Report.
//
// The report is ALREADY built deterministically by report-engine.ts. Gemini only
// rewrites it into friendlier language. It receives an aggregated snapshot —
// never raw rows, ids, emails or profile data.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const numberish = z.number().finite();

const insightSchema = z.object({
  code: z.string().max(40),
  severity: z.enum(["critical", "warning", "info", "positive"]),
  fact: z.string().max(400),
  numbers: z.record(z.string().max(30), z.union([numberish, z.string().max(40)])),
});

const payloadSchema = z.object({
  currency: z.string().max(8),
  periodLabel: z.string().max(60),
  periodType: z.enum(["weekly", "monthly"]),
  confidence: z.enum(["high", "medium", "low"]),
  values: z.record(z.string().max(30), z.union([numberish, z.string().max(40)])),
  insights: z.array(insightSchema).max(12),
  recommendations: z.array(z.string().max(400)).max(5),
  facts: z.object({
    hasSalary: z.boolean(),
    hasBudgets: z.boolean(),
    hasEmi: z.boolean(),
    hasGoals: z.boolean(),
    hasSavingsData: z.boolean(),
    hasTrend: z.boolean(),
  }),
});

export type ReportExplainPayload = z.infer<typeof payloadSchema>;
export type ReportExplainResult =
  | { ok: true; summary: string; highlights: string[]; actions: string[] }
  | { ok: false; error: string };

const MODEL = "google/gemini-2.5-flash";
const TIMEOUT_MS = 30_000;

const SYSTEM_PROMPT = `You explain a financial report that FinTrackr has ALREADY calculated.

ABSOLUTE RULES
- Never recalculate, adjust or question any number. Only reuse numbers that appear in the payload.
- Never invent transactions, goals, investments, loans, subscriptions, budgets or savings. If payload.facts says the user does not have it, do not mention it.
- Never change the severity, meaning or ordering of an insight.
- Every sentence must be traceable to an insight or a value in the payload.
- No jargon. Short, warm, everyday language. Indian rupee context.

Return ONLY JSON:
{"summary": string, "highlights": string[], "actions": string[]}
- "summary": 2 short sentences describing the period overall.
- "highlights": up to 4 short lines, each a simplified restatement of one supplied insight.
- "actions": up to 3 short lines, each a simplified restatement of one supplied recommendation. Do not add new actions.`;

const replySchema = z.object({
  summary: z.string().min(1).max(600),
  highlights: z.array(z.string().min(1).max(300)).max(6).default([]),
  actions: z.array(z.string().min(1).max(300)).max(5).default([]),
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

export const explainReportAi = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => payloadSchema.parse(data))
  .handler(async ({ data }): Promise<ReportExplainResult> => {
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
          max_tokens: 700,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: JSON.stringify(data) },
          ],
        }),
      });

      if (!res.ok) {
        console.error("[report-ai] gateway error", res.status);
        return { ok: false, error: res.status === 429 ? "rate_limited" : "gateway_error" };
      }
      const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const parsed = replySchema.safeParse(extractJson(json.choices?.[0]?.message?.content ?? ""));
      if (!parsed.success) return { ok: false, error: "invalid_response" };
      return { ok: true, ...parsed.data };
    } catch (err) {
      const aborted = err instanceof Error && err.name === "AbortError";
      console.error("[report-ai] request failed", aborted ? "timeout" : err);
      return { ok: false, error: aborted ? "timeout" : "network_error" };
    } finally {
      clearTimeout(timer);
    }
  });
