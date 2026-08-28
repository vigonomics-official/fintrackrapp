import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useProfile } from "@/hooks/use-finance";
import { toast } from "sonner";
import { GOAL_KINDS, saveGoal, type Goal, type GoalKind } from "@/lib/goals-store";
import { friendlyError } from "@/lib/error-utils";

export function CreateGoalDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { data: profile } = useProfile();
  const currency = profile?.currency ?? "INR";
  const [name, setName] = useState("");
  const [kind, setKind] = useState<GoalKind>("savings");
  const [target, setTarget] = useState("");
  const [monthly, setMonthly] = useState("");
  const [deadline, setDeadline] = useState("");
  const [saving, setSaving] = useState(false);

  function reset() {
    setName(""); setKind("savings"); setTarget(""); setMonthly(""); setDeadline("");
  }

  async function create() {
    if (saving) return;
    if (!name || !Number(target)) {
      toast.error("Add a name and target amount");
      return;
    }
    const goal: Goal = {
      id: crypto.randomUUID(),
      name,
      kind,
      target: Number(target),
      monthly: Number(monthly) || 0,
      deadline: deadline || undefined,
      createdAt: new Date().toISOString(),
      current: 0,
    };
    setSaving(true);
    try {
      await saveGoal(goal);
      toast.success("Goal created", { description: name });
      reset();
      onOpenChange(false);
    } catch (err) {
      toast.error(friendlyError(err as any, "Could not save your goal. Please try again."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (saving) return; onOpenChange(o); if (!o) setTimeout(reset, 200); }}>
      <DialogContent className="w-[calc(100vw-32px)] max-w-md rounded-2xl">
        <DialogHeader><DialogTitle>Create new goal</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="cg-name">Goal name</Label>
            <Input id="cg-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Europe Trip" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cg-kind">Type</Label>
            <Select value={kind} onValueChange={(v) => setKind(v as GoalKind)}>
              <SelectTrigger id="cg-kind"><SelectValue /></SelectTrigger>
              <SelectContent>
                {GOAL_KINDS.map((k) => <SelectItem key={k.value} value={k.value}>{k.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="cg-target">Target ({currency})</Label>
              <Input id="cg-target" type="number" inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cg-monthly">Monthly</Label>
              <Input id="cg-monthly" type="number" inputMode="decimal" value={monthly} onChange={(e) => setMonthly(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cg-deadline">Deadline (optional)</Label>
            <Input id="cg-deadline" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={create} disabled={saving}>{saving ? "Saving…" : "Create goal"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
