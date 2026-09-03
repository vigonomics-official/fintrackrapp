import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  CheckCircle2, Home, Car, GraduationCap, CreditCard, Coins, User,
  Briefcase, Landmark, ShieldCheck, Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useLoanPayments, type Loan, type LoanType } from "@/hooks/use-finance";
import { formatCurrency } from "@/lib/currency";
import { friendlyError } from "@/lib/error-utils";

export const LOAN_TYPES: { value: LoanType; label: string; icon: typeof Home }[] = [
  { value: "home", label: "Home Loan", icon: Home },
  { value: "personal", label: "Personal Loan", icon: User },
  { value: "vehicle", label: "Vehicle Loan", icon: Car },
  { value: "education", label: "Education Loan", icon: GraduationCap },
  { value: "gold", label: "Gold Loan", icon: Coins },
  { value: "credit_card", label: "Credit Card Debt", icon: CreditCard },
  { value: "informal", label: "Informal Borrowing", icon: Briefcase },
  { value: "other", label: "Other", icon: Landmark },
];

export const loanTypeMeta = (t: LoanType) =>
  LOAN_TYPES.find((x) => x.value === t) ?? LOAN_TYPES[1];

export function nextLoanDueDate(due_day: number) {
  const today = new Date();
  const d = new Date(today.getFullYear(), today.getMonth(), Math.min(due_day, 28));
  if (d < today) d.setMonth(d.getMonth() + 1);
  return d;
}

/* ------------------------------ Add / Edit form ------------------------------ */

function LoanFields({
  initial, onDone, submitLabel,
}: { initial?: Loan; onDone: () => void; submitLabel: string }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
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

  const flexible = form.loan_type === "credit_card" || form.loan_type === "informal";

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((p) => ({ ...p, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || saving) return;
    if (!form.loan_name || !form.total_amount) {
      return toast.error("Please add a loan name and the original loan amount");
    }
    if (!flexible && (!form.emi_amount || !form.tenure_months)) {
      return toast.error("Please add the monthly EMI and tenure for this loan type");
    }
    const payload = {
      user_id: user.id,
      loan_name: form.loan_name.trim(),
      loan_type: form.loan_type,
      total_amount: Number(form.total_amount),
      interest_rate: Number(form.interest_rate || 0),
      emi_amount: Number(form.emi_amount || 0),
      tenure_months: Number(form.tenure_months || 0),
      remaining_balance: Number(form.remaining_balance || form.total_amount),
      start_date: form.start_date,
      due_day: Math.min(28, Math.max(1, Number(form.due_day || 1))),
      notes: form.notes.trim() || null,
    };
    setSaving(true);
    const { error } = initial
      ? await supabase.from("loans" as any).update(payload).eq("id", initial.id)
      : await supabase.from("loans" as any).insert(payload);
    setSaving(false);
    if (error) return toast.error(friendlyError(error));
    toast.success(initial ? "Loan updated" : "Loan added");
    await qc.invalidateQueries({ queryKey: ["loans"] });
    onDone();
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="space-y-1.5">
        <Label className="text-xs">Loan name *</Label>
        <Input value={form.loan_name} onChange={(e) => set("loan_name", e.target.value)} placeholder="e.g. Honda City EMI" />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Loan type *</Label>
        <Select value={form.loan_type} onValueChange={(v) => set("loan_type", v as LoanType)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {LOAN_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
          </SelectContent>
        </Select>
        {flexible && (
          <p className="text-[11px] text-muted-foreground">
            EMI, interest and tenure are optional for this loan type.
          </p>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        <div className="space-y-1.5">
          <Label className="text-xs">Original loan amount *</Label>
          <Input type="number" inputMode="decimal" step="0.01" value={form.total_amount} onChange={(e) => set("total_amount", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Current outstanding</Label>
          <Input type="number" inputMode="decimal" step="0.01" placeholder="Same as total" value={form.remaining_balance} onChange={(e) => set("remaining_balance", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Monthly EMI{flexible ? "" : " *"}</Label>
          <Input type="number" inputMode="decimal" step="0.01" value={form.emi_amount} onChange={(e) => set("emi_amount", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Interest % p.a.</Label>
          <Input type="number" inputMode="decimal" step="0.01" value={form.interest_rate} onChange={(e) => set("interest_rate", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Tenure (months){flexible ? "" : " *"}</Label>
          <Input type="number" inputMode="numeric" value={form.tenure_months} onChange={(e) => set("tenure_months", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">EMI day (1–28)</Label>
          <Input type="number" inputMode="numeric" min={1} max={28} value={form.due_day} onChange={(e) => set("due_day", e.target.value)} />
        </div>
        <div className="col-span-2 space-y-1.5">
          <Label className="text-xs">Start date</Label>
          <Input type="date" value={form.start_date} onChange={(e) => set("start_date", e.target.value)} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Notes</Label>
        <Textarea rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
      </div>
      <Button type="submit" disabled={saving} className="w-full bg-gradient-primary">
        {saving ? "Saving…" : submitLabel}
      </Button>
    </form>
  );
}

export function LoanFormSheet({
  open, onOpenChange, initial,
}: { open: boolean; onOpenChange: (v: boolean) => void; initial?: Loan }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[92vh] overflow-y-auto rounded-t-2xl px-4 pb-8">
        <SheetHeader className="px-0 text-left">
          <SheetTitle className="font-display">{initial ? "Edit loan" : "Add a loan"}</SheetTitle>
          <SheetDescription className="text-xs">
            Stays right here in Planner → Loans. Fields marked * are required.
          </SheetDescription>
        </SheetHeader>
        <LoanFields
          initial={initial}
          submitLabel={initial ? "Save changes" : "Add loan"}
          onDone={() => onOpenChange(false)}
        />
      </SheetContent>
    </Sheet>
  );
}

/* ------------------------------ Loan detail ------------------------------ */

export function LoanDetailSheet({
  loan, currency, open, onOpenChange,
}: { loan: Loan; currency: string; open: boolean; onOpenChange: (v: boolean) => void }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: payments = [] } = useLoanPayments(loan.id);
  const [editOpen, setEditOpen] = useState(false);
  const [confirmPaidOff, setConfirmPaidOff] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [payAmount, setPayAmount] = useState("");
  const [busy, setBusy] = useState(false);

  const deleteLoan = async () => {
    if (busy) return;
    setBusy(true);
    const { error: pe } = await supabase.from("loan_payments" as any).delete().eq("loan_id", loan.id);
    if (pe) { setBusy(false); return toast.error(friendlyError(pe)); }
    const { error } = await supabase.from("loans" as any).delete().eq("id", loan.id);
    setBusy(false);
    if (error) return toast.error(friendlyError(error));
    toast.success("Loan deleted");
    setConfirmDelete(false);
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["loans"] }),
      qc.invalidateQueries({ queryKey: ["loan_payments"] }),
    ]);
    onOpenChange(false);
  };

  const paid = Math.max(0, loan.total_amount - loan.remaining_balance);
  const pct = loan.total_amount > 0 ? Math.min(100, (paid / loan.total_amount) * 100) : 0;
  const emisLeft = loan.emi_amount > 0
    ? Math.max(0, Math.ceil(loan.remaining_balance / loan.emi_amount))
    : 0;
  const due = nextLoanDueDate(loan.due_day);
  const isClosed = loan.remaining_balance <= 0;
  const Icon = loanTypeMeta(loan.loan_type).icon;

  const lastPayment = useMemo(
    () => [...payments].sort((a, b) => b.payment_date.localeCompare(a.payment_date))[0] ?? null,
    [payments],
  );

  const recordPayment = async () => {
    if (!user || busy) return;
    const amt = Number(payAmount) || loan.emi_amount;
    if (amt <= 0) return toast.error("Enter a payment amount");
    setBusy(true);
    const newBal = Math.max(0, loan.remaining_balance - amt);
    const { error: e1 } = await supabase.from("loan_payments" as any).insert({
      loan_id: loan.id,
      user_id: user.id,
      payment_date: new Date().toISOString().slice(0, 10),
      payment_amount: Math.min(amt, loan.remaining_balance),
      remaining_balance: newBal,
      payment_status: "paid",
    });
    if (e1) { setBusy(false); return toast.error(friendlyError(e1)); }
    const { error: e2 } = await supabase.from("loans" as any)
      .update({ remaining_balance: newBal }).eq("id", loan.id);
    setBusy(false);
    if (e2) return toast.error(friendlyError(e2));
    toast.success("Payment recorded");
    setPayAmount("");
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["loans"] }),
      qc.invalidateQueries({ queryKey: ["loan_payments"] }),
    ]);
  };

  const markPaidOff = async () => {
    if (!user || busy) return;
    setBusy(true);
    if (loan.remaining_balance > 0) {
      const { error: e1 } = await supabase.from("loan_payments" as any).insert({
        loan_id: loan.id,
        user_id: user.id,
        payment_date: new Date().toISOString().slice(0, 10),
        payment_amount: loan.remaining_balance,
        remaining_balance: 0,
        payment_status: "paid",
      });
      if (e1) { setBusy(false); return toast.error(friendlyError(e1)); }
    }
    const { error: e2 } = await supabase.from("loans" as any)
      .update({ remaining_balance: 0 }).eq("id", loan.id);
    setBusy(false);
    if (e2) return toast.error(friendlyError(e2));
    toast.success("Loan marked as paid off — history kept");
    setConfirmPaidOff(false);
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["loans"] }),
      qc.invalidateQueries({ queryKey: ["loan_payments"] }),
    ]);
    onOpenChange(false);
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="max-h-[92vh] overflow-y-auto rounded-t-2xl px-4 pb-8">
          <SheetHeader className="px-0 text-left">
            <SheetTitle className="flex items-center gap-2.5 font-display">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Icon className="h-4.5 w-4.5" />
              </span>
              <span className="min-w-0 truncate">{loan.loan_name}</span>
            </SheetTitle>
            <SheetDescription className="text-xs">
              {loanTypeMeta(loan.loan_type).label}
              {isClosed ? " · Paid off" : ""}
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-4">
            <Card className="border-none bg-gradient-primary text-primary-foreground shadow-elegant">
              <CardContent className="p-4">
                <p className="text-[10px] uppercase tracking-wider opacity-80">Outstanding</p>
                <p className="font-display text-2xl font-bold tabular-nums">
                  {formatCurrency(loan.remaining_balance, currency)}
                </p>
                <div className="mt-2 flex items-center justify-between text-[11px] opacity-90">
                  <span>{pct.toFixed(0)}% repaid</span>
                  <span>{isClosed ? "Closed" : `${emisLeft} EMIs left`}</span>
                </div>
                <Progress value={pct} className="mt-1.5 bg-white/20" />
              </CardContent>
            </Card>

            <div className="grid grid-cols-2 gap-2.5 text-sm">
              <Field label="Monthly EMI" value={formatCurrency(loan.emi_amount, currency)} />
              <Field label="Interest" value={`${loan.interest_rate}% p.a.`} />
              <Field label="Tenure" value={`${loan.tenure_months} months`} />
              <Field label="Original amount" value={formatCurrency(loan.total_amount, currency)} />
              <Field
                label="Next payment"
                value={isClosed ? "—" : due.toLocaleDateString(undefined, { day: "numeric", month: "short" })}
              />
              <Field
                label="Last payment"
                value={lastPayment ? new Date(lastPayment.payment_date).toLocaleDateString(undefined, { day: "numeric", month: "short" }) : "None yet"}
              />
            </div>

            {!isClosed && (
              <Card className="shadow-soft">
                <CardContent className="space-y-2.5 p-3.5">
                  <p className="text-sm font-semibold">Record a payment</p>
                  <Input
                    type="number" inputMode="decimal"
                    placeholder={`EMI ${formatCurrency(loan.emi_amount, currency)}`}
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button" variant="outline" size="sm"
                      disabled={busy || loan.emi_amount <= 0}
                      onClick={() => setPayAmount(String(loan.emi_amount))}
                    >
                      One EMI
                    </Button>
                    <Button
                      type="button" variant="outline" size="sm"
                      disabled={busy || loan.emi_amount <= 0}
                      onClick={() => setPayAmount(String(loan.emi_amount * 2))}
                    >
                      EMI + extra
                    </Button>
                  </div>
                  <Button className="w-full bg-gradient-primary" disabled={busy} onClick={recordPayment}>
                    <CheckCircle2 className="mr-1.5 h-4 w-4" />
                    Record payment
                  </Button>
                  <p className="text-[11px] text-muted-foreground">
                    Leave blank to record one full EMI, or enter any amount for an extra payment.
                    This only updates this loan's outstanding balance — no expense transaction is created.
                    When the balance reaches zero the loan is closed automatically and kept in history.
                  </p>
                </CardContent>
              </Card>
            )}

            <div>
              <p className="mb-1.5 text-sm font-semibold">Payment history</p>
              {payments.length === 0 ? (
                <p className="text-xs text-muted-foreground">No payments recorded yet.</p>
              ) : (
                <ul className="divide-y rounded-lg border">
                  {payments.slice(0, 8).map((p) => (
                    <li key={p.id} className="flex items-center justify-between px-3 py-2 text-xs">
                      <span className="flex items-center gap-1.5">
                        <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                        {new Date(p.payment_date).toLocaleDateString()}
                      </span>
                      <span className="font-semibold tabular-nums">
                        {formatCurrency(p.payment_amount, currency)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {loan.notes && (
              <p className="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">{loan.notes}</p>
            )}

            <div className="flex flex-col gap-2">
              <Button variant="outline" className="w-full" onClick={() => setEditOpen(true)}>
                Edit loan details
              </Button>
              {!isClosed && (
                <Button variant="outline" className="w-full text-success" onClick={() => setConfirmPaidOff(true)}>
                  <ShieldCheck className="mr-1.5 h-4 w-4" />
                  Mark as Paid Off
                </Button>
              )}
              <Button
                variant="ghost"
                className="w-full text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 className="mr-1.5 h-4 w-4" />
                Delete loan
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <LoanFormSheet open={editOpen} onOpenChange={setEditOpen} initial={loan} />

      <AlertDialog open={confirmPaidOff} onOpenChange={setConfirmPaidOff}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark this loan as paid off?</AlertDialogTitle>
            <AlertDialogDescription>
              {loan.loan_name}'s outstanding balance will be set to zero and it will move to
              Closed Loans. The loan record and its payment history are kept — nothing is deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={busy} onClick={(e) => { e.preventDefault(); markPaidOff(); }}>
              Yes, mark paid off
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{loan.loan_name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the loan and its payment history from your account.
              Your outstanding balance, EMI pressure and debt-free date will be recalculated.
              This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => { e.preventDefault(); deleteLoan(); }}
            >
              Delete permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/20 p-2.5">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-semibold tabular-nums">{value}</p>
    </div>
  );
}
