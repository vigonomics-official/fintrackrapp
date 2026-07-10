import { useEffect, useMemo, useState } from "react";
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
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/currency";
import type { CoachAnalysisInput } from "@/lib/ai-coach-analysis";
import {
  generatePlanMock,
  enqueuePlannerTask,
  evaluatePurchase,
  type MonthlyPlan,
  type BillItem,
  type BillStatus,
  type TopAction,
  type ActionPriority,
  type ActionDifficulty,
  type BuyCheckResult,
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

  useEffect(() => {
    setInput(analysisInput);
  }, [analysisInput, isActive]);

  useEffect(() => {
    if (!input) {
      setPlan(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    // Simulated "AI generation" pause — replace with Gemini call later.
    const t = setTimeout(() => {
      if (cancelled) return;
      setPlan(generatePlanMock(input));
      setLoading(false);
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [input]);

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
        <Button size="sm" onClick={onGoToAnalyze}>
          Analyze Now
        </Button>
      </Card>
    );
  }

  if (loading || !plan) {
    return <PlanLoading />;
  }

  return <PlanBody plan={plan} input={input} />;
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
          {lines.map((l) => (
            <p key={l} className="text-xs text-muted-foreground">{l}</p>
          ))}
        </div>
      </div>
    </Card>
  );
}

function PlanBody({ plan, input }: { plan: MonthlyPlan; input: CoachAnalysisInput }) {
  const applyAll = () => {
    plan.actions.forEach((a) =>
      enqueuePlannerTask({ id: `plan-action-${a.id}`, title: a.title, detail: a.detail }),
    );
    toast.success("✓ Added to Planner", { description: `${plan.actions.length} actions queued.` });
  };

  return (
    <div className="space-y-4">
      {/* SECTION 1 — Monthly Survival Plan */}
      <SectionHeader icon={<Sparkles className="h-4 w-4 text-primary" />} title="Monthly Survival Plan" />
      <div className="grid grid-cols-2 gap-2 sm:gap-3">
        <SummaryCard icon={<Wallet className="h-4 w-4" />} label="Safe Daily Spend" value={formatCurrency(plan.summary.safeDailySpend)} tone="primary" />
        <SummaryCard icon={<TargetIcon className="h-4 w-4" />} label="Savings Target" value={formatCurrency(plan.summary.monthlySavingsTarget)} tone="success" />
        <SummaryCard icon={<TrendingUp className="h-4 w-4" />} label="Month-End Balance" value={formatCurrency(plan.summary.expectedMonthEndBalance)} tone="gold" />
        <SummaryCard icon={<ShieldCheck className="h-4 w-4" />} label="Survival Score" value={`${plan.summary.survivalScore}%`} tone="primary" />
      </div>

      {/* SECTION 2 — Salary Allocation */}
      <SectionHeader icon={<Wallet className="h-4 w-4 text-primary" />} title="Salary Allocation" />
      <Card className="p-4 shadow-soft">
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
      </Card>

      {/* SECTION 3 — Weekly Spending Limits */}
      <SectionHeader icon={<CalendarClock className="h-4 w-4 text-primary" />} title="Weekly Spending Limits" />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {plan.weeklyLimits.map((w) => (
          <Card key={w.week} className="p-3 shadow-soft">
            <p className="font-display text-xs font-semibold">{w.label}</p>
            <p className="text-[10px] text-muted-foreground">{w.range}</p>
            <p className="mt-1 font-display text-sm font-bold tabular-nums">{formatCurrency(w.limit)}</p>
          </Card>
        ))}
      </div>

      {/* SECTION 4 — Bills Timeline */}
      <SectionHeader icon={<CalendarClock className="h-4 w-4 text-primary" />} title="Bills Timeline" />
      {plan.bills.length === 0 ? (
        <Card className="p-4 text-center text-xs text-muted-foreground shadow-soft">
          No recurring bills detected this month.
        </Card>
      ) : (
        <Card className="divide-y p-0 shadow-soft">
          {plan.bills.map((b) => (
            <BillRow key={b.id} bill={b} />
          ))}
        </Card>
      )}

      {/* SECTION 5 — Goal Progress */}
      <SectionHeader icon={<TargetIcon className="h-4 w-4 text-primary" />} title="Goal Progress" />
      <Card className="p-4 shadow-soft">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="font-display text-sm font-semibold">{plan.goal.goal}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Target {formatCurrency(plan.goal.target)} • ETA {plan.goal.etaMonths} months
            </p>
          </div>
          <Badge variant="outline" className="h-5 shrink-0 px-1.5 text-[10px]">
            {plan.goal.progressPct}%
          </Badge>
        </div>
        <Progress value={plan.goal.progressPct} className="mt-3 h-2" />
        <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
          <MiniStat label="Saved" value={formatCurrency(plan.goal.current)} />
          <MiniStat label="Monthly Target" value={formatCurrency(plan.goal.monthlyTarget)} />
          <MiniStat label="Est. Completion" value={new Date(plan.goal.estimatedCompletion).toLocaleDateString(undefined, { month: "short", year: "numeric" })} />
          <MiniStat label="Progress" value={`${plan.goal.progressPct}%`} />
        </div>
      </Card>

      {/* SECTION 6 — Top AI Action Plan */}
      <div className="flex items-center justify-between gap-2">
        <SectionHeader icon={<Sparkles className="h-4 w-4 text-primary" />} title="Top AI Action Plan" />
        <Button size="sm" variant="outline" className="h-8 px-2 text-xs" onClick={applyAll}>
          <ClipboardList className="mr-1 h-3.5 w-3.5" />
          Apply All
        </Button>
      </div>
      <div className="space-y-2">
        {plan.actions.map((a) => (
          <ActionCard key={a.id} action={a} />
        ))}
      </div>

      {/* SECTION 7 — Can I Buy This? */}
      <SectionHeader icon={<ShoppingBag className="h-4 w-4 text-primary" />} title="Can I Buy This?" />
      <BuyCheckCard plan={plan} input={input} />
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

function SummaryCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: "primary" | "success" | "gold";
}) {
  const toneCls =
    tone === "success"
      ? "bg-success/10 text-success"
      : tone === "gold"
        ? "bg-gold/10 text-gold"
        : "bg-primary/10 text-primary";
  return (
    <Card className="p-3 shadow-soft sm:p-4">
      <div className="flex items-center gap-2">
        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${toneCls}`}>
          {icon}
        </div>
        <p className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground">{label}</p>
      </div>
      <p className="mt-2 font-display text-base font-bold tabular-nums leading-tight sm:text-lg">{value}</p>
    </Card>
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

function BillRow({ bill }: { bill: BillItem }) {
  const icon =
    bill.status === "Paid" ? <CheckCircle2 className="h-3.5 w-3.5" /> :
    bill.status === "Due Today" ? <AlertCircle className="h-3.5 w-3.5" /> :
    <Clock className="h-3.5 w-3.5" />;
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="flex w-14 shrink-0 flex-col items-center">
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
    </div>
  );
}

function ActionCard({ action }: { action: TopAction }) {
  const [added, setAdded] = useState(false);
  const apply = () => {
    enqueuePlannerTask({ id: `plan-action-${action.id}`, title: action.title, detail: action.detail });
    setAdded(true);
    toast.success("✓ Added to Planner", { description: action.title });
  };
  return (
    <Card className="p-3 shadow-soft sm:p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-display text-sm font-semibold leading-snug">{action.title}</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{action.detail}</p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <Badge variant="outline" className={`h-5 px-1.5 text-[10px] ${priorityStyles[action.priority]}`}>
              {action.priority} Priority
            </Badge>
            <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
              Save {formatCurrency(action.monthlySavings)}/mo
            </Badge>
            <Badge variant="outline" className={`h-5 px-1.5 text-[10px] ${difficultyStyles[action.difficulty]}`}>
              {action.difficulty}
            </Badge>
          </div>
        </div>
      </div>
      <div className="mt-3">
        <Button size="sm" className="h-8 px-2 text-xs" onClick={apply} disabled={added}>
          {added ? (
            <>
              <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Added to Planner
            </>
          ) : (
            <>
              <ClipboardList className="mr-1 h-3.5 w-3.5" /> Apply to Planner
            </>
          )}
        </Button>
      </div>
    </Card>
  );
}

function BuyCheckCard({ plan, input }: { plan: MonthlyPlan; input: CoachAnalysisInput }) {
  const [item, setItem] = useState("");
  const [priceStr, setPriceStr] = useState("");
  const [result, setResult] = useState<BuyCheckResult | null>(null);
  const price = Number(priceStr) || 0;

  const check = () => setResult(evaluatePurchase(price, plan, input));

  const toneCls = useMemo(() => {
    if (!result) return "border-border bg-muted/40 text-foreground";
    if (result.verdict === "Not Recommended") return "border-destructive/30 bg-destructive/5 text-destructive";
    if (result.verdict === "Wait Until Salary") return "border-gold/30 bg-gold/10 text-gold-foreground";
    return "border-success/30 bg-success/10 text-success";
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
            onChange={(e) => {
              setPriceStr(e.target.value);
              setResult(null);
            }}
          />
        </div>
      </div>

      <Button size="sm" className="h-8 px-3 text-xs" onClick={check} disabled={price <= 0}>
        Check Impact <ArrowRight className="ml-1 h-3.5 w-3.5" />
      </Button>

      {result && (
        <div className={`rounded-xl border p-3 ${toneCls}`}>
          <p className="font-display text-sm font-semibold">{result.verdict}</p>
          <p className="mt-1 text-xs opacity-90">{result.reason}</p>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
            <span>
              Score impact <span className="font-semibold">{result.scoreImpact >= 0 ? "±0" : `${result.scoreImpact}`}</span>
            </span>
            <span>
              New safe daily <span className="font-semibold">{formatCurrency(result.newSafeDailySpend)}</span>
            </span>
          </div>
        </div>
      )}
    </Card>
  );
}
