// Server-side Gemini call for the AI Salary Survival Coach.
// Authenticated, input-validated, and the ONLY place the AI gateway key is used.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const numberish = z.number().finite();

const snapshotSchema = z.object({
  lang: z.enum(["en", "ta"]),
  currency: z.literal("INR"),
  goal: z.string().max(80),
  monthlySalary: numberish,
  monthlyRent: numberish,
  monthlyFood: numberish,
  monthlyTransport: numberish,
  monthlyEmi: numberish,
  monthlyBills: numberish,
  monthlyInvestments: numberish,
  otherMonthlyExpenses: numberish,
  currentAccountBalance: numberish,
  currentSavings: numberish,
  healthScore: numberish,
  totalExpenses: numberish,
  monthlySurplus: numberish,
  savingsRate: numberish,
  emiRatio: numberish,
  topCategories: z.array(z.object({ label: z.string().max(40), amount: numberish, pct: numberish })).max(8),
  risks: z.array(z.object({ label: z.string().max(60), level: z.string().max(20) })).max(8),
  goalForecast: z.object({
    goal: z.string().max(80),
    monthlyTarget: numberish,
    targetAmount: numberish,
    etaMonths: numberish,
    confidence: numberish,
  }),
});

const inputSchema = z.object({
  question: z.string().min(1).max(500),
  systemPrompt: z.string().min(1).max(4000),
  userPrompt: z.string().min(1).max(12000),
  snapshot: snapshotSchema,
});

export type CoachAiOk = { ok: true; shortAnswer: string; why: string; action: string };
export type CoachAiErr = { ok: false; error: string };

const GEMINI_MODEL = "google/gemini-2.5-flash";
// Deliberately generous: this is a safety net against a hung socket, not a
// latency budget. Normal replies land in a few seconds.
const HARD_TIMEOUT_MS = 120_000;

function extractJson(text: string): unknown {
  const cleaned = text.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

const replySchema = z.object({
  shortAnswer: z.string().min(1).max(1200),
  why: z.string().min(1).max(1200),
  action: z.string().min(1).max(1200),
});

export const askCoachAi = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data }): Promise<CoachAiOk | CoachAiErr> => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) return { ok: false, error: "ai_not_configured" };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), HARD_TIMEOUT_MS);

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
          model: GEMINI_MODEL,
          temperature: 0.4,
          max_tokens: 700,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: data.systemPrompt },
            { role: "user", content: data.userPrompt },
          ],
        }),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        console.error("[coach-ai] gateway error", res.status, body.slice(0, 300));
        if (res.status === 429) return { ok: false, error: "rate_limited" };
        if (res.status === 402) return { ok: false, error: "credits_exhausted" };
        return { ok: false, error: "gateway_error" };
      }

      const json = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const text = json.choices?.[0]?.message?.content ?? "";
      const parsed = replySchema.safeParse(extractJson(text));
      if (!parsed.success) {
        console.error("[coach-ai] invalid model response shape");
        return { ok: false, error: "invalid_response" };
      }
      return { ok: true, ...parsed.data };
    } catch (err) {
      const aborted = err instanceof Error && err.name === "AbortError";
      console.error("[coach-ai] request failed", aborted ? "timeout" : err);
      return { ok: false, error: aborted ? "timeout" : "network_error" };
    } finally {
      clearTimeout(timer);
    }
  });
