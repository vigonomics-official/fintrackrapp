import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { friendlyError } from "@/lib/error-utils";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
import { ExpensesTabs } from "@/components/finance/ExpensesTabs";
import { cn } from "@/lib/utils";

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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState("");
  const [limit, setLimit] = useState("");

  const expenseCats = categories.filter(c => c.type === "expense");

  const openNew = () => {
    setEditingId(null); setCategoryId(""); setLimit(""); setOpen(true);
  };
  const openEdit = (id: string, catId: string, currentLimit: number) => {
    setEditingId(id); setCategoryId(catId); setLimit(String(currentLimit)); setOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const num = Number(limit);
    if (!categoryId || !num) return toast.error("Pick a category and amount");
    const { error } = await supabase.from("budgets").upsert({
      user_id: user.id, category_id: categoryId, monthly_limit: num, month,
    }, { onConflict: "user_id,category_id,month" });
    if (error) return toast.error(friendlyError(error));
    toast.success(editingId ? "Limit updated" : "Safe limit set");
    setOpen(false); setLimit(""); setCategoryId(""); setEditingId(null);
    qc.invalidateQueries({ queryKey: ["budgets"] });
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("budgets").delete().eq("id", id);
    if (error) return toast.error(friendlyError(error));
    qc.invalidateQueries({ queryKey: ["budgets"] });
  };

  return (
    <div>
      <ExpensesTabs />
      <PageHeader
        title="Monthly Safe Limits"
        subtitle="Stay within your salary till the next payday."
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="bg-gradient-primary" onClick={openNew}>
                <Plus className="mr-1 h-4 w-4" />Set limit
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingId ? "Edit safe limit" : "Set monthly safe limit"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={submit} className="space-y-4">
                <div>
                  <Label>Category</Label>
                  <Select value={categoryId} onValueChange={setCategoryId} disabled={!!editingId}>
                    <SelectTrigger><SelectValue placeholder="Pick category" /></SelectTrigger>
                    <SelectContent>
                      {expenseCats.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Monthly safe limit</Label>
                  <Input type="number" min="0" step="0.01" value={limit} onChange={e => setLimit(e.target.value)} placeholder="e.g. 3000" />
                  <p className="mt-1 text-xs text-muted-foreground">We'll warn you at 80% usage.</p>
                </div>
                <Button type="submit" className="w-full bg-gradient-primary">{editingId ? "Update" : "Save"}</Button>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid gap-3 px-5 py-5 sm:grid-cols-2 md:px-10 lg:grid-cols-3">
        {budgets.length === 0 && (
          <Card className="shadow-soft sm:col-span-2 lg:col-span-3">
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              No safe limits yet. Set one to protect your salary.
            </CardContent>
          </Card>
        )}
        {budgets.map((b) => {
          const c = categories.find(x => x.id === b.category_id);
          const spent = txs.filter(t => t.type === "expense" && t.category_id === b.category_id && t.transaction_date.startsWith(month.slice(0, 7)))
            .reduce((s, t) => s + t.amount, 0);
          const pct = (spent / b.monthly_limit) * 100;
          const status: "safe" | "warning" | "critical" =
            pct >= 100 ? "critical" : pct >= 80 ? "warning" : "safe";
          const tone = {
            safe:     { dot: "bg-success",     text: "text-success",     label: "On track" },
            warning:  { dot: "bg-gold",        text: "text-gold",        label: "Slow down" },
            critical: { dot: "bg-destructive", text: "text-destructive", label: "Over limit" },
          }[status];
          const remaining = Math.max(0, b.monthly_limit - spent);
          return (
            <Card key={b.id} className="shadow-soft">
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: c?.color ?? "#94a3b8" }} />
                    <h3 className="truncate font-display text-sm font-semibold">{c?.name ?? "Category"}</h3>
                  </div>
                  <div className="flex items-center gap-0.5">
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(b.id, b.category_id!, b.monthly_limit)}>
                      <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => remove(b.id)}>
                      <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                  </div>
                </div>
                <div className="mt-2 flex items-baseline justify-between gap-2">
                  <p className="font-display text-lg font-bold tabular-nums">{formatCurrency(spent, currency)}</p>
                  <p className="text-xs text-muted-foreground tabular-nums">/ {formatCurrency(b.monthly_limit, currency)}</p>
                </div>
                <Progress
                  value={Math.min(100, pct)}
                  className="mt-2 h-1.5"
                  indicatorClassName={cn(
                    status === "safe" && "bg-success",
                    status === "warning" && "bg-gold",
                    status === "critical" && "bg-destructive",
                  )}
                />
                <div className="mt-2 flex items-center justify-between text-[11px]">
                  <span className={cn("flex items-center gap-1 font-medium", tone.text)}>
                    <span className={cn("h-1.5 w-1.5 rounded-full", tone.dot)} />
                    {tone.label}
                  </span>
                  <span className="text-muted-foreground tabular-nums">
                    {status === "critical" ? `Over by ${formatCurrency(spent - b.monthly_limit, currency)}` : `${formatCurrency(remaining, currency)} left`}
                  </span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
