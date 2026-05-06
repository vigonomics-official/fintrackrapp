import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2, AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useBudgets, useCategories, useTransactions, monthKey, useProfile } from "@/hooks/use-finance";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/currency";
import { PageHeader } from "@/components/finance/PageHeader";

export const Route = createFileRoute("/_authenticated/budgets")({ component: BudgetsPage });

function BudgetsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const month = monthKey();
  const { data: budgets = [] } = useBudgets(month);
  const { data: categories = [] } = useCategories();
  const { data: txs = [] } = useTransactions();
  const { data: profile } = useProfile();
  const currency = profile?.currency ?? "USD";

  const [open, setOpen] = useState(false);
  const [categoryId, setCategoryId] = useState("");
  const [limit, setLimit] = useState("");

  const expenseCats = categories.filter(c => c.type === "expense");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const num = Number(limit);
    if (!categoryId || !num) return toast.error("Pick a category and amount");
    const { error } = await supabase.from("budgets").upsert({
      user_id: user.id, category_id: categoryId, monthly_limit: num, month,
    }, { onConflict: "user_id,category_id,month" });
    if (error) return toast.error(error.message);
    toast.success("Budget saved");
    setOpen(false); setLimit(""); setCategoryId("");
    qc.invalidateQueries({ queryKey: ["budgets"] });
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("budgets").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["budgets"] });
  };

  return (
    <div>
      <PageHeader title="Budgets" subtitle={new Date(month).toLocaleDateString(undefined, { month: "long", year: "numeric" })}
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-primary"><Plus className="mr-1 h-4 w-4" />New budget</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Set monthly budget</DialogTitle></DialogHeader>
              <form onSubmit={submit} className="space-y-4">
                <div>
                  <Label>Category</Label>
                  <Select value={categoryId} onValueChange={setCategoryId}>
                    <SelectTrigger><SelectValue placeholder="Pick category" /></SelectTrigger>
                    <SelectContent>
                      {expenseCats.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Monthly limit</Label>
                  <Input type="number" min="0" step="0.01" value={limit} onChange={e => setLimit(e.target.value)} />
                </div>
                <Button type="submit" className="w-full bg-gradient-primary">Save</Button>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid gap-4 px-6 py-6 md:grid-cols-2 md:px-10 lg:grid-cols-3">
        {budgets.length === 0 && <p className="text-sm text-muted-foreground">No budgets yet. Create your first to start tracking.</p>}
        {budgets.map((b) => {
          const c = categories.find(x => x.id === b.category_id);
          const spent = txs.filter(t => t.type === "expense" && t.category_id === b.category_id && t.transaction_date.startsWith(month.slice(0, 7)))
            .reduce((s, t) => s + t.amount, 0);
          const pct = (spent / b.monthly_limit) * 100;
          const overBudget = pct > 100;
          const nearing = pct > 80 && !overBudget;
          return (
            <Card key={b.id} className="shadow-soft">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full" style={{ background: c?.color ?? "#94a3b8" }} />
                    <h3 className="font-display font-semibold">{c?.name ?? "Category"}</h3>
                  </div>
                  <Button size="icon" variant="ghost" onClick={() => remove(b.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
                <p className="mt-3 font-display text-2xl font-bold">{formatCurrency(spent, currency)}</p>
                <p className="text-xs text-muted-foreground">of {formatCurrency(b.monthly_limit, currency)}</p>
                <Progress value={Math.min(100, pct)} className="mt-3" />
                {overBudget && <p className="mt-2 flex items-center gap-1 text-xs text-destructive"><AlertTriangle className="h-3 w-3" /> Over budget</p>}
                {nearing && <p className="mt-2 flex items-center gap-1 text-xs text-gold"><AlertTriangle className="h-3 w-3" /> Nearing limit</p>}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
