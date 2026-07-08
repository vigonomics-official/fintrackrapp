import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, CheckCircle2, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { FINANCIAL_GOALS, type FinancialGoal, type CoachAnalysisInput } from "@/lib/ai-coach-analysis";
import { DataConfidenceCard } from "@/components/finance/DataConfidenceCard";
import { computeConfidence, COACH_CONFIDENCE_MISSING_KEY } from "@/lib/coach-confidence";
import { CoachSourceBadge } from "@/components/finance/CoachSourceBadge";
import { CoachLastUpdatedCard } from "@/components/finance/CoachLastUpdatedCard";
import { CoachSmartWarnings, computeCoachWarnings } from "@/components/finance/CoachSmartWarnings";
import { CoachPrivacyNote } from "@/components/finance/CoachPrivacyNote";
import type { CoachDataSource, AutofillKey } from "@/lib/coach-autofill";

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
  /** Per-field data source. Defaults to "auto" for keys in `autoFilled`. */
  sources?: Partial<Record<AutofillKey, CoachDataSource>>;
  /** Transactions used to compute the autofill (for status text). */
  transactionCount?: number;
  /** When the autofill was computed. */
  computedAt?: string | null;
  /**
   * When true, the form starts in a read-only "Data Ready" summary — the user
   * must explicitly press Review Data before fields become editable. This
   * reduces accidental edits after auto-fill.
   */
  startLocked?: boolean;
};

export function AnalyzeForm({
  initial,
  autoFilled,
  sources,
  transactionCount = 0,
  computedAt,
  startLocked = false,
}: AnalyzeFormProps = {}) {
  const navigate = useNavigate();
  const [form, setForm] = useState<FormState>(() => {
    if (!initial) return INITIAL;
    const seed: FormState = { ...INITIAL };
    for (const f of NUMERIC_FIELDS) {
      const v = (initial as Record<string, unknown>)[f.key];
      if (typeof v === "number" && Number.isFinite(v) && v >= 0) seed[f.key] = String(v);
    }
    if (initial.salaryDate) seed.salaryDate = initial.salaryDate;
    if (initial.financialGoal) seed.financialGoal = initial.financialGoal;
    if (initial.customGoalNote) seed.customGoalNote = initial.customGoalNote;
    return seed;
  });
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [highlightMissing, setHighlightMissing] = useState<ReadonlySet<string>>(() => new Set());
  // Track which auto-filled fields the user has manually overridden.
  const [edited, setEdited] = useState<ReadonlySet<string>>(() => new Set());
  const [locked, setLocked] = useState(startLocked);

  const isAuto = (k: string) => !!autoFilled?.has(k);
  const sourceFor = (k: string): CoachDataSource => {
    if (edited.has(k)) return "manual";
    const provided = sources?.[k as AutofillKey];
    if (provided) return provided;
    if (isAuto(k)) return "auto";
    return "manual";
  };

  // If the user came from "Improve My Data" on the results page, we're handed
  // the list of fields that dragged the confidence score down.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(COACH_CONFIDENCE_MISSING_KEY);
      if (!raw) return;
      sessionStorage.removeItem(COACH_CONFIDENCE_MISSING_KEY);
      const keys = JSON.parse(raw);
      if (Array.isArray(keys) && keys.length > 0) {
        setHighlightMissing(new Set(keys.map(String)));
        // Coming from "improve" means the user WANTS to edit — unlock.
        setLocked(false);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => (e[key] ? { ...e, [key]: undefined } : e));
    if (isAuto(key as string)) {
      setEdited((prev) => {
        if (prev.has(key as string)) return prev;
        const next = new Set(prev);
        next.add(key as string);
        return next;
      });
    }
    if (highlightMissing.has(key as string)) {
      setHighlightMissing((prev) => {
        const next = new Set(prev);
        next.delete(key as string);
        return next;
      });
    }
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

  const buildInput = (): CoachAnalysisInput => {
    const num = (v: string) => (v === "" ? 0 : Number(v));
    return {
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
      financialGoal: (form.financialGoal || "Emergency Fund") as FinancialGoal,
      customGoalNote: form.customGoalNote || undefined,
    };
  };

  const analyzeAndGo = () => {
    if (!validate()) return;
    try {
      sessionStorage.setItem(COACH_INPUT_STORAGE_KEY, JSON.stringify(buildInput()));
    } catch {
      /* ignore */
    }
    navigate({ to: "/insights/ai-coach/results" });
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    analyzeAndGo();
  };

  // Live confidence + warnings for the current form state.
  const liveInput = useMemo<Partial<CoachAnalysisInput>>(() => {
    const num = (v: string) => {
      if (v === "") return undefined;
      const n = Number(v);
      return Number.isFinite(n) ? n : undefined;
    };
    return {
      monthlySalary: num(form.monthlySalary),
      salaryDate: form.salaryDate || undefined,
      currentAccountBalance: num(form.currentAccountBalance),
      monthlyRent: num(form.monthlyRent),
      monthlyFood: num(form.monthlyFood),
      monthlyTransport: num(form.monthlyTransport),
      monthlyEmi: num(form.monthlyEmi),
      monthlyBills: num(form.monthlyBills),
      monthlyInvestments: num(form.monthlyInvestments),
      currentSavings: num(form.currentSavings),
      otherMonthlyExpenses: num(form.otherMonthlyExpenses),
      financialGoal: (form.financialGoal || undefined) as FinancialGoal | undefined,
    };
  }, [form]);

  const liveConfidence = useMemo(() => computeConfidence(liveInput), [liveInput]);
  const warnings = useMemo(() => computeCoachWarnings(liveInput), [liveInput]);
  const missingHint = (k: string) =>
    highlightMissing.has(k) ? "Fill this to improve AI accuracy" : undefined;

  const anyAutoEdited = edited.size > 0;
  const buttonSubtitle =
    autoFilled && autoFilled.size > 0
      ? anyAutoEdited
        ? "Using mixed data (Auto + Manual)"
        : `Using ${transactionCount} verified transaction${transactionCount === 1 ? "" : "s"}`
      : undefined;

  // "Data Ready" locked state — shown right after auto-fill, before edits.
  if (locked) {
    return (
      <div className="space-y-3">
        <DataConfidenceCard confidence={liveConfidence} />
        <Card className="p-4 shadow-soft sm:p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-success/10 text-success">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-display text-sm font-semibold">✓ Data Ready</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Your financial information has been prepared.
                {transactionCount > 0 && (
                  <> Using {transactionCount} verified transaction{transactionCount === 1 ? "" : "s"} from this month.</>
                )}
              </p>
            </div>
          </div>
        </Card>
        <CoachLastUpdatedCard computedAt={computedAt ?? null} transactionCount={transactionCount} />
        <CoachSmartWarnings warnings={warnings} />
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            variant="outline"
            className="w-full sm:flex-1"
            onClick={() => setLocked(false)}
          >
            <Pencil className="mr-2 h-4 w-4" />
            Review Data
          </Button>
          <Button type="button" className="w-full sm:flex-1" onClick={analyzeAndGo}>
            <Sparkles className="mr-2 h-4 w-4" />
            Analyze Salary
          </Button>
        </div>
        {buttonSubtitle && (
          <p className="text-center text-[11px] text-muted-foreground">{buttonSubtitle}</p>
        )}
        <CoachPrivacyNote />
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-3">
      <DataConfidenceCard confidence={liveConfidence} />
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
              error={errors[f.key] ?? missingHint(f.key)}
              source={sourceFor(f.key)}
            >
              <Input
                id={f.key}
                type="number"
                inputMode="decimal"
                min={0}
                placeholder={f.placeholder ?? "0"}
                value={form[f.key]}
                onChange={(e) => setField(f.key, e.target.value)}
                aria-invalid={!!errors[f.key] || highlightMissing.has(f.key)}
              />
            </FieldWrap>
          ))}

          <FieldWrap
            id="salaryDate"
            label="Salary Date"
            required
            error={errors.salaryDate ?? missingHint("salaryDate")}
            source={sourceFor("salaryDate")}
          >
            <Input
              id="salaryDate"
              type="date"
              value={form.salaryDate}
              onChange={(e) => setField("salaryDate", e.target.value)}
              aria-invalid={!!errors.salaryDate || highlightMissing.has("salaryDate")}
            />
          </FieldWrap>

          <FieldWrap
            id="financialGoal"
            label="Financial Goal"
            required
            error={errors.financialGoal ?? missingHint("financialGoal")}
          >
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
      </Card>

      <CoachLastUpdatedCard computedAt={computedAt ?? null} transactionCount={transactionCount} />
      <CoachSmartWarnings warnings={warnings} />

      <div>
        <Button type="submit" className="w-full" size="lg">
          <Sparkles className="mr-2 h-4 w-4" />
          Analyze Salary
        </Button>
        {buttonSubtitle && (
          <p className="mt-1.5 text-center text-[11px] text-muted-foreground">{buttonSubtitle}</p>
        )}
      </div>

      <CoachPrivacyNote />
    </form>
  );
}

function FieldWrap({
  id,
  label,
  required,
  error,
  source,
  className,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  error?: string;
  source?: CoachDataSource;
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
      ) : source ? (
        <CoachSourceBadge source={source} />
      ) : null}
    </div>
  );
}
