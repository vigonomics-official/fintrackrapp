import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Sparkles, TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp,
  CheckCircle2, AlertTriangle, Trophy, Info, MessageSquare, X, ListPlus,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/finance/PageHeader";
import { PageShell, PageContainer } from "@/components/finance/PageContainer";
import { useTransactions, useCategories, useBudgets, useLoans, useProfile } from "@/hooks/use-finance";
import { getFinancialProfile } from "@/lib/financial-profile";
import { enqueuePlannerTask } from "@/lib/coach-plan";
import { buildBehaviorReport, type AiInsight, type TrendDir } from "@/lib/behavior-insights";
import { formatCurrency } from "@/lib/currency";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/insights/behavior")({
  component: BehaviorPage,
  head: () => ({
    meta: [
      { title: "Spending Behavior — FinTrackr" },
      { name: "description", content: "AI-powered spending personality, patterns, habits and predictions from your real transactions." },
      { property: "og:title", content: "Spending Behavior — FinTrackr" },
      { property: "og:description", content: "AI-powered spending personality, patterns, habits and predictions from your real transactions." },
      { name: "twitter:title", content: "Spending Behavior — FinTrackr" },
      { name: "twitter:description", content: "AI-powered spending personality, patterns, habits and predictions from your real transactions." },
    ],
  }),
});

const DISMISSED_KEY = "fintrackr:behavior:dismissed-insights";

function loadDismissed(): string[] {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch { return []; }
}
function saveDismissed(ids: string[]) {
  try { localStorage.setItem(DISMISSED_KEY, JSON.stringify(ids)); } catch { /* ignore */ }
}

function BehaviorPage() {
  const { data: txs = [] } = useTransactions();
  const { data: categories = [] } = useCategories();
  const { data: budgets = [] } = useBudgets(
    (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`; })(),
  );
  const { data: loans = [] } = useLoans();
  const { data: profile } = useProfile();
  const currency = profile?.currency ?? "INR";

  const monthlySalary = getFinancialProfile().monthlySalary ?? 0;

  const [dismissed, setDismissed] = useState<string[]>(() => loadDismissed());

  const report = useMemo(
    () => buildBehaviorReport({ transactions: txs, categories, budgets, loans, monthlySalary }),
    [txs, categories, budgets, loans, monthlySalary],
  );

  const dismiss = (id: string) => {
    const next = Array.from(new Set([...dismissed, id]));
    setDismissed(next);
    saveDismissed(next);
  };

  return (
    <PageShell>
      <PageHeader title="Spending Behavior" subtitle="Where your money quietly slips away" />
      <PageContainer>
        {!report.hasEnoughData ? (
          <Card className="p-5 text-center shadow-soft">
            <p className="text-sm font-semibold">Not enough data yet</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Add a few more transactions to unlock your spending personality and AI insights.
            </p>
            <div className="mt-3 flex justify-center gap-2">
              <Link to="/transactions"><Button size="sm">Add Transaction</Button></Link>
              <Link to="/import"><Button size="sm" variant="outline">Import</Button></Link>
            </div>
          </Card>
        ) : (
          <div className="space-y-4">
            <PersonalityCard report={report} />
            <PatternsCard report={report} />
            <MonthlyHabitsCard report={report} />
            <PositiveHabitsCard report={report} />
            <ImprovementsCard report={report} currency={currency} />
            <PredictionCard report={report} currency={currency} />
            <TimelineCard report={report} currency={currency} />
            <InsightsCard
              report={report}
              currency={currency}
              dismissed={dismissed}
              onDismiss={dismiss}
            />
          </div>
        )}
      </PageContainer>
    </PageShell>
  );
}

// ---------- Section 1 ----------
function PersonalityCard({ report }: { report: ReturnType<typeof buildBehaviorReport> }) {
  const p = report.personality;
  return (
    <Card className="overflow-hidden p-4 shadow-soft">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Sparkles className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Spending Personality</p>
          <p className="mt-0.5 font-display text-lg font-bold text-foreground">{p.type}</p>
          <div className="mt-1.5 flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary" style={{ width: `${p.confidence}%` }} />
            </div>
            <span className="text-xs font-medium text-muted-foreground">{p.confidence}% confidence</span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">{p.explanation}</p>
        </div>
      </div>
    </Card>
  );
}

// ---------- Section 2 ----------
function TrendIcon({ dir }: { dir: TrendDir }) {
  if (dir === "up") return <TrendingUp className="h-3.5 w-3.5 text-destructive" />;
  if (dir === "down") return <TrendingDown className="h-3.5 w-3.5 text-success" />;
  return <Minus className="h-3.5 w-3.5 text-muted-foreground" />;
}

function PatternsCard({ report }: { report: ReturnType<typeof buildBehaviorReport> }) {
  return (
    <Card className="p-4 shadow-soft">
      <p className="mb-3 font-display text-sm font-semibold">Spending Patterns</p>
      <div className="space-y-2.5">
        {report.patterns.map((p) => (
          <div key={p.key} className="rounded-lg border bg-muted/20 p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-sm font-medium">{p.label}</p>
              <div className="flex items-center gap-1.5">
                <TrendIcon dir={p.trend} />
                <span className="text-xs font-semibold">{p.percentage}%</span>
              </div>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary/70" style={{ width: `${Math.min(100, p.percentage)}%` }} />
            </div>
            <p className="mt-1.5 text-[11px] text-muted-foreground">{p.reason}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ---------- Section 3 ----------
function MonthlyHabitsCard({ report }: { report: ReturnType<typeof buildBehaviorReport> }) {
  if (report.monthlyHabits.length === 0) {
    return (
      <Card className="p-4 shadow-soft">
        <p className="mb-1 font-display text-sm font-semibold">Monthly Habits</p>
        <p className="text-xs text-muted-foreground">No notable habit shifts detected this month.</p>
      </Card>
    );
  }
  return (
    <Card className="p-4 shadow-soft">
      <p className="mb-3 font-display text-sm font-semibold">Monthly Habits</p>
      <ul className="space-y-2">
        {report.monthlyHabits.map((h, i) => (
          <li key={i} className="flex items-start gap-2 text-xs">
            <span className={cn(
              "mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full",
              h.tone === "positive" ? "bg-success" : h.tone === "negative" ? "bg-destructive" : "bg-muted-foreground",
            )} />
            <span>{h.text}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

// ---------- Section 4 ----------
function PositiveHabitsCard({ report }: { report: ReturnType<typeof buildBehaviorReport> }) {
  if (report.positiveHabits.length === 0) {
    return (
      <Card className="p-4 shadow-soft">
        <p className="mb-1 font-display text-sm font-semibold">Positive Habits</p>
        <p className="text-xs text-muted-foreground">Keep tracking — positive habits will appear as your routine builds up.</p>
      </Card>
    );
  }
  return (
    <Card className="p-4 shadow-soft">
      <p className="mb-3 font-display text-sm font-semibold">Positive Habits</p>
      <div className="grid gap-2">
        {report.positiveHabits.map((h) => (
          <div key={h.key} className="flex items-start gap-2 rounded-lg border border-success/20 bg-success/5 p-2.5">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
            <div className="min-w-0">
              <p className="text-sm font-medium">{h.title}</p>
              <p className="text-[11px] text-muted-foreground">{h.detail}</p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ---------- Section 5 ----------
function ImprovementsCard({
  report, currency,
}: { report: ReturnType<typeof buildBehaviorReport>; currency: string }) {
  if (report.improvements.length === 0) {
    return (
      <Card className="p-4 shadow-soft">
        <p className="mb-1 font-display text-sm font-semibold">Habits to Improve</p>
        <p className="text-xs text-muted-foreground">Nothing urgent to fix — your spending mix looks healthy.</p>
      </Card>
    );
  }
  return (
    <Card className="p-4 shadow-soft">
      <p className="mb-3 font-display text-sm font-semibold">Habits to Improve</p>
      <div className="space-y-2.5">
        {report.improvements.map((imp) => (
          <div key={imp.key} className="rounded-lg border border-destructive/20 bg-destructive/5 p-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
              <p className="text-sm">{imp.problem}</p>
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2 text-center">
              <Stat label="Save/mo" value={formatCurrency(imp.estimatedMonthlySaving, currency)} />
              <Stat label="Difficulty" value={imp.difficulty} />
              <Stat label="Score" value={`+${imp.scoreBoost}`} />
            </div>
            <div className="mt-2 flex justify-end">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  enqueuePlannerTask({ id: `behavior-imp-${imp.key}`, title: imp.action, detail: `Save ~${formatCurrency(imp.estimatedMonthlySaving, currency)}/mo` });
                  toast.success("Added to Planner");
                }}
              >
                <ListPlus className="mr-1 h-3.5 w-3.5" /> {imp.action}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-background/70 p-2">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-xs font-semibold">{value}</p>
    </div>
  );
}

// ---------- Section 6 ----------
function PredictionCard({
  report, currency,
}: { report: ReturnType<typeof buildBehaviorReport>; currency: string }) {
  const p = report.prediction;
  const riskTone =
    p.overspendRisk === "High" ? "text-destructive" :
    p.overspendRisk === "Medium" ? "text-gold-foreground" : "text-success";
  return (
    <Card className="p-4 shadow-soft">
      <div className="mb-3 flex items-center justify-between">
        <p className="font-display text-sm font-semibold">Next Month Prediction</p>
        <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
          {p.confidence}% confidence
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Stat label="Predicted Spend" value={formatCurrency(p.nextMonthSpend, currency)} />
        <Stat label="Expected Savings" value={formatCurrency(p.expectedSavings, currency)} />
        <Stat label="Top Category" value={p.highestCategory ?? "—"} />
        <Stat label="Survival Score" value={`${p.expectedSurvivalScore}/100`} />
      </div>
      <p className={cn("mt-2 text-xs font-medium", riskTone)}>
        Overspending risk: {p.overspendRisk}
      </p>
    </Card>
  );
}

// ---------- Section 7 ----------
function TimelineCard({
  report, currency,
}: { report: ReturnType<typeof buildBehaviorReport>; currency: string }) {
  return (
    <Card className="p-4 shadow-soft">
      <p className="mb-3 font-display text-sm font-semibold">Smart Timeline</p>
      <ol className="relative space-y-3 border-l border-border pl-4">
        {report.timeline.map((w) => (
          <li key={w.weekLabel} className="relative">
            <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-primary" />
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-sm font-semibold">{w.weekLabel} <span className="text-[11px] font-normal text-muted-foreground">· {w.range}</span></p>
              <p className="text-xs font-medium">{formatCurrency(w.spend, currency)}</p>
            </div>
            <p className="text-[11px] text-muted-foreground">{w.note}</p>
          </li>
        ))}
      </ol>
    </Card>
  );
}

// ---------- Section 8/9 ----------
function InsightsCard({
  report, currency, dismissed, onDismiss,
}: {
  report: ReturnType<typeof buildBehaviorReport>;
  currency: string;
  dismissed: string[];
  onDismiss: (id: string) => void;
}) {
  const visible = report.insights.filter((i) => !dismissed.includes(i.id));
  if (visible.length === 0) {
    return (
      <Card className="p-4 shadow-soft">
        <p className="mb-1 font-display text-sm font-semibold">AI Insights</p>
        <p className="text-xs text-muted-foreground">
          {report.insights.length === 0 ? "No new personalized insights right now." : "You've dismissed all insights for now."}
        </p>
      </Card>
    );
  }
  return (
    <Card className="p-4 shadow-soft">
      <div className="mb-3 flex items-center gap-2">
        <Trophy className="h-4 w-4 text-primary" />
        <p className="font-display text-sm font-semibold">AI Insights</p>
      </div>
      <div className="space-y-2.5">
        {visible.map((insight) => (
          <InsightRow key={insight.id} insight={insight} currency={currency} onDismiss={() => onDismiss(insight.id)} />
        ))}
      </div>
    </Card>
  );
}

function InsightRow({
  insight, onDismiss,
}: { insight: AiInsight; currency: string; onDismiss: () => void }) {
  const [expanded, setExpanded] = useState(false);
  useEffect(() => { /* keep hook to satisfy eslint if extended later */ }, []);

  return (
    <div className="rounded-lg border bg-muted/20 p-3">
      <div className="flex items-start gap-2">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <p className="flex-1 text-sm">{insight.text}</p>
      </div>

      {expanded && (
        <p className="mt-2 rounded-md bg-background/70 p-2 text-xs text-muted-foreground">{insight.detail}</p>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setExpanded((v) => !v)}>
          {expanded ? <ChevronUp className="mr-1 h-3.5 w-3.5" /> : <ChevronDown className="mr-1 h-3.5 w-3.5" />}
          Explain
        </Button>
        <Link to="/insights/ai-coach">
          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs">
            <MessageSquare className="mr-1 h-3.5 w-3.5" /> Ask AI Coach
          </Button>
        </Link>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-xs"
          onClick={() => {
            enqueuePlannerTask({ id: `behavior-${insight.id}`, title: insight.plannerTitle, detail: insight.plannerDetail });
            toast.success("Added to Planner");
          }}
        >
          <ListPlus className="mr-1 h-3.5 w-3.5" /> Apply to Planner
        </Button>
        <Button size="sm" variant="ghost" className="ml-auto h-7 px-2 text-xs text-muted-foreground" onClick={onDismiss}>
          <X className="mr-1 h-3.5 w-3.5" /> Dismiss
        </Button>
      </div>
    </div>
  );
}
