import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Trash2, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { formatCurrency } from "@/lib/currency";
import {
  GOAL_KINDS, GOAL_STATUS_LABEL, computeGoalPlan, goalKindLabel,
  stampCompletion, type Goal, type GoalKind,
} from "@/lib/goals-store";

/* ------------------------------- Add / Edit -------------------------------- */

function GoalFields({
  initial, currency, onSave, onCancel, submitLabel,
}: {
  initial?: Goal;
  currency: string;
  onSave: (g: Goal) => void;
  onCancel: () => void;
  submitLabel: string;
}) {
  const [form, setForm] = useState({
    name: initial?.name ?? "",
    kind: (initial?.kind ?? "savings") as GoalKind,
    target: initial?.target ? String(initial.target) : "",
    current: initial?.current != null ? String(initial.current) : "",
    monthly: initial?.monthly ? String(initial.monthly) : "",
    deadline: initial?.deadline ?? "",
  });
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((p) => ({ ...p, [k]: v }));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const target = Number(form.target);
    if (!form.name.trim() || !target || target <= 0) {
      toast.error("Add a goal name and target amount");
      return;
    }
    const current = Math.max(0, Number(form.current) || 0);
    const goal: Goal = stampCompletion({
      id: initial?.id ?? crypto.randomUUID(),
      name: form.name.trim(),
      kind: form.kind,
      target,
      current,
      monthly: Math.max(0, Number(form.monthly) || 0),
      deadline: form.deadline || undefined,
      createdAt: initial?.createdAt ?? new Date().toISOString(),
      completedAt: initial?.completedAt,
    });
    onSave(goal);
  }

  return (
    <form onSubmit={submit} className="space-y-3 pb-2">
      <div className="space-y-1.5">
        <Label htmlFor="goal-name" className="text-xs">Goal name</Label>
        <Input id="goal-name" value={form.name} onChange={(e) => set("name", e.target.value)}
          placeholder="e.g. Emergency fund" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="goal-kind" className="text-xs">Category</Label>
        <Select value={form.kind} onValueChange={(v) => set("kind", v as GoalKind)}>
          <SelectTrigger id="goal-kind"><SelectValue /></SelectTrigger>
          <SelectContent>
            {GOAL_KINDS.map((k) => <SelectItem key={k.value} value={k.value}>{k.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        <div className="space-y-1.5">
          <Label htmlFor="goal-target" className="text-xs">Target ({currency})</Label>
          <Input id="goal-target" type="number" inputMode="decimal" min="0"
            value={form.target} onChange={(e) => set("target", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="goal-current" className="text-xs">Saved so far</Label>
          <Input id="goal-current" type="number" inputMode="decimal" min="0"
            value={form.current} onChange={(e) => set("current", e.target.value)} placeholder="0" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="goal-monthly" className="text-xs">Monthly contribution</Label>
          <Input id="goal-monthly" type="number" inputMode="decimal" min="0"
            value={form.monthly} onChange={(e) => set("monthly", e.target.value)} placeholder="0" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="goal-date" className="text-xs">Target date</Label>
          <Input id="goal-date" type="date" value={form.deadline}
            onChange={(e) => set("deadline", e.target.value)} />
        </div>
      </div>
      <div className="flex gap-2 pt-1">
        <Button type="button" size="sm" variant="ghost" className="flex-1" onClick={onCancel}>Cancel</Button>
        <Button type="submit" size="sm" className="flex-1 bg-gradient-primary">{submitLabel}</Button>
      </div>
    </form>
  );
}

export function GoalFormSheet({
  open, onOpenChange, initial, currency, onSave,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initial?: Goal;
  currency: string;
  onSave: (g: Goal) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[92dvh] overflow-y-auto rounded-t-2xl">
        <SheetHeader className="text-left">
          <SheetTitle>{initial ? "Edit goal" : "Add goal"}</SheetTitle>
          <SheetDescription>
            Saved here only for planning — nothing moves your real money.
          </SheetDescription>
        </SheetHeader>
        {open && (
          <GoalFields
            key={initial?.id ?? "new"}
            initial={initial}
            currency={currency}
            submitLabel={initial ? "Save changes" : "Add goal"}
            onCancel={() => onOpenChange(false)}
            onSave={(g) => { onSave(g); onOpenChange(false); }}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

/* --------------------------------- Detail ---------------------------------- */

export function GoalDetailSheet({
  goal, onOpenChange, currency, onSave, onEdit, onDelete,
}: {
  goal: Goal | null;
  onOpenChange: (o: boolean) => void;
  currency: string;
  onSave: (g: Goal) => void;
  onEdit: (g: Goal) => void;
  onDelete?: (g: Goal) => void | Promise<void>;
}) {
  const [contribution, setContribution] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const plan = goal ? computeGoalPlan(goal) : null;

  function addSavings() {
    if (!goal) return;
    const amt = Number(contribution);
    if (!amt || amt <= 0) { toast.error("Enter an amount to record"); return; }
    const next = stampCompletion({ ...goal, current: Math.max(0, goal.current + amt) });
    onSave(next);
    setContribution("");
    toast.success(
      next.completedAt && !goal.completedAt ? "Goal completed" : "Saved amount updated",
      { description: goal.name },
    );
  }

  return (
    <Sheet open={!!goal} onOpenChange={(o) => { if (!o) { setContribution(""); onOpenChange(false); } }}>
      <SheetContent side="bottom" className="max-h-[92dvh] overflow-y-auto rounded-t-2xl">
        {goal && plan && (
          <>
            <SheetHeader className="text-left">
              <SheetTitle className="flex items-center gap-2">
                {plan.status === "completed" && <Trophy className="h-4 w-4 text-success" />}
                <span className="truncate">{goal.name}</span>
              </SheetTitle>
              <SheetDescription>
                {goalKindLabel(goal.kind)} · {GOAL_STATUS_LABEL[plan.status]}
              </SheetDescription>
            </SheetHeader>

            <div className="space-y-4 pb-4">
              <div>
                <div className="flex items-baseline justify-between text-xs">
                  <span className="font-display text-lg font-bold tabular-nums">
                    {formatCurrency(goal.current, currency)}
                  </span>
                  <span className="text-muted-foreground">of {formatCurrency(goal.target, currency)}</span>
                </div>
                <Progress value={plan.progressPct} className="mt-2 h-2" />
                <div className="mt-1.5 flex justify-between text-[11px] text-muted-foreground">
                  <span>{plan.progressPct.toFixed(0)}% complete</span>
                  <span>{formatCurrency(plan.remaining, currency)} remaining</span>
                </div>
              </div>

              <div className="rounded-xl border bg-muted/30 p-3 text-xs">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Goal plan</p>
                <dl className="mt-2 space-y-1">
                  <Row label="Target" value={formatCurrency(goal.target, currency)} />
                  <Row label="Saved" value={formatCurrency(goal.current, currency)} />
                  <Row label="Remaining" value={formatCurrency(plan.remaining, currency)} />
                  {goal.deadline && (
                    <Row label="Target date" value={new Date(goal.deadline).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })} />
                  )}
                  {plan.monthsRemaining != null && (
                    <Row label="Time remaining" value={`${plan.monthsRemaining} month${plan.monthsRemaining === 1 ? "" : "s"}`} />
                  )}
                  {plan.requiredMonthly != null && (
                    <Row label="Required" value={`${formatCurrency(plan.requiredMonthly, currency)}/month`} />
                  )}
                  {goal.monthly > 0 && (
                    <Row label="Your contribution" value={`${formatCurrency(goal.monthly, currency)}/month`} />
                  )}
                </dl>
                <p className="mt-2 text-[10px] text-muted-foreground">Planning estimates only — no money is moved.</p>
              </div>

              {plan.status !== "completed" && (
                <div className="rounded-xl border p-3 text-xs">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    How to achieve this goal
                  </p>
                  <ol className="mt-2 space-y-1 text-muted-foreground">
                    {plan.requiredMonthly != null ? (
                      <>
                        <li>1. Save {formatCurrency(plan.requiredMonthly, currency)}/month</li>
                        <li>2. Target approximately {formatCurrency(plan.requiredWeekly ?? 0, currency)}/week</li>
                      </>
                    ) : (
                      <li>1. Set a target date to get a monthly and weekly target</li>
                    )}
                    <li>{plan.requiredMonthly != null ? "3." : "2."} Keep the contribution consistent</li>
                    <li>{plan.requiredMonthly != null ? "4." : "3."} Review progress monthly</li>
                  </ol>
                  {plan.status === "behind" && (
                    <p className="mt-2 rounded-lg bg-destructive/10 p-2 text-[11px] text-destructive">
                      Your current contribution may not reach the target by the selected date.
                      {plan.shortfallMonthly ? ` Add about ${formatCurrency(plan.shortfallMonthly, currency)}/month.` : ""}
                    </p>
                  )}
                </div>
              )}

              {plan.status === "completed" && (
                <div className="flex items-center gap-2 rounded-xl bg-success/10 p-3 text-xs text-success">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <span>Goal completed — kept in your history.</span>
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="goal-contrib" className="text-xs">Add money to this goal</Label>
                <div className="flex gap-2">
                  <Input id="goal-contrib" type="number" inputMode="decimal" min="0" value={contribution}
                    onChange={(e) => setContribution(e.target.value)} placeholder="0" />
                  <Button size="sm" onClick={addSavings}>Add money</Button>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Updates this goal&apos;s saved amount only — no transaction is created.
                </p>
              </div>

              <Button variant="outline" size="sm" className="w-full" onClick={() => onEdit(goal)}>
                Edit goal details
              </Button>

              {onDelete && (
                <Button
                  variant="ghost" size="sm"
                  className="w-full text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => setConfirmDelete(true)}
                >
                  <Trash2 className="mr-1.5 h-4 w-4" /> Delete goal
                </Button>
              )}
            </div>

            <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete “{goal.name}”?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This permanently removes the goal and its saved progress from your account.
                    This cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={() => {
                      setConfirmDelete(false);
                      void onDelete?.(goal);
                    }}
                  >
                    Delete permanently
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium tabular-nums">{value}</dd>
    </div>
  );
}
