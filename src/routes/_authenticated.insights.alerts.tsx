import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BellOff,
  Brain,
  CheckCircle2,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Clock,
  History,
  Lightbulb,
  ListChecks,
  MessageSquare,
  Sparkles,
  Star,
  Timer,
  Target,
  TrendingDown,
} from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/finance/PageHeader";
import {
  useTransactions,
  useCategories,
  useBudgets,
  useLoans,
  useProfile,
  monthKey,
} from "@/hooks/use-finance";
import { useSalarySettings } from "@/hooks/use-salary-settings";
import { computeSurvival } from "@/lib/survival";
import { formatCurrency } from "@/lib/currency";
import { cn } from "@/lib/utils";
import {
  detectAlerts,
  PRIORITY_META,
  summarize,
  type AlertAction,
  type AlertPriority,
  type DangerAlert,
} from "@/lib/danger-alerts";

export const Route = createFileRoute("/_authenticated/insights/alerts")({
  component: AlertsPage,
  head: () => ({
    meta: [
      { title: "Danger Alerts — FinTrackr" },
      { name: "description", content: "Smart, prioritized financial risk alerts with AI reasoning and one-tap actions." },
    ],
  }),
});

// ---------- persistence ----------
const KEY_STATE = "fintrackr_alerts_state_v1";
const KEY_HISTORY = "fintrackr_alerts_history_v1";

type AlertLifecycle = "active" | "dismissed" | "resolved" | "snoozed";
interface StoredAlertState {
  status: AlertLifecycle;
  updatedAt: number;
  snoozeUntil?: number;
}
type StateMap = Record<string, StoredAlertState>;

interface HistoryEntry {
  id: string;
  title: string;
  priority: AlertPriority;
  problem: string;
  outcome: "resolved" | "dismissed" | "auto-resolved";
  at: number;
}

function readState(): StateMap {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(localStorage.getItem(KEY_STATE) ?? "{}"); } catch { return {}; }
}
function writeState(s: StateMap) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY_STATE, JSON.stringify(s));
}
function readHistory(): HistoryEntry[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(KEY_HISTORY) ?? "[]"); } catch { return []; }
}
function writeHistory(h: HistoryEntry[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY_HISTORY, JSON.stringify(h.slice(0, 50)));
}
function readGoals() {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem("fintrackr_goals_v1") ?? "[]"); } catch { return []; }
}

// ---------- summary card ----------
function SummaryHeader({
  active,
  highest,
  savings,
  risk,
  currency,
}: {
  active: number;
  highest: AlertPriority | null;
  savings: number;
  risk: number;
  currency: string;
}) {
  const riskLabel = risk >= 60 ? "High Risk" : risk >= 30 ? "Moderate Risk" : active === 0 ? "All Clear" : "Low Risk";
  const riskColor = risk >= 60 ? "text-destructive" : risk >= 30 ? "text-gold" : "text-success";
  return (
    <Card className="overflow-hidden p-4 shadow-soft">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Financial Risk</p>
          <p className={cn("font-display text-2xl font-bold leading-tight", riskColor)}>{risk}<span className="text-sm text-muted-foreground">/100</span></p>
          <p className={cn("text-xs font-medium", riskColor)}>{riskLabel}</p>
        </div>
        <div className="grid grid-cols-3 gap-3 text-right">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Active</p>
            <p className="font-display text-lg font-semibold">{active}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Top</p>
            <p className="font-display text-lg font-semibold">{highest ? PRIORITY_META[highest].emoji : "—"}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Save</p>
            <p className="font-display text-sm font-semibold">{formatCurrency(savings, currency)}</p>
          </div>
        </div>
      </div>
    </Card>
  );
}

// ---------- helpers ----------
const CONFIDENCE_CHIP: Record<"High" | "Medium" | "Low", string> = {
  High: "bg-success/15 text-success",
  Medium: "bg-gold/15 text-gold",
  Low: "bg-muted text-muted-foreground",
};
const CONFIDENCE_DOT: Record<"High" | "Medium" | "Low", string> = {
  High: "🟢",
  Medium: "🟡",
  Low: "🔴",
};

function formatDelta(n: number, currency: string): string {
  const sign = n > 0 ? "+" : n < 0 ? "−" : "";
  return `${sign}${formatCurrency(Math.abs(n), currency)}`;
}

function ImpactChips({ alert, currency }: { alert: DangerAlert; currency: string }) {
  const m = alert.impactMetrics;
  const chips: React.ReactNode[] = [];
  if (m.safeDailyDelta != null && m.safeDailyDelta !== 0) {
    chips.push(
      <span key="sd" className="rounded-md bg-muted/50 px-1.5 py-0.5 text-[10px] font-medium text-foreground/80">
        Safe daily {formatDelta(m.safeDailyDelta, currency)}/day
      </span>,
    );
  }
  if (m.scoreDelta != null && m.scoreDelta !== 0 && m.scoreCurrent != null) {
    chips.push(
      <span key="sc" className="rounded-md bg-muted/50 px-1.5 py-0.5 text-[10px] font-medium text-foreground/80">
        Score {m.scoreCurrent} → {Math.max(0, m.scoreCurrent + m.scoreDelta)}
      </span>,
    );
  }
  if (m.savingsDelta != null && m.savingsDelta !== 0) {
    chips.push(
      <span key="sv" className="rounded-md bg-muted/50 px-1.5 py-0.5 text-[10px] font-medium text-foreground/80">
        Savings {formatDelta(m.savingsDelta, currency)}
      </span>,
    );
  }
  if (m.goalDelayMonths != null && m.goalDelayMonths > 0) {
    chips.push(
      <span key="gd" className="rounded-md bg-muted/50 px-1.5 py-0.5 text-[10px] font-medium text-foreground/80">
        Goal delay +{m.goalDelayMonths}mo
      </span>,
    );
  }
  if (m.monthlyRecommend != null && m.monthlyRecommend > 0) {
    chips.push(
      <span key="mr" className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
        Save {formatCurrency(m.monthlyRecommend, currency)}/mo
      </span>,
    );
  }
  if (!chips.length) return null;
  return <div className="flex flex-wrap gap-1">{chips}</div>;
}

function GoalProgressBar({ gp, currency }: { gp: NonNullable<DangerAlert["goalProgress"]>; currency: string }) {
  return (
    <div className="rounded-lg bg-muted/40 p-2">
      <div className="flex items-center justify-between text-[11px]">
        <span className="flex items-center gap-1 text-foreground/90"><Target className="h-3 w-3" /> {gp.name}</span>
        <span className="font-semibold">{Math.round(gp.pct)}%</span>
      </div>
      <Progress value={Math.min(100, gp.pct)} className="mt-1 h-1.5" />
      <div className="mt-1 flex flex-wrap justify-between gap-2 text-[10px] text-muted-foreground">
        <span>{formatCurrency(gp.current, currency)} / {formatCurrency(gp.target, currency)}</span>
        {gp.etaDate && <span>ETA: {gp.etaDate}</span>}
      </div>
    </div>
  );
}

// ---------- alert card ----------
function AlertCard({
  alert,
  currency,
  onAction,
  expanded,
  onToggle,
}: {
  alert: DangerAlert;
  currency: string;
  onAction: (a: DangerAlert, action: AlertAction) => void;
  expanded: boolean;
  onToggle: () => void;
}) {
  const meta = PRIORITY_META[alert.priority];
  const conf = alert.confidenceFactors;

  const moneyImpact =
    alert.impactMetrics.savingsDelta ??
    (alert.impactMetrics.monthlyRecommend != null ? -alert.impactMetrics.monthlyRecommend : null) ??
    (alert.moneyAtRisk ? -alert.moneyAtRisk : null) ??
    (alert.estimatedSavings ? -alert.estimatedSavings : null);

  return (
    <Card className="relative overflow-hidden p-4 pl-5 shadow-soft">
      <span className={cn("absolute left-0 top-0 h-full w-1.5", meta.bar)} />

      {/* Compact header — always visible */}
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-start gap-3 text-left"
        aria-expanded={expanded}
      >
        <span className="text-xl leading-none">{meta.emoji}</span>
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="font-display text-sm font-semibold">{alert.title}</p>
            <Badge variant="secondary" className={cn("h-4 px-1.5 text-[10px]", CONFIDENCE_CHIP[conf.label])}>
              {CONFIDENCE_DOT[conf.label]} {conf.label} ({alert.confidence}%)
            </Badge>
            {moneyImpact != null && moneyImpact !== 0 && (
              <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">
                💰 {formatDelta(moneyImpact, currency)}
              </Badge>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground">{alert.oneLineReason}</p>
        </div>
        {expanded ? <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />}
      </button>

      {/* Action buttons — always visible */}
      <div className="mt-2 flex flex-wrap gap-1.5">
        {alert.actions.includes("apply-planner") && (
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onAction(alert, "apply-planner")}>
            Apply to Planner
          </Button>
        )}
        {alert.actions.includes("view-transactions") && (
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onAction(alert, "view-transactions")}>
            View transactions
          </Button>
        )}
        {alert.actions.includes("ask-coach") && (
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onAction(alert, "ask-coach")}>
            <MessageSquare className="mr-1 h-3 w-3" /> Ask AI Coach
          </Button>
        )}
        {alert.actions.includes("create-budget") && (
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onAction(alert, "create-budget")}>
            Create budget
          </Button>
        )}
        {alert.actions.includes("mark-resolved") && (
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onAction(alert, "mark-resolved")}>
            <CheckCircle2 className="mr-1 h-3 w-3" /> Mark resolved
          </Button>
        )}
        {alert.actions.includes("remind-later") && (
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => onAction(alert, "remind-later")}>
            Remind later
          </Button>
        )}
        {alert.actions.includes("dismiss") && (
          <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground" onClick={() => onAction(alert, "dismiss")}>
            <BellOff className="mr-1 h-3 w-3" /> Dismiss
          </Button>
        )}
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="mt-3 space-y-3 border-t pt-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="secondary" className={cn("h-4 px-1.5 text-[10px]", meta.chip)}>
              {meta.label}
            </Badge>
            <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">
              {alert.urgency.emoji} {alert.urgency.label}
            </Badge>
            <Badge variant="outline" className="h-4 px-1.5 text-[10px] text-muted-foreground">
              <Timer className="mr-0.5 h-2.5 w-2.5" /> {alert.fixTime}
            </Badge>
            {alert.isPredictive && (
              <Badge variant="outline" className="h-4 px-1.5 text-[10px]">
                <Sparkles className="mr-0.5 h-2.5 w-2.5" /> Predictive
              </Badge>
            )}
          </div>

          <p className="text-sm text-foreground/90">{alert.problem}</p>

          {alert.goalProgress && <GoalProgressBar gp={alert.goalProgress} currency={currency} />}

          <ReasonBlock icon={<Brain className="h-3.5 w-3.5" />} label="Why this happened" text={alert.why} />
          <ReasonBlock icon={<Sparkles className="h-3.5 w-3.5" />} label="AI reasoning" text={alert.priorityReason} />

          <div className="rounded-lg bg-muted/40 p-2.5">
            <p className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              <TrendingDown className="h-3 w-3" /> Financial impact
            </p>
            <p className="mb-1.5 text-[12px] leading-relaxed text-foreground/90">{alert.impact}</p>
            <ImpactChips alert={alert} currency={currency} />
          </div>

          <ReasonBlock icon={<Lightbulb className="h-3.5 w-3.5" />} label="Suggested action" text={alert.suggestion} />

          <div className="rounded-lg bg-muted/40 p-2.5">
            <p className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              <CheckCircle className="h-3 w-3" /> Confidence — {conf.label} ({alert.confidence}%)
            </p>
            {conf.present.length > 0 && (
              <>
                <p className="text-[10px] font-medium text-muted-foreground">Based on:</p>
                <ul className="space-y-0.5">
                  {conf.present.map((p, i) => (
                    <li key={`p-${i}`} className="text-[11px] text-foreground/80">✓ {p}</li>
                  ))}
                </ul>
              </>
            )}
            {conf.missing.length > 0 && (
              <>
                <p className="mt-1 text-[10px] font-medium text-muted-foreground">Missing:</p>
                <ul className="space-y-0.5">
                  {conf.missing.map((p, i) => (
                    <li key={`m-${i}`} className="text-[11px] text-muted-foreground">• {p}</li>
                  ))}
                </ul>
              </>
            )}
          </div>

          <div className="rounded-lg bg-muted/40 p-2.5">
            <p className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              <ClipboardList className="h-3 w-3" /> Data used
            </p>
            <ul className="space-y-0.5">
              {alert.dataUsed.map((d, i) => (
                <li key={i} className="text-[11px] text-foreground/80">• {d}</li>
              ))}
            </ul>
            <p className="mt-1.5 font-mono text-[10px] text-muted-foreground">Calculation: {alert.calculation}</p>
          </div>
        </div>
      )}
    </Card>
  );
}

function ReasonBlock({ icon, label, text }: { icon: React.ReactNode; label: string; text: string }) {
  return (
    <div>
      <p className="mb-0.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {icon} {label}
      </p>
      <p className="text-[12px] leading-relaxed text-foreground/90">{text}</p>
    </div>
  );
}

// ---------- fix this first (featured priority) ----------
function FixThisFirstCard({
  alert,
  currency,
  onAction,
}: {
  alert: DangerAlert;
  currency: string;
  onAction: (a: DangerAlert, action: AlertAction) => void;
}) {
  const meta = PRIORITY_META[alert.priority];
  const primary: AlertAction =
    alert.actions.find((a) => a === "apply-planner") ??
    alert.actions.find((a) => a === "view-transactions") ??
    alert.actions.find((a) => a === "ask-coach") ??
    "ask-coach";
  const primaryLabel: Record<AlertAction, string> = {
    "apply-planner": "Apply to Planner",
    "view-transactions": "View transactions",
    "ask-coach": "Ask AI Coach",
    "create-budget": "Create budget",
    "mark-resolved": "Mark resolved",
    "remind-later": "Remind later",
    "dismiss": "Dismiss",
  };
  const moneyLine =
    alert.impactMetrics.savingsDelta ??
    alert.impactMetrics.monthlyRecommend ??
    alert.moneyAtRisk ??
    alert.estimatedSavings;

  return (
    <Card className="relative overflow-hidden border-primary/30 bg-primary/5 p-4 pl-5 shadow-soft">
      <span className={cn("absolute left-0 top-0 h-full w-1.5", meta.bar)} />
      <div className="flex items-start gap-3">
        <span className="text-xl leading-none"><Star className="h-5 w-5 fill-gold text-gold" /></span>
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="font-display text-[11px] font-bold uppercase tracking-wider text-primary">⭐ Fix This First</p>
            <Badge variant="secondary" className={cn("h-4 px-1.5 text-[10px]", meta.chip)}>{meta.label}</Badge>
            <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">
              {alert.urgency.emoji} {alert.urgency.label}
            </Badge>
            <Badge variant="outline" className="h-4 px-1.5 text-[10px] text-muted-foreground">
              <Clock className="mr-0.5 h-2.5 w-2.5" /> {alert.fixTime}
            </Badge>
          </div>
          <p className="font-display text-sm font-semibold">{alert.title}</p>
          <p className="text-[12px] text-foreground/90">{alert.problem}</p>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Why it matters</p>
            <p className="text-[12px] text-foreground/85">{alert.why}</p>
          </div>
          {typeof moneyLine === "number" && moneyLine !== 0 && (
            <p className="text-[11px] font-medium text-foreground/90">
              💰 Money impact: <span className="font-semibold">{formatCurrency(Math.abs(moneyLine), currency)}</span>
              {alert.impactMetrics.monthlyRecommend ? "/month" : ""}
            </p>
          )}
          <ImpactChips alert={alert} currency={currency} />
          <div className="flex flex-wrap gap-1.5 pt-1">
            <Button size="sm" className="h-7 text-xs" onClick={() => onAction(alert, primary)}>
              {primaryLabel[primary]}
            </Button>
            {alert.actions.includes("ask-coach") && primary !== "ask-coach" && (
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onAction(alert, "ask-coach")}>
                <MessageSquare className="mr-1 h-3 w-3" /> Ask AI Coach
              </Button>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

// ---------- main ----------
function AlertsPage() {
  const navigate = useNavigate();
  const { data: txs = [] } = useTransactions();
  const { data: categories = [] } = useCategories();
  const { data: budgets = [] } = useBudgets(monthKey());
  const { data: loans = [] } = useLoans();
  const { data: profile } = useProfile();
  const { settings } = useSalarySettings();
  const currency = profile?.currency ?? "INR";

  const [state, setState] = useState<StateMap>(() => readState());
  const [history, setHistory] = useState<HistoryEntry[]>(() => readHistory());
  const [filter, setFilter] = useState<"all" | AlertPriority>("all");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());
  const toggleExpanded = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const now = new Date();
  const survival = useMemo(
    () => computeSurvival({ transactions: txs, loans, salarySettings: settings, now }),
    [txs, loans, settings, now],
  );
  const goals = useMemo(() => readGoals(), []);

  const detected = useMemo(
    () => detectAlerts({ transactions: txs, categories, budgets, loans, salarySettings: settings, survival, goals, now }),
    [txs, categories, budgets, loans, settings, survival, goals, now],
  );

  // Auto-resolve: any previously-active alert not in the current detected set = resolved.
  useEffect(() => {
    const detectedIds = new Set(detected.map((a) => a.id));
    let mutated = false;
    const nextState: StateMap = { ...state };
    const newHistory: HistoryEntry[] = [];
    for (const [id, s] of Object.entries(state)) {
      if (s.status === "active" && !detectedIds.has(id)) {
        nextState[id] = { ...s, status: "resolved", updatedAt: Date.now() };
        mutated = true;
        const past = history.find((h) => h.id === id);
        newHistory.push({
          id,
          title: past?.title ?? id,
          priority: past?.priority ?? "low",
          problem: past?.problem ?? "",
          outcome: "auto-resolved",
          at: Date.now(),
        });
      }
    }
    // Track newly-detected as active for future auto-resolve comparisons.
    for (const a of detected) {
      if (!nextState[a.id] || nextState[a.id].status === "resolved") {
        nextState[a.id] = { status: "active", updatedAt: Date.now() };
        mutated = true;
      }
    }
    if (mutated) {
      writeState(nextState);
      setState(nextState);
      if (newHistory.length) {
        const merged = [...newHistory, ...history];
        writeHistory(merged);
        setHistory(merged);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detected]);

  const now2 = Date.now();
  const active = detected.filter((a) => {
    const s = state[a.id];
    if (!s) return true;
    if (s.status === "dismissed") return false;
    if (s.status === "snoozed" && (s.snoozeUntil ?? 0) > now2) return false;
    return true;
  });
  const filtered = active.filter((a) => filter === "all" || a.priority === filter);
  const summary = useMemo(() => summarize(active), [active]);

  const dismissed = detected.filter((a) => state[a.id]?.status === "dismissed");
  const resolvedHistory = history.slice(0, 20);

  const handleAction = useCallback(
    (a: DangerAlert, action: AlertAction) => {
      switch (action) {
        case "view-transactions":
          navigate({ to: "/transactions" });
          break;
        case "create-budget":
          navigate({ to: "/budgets" });
          break;
        case "apply-planner": {
          try {
            const raw = localStorage.getItem("fintrackr_planner_queue_v1");
            const list = raw ? JSON.parse(raw) : [];
            list.push({
              id: `alert-${a.id}-${Date.now()}`,
              source: "danger-alerts",
              title: a.title,
              detail: a.suggestion,
              createdAt: Date.now(),
            });
            localStorage.setItem("fintrackr_planner_queue_v1", JSON.stringify(list));
            // Mark as resolved so risk score, active count, Fix-This-First card,
            // and the alert list refresh immediately without a page reload.
            const next = { ...state, [a.id]: { status: "resolved" as const, updatedAt: Date.now() } };
            writeState(next);
            setState(next);
            const h = [{ id: a.id, title: a.title, priority: a.priority, problem: a.problem, outcome: "resolved" as const, at: Date.now() }, ...history];
            writeHistory(h); setHistory(h);
            try { window.dispatchEvent(new CustomEvent("fintrackr:planner-updated")); } catch {}
            try { window.dispatchEvent(new CustomEvent("fintrackr:alerts-updated")); } catch {}
            toast.success("Added to Planner", { description: a.suggestion });
          } catch {
            toast.error("Could not add to Planner");
          }
          break;
        }
        case "ask-coach":
          try {
            window.dispatchEvent(new CustomEvent("fintrackr:ask-coach", {
              detail: { question: `Explain the "${a.title}" alert. ${a.problem}` },
            }));
          } catch {}
          navigate({ to: "/insights/ai-coach" });
          break;
        case "dismiss": {
          const next = { ...state, [a.id]: { status: "dismissed" as const, updatedAt: Date.now() } };
          writeState(next);
          setState(next);
          const h = [{ id: a.id, title: a.title, priority: a.priority, problem: a.problem, outcome: "dismissed" as const, at: Date.now() }, ...history];
          writeHistory(h); setHistory(h);
          toast("Alert dismissed");
          break;
        }
        case "remind-later": {
          const next = { ...state, [a.id]: { status: "snoozed" as const, updatedAt: Date.now(), snoozeUntil: Date.now() + 6 * 60 * 60 * 1000 } };
          writeState(next);
          setState(next);
          toast("Reminder set for 6 hours");
          break;
        }
        case "mark-resolved": {
          const next = { ...state, [a.id]: { status: "resolved" as const, updatedAt: Date.now() } };
          writeState(next);
          setState(next);
          const h = [{ id: a.id, title: a.title, priority: a.priority, problem: a.problem, outcome: "resolved" as const, at: Date.now() }, ...history];
          writeHistory(h); setHistory(h);
          try { window.dispatchEvent(new CustomEvent("fintrackr:alerts-updated")); } catch {}
          toast.success("Marked as resolved");
          break;
        }
      }
    },
    [history, navigate, state],
  );

  const priorities: Array<{ v: "all" | AlertPriority; label: string }> = [
    { v: "all", label: "All" },
    { v: "critical", label: "🔴 Critical" },
    { v: "high", label: "🟠 High" },
    { v: "medium", label: "🟡 Medium" },
    { v: "low", label: "🟢 Low" },
  ];

  return (
    <div className="w-full overflow-x-hidden">
      <PageHeader title="⚠️ Danger Alerts" subtitle="AI-powered financial risk radar" />
      <div className="mx-auto w-full max-w-3xl space-y-4 px-4 py-5 sm:px-6 md:px-10">
        <SummaryHeader
          active={summary.totalActive}
          highest={summary.highestPriority}
          savings={summary.potentialSavings}
          risk={summary.financialRiskScore}
          currency={currency}
        />

        <Tabs defaultValue="active" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="active">
              <ListChecks className="mr-1 h-3.5 w-3.5" /> Active
              {active.length > 0 && <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">{active.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="dismissed">
              <BellOff className="mr-1 h-3.5 w-3.5" /> Dismissed
            </TabsTrigger>
            <TabsTrigger value="history">
              <History className="mr-1 h-3.5 w-3.5" /> History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="space-y-3">
            <div className="flex flex-wrap gap-1.5">
              {priorities.map((p) => (
                <Button
                  key={p.v}
                  size="sm"
                  variant={filter === p.v ? "default" : "outline"}
                  className="h-7 text-xs"
                  onClick={() => setFilter(p.v)}
                >
                  {p.label}
                </Button>
              ))}
            </div>

            {filtered.length === 0 ? (
              <Card className="relative overflow-hidden p-6 text-center shadow-soft">
                <span className="absolute left-0 top-0 h-full w-1.5 bg-success" />
                <CheckCircle2 className="mx-auto h-8 w-8 text-success" />
                <p className="mt-2 font-display text-sm font-semibold">✅ All Clear</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {active.length === 0
                    ? "No financial risks detected. You're doing great this month."
                    : `No ${filter} alerts. Adjust the filter to view more.`}
                </p>
              </Card>
            ) : (
              <>
                {filter === "all" && active[0] && (
                  <FixThisFirstCard alert={active[0]} currency={currency} onAction={handleAction} />
                )}
                {filtered.map((a) => (
                  <AlertCard
                    key={a.id}
                    alert={a}
                    currency={currency}
                    onAction={handleAction}
                    expanded={expandedIds.has(a.id)}
                    onToggle={() => toggleExpanded(a.id)}
                  />
                ))}
              </>
            )}
          </TabsContent>

          <TabsContent value="dismissed" className="space-y-3">
            {dismissed.length === 0 ? (
              <Card className="p-6 text-center text-xs text-muted-foreground shadow-soft">
                Nothing dismissed. Alerts you dismiss will appear here.
              </Card>
            ) : (
              dismissed.map((a) => (
                <AlertCard key={a.id} alert={a} currency={currency} onAction={handleAction} />
              ))
            )}
          </TabsContent>

          <TabsContent value="history" className="space-y-2">
            {resolvedHistory.length === 0 ? (
              <Card className="p-6 text-center text-xs text-muted-foreground shadow-soft">
                No resolved alerts yet.
              </Card>
            ) : (
              resolvedHistory.map((h) => {
                const meta = PRIORITY_META[h.priority];
                return (
                  <Card key={`${h.id}-${h.at}`} className="relative overflow-hidden p-3 pl-4 shadow-soft">
                    <span className={cn("absolute left-0 top-0 h-full w-1.5", meta.bar)} />
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm">{meta.emoji}</span>
                          <p className="font-display text-xs font-semibold">{h.title}</p>
                        </div>
                        {h.problem && <p className="mt-0.5 text-[11px] text-muted-foreground">{h.problem}</p>}
                      </div>
                      <div className="text-right">
                        <Badge variant="outline" className="h-4 px-1.5 text-[10px] capitalize">
                          {h.outcome.replace("-", " ")}
                        </Badge>
                        <p className="mt-1 text-[10px] text-muted-foreground">
                          {new Date(h.at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </Card>
                );
              })
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
