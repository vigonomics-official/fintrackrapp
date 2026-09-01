import { createFileRoute } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import {
  Target, Plane, Bike, GraduationCap, Home as HomeIcon, ShieldCheck,
  Sparkles, Plus, Trophy, Flag, PiggyBank, Laptop, ChevronDown,
} from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/finance/PageHeader";
import { useProfile } from "@/hooks/use-finance";
import { formatCurrency } from "@/lib/currency";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/goals")({
  component: Goals,
  head: () => ({
    meta: [
      { title: "Savings Goals — FinTrackr" },
      { name: "description", content: "Plan and track savings goals with progress and target dates." },
      { property: "og:title", content: "Savings Goals — FinTrackr" },
      { property: "og:description", content: "Plan and track savings goals with progress and target dates." },
      { property: "og:url", content: "https://fintrackrapp.lovable.app/goals" },
      { name: "twitter:title", content: "Savings Goals — FinTrackr" },
      { name: "twitter:description", content: "Plan and track savings goals with progress and target dates." },
    ],
    links: [{ rel: "canonical", href: "https://fintrackrapp.lovable.app/goals" }],
  }),
});

import {
  loadGoals, syncGoalsFromCloud, saveGoal, removeGoal as removeGoalCloud,
  isCompleted, GOALS_EVENT, type Goal, type GoalKind,
} from "@/lib/goals-store";
import { GoalFormSheet, GoalDetailSheet } from "@/components/finance/GoalSheets";
import { friendlyError } from "@/lib/error-utils";

const KINDS: { value: GoalKind; label: string; icon: typeof Target; tone: string }[] = [
  { value: "savings", label: "Savings", icon: PiggyBank, tone: "bg-success/15 text-success" },
  { value: "emergency", label: "Emergency Fund", icon: ShieldCheck, tone: "bg-primary/15 text-primary" },
  { value: "fire", label: "Financial Freedom", icon: Flag, tone: "bg-gold/15 text-gold-foreground" },
  { value: "debt", label: "Debt Payoff", icon: Trophy, tone: "bg-destructive/15 text-destructive" },
  { value: "investment", label: "Investment", icon: Sparkles, tone: "bg-primary/15 text-primary" },
  { value: "travel", label: "Travel", icon: Plane, tone: "bg-info/15 text-info" },
  { value: "gadget", label: "Gadget", icon: Laptop, tone: "bg-secondary text-secondary-foreground" },
  { value: "custom", label: "Custom", icon: Target, tone: "bg-muted text-muted-foreground" },
];


const SUGGESTIONS: { name: string; kind: GoalKind; target: number; icon: typeof Target }[] = [
  { name: "Emergency Fund (6 months)", kind: "emergency", target: 300000, icon: ShieldCheck },
  { name: "Europe Trip", kind: "travel", target: 250000, icon: Plane },
  { name: "New Bike", kind: "gadget", target: 150000, icon: Bike },
  { name: "Financial Freedom", kind: "fire", target: 10000000, icon: Flag },
  { name: "Higher Education", kind: "savings", target: 500000, icon: GraduationCap },
  { name: "Down Payment", kind: "savings", target: 1500000, icon: HomeIcon },
];

function Goals() {
  const { data: profile } = useProfile();
  const currency = profile?.currency ?? "INR";
  const [goals, setGoals] = useState<Goal[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Goal | undefined>(undefined);
  const [editOpen, setEditOpen] = useState(false);

  // Cloud is the source of truth; the local cache is only a fallback while the
  // first sync is in flight and is migrated up by syncGoalsFromCloud().
  useEffect(() => {
    setGoals(loadGoals());
    let alive = true;
    const load = () => syncGoalsFromCloud()
      .then((g) => { if (alive) setGoals(g); })
      .catch(() => toast.error("Could not load your goals from the cloud.", {
        action: { label: "Retry", onClick: () => { void load(); } },
      }));
    void load();
    const refresh = () => setGoals(loadGoals());
    window.addEventListener(GOALS_EVENT, refresh);
    return () => { alive = false; window.removeEventListener(GOALS_EVENT, refresh); };
  }, []);

  // Context-aware FAB: open Create Goal dialog
  useEffect(() => {
    const h = () => setOpen(true);
    window.addEventListener("fintrackr:fab", h);
    return () => window.removeEventListener("fintrackr:fab", h);
  }, []);

  const totals = useMemo(() => {
    const target = goals.reduce((s, g) => s + g.target, 0);
    const current = goals.reduce((s, g) => s + g.current, 0);
    const monthly = goals.reduce((s, g) => s + g.monthly, 0);
    return { target, current, monthly, pct: target > 0 ? (current / target) * 100 : 0 };
  }, [goals]);

  async function addGoal(g: Omit<Goal, "id" | "createdAt" | "current">) {
    if (busy) return;
    const goal: Goal = { ...g, id: crypto.randomUUID(), createdAt: new Date().toISOString(), current: 0 };
    setBusy(true);
    try {
      const saved = await saveGoal(goal);
      // saveGoal() already refreshed the cache (and this view via GOALS_EVENT),
      // so replace-or-prepend instead of blindly prepending a duplicate.
      setGoals((prev) => (prev.some((x) => x.id === saved.id)
        ? prev.map((x) => (x.id === saved.id ? saved : x))
        : [saved, ...prev]));
      toast.success("Goal created", { description: g.name });
    } catch (err) {
      toast.error(friendlyError(err as any, "Could not save your goal. Please try again."));
    } finally {
      setBusy(false);
    }
  }

  async function updateGoal(goal: Goal) {
    const previous = goals;
    setGoals((prev) => prev.map((g) => (g.id === goal.id ? goal : g)));
    try {
      const saved = await saveGoal(goal);
      setGoals((prev) => prev.map((g) => (g.id === saved.id ? saved : g)));
    } catch (err) {
      setGoals(previous);
      toast.error(friendlyError(err as any, "Could not update this goal. Please try again."));
    }
  }

  async function removeGoal(goal: Goal) {
    if (busy) return;
    const previous = goals;
    setBusy(true);
    setDetailId(null);
    setGoals((prev) => prev.filter((g) => g.id !== goal.id));
    try {
      await removeGoalCloud(goal.id);
      toast.success("Goal deleted", { description: goal.name });
    } catch (err) {
      setGoals(previous);
      toast.error(friendlyError(err as any, "Could not delete this goal. Please try again."));
    } finally {
      setBusy(false);
    }
  }

  const activeGoals = goals.filter((g) => !isCompleted(g));
  const completedGoals = goals.filter((g) => isCompleted(g));
  const detail = goals.find((g) => g.id === detailId) ?? null;

  return (
    <div>
      <PageHeader
        title="Goals"
        subtitle="Track your dreams, milestones & financial freedom"
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5"><Plus className="h-4 w-4" /> New goal</Button>
            </DialogTrigger>
            <NewGoalDialog onCreate={(g) => { addGoal(g); setOpen(false); }} currency={currency} />
          </Dialog>
        }
      />

      <div className="space-y-5 px-5 py-5 md:space-y-6 md:px-10 md:py-7">
        {/* Hero summary */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="overflow-hidden border-0 bg-gradient-hero text-primary-foreground shadow-elegant">
            <CardContent className="relative p-6">
              <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-gold/20 blur-3xl" />
              <div className="relative">
                <p className="text-[11px] font-medium uppercase tracking-[0.18em] opacity-70">Total saved toward goals</p>
                <p className="mt-2 font-display text-3xl font-bold leading-none md:text-4xl">{formatCurrency(totals.current, currency)}</p>
                <p className="mt-1.5 text-xs opacity-90">of {formatCurrency(totals.target, currency)} · {totals.pct.toFixed(0)}% complete</p>
                <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/20">
                  <motion.div className="h-full bg-gold"
                    initial={{ width: 0 }} animate={{ width: `${Math.min(100, totals.pct)}%` }} transition={{ duration: 0.8 }} />
                </div>
                <div className="mt-4 flex items-center gap-4 text-xs opacity-90">
                  <span>{goals.length} active</span>
                  <span>•</span>
                  <span>Monthly commit {formatCurrency(totals.monthly, currency)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Empty state with suggestions */}
        {goals.length === 0 && (
          <Card className="shadow-soft">
            <CardContent className="space-y-4 p-5">
              <div>
                <h3 className="font-display text-base font-semibold">Add your first goal</h3>
                <p className="text-xs text-muted-foreground">
                  Tap a popular goal to get going, or use “New goal” — you can edit everything later.
                </p>
              </div>
              <div className="grid gap-2.5 sm:grid-cols-2">
                {SUGGESTIONS.map((s) => (
                  <button key={s.name} disabled={busy}
                    onClick={() => addGoal({ name: s.name, kind: s.kind, target: s.target, monthly: Math.round(s.target / 24) })}
                    className="group flex items-center gap-3 rounded-xl border bg-card p-3 text-left transition-all hover:border-primary/50 hover:shadow-soft disabled:opacity-60">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <s.icon className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{s.name}</p>
                      <p className="text-[11px] text-muted-foreground">{formatCurrency(s.target, currency)}</p>
                    </div>
                    <Plus className="h-4 w-4 text-muted-foreground transition-transform group-hover:scale-125 group-hover:text-primary" />
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Active goals */}
        {activeGoals.length > 0 && (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <AnimatePresence>
              {activeGoals.map((g, i) => (
                <GoalTile key={g.id} goal={g} index={i} currency={currency} onOpen={() => setDetailId(g.id)} />
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* Completed goals */}
        {completedGoals.length > 0 && (
          <Collapsible defaultOpen={activeGoals.length === 0}>
            <CollapsibleTrigger className="flex w-full items-center justify-between rounded-xl border bg-card px-4 py-3 text-left">
              <span className="flex items-center gap-2 text-sm font-semibold">
                <Trophy className="h-4 w-4 text-success" /> Completed goals
                <span className="text-xs font-normal text-muted-foreground">({completedGoals.length})</span>
              </span>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-4">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {completedGoals.map((g, i) => (
                  <GoalTile key={g.id} goal={g} index={i} currency={currency} onOpen={() => setDetailId(g.id)} />
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Smart insights */}
        {goals.length > 0 && (
          <Card className="shadow-soft">
            <CardContent className="flex items-start gap-3 p-5">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold/15 text-gold-foreground">
                <Sparkles className="h-5 w-5" />
              </span>
              <div className="text-sm">
                <p className="font-medium">Smart recommendation</p>
                <p className="mt-0.5 text-muted-foreground">
                  Committing {formatCurrency(totals.monthly, currency)}/mo will get you to{" "}
                  {totals.target > 0 ? Math.ceil((totals.target - totals.current) / Math.max(1, totals.monthly)) : 0} months from financial milestones.
                  Stay consistent — small wins compound.
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <GoalDetailSheet
        goal={detail}
        onOpenChange={() => setDetailId(null)}
        currency={currency}
        onSave={(g) => { void updateGoal(g); }}
        onEdit={(g) => { setDetailId(null); setEditing(g); setEditOpen(true); }}
        onDelete={(g) => removeGoal(g)}
      />
      <GoalFormSheet
        open={editOpen}
        onOpenChange={(o) => { setEditOpen(o); if (!o) setEditing(undefined); }}
        initial={editing}
        currency={currency}
        onSave={(g) => { void updateGoal(g); }}
      />
    </div>
  );
}

function GoalTile({
  goal: g, index, currency, onOpen,
}: { goal: Goal; index: number; currency: string; onOpen: () => void }) {
  const kind = KINDS.find((k) => k.value === g.kind) ?? KINDS[0];
  const Icon = kind.icon;
  const pct = g.target > 0 ? Math.min(100, (g.current / g.target) * 100) : 0;
  const remaining = Math.max(0, g.target - g.current);
  const monthsLeft = g.monthly > 0 && remaining > 0 ? Math.ceil(remaining / g.monthly) : null;
  const eta = monthsLeft != null
    ? new Date(new Date().setMonth(new Date().getMonth() + monthsLeft)).toLocaleDateString(undefined, { month: "short", year: "numeric" })
    : null;
  const done = g.target > 0 && g.current >= g.target;

  return (
    <motion.div layout
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
      transition={{ delay: index * 0.04 }}>
      <Card className="relative overflow-hidden shadow-soft transition-shadow hover:shadow-elegant">
        {done && (
          <div className="absolute right-3 top-3 z-10 flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-success">
            <Trophy className="h-3 w-3" /> Completed
          </div>
        )}
        <CardContent className="p-0">
          <button type="button" onClick={onOpen} className="w-full space-y-4 p-5 text-left">
            <div className="flex items-start gap-3">
              <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${kind.tone}`}>
                <Icon className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-display text-base font-semibold">{g.name}</p>
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{kind.label}</p>
              </div>
            </div>

            <div>
              <div className="flex items-baseline justify-between text-xs">
                <span className="font-display text-lg font-bold tabular-nums text-foreground">
                  {formatCurrency(g.current, currency)}
                </span>
                <span className="text-muted-foreground">/ {formatCurrency(g.target, currency)}</span>
              </div>
              <Progress value={pct} className="mt-2 h-2" />
              <div className="mt-1.5 flex items-center justify-between text-[11px] text-muted-foreground">
                <span>{pct.toFixed(0)}% complete</span>
                {eta && !done && <span>ETA {eta}</span>}
              </div>
            </div>

            <p className="text-[11px] font-medium text-primary">
              {done ? "View details" : "Tap for details & add money"}
            </p>
          </button>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function NewGoalDialog({ onCreate, currency }: { onCreate: (g: Omit<Goal, "id" | "createdAt" | "current">) => void; currency: string }) {
  const [name, setName] = useState("");
  const [kind, setKind] = useState<GoalKind>("savings");
  const [target, setTarget] = useState("");
  const [monthly, setMonthly] = useState("");
  const [deadline, setDeadline] = useState("");

  return (
    <DialogContent>
      <DialogHeader><DialogTitle>Create new goal</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label>Goal name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Europe Trip" />
        </div>
        <div className="space-y-1.5">
          <Label>Type</Label>
          <Select value={kind} onValueChange={(v) => setKind(v as GoalKind)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {KINDS.map((k) => <SelectItem key={k.value} value={k.value}>{k.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Target ({currency})</Label>
            <Input type="number" inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Monthly</Label>
            <Input type="number" inputMode="decimal" value={monthly} onChange={(e) => setMonthly(e.target.value)} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Deadline (optional)</Label>
          <Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
        </div>
      </div>
      <DialogFooter>
        <Button onClick={() => {
          if (!name || !Number(target)) return;
          onCreate({ name, kind, target: Number(target), monthly: Number(monthly) || 0, deadline: deadline || undefined });
        }}>Create goal</Button>
      </DialogFooter>
    </DialogContent>
  );
}
