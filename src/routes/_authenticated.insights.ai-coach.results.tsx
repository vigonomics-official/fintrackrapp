import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Sparkles, TrendingUp, AlertTriangle, Target, Lightbulb } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { PageShell, PageContainer } from "@/components/finance/PageContainer";
import { useProfile } from "@/hooks/use-finance";
import { formatCurrency } from "@/lib/currency";
import { analyzeMock, type CoachAnalysisInput, type CoachAnalysisResult } from "@/lib/ai-coach-analysis";
import { COACH_INPUT_STORAGE_KEY } from "@/components/finance/AnalyzeForm";

export const Route = createFileRoute("/_authenticated/insights/ai-coach/results")({
  component: ResultsPage,
  head: () => ({ meta: [{ title: "AI Analysis Results — FinTrackr" }] }),
});

function ResultsPage() {
  const navigate = useNavigate();
  const { data: profile } = useProfile();
  const currency = profile?.currency ?? "INR";
  const [state, setState] = useState<{ input: CoachAnalysisInput; result: CoachAnalysisResult } | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(COACH_INPUT_STORAGE_KEY);
      if (!raw) {
        setMissing(true);
        return;
      }
      const input = JSON.parse(raw) as CoachAnalysisInput;
      // NOTE: mock analysis. Swap for Gemini call here — keep same result shape.
      setState({ input, result: analyzeMock(input) });
    } catch {
      setMissing(true);
    }
  }, []);

  if (missing) {
    return (
      <PageShell>
        <Header />
        <PageContainer>
          <Card className="p-6 text-center shadow-soft">
            <p className="font-display text-sm font-semibold">No analysis data</p>
            <p className="mt-1 text-xs text-muted-foreground">Fill in the form to run an analysis.</p>
            <Button className="mt-4" onClick={() => navigate({ to: "/insights/ai-coach" })}>
              Go to Analyze
            </Button>
          </Card>
        </PageContainer>
      </PageShell>
    );
  }

  if (!state) {
    return (
      <PageShell>
        <Header />
        <PageContainer>
          <Card className="p-6 text-center text-sm text-muted-foreground shadow-soft">Analyzing…</Card>
        </PageContainer>
      </PageShell>
    );
  }

  const { result } = state;
  const scoreTone =
    result.healthScore >= 70 ? "text-success" : result.healthScore >= 40 ? "text-gold" : "text-destructive";

  return (
    <PageShell>
      <Header />
      <PageContainer>
        <div className="space-y-3">
          <Card className="p-4 shadow-soft sm:p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary/10">
                <Sparkles className="h-6 w-6 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground">Financial Health Score</p>
                <p className={`font-display text-3xl font-bold ${scoreTone}`}>{result.healthScore}<span className="text-base text-muted-foreground">/100</span></p>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Stat label="Monthly Surplus" value={formatCurrency(result.monthlySurplus, currency)} tone={result.monthlySurplus >= 0 ? "success" : "danger"} />
              <Stat label="Savings Rate" value={`${result.savingsRate.toFixed(0)}%`} tone={result.savingsRate >= 20 ? "success" : "warn"} />
              <Stat label="Total Expenses" value={formatCurrency(result.totalExpenses, currency)} />
              <Stat label="EMI Ratio" value={`${result.emiRatio.toFixed(0)}%`} tone={result.emiRatio >= 40 ? "danger" : result.emiRatio >= 20 ? "warn" : "success"} />
            </div>
          </Card>

          {result.breakdown.length > 0 && (
            <Section icon={<TrendingUp className="h-4 w-4" />} title="Where your money goes">
              <div className="space-y-2.5">
                {result.breakdown.map((b) => (
                  <div key={b.label} className="min-w-0">
                    <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                      <span className="truncate font-medium">{b.label}</span>
                      <span className="shrink-0 text-muted-foreground">
                        {formatCurrency(b.amount, currency)} · {b.pct.toFixed(0)}%
                      </span>
                    </div>
                    <Progress value={b.pct} className="h-1.5" />
                  </div>
                ))}
              </div>
            </Section>
          )}

          {result.highlights.length > 0 && (
            <Section icon={<Sparkles className="h-4 w-4 text-success" />} title="Highlights">
              <List items={result.highlights} />
            </Section>
          )}

          {result.risks.length > 0 && (
            <Section icon={<AlertTriangle className="h-4 w-4 text-destructive" />} title="Risks">
              <List items={result.risks} />
            </Section>
          )}

          <Section icon={<Lightbulb className="h-4 w-4 text-gold" />} title="Recommendations">
            <List items={result.recommendations} />
          </Section>

          <Section icon={<Target className="h-4 w-4 text-primary" />} title={`Goal · ${result.goalPlan.title}`}>
            <div className="space-y-1 text-sm">
              <p><span className="text-muted-foreground">Monthly target:</span> <b>{formatCurrency(result.goalPlan.monthlyTarget, currency)}</b></p>
              {result.goalPlan.etaMonths > 0 && (
                <p><span className="text-muted-foreground">ETA:</span> <b>~{result.goalPlan.etaMonths} months</b></p>
              )}
              <p className="text-xs text-muted-foreground">{result.goalPlan.note}</p>
            </div>
          </Section>

          <Button variant="outline" className="w-full" onClick={() => navigate({ to: "/insights/ai-coach" })}>
            Edit inputs & re-analyze
          </Button>
        </div>
      </PageContainer>
    </PageShell>
  );
}

function Header() {
  return (
    <div className="flex flex-wrap items-center gap-3 border-b bg-card/40 px-4 py-4 backdrop-blur md:px-10 md:py-6">
      <Link
        to="/insights/ai-coach"
        aria-label="Back to AI Salary Survival Coach"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border bg-background transition-colors hover:bg-muted"
      >
        <ArrowLeft className="h-4 w-4" />
      </Link>
      <div className="min-w-0 flex-1">
        <h1 className="flex items-center gap-1.5 truncate font-display text-lg font-bold tracking-tight md:text-2xl">
          <Sparkles className="h-4 w-4 shrink-0 text-primary md:h-5 md:w-5" />
          <span className="truncate">AI Analysis Results</span>
        </h1>
        <p className="mt-0.5 text-xs text-muted-foreground md:text-sm">Based on the numbers you shared.</p>
      </div>
    </div>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <Card className="p-4 shadow-soft sm:p-5">
      <div className="mb-3 flex items-center gap-2">
        {icon}
        <p className="font-display text-sm font-semibold">{title}</p>
      </div>
      {children}
    </Card>
  );
}

function List({ items }: { items: string[] }) {
  return (
    <ul className="space-y-1.5 text-sm">
      {items.map((it, i) => (
        <li key={i} className="flex gap-2">
          <span className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
          <span className="min-w-0">{it}</span>
        </li>
      ))}
    </ul>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "success" | "warn" | "danger" }) {
  const color = tone === "success" ? "text-success" : tone === "warn" ? "text-gold" : tone === "danger" ? "text-destructive" : "text-foreground";
  return (
    <div className="rounded-lg border bg-background/60 p-2.5">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-0.5 font-display text-sm font-semibold ${color}`}>{value}</p>
    </div>
  );
}
