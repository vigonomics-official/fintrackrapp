import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useProfile } from "@/hooks/use-finance";
import { formatCurrency } from "@/lib/currency";
import {
  useSalarySettings,
  payDayLabel,
  employmentLabel,
  type EmploymentType,
} from "@/hooks/use-salary-settings";

type EditKey = null | "amount" | "date" | "type";

const DATE_PRESETS: { label: string; value: number }[] = [
  { label: "1st", value: 1 }, { label: "5th", value: 5 }, { label: "7th", value: 7 },
  { label: "10th", value: 10 }, { label: "15th", value: 15 }, { label: "25th", value: 25 },
  { label: "Last Day", value: 0 },
];

export function SalarySettingsSection() {
  const { data: profile } = useProfile();
  const currency = profile?.currency ?? "INR";
  const { settings, update, isConfigured } = useSalarySettings();
  const [edit, setEdit] = useState<EditKey>(null);

  const amountDisplay = settings.amount != null
    ? formatCurrency(settings.amount, currency)
    : "Not Set";

  return (
    <section>
      <h2 className="mb-2.5 px-1 truncate text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground sm:text-xs">
        Salary Settings
      </h2>

      {!isConfigured && (
        <div className="mb-2.5 flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-50 p-3 text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p className="text-xs">Set your salary to unlock all salary planning features.</p>
        </div>
      )}

      <Card className="overflow-hidden shadow-soft">
        <ul className="divide-y">
          <Row
            icon="💰" label="Monthly Salary"
            value={amountDisplay}
            valueClass={settings.amount != null ? "text-success font-bold" : "text-destructive font-semibold"}
            actionLabel={settings.amount == null ? "Tap to Set Up" : "Edit"}
            onAction={() => setEdit("amount")}
          />
          <Row
            icon="📅" label="Salary Date"
            value={payDayLabel(settings.payDay)}
            valueClass={settings.payDay != null ? "text-foreground" : "text-destructive font-semibold"}
            actionLabel="Edit"
            onAction={() => setEdit("date")}
          />
          <Row
            icon="🏦" label="Employment Type"
            value={employmentLabel(settings.employmentType)}
            valueClass="text-foreground"
            actionLabel="Edit"
            onAction={() => setEdit("type")}
          />
        </ul>
      </Card>

      <AmountSheet
        open={edit === "amount"}
        initial={settings.amount}
        currency={currency}
        onClose={() => setEdit(null)}
        onSave={(v) => { update({ amount: v }); setEdit(null); }}
      />
      <DateSheet
        open={edit === "date"}
        initial={settings.payDay}
        onClose={() => setEdit(null)}
        onSave={(v) => { update({ payDay: v }); setEdit(null); }}
      />
      <TypeSheet
        open={edit === "type"}
        initial={settings.employmentType}
        onClose={() => setEdit(null)}
        onSave={(v) => { update({ employmentType: v }); setEdit(null); }}
      />
    </section>
  );
}

function Row({
  icon, label, value, valueClass, actionLabel, onAction,
}: {
  icon: string; label: string; value: string; valueClass?: string;
  actionLabel: string; onAction: () => void;
}) {
  return (
    <li className="flex items-center justify-between gap-3 px-3 py-3 sm:px-4">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted text-base">
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{label}</p>
          <p className={cn("truncate text-xs", valueClass ?? "text-muted-foreground")}>{value}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={onAction}
        className="shrink-0 text-xs font-semibold text-success hover:underline"
      >
        {actionLabel}
      </button>
    </li>
  );
}

function AmountSheet({
  open, initial, currency, onClose, onSave,
}: { open: boolean; initial: number | null; currency: string; onClose: () => void; onSave: (v: number) => void }) {
  const [val, setVal] = useState<string>(initial != null ? String(initial) : "");
  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent side="bottom" className="rounded-t-2xl">
        <SheetHeader>
          <SheetTitle>Update Monthly Salary</SheetTitle>
        </SheetHeader>
        <div className="space-y-4 pt-4">
          <div className="space-y-1.5">
            <Label htmlFor="salary-amt" className="text-xs">Monthly Salary ({currency})</Label>
            <Input
              id="salary-amt" type="number" inputMode="decimal" autoFocus
              placeholder="21000" value={val}
              onChange={(e) => setVal(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Button
              className="w-full bg-success hover:bg-success/90 text-success-foreground"
              disabled={!val || Number(val) <= 0}
              onClick={() => onSave(Number(val))}
            >Save</Button>
            <Button variant="ghost" className="w-full" onClick={onClose}>Cancel</Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function DateSheet({
  open, initial, onClose, onSave,
}: { open: boolean; initial: number | null; onClose: () => void; onSave: (v: number) => void }) {
  const isPreset = initial != null && DATE_PRESETS.some((p) => p.value === initial);
  const [sel, setSel] = useState<number | "other" | null>(
    initial == null ? null : isPreset ? initial : "other"
  );
  const [other, setOther] = useState<string>(initial != null && !isPreset ? String(initial) : "");

  const canSave = sel !== null && (sel !== "other" || (Number(other) >= 1 && Number(other) <= 31));

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent side="bottom" className="rounded-t-2xl">
        <SheetHeader>
          <SheetTitle>When do you get paid?</SheetTitle>
        </SheetHeader>
        <div className="space-y-4 pt-4">
          <div className="flex flex-wrap gap-2">
            {DATE_PRESETS.map((p) => (
              <button
                key={p.value} type="button"
                onClick={() => setSel(p.value)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                  sel === p.value
                    ? "border-success bg-success text-success-foreground"
                    : "border-border bg-background text-foreground hover:bg-muted"
                )}
              >{p.label}</button>
            ))}
            <button
              type="button"
              onClick={() => setSel("other")}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                sel === "other"
                  ? "border-success bg-success text-success-foreground"
                  : "border-border bg-background text-foreground hover:bg-muted"
              )}
            >Other</button>
          </div>
          {sel === "other" && (
            <div className="space-y-1.5">
              <Label htmlFor="salary-day" className="text-xs">Day of month (1-31)</Label>
              <Input
                id="salary-day" type="number" inputMode="numeric" min={1} max={31}
                value={other} onChange={(e) => setOther(e.target.value)}
              />
            </div>
          )}
          <Button
            className="w-full bg-success hover:bg-success/90 text-success-foreground"
            disabled={!canSave}
            onClick={() => onSave(sel === "other" ? Number(other) : (sel as number))}
          >Save</Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function TypeSheet({
  open, initial, onClose, onSave,
}: { open: boolean; initial: EmploymentType; onClose: () => void; onSave: (v: EmploymentType) => void }) {
  const [sel, setSel] = useState<EmploymentType>(initial);
  const opts: { value: EmploymentType; label: string; hint: string }[] = [
    { value: "salaried", label: "Salaried", hint: "Monthly fixed" },
    { value: "daily_wage", label: "Daily Wage", hint: "Paid per day" },
    { value: "freelance", label: "Freelance", hint: "Variable income" },
  ];
  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent side="bottom" className="rounded-t-2xl">
        <SheetHeader>
          <SheetTitle>Employment Type</SheetTitle>
        </SheetHeader>
        <div className="space-y-2 pt-4">
          {opts.map((o) => (
            <button
              key={o.value} type="button"
              onClick={() => setSel(o.value)}
              className={cn(
                "flex w-full items-center justify-between rounded-xl border p-3 text-left transition-colors",
                sel === o.value ? "border-success bg-success/10" : "border-border bg-background hover:bg-muted/50"
              )}
            >
              <div>
                <p className="text-sm font-medium">{o.label}</p>
                <p className="text-xs text-muted-foreground">{o.hint}</p>
              </div>
              <span className={cn(
                "flex h-5 w-5 items-center justify-center rounded-full border-2",
                sel === o.value ? "border-success" : "border-muted-foreground/40"
              )}>
                {sel === o.value && <span className="h-2.5 w-2.5 rounded-full bg-success" />}
              </span>
            </button>
          ))}
          <Button
            className="mt-2 w-full bg-success hover:bg-success/90 text-success-foreground"
            onClick={() => onSave(sel)}
          >Save</Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
