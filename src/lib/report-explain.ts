// Client wrapper: asks Gemini to narrate the deterministic report, then guards
// the reply. Any failure or guardrail violation falls back to the
// deterministic text — the user never sees a technical error.

import { explainReportAi, type ReportExplainPayload } from "@/lib/report-explain.functions";
import type { DeterministicReport } from "@/lib/report-engine";
import type { ReportSnapshot } from "@/lib/report-snapshot";

export type ReportNarration = {
  summary: string;
  highlights: string[];
  actions: string[];
  source: "ai" | "deterministic";
};

type Facts = ReportExplainPayload["facts"];

/** Claims FinTrackr cannot back up from this report. */
const FORBIDDEN: { re: RegExp; allowed: (f: Facts) => boolean }[] = [
  { re: /\b(auto[-\s]?debit|standing instruction|e[-\s]?mandate|nach|subscription|credit score|net banking|tax|insurance)\b/i, allowed: () => false },
  { re: /\byour (investment|investments|sip|mutual fund|stocks|portfolio)\b/i, allowed: () => false },
  { re: /\byour (loan|loans|emi|emis)\b/i, allowed: (f) => f.hasEmi },
  { re: /\byour (goal|goals)\b/i, allowed: (f) => f.hasGoals },
  { re: /\byour (savings|emergency fund)\b/i, allowed: (f) => f.hasSavingsData },
  { re: /\byour budget(s)?\b/i, allowed: (f) => f.hasBudgets },
  { re: /\byour salary\b/i, allowed: (f) => f.hasSalary },
];

function allowedNumbers(payload: ReportExplainPayload): Set<number> {
  const set = new Set<number>();
  const walk = (v: unknown) => {
    if (typeof v === "number" && Number.isFinite(v)) set.add(Math.round(Math.abs(v)));
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") Object.values(v).forEach(walk);
  };
  walk(payload.values);
  payload.insights.forEach((i) => walk(i.numbers));
  const text = [
    ...payload.insights.map((i) => i.fact),
    ...payload.recommendations,
    payload.periodLabel,
  ].join(" ");
  for (const m of text.matchAll(/\d[\d,]*(?:\.\d+)?/g)) {
    const n = Number(m[0].replace(/,/g, ""));
    if (Number.isFinite(n)) set.add(Math.round(n));
  }
  for (let i = 0; i <= 31; i++) set.add(i);
  return set;
}

export function checkReportNarration(text: string, payload: ReportExplainPayload): boolean {
  for (const rule of FORBIDDEN) if (rule.re.test(text) && !rule.allowed(payload.facts)) return false;
  const allowed = allowedNumbers(payload);
  for (const m of text.matchAll(/\d[\d,]*(?:\.\d+)?/g)) {
    const n = Math.round(Number(m[0].replace(/,/g, "")));
    if (!Number.isFinite(n)) continue;
    // ±1 tolerance absorbs rounding of a value we supplied (68.57% -> "68%"),
    // while still rejecting invented amounts.
    if (!allowed.has(n) && !allowed.has(n + 1) && !allowed.has(n - 1)) return false;
  }

  return true;
}

export function buildReportPayload(
  report: DeterministicReport,
  snapshot: ReportSnapshot,
): ReportExplainPayload {
  const values: Record<string, number | string> = {};
  const put = (k: string, v: number | string | undefined | null) => {
    if (v != null) values[k] = v;
  };
  put("salary", snapshot.salary);
  put("salaryLeft", snapshot.salaryLeft);
  put("totalSpent", snapshot.totalSpent);
  put("totalSavings", snapshot.totalSavings);
  put("savingsRate", snapshot.savingsRate);
  put("safeDaily", snapshot.safeDaily);
  put("daysRemaining", snapshot.daysRemaining);
  put("survivalScore", snapshot.score);
  put("forecastBalance", snapshot.forecastBalance);
  put("monthlyEmi", snapshot.monthlyEmi);
  put("loanBalance", snapshot.loanBalance);
  put("budgetTotal", snapshot.budgetTotal);
  put("budgetRemaining", snapshot.budgetRemaining);
  put("emergencyFund", snapshot.emergencyFund);
  put("emergencyFundTarget", snapshot.emergencyFundTarget);
  put("transactionCount", snapshot.transactionCount);
  snapshot.categories.slice(0, 5).forEach((c, i) => {
    values[`category${i + 1}`] = c.name;
    values[`category${i + 1}Spent`] = c.spent;
    if (c.share != null) values[`category${i + 1}Share`] = c.share;
  });

  return {
    currency: snapshot.currency,
    periodLabel: snapshot.period.label,
    periodType: snapshot.period.type,
    confidence: report.confidence,
    values,
    insights: report.insights.slice(0, 12).map((i) => ({
      code: i.code,
      severity: i.severity,
      fact: i.fact,
      numbers: i.numbers,
    })),
    recommendations: report.recommendations.map((r) => r.text),
    facts: {
      hasSalary: snapshot.salary != null,
      hasBudgets: snapshot.budgetTotal != null,
      hasEmi: snapshot.monthlyEmi != null && snapshot.monthlyEmi > 0,
      hasGoals: snapshot.goals.length > 0,
      hasSavingsData: snapshot.totalSavings != null || snapshot.emergencyFund != null,
      hasTrend: snapshot.spendingTrend != null,
    },
  };
}

export function deterministicNarration(report: DeterministicReport): ReportNarration {
  const summary = report.sections.find((s) => s.id === "executiveSummary")?.lines.join(" ") ?? "";
  return {
    summary,
    highlights: report.insights.slice(0, 4).map((i) => i.fact),
    actions: report.recommendations.map((r) => r.text),
    source: "deterministic",
  };
}

export async function explainReport(
  report: DeterministicReport,
  snapshot: ReportSnapshot,
): Promise<ReportNarration> {
  const fallback = deterministicNarration(report);
  try {
    const payload = buildReportPayload(report, snapshot);
    const res = await explainReportAi({ data: payload });
    if (!res.ok) return fallback;
    const summary = res.summary.trim();
    const highlights = (res.highlights ?? []).map((h) => h.trim()).filter(Boolean);
    const actions = (res.actions ?? []).map((a) => a.trim()).filter(Boolean);
    if (!summary) return fallback;
    if (!checkReportNarration([summary, ...highlights, ...actions].join("\n"), payload)) return fallback;
    // Gemini may only restate supplied recommendations — never add more.
    if (actions.length > report.recommendations.length) return fallback;
    return {
      summary,
      highlights: highlights.length ? highlights : fallback.highlights,
      actions: actions.length ? actions : fallback.actions,
      source: "ai",
    };
  } catch {
    return fallback;
  }
}
