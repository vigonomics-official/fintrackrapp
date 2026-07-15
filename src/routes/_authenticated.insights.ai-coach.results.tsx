import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Sparkles,
  TrendingUp,
  AlertTriangle,
  Target,
  Lightbulb,
  ListChecks,
  CalendarDays,
  Trophy,
  Heart,
  HelpCircle,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { PageShell, PageContainer } from "@/components/finance/PageContainer";
import { useProfile } from "@/hooks/use-finance";
import { formatCurrency } from "@/lib/currency";
import {
  analyzeMock,
  type CoachAnalysisInput,
  type CoachAnalysisResult,
  type RiskLevel,
} from "@/lib/ai-coach-analysis";
import { COACH_INPUT_STORAGE_KEY } from "@/components/finance/AnalyzeForm";
import { DataConfidenceCard } from "@/components/finance/DataConfidenceCard";
import { computeConfidence, COACH_CONFIDENCE_MISSING_KEY } from "@/lib/coach-confidence";

const COACH_OPEN_FORM_KEY = "fintrackr:ai-coach:open-form";

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
      // NOTE: mock analysis. Swap `analyzeMock` for a Gemini-backed provider —
      // the result shape is contract-frozen so the UI stays untouched.
      setState({ input, result: analyzeMock(input) });
    } catch {
      setMissing(true);
    }
  }, []);

  const goToAnalyzeForm = (missingKeys: string[] = []) => {
    try {
      sessionStorage.setItem(COACH_OPEN_FORM_KEY, "1");
      sessionStorage.setItem(COACH_CONFIDENCE_MISSING_KEY, JSON.stringify(missingKeys));
    } catch {
      /* ignore */
    }
    navigate({ to: "/insights/ai-coach" });
  };

  if (missing) {
    const emptyConfidence = computeConfidence(null);
    return (
      <PageShell>
        <Header />
        <PageContainer>
          <div className="space-y-3">
            <DataConfidenceCard
              confidence={emptyConfidence}
              onStart={() => navigate({ to: "/insights/ai-coach" })}
            />
          </div>
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

  const completionLabel = new Date(result.goalForecast.estimatedCompletion).toLocaleDateString(undefined, {
    month: "short",
    year: "numeric",
  });

  return (
    <PageShell>
      <Header />
      <PageContainer>
        <div className="space-y-3">
          {/* Data confidence — how much of the required data we have */}
          <DataConfidenceCard
            confidence={computeConfidence(state.input)}
            onImprove={() =>
              goToAnalyzeForm(
                computeConfidence(state.input).missing.map((m) => String(m.key)),
              )
            }
          />

          {/* Health score + key stats */}
          <Card className="p-4 shadow-soft sm:p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary/10">
                <Sparkles className="h-6 w-6 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground">Financial Health Score</p>
                <p className={`font-display text-3xl font-bold ${scoreTone}`}>
                  {result.healthScore}
                  <span className="text-base text-muted-foreground">/100</span>
                </p>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Stat
                label="Monthly Surplus"
                value={formatCurrency(result.monthlySurplus, currency)}
                tone={result.monthlySurplus >= 0 ? "success" : "danger"}
              />
              <Stat
                label="Savings Rate"
                value={`${result.savingsRate.toFixed(0)}%`}
                tone={result.savingsRate >= 20 ? "success" : "warn"}
              />
              <Stat label="Total Expenses" value={formatCurrency(result.totalExpenses, currency)} />
              <Stat
                label="EMI Ratio"
                value={`${result.emiRatio.toFixed(0)}%`}
                tone={result.emiRatio >= 40 ? "danger" : result.emiRatio >= 20 ? "warn" : "success"}
              />
            </div>
          </Card>

          {/* Overall summary */}
          <Section icon={<Sparkles className="h-4 w-4 text-primary" />} title="Overall Summary">
            <p className="text-sm leading-relaxed text-foreground/90">{result.summary}</p>
          </Section>

          {/* Top 3 priorities */}
          <Section icon={<ListChecks className="h-4 w-4 text-primary" />} title="Top 3 Priorities">
            <ol className="space-y-2.5">
              {result.priorities.map((p, i) => (
                <li key={i} className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
                    {i + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{p.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{p.detail}</p>
                  </div>
                </li>
              ))}
            </ol>
          </Section>

          {/* Where money goes */}
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

          {/* Risk analysis */}
          <Section icon={<AlertTriangle className="h-4 w-4 text-destructive" />} title="Risk Analysis">
            <div className="space-y-2">
              {result.risks.map((r) => (
                <div key={r.key} className="rounded-lg border bg-background/60 p-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium">{r.label}</p>
                    <RiskBadge level={r.level} />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{r.explanation}</p>
                </div>
              ))}
            </div>
          </Section>

          {/* Opportunity */}
          <Section icon={<Lightbulb className="h-4 w-4 text-gold" />} title="Opportunity">
            <p className="text-sm font-medium">{result.opportunity.title}</p>
            <p className="mt-1 text-xs text-muted-foreground">{result.opportunity.detail}</p>
            <p className="mt-2 text-sm">
              Potential savings:{" "}
              <b className="text-success">
                {formatCurrency(result.opportunity.potentialSavings, currency)}
              </b>{" "}
              <span className="text-xs text-muted-foreground">/ {result.opportunity.timeframe}</span>
            </p>
          </Section>

          {/* Goal forecast */}
          <Section icon={<Target className="h-4 w-4 text-primary" />} title={`Goal Forecast · ${result.goalForecast.goal}`}>
            <div className="grid grid-cols-2 gap-2">
              <Stat label="Monthly Target" value={formatCurrency(result.goalForecast.monthlyTarget, currency)} />
              <Stat label="Est. Completion" value={completionLabel} />
              <Stat label="Target Amount" value={formatCurrency(result.goalForecast.targetAmount, currency)} />
              <Stat
                label="Confidence"
                value={`${result.goalForecast.confidence}%`}
                tone={result.goalForecast.confidence >= 70 ? "success" : result.goalForecast.confidence >= 40 ? "warn" : "danger"}
              />
            </div>
            <div className="mt-3">
              <Progress value={result.goalForecast.confidence} className="h-1.5" />
              <p className="mt-2 text-xs text-muted-foreground">{result.goalForecast.note}</p>
            </div>
          </Section>

          {/* Weekly plan */}
          <Section icon={<CalendarDays className="h-4 w-4 text-primary" />} title="Weekly Action Plan">
            <ul className="space-y-2">
              {result.weeklyPlan.map((d) => (
                <li key={d.day} className="flex gap-3 rounded-lg border bg-background/60 p-2.5">
                  <span className="w-16 shrink-0 text-[11px] font-semibold uppercase tracking-wide text-primary">
                    {d.day}
                  </span>
                  <span className="min-w-0 text-xs text-foreground/90">{d.task}</span>
                </li>
              ))}
            </ul>
          </Section>

          {/* Monthly challenge */}
          <Section icon={<Trophy className="h-4 w-4 text-gold" />} title="Monthly Challenge">
            <p className="font-display text-sm font-semibold">{result.monthlyChallenge.title}</p>
            <p className="mt-1 text-xs text-muted-foreground">{result.monthlyChallenge.description}</p>
            <p className="mt-2 text-sm">
              Potential savings:{" "}
              <b className="text-success">
                {formatCurrency(result.monthlyChallenge.potentialSavings, currency)}
              </b>
            </p>
          </Section>

          {/* Motivation */}
          <Card className="p-4 shadow-soft sm:p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Heart className="h-4 w-4" />
              </div>
              <p className="min-w-0 text-sm font-medium italic text-foreground/90">“{result.motivation}”</p>
            </div>
          </Card>

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
        <p className="mt-0.5 text-xs text-muted-foreground md:text-sm">
          Personalized coaching based on your numbers.
        </p>
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

function Stat({ label, value, tone }: { label: string; value: string; tone?: "success" | "warn" | "danger" }) {
  const color =
    tone === "success"
      ? "text-success"
      : tone === "warn"
        ? "text-gold"
        : tone === "danger"
          ? "text-destructive"
          : "text-foreground";
  return (
    <div className="rounded-lg border bg-background/60 p-2.5">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-0.5 font-display text-sm font-semibold ${color}`}>{value}</p>
    </div>
  );
}

function RiskBadge({ level }: { level: RiskLevel }) {
  const tone =
    level === "Low"
      ? "bg-success/10 text-success"
      : level === "Medium"
        ? "bg-gold/10 text-gold"
        : "bg-destructive/10 text-destructive";
  return (
    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${tone}`}>
      {level}
    </span>
  );
}
