/**
 * AI Financial Report — presentation only.
 *
 * Every number rendered here comes from the deterministic snapshot/report.
 * Gemini narration (when available) replaces prose only.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { Sparkles, ShieldCheck, ChevronDown, RefreshCw, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  useTransactions, useCategories, useBudgets, useLoans, useProfile, monthKey,
} from "@/hooks/use-finance";
import { useSalarySettings } from "@/hooks/use-salary-settings";
import { buildReportSnapshot, readStoredGoals, type ReportPeriodType } from "@/lib/report-snapshot";
import { buildDeterministicReport, type ReportInsight } from "@/lib/report-engine";
import { explainReport, deterministicNarration, type ReportNarration } from "@/lib/report-explain";

const severityTone: Record<ReportInsight["severity"], string> = {
  critical: "border-destructive/40 bg-destructive/5",
  warning: "border-gold/40 bg-gold/5",
  info: "border-border bg-muted/40",
  positive: "border-primary/40 bg-primary/5",
};

export function AiFinancialReportCard() {
  const [period, setPeriod] = useState<ReportPeriodType>("monthly");
  const [openSections, setOpenSections] = useState(false);
  const [narration, setNarration] = useState<ReportNarration | null>(null);
  const [loading, setLoading] = useState(false);
  const reqRef = useRef(0);

  const { data: txs = [] } = useTransactions();
  const { data: categories = [] } = useCategories();
  const { data: budgets = [] } = useBudgets(monthKey());
  const { data: loans = [] } = useLoans();
  const { data: profile } = useProfile();
  const { settings } = useSalarySettings();

  const goals = useMemo(() => readStoredGoals(), []);

  const snapshot = useMemo(
    () =>
      buildReportSnapshot({
        transactions: txs,
        categories,
        budgets,
        loans,
        salarySettings: settings,
        goals,
        currency: profile?.currency ?? "INR",
        period,
      }),
    [txs, categories, budgets, loans, settings, goals, profile?.currency, period],
  );

  const report = useMemo(() => buildDeterministicReport(snapshot), [snapshot]);

  // Cache key so the AI call only re-runs when the verified numbers change.
  const signature = useMemo(
    () =>
      report.available
        ? JSON.stringify([period, snapshot.totalSpent, snapshot.salary, snapshot.score, report.insights.map((i) => i.code)])
        : "unavailable",
    [report, snapshot, period],
  );

  useEffect(() => {
    if (!report.available) {
      setNarration(null);
      return;
    }
    const id = ++reqRef.current;
    setNarration(deterministicNarration(report));
    setLoading(true);
    explainReport(report, snapshot)
      .then((n) => {
        if (reqRef.current === id) setNarration(n);
      })
      .finally(() => {
        if (reqRef.current === id) setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  const periodToggle = (
    <div className="flex rounded-lg border border-border p-0.5">
      {(["weekly", "monthly"] as ReportPeriodType[]).map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => setPeriod(p)}
          className={`rounded-md px-3 py-1 text-xs font-medium capitalize transition ${
            period === p ? "bg-primary text-primary-foreground" : "text-muted-foreground"
          }`}
        >
          {p}
        </button>
      ))}
    </div>
  );

  return (
    <Card className="shadow-soft">
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
        <CardTitle className="flex items-center gap-2 font-display text-base">
          <Sparkles className="h-4 w-4 text-gold" /> AI Financial Report
        </CardTitle>
        {periodToggle}
      </CardHeader>

      <CardContent className="space-y-4">
        {!report.available ? (
          <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
            <p>{report.message}</p>
            {report.missing.length > 0 && (
              <p className="mt-1 text-xs">Missing: {report.missing.join(", ")}.</p>
            )}
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="text-[11px]">{snapshot.period.label}</Badge>
              <Badge variant="outline" className="text-[11px] capitalize">
                Confidence: {report.confidence}
              </Badge>
              <Badge variant="outline" className="text-[11px]">
                {narration?.source === "ai" ? "AI explained" : "FinTrackr calculated"}
              </Badge>
              {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
            </div>

            {narration?.summary && (
              <p className="rounded-lg border-l-4 border-primary bg-primary/5 px-3 py-2 text-sm">
                {narration.summary}
              </p>
            )}

            {(narration?.highlights.length ?? 0) > 0 && (
              <ul className="space-y-2">
                {narration!.highlights.map((h, i) => (
                  <li
                    key={i}
                    className={`rounded-lg border px-3 py-2 text-sm ${severityTone[report.insights[i]?.severity ?? "info"]}`}
                  >
                    {h}
                  </li>
                ))}
              </ul>
            )}

            {report.recommendations.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Recommended actions
                </p>
                {report.recommendations.map((r, i) => (
                  <div key={r.from + i} className="rounded-lg border border-border p-3">
                    <p className="text-sm">{narration?.actions[i] ?? r.text}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{r.impactText}</p>
                  </div>
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={() => setOpenSections((v) => !v)}
              className="flex w-full items-center justify-between rounded-lg border border-border px-3 py-2 text-sm font-medium"
            >
              <span>How FinTrackr calculated this</span>
              <ChevronDown className={`h-4 w-4 transition ${openSections ? "rotate-180" : ""}`} />
            </button>

            {openSections && (
              <div className="space-y-3">
                {report.sections.map((s) => (
                  <div key={s.id}>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{s.title}</p>
                    <ul className="mt-1 space-y-1">
                      {s.lines.map((l, i) => (
                        <li key={i} className="text-sm text-muted-foreground">• {l}</li>
                      ))}
                    </ul>
                  </div>
                ))}
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Data used</p>
                  <p className="mt-1 text-sm text-muted-foreground">{report.dataUsed.join(", ")}</p>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <ShieldCheck className="h-3.5 w-3.5" />
                Numbers are calculated by FinTrackr; AI only explains them.
              </p>
              <Button
                size="sm"
                variant="ghost"
                disabled={loading}
                onClick={() => {
                  const id = ++reqRef.current;
                  setLoading(true);
                  explainReport(report, snapshot)
                    .then((n) => reqRef.current === id && setNarration(n))
                    .finally(() => reqRef.current === id && setLoading(false));
                }}
              >
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Refresh
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
