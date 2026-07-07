import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { FINANCIAL_GOALS, type FinancialGoal, type CoachAnalysisInput } from "@/lib/ai-coach-analysis";

type NumericKey =
  | "monthlySalary"
  | "currentAccountBalance"
  | "monthlyRent"
  | "monthlyFood"
  | "monthlyTransport"
  | "monthlyEmi"
  | "monthlyBills"
  | "monthlyInvestments"
  | "currentSavings"
  | "otherMonthlyExpenses";

type FormState = Record<NumericKey, string> & {
  salaryDate: string;
  financialGoal: FinancialGoal | "";
  customGoalNote: string;
};

const NUMERIC_FIELDS: { key: NumericKey; label: string; required: boolean; placeholder?: string }[] = [
  { key: "monthlySalary", label: "Monthly Salary", required: true, placeholder: "e.g. 50000" },
  { key: "currentAccountBalance", label: "Current Account Balance", required: true, placeholder: "e.g. 12000" },
  { key: "monthlyRent", label: "Monthly Rent", required: true },
  { key: "monthlyFood", label: "Monthly Food Expense", required: true },
  { key: "monthlyTransport", label: "Monthly Transport Expense", required: true },
  { key: "monthlyEmi", label: "Monthly EMI", required: false },
  { key: "monthlyBills", label: "Monthly Bills", required: true },
  { key: "monthlyInvestments", label: "Monthly Investments", required: false },
  { key: "currentSavings", label: "Current Savings", required: true },
  { key: "otherMonthlyExpenses", label: "Other Monthly Expenses", required: false },
];

const INITIAL: FormState = {
  monthlySalary: "",
  currentAccountBalance: "",
  monthlyRent: "",
  monthlyFood: "",
  monthlyTransport: "",
  monthlyEmi: "",
  monthlyBills: "",
  monthlyInvestments: "",
  currentSavings: "",
  otherMonthlyExpenses: "",
  salaryDate: "",
  financialGoal: "",
  customGoalNote: "",
};

export const COACH_INPUT_STORAGE_KEY = "fintrackr:ai-coach:last-input";

export type AnalyzeFormProps = {
  initial?: Partial<CoachAnalysisInput>;
  autoFilled?: ReadonlySet<string>;
};

export function AnalyzeForm({ initial, autoFilled }: AnalyzeFormProps = {}) {
  const navigate = useNavigate();
  const [form, setForm] = useState<FormState>(() => {
    if (!initial) return INITIAL;
    const seed: FormState = { ...INITIAL };
    for (const f of NUMERIC_FIELDS) {
      const v = (initial as Record<string, unknown>)[f.key];
      if (typeof v === "number" && Number.isFinite(v) && v > 0) seed[f.key] = String(v);
    }
    if (initial.salaryDate) seed.salaryDate = initial.salaryDate;
    if (initial.financialGoal) seed.financialGoal = initial.financialGoal;
    if (initial.customGoalNote) seed.customGoalNote = initial.customGoalNote;
    return seed;
  });
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const isAuto = (k: string) => !!autoFilled?.has(k);

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => (e[key] ? { ...e, [key]: undefined } : e));
  };

  const validate = (): boolean => {
    const next: Partial<Record<keyof FormState, string>> = {};
    for (const f of NUMERIC_FIELDS) {
      const raw = form[f.key];
      if (f.required) {
        if (raw === "" || raw == null) {
          next[f.key] = "Required";
          continue;
        }
        const n = Number(raw);
        if (!Number.isFinite(n) || n < 0) next[f.key] = "Enter a valid amount";
      } else if (raw !== "") {
        const n = Number(raw);
        if (!Number.isFinite(n) || n < 0) next[f.key] = "Enter a valid amount";
      }
    }
    if (!form.salaryDate) next.salaryDate = "Required";
    if (!form.financialGoal) next.financialGoal = "Select a goal";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    const num = (v: string) => (v === "" ? 0 : Number(v));
    const input: CoachAnalysisInput = {
      monthlySalary: num(form.monthlySalary),
      salaryDate: form.salaryDate,
      currentAccountBalance: num(form.currentAccountBalance),
      monthlyRent: num(form.monthlyRent),
      monthlyFood: num(form.monthlyFood),
      monthlyTransport: num(form.monthlyTransport),
      monthlyEmi: num(form.monthlyEmi),
      monthlyBills: num(form.monthlyBills),
      monthlyInvestments: num(form.monthlyInvestments),
      currentSavings: num(form.currentSavings),
      otherMonthlyExpenses: num(form.otherMonthlyExpenses),
      financialGoal: form.financialGoal as FinancialGoal,
      customGoalNote: form.customGoalNote || undefined,
    };
    try {
      sessionStorage.setItem(COACH_INPUT_STORAGE_KEY, JSON.stringify(input));
    } catch {
      /* ignore storage errors */
    }
    navigate({ to: "/insights/ai-coach/results" });
  };

  return (
    <form onSubmit={onSubmit} noValidate>
      <Card className="p-4 shadow-soft sm:p-5">
        <div className="mb-4 flex items-start gap-2">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <div>
            <p className="font-display text-sm font-semibold">Tell us about your money</p>
            <p className="text-xs text-muted-foreground">
              We'll analyse your salary survival plan. Amounts stay on your device.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {NUMERIC_FIELDS.map((f) => (
            <FieldWrap
              key={f.key}
              id={f.key}
              label={f.label}
              required={f.required}
              error={errors[f.key]}
              hint={isAuto(f.key) ? "Calculated from this month's transactions" : undefined}
            >
              <Input
                id={f.key}
                type="number"
                inputMode="decimal"
                min={0}
                placeholder={f.placeholder ?? "0"}
                value={form[f.key]}
                onChange={(e) => setField(f.key, e.target.value)}
                aria-invalid={!!errors[f.key]}
              />
            </FieldWrap>
          ))}

          <FieldWrap
            id="salaryDate"
            label="Salary Date"
            required
            error={errors.salaryDate}
            hint={isAuto("salaryDate") ? "Calculated from this month's transactions" : undefined}
          >
            <Input
              id="salaryDate"
              type="date"
              value={form.salaryDate}
              onChange={(e) => setField("salaryDate", e.target.value)}
              aria-invalid={!!errors.salaryDate}
            />
          </FieldWrap>

          <FieldWrap id="financialGoal" label="Financial Goal" required error={errors.financialGoal}>
            <Select
              value={form.financialGoal || undefined}
              onValueChange={(v) => setField("financialGoal", v as FinancialGoal)}
            >
              <SelectTrigger id="financialGoal" aria-invalid={!!errors.financialGoal}>
                <SelectValue placeholder="Select a goal" />
              </SelectTrigger>
              <SelectContent>
                {FINANCIAL_GOALS.map((g) => (
                  <SelectItem key={g} value={g}>
                    {g}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FieldWrap>

          {form.financialGoal === "Custom Goal" && (
            <FieldWrap id="customGoalNote" label="Describe your goal" className="sm:col-span-2">
              <Input
                id="customGoalNote"
                type="text"
                maxLength={80}
                placeholder="e.g. Laptop upgrade"
                value={form.customGoalNote}
                onChange={(e) => setField("customGoalNote", e.target.value)}
              />
            </FieldWrap>
          )}
        </div>

        <Button type="submit" className="mt-5 w-full" size="lg">
          <Sparkles className="mr-2 h-4 w-4" />
          Analyze My Salary
        </Button>
      </Card>
    </form>
  );
}

function FieldWrap({
  id,
  label,
  required,
  error,
  hint,
  className,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("min-w-0 space-y-1.5", className)}>
      <Label htmlFor={id} className="text-xs">
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
      {children}
      {error ? (
        <p className="text-[11px] font-medium text-destructive">{error}</p>
      ) : hint ? (
        <p className="text-[11px] font-medium text-primary/80">{hint}</p>
      ) : null}
    </div>
  );
}
