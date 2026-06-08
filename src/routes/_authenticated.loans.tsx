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
  Clock, IndianRupee, Eye,
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
import { useSalarySettings } from "@/hooks/use-salary-settings";
import { computeSurvival } from "@/lib/survival";
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
  const { settings: salarySettings } = useSalarySettings();
  const qc = useQueryClient();
  const { user } = useAuth();
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

  // Salary survival assistant computations
  const survival = useMemo(() => {
    const incomes = txs
      .filter((t) => t.type === "income")
      .sort((a, b) => b.transaction_date.localeCompare(a.transaction_date));
    const lastSalary = incomes[0];
    const today = new Date();

    // next salary date: same day-of-month as last income, next occurrence
    let daysUntil: number | null = null;
    let nextDate: Date | null = null;
    if (lastSalary) {
      const last = new Date(lastSalary.transaction_date);
      const d = new Date(today.getFullYear(), today.getMonth(), Math.min(last.getDate(), 28));
      if (d <= today) d.setMonth(d.getMonth() + 1);
      nextDate = d;
      daysUntil = Math.max(1, Math.ceil((d.getTime() - today.getTime()) / 86400000));
    }

    // spending this month (expense txns)
    const monthSpend = txs.filter((t) => {
      const d = new Date(t.transaction_date);
      return t.type === "expense" && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
    }).reduce((s, t) => s + t.amount, 0);

    const salaryLeft = Math.max(0, totals.monthIncome - totals.monthlyEmi - monthSpend);
    const safeDaily = daysUntil ? Math.max(0, Math.floor(salaryLeft / daysUntil)) : 0;

    let pressure: "safe" | "moderate" | "high" = "safe";
    if (totals.dti >= 50) pressure = "high";
    else if (totals.dti >= 30) pressure = "moderate";

    return { salaryLeft, daysUntil, nextDate, safeDaily, pressure, hasIncome: !!lastSalary };
  }, [txs, totals]);

  const quickMarkPaid = async (loan: Loan, e: React.MouseEvent) => {
    e.stopPropagation();
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
    const { error: e2 } = await supabase.from("loans" as any).update({ remaining_balance: newBal }).eq("id", loan.id);
    if (e2) return toast.error(friendlyError(e2));
    toast.success("EMI marked as paid");
    qc.invalidateQueries({ queryKey: ["loans"] });
    qc.invalidateQueries({ queryKey: ["loan_payments"] });
  };

  const upcoming = useMemo(() => {
    return [...loans]
      .filter((l) => l.remaining_balance > 0)
      .map((l) => ({ loan: l, due: nextDueDate(l.due_day) }))
      .sort((a, b) => a.due.getTime() - b.due.getTime())
      .slice(0, 4);
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
      out.push(`${top.loan_name} is ${p.toFixed(0)}% completed — you're on track.`);
    }
    const high = loans.find((l) => l.interest_rate >= 20);
    if (high) out.push(`${high.loan_name} interest (${high.interest_rate}%) is comparatively high — consider prioritising it.`);
    if (totals.dti > 40) out.push(`Your EMI pressure is ${totals.dti.toFixed(0)}% of income — keep it under 40% for calmer cash flow.`);
    return out;
  }, [loans, totals]);

  return (
    <div className="pb-24">
      <PageHeader
        title="Loans & EMI"
        subtitle="Track your EMIs stress-free. Understand how much salary remains after payments."
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
        {/* SALARY SURVIVAL HERO */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="overflow-hidden border-none bg-gradient-primary text-primary-foreground shadow-elegant">
            <CardContent className="space-y-5 p-6 md:p-7">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-[0.14em] opacity-80">Salary left after EMI</p>
                  <p className="mt-1 font-display text-3xl font-bold md:text-4xl">
                    {survival.hasIncome ? formatCurrency(survival.salaryLeft, currency) : "—"}
                  </p>
                  <p className="mt-1 text-xs opacity-85">
                    {!survival.hasIncome
                      ? "Add this month's salary to unlock your survival plan."
                      : survival.pressure === "high"
                      ? "Careful spending recommended until next salary."
                      : survival.pressure === "moderate"
                      ? "You're managing — pace yourself this month."
                      : "You're managing well this month."}
                  </p>
                </div>
                <span
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold backdrop-blur-sm ${
                    survival.pressure === "high"
                      ? "bg-destructive/90 text-destructive-foreground"
                      : survival.pressure === "moderate"
                      ? "bg-gold/90 text-gold-foreground"
                      : "bg-success/90 text-success-foreground"
                  }`}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-current" />
                  {survival.pressure === "high" ? "High Pressure" : survival.pressure === "moderate" ? "Moderate" : "Safe"}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <div className="rounded-2xl bg-white/10 p-3 backdrop-blur-sm">
                  <div className="flex items-center gap-1.5 text-[11px] opacity-85"><Clock className="h-3 w-3" />Next salary</div>
                  <p className="mt-1 font-display text-lg font-bold">
                    {survival.daysUntil ? `${survival.daysUntil} days` : "—"}
                  </p>
                </div>
                <div className="rounded-2xl bg-white/10 p-3 backdrop-blur-sm">
                  <div className="flex items-center gap-1.5 text-[11px] opacity-85"><IndianRupee className="h-3 w-3" />Safe daily</div>
                  <p className="mt-1 font-display text-lg font-bold">
                    {survival.hasIncome && survival.safeDaily > 0 ? `${formatCurrency(survival.safeDaily, currency)}/d` : "—"}
                  </p>
                </div>
                <div className="col-span-2 rounded-2xl bg-white/10 p-3 backdrop-blur-sm sm:col-span-1">
                  <div className="flex items-center gap-1.5 text-[11px] opacity-85"><Calendar className="h-3 w-3" />Monthly EMI</div>
                  <p className="mt-1 font-display text-lg font-bold">{formatCurrency(totals.monthlyEmi, currency)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Payoff progress + upcoming timeline */}
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="shadow-soft lg:col-span-2">
            <CardHeader>
              <CardTitle className="font-display">Total Loan Burden</CardTitle>
            </CardHeader>
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
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-display">
                <Calendar className="h-4 w-4 text-primary" />Upcoming EMIs
              </CardTitle>
            </CardHeader>
            <CardContent>
              {upcoming.length === 0 ? (
                <p className="text-sm text-muted-foreground">No upcoming EMIs. You're stress-free for now.</p>
              ) : (
                <ol className="relative space-y-4 border-l border-border/70 pl-5">
                  {upcoming.map(({ loan, due }) => {
                    const Icon = typeMeta(loan.loan_type).icon;
                    const days = Math.ceil((due.getTime() - Date.now()) / 86400000);
                    const overdue = days < 0;
                    const dueTomorrow = days >= 0 && days <= 1;
                    const tone = overdue
                      ? "bg-destructive text-destructive-foreground"
                      : dueTomorrow
                      ? "bg-gold text-gold-foreground"
                      : "bg-success text-success-foreground";
                    const chipText = overdue
                      ? "Overdue"
                      : days === 0
                      ? "Due Today"
                      : days === 1
                      ? "Due Tomorrow"
                      : `In ${days} days`;
                    return (
                      <li key={loan.id} className="relative">
                        <span className={`absolute -left-[26px] top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full ring-4 ring-background ${tone}`} />
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold">{loan.loan_name}</p>
                            <div className="mt-1 flex flex-wrap items-center gap-1.5">
                              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${tone}`}>
                                {chipText}
                              </span>
                              <span className="text-[11px] text-muted-foreground">
                                {due.toLocaleDateString(undefined, { day: "numeric", month: "short" })}
                              </span>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-display text-sm font-bold">{formatCurrency(loan.emi_amount, currency)}</p>
                            <button
                              onClick={(e) => quickMarkPaid(loan, e)}
                              className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
                            >
                              <CheckCircle2 className="h-3 w-3" />Mark paid
                            </button>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ol>
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
          <h2 className="mb-3 font-display text-lg font-semibold">Your loans & EMIs</h2>
          {loans.length === 0 ? (
            <Card className="shadow-soft">
              <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Landmark className="h-6 w-6" /></span>
                <p className="font-display text-lg font-semibold">No loans or EMIs yet</p>
                <p className="max-w-sm text-sm text-muted-foreground">Add your home, vehicle, or personal loan manually. Your data stays private — no bank connections needed.</p>
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
                const emisLeft = Math.max(0, Math.ceil(l.remaining_balance / Math.max(1, l.emi_amount)));
                return (
                  <motion.div
                    key={l.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                  >
                    <Card className="h-full shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-elegant">
                      <CardContent className="space-y-4 p-5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-3">
                            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon className="h-5 w-5" /></span>
                            <div>
                              <p className="font-display font-semibold leading-tight">{l.loan_name}</p>
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
                          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Remaining</p>
                          <p className="font-display text-2xl font-bold leading-tight">{formatCurrency(l.remaining_balance, currency)}</p>
                        </div>

                        <div className="space-y-1.5">
                          <Progress value={pct} />
                          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                            <span>{pct.toFixed(0)}% paid</span>
                            <span>{emisLeft} EMIs left</span>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 rounded-xl bg-muted/40 p-3 text-xs">
                          <div>
                            <p className="text-muted-foreground">EMI</p>
                            <p className="font-semibold text-foreground">{formatCurrency(l.emi_amount, currency)}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-muted-foreground">Next due</p>
                            <p className="font-semibold text-foreground">
                              {l.remaining_balance > 0 ? due.toLocaleDateString(undefined, { day: "numeric", month: "short" }) : "—"}
                            </p>
                          </div>
                        </div>

                        <div className="flex gap-2 pt-1">
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1 gap-1"
                            onClick={() => setSelected(l)}
                          >
                            <Eye className="h-3.5 w-3.5" />View
                          </Button>
                          <Button
                            size="sm"
                            className="flex-1 gap-1 bg-gradient-primary"
                            disabled={l.remaining_balance <= 0}
                            onClick={(e) => quickMarkPaid(l, e)}
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />Mark Paid
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
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
            <SheetTitle className="font-display">EMI & Loan actions</SheetTitle>
            <SheetDescription>Stay ahead of upcoming EMIs. Track repayments calmly.</SheetDescription>
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
