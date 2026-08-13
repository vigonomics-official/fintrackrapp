// Post-generation guardrails for the Gemini coach reply.
//
// FinTrackr's deterministic engine owns every financial fact. These checks run
// on the model's narrative BEFORE it reaches the UI. Any violation means the
// deterministic draft is used instead — the user never sees an invented fact.

import type { CoachSnapshot } from "@/lib/coach-prompt-builder";

/** Possessive / assertive claims about things FinTrackr may have no data on. */
const CLAIM_RULES: { re: RegExp; allowed: (s: CoachSnapshot) => boolean }[] = [
  // FinTrackr never tracks these at all.
  { re: /\b(auto[-\s]?debit|standing instruction|e[-\s]?mandate|nach)\b/i, allowed: () => false },
  { re: /\byour (subscription|subscriptions)\b/i, allowed: () => false },
  { re: /\byou (have|hold) (a|an|your) [^.]{0,30}\b(subscription|credit card|bank account)\b/i, allowed: () => false },
  { re: /\byour (credit score|bank account|net banking)\b/i, allowed: () => false },
  { re: /\byour (transaction|purchase) (on|at|from)\b/i, allowed: () => false },
  // Conditional on real data.
  { re: /\byour (loan|loans|emi|emis)\b/i, allowed: (s) => s.facts.hasLoanOrEmi },
  { re: /\byou have (a|an) (loan|emi)\b/i, allowed: (s) => s.facts.hasLoanOrEmi },
  { re: /\byour (investment|investments|sip|mutual fund|stocks|portfolio)\b/i, allowed: (s) => s.facts.hasInvestments },
  { re: /\byour (savings|emergency fund)\b/i, allowed: (s) => s.facts.hasSavings },
  { re: /\byour goal\b/i, allowed: (s) => s.facts.hasGoal },
];

/** Every number the model is allowed to repeat. */
function allowedNumbers(snapshot: CoachSnapshot, draftText: string): Set<number> {
  const set = new Set<number>();
  const walk = (v: unknown) => {
    if (typeof v === "number" && Number.isFinite(v)) set.add(Math.round(v));
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") Object.values(v).forEach(walk);
  };
  walk(snapshot);
  for (const m of draftText.matchAll(/\d[\d,]*(?:\.\d+)?/g)) {
    const n = Number(m[0].replace(/,/g, ""));
    if (Number.isFinite(n)) set.add(Math.round(n));
  }
  // Small integers are ordinary prose ("2 weeks", "top 3"), not financial facts.
  for (let i = 0; i <= 31; i++) set.add(i);
  return set;
}

export type GuardrailResult = { ok: true } | { ok: false; reason: string };

export function checkCoachReply(
  reply: { shortAnswer: string; why: string; action: string },
  snapshot: CoachSnapshot,
  draft: { shortAnswer: string; why: string; action: string },
): GuardrailResult {
  const text = [reply.shortAnswer, reply.why, reply.action].join("\n");

  for (const rule of CLAIM_RULES) {
    if (rule.re.test(text) && !rule.allowed(snapshot)) {
      return { ok: false, reason: `unsupported_claim:${rule.re.source.slice(0, 40)}` };
    }
  }

  // A savings percentage may never appear when the deterministic rate is unknown.
  if (snapshot.savingsRate == null && /\d{1,3}\s?%[^.]{0,20}\b(saving|savings|saved)\b/i.test(text)) {
    return { ok: false, reason: "savings_rate_unavailable" };
  }
  if (snapshot.savingsRate != null) {
    const rates = [...text.matchAll(/\b(\d{1,3})\s?%\s*(?:savings? rate)?/gi)];
    const claimsWrongRate = rates.some(
      (m) => /saving/i.test(text.slice(Math.max(0, m.index! - 30), m.index! + 30)) &&
        Number(m[1]) !== snapshot.savingsRate,
    );
    if (claimsWrongRate) return { ok: false, reason: "savings_rate_mismatch" };
  }

  // Numbers must come from FinTrackr, never from the model.
  const allowed = allowedNumbers(snapshot, [draft.shortAnswer, draft.why, draft.action].join("\n"));
  for (const m of text.matchAll(/\d[\d,]*(?:\.\d+)?/g)) {
    const n = Math.round(Number(m[0].replace(/,/g, "")));
    if (!Number.isFinite(n)) continue;
    if (!allowed.has(n)) return { ok: false, reason: `invented_number:${n}` };
  }

  return { ok: true };
}
