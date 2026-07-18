import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BellOff,
  Brain,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  History,
  Lightbulb,
  ListChecks,
  MessageSquare,
  Sparkles,
  TrendingDown,
} from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

// ---------- alert card ----------
function AlertCard({
  alert,
  currency,
  onAction,
}: {
  alert: DangerAlert;
  currency: string;
  onAction: (a: DangerAlert, action: AlertAction) => void;
}) {
  const [open, setOpen] = useState(false);
  const meta = PRIORITY_META[alert.priority];

  return (
    <Card className="relative overflow-hidden p-4 pl-5 shadow-soft">
      <span className={cn("absolute left-0 top-0 h-full w-1.5", meta.bar)} />
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start gap-3 text-left"
        aria-expanded={open}
      >
        <span className="text-xl leading-none">{meta.emoji}</span>
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="font-display text-sm font-semibold">{alert.title}</p>
            <Badge variant="secondary" className={cn("h-4 px-1.5 text-[10px]", meta.chip)}>
              {meta.label}
            </Badge>
            {alert.isPredictive && (
              <Badge variant="outline" className="h-4 px-1.5 text-[10px]">
                <Sparkles className="mr-0.5 h-2.5 w-2.5" /> Predictive
              </Badge>
            )}
            <Badge variant="outline" className="h-4 px-1.5 text-[10px] text-muted-foreground">
              {alert.confidence}% confident
            </Badge>
          </div>
          <p className="text-sm text-foreground/90">{alert.problem}</p>
          {alert.estimatedSavings > 0 && (
            <p className="text-[11px] font-medium text-success">
              Potential save: {formatCurrency(alert.estimatedSavings, currency)}
            </p>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />}
      </button>

      {open && (
        <div className="mt-3 space-y-3 border-t pt-3">
          <ReasonBlock icon={<Brain className="h-3.5 w-3.5" />} label="Why this is flagged" text={alert.why} />
          <ReasonBlock icon={<TrendingDown className="h-3.5 w-3.5" />} label="Impact" text={alert.impact} />
          <ReasonBlock icon={<Lightbulb className="h-3.5 w-3.5" />} label="Suggested action" text={alert.suggestion} />
          <ReasonBlock icon={<AlertTriangle className="h-3.5 w-3.5" />} label="Why this priority" text={alert.priorityReason} />

          <div className="rounded-lg bg-muted/40 p-2.5">
            <p className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              <ClipboardList className="h-3 w-3" /> Data used
            </p>
            <ul className="space-y-0.5">
              {alert.dataUsed.map((d, i) => (
                <li key={i} className="text-[11px] text-foreground/80">• {d}</li>
              ))}
            </ul>
            <p className="mt-1.5 font-mono text-[10px] text-muted-foreground">{alert.calculation}</p>
          </div>

          <div className="flex flex-wrap gap-1.5">
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
            {alert.actions.includes("apply-planner") && (
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onAction(alert, "apply-planner")}>
                Apply to Planner
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
        case "apply-planner":
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
            toast.success("Added to Planner", { description: a.suggestion });
          } catch {
            toast.error("Could not add to Planner");
          }
          break;
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
              filtered.map((a) => <AlertCard key={a.id} alert={a} currency={currency} onAction={handleAction} />)
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
