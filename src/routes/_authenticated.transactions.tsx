import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import Papa from "papaparse";
import { Search, Pencil, Trash2, Download, Upload, MoreVertical, Filter, Sparkles, Loader2, CheckSquare, X, Inbox } from "lucide-react";
import { toast } from "sonner";
import { friendlyError } from "@/lib/error-utils";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTransactions, useCategories, useProfile, useBudgets, monthKey, type Transaction } from "@/hooks/use-finance";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/currency";
import { PageHeader } from "@/components/finance/PageHeader";
import { TransactionDialog } from "@/components/finance/TransactionDialog";
import { ExpensesTabs } from "@/components/finance/ExpensesTabs";
import { SpendingOverview } from "@/components/finance/SpendingOverview";
import { TimeRangeFilter, computeRange, previousRange, type RangeKey, type DateRange } from "@/components/finance/TimeRangeFilter";
import { cleanMerchant, cleanNotes, categorize, parseDate, parseAmount } from "@/lib/import-utils";
import { useSalarySettings } from "@/hooks/use-salary-settings";
import { lastSalaryDate } from "@/lib/salary-cycle";

export const Route = createFileRoute("/_authenticated/transactions")({
  component: TransactionsPage,
  head: () => ({
    meta: [
      { title: "Transactions — FinTrackr" },
      { name: "description", content: "Search, filter, and categorize every expense and income entry." },
      { property: "og:title", content: "Transactions — FinTrackr" },
      { property: "og:description", content: "Search, filter, and categorize every expense and income entry." },
      { property: "og:url", content: "https://fintrackrapp.lovable.app/transactions" },
      { name: "twitter:title", content: "Transactions — FinTrackr" },
      { name: "twitter:description", content: "Search, filter, and categorize every expense and income entry." },
    ],
    links: [{ rel: "canonical", href: "https://fintrackrapp.lovable.app/transactions" }],
  }),
});

function TransactionsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: txs = [] } = useTransactions();
  const { data: categories = [] } = useCategories();
  const { data: profile } = useProfile();
  const { data: budgets = [] } = useBudgets(monthKey());
  const currency = profile?.currency ?? "INR";

  const [q, setQ] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [catFilter, setCatFilter] = useState<string>("all");
  const [showFilters, setShowFilters] = useState(false);
  const [editing, setEditing] = useState<Transaction | undefined>();
  const [dialogOpen, setDialogOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [rangeKey, setRangeKey] = useState<RangeKey>("month");
  const todayIso = new Date().toISOString().slice(0, 10);
  const [customRange, setCustomRange] = useState<DateRange>({ from: todayIso, to: todayIso });
  const { settings: salarySettings } = useSalarySettings();
  const baseRange = useMemo(() => computeRange(rangeKey, customRange), [rangeKey, customRange]);
  // For "Month": align with current salary cycle (most recent salary tx, else payDay setting).
  const range = useMemo<DateRange>(() => {
    if (rangeKey !== "month") return baseRange;
    const salaryTxs = txs
      .filter((t) => t.type === "income")
      .map((t) => t.transaction_date)
      .sort();
    const lastSalaryTx = salaryTxs.length ? salaryTxs[salaryTxs.length - 1] : null;
    const payDay = salarySettings.payDay ?? 1;
    const cycleStart = lastSalaryTx ?? lastSalaryDate(payDay).toISOString().slice(0, 10);
    return { from: cycleStart, to: baseRange.to };
  }, [rangeKey, baseRange, txs, salarySettings.payDay]);
  const prevRange = useMemo(() => previousRange(rangeKey, range), [rangeKey, range]);

  // Bulk select mode
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkCat, setBulkCat] = useState<string>("");
  const toggleSelect = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  const exitSelect = () => { setSelectMode(false); setSelected(new Set()); };

  // Import success banner
  const [importBanner, setImportBanner] = useState<{ count: number; ts: number } | null>(null);
  useEffect(() => {
    try {
      const raw = localStorage.getItem("fintrackr:last_import");
      if (!raw) return;
      const data = JSON.parse(raw) as { count: number; ts: number };
      const dismissed = Number(localStorage.getItem("fintrackr:last_import_dismissed") ?? 0);
      if (data.ts > dismissed) setImportBanner(data);
    } catch {}
  }, []);
  const dismissBanner = () => {
    try { localStorage.setItem("fintrackr:last_import_dismissed", String(Date.now())); } catch {}
    setImportBanner(null);
  };

  const inRange = (d: string, r: DateRange) => d >= r.from && d <= r.to;
  const rangeTxs = useMemo(() => txs.filter(t => inRange(t.transaction_date, range)), [txs, range]);
  const prevRangeTxs = useMemo(() => txs.filter(t => inRange(t.transaction_date, prevRange)), [txs, prevRange]);

  const filtered = useMemo(() => {
    return rangeTxs.filter((t) => {
      if (typeFilter !== "all" && t.type !== typeFilter) return false;
      if (catFilter !== "all" && t.category_id !== catFilter) return false;
      if (q) {
        const c = categories.find(x => x.id === t.category_id);
        const hay = `${c?.name ?? ""} ${t.notes ?? ""} ${t.tags.join(" ")}`.toLowerCase();
        if (!hay.includes(q.toLowerCase())) return false;
      }
      return true;
    });
  }, [rangeTxs, q, typeFilter, catFilter, categories]);

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

  const uncategorized = useMemo(
    () => rangeTxs.filter((t) => !t.category_id && t.type !== "transfer"),
    [rangeTxs],
  );
  const [fixingCats, setFixingCats] = useState(false);

  const fixUncategorized = async () => {
    if (!user || uncategorized.length === 0) return;
    setFixingCats(true);
    try {
      const summary: Record<string, number> = {};
      const updates: { id: string; category_id: string }[] = [];
      for (const t of uncategorized) {
        const merchant = (t.notes ?? "").split(" — ")[0] ?? "";
        if (!merchant) continue;
        const { category_id } = categorize(merchant, categories);
        if (!category_id) continue;
        updates.push({ id: t.id, category_id });
        const name = categories.find((c) => c.id === category_id)?.name ?? "Other";
        summary[name] = (summary[name] ?? 0) + 1;
      }
      for (const u of updates) {
        await supabase.from("transactions").update({ category_id: u.category_id }).eq("id", u.id);
      }
      qc.invalidateQueries({ queryKey: ["transactions"] });
      const lines = Object.entries(summary).map(([k, v]) => `${k}: ${v}`).join(" · ");
      toast.success(
        updates.length
          ? `Categorized ${updates.length} transactions — ${lines}`
          : "No matching rules found for remaining transactions",
      );
    } catch (err: any) {
      toast.error(friendlyError(err, "Could not auto-categorize"));
    } finally {
      setFixingCats(false);
    }
  };

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
        const seen = new Set(txs.map((t) => `${t.transaction_date}|${t.amount.toFixed(2)}|${(t.notes ?? "").toLowerCase().slice(0, 24)}`));
        const rows = (res.data as any[]).map((r) => {
          const rawMerchant = r.merchant ?? r.description ?? r.narration ?? r.details ?? r.payee ?? r.notes ?? "";
          const merchant = cleanMerchant(rawMerchant) || "Unknown";
          let type: "income" | "expense" | "transfer" = valid.includes(r.type) ? r.type : "expense";
          const auto = categorize(merchant, categories);
          if (auto.type) type = auto.type;
          const csvCat = categories.find(c => c.name?.toLowerCase() === String(r.category ?? "").toLowerCase());
          const category_id = csvCat?.id ?? auto.category_id ?? null;
          const pm = validPm.includes(r.payment_method) ? r.payment_method : "upi";
          const amount = parseAmount(r.amount) ?? 0;
          const date = parseDate(r.date) ?? new Date().toISOString().slice(0, 10);
          const cleanedNotes = cleanNotes(r.notes);
          return {
            user_id: user.id,
            type,
            amount,
            category_id,
            payment_method: pm,
            transaction_date: date,
            notes: [merchant, cleanedNotes].filter(Boolean).join(" — ").slice(0, 500),
            tags: r.tags ? String(r.tags).split("|").filter(Boolean) : ["import:csv"],
          };
        }).filter(r => {
          if (r.amount <= 0) return false;
          const k = `${r.transaction_date}|${r.amount.toFixed(2)}|${r.notes.toLowerCase().slice(0, 24)}`;
          if (seen.has(k)) return false;
          seen.add(k);
          return true;
        });
        if (rows.length === 0) return toast.error("No new transactions to import.");
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

  const rangeLabel = useMemo(() => {
    const count = filtered.length;
    const base =
      rangeKey === "week" ? "This Week"
      : rangeKey === "month" ? "This Cycle"
      : rangeKey === "year" ? "This Year"
      : "Custom Range";
    return `Showing: ${base} (${count} ${count === 1 ? "transaction" : "transactions"})`;
  }, [rangeKey, filtered.length]);

  const bulkCategorize = async () => {
    if (!bulkCat || selected.size === 0) return;
    const ids = Array.from(selected);
    const { error } = await supabase.from("transactions").update({ category_id: bulkCat }).in("id", ids);
    if (error) return toast.error(friendlyError(error));
    toast.success(`Categorized ${ids.length} transactions`);
    qc.invalidateQueries({ queryKey: ["transactions"] });
    exitSelect();
  };

  const bulkDelete = async () => {
    if (selected.size === 0) return;
    if (!confirm(`Delete ${selected.size} transactions? This cannot be undone.`)) return;
    const ids = Array.from(selected);
    const { error } = await supabase.from("transactions").delete().in("id", ids);
    if (error) return toast.error(friendlyError(error));
    toast.success(`Deleted ${ids.length} transactions`);
    qc.invalidateQueries({ queryKey: ["transactions"] });
    exitSelect();
  };

  return (
    <div>
      <ExpensesTabs />
      <PageHeader
        title="Expenses"
        subtitle={`${filtered.length} of ${txs.length}`}
        action={
          <>
            <input ref={fileRef} type="file" accept=".csv" hidden onChange={(e) => e.target.files?.[0] && importCsv(e.target.files[0])} />
            <Button
              variant={selectMode ? "default" : "outline"}
              size="sm"
              onClick={() => (selectMode ? exitSelect() : setSelectMode(true))}
            >
              <CheckSquare className="h-4 w-4 md:mr-1" />
              <span className="hidden md:inline">{selectMode ? "Cancel" : "Select"}</span>
            </Button>
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
        {/* Date range indicator */}
        <p className="text-[12px] text-muted-foreground">{rangeLabel}</p>

        {/* Import success banner */}
        {importBanner && (
          <Card className="border-sky-200 bg-sky-50 shadow-soft dark:border-sky-900/50 dark:bg-sky-950/30">
            <CardContent className="flex items-center gap-3 p-4">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sky-600 dark:bg-sky-900/50 dark:text-sky-300">
                <Inbox className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground">📥 Data Imported Successfully</p>
                <p className="text-xs text-muted-foreground">
                  {importBanner.count} transactions added
                  {uncategorized.length > 0 ? ` · ${uncategorized.length} need a category` : ""}
                </p>
              </div>
              {uncategorized.length > 0 && (
                <Button size="sm" onClick={fixUncategorized} disabled={fixingCats} className="bg-sky-600 hover:bg-sky-700">
                  Categorize Now →
                </Button>
              )}
              <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={dismissBanner} aria-label="Dismiss">
                <X className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        )}
        {/* Time range filter */}
        <TimeRangeFilter
          value={rangeKey}
          onChange={setRangeKey}
          custom={customRange}
          onCustomChange={setCustomRange}
        />

        {/* Spending overview */}
        <SpendingOverview
          range={rangeKey}
          currency={currency}
          rangeTxs={rangeTxs}
          prevRangeTxs={prevRangeTxs}
          allTxs={txs}
          categories={categories}
          budgets={budgets}
        />


        {/* Fix uncategorized */}
        {uncategorized.length > 0 && (
          <Card className="border-orange-200 bg-orange-50 shadow-soft dark:border-orange-900/50 dark:bg-orange-950/30">
            <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-orange-100 text-orange-600 dark:bg-orange-900/50 dark:text-orange-300">
                  <Sparkles className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-foreground">Fix uncategorized</p>
                  <p className="text-xs text-muted-foreground">
                    You have {uncategorized.length} uncategorized {uncategorized.length === 1 ? "transaction" : "transactions"}.
                  </p>
                </div>
              </div>
              <Button size="sm" onClick={fixUncategorized} disabled={fixingCats} className="bg-orange-600 hover:bg-orange-700">
                {fixingCats ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Working…</> : <><Sparkles className="mr-2 h-4 w-4" /> Auto-Categorize All</>}
              </Button>
            </CardContent>
          </Card>
        )}

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
                          const shortTime = isNaN(when.getTime())
                            ? ""
                            : when.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
                          // Clean merchant/title (strip GMT timestamps, UPI refs, VPAs, long IDs).
                          const rawNotes = (t.notes ?? "").split(" — ")[0] ?? "";
                          const cleanTitle = rawNotes
                            .replace(/\b(?:Sun|Mon|Tue|Wed|Thu|Fri|Sat)\s+\w{3}\s+\d{1,2}\s+\d{4}[^,;|]*/gi, "")
                            .replace(/\bGMT[+\-]?\d{0,4}.*$/i, "")
                            .replace(/\b[\w.\-]+@[a-z]{2,}\b/gi, "")
                            .replace(/\bUPI[\s:\-]*Ref[^\s]*/gi, "")
                            .replace(/\bRef\s*(No\.?|#)?\s*[:\-]?\s*\w+/gi, "")
                            .replace(/\b\d{8,}\b/g, "")
                            .replace(/[•|·]+/g, " ")
                            .replace(/\s{2,}/g, " ")
                            .trim();
                          const title = cleanTitle || c?.name || "Unknown Merchant";
                          const pmLabel = t.payment_method.replace("_", " ").toUpperCase();
                          const isUncategorized = !c && t.type !== "transfer";
                          const iconBg = isUncategorized ? "#f9731614" : (c?.color ?? "#94a3b8") + "1f";
                          const iconColor = isUncategorized ? "#ea580c" : (c?.color ?? "#64748b");
                          return (
                            <li key={t.id} className="group flex items-center gap-2 px-3 py-3 transition-colors hover:bg-muted/40">
                              <button
                                onClick={() => { setEditing(t); setDialogOpen(true); }}
                                className="flex min-w-0 flex-1 items-center gap-3 text-left"
                                aria-label={`View ${title}`}
                              >
                                <span
                                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold"
                                  style={{ background: iconBg, color: iconColor }}
                                >
                                  {title.charAt(0).toUpperCase()}
                                </span>
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-[14px] font-medium leading-tight text-foreground">{title}</p>
                                  <div className="mt-1 flex items-center gap-1.5">
                                    {c?.name ? (
                                      <span className="truncate rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                                        {c.name}
                                      </span>
                                    ) : isUncategorized ? (
                                      <span className="truncate rounded-full bg-orange-100 px-1.5 py-0.5 text-[10px] font-medium text-orange-700 dark:bg-orange-900/40 dark:text-orange-300">
                                        Uncategorized
                                      </span>
                                    ) : null}
                                    <span className="shrink-0 rounded-full bg-muted/60 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                                      {pmLabel}
                                    </span>
                                    {shortTime && (
                                      <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground/80">{shortTime}</span>
                                    )}
                                  </div>
                                </div>
                                <p className={`shrink-0 whitespace-nowrap pl-1 font-display text-[15px] font-semibold tabular-nums ${t.type === "income" ? "text-success" : t.type === "expense" ? "text-foreground" : "text-muted-foreground"}`}>
                                  {t.type === "income" ? "+" : t.type === "expense" ? "−" : ""}{formatCurrency(t.amount, currency)}
                                </p>
                              </button>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0 opacity-60 group-hover:opacity-100" aria-label="More">
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => { setEditing(t); setDialogOpen(true); }}>
                                    <Pencil className="mr-2 h-4 w-4" /> View / Edit
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
