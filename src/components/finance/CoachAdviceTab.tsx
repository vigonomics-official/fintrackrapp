import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Sparkles,
  Lightbulb,
  ThumbsUp,
  AlertTriangle,
  Zap,
  Bookmark,
  BookmarkCheck,
  X,
  ClipboardList,
  ArrowRight,
  ChevronDown,
  CheckCircle2,
  Clock,
  TrendingUp,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { formatCurrency } from "@/lib/currency";
import { COACH_INPUT_STORAGE_KEY } from "@/components/finance/AnalyzeForm";
import type { CoachAnalysisInput } from "@/lib/ai-coach-analysis";
import { analyzeMock } from "@/lib/ai-coach-analysis";
import {
  generateAdviceMock,
  COACH_ADVICE_SAVED_KEY,
  COACH_ADVICE_DISMISSED_KEY,
  type Difficulty,
  type Priority,
  type Recommendation,
} from "@/lib/coach-advice";

function readInput(): CoachAnalysisInput | null {
  try {
    const raw = sessionStorage.getItem(COACH_INPUT_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CoachAnalysisInput;
  } catch {
    return null;
  }
}

function readSet(key: string): Set<string> {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as string[];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function writeSet(key: string, set: Set<string>) {
  try {
    localStorage.setItem(key, JSON.stringify(Array.from(set)));
  } catch {
    /* ignore */
  }
}

const priorityStyles: Record<Priority, string> = {
  High: "border-destructive/40 bg-destructive/10 text-destructive",
  Medium: "border-gold/40 bg-gold/10 text-gold",
  Low: "border-primary/40 bg-primary/10 text-primary",
};

const difficultyStyles: Record<Difficulty, string> = {
  Easy: "border-primary/30 bg-primary/10 text-primary",
  Medium: "border-gold/40 bg-gold/10 text-gold",
  Hard: "border-destructive/40 bg-destructive/10 text-destructive",
};

export function CoachAdviceTab({
  onGoToAnalyze,
  isActive = true,
  analysisInput,
}: {
  onGoToAnalyze: () => void;
  isActive?: boolean;
  analysisInput?: CoachAnalysisInput | null;
}) {
  const navigate = useNavigate();
  const [input, setInput] = useState<CoachAnalysisInput | null>(analysisInput ?? null);
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  // Re-read the most recent analysis whenever the tab becomes active or the
  // shared input changes. This keeps Analyze / Advice / Plan in sync without
  // requiring the user to re-run the analysis.
  useEffect(() => {
    if (analysisInput) {
      setInput(analysisInput);
    } else {
      setInput(readInput());
    }
  }, [analysisInput, isActive]);

  useEffect(() => {
    setSaved(readSet(COACH_ADVICE_SAVED_KEY));
    setDismissed(readSet(COACH_ADVICE_DISMISSED_KEY));
  }, []);

  const advice = useMemo(() => (input ? generateAdviceMock(input) : null), [input]);

  const toggleSave = (id: string) => {
    setSaved((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      writeSet(COACH_ADVICE_SAVED_KEY, next);
      return next;
    });
  };
  const dismiss = (id: string) => {
    setDismissed((prev) => {
      const next = new Set(prev);
      next.add(id);
      writeSet(COACH_ADVICE_DISMISSED_KEY, next);
      return next;
    });
  };
  const applyToPlanner = () => navigate({ to: "/planner" });

  if (!advice) {
    return (
      <Card className="flex flex-col items-center gap-3 p-6 text-center shadow-soft">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Sparkles className="h-5 w-5" />
        </div>
        <div className="space-y-1">
          <p className="font-display text-sm font-semibold">No advice yet</p>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Run your Salary Analysis first to receive personalized advice.
          </p>
        </div>
        <Button size="sm" onClick={onGoToAnalyze}>
          Analyze Now
        </Button>
      </Card>
    );
  }

  const visibleRecs = advice.recommendations.filter((r) => !dismissed.has(r.id));

  return (
    <div className="space-y-4">
      {/* SECTION 1 — Featured */}
      <Card className="border-primary/30 bg-primary/5 p-4 shadow-soft">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-lg">
            {advice.featured.icon}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <p className="font-display text-xs font-semibold uppercase tracking-wide text-primary">
                Today's AI Advice
              </p>
              <Badge variant="outline" className={`h-5 px-1.5 text-[10px] ${priorityStyles[advice.featured.priority]}`}>
                {advice.featured.priority} Priority
              </Badge>
            </div>
            <p className="mt-1.5 text-sm leading-relaxed">{advice.featured.message}</p>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
              <span className="font-medium text-foreground/80">Why:</span> {advice.featured.why}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
              <span>
                Est. savings <span className="font-semibold text-foreground">{formatCurrency(advice.featured.estimatedSavings)}</span>
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" /> {advice.featured.estimatedTime}
              </span>
              <span>
                Confidence <span className="font-semibold text-foreground">{advice.featured.confidence}%</span>
              </span>
            </div>
            <HowAiCalculated dataUsed={advice.featured.dataUsed} />
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" variant="outline" className="h-8 px-2 text-xs" onClick={() => toggleSave(advice.featured.id)}>
                {saved.has(advice.featured.id) ? (
                  <>
                    <BookmarkCheck className="mr-1 h-3.5 w-3.5" /> Saved
                  </>
                ) : (
                  <>
                    <Bookmark className="mr-1 h-3.5 w-3.5" /> Save
                  </>
                )}
              </Button>
              <Button size="sm" className="h-8 px-2 text-xs" onClick={applyToPlanner}>
                <ClipboardList className="mr-1 h-3.5 w-3.5" /> Apply to Planner
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* SECTION 2 — Top Recommendations */}
      <SectionHeader icon={<Lightbulb className="h-4 w-4 text-primary" />} title="Top Recommendations" />
      {visibleRecs.length === 0 ? (
        <Card className="p-4 text-center text-xs text-muted-foreground shadow-soft">
          You've cleared all recommendations. Great work!
        </Card>
      ) : (
        <div className="space-y-2">
          {visibleRecs.map((rec) => (
            <RecommendationCard
              key={rec.id}
              rec={rec}
              input={input!}
              saved={saved.has(rec.id)}
              onSave={() => toggleSave(rec.id)}
              onDismiss={() => dismiss(rec.id)}
              onApply={applyToPlanner}
            />
          ))}
        </div>
      )}

      {/* SECTION 3 & 4 side by side on wider screens */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <ListCard
          icon={<ThumbsUp className="h-4 w-4 text-primary" />}
          title="Good Habits"
          items={advice.goodHabits.map((h) => h.text)}
          tone="positive"
        />
        <ListCard
          icon={<AlertTriangle className="h-4 w-4 text-gold" />}
          title="Things to Improve"
          items={advice.improvements.map((h) => h.text)}
          tone="warning"
        />
      </div>

      {/* SECTION 5 — Quick Wins */}
      <SectionHeader icon={<Zap className="h-4 w-4 text-primary" />} title="Quick Wins" />
      <Card className="p-3 shadow-soft">
        <ul className="divide-y">
          {advice.quickWins.map((q) => (
            <li key={q.id} className="flex items-center gap-2 py-2 text-xs">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <ArrowRight className="h-3 w-3" />
              </span>
              <span className="min-w-0 flex-1 leading-relaxed">{q.text}</span>
            </li>
          ))}
        </ul>
      </Card>

      {/* SECTION 6 — Motivation */}
      <Card className="border-primary/30 bg-primary/5 p-4 text-center shadow-soft">
        <Sparkles className="mx-auto h-5 w-5 text-primary" />
        <p className="mt-2 text-sm font-medium leading-relaxed">{advice.motivation}</p>
      </Card>
    </div>
  );
}

function SectionHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-1.5 px-0.5">
      {icon}
      <h2 className="font-display text-sm font-semibold">{title}</h2>
    </div>
  );
}

function RecommendationCard({
  rec,
  input,
  saved,
  onSave,
  onDismiss,
  onApply,
}: {
  rec: Recommendation;
  input: CoachAnalysisInput;
  saved: boolean;
  onSave: () => void;
  onDismiss: () => void;
  onApply: () => void;
}) {
  const [preview, setPreview] = useState<AdviceImpactPreview | null>(null);
  const showPreview = () => setPreview(computeAdviceImpact(rec, input));
  const apply = () => {
    setPreview(computeAdviceImpact(rec, input));
    onApply();
  };

  return (
    <Card className="p-3 shadow-soft sm:p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-display text-sm font-semibold leading-snug">{rec.title}</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{rec.explanation}</p>
          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
            <span className="font-medium text-foreground/80">Why:</span> {rec.why}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
              Save {formatCurrency(rec.monthlySavings)}/mo
            </Badge>
            <Badge variant="outline" className={`h-5 px-1.5 text-[10px] ${difficultyStyles[rec.difficulty]}`}>
              {rec.difficulty}
            </Badge>
            <Badge variant="outline" className={`h-5 px-1.5 text-[10px] ${priorityStyles[rec.priority]}`}>
              {rec.priority}
            </Badge>
            <Badge variant="outline" className="h-5 px-1.5 text-[10px] text-muted-foreground">
              <Clock className="mr-1 h-3 w-3" /> {rec.estimatedTime}
            </Badge>
          </div>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss recommendation"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <HowAiCalculated dataUsed={rec.dataUsed} />
      {preview && <AdviceImpactBlock preview={preview} />}

      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" variant="outline" className="h-8 px-2 text-xs" onClick={onSave}>
          {saved ? (
            <>
              <BookmarkCheck className="mr-1 h-3.5 w-3.5" /> Saved
            </>
          ) : (
            <>
              <Bookmark className="mr-1 h-3.5 w-3.5" /> Save
            </>
          )}
        </Button>
        <Button size="sm" variant="outline" className="h-8 px-2 text-xs" onClick={showPreview}>
          <TrendingUp className="mr-1 h-3.5 w-3.5" /> Check Impact
        </Button>
        <Button size="sm" className="h-8 px-2 text-xs" onClick={apply}>
          <ClipboardList className="mr-1 h-3.5 w-3.5" /> Apply to Planner
        </Button>
      </div>
    </Card>
  );
}

// --- Shared helper UI ---

function HowAiCalculated({ dataUsed }: { dataUsed: string[] }) {
  const [open, setOpen] = useState(false);
  if (!dataUsed || dataUsed.length === 0) return null;
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="mt-3">
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center justify-between rounded-md bg-muted/40 px-2 py-1.5 text-left text-[11px] font-medium text-foreground/80 transition-colors hover:bg-muted"
        >
          <span>How AI calculated this</span>
          <ChevronDown className={`h-3.5 w-3.5 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <ul className="mt-2 grid grid-cols-2 gap-1">
          {dataUsed.map((d) => (
            <li key={d} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <CheckCircle2 className="h-3 w-3 shrink-0 text-primary" />
              <span className="min-w-0 flex-1 truncate">{d}</span>
            </li>
          ))}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  );
}

type AdviceImpactPreview = {
  score: { current: number; projected: number };
  savings: { current: number; projected: number };
  goal: { current: string; projected: string; monthsSaved: number };
};

function computeAdviceImpact(rec: Recommendation, input: CoachAnalysisInput): AdviceImpactPreview {
  const result = analyzeMock(input);
  const boostMap: Record<Priority, number> = { High: 6, Medium: 4, Low: 2 };
  const projectedScore = Math.min(100, result.healthScore + boostMap[rec.priority]);
  const currentSavings = Math.max(0, Math.round(result.monthlySurplus));
  const projectedSavings = currentSavings + rec.monthlySavings;

  const gf = result.goalForecast;
  const remaining = Math.max(0, gf.targetAmount - 0);
  const curMonths = gf.monthlyTarget > 0 ? Math.ceil(remaining / gf.monthlyTarget) : gf.etaMonths;
  const projMonthly = gf.monthlyTarget + rec.monthlySavings;
  const projMonths = projMonthly > 0 ? Math.ceil(remaining / projMonthly) : curMonths;
  const monthsSaved = Math.max(0, curMonths - projMonths);
  const fmt = (m: number) => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() + m);
    return d.toLocaleDateString(undefined, { month: "short", year: "numeric" });
  };
  return {
    score: { current: result.healthScore, projected: projectedScore },
    savings: { current: currentSavings, projected: projectedSavings },
    goal: { current: fmt(curMonths), projected: fmt(projMonths), monthsSaved },
  };
}

function AdviceImpactBlock({ preview }: { preview: AdviceImpactPreview }) {
  const scoreUp = preview.score.projected > preview.score.current;
  const savingsUp = preview.savings.projected > preview.savings.current;
  const goalUp = preview.goal.monthsSaved > 0;
  return (
    <div className="mt-3 rounded-lg border border-success/30 bg-success/5 p-3">
      <p className="font-display text-[11px] font-semibold uppercase tracking-wide text-success">If you follow this</p>
      <div className="mt-2 space-y-2 text-[11px]">
        <ImpactRow label="Survival Score" current={`${preview.score.current}`} projected={`${preview.score.projected}`} up={scoreUp} />
        <ImpactRow label="Monthly Savings" current={formatCurrency(preview.savings.current)} projected={formatCurrency(preview.savings.projected)} up={savingsUp} />
        <ImpactRow
          label="Goal Completion"
          current={preview.goal.current}
          projected={preview.goal.projected}
          up={goalUp}
          note={goalUp ? `${preview.goal.monthsSaved} mo sooner` : undefined}
        />
      </div>
    </div>
  );
}

function ImpactRow({ label, current, projected, up, note }: { label: string; current: string; projected: string; up: boolean; note?: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5">
      <span className="text-muted-foreground">{label}</span>
      <span className="flex items-center gap-1.5 tabular-nums">
        <span className="text-muted-foreground/80 line-through">{current}</span>
        <ArrowRight className="h-3 w-3 text-muted-foreground" />
        <span className={`font-semibold ${up ? "text-success" : "text-foreground"}`}>{projected}</span>
        {note && <span className="text-[10px] text-success">({note})</span>}
      </span>
    </div>
  );
}

function ListCard({
  icon,
  title,
  items,
  tone,
}: {
  icon: React.ReactNode;
  title: string;
  items: string[];
  tone: "positive" | "warning";
}) {
  const dot = tone === "positive" ? "bg-primary" : "bg-gold";
  return (
    <Card className="p-3 shadow-soft sm:p-4">
      <div className="flex items-center gap-1.5">
        {icon}
        <h3 className="font-display text-sm font-semibold">{title}</h3>
      </div>
      <ul className="mt-2 space-y-1.5">
        {items.map((t, i) => (
          <li key={i} className="flex items-start gap-2 text-xs leading-relaxed">
            <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} />
            <span className="min-w-0 flex-1">{t}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
