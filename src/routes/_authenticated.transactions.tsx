import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import Papa from "papaparse";
import { Search, Pencil, Trash2, Download, Upload, MoreVertical, Filter } from "lucide-react";
import { toast } from "sonner";
import { friendlyError } from "@/lib/error-utils";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTransactions, useCategories, useProfile, type Transaction } from "@/hooks/use-finance";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/currency";
import { PageHeader } from "@/components/finance/PageHeader";
import { TransactionDialog } from "@/components/finance/TransactionDialog";

export const Route = createFileRoute("/_authenticated/transactions")({ component: TransactionsPage });

function TransactionsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: txs = [] } = useTransactions();
  const { data: categories = [] } = useCategories();
  const { data: profile } = useProfile();
  const currency = profile?.currency ?? "USD";

  const [q, setQ] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [catFilter, setCatFilter] = useState<string>("all");
  const [showFilters, setShowFilters] = useState(false);
  const [editing, setEditing] = useState<Transaction | undefined>();
  const [dialogOpen, setDialogOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    return txs.filter((t) => {
      if (typeFilter !== "all" && t.type !== typeFilter) return false;
      if (catFilter !== "all" && t.category_id !== catFilter) return false;
      if (q) {
        const c = categories.find(x => x.id === t.category_id);
        const hay = `${c?.name ?? ""} ${t.notes ?? ""} ${t.tags.join(" ")}`.toLowerCase();
        if (!hay.includes(q.toLowerCase())) return false;
      }
      return true;
    });
  }, [txs, q, typeFilter, catFilter, categories]);

  const grouped = useMemo(() => {
    const groups: Record<string, Transaction[]> = {};
    filtered.forEach((t) => {
      (groups[t.transaction_date] ??= []).push(t);
    });
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filtered]);

  const totals = useMemo(() => {
    const inc = filtered.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);
    const exp = filtered.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0);
    return { inc, exp };
  }, [filtered]);

  const onDelete = async (id: string) => {
    if (!confirm("Delete this transaction?")) return;
    const { error } = await supabase.from("transactions").delete().eq("id", id);
    if (error) return toast.error(friendlyError(error));
    toast.success("Deleted");
    qc.invalidateQueries({ queryKey: ["transactions"] });
  };

  const exportCsv = () => {
    const rows = filtered.map((t) => ({
      date: t.transaction_date,
      type: t.type,
      amount: t.amount,
      category: categories.find(c => c.id === t.category_id)?.name ?? "",
      payment_method: t.payment_method,
      tags: t.tags.join("|"),
      notes: t.notes ?? "",
    }));
    const csv = Papa.unparse(rows);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "transactions.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const importCsv = (file: File) => {
    Papa.parse(file, {
      header: true, skipEmptyLines: true,
      complete: async (res) => {
        if (!user) return;
        const valid = ["income", "expense", "transfer"];
        const validPm = ["cash", "bank", "upi", "credit_card", "debit_card", "wallet"];
        const rows = (res.data as any[]).map((r) => {
          const type = valid.includes(r.type) ? r.type : "expense";
          const cat = categories.find(c => c.name?.toLowerCase() === String(r.category ?? "").toLowerCase());
          const pm = validPm.includes(r.payment_method) ? r.payment_method : "cash";
          return {
            user_id: user.id,
            type,
            amount: Number(r.amount) || 0,
            category_id: cat?.id ?? null,
            payment_method: pm,
            transaction_date: r.date || new Date().toISOString().slice(0, 10),
            notes: r.notes || null,
            tags: r.tags ? String(r.tags).split("|").filter(Boolean) : [],
          };
        }).filter(r => r.amount > 0);
        if (rows.length === 0) return toast.error("No valid rows.");
        const { error } = await supabase.from("transactions").insert(rows);
        if (error) return toast.error(friendlyError(error));
        toast.success(`Imported ${rows.length} transactions`);
        qc.invalidateQueries({ queryKey: ["transactions"] });
      },
    });
  };

  const formatGroupDate = (iso: string) => {
    const d = new Date(iso);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
    const dt = new Date(iso); dt.setHours(0, 0, 0, 0);
    if (dt.getTime() === today.getTime()) return "Today";
    if (dt.getTime() === yesterday.getTime()) return "Yesterday";
    return d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", year: dt.getFullYear() === today.getFullYear() ? undefined : "numeric" });
  };

  return (
    <div>
      <PageHeader
        title="Transactions"
        subtitle={`${filtered.length} of ${txs.length}`}
        action={
          <>
            <input ref={fileRef} type="file" accept=".csv" hidden onChange={(e) => e.target.files?.[0] && importCsv(e.target.files[0])} />
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
              <Upload className="h-4 w-4 md:mr-1" /><span className="hidden md:inline">Import</span>
            </Button>
            <Button variant="outline" size="sm" onClick={exportCsv}>
              <Download className="h-4 w-4 md:mr-1" /><span className="hidden md:inline">Export</span>
            </Button>
          </>
        }
      />

      <div className="space-y-4 px-5 py-5 md:px-10">
        {/* Summary chips */}
        <div className="flex gap-2">
          <div className="flex-1 rounded-xl bg-success/10 px-3 py-2.5">
            <p className="text-[10px] font-medium uppercase tracking-wider text-success">Income</p>
            <p className="font-display text-base font-bold tabular-nums text-success">{formatCurrency(totals.inc, currency)}</p>
          </div>
          <div className="flex-1 rounded-xl bg-destructive/10 px-3 py-2.5">
            <p className="text-[10px] font-medium uppercase tracking-wider text-destructive">Expenses</p>
            <p className="font-display text-base font-bold tabular-nums text-destructive">{formatCurrency(totals.exp, currency)}</p>
          </div>
          <div className="flex-1 rounded-xl bg-muted px-3 py-2.5">
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Net</p>
            <p className="font-display text-base font-bold tabular-nums">{formatCurrency(totals.inc - totals.exp, currency)}</p>
          </div>
        </div>

        {/* Search + filter toggle */}
        <Card className="shadow-soft">
          <CardContent className="space-y-3 p-3">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className="pl-9" />
              </div>
              <Button variant="outline" size="icon" className="md:hidden" onClick={() => setShowFilters(s => !s)} aria-label="Filters">
                <Filter className="h-4 w-4" />
              </Button>
            </div>
            <div className={`flex flex-wrap gap-2 ${showFilters ? "" : "hidden md:flex"}`}>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-full flex-1 md:w-36 md:flex-none"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  <SelectItem value="income">Income</SelectItem>
                  <SelectItem value="expense">Expense</SelectItem>
                  <SelectItem value="transfer">Transfer</SelectItem>
                </SelectContent>
              </Select>
              <Select value={catFilter} onValueChange={setCatFilter}>
                <SelectTrigger className="w-full flex-1 md:w-44 md:flex-none"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Grouped list */}
        {filtered.length === 0 ? (
          <Card className="shadow-soft"><CardContent className="py-12 text-center text-sm text-muted-foreground">No transactions match.</CardContent></Card>
        ) : (
          <div className="space-y-3">
            {grouped.map(([date, items]) => {
              const dayTotal = items.reduce((s, t) => s + (t.type === "income" ? t.amount : -t.amount), 0);
              return (
                <div key={date}>
                  <div className="mb-1.5 flex items-center justify-between px-1">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{formatGroupDate(date)}</p>
                    <p className={`text-xs font-medium tabular-nums ${dayTotal >= 0 ? "text-success" : "text-muted-foreground"}`}>
                      {dayTotal >= 0 ? "+" : "−"}{formatCurrency(Math.abs(dayTotal), currency)}
                    </p>
                  </div>
                  <Card className="shadow-soft">
                    <CardContent className="p-0">
                      <ul className="divide-y">
                        {items.map((t) => {
                          const c = categories.find(x => x.id === t.category_id);
                          const when = new Date(t.created_at);
                          const compactTime = isNaN(when.getTime())
                            ? ""
                            : `${when.toLocaleDateString(undefined, { day: "numeric", month: "short" })} • ${when.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
                          const meta = [compactTime, t.payment_method.replace("_", " "), t.notes].filter(Boolean).join(" · ");
                          return (
                            <li key={t.id} className="group flex items-center gap-2 px-3 py-2.5 transition-colors hover:bg-muted/40">
                              <button
                                onClick={() => { setEditing(t); setDialogOpen(true); }}
                                className="flex min-w-0 flex-1 items-center gap-3 text-left"
                              >
                                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-bold" style={{ background: (c?.color ?? "#94a3b8") + "22", color: c?.color ?? "#64748b" }}>
                                  {(c?.name ?? "?").charAt(0)}
                                </span>
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-sm font-medium">{c?.name ?? "Uncategorized"}</p>
                                  <p className="truncate text-[11px] text-muted-foreground">{meta}</p>
                                </div>
                                <p className={`shrink-0 whitespace-nowrap font-display text-sm font-semibold tabular-nums ${t.type === "income" ? "text-success" : t.type === "expense" ? "text-foreground" : "text-muted-foreground"}`}>
                                  {t.type === "income" ? "+" : t.type === "expense" ? "−" : ""}{formatCurrency(t.amount, currency)}
                                </p>
                              </button>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" aria-label="More">
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => { setEditing(t); setDialogOpen(true); }}>
                                    <Pencil className="mr-2 h-4 w-4" /> Edit
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => onDelete(t.id)} className="text-destructive focus:text-destructive">
                                    <Trash2 className="mr-2 h-4 w-4" /> Delete
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </li>
                          );
                        })}
                      </ul>
                    </CardContent>
                  </Card>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <TransactionDialog open={dialogOpen} onOpenChange={(v) => { setDialogOpen(v); if (!v) setEditing(undefined); }} edit={editing} />
    </div>
  );
}
