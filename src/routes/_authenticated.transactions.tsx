import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import Papa from "papaparse";
import { Search, Pencil, Trash2, Download, Upload } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
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

  const onDelete = async (id: string) => {
    if (!confirm("Delete this transaction?")) return;
    const { error } = await supabase.from("transactions").delete().eq("id", id);
    if (error) return toast.error(error.message);
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
        if (error) return toast.error(error.message);
        toast.success(`Imported ${rows.length} transactions`);
        qc.invalidateQueries({ queryKey: ["transactions"] });
      },
    });
  };

  return (
    <div>
      <PageHeader
        title="Transactions"
        subtitle={`${filtered.length} of ${txs.length} shown`}
        action={
          <div className="flex gap-2">
            <input ref={fileRef} type="file" accept=".csv" hidden onChange={(e) => e.target.files?.[0] && importCsv(e.target.files[0])} />
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}><Upload className="mr-1 h-4 w-4" />Import</Button>
            <Button variant="outline" size="sm" onClick={exportCsv}><Download className="mr-1 h-4 w-4" />Export</Button>
          </div>
        }
      />

      <div className="space-y-4 px-6 py-6 md:px-10">
        <Card className="shadow-soft">
          <CardContent className="flex flex-wrap items-center gap-3 p-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search notes, tags, categories…" className="pl-9" />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                <SelectItem value="income">Income</SelectItem>
                <SelectItem value="expense">Expense</SelectItem>
                <SelectItem value="transfer">Transfer</SelectItem>
              </SelectContent>
            </Select>
            <Select value={catFilter} onValueChange={setCatFilter}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardContent className="p-0">
            {filtered.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">No transactions match.</p>
            ) : (
              <ul className="divide-y">
                {filtered.map((t) => {
                  const c = categories.find(x => x.id === t.category_id);
                  return (
                    <li key={t.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40">
                      <span className="flex h-9 w-9 items-center justify-center rounded-lg text-sm font-bold" style={{ background: (c?.color ?? "#94a3b8") + "22", color: c?.color ?? "#64748b" }}>
                        {(c?.name ?? "?").charAt(0)}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-sm font-medium">{c?.name ?? "Uncategorized"} {t.notes && <span className="text-muted-foreground">· {t.notes}</span>}</p>
                        <p className="text-xs text-muted-foreground">{new Date(t.transaction_date).toLocaleDateString()} · {t.payment_method.replace("_", " ")}</p>
                      </div>
                      <p className={`font-display text-sm font-semibold ${t.type === "income" ? "text-success" : t.type === "expense" ? "text-foreground" : "text-muted-foreground"}`}>
                        {t.type === "income" ? "+" : t.type === "expense" ? "-" : ""}{formatCurrency(t.amount, currency)}
                      </p>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" onClick={() => { setEditing(t); setDialogOpen(true); }}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => onDelete(t.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <TransactionDialog open={dialogOpen} onOpenChange={(v) => { setDialogOpen(v); if (!v) setEditing(undefined); }} edit={editing} />
    </div>
  );
}
