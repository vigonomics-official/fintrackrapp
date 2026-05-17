import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { friendlyError } from "@/lib/error-utils";
import {
  Plus, Trash2, CheckCircle2, Calendar, TrendingDown,
  Wallet, AlertTriangle, Sparkles, ArrowLeft, Home, Car,
  GraduationCap, CreditCard, Coins, User, Briefcase, Landmark,
} from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip,
  BarChart, Bar, CartesianGrid,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/finance/PageHeader";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { useLoans, useLoanPayments, useTransactions, useProfile, type Loan, type LoanType } from "@/hooks/use-finance";
import { formatCurrency } from "@/lib/currency";

export const Route = createFileRoute("/_authenticated/loans")({ component: LoansPage });

const LOAN_TYPES: { value: LoanType; label: string; icon: typeof Home }[] = [
  { value: "home", label: "Home Loan", icon: Home },
  { value: "personal", label: "Personal Loan", icon: User },
  { value: "vehicle", label: "Vehicle Loan", icon: Car },
  { value: "education", label: "Education Loan", icon: GraduationCap },
  { value: "gold", label: "Gold Loan", icon: Coins },
  { value: "credit_card", label: "Credit Card Debt", icon: CreditCard },
  { value: "informal", label: "Informal Borrowing", icon: Briefcase },
  { value: "other", label: "Other", icon: Landmark },
];

const typeMeta = (t: LoanType) => LOAN_TYPES.find((x) => x.value === t) ?? LOAN_TYPES[1];

function nextDueDate(due_day: number) {
  const today = new Date();
  const d = new Date(today.getFullYear(), today.getMonth(), Math.min(due_day, 28));
  if (d < today) d.setMonth(d.getMonth() + 1);
  return d;
}

function LoanForm({ onClose, initial }: { onClose: () => void; initial?: Loan }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [form, setForm] = useState({
    loan_name: initial?.loan_name ?? "",
    loan_type: (initial?.loan_type ?? "personal") as LoanType,
    total_amount: initial?.total_amount?.toString() ?? "",
    interest_rate: initial?.interest_rate?.toString() ?? "",
    emi_amount: initial?.emi_amount?.toString() ?? "",
    tenure_months: initial?.tenure_months?.toString() ?? "",
    remaining_balance: initial?.remaining_balance?.toString() ?? "",
    start_date: initial?.start_date ?? new Date().toISOString().slice(0, 10),
    due_day: initial?.due_day?.toString() ?? "5",
    notes: initial?.notes ?? "",
  });

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((p) => ({ ...p, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!form.loan_name || !form.total_amount || !form.emi_amount || !form.tenure_months) {
      return toast.error("Please fill required fields");
    }
    const payload = {
      user_id: user.id,
      loan_name: form.loan_name.trim(),
      loan_type: form.loan_type,
      total_amount: Number(form.total_amount),
      interest_rate: Number(form.interest_rate || 0),
      emi_amount: Number(form.emi_amount),
      tenure_months: Number(form.tenure_months),
      remaining_balance: Number(form.remaining_balance || form.total_amount),
      start_date: form.start_date,
      due_day: Math.min(28, Math.max(1, Number(form.due_day || 1))),
      notes: form.notes.trim() || null,
    };
    const { error } = initial
      ? await supabase.from("loans" as any).update(payload).eq("id", initial.id)
      : await supabase.from("loans" as any).insert(payload);
    if (error) return toast.error(friendlyError(error));
    toast.success(initial ? "Loan updated" : "Loan added");
    qc.invalidateQueries({ queryKey: ["loans"] });
    onClose();
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <div className="md:col-span-2">
          <Label>Loan name *</Label>
          <Input value={form.loan_name} onChange={(e) => set("loan_name", e.target.value)} placeholder="e.g. Honda City EMI" />
        </div>
        <div>
          <Label>Loan type *</Label>
          <Select value={form.loan_type} onValueChange={(v) => set("loan_type", v as LoanType)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {LOAN_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Interest rate (% p.a.)</Label>
          <Input type="number" step="0.01" value={form.interest_rate} onChange={(e) => set("interest_rate", e.target.value)} />
        </div>
        <div>
          <Label>Total loan amount *</Label>
          <Input type="number" step="0.01" value={form.total_amount} onChange={(e) => set("total_amount", e.target.value)} />
        </div>
        <div>
          <Label>Remaining balance</Label>
          <Input type="number" step="0.01" value={form.remaining_balance} onChange={(e) => set("remaining_balance", e.target.value)} placeholder="Defaults to total" />
        </div>
        <div>
          <Label>EMI amount *</Label>
          <Input type="number" step="0.01" value={form.emi_amount} onChange={(e) => set("emi_amount", e.target.value)} />
        </div>
        <div>
          <Label>Tenure (months) *</Label>
          <Input type="number" value={form.tenure_months} onChange={(e) => set("tenure_months", e.target.value)} />
        </div>
        <div>
          <Label>Start date</Label>
          <Input type="date" value={form.start_date} onChange={(e) => set("start_date", e.target.value)} />
        </div>
        <div>
          <Label>Due day of month (1-28)</Label>
          <Input type="number" min={1} max={28} value={form.due_day} onChange={(e) => set("due_day", e.target.value)} />
        </div>
        <div className="md:col-span-2">
          <Label>Notes</Label>
          <Textarea rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
        </div>
      </div>
      <DialogFooter>
        <Button type="submit" className="w-full bg-gradient-primary">{initial ? "Save changes" : "Add loan"}</Button>
      </DialogFooter>
    </form>
  );
}

function LoanDetailDialog({ loan, currency, onClose }: { loan: Loan; currency: string; onClose: () => void }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { data: payments = [] } = useLoanPayments(loan.id);
  const [editOpen, setEditOpen] = useState(false);

  const paid = loan.total_amount - loan.remaining_balance;
  const pct = Math.min(100, (paid / loan.total_amount) * 100);
  const remainingEmis = Math.max(0, Math.ceil(loan.remaining_balance / loan.emi_amount));
  const due = nextDueDate(loan.due_day);

  const trend = useMemo(() => {
    const sorted = [...payments].sort((a, b) => a.payment_date.localeCompare(b.payment_date));
    let bal = loan.total_amount;
    return [
      { date: loan.start_date.slice(0, 7), balance: loan.total_amount },
      ...sorted.map((p) => {
        bal = p.remaining_balance;
        return { date: p.payment_date.slice(0, 7), balance: bal };
      }),
    ];
  }, [payments, loan]);

  const markPaid = async () => {
    if (!user) return;
    const newBal = Math.max(0, loan.remaining_balance - loan.emi_amount);
    const { error: e1 } = await supabase.from("loan_payments" as any).insert({
      loan_id: loan.id,
      user_id: user.id,
      payment_date: new Date().toISOString().slice(0, 10),
      payment_amount: Math.min(loan.emi_amount, loan.remaining_balance),
      remaining_balance: newBal,
      payment_status: "paid",
    });
    if (e1) return toast.error(friendlyError(e1));
    const { error: e2 } = await supabase.from("loans" as any)
      .update({ remaining_balance: newBal }).eq("id", loan.id);
    if (e2) return toast.error(friendlyError(e2));
    toast.success("EMI marked as paid");
    qc.invalidateQueries({ queryKey: ["loans"] });
    qc.invalidateQueries({ queryKey: ["loan_payments"] });
  };

  const remove = async () => {
    if (!confirm("Delete this loan and its payment history?")) return;
    const { error } = await supabase.from("loans" as any).delete().eq("id", loan.id);
    if (error) return toast.error(friendlyError(error));
    toast.success("Loan deleted");
    qc.invalidateQueries({ queryKey: ["loans"] });
    onClose();
  };

  const Icon = typeMeta(loan.loan_type).icon;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] overflow-y-auto md:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Icon className="h-5 w-5" />
            </span>
            <div>
              <p className="font-display">{loan.loan_name}</p>
              <p className="text-xs font-normal text-muted-foreground">{typeMeta(loan.loan_type).label}</p>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <Card className="border-none bg-gradient-primary text-primary-foreground shadow-elegant">
            <CardContent className="p-5">
              <p className="text-xs uppercase tracking-wider opacity-80">Remaining balance</p>
              <p className="font-display text-3xl font-bold">{formatCurrency(loan.remaining_balance, currency)}</p>
              <div className="mt-3 flex items-center justify-between text-xs opacity-90">
                <span>{pct.toFixed(1)}% paid off</span>
                <span>{remainingEmis} EMIs left</span>
              </div>
              <Progress value={pct} className="mt-2 bg-white/20" />
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
            <div><p className="text-muted-foreground">EMI</p><p className="font-semibold">{formatCurrency(loan.emi_amount, currency)}</p></div>
            <div><p className="text-muted-foreground">Interest</p><p className="font-semibold">{loan.interest_rate}% p.a.</p></div>
            <div><p className="text-muted-foreground">Tenure</p><p className="font-semibold">{loan.tenure_months} mo</p></div>
            <div><p className="text-muted-foreground">Next due</p><p className="font-semibold">{due.toLocaleDateString()}</p></div>
          </div>

          {trend.length > 1 && (
            <Card className="shadow-soft">
              <CardHeader className="pb-2"><CardTitle className="text-sm font-display">Payoff trend</CardTitle></CardHeader>
              <CardContent className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trend}>
                    <defs>
                      <linearGradient id="lg" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="oklch(0.5 0.12 165)" stopOpacity={0.5} />
                        <stop offset="100%" stopColor="oklch(0.5 0.12 165)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="date" stroke="oklch(0.55 0.03 160)" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke="oklch(0.55 0.03 160)" fontSize={11} tickLine={false} axisLine={false} />
                    <Tooltip formatter={(v: number) => formatCurrency(v, currency)} contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12 }} />
                    <Area type="monotone" dataKey="balance" stroke="oklch(0.5 0.12 165)" strokeWidth={2.5} fill="url(#lg)" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          <div>
            <h4 className="mb-2 text-sm font-semibold">Payment history</h4>
            {payments.length === 0 ? (
              <p className="text-sm text-muted-foreground">No payments yet. Tap "Mark EMI paid" once you pay.</p>
            ) : (
              <ul className="divide-y rounded-lg border">
                {payments.slice(0, 8).map((p) => (
                  <li key={p.id} className="flex items-center justify-between px-3 py-2 text-sm">
                    <span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-success" />{new Date(p.payment_date).toLocaleDateString()}</span>
                    <span className="font-semibold">{formatCurrency(p.payment_amount, currency)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {loan.notes && <p className="rounded-lg bg-muted/40 p-3 text-sm text-muted-foreground">{loan.notes}</p>}
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button variant="outline" onClick={() => setEditOpen(true)}>Edit</Button>
          <Button variant="ghost" className="text-destructive" onClick={remove}><Trash2 className="mr-1 h-4 w-4" />Delete</Button>
          <Button className="flex-1 bg-gradient-primary" onClick={markPaid} disabled={loan.remaining_balance <= 0}>
            <CheckCircle2 className="mr-1 h-4 w-4" />Mark EMI paid
          </Button>
        </DialogFooter>

        {editOpen && (
          <Dialog open={editOpen} onOpenChange={setEditOpen}>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Edit loan</DialogTitle></DialogHeader>
              <LoanForm initial={loan} onClose={() => setEditOpen(false)} />
            </DialogContent>
          </Dialog>
        )}
      </DialogContent>
    </Dialog>
  );
}

function LoansPage() {
  const { data: profile } = useProfile();
  const { data: loans = [] } = useLoans();
  const { data: txs = [] } = useTransactions();
  const currency = profile?.currency ?? "USD";
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Loan | null>(null);
  const [fabSheet, setFabSheet] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const h = () => setFabSheet(true);
    window.addEventListener("fintrackr:fab", h);
    return () => window.removeEventListener("fintrackr:fab", h);
  }, []);

  const totals = useMemo(() => {
    const debt = loans.reduce((s, l) => s + l.remaining_balance, 0);
    const monthlyEmi = loans.reduce((s, l) => s + (l.remaining_balance > 0 ? l.emi_amount : 0), 0);
    const totalBorrowed = loans.reduce((s, l) => s + l.total_amount, 0);
    const totalPaid = totalBorrowed - debt;
    const payoffPct = totalBorrowed > 0 ? (totalPaid / totalBorrowed) * 100 : 0;

    const now = new Date();
    const monthIncome = txs.filter((t) => {
      const d = new Date(t.transaction_date);
      return t.type === "income" && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).reduce((s, t) => s + t.amount, 0);
    const dti = monthIncome > 0 ? (monthlyEmi / monthIncome) * 100 : 0;

    return { debt, monthlyEmi, totalBorrowed, totalPaid, payoffPct, dti, monthIncome };
  }, [loans, txs]);

  const upcoming = useMemo(() => {
    return [...loans]
      .filter((l) => l.remaining_balance > 0)
      .map((l) => ({ loan: l, due: nextDueDate(l.due_day) }))
      .sort((a, b) => a.due.getTime() - b.due.getTime())
      .slice(0, 3);
  }, [loans]);

  const debtByType = useMemo(() => {
    const m = new Map<string, number>();
    loans.forEach((l) => {
      const k = typeMeta(l.loan_type).label;
      m.set(k, (m.get(k) ?? 0) + l.remaining_balance);
    });
    return [...m.entries()].map(([name, value]) => ({ name, value }));
  }, [loans]);

  const insights = useMemo(() => {
    const out: string[] = [];
    if (loans.length === 0) return out;
    const remEmis = loans.reduce((s, l) => s + Math.ceil(l.remaining_balance / Math.max(1, l.emi_amount)), 0);
    out.push(`You have ${remEmis} EMIs remaining across ${loans.length} loan${loans.length > 1 ? "s" : ""}.`);
    const top = [...loans].filter(l => l.total_amount > 0).sort((a, b) => (b.total_amount - b.remaining_balance) / b.total_amount - (a.total_amount - a.remaining_balance) / a.total_amount)[0];
    if (top) {
      const p = ((top.total_amount - top.remaining_balance) / top.total_amount) * 100;
      out.push(`${top.loan_name} is ${p.toFixed(0)}% completed.`);
    }
    const high = loans.find((l) => l.interest_rate >= 20);
    if (high) out.push(`${high.loan_name} interest (${high.interest_rate}%) is comparatively high — consider prioritising it.`);
    if (totals.dti > 40) out.push(`Your EMI-to-income ratio is ${totals.dti.toFixed(0)}% — keep it under 40% for a calmer cash flow.`);
    return out;
  }, [loans, totals]);

  return (
    <div className="pb-24">
      <PageHeader
        title="Loan Management"
        subtitle="Privacy-first manual tracking. No bank connections."
        action={
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm" className="gap-1">
              <Link to="/menu"><ArrowLeft className="h-4 w-4" />Menu</Link>
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button className="bg-gradient-primary"><Plus className="mr-1 h-4 w-4" />Add loan</Button>
              </DialogTrigger>
              <DialogContent className="max-h-[90vh] overflow-y-auto md:max-w-xl">
                <DialogHeader><DialogTitle>Add a loan</DialogTitle></DialogHeader>
                <LoanForm onClose={() => setOpen(false)} />
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      <div className="space-y-6 px-6 py-6 md:px-10">
        {/* Summary stats */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Total Outstanding", value: formatCurrency(totals.debt, currency), icon: Wallet, accent: "bg-gradient-primary text-primary-foreground" },
            { label: "Monthly EMI", value: formatCurrency(totals.monthlyEmi, currency), icon: Calendar, accent: "bg-gradient-gold text-gold-foreground" },
            { label: "Active Loans", value: String(loans.filter(l => l.remaining_balance > 0).length), icon: Landmark, accent: "bg-success text-success-foreground" },
            { label: "Debt-to-Income", value: totals.monthIncome > 0 ? `${totals.dti.toFixed(0)}%` : "—", icon: TrendingDown, accent: totals.dti > 40 ? "bg-destructive/90 text-destructive-foreground" : "bg-secondary text-secondary-foreground" },
          ].map((s, i) => (
            <motion.div key={s.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Card className="overflow-hidden shadow-soft">
                <CardContent className="flex items-start justify-between gap-4 p-5">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{s.label}</p>
                    <p className="mt-2 font-display text-2xl font-bold">{s.value}</p>
                  </div>
                  <div className={`flex h-11 w-11 items-center justify-center rounded-xl shadow-elegant ${s.accent}`}>
                    <s.icon className="h-5 w-5" />
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Payoff progress + upcoming */}
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="shadow-soft lg:col-span-2">
            <CardHeader><CardTitle className="font-display">Debt payoff progress</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Paid off</p>
                  <p className="font-display text-2xl font-bold">{formatCurrency(totals.totalPaid, currency)}</p>
                </div>
                <p className="text-sm text-muted-foreground">of {formatCurrency(totals.totalBorrowed, currency)}</p>
              </div>
              <Progress value={totals.payoffPct} />
              <p className="text-xs text-muted-foreground">{totals.payoffPct.toFixed(1)}% complete · keep going calmly.</p>

              {debtByType.length > 0 && (
                <div className="mt-5 h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={debtByType}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="oklch(0.85 0.02 160)" />
                      <XAxis dataKey="name" stroke="oklch(0.55 0.03 160)" fontSize={11} tickLine={false} axisLine={false} />
                      <YAxis stroke="oklch(0.55 0.03 160)" fontSize={11} tickLine={false} axisLine={false} />
                      <Tooltip formatter={(v: number) => formatCurrency(v, currency)} contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12 }} />
                      <Bar dataKey="value" radius={[8, 8, 0, 0]} fill="oklch(0.5 0.12 165)" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-soft">
            <CardHeader><CardTitle className="flex items-center gap-2 font-display"><Calendar className="h-4 w-4 text-primary" />Upcoming EMIs</CardTitle></CardHeader>
            <CardContent>
              {upcoming.length === 0 ? (
                <p className="text-sm text-muted-foreground">No upcoming EMIs. You're debt-free for now.</p>
              ) : (
                <ul className="space-y-3">
                  {upcoming.map(({ loan, due }) => {
                    const Icon = typeMeta(loan.loan_type).icon;
                    const days = Math.ceil((due.getTime() - Date.now()) / 86400000);
                    return (
                      <li key={loan.id} className="flex items-center justify-between gap-3 rounded-xl border p-3">
                        <div className="flex items-center gap-3">
                          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><Icon className="h-4 w-4" /></span>
                          <div>
                            <p className="text-sm font-medium">{loan.loan_name}</p>
                            <p className="text-xs text-muted-foreground">{due.toLocaleDateString(undefined, { day: "numeric", month: "short" })} · in {days}d</p>
                          </div>
                        </div>
                        <p className="font-display text-sm font-semibold">{formatCurrency(loan.emi_amount, currency)}</p>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Insights */}
        {insights.length > 0 && (
          <Card className="shadow-soft">
            <CardHeader><CardTitle className="flex items-center gap-2 font-display"><Sparkles className="h-4 w-4 text-gold" />Smart insights</CardTitle></CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                {insights.map((i, idx) => (
                  <li key={idx} className="flex gap-2"><span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary" />{i}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Loans list */}
        <div>
          <h2 className="mb-3 font-display text-lg font-semibold">Your loans</h2>
          {loans.length === 0 ? (
            <Card className="shadow-soft">
              <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Landmark className="h-6 w-6" /></span>
                <p className="font-display text-lg font-semibold">No loans yet</p>
                <p className="max-w-sm text-sm text-muted-foreground">Add your first loan manually. FinTrackr never connects to your bank — your data stays with you.</p>
                <Button onClick={() => setOpen(true)} className="bg-gradient-primary"><Plus className="mr-1 h-4 w-4" />Add your first loan</Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {loans.map((l, i) => {
                const Icon = typeMeta(l.loan_type).icon;
                const paid = l.total_amount - l.remaining_balance;
                const pct = Math.min(100, (paid / l.total_amount) * 100);
                const due = nextDueDate(l.due_day);
                const days = Math.ceil((due.getTime() - Date.now()) / 86400000);
                const overdue = l.remaining_balance > 0 && days <= 3;
                return (
                  <motion.button
                    key={l.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                    onClick={() => setSelected(l)}
                    className="text-left"
                  >
                    <Card className="h-full shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-elegant">
                      <CardContent className="space-y-3 p-5">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon className="h-5 w-5" /></span>
                            <div>
                              <p className="font-display font-semibold">{l.loan_name}</p>
                              <p className="text-xs text-muted-foreground">{typeMeta(l.loan_type).label}</p>
                            </div>
                          </div>
                          {l.remaining_balance <= 0 ? (
                            <Badge className="bg-success text-success-foreground">Paid off</Badge>
                          ) : overdue ? (
                            <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" />Due soon</Badge>
                          ) : null}
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Remaining</p>
                          <p className="font-display text-xl font-bold">{formatCurrency(l.remaining_balance, currency)}</p>
                        </div>
                        <Progress value={pct} />
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>EMI {formatCurrency(l.emi_amount, currency)}</span>
                          <span>{pct.toFixed(0)}% paid</span>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {selected && <LoanDetailDialog loan={selected} currency={currency} onClose={() => setSelected(null)} />}

      {/* FAB quick actions sheet */}
      <Sheet open={fabSheet} onOpenChange={setFabSheet}>
        <SheetContent side="bottom" className="rounded-t-3xl border-0 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
          <SheetHeader className="text-left">
            <SheetTitle className="font-display">Loan actions</SheetTitle>
            <SheetDescription>Manage your debt & repayments.</SheetDescription>
          </SheetHeader>
          <div className="mt-4 grid grid-cols-2 gap-3">
            {[
              { label: "Add Loan", icon: Wallet, tone: "bg-primary/10 text-primary", onClick: () => { setFabSheet(false); setOpen(true); } },
              { label: "Add EMI", icon: Calendar, tone: "bg-info/15 text-info", onClick: () => { setFabSheet(false); setOpen(true); } },
              { label: "Record Payment", icon: CheckCircle2, tone: "bg-success/10 text-success", onClick: () => { setFabSheet(false); if (loans[0]) setSelected(loans[0]); else setOpen(true); } },
              { label: "Add Borrowed Money", icon: TrendingDown, tone: "bg-destructive/10 text-destructive", onClick: () => { setFabSheet(false); setOpen(true); } },
              { label: "Add Lending Entry", icon: User, tone: "bg-gold/15 text-gold-foreground", onClick: () => { setFabSheet(false); navigate({ to: "/split-settle" }); } },
            ].map((a) => (
              <button key={a.label} onClick={a.onClick}
                className="flex flex-col items-start gap-3 rounded-2xl border bg-card p-4 text-left transition-all hover:border-primary/40 hover:shadow-soft active:scale-[0.98]">
                <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${a.tone}`}>
                  <a.icon className="h-5 w-5" />
                </span>
                <span className="text-sm font-medium">{a.label}</span>
              </button>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
