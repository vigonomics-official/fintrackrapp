// Client-side wrapper: asks Gemini to narrate a purchase decision, then
// guards the reply. Any failure / violation returns the deterministic text.

import { explainPurchaseAi, type PurchaseExplainPayload } from "@/lib/purchase-explain.functions";
import type { PurchaseCheckResult } from "@/lib/purchase-affordability";

export type PurchaseNarration = { why: string; suggestion: string; source: "ai" | "deterministic" };

/** Claims FinTrackr cannot back up from this payload. */
const FORBIDDEN: { re: RegExp; allowed: (r: PurchaseCheckResult) => boolean }[] = [
  { re: /\b(auto[-\s]?debit|standing instruction|e[-\s]?mandate|nach|subscription|credit score|net banking)\b/i, allowed: () => false },
  { re: /\byour (investment|investments|sip|mutual fund|stocks|portfolio)\b/i, allowed: () => false },
  { re: /\byour (loan|loans|emi|emis)\b/i, allowed: (r) => r.values.emiPressure != null && r.values.emiPressure !== "Low" },
  { re: /\byour (savings|emergency fund)\b/i, allowed: (r) => r.dataUsed.includes("Savings") },
  { re: /\byour budget\b/i, allowed: (r) => r.values.budgetRemaining != null },
];

function allowedNumbers(result: PurchaseCheckResult): Set<number> {
  const set = new Set<number>();
  const walk = (v: unknown) => {
    if (typeof v === "number" && Number.isFinite(v)) set.add(Math.round(Math.abs(v)));
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") Object.values(v).forEach(walk);
  };
  walk(result.values);
  set.add(Math.round(result.purchaseAmount));
  for (const m of `${result.why} ${result.suggestion}`.matchAll(/\d[\d,]*(?:\.\d+)?/g)) {
    const n = Number(m[0].replace(/,/g, ""));
    if (Number.isFinite(n)) set.add(Math.round(n));
  }
  for (let i = 0; i <= 31; i++) set.add(i);
  return set;
}

export function checkNarration(text: string, result: PurchaseCheckResult): boolean {
  for (const rule of FORBIDDEN) if (rule.re.test(text) && !rule.allowed(result)) return false;
  const allowed = allowedNumbers(result);
  for (const m of text.matchAll(/\d[\d,]*(?:\.\d+)?/g)) {
    const n = Math.round(Number(m[0].replace(/,/g, "")));
    if (Number.isFinite(n) && !allowed.has(n)) return false;
  }
  // The model must not restate a different verdict.
  const others: Record<string, RegExp> = {
    SAFE: /not safe|avoid this purchase/i,
    CAREFUL: /\bsafe to buy\b/i,
    NOT_SAFE: /\bsafe to buy\b|go ahead and buy/i,
  };
  const re = others[result.decision];
  if (re && re.test(text)) return false;
  return true;
}

export function buildExplainPayload(result: PurchaseCheckResult): PurchaseExplainPayload {
  const values: Record<string, number | string> = {};
  for (const [k, v] of Object.entries(result.values)) if (v != null) values[k] = v as number | string;
  return {
    itemName: result.itemName,
    purchaseAmount: result.purchaseAmount,
    currency: result.currency,
    decision: result.decision as "SAFE" | "CAREFUL" | "NOT_SAFE",
    confidence: result.confidence,
    reasonCodes: result.reasonCodes,
    deterministicWhy: result.why,
    deterministicSuggestion: result.suggestion,
    values,
    facts: {
      hasEmi: (result.values.emiPressure ?? "Low") !== "Low",
      hasSavings: result.dataUsed.includes("Savings"),
      hasBudget: result.values.budgetRemaining != null,
      hasSpendData: result.values.forecastBefore != null,
    },
  };
}

export async function explainPurchase(result: PurchaseCheckResult): Promise<PurchaseNarration> {
  const fallback: PurchaseNarration = { why: result.why, suggestion: result.suggestion, source: "deterministic" };
  if (result.decision === "INSUFFICIENT_DATA") return fallback;

  try {
    const res = await explainPurchaseAi({ data: buildExplainPayload(result) });
    if (!res.ok) return fallback;
    const why = res.why.trim();
    const suggestion = res.suggestion.trim();
    if (!why || !suggestion) return fallback;
    if (!checkNarration(`${why}\n${suggestion}`, result)) return fallback;
    return { why, suggestion, source: "ai" };
  } catch {
    return fallback;
  }
}
