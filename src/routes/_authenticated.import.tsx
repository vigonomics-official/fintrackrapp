import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { friendlyError } from "@/lib/error-utils";
import { useQueryClient } from "@tanstack/react-query";
import {
  Smartphone, Wallet, Landmark, CreditCard, FileSpreadsheet, FileText,
  UploadCloud, ArrowLeft, Loader2, AlertTriangle, CheckCircle2,
  Search, Trash2, Sparkles, ShieldCheck, FileWarning,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/finance/PageHeader";
import { useAuth } from "@/lib/auth-context";
import { useCategories, useProfile, useTransactions } from "@/hooks/use-finance";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/currency";
import { PAYMENT_METHODS } from "@/lib/constants";
import {
  autoMapColumns, categorize, cleanMerchant, cleanNotes, detectDuplicates,
  parseAmount, parseDate, SOURCE_HINTS, TARGET_FIELDS,
  type ImportSource, type StagedRow, type TargetField,
} from "@/lib/import-utils";

export const Route = createFileRoute("/_authenticated/import")({ component: ImportPage });

type Step = "source" | "upload" | "mapping" | "preview" | "success";

const SOURCES: { key: ImportSource; label: string; desc: string; format: string; icon: typeof Smartphone }[] = [
  { key: "gpay", label: "Google Pay", desc: "Export your GPay transaction history", format: ".csv", icon: Smartphone },
  { key: "phonepe", label: "PhonePe", desc: "Statement from PhonePe app", format: ".csv / .xlsx", icon: Smartphone },
  { key: "paytm", label: "Paytm", desc: "Paytm wallet & UPI statement", format: ".csv / .xlsx", icon: Wallet },
  { key: "bank", label: "Bank Account", desc: "Statement from any bank", format: ".csv / .xlsx", icon: Landmark },
  { key: "credit_card", label: "Credit Card", desc: "Credit card statement", format: ".csv / .xlsx", icon: CreditCard },
  { key: "generic", label: "Generic CSV", desc: "Any CSV/JSON with columns", format: ".csv / .json", icon: FileSpreadsheet },
];

function ImportPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: profile } = useProfile();
  const { data: categories = [] } = useCategories();
  const { data: existingTx = [] } = useTransactions();
  const currency = profile?.currency ?? "USD";

  const [step, setStep] = useState<Step>("source");
  const [source, setSource] = useState<ImportSource>("generic");
  const [fileName, setFileName] = useState("");
  const [fileType, setFileType] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, unknown>[]>([]);
  const [mapping, setMapping] = useState<Record<TargetField, string | null>>(
    {} as Record<TargetField, string | null>,
  );
  const [staged, setStaged] = useState<StagedRow[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState<string | null>(null);
  const [dupStrategy, setDupStrategy] = useState<"skip" | "import_all">("skip");
  const [result, setResult] = useState<{ imported: number; duplicates: number; total: number; categorized: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* ---------- File parsing ---------- */
  const parseFile = useCallback(async (file: File) => {
    setLoading("Reading transactions…");
    setFileName(file.name);
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    setFileType(ext);
    try {
      let rows: Record<string, unknown>[] = [];
      if (ext === "csv") {
        const text = await file.text();
        const res = Papa.parse<Record<string, unknown>>(text, { header: true, skipEmptyLines: true, dynamicTyping: false });
        if (res.errors.length) throw new Error(res.errors[0].message);
        rows = res.data;
      } else if (ext === "xlsx" || ext === "xls") {
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: "array", cellDates: true });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
      } else if (ext === "json") {
        const text = await file.text();
        const data = JSON.parse(text);
        rows = Array.isArray(data) ? data : data.transactions ?? data.data ?? [];
      } else {
        throw new Error("Unsupported file format. Use .csv, .xlsx, or .json");
      }
      if (!rows.length) throw new Error("File is empty or has no rows.");
      const hdrs = Array.from(new Set(rows.flatMap((r) => Object.keys(r))));
      setHeaders(hdrs);
      setRawRows(rows);
      setMapping(autoMapColumns(hdrs));
      setStep("mapping");
    } catch (err: any) {
      toast.error(friendlyError(err, "Failed to parse file"));
    } finally {
      setLoading(null);
    }
  }, []);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) void parseFile(f);
  };

  /* ---------- Build staged rows from mapping ---------- */
  const buildStaged = useCallback(() => {
    setLoading("Analyzing & categorizing…");
    const hint = SOURCE_HINTS[source];
    const rows: StagedRow[] = rawRows.map((r, i) => {
      const errors: string[] = [];
      const dateRaw = mapping.date ? r[mapping.date] : null;
      const amountRaw = mapping.amount ? r[mapping.amount] : null;
      const merchantRaw = mapping.merchant ? r[mapping.merchant] : null;
      const typeRaw = mapping.type ? String(r[mapping.type] ?? "").toLowerCase() : "";
      const notesRaw = mapping.notes ? r[mapping.notes] : null;

      const date = parseDate(dateRaw);
      const amount = parseAmount(amountRaw);
      const merchant = cleanMerchant(merchantRaw ?? notesRaw) || "Unknown";
      if (!date) errors.push("Invalid date");
      if (amount == null) errors.push("Invalid amount");

      // Type detection
      let type: "income" | "expense" = "expense";
      if (typeRaw.includes("cr") || typeRaw.includes("credit") || typeRaw.includes("income")) type = "income";
      if (typeRaw.includes("dr") || typeRaw.includes("debit")) type = "expense";
      // Negative amount in source = expense, positive = income (for some bank statements)
      if (typeof amountRaw === "number" && amountRaw > 0 && !typeRaw) type = "income";

      const cat = categorize(merchant, categories);
      if (cat.type) type = cat.type;

      return {
        id: `row-${i}`,
        date: date ?? new Date().toISOString().slice(0, 10),
        merchant,
        amount: amount ?? 0,
        type,
        category_id: cat.category_id,
        payment_method: hint.method,
        notes: cleanNotes(notesRaw),
        errors: errors.length ? errors : undefined,
        selected: errors.length === 0,
      };
    });
    const withDup = detectDuplicates(rows, existingTx);
    setStaged(withDup);
    setLoading(null);
    setStep("preview");
  }, [rawRows, mapping, source, categories, existingTx]);

  /* ---------- Filtering & totals ---------- */
  const filtered = useMemo(() => {
    if (!search) return staged;
    const q = search.toLowerCase();
    return staged.filter((r) => r.merchant.toLowerCase().includes(q) || r.notes.toLowerCase().includes(q));
  }, [staged, search]);

  const totals = useMemo(() => {
    const sel = staged.filter((r) => r.selected);
    return {
      rows: staged.length,
      selected: sel.length,
      income: sel.filter((r) => r.type === "income").reduce((s, r) => s + r.amount, 0),
      expense: sel.filter((r) => r.type === "expense").reduce((s, r) => s + r.amount, 0),
      duplicates: staged.filter((r) => r.duplicate).length,
    };
  }, [staged]);

  const updateRow = (id: string, patch: Partial<StagedRow>) =>
    setStaged((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const removeRow = (id: string) => setStaged((prev) => prev.filter((r) => r.id !== id));
  const toggleAll = (val: boolean) =>
    setStaged((prev) => prev.map((r) => ({ ...r, selected: val && !r.errors })));

  /* ---------- Import ---------- */
  const performImport = async () => {
    if (!user) return;
    setLoading("Importing transactions…");
    try {
      const toImport = staged.filter((r) => {
        if (!r.selected || r.errors) return false;
        if (dupStrategy === "skip" && r.duplicate) return false;
        return true;
      });
      const skippedDuplicates = staged.filter((r) => r.selected && r.duplicate && dupStrategy === "skip").length;

      const { data: history, error: hErr } = await supabase.from("import_history" as any).insert({
        user_id: user.id,
        source,
        file_name: fileName,
        file_type: fileType,
        total_rows: staged.length,
        imported_count: toImport.length,
        duplicate_count: skippedDuplicates,
        error_count: staged.filter((r) => r.errors).length,
        total_amount: toImport.reduce((s, r) => s + r.amount, 0),
        status: "success",
      }).select().single();
      if (hErr) throw hErr;

      if (toImport.length) {
        const payload = toImport.map((r) => ({
          user_id: user.id,
          type: r.type,
          amount: r.amount,
          category_id: r.category_id,
          payment_method: r.payment_method as any,
          notes: [r.merchant, r.notes].filter(Boolean).join(" — ").slice(0, 500),
          tags: [`import:${source}`],
          transaction_date: r.date,
        }));
        // chunk to avoid payload limits
        for (let i = 0; i < payload.length; i += 200) {
          const { error } = await supabase.from("transactions").insert(payload.slice(i, i + 200));
          if (error) throw error;
        }
      }

      const errRows = staged.filter((r) => r.errors);
      if (errRows.length && history) {
        await supabase.from("import_errors" as any).insert(
          errRows.map((r, idx) => ({
            import_id: (history as any).id,
            user_id: user.id,
            row_number: idx + 1,
            reason: (r.errors ?? []).join(", "),
            raw_data: { merchant: r.merchant, amount: r.amount, date: r.date },
          })),
        );
      }

      qc.invalidateQueries({ queryKey: ["transactions"] });
      setResult({
        imported: toImport.length,
        duplicates: skippedDuplicates,
        total: toImport.reduce((s, r) => s + r.amount, 0),
        categorized: toImport.filter((r) => r.category_id).length,
      });
      setStep("success");
      toast.success(`Imported ${toImport.length} transactions`);
    } catch (err: any) {
      toast.error(friendlyError(err, "Import failed"));
    } finally {
      setLoading(null);
    }
  };

  const reset = () => {
    setStep("source");
    setSource("generic");
    setFileName("");
    setHeaders([]);
    setRawRows([]);
    setStaged([]);
    setMapping({} as Record<TargetField, string | null>);
    setResult(null);
  };

  /* ---------- UI ---------- */
  return (
    <div>
      <PageHeader
        title="Import Your Transactions"
        subtitle="Upload statements or payment app exports to automatically track expenses and income."
        action={
          step !== "source" && step !== "success" ? (
            <Button variant="ghost" size="sm" onClick={() => setStep(step === "preview" ? "mapping" : step === "mapping" ? "upload" : "source")}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Back
            </Button>
          ) : (
            <Link to="/menu">
              <Button variant="ghost" size="sm"><ArrowLeft className="mr-2 h-4 w-4" /> Menu</Button>
            </Link>
          )
        }
      />

      <div className="px-6 py-6 md:px-10">
        <Stepper step={step} />

        <AnimatePresence mode="wait">
          {step === "source" && (
            <motion.div key="source" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Choose source</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {SOURCES.map((s) => {
                  const Icon = s.icon;
                  return (
                    <Card
                      key={s.key}
                      className="group cursor-pointer p-5 shadow-soft transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
                      onClick={() => { setSource(s.key); setStep("upload"); }}
                    >
                      <div className="flex items-center gap-3">
                        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary group-hover:bg-primary/15">
                          <Icon className="h-5 w-5" />
                        </span>
                        <div>
                          <p className="font-semibold">{s.label}</p>
                          <p className="text-xs text-muted-foreground">{s.format}</p>
                        </div>
                      </div>
                      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{s.desc}</p>
                    </Card>
                  );
                })}
              </div>
              <div className="mt-6 flex items-start gap-3 rounded-2xl border bg-muted/30 p-4 text-xs text-muted-foreground">
                <ShieldCheck className="h-4 w-4 shrink-0 text-primary" />
                <p>We never ask for UPI PINs, banking passwords, or account credentials. Files are parsed locally in your browser before being saved to your private vault.</p>
              </div>
            </motion.div>
          )}

          {step === "upload" && (
            <motion.div key="upload" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <Card
                className="flex flex-col items-center justify-center border-2 border-dashed border-primary/30 bg-primary/5 p-10 text-center shadow-soft"
                onDragOver={(e) => e.preventDefault()}
                onDrop={onDrop}
              >
                <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <UploadCloud className="h-7 w-7" />
                </span>
                <h3 className="mt-4 font-display text-xl font-semibold">Drag & drop your file</h3>
                <p className="mt-1 text-sm text-muted-foreground">or browse from your device</p>
                <Button className="mt-5" onClick={() => fileInputRef.current?.click()} disabled={!!loading}>
                  {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> {loading}</> : "Browse File"}
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls,.json"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) void parseFile(f); }}
                />
                <p className="mt-4 text-xs text-muted-foreground">Supported formats: <span className="font-medium">.csv · .xlsx · .json</span></p>
              </Card>
            </motion.div>
          )}

          {step === "mapping" && (
            <motion.div key="mapping" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <Card className="p-6 shadow-soft">
                <div className="mb-4 flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" />
                  <p className="text-sm font-medium">{fileName}</p>
                  <Badge variant="secondary" className="ml-auto">{rawRows.length} rows</Badge>
                </div>
                <h3 className="font-display text-lg font-semibold">Map your columns</h3>
                <p className="mt-1 text-sm text-muted-foreground">We auto-detected columns. Adjust if needed.</p>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  {TARGET_FIELDS.map((f) => (
                    <div key={f.key} className="flex items-center justify-between gap-3 rounded-xl border bg-card/50 px-3 py-2.5">
                      <span className="text-sm font-medium">{f.label}</span>
                      <Select
                        value={mapping[f.key] ?? "__none__"}
                        onValueChange={(v) => setMapping({ ...mapping, [f.key]: v === "__none__" ? null : v })}
                      >
                        <SelectTrigger className="h-9 w-44"><SelectValue placeholder="—" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">— Not mapped —</SelectItem>
                          {headers.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
                <div className="mt-6 flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setStep("upload")}>Cancel</Button>
                  <Button
                    onClick={buildStaged}
                    disabled={!mapping.date || !mapping.amount || !!loading}
                  >
                    {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> {loading}</> : <><Sparkles className="mr-2 h-4 w-4" /> Continue</>}
                  </Button>
                </div>
                {(!mapping.date || !mapping.amount) && (
                  <p className="mt-3 text-xs text-amber-600">Date and Amount fields are required.</p>
                )}
              </Card>
            </motion.div>
          )}

          {step === "preview" && (
            <motion.div key="preview" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <StatCard label="Total rows" value={String(totals.rows)} />
                <StatCard label="Income" value={formatCurrency(totals.income, currency)} accent="text-emerald-600" />
                <StatCard label="Expenses" value={formatCurrency(totals.expense, currency)} accent="text-rose-600" />
              </div>

              {totals.duplicates > 0 && (
                <Card className="flex flex-col gap-3 border-amber-300/60 bg-amber-50/60 p-4 dark:bg-amber-950/20 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-600" />
                    <div>
                      <p className="text-sm font-medium">Possible duplicate transactions detected</p>
                      <p className="text-xs text-muted-foreground">{totals.duplicates} rows match existing transactions by date, amount and merchant.</p>
                    </div>
                  </div>
                  <Select value={dupStrategy} onValueChange={(v: "skip" | "import_all") => setDupStrategy(v)}>
                    <SelectTrigger className="h-9 w-44"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="skip">Skip duplicates</SelectItem>
                      <SelectItem value="import_all">Import all anyway</SelectItem>
                    </SelectContent>
                  </Select>
                </Card>
              )}

              <Card className="overflow-hidden shadow-soft">
                <div className="flex flex-wrap items-center gap-2 border-b p-3">
                  <div className="relative flex-1 min-w-[180px]">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input className="pl-9" placeholder="Search merchant or notes" value={search} onChange={(e) => setSearch(e.target.value)} />
                  </div>
                  <Button variant="outline" size="sm" onClick={() => toggleAll(true)}>Select all</Button>
                  <Button variant="outline" size="sm" onClick={() => toggleAll(false)}>Clear</Button>
                  <Badge variant="secondary">{totals.selected} selected</Badge>
                </div>
                <div className="max-h-[480px] overflow-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-muted/60 backdrop-blur">
                      <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                        <th className="px-3 py-2.5 w-10"></th>
                        <th className="px-3 py-2.5">Date</th>
                        <th className="px-3 py-2.5">Merchant</th>
                        <th className="px-3 py-2.5 text-right">Amount</th>
                        <th className="px-3 py-2.5">Type</th>
                        <th className="px-3 py-2.5">Category</th>
                        <th className="px-3 py-2.5">Method</th>
                        <th className="px-3 py-2.5 w-10"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((r) => (
                        <tr key={r.id} className={`border-t ${r.errors ? "bg-rose-50/50 dark:bg-rose-950/10" : r.duplicate ? "bg-amber-50/40 dark:bg-amber-950/10" : ""}`}>
                          <td className="px-3 py-2"><Checkbox checked={r.selected} disabled={!!r.errors} onCheckedChange={(v) => updateRow(r.id, { selected: !!v })} /></td>
                          <td className="px-3 py-2">
                            <Input className="h-8 w-32" type="date" value={r.date} onChange={(e) => updateRow(r.id, { date: e.target.value })} />
                          </td>
                          <td className="px-3 py-2">
                            <Input className="h-8 min-w-[160px]" value={r.merchant} onChange={(e) => updateRow(r.id, { merchant: e.target.value })} />
                            {r.errors && <p className="mt-1 text-[10px] text-rose-600">{r.errors.join(", ")}</p>}
                            {r.duplicate && <p className="mt-1 text-[10px] text-amber-600">Possible duplicate</p>}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <Input className="h-8 w-24 text-right" type="number" step="0.01" value={r.amount} onChange={(e) => updateRow(r.id, { amount: parseFloat(e.target.value) || 0 })} />
                          </td>
                          <td className="px-3 py-2">
                            <Select value={r.type} onValueChange={(v: "income" | "expense") => updateRow(r.id, { type: v })}>
                              <SelectTrigger className="h-8 w-28"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="expense">Expense</SelectItem>
                                <SelectItem value="income">Income</SelectItem>
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="px-3 py-2">
                            <Select value={r.category_id ?? "__none__"} onValueChange={(v) => updateRow(r.id, { category_id: v === "__none__" ? null : v })}>
                              <SelectTrigger className="h-8 w-40"><SelectValue placeholder="—" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__none__">— None —</SelectItem>
                                {categories.filter((c) => c.type === r.type).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="px-3 py-2">
                            <Select value={r.payment_method} onValueChange={(v) => updateRow(r.id, { payment_method: v })}>
                              <SelectTrigger className="h-8 w-28"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {PAYMENT_METHODS.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="px-3 py-2">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeRow(r.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                          </td>
                        </tr>
                      ))}
                      {filtered.length === 0 && (
                        <tr><td colSpan={8} className="px-3 py-8 text-center text-sm text-muted-foreground"><FileWarning className="mx-auto mb-2 h-5 w-5" /> No rows</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>

              <div className="flex flex-wrap items-center justify-end gap-2">
                <Button variant="outline" onClick={reset}>Cancel</Button>
                <Button onClick={performImport} disabled={!totals.selected || !!loading} className="min-w-[180px]">
                  {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> {loading}</> : `Import ${totals.selected} transactions`}
                </Button>
              </div>
            </motion.div>
          )}

          {step === "success" && result && (
            <motion.div key="success" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="mx-auto max-w-xl">
              <Card className="p-8 text-center shadow-soft">
                <motion.div
                  initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 220 }}
                  className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40"
                >
                  <CheckCircle2 className="h-8 w-8" />
                </motion.div>
                <h2 className="mt-5 font-display text-2xl font-bold">Transactions Imported Successfully</h2>
                <p className="mt-1 text-sm text-muted-foreground">Your finance vault is up to date.</p>
                <div className="mt-6 grid grid-cols-2 gap-3">
                  <ResultStat label="Imported" value={String(result.imported)} />
                  <ResultStat label="Duplicates skipped" value={String(result.duplicates)} />
                  <ResultStat label="Auto-categorized" value={String(result.categorized)} />
                  <ResultStat label="Total amount" value={formatCurrency(result.total, currency)} />
                </div>
                <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
                  <Button onClick={() => navigate({ to: "/transactions" })}>View Transactions</Button>
                  <Button variant="outline" onClick={reset}>Import Another File</Button>
                </div>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function Stepper({ step }: { step: Step }) {
  const items: { key: Step; label: string }[] = [
    { key: "source", label: "Source" },
    { key: "upload", label: "Upload" },
    { key: "mapping", label: "Mapping" },
    { key: "preview", label: "Preview" },
    { key: "success", label: "Done" },
  ];
  const idx = items.findIndex((i) => i.key === step);
  return (
    <div className="mb-6 flex items-center gap-2 overflow-x-auto pb-1">
      {items.map((it, i) => (
        <div key={it.key} className="flex items-center gap-2">
          <div className={`flex h-7 items-center gap-2 rounded-full px-3 text-xs font-medium transition-colors ${i <= idx ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
            <span className="grid h-4 w-4 place-items-center rounded-full bg-white/20 text-[10px]">{i + 1}</span>
            {it.label}
          </div>
          {i < items.length - 1 && <div className={`h-px w-6 ${i < idx ? "bg-primary" : "bg-border"}`} />}
        </div>
      ))}
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <Card className="p-4 shadow-soft">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`mt-1 font-display text-xl font-semibold ${accent ?? ""}`}>{value}</p>
    </Card>
  );
}
function ResultStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-muted/30 p-3 text-left">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-lg font-semibold">{value}</p>
    </div>
  );
}
