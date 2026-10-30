import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { friendlyError } from "@/lib/error-utils";
import { Plus, Pencil, Trash2, ChevronLeft, ChevronRight, Sparkles, Copy, X } from "lucide-react";
import { Link } from "@tanstack/react-router";
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
import { useBudgetTransactions } from "@/hooks/use-budget-transactions";
import { useBudgets, useCategories, monthKey, useProfile } from "@/hooks/use-finance";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/currency";
import { PageHeader } from "@/components/finance/PageHeader";
import { ExpensesTabs } from "@/components/finance/ExpensesTabs";
import { cn } from "@/lib/utils";
import {
  STANDARD_BUDGET_CATEGORIES, budgetIncome, budgetRow, isNonSpendingCategory, matchStandard,
  shiftMonth, spentByCategory, suggestBudget,
} from "@/lib/budget";

type DraftRow = { key: string; categoryId: string | null; name: string; amount: string };
const monthLabel = (m: string) =>
  new Date(Number(m.slice(0, 4)), Number(m.slice(5, 7)) - 1, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });

export const Route = createFileRoute("/_authenticated/budgets")({
  component: BudgetsPage,
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Budgets — FinSurvive" },
      { name: "description", content: "Set monthly category budgets and track spending against safe limits." },
      { property: "og:title", content: "Budgets — FinSurvive" },
      { property: "og:description", content: "Set monthly category budgets and track spending against safe limits." },
      { property: "og:url", content: "https://fintrackrapp.lovable.app/budgets" },
      { name: "twitter:title", content: "Budgets — FinSurvive" },
      { name: "twitter:description", content: "Set monthly category budgets and track spending against safe limits." },
    ],
    links: [{ rel: "canonical", href: "https://fintrackrapp.lovable.app/budgets" }],
  }),
});

function BudgetsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [month, setMonth] = useState(monthKey());
  const budgetsQuery = useBudgets(month);
  const previousQuery = useBudgets(shiftMonth(month, -1));
  const categoriesQuery = useCategories();
  const transactionsQuery = useBudgetTransactions(month);
  const profileQuery = useProfile();
  const budgets = budgetsQuery.data ?? [];
  const prevBudgets = previousQuery.data ?? [];
  const categories = categoriesQuery.data ?? [];
  const txs = transactionsQuery.data ?? [];
  const profile = profileQuery.data;
  const loading = budgetsQuery.isPending || categoriesQuery.isPending || transactionsQuery.isPending || profileQuery.isPending;
  const failed = budgetsQuery.isError || categoriesQuery.isError || transactionsQuery.isError || profileQuery.isError;
  const currency = profile?.currency ?? "INR";
  const salary = profile && "monthly_salary" in profile ? Number(profile.monthly_salary) : null;
  const income = budgetIncome(txs, month, salary);

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState("");
  const [customName, setCustomName] = useState("");
  const [limit, setLimit] = useState("");
  const [saving, setSaving] = useState(false);

  const [draftOpen, setDraftOpen] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftNote, setDraftNote] = useState("");
  const [draft, setDraft] = useState<DraftRow[]>([]);

  useEffect(() => {
    setOpen(false); setDraftOpen(false); setDraft([]); setEditingId(null);
    setCategoryId(""); setCustomName(""); setLimit("");
  }, [user?.id, month]);

  const expenseCats = categories.filter(c => c.type === "expense" && !isNonSpendingCategory(c.name));
  const budgetedIds = new Set(budgets.map(b => b.category_id));
  const spent = spentByCategory(txs, month, categories);
  const planned = budgets.reduce((s, b) => s + b.monthly_limit, 0);
  const totalSpent = budgets.reduce((s, b) => s + (spent.get(b.category_id ?? "") ?? 0), 0);

  const availableCats = expenseCats.filter(c => !budgetedIds.has(c.id));
  const missingStandard = STANDARD_BUDGET_CATEGORIES.filter(s => !matchStandard(categories, s.name));

  const openNew = () => {
    setEditingId(null); setCategoryId(""); setCustomName(""); setLimit(""); setOpen(true);
  };
  const openEdit = (id: string, catId: string, currentLimit: number) => {
    setEditingId(id); setCategoryId(catId); setLimit(String(currentLimit)); setOpen(true);
  };

  /** Returns an expense category id for a name, reusing an existing one (case-insensitive) before creating. */
  const ensureCategory = async (name: string): Promise<string> => {
    if (!user) throw new Error("Sign in required");
    const clean = name.trim();
    if (isNonSpendingCategory(clean)) throw new Error("non-spending");
    const existing = categories.find(c => c.type === "expense" && c.name.trim().toLowerCase() === clean.toLowerCase())
      ?? matchStandard(categories, clean);
    if (existing) return existing.id;
    const { data, error } = await supabase.from("categories")
      .insert({ user_id: user.id, name: clean, type: "expense", icon: "Tag" }).select("id").single();
    if (error) throw error;
    return data.id;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || saving || loading || failed) return;
    const num = Number(limit);
    if (!categoryId || limit === "" || !Number.isFinite(num) || num < 0) return toast.error("Pick a category and amount");
    if (categoryId === "custom" && !customName.trim()) return toast.error("Enter a category name");
    setSaving(true);
    try {
      let catId = categoryId;
      if (categoryId === "custom") catId = await ensureCategory(customName);
      else if (categoryId.startsWith("std:")) catId = await ensureCategory(categoryId.slice(4));
      if (!editingId && budgetedIds.has(catId)) { toast.error("This category already has a limit this month"); return; }
      const record = { user_id: user.id, category_id: catId, monthly_limit: num, month };
      const { error } = editingId
        ? await supabase.from("budgets").update({ monthly_limit: num }).eq("id", editingId).eq("user_id", user.id).eq("month", month)
        : await supabase.from("budgets").insert(record);
      if (error) throw error;
      toast.success(editingId ? "Limit updated" : "Safe limit set");
      setOpen(false); setLimit(""); setCategoryId(""); setCustomName(""); setEditingId(null);
      qc.invalidateQueries({ queryKey: ["budgets"] });
      qc.invalidateQueries({ queryKey: ["categories"] });
    } catch (err) {
      toast.error((err as Error)?.message === "non-spending" ? "Transfers, repayments and investments can't have spending limits" : friendlyError(err as any));
    } finally { setSaving(false); }
  };

  const remove = async (id: string) => {
    if (!user || saving) return;
    const { error } = await supabase.from("budgets").delete().eq("id", id).eq("user_id", user.id).eq("month", month);
    if (error) return toast.error(friendlyError(error));
    qc.invalidateQueries({ queryKey: ["budgets"] });
  };

  const openDraft = (title: string, note: string, rows: DraftRow[]) => {
    setDraftTitle(title); setDraftNote(note); setDraft(rows); setDraftOpen(true);
  };

  const startSuggest = () => {
    const { items, hasHistory } = suggestBudget(txs, categories, month, income);
    const rows = items.filter(i => !i.categoryId || !budgetedIds.has(i.categoryId))
      .map(i => ({ key: i.categoryId ?? `new:${i.name}`, categoryId: i.categoryId, name: i.name, amount: String(i.amount) }));
    if (items.length === 0) {
      return toast.info("Not enough spending history yet. Add your salary in settings or set limits manually.");
    }
    if (rows.length === 0) return toast.info("Every suggested category already has a limit this month.");
    openDraft(
      "Suggested budget",
      hasHistory
        ? "Based on months with recorded category spending in the previous 3 months. Existing limits are kept."
        : "Editable starter amounts from recorded income or your configured salary—not historical spending. Existing limits are kept.",
      rows,
    );
  };

  const startCopy = () => {
    const rows: DraftRow[] = [];
    for (const b of prevBudgets) {
      if (!b.category_id || budgetedIds.has(b.category_id)) continue;
      const c = categories.find(c => c.id === b.category_id);
      if (!c || isNonSpendingCategory(c.name)) continue;
      rows.push({ key: b.category_id, categoryId: b.category_id, name: c.name, amount: String(b.monthly_limit) });
    }
    if (prevBudgets.length === 0) return toast.info(`No limits were set in ${monthLabel(shiftMonth(month, -1))}.`);
    if (rows.length === 0) return toast.info("All of last month's categories already have limits this month.");
    openDraft(`Copy from ${monthLabel(shiftMonth(month, -1))}`, "Review and edit the amounts before saving. Existing limits are kept.", rows);
  };

  const saveDraft = async () => {
    if (!user || saving || loading || failed) return;
    const valid = draft.filter(r => r.amount !== "" && Number.isFinite(Number(r.amount)) && Number(r.amount) >= 0);
    if (valid.length !== draft.length || valid.length === 0) return toast.error("Enter a valid non-negative amount for every category");
    setSaving(true);
    try {
      const seen = new Set<string>();
      const rows: { user_id: string; category_id: string; monthly_limit: number; month: string }[] = [];
      for (const r of valid) {
        const catId = r.categoryId ?? await ensureCategory(r.name);
        if (seen.has(catId) || budgetedIds.has(catId)) continue;
        seen.add(catId);
        rows.push({ user_id: user.id, category_id: catId, monthly_limit: Number(r.amount), month });
      }
      if (rows.length) {
        // ignoreDuplicates: never overwrite a limit that was saved meanwhile.
        const { error } = await supabase.from("budgets")
          .upsert(rows, { onConflict: "user_id,category_id,month", ignoreDuplicates: true });
        if (error) throw error;
      }
      toast.success(`${rows.length} limit${rows.length === 1 ? "" : "s"} saved`);
      setDraftOpen(false);
      qc.invalidateQueries({ queryKey: ["budgets"] });
      qc.invalidateQueries({ queryKey: ["categories"] });
    } catch (err) {
      toast.error(friendlyError(err as any));
    } finally { setSaving(false); }
  };

  const draftTotal = draft.reduce((s, r) => s + (Number(r.amount) || 0), 0);

  return (
    <div>
      <ExpensesTabs />
      <PageHeader
        title="Monthly Safe Limits"
        subtitle="Stay within your salary till the next payday."
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="bg-gradient-primary" onClick={openNew} disabled={loading || failed || saving}>
                <Plus className="mr-1 h-4 w-4" />Set limit
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingId ? "Edit safe limit" : `Set safe limit · ${monthLabel(month)}`}</DialogTitle>
              </DialogHeader>
              <form onSubmit={submit} className="space-y-4">
                <div>
                  <Label>Category</Label>
                  <Select value={categoryId} onValueChange={setCategoryId} disabled={!!editingId}>
                    <SelectTrigger><SelectValue placeholder="Pick category" /></SelectTrigger>
                    <SelectContent>
                      {(editingId ? expenseCats.filter(c => c.id === categoryId) : availableCats).map(c =>
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                      {!editingId && missingStandard.map(s =>
                        <SelectItem key={s.name} value={`std:${s.name}`}>{s.name}</SelectItem>)}
                      {!editingId && <SelectItem value="custom">+ Custom category…</SelectItem>}
                    </SelectContent>
                  </Select>
                  {categoryId === "custom" && (
                    <Input className="mt-2" value={customName} maxLength={40} onChange={e => setCustomName(e.target.value)} placeholder="Category name" />
                  )}
                </div>
                <div>
                  <Label>Monthly safe limit</Label>
                  <Input type="number" min="0" step="0.01" value={limit} onChange={e => setLimit(e.target.value)} placeholder="e.g. 3000" />
                  <p className="mt-1 text-xs text-muted-foreground">We'll warn you at 80% usage.</p>
                </div>
                <Button type="submit" disabled={saving} className="w-full bg-gradient-primary">{editingId ? "Update" : "Save"}</Button>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <Dialog open={draftOpen} onOpenChange={setDraftOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{draftTitle}</DialogTitle></DialogHeader>
          <p className="text-xs text-muted-foreground">{draftNote}</p>
          <div className="space-y-2">
            {draft.map((r, i) => (
              <div key={r.key} className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-sm">{r.name}{!r.categoryId && <span className="text-xs text-muted-foreground"> (new)</span>}</span>
                <Input type="number" min="0" step="0.01" className="w-28" aria-label={`${r.name} limit`} value={r.amount}
                  onChange={e => setDraft(d => d.map((x, j) => j === i ? { ...x, amount: e.target.value } : x))} />
                <Button size="icon" variant="ghost" className="h-7 w-7" aria-label={`Remove ${r.name}`}
                  onClick={() => setDraft(d => d.filter((_, j) => j !== i))}>
                  <X className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Total</span>
            <span className="font-semibold tabular-nums">{formatCurrency(draftTotal, currency)}</span>
          </div>
          {income && draftTotal + planned > income && (
            <p className="text-xs text-destructive">Planned limits would exceed your monthly salary of {formatCurrency(income, currency)}.</p>
          )}
          <Button className="w-full bg-gradient-primary" disabled={saving || draft.length === 0} onClick={saveDraft}>Save limits</Button>
        </DialogContent>
      </Dialog>

      <div className="space-y-3 px-5 pt-5 md:px-10">
        <Card className="shadow-soft">
          <CardContent className="space-y-3 p-4">
            <div className="flex items-center justify-between gap-2">
              <Button size="icon" variant="outline" className="h-8 w-8" aria-label="Previous month" disabled={saving} onClick={() => setMonth(m => shiftMonth(m, -1))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Input type="month" aria-label="Budget month" disabled={saving} className="h-8 max-w-[180px] text-center dark:[color-scheme:dark]" value={month.slice(0, 7)}
                onChange={e => { if (/^\d{4}-\d{2}$/.test(e.target.value)) setMonth(`${e.target.value}-01`); }} />
              <Button size="icon" variant="outline" className="h-8 w-8" aria-label="Next month" disabled={saving} onClick={() => setMonth(m => shiftMonth(m, 1))}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div><p className="text-[11px] text-muted-foreground">Planned</p><p className="font-display text-sm font-bold tabular-nums">{loading || failed ? "—" : formatCurrency(planned, currency)}</p></div>
              <div><p className="text-[11px] text-muted-foreground">Spent</p><p className="font-display text-sm font-bold tabular-nums">{loading || failed ? "—" : formatCurrency(totalSpent, currency)}</p></div>
              <div><p className="text-[11px] text-muted-foreground">Remaining</p>
                <p className={cn("font-display text-sm font-bold tabular-nums", planned - totalSpent < 0 && "text-destructive")}>{loading || failed ? "—" : formatCurrency(planned - totalSpent, currency)}</p></div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={startSuggest} disabled={loading || failed || saving}><Sparkles className="mr-1 h-3.5 w-3.5" />Auto-suggest</Button>
              <Button size="sm" variant="outline" onClick={startCopy} disabled={loading || failed || saving || previousQuery.isPending || previousQuery.isError}><Copy className="mr-1 h-3.5 w-3.5" />Copy last month</Button>
              <Button size="sm" variant="ghost" asChild><Link to="/categories">Manage categories</Link></Button>
            </div>
            {failed && <div className="text-sm text-destructive">Budget data couldn't load. <Button variant="ghost" size="sm" onClick={() => { budgetsQuery.refetch(); categoriesQuery.refetch(); transactionsQuery.refetch(); profileQuery.refetch(); }}>Try again</Button></div>}
            {previousQuery.isError && !failed && <div className="text-xs text-muted-foreground">Last month's limits couldn't load. <Button variant="ghost" size="sm" onClick={() => previousQuery.refetch()}>Retry</Button></div>}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-3 px-5 py-5 sm:grid-cols-2 md:px-10 lg:grid-cols-3">
        {loading && <p className="text-sm text-muted-foreground">Loading budget…</p>}
        {!loading && !failed && budgets.length === 0 && (
          <Card className="shadow-soft sm:col-span-2 lg:col-span-3">
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              No safe limits for {monthLabel(month)}. Set one to protect your salary.
            </CardContent>
          </Card>
        )}
        {!loading && !failed && budgets.map((b) => {
          const c = categories.find(x => x.id === b.category_id);
          const row = budgetRow(b.monthly_limit, spent.get(b.category_id ?? "") ?? 0);
          const pct = row.pct ?? (row.over ? 100 : 0);
          const status: "safe" | "warning" | "critical" =
            row.over || pct >= 100 ? "critical" : pct >= 80 ? "warning" : "safe";
          const tone = {
            safe:     { dot: "bg-success",     text: "text-success",     label: "On track" },
            warning:  { dot: "bg-gold",        text: "text-gold",        label: "Slow down" },
            critical: { dot: "bg-destructive", text: "text-destructive", label: row.over ? "Over limit" : "Limit reached" },
          }[status];
          if (b.monthly_limit === 0 && !row.over) tone.label = "No limit set";
          return (
            <Card key={b.id} className="shadow-soft">
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: c?.color ?? "#94a3b8" }} />
                    <h3 className="truncate font-display text-sm font-semibold">{c?.name ?? "Category"}</h3>
                  </div>
                  <div className="flex items-center gap-0.5">
                    <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Edit budget" disabled={!b.category_id || saving} onClick={() => { if (b.category_id) openEdit(b.id, b.category_id, b.monthly_limit); }}>
                      <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Delete budget" onClick={() => remove(b.id)}>
                      <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                  </div>
                </div>
                <div className="mt-2 flex items-baseline justify-between gap-2">
                  <p className="font-display text-lg font-bold tabular-nums">{formatCurrency(row.spent, currency)}</p>
                  <p className="text-xs text-muted-foreground tabular-nums">/ {formatCurrency(b.monthly_limit, currency)}</p>
                </div>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      status === "safe" && "bg-success",
                      status === "warning" && "bg-gold",
                      status === "critical" && "bg-destructive",
                    )}
                    style={{ width: `${Math.min(100, pct)}%` }}
                  />
                </div>
                <div className="mt-2 flex items-center justify-between text-[11px]">
                  <span className={cn("flex items-center gap-1 font-medium", tone.text)}>
                    <span className={cn("h-1.5 w-1.5 rounded-full", tone.dot)} />
                    {tone.label}{row.pct !== null && ` · ${Math.round(row.pct)}%`}
                  </span>
                  <span className={cn("tabular-nums", row.over ? "font-medium text-destructive" : "text-muted-foreground")}>
                    {row.over ? `Over by ${formatCurrency(-row.remaining, currency)}` : `${formatCurrency(row.remaining, currency)} left`}
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
