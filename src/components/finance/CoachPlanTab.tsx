import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Sparkles,
  Wallet,
  Target as TargetIcon,
  TrendingUp,
  ShieldCheck,
  CalendarClock,
  CheckCircle2,
  Clock,
  AlertCircle,
  ClipboardList,
  ShoppingBag,
  ArrowRight,
  ChevronDown,
  Flame,
  Trophy,
  Zap,
  MoreHorizontal,
  Circle,
  PenLine,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/currency";
import type { CoachAnalysisInput } from "@/lib/ai-coach-analysis";
import {
  generatePlanMock,
  enqueuePlannerTask,
  evaluatePurchase,
  markBillPaid,
  unmarkBillPaid,
  computeImpactPreview,
  type MonthlyPlan,
  type BillItem,
  type BillStatus,
  type TopAction,
  type ActionPriority,
  type ActionDifficulty,
  type BuyCheckResult,
  type ImpactPreview,
} from "@/lib/coach-plan";

const priorityStyles: Record<ActionPriority, string> = {
  High: "border-destructive/40 bg-destructive/10 text-destructive",
  Medium: "border-gold/40 bg-gold/10 text-gold",
  Low: "border-primary/40 bg-primary/10 text-primary",
};

const difficultyStyles: Record<ActionDifficulty, string> = {
  Easy: "border-primary/30 bg-primary/10 text-primary",
  Medium: "border-gold/40 bg-gold/10 text-gold",
  Hard: "border-destructive/40 bg-destructive/10 text-destructive",
};

const statusStyles: Record<BillStatus, string> = {
  Upcoming: "border-primary/30 bg-primary/10 text-primary",
  "Due Today": "border-gold/40 bg-gold/10 text-gold",
  Paid: "border-success/30 bg-success/10 text-success",
};

export function CoachPlanTab({
  isActive,
  analysisInput,
  onGoToAnalyze,
}: {
  isActive: boolean;
  analysisInput: CoachAnalysisInput | null;
  onGoToAnalyze: () => void;
}) {
  const [input, setInput] = useState<CoachAnalysisInput | null>(analysisInput);
  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState<MonthlyPlan | null>(null);
  const [regenTick, setRegenTick] = useState(0);

  useEffect(() => { setInput(analysisInput); }, [analysisInput, isActive]);

  useEffect(() => {
    if (!input) { setPlan(null); return; }
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(() => {
      if (cancelled) return;
      setPlan(generatePlanMock(input));
      setLoading(false);
    }, 250);
    return () => { cancelled = true; clearTimeout(t); };
  }, [input, regenTick]);

  if (!input) {
    return (
      <Card className="flex flex-col items-center gap-3 p-6 text-center shadow-soft">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Sparkles className="h-5 w-5" />
        </div>
        <div className="space-y-1">
          <p className="font-display text-sm font-semibold">No plan yet</p>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Run your Salary Analysis first to generate a personalized monthly plan.
          </p>
        </div>
        <Button size="sm" onClick={onGoToAnalyze}>Analyze Now</Button>
      </Card>
    );
  }

  if (loading || !plan) return <PlanLoading />;

  return <PlanBody plan={plan} input={input} onRegen={() => setRegenTick((n) => n + 1)} />;
}

function PlanLoading() {
  const lines = ["Generating monthly plan…", "Calculating budgets…", "Preparing recommendations…"];
  return (
    <Card className="p-5 shadow-soft">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 animate-pulse items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Sparkles className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1 space-y-1.5">
          {lines.map((l) => <p key={l} className="text-xs text-muted-foreground">{l}</p>)}
        </div>
      </div>
    </Card>
  );
}

function PlanBody({ plan, input, onRegen }: { plan: MonthlyPlan; input: CoachAnalysisInput; onRegen: () => void }) {
  const [top, ...others] = plan.actions;

  return (
    <div className="space-y-4">
      {/* Today's AI Summary — always first */}
      <TodaySummaryCard plan={plan} />

      {/* Data freshness chip */}
      <FreshnessChip plan={plan} />

      {/* Achievements */}
      {plan.achievements.length > 0 && <AchievementsRow plan={plan} />}

      {/* Monthly Survival Plan — expanded */}
      <SectionHeader icon={<Sparkles className="h-4 w-4 text-primary" />} title="Monthly Survival Plan" />
      <div className="grid grid-cols-2 gap-2 sm:gap-3">
        <SummaryCard icon={<Wallet className="h-4 w-4" />} label="Safe Daily Spend" value={formatCurrency(plan.summary.safeDailySpend)} tone="primary" />
        <SummaryCard icon={<TargetIcon className="h-4 w-4" />} label="Savings Target" value={formatCurrency(plan.summary.monthlySavingsTarget)} tone="success" />
        <SummaryCard icon={<TrendingUp className="h-4 w-4" />} label="Month-End Balance" value={formatCurrency(plan.summary.expectedMonthEndBalance)} tone="gold" />
        <SummaryCard icon={<ShieldCheck className="h-4 w-4" />} label="Survival Score" value={`${plan.summary.survivalScore}%`} tone="primary" />
      </div>

      {/* Today's Priority — expanded */}
      {top && (
        <>
          <SectionHeader icon={<Flame className="h-4 w-4 text-destructive" />} title="Today's Priority" />
          <PriorityCard action={top} plan={plan} />
        </>
      )}

      {/* Other Recommendations — compact */}
      {others.length > 0 && (
        <CollapsibleSection
          icon={<ClipboardList className="h-4 w-4 text-primary" />}
          title="Other Recommendations"
          summary={`${others.length} more to explore`}
          defaultOpen={false}
        >
          <div className="space-y-2">
            {others.map((a) => <CompactActionCard key={a.id} action={a} plan={plan} />)}
          </div>
        </CollapsibleSection>
      )}

      {/* Can I Buy This — expanded */}
      <SectionHeader icon={<ShoppingBag className="h-4 w-4 text-primary" />} title="Can I Buy This?" />
      <BuyCheckCard plan={plan} input={input} />

      {/* Collapsible sections */}
      <CollapsibleSection
        icon={<Wallet className="h-4 w-4 text-primary" />}
        title="Salary Allocation"
        summary={plan.allocation.map((s) => `${s.label} ${s.pct}%`).join(" • ")}
      >
        <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted">
          {plan.allocation.map((s) => (
            <div key={s.key} className={s.tone} style={{ width: `${s.pct}%` }} aria-label={`${s.label} ${s.pct}%`} />
          ))}
        </div>
        <ul className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2">
          {plan.allocation.map((s) => (
            <li key={s.key} className="flex items-center gap-2 text-xs">
              <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${s.tone}`} />
              <span className="min-w-0 flex-1 truncate text-muted-foreground">{s.label}</span>
              <span className="shrink-0 font-semibold tabular-nums">{formatCurrency(s.amount)}</span>
            </li>
          ))}
        </ul>
      </CollapsibleSection>

      <CollapsibleSection
        icon={<CalendarClock className="h-4 w-4 text-primary" />}
        title="Weekly Spending Limits"
        summary={`4 weeks • ~${formatCurrency(plan.weeklyLimits[0]?.limit ?? 0)}/wk`}
      >
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {plan.weeklyLimits.map((w) => (
            <div key={w.week} className="rounded-lg border bg-muted/30 p-2.5">
              <p className="font-display text-xs font-semibold">{w.label}</p>
              <p className="text-[10px] text-muted-foreground">{w.range}</p>
              <p className="mt-1 font-display text-sm font-bold tabular-nums">{formatCurrency(w.limit)}</p>
            </div>
          ))}
        </div>
      </CollapsibleSection>

      <BillsSection plan={plan} onChange={onRegen} />

      <CollapsibleSection
        icon={<TargetIcon className="h-4 w-4 text-primary" />}
        title="Goal Progress"
        summary={`${plan.goal.goal} • ${plan.goal.progressPct}%`}
      >
        <GoalProgressBody plan={plan} />
      </CollapsibleSection>

      <CollapsibleSection
        icon={<Zap className="h-4 w-4 text-primary" />}
        title="Weekly Challenges"
        summary={`${plan.challenges.length} challenges available`}
      >
        <div className="space-y-2">
          {plan.challenges.map((c) => (
            <div key={c.id} className="rounded-lg border bg-muted/30 p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="font-display text-sm font-semibold">{c.title}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">{c.description}</p>
                </div>
                <Badge variant="outline" className="h-5 shrink-0 px-1.5 text-[10px]">{c.reward}</Badge>
              </div>
            </div>
          ))}
        </div>
      </CollapsibleSection>
    </div>
  );
}

// --- Cards / building blocks ---

function TodaySummaryCard({ plan }: { plan: MonthlyPlan }) {
  const { daily } = plan;
  const riskTone = daily.riskLevel === "Low" ? "text-success" : daily.riskLevel === "Medium" ? "text-gold" : "text-destructive";
  const goalTone =
    daily.goalStatus === "Ahead" ? "text-success" :
    daily.goalStatus === "On Track" ? "text-primary" :
    daily.goalStatus === "Behind" ? "text-gold" : "text-destructive";
  return (
    <Card className="p-4 shadow-soft">
      <div className="flex items-center gap-1.5">
        <Sparkles className="h-4 w-4 text-primary" />
        <p className="font-display text-sm font-semibold">Today's AI Summary</p>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{daily.spendingStatus}</p>
      <ul className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-[11px]">
        <SummaryRow label="Month-end savings" value={formatCurrency(daily.expectedMonthEndSavings)} tone="text-foreground" />
        <SummaryRow label="Risk Level" value={daily.riskLevel} tone={riskTone} />
        <SummaryRow label={plan.goal.goal} value={daily.goalStatus} tone={goalTone} />
        <SummaryRow label="Confidence" value={`${daily.confidence}%`} tone="text-foreground" />
      </ul>
    </Card>
  );
}

function SummaryRow({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <li className="flex items-center justify-between gap-2 rounded-md bg-muted/40 px-2 py-1.5">
      <span className="min-w-0 flex-1 truncate text-muted-foreground">{label}</span>
      <span className={`shrink-0 font-semibold tabular-nums ${tone}`}>{value}</span>
    </li>
  );
}

function FreshnessChip({ plan }: { plan: MonthlyPlan }) {
  const now = new Date();
  const generated = new Date(plan.generatedAt);
  const sameDay = now.toDateString() === generated.toDateString();
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Badge variant="outline" className="h-5 gap-1 border-success/30 bg-success/10 px-1.5 text-[10px] text-success">
        <Circle className="h-2 w-2 fill-success text-success" />
        {sameDay ? "Updated Today" : "Updated Recently"}
      </Badge>
      <Badge variant="outline" className="h-5 px-1.5 text-[10px] text-muted-foreground">
        Using {plan.monthLabel}
      </Badge>
    </div>
  );
}

function AchievementsRow({ plan }: { plan: MonthlyPlan }) {
  return (
    <Card className="p-3 shadow-soft">
      <div className="flex items-center gap-1.5">
        <Trophy className="h-4 w-4 text-gold" />
        <p className="font-display text-xs font-semibold">Achievements</p>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {plan.achievements.map((a) => (
          <Badge key={a.id} variant="outline" className="h-6 gap-1 border-gold/30 bg-gold/10 px-2 text-[11px] text-gold-foreground">
            <span aria-hidden>{a.emoji}</span>
            <span className="text-foreground/90">{a.title}</span>
          </Badge>
        ))}
      </div>
    </Card>
  );
}

function CollapsibleSection({
  icon, title, summary, children, defaultOpen = false,
}: {
  icon: React.ReactNode;
  title: string;
  summary: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card className="p-0 shadow-soft">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <button className="flex w-full items-center gap-2 px-4 py-3 text-left transition-colors hover:bg-muted/40">
            <span className="shrink-0">{icon}</span>
            <div className="min-w-0 flex-1">
              <p className="font-display text-sm font-semibold">{title}</p>
              <p className="truncate text-[11px] text-muted-foreground">{summary}</p>
            </div>
            <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="border-t px-4 py-3">{children}</div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

function SectionHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-1.5 px-0.5 pt-1">
      {icon}
      <h2 className="font-display text-sm font-semibold">{title}</h2>
    </div>
  );
}

function SummaryCard({
  icon, label, value, tone,
}: { icon: React.ReactNode; label: string; value: string; tone: "primary" | "success" | "gold" }) {
  const toneCls =
    tone === "success" ? "bg-success/10 text-success"
      : tone === "gold" ? "bg-gold/10 text-gold"
        : "bg-primary/10 text-primary";
  return (
    <Card className="p-3 shadow-soft sm:p-4">
      <div className="flex items-center gap-2">
        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${toneCls}`}>{icon}</div>
        <p className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground">{label}</p>
      </div>
      <p className="mt-2 font-display text-base font-bold tabular-nums leading-tight sm:text-lg">{value}</p>
    </Card>
  );
}

function PriorityCard({ action, plan }: { action: TopAction; plan: MonthlyPlan }) {
  const [added, setAdded] = useState(false);
  const [preview, setPreview] = useState<ImpactPreview | null>(null);
  const apply = () => {
    enqueuePlannerTask({ id: `plan-action-${action.id}`, title: action.title, detail: action.detail });
    setPreview(computeImpactPreview(action, plan));
    setAdded(true);
    toast.success("✓ Added to Planner", { description: action.title });
  };
  const showPreview = () => setPreview(computeImpactPreview(action, plan));
  return (
    <Card className="border-destructive/20 bg-destructive/5 p-4 shadow-soft">
      <div className="flex items-start gap-2">
        <Flame className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
        <div className="min-w-0 flex-1">
          <p className="font-display text-sm font-semibold leading-snug">{action.title}</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{action.reason}</p>
          <p className="mt-1 text-xs leading-relaxed">{action.detail}</p>
        </div>
      </div>

      <WhyThisMatters bullets={action.whyMatters} />

      <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
        <MiniStat label="Monthly savings" value={formatCurrency(action.monthlySavings)} />
        <MiniStat label="Score boost" value={`+${action.scoreBoost}`} />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <Badge variant="outline" className={`h-5 px-1.5 text-[10px] ${priorityStyles[action.priority]}`}>{action.priority} Priority</Badge>
        <Badge variant="outline" className={`h-5 px-1.5 text-[10px] ${difficultyStyles[action.difficulty]}`}>{action.difficulty}</Badge>
        <Badge variant="outline" className="h-5 px-1.5 text-[10px] text-muted-foreground">
          <Clock className="mr-1 h-3 w-3" /> {action.estimatedTime}
        </Badge>
      </div>

      <HowAiCalculated dataUsed={action.dataUsed} />

      {preview && <ImpactPreviewBlock preview={preview} />}

      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" variant="outline" className="h-8 px-3 text-xs" onClick={showPreview}>
          <TrendingUp className="mr-1 h-3.5 w-3.5" /> Check Impact
        </Button>
        <Button size="sm" className="h-8 px-3 text-xs" onClick={apply} disabled={added}>
          {added ? (<><CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Added to Planner</>) : (<><ClipboardList className="mr-1 h-3.5 w-3.5" /> Apply to Planner</>)}
        </Button>
      </div>
    </Card>
  );
}

function WhyThisMatters({ bullets }: { bullets: string[] }) {
  if (!bullets || bullets.length === 0) return null;
  return (
    <div className="mt-3 rounded-lg border border-primary/20 bg-primary/5 p-3">
      <p className="font-display text-[11px] font-semibold uppercase tracking-wide text-primary">Why this matters</p>
      <ul className="mt-1.5 space-y-1">
        {bullets.map((b, i) => (
          <li key={i} className="flex items-start gap-1.5 text-[11px] leading-relaxed text-foreground/90">
            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary" />
            <span className="min-w-0 flex-1">{b}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

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

function ImpactPreviewBlock({ preview }: { preview: ImpactPreview }) {
  const scoreUp = preview.survivalScore.projected > preview.survivalScore.current;
  const savingsUp = preview.monthlySavings.projected > preview.monthlySavings.current;
  const goalUp = preview.goalCompletion.monthsSaved > 0;
  return (
    <div className="mt-3 rounded-lg border border-success/30 bg-success/5 p-3">
      <p className="font-display text-[11px] font-semibold uppercase tracking-wide text-success">If you follow this</p>
      <div className="mt-2 space-y-2 text-[11px]">
        <ImpactRow
          label="Survival Score"
          current={`${preview.survivalScore.current}`}
          projected={`${preview.survivalScore.projected}`}
          up={scoreUp}
        />
        <ImpactRow
          label="Monthly Savings"
          current={formatCurrency(preview.monthlySavings.current)}
          projected={formatCurrency(preview.monthlySavings.projected)}
          up={savingsUp}
        />
        <ImpactRow
          label="Goal Completion"
          current={preview.goalCompletion.current}
          projected={preview.goalCompletion.projected}
          up={goalUp}
          note={goalUp ? `${preview.goalCompletion.monthsSaved} mo sooner` : undefined}
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

function CompactActionCard({ action, plan }: { action: TopAction; plan: MonthlyPlan }) {
  const [added, setAdded] = useState(false);
  const [preview, setPreview] = useState<ImpactPreview | null>(null);
  const [open, setOpen] = useState(false);
  const apply = () => {
    enqueuePlannerTask({ id: `plan-action-${action.id}`, title: action.title, detail: action.detail });
    setPreview(computeImpactPreview(action, plan));
    setAdded(true);
    toast.success("✓ Added to Planner", { description: action.title });
  };
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-display text-xs font-semibold leading-snug">{action.title}</p>
          <p className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">{action.detail}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1">
            <Badge variant="outline" className={`h-4 px-1 text-[9px] ${priorityStyles[action.priority]}`}>{action.priority}</Badge>
            <Badge variant="outline" className={`h-4 px-1 text-[9px] ${difficultyStyles[action.difficulty]}`}>{action.difficulty}</Badge>
            <span className="text-[10px] text-muted-foreground">Save {formatCurrency(action.monthlySavings)}/mo • +{action.scoreBoost} • {action.estimatedTime}</span>
          </div>
        </div>
        <Button size="sm" variant="ghost" className="h-7 shrink-0 px-2 text-[11px]" onClick={apply} disabled={added}>
          {added ? <CheckCircle2 className="h-3.5 w-3.5 text-success" /> : "Apply"}
        </Button>
      </div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="mt-2 flex w-full items-center justify-between rounded-md bg-muted/30 px-2 py-1 text-left text-[10px] font-medium text-muted-foreground transition-colors hover:bg-muted"
      >
        <span>Why & how</span>
        <ChevronDown className={`h-3 w-3 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="mt-2 space-y-2">
          <WhyThisMatters bullets={action.whyMatters} />
          <HowAiCalculated dataUsed={action.dataUsed} />
        </div>
      )}
      {preview && <ImpactPreviewBlock preview={preview} />}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/30 px-2 py-1.5">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 truncate font-semibold tabular-nums">{value}</p>
    </div>
  );
}

// --- Bills ---

function BillsSection({ plan, onChange }: { plan: MonthlyPlan; onChange: () => void }) {
  const upcomingCount = plan.bills.filter((b) => b.status !== "Paid").length;
  const totalOwed = plan.bills.filter((b) => b.status !== "Paid").reduce((s, b) => s + b.amount, 0);
  return (
    <CollapsibleSection
      icon={<CalendarClock className="h-4 w-4 text-primary" />}
      title="Bills Timeline"
      summary={plan.bills.length === 0 ? "No recurring bills detected" : `${upcomingCount} unpaid • ${formatCurrency(totalOwed)} remaining`}
    >
      {plan.bills.length === 0 ? (
        <p className="text-center text-xs text-muted-foreground">No recurring bills detected this month.</p>
      ) : (
        <div className="divide-y">
          {plan.bills.map((b) => <BillRow key={b.id} bill={b} onChange={onChange} />)}
        </div>
      )}
    </CollapsibleSection>
  );
}

function BillRow({ bill, onChange }: { bill: BillItem; onChange: () => void }) {
  const navigate = useNavigate();
  const icon =
    bill.status === "Paid" ? <CheckCircle2 className="h-3.5 w-3.5" /> :
    bill.status === "Due Today" ? <AlertCircle className="h-3.5 w-3.5" /> :
    <Clock className="h-3.5 w-3.5" />;

  const togglePaid = () => {
    if (bill.status === "Paid") {
      unmarkBillPaid(bill.id);
      toast.success("Bill marked unpaid", { description: bill.name });
    } else {
      markBillPaid(bill.id);
      toast.success("✓ Bill marked paid", { description: `${bill.name} • budget updated` });
    }
    onChange();
  };

  const openPlanner = () => {
    enqueuePlannerTask({ id: `bill-${bill.id}`, title: `Pay ${bill.name}`, detail: `${formatCurrency(bill.amount)} due ${bill.dueLabel}` });
    navigate({ to: "/planner" });
  };

  const editBill = () => {
    navigate({ to: "/transactions" });
    toast.message("Open transactions to edit this bill.");
  };

  return (
    <div className="flex items-center gap-3 py-3">
      <div className="flex w-12 shrink-0 flex-col items-center">
        <span className="font-display text-xs font-bold leading-none">{bill.dueLabel.split(" ")[0]}</span>
        <span className="text-[10px] uppercase text-muted-foreground">{bill.dueLabel.split(" ")[1]}</span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-display text-sm font-semibold">{bill.name}</p>
        <p className="text-[11px] tabular-nums text-muted-foreground">{formatCurrency(bill.amount)}</p>
      </div>
      <Badge variant="outline" className={`h-5 shrink-0 gap-1 px-1.5 text-[10px] ${statusStyles[bill.status]}`}>
        {icon}
        <span className="whitespace-nowrap">{bill.status}</span>
      </Badge>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" aria-label="Bill actions">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem onClick={togglePaid}>
            <CheckCircle2 className="mr-2 h-4 w-4" />
            {bill.status === "Paid" ? "Mark unpaid" : "Mark paid"}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={openPlanner}>
            <ClipboardList className="mr-2 h-4 w-4" /> Open Planner
          </DropdownMenuItem>
          <DropdownMenuItem onClick={editBill}>
            <PenLine className="mr-2 h-4 w-4" /> Edit Bill
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

// --- Goal ---

function GoalProgressBody({ plan }: { plan: MonthlyPlan }) {
  const g = plan.goal;
  return (
    <>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-display text-sm font-semibold">{g.goal}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Target {formatCurrency(g.target)} • ETA {g.etaMonths} months
          </p>
        </div>
        <Badge variant="outline" className={`h-5 shrink-0 px-1.5 text-[10px] ${g.aheadOfSchedule ? "border-success/30 bg-success/10 text-success" : "border-gold/30 bg-gold/10 text-gold"}`}>
          {g.progressPct}%
        </Badge>
      </div>
      <Progress value={g.progressPct} className="mt-3 h-2" />
      <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
        <MiniStat label="Saved" value={formatCurrency(g.current)} />
        <MiniStat label="Monthly Target" value={formatCurrency(g.monthlyTarget)} />
        <MiniStat label="Est. Completion" value={new Date(g.estimatedCompletion).toLocaleDateString(undefined, { month: "short", year: "numeric" })} />
        <MiniStat label="Days Remaining" value={`${g.daysRemaining}`} />
      </div>
      <p className={`mt-3 text-xs ${g.aheadOfSchedule ? "text-success" : "text-muted-foreground"}`}>
        {g.motivation}
      </p>
    </>
  );
}

// --- Can I Buy This ---

function BuyCheckCard({ plan, input }: { plan: MonthlyPlan; input: CoachAnalysisInput }) {
  const [item, setItem] = useState("");
  const [priceStr, setPriceStr] = useState("");
  const [result, setResult] = useState<BuyCheckResult | null>(null);
  const price = Number(priceStr) || 0;

  const check = () => setResult(evaluatePurchase(price, plan, input));

  const toneCls = useMemo(() => {
    if (!result) return "border-border bg-muted/40 text-foreground";
    if (result.verdict === "Not Recommended") return "border-destructive/30 bg-destructive/5";
    if (result.verdict === "Wait Until Salary") return "border-gold/30 bg-gold/10";
    return "border-success/30 bg-success/10";
  }, [result]);

  const verdictTone = useMemo(() => {
    if (!result) return "text-foreground";
    if (result.verdict === "Not Recommended") return "text-destructive";
    if (result.verdict === "Wait Until Salary") return "text-gold";
    return "text-success";
  }, [result]);

  return (
    <Card className="space-y-3 p-4 shadow-soft">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="plan-cibt-item" className="text-xs">Item Name</Label>
          <Input id="plan-cibt-item" placeholder="e.g. Running shoes" value={item} onChange={(e) => setItem(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="plan-cibt-price" className="text-xs">Price</Label>
          <Input
            id="plan-cibt-price"
            type="number"
            inputMode="decimal"
            placeholder="2499"
            value={priceStr}
            onChange={(e) => { setPriceStr(e.target.value); setResult(null); }}
          />
        </div>
      </div>

      <Button size="sm" className="h-8 px-3 text-xs" onClick={check} disabled={price <= 0}>
        Check Impact <ArrowRight className="ml-1 h-3.5 w-3.5" />
      </Button>

      {result && (
        <div className={`rounded-xl border p-3 ${toneCls}`}>
          <p className={`font-display text-sm font-semibold ${verdictTone}`}>{result.verdict}</p>
          <p className="mt-1 text-xs leading-relaxed text-foreground/90">{result.reason}</p>
          <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
            <MiniStat label="Current Balance" value={formatCurrency(result.currentBalance)} />
            <MiniStat label="Balance After" value={formatCurrency(result.balanceAfter)} />
            <MiniStat label="New Survival Score" value={`${result.newSurvivalScore}% (${result.scoreImpact})`} />
            <MiniStat label="New Safe Daily" value={formatCurrency(result.newSafeDailySpend)} />
            <MiniStat label="Goal Delay" value={result.goalDelayDays === 0 ? "None" : `${result.goalDelayDays} days`} />
            <MiniStat label="Monthly Budget Impact" value={`${result.monthlyBudgetImpactPct}%`} />
          </div>
        </div>
      )}
    </Card>
  );
}
