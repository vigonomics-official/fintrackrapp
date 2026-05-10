import { createFileRoute } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import {
  Target, Plane, Bike, GraduationCap, Home as HomeIcon, ShieldCheck,
  Sparkles, Plus, Trash2, Trophy, Flag, PiggyBank, Laptop,
} from "lucide-react";
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

export const Route = createFileRoute("/_authenticated/goals")({ component: Goals });

type GoalKind = "savings" | "emergency" | "fire" | "debt" | "investment" | "travel" | "gadget" | "custom";

interface Goal {
  id: string;
  name: string;
  kind: GoalKind;
  target: number;
  current: number;
  monthly: number;
  deadline?: string;
  createdAt: string;
}

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

const STORAGE_KEY = "fintrackr_goals_v1";

const SUGGESTIONS: { name: string; kind: GoalKind; target: number; icon: typeof Target }[] = [
  { name: "Emergency Fund (6 months)", kind: "emergency", target: 300000, icon: ShieldCheck },
  { name: "Europe Trip", kind: "travel", target: 250000, icon: Plane },
  { name: "New Bike", kind: "gadget", target: 150000, icon: Bike },
  { name: "Financial Freedom", kind: "fire", target: 10000000, icon: Flag },
  { name: "Higher Education", kind: "savings", target: 500000, icon: GraduationCap },
  { name: "Down Payment", kind: "savings", target: 1500000, icon: HomeIcon },
];

function loadGoals(): Goal[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveGoals(goals: Goal[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(goals));
}

function Goals() {
  const { data: profile } = useProfile();
  const currency = profile?.currency ?? "INR";
  const [goals, setGoals] = useState<Goal[]>([]);
  const [open, setOpen] = useState(false);
  const [contribOpen, setContribOpen] = useState<string | null>(null);
  const [contribAmount, setContribAmount] = useState("");

  useEffect(() => { setGoals(loadGoals()); }, []);
  useEffect(() => { saveGoals(goals); }, [goals]);

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

  function addGoal(g: Omit<Goal, "id" | "createdAt" | "current">) {
    const goal: Goal = { ...g, id: crypto.randomUUID(), createdAt: new Date().toISOString(), current: 0 };
    setGoals((prev) => [goal, ...prev]);
    toast.success("Goal created", { description: g.name });
  }

  function contribute(id: string, amount: number) {
    setGoals((prev) => prev.map((g) => {
      if (g.id !== id) return g;
      const next = Math.min(g.target, g.current + amount);
      const completed = g.current < g.target && next >= g.target;
      if (completed) toast.success("🎉 Goal achieved!", { description: g.name });
      return { ...g, current: next };
    }));
  }

  function removeGoal(id: string) {
    setGoals((prev) => prev.filter((g) => g.id !== id));
  }

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
                <h3 className="font-display text-base font-semibold">Start with a popular goal</h3>
                <p className="text-xs text-muted-foreground">Tap one to get going — you can edit later.</p>
              </div>
              <div className="grid gap-2.5 sm:grid-cols-2">
                {SUGGESTIONS.map((s) => (
                  <button key={s.name}
                    onClick={() => addGoal({ name: s.name, kind: s.kind, target: s.target, monthly: Math.round(s.target / 24) })}
                    className="group flex items-center gap-3 rounded-xl border bg-card p-3 text-left transition-all hover:border-primary/50 hover:shadow-soft">
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

        {/* Goal cards */}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <AnimatePresence>
            {goals.map((g, i) => {
              const kind = KINDS.find((k) => k.value === g.kind) ?? KINDS[0];
              const Icon = kind.icon;
              const pct = g.target > 0 ? Math.min(100, (g.current / g.target) * 100) : 0;
              const remaining = Math.max(0, g.target - g.current);
              const monthsLeft = g.monthly > 0 ? Math.ceil(remaining / g.monthly) : null;
              const eta = monthsLeft != null
                ? new Date(new Date().setMonth(new Date().getMonth() + monthsLeft)).toLocaleDateString(undefined, { month: "short", year: "numeric" })
                : null;
              const done = g.current >= g.target && g.target > 0;
              return (
                <motion.div key={g.id} layout
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: i * 0.04 }}>
                  <Card className="relative overflow-hidden shadow-soft transition-shadow hover:shadow-elegant">
                    {done && (
                      <div className="absolute right-3 top-3 z-10 flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-success">
                        <Trophy className="h-3 w-3" /> Achieved
                      </div>
                    )}
                    <CardContent className="space-y-4 p-5">
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

                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="outline" className="flex-1"
                          onClick={() => { setContribOpen(g.id); setContribAmount(String(g.monthly || 1000)); }}>
                          <Plus className="mr-1 h-3.5 w-3.5" /> Add savings
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => removeGoal(g.id)} aria-label="Delete goal">
                          <Trash2 className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

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

      {/* Contribute dialog */}
      <Dialog open={!!contribOpen} onOpenChange={(o) => !o && setContribOpen(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add savings</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label>Amount</Label>
            <Input type="number" inputMode="decimal" value={contribAmount} onChange={(e) => setContribAmount(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setContribOpen(null)}>Cancel</Button>
            <Button onClick={() => {
              const amt = Number(contribAmount);
              if (contribOpen && amt > 0) contribute(contribOpen, amt);
              setContribOpen(null);
            }}>Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
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
