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

type GoalKind = "savings" | "emergency" | "fire" | "debt" | "investment" | "travel" | "gadget" | "custom";

const KINDS: { value: GoalKind; label: string }[] = [
  { value: "savings", label: "Savings" },
  { value: "emergency", label: "Emergency Fund" },
  { value: "fire", label: "Financial Freedom" },
  { value: "debt", label: "Debt Payoff" },
  { value: "investment", label: "Investment" },
  { value: "travel", label: "Travel" },
  { value: "gadget", label: "Gadget" },
  { value: "custom", label: "Custom" },
];

const STORAGE_KEY = "fintrackr_goals_v1";

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

function loadGoals(): Goal[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function CreateGoalDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { data: profile } = useProfile();
  const currency = profile?.currency ?? "INR";
  const [name, setName] = useState("");
  const [kind, setKind] = useState<GoalKind>("savings");
  const [target, setTarget] = useState("");
  const [monthly, setMonthly] = useState("");
  const [deadline, setDeadline] = useState("");

  function reset() {
    setName(""); setKind("savings"); setTarget(""); setMonthly(""); setDeadline("");
  }

  function create() {
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
    const existing = loadGoals();
    localStorage.setItem(STORAGE_KEY, JSON.stringify([goal, ...existing]));
    toast.success("Goal created", { description: name });
    reset();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) setTimeout(reset, 200); }}>
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
                {KINDS.map((k) => <SelectItem key={k.value} value={k.value}>{k.label}</SelectItem>)}
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
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={create}>Create goal</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
