import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { daysUntilSalary, lastSalaryDate, nextSalaryDate } from "@/lib/salary-cycle";
import { updateFinancialProfile, setRememberedBalance, setRememberedSavings } from "@/lib/financial-profile";
import type { FinancialGoal } from "@/lib/ai-coach-analysis";
import { saveGoal, type Goal } from "@/lib/goals-store";

/** Map onboarding pay-date chip → payDay (1..31, 0 = last day, null = unknown). */
function parsePayDay(label: string): number | null {
  if (!label) return null;
  if (label === "Last day") return 0;
  if (label === "Other") return null;
  const n = parseInt(label.replace(/\D/g, ""), 10);
  return Number.isFinite(n) && n >= 1 && n <= 31 ? n : null;
}

/** Map onboarding goal id → canonical FinancialGoal used by the AI Coach. */
function mapGoalToFinancial(goalId: string): FinancialGoal | undefined {
  switch (goalId) {
    case "emergency": return "Emergency Fund";
    case "travel":    return "Vacation";
    case "home":      return "House";
    case "vehicle":   return "Bike";
    case "gadget":
    case "debt":      return "Custom Goal";
    default:          return undefined;
  }
}

export const Route = createFileRoute("/onboarding")({
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw redirect({ to: "/login" });
    const { data: profile } = await (supabase as any)
      .from("profiles")
      .select("onboarding_completed")
      .eq("id", session.user.id)
      .maybeSingle();
    if (profile?.onboarding_completed) throw redirect({ to: "/dashboard" });
  },
  head: () => ({
    meta: [
      { title: "Set up your salary survival system — FinTrackr" },
      { name: "description", content: "Personalize FinTrackr in 5 quick steps." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: OnboardingPage,
});

const GREEN = "#1a6b4a";
const GREEN_DARK = "#0d3d2a";
const GREEN_ACCENT = "#0d7a5f";

const CITIES = ["Chennai", "Mumbai", "Delhi", "Bangalore", "Hyderabad", "Pune", "Coimbatore", "Other"];
const AGE_GROUPS = ["18–22", "23–28", "29–35", "36–45", "45+"];
const PAY_DATES = ["1st", "5th", "7th", "10th", "15th", "20th", "25th", "Last day", "Other"];
const SITUATIONS = [
  { id: "survive", emoji: "😰", title: "Salary disappears before month end", sub: "I need to survive" },
  { id: "save",    emoji: "😐", title: "Managing but not saving much",      sub: "I need to save" },
  { id: "grow",    emoji: "🙂", title: "Saving a little, want to do better", sub: "I need to grow" },
  { id: "invest",  emoji: "😊", title: "Comfortable, want to build wealth",  sub: "I need to invest" },
];
const EXPENSE_CATS = [
  { id: "rent",     emoji: "🏠", label: "Rent/Housing" },
  { id: "food",     emoji: "🍔", label: "Food & Dining" },
  { id: "fuel",     emoji: "🚗", label: "Fuel/Travel" },
  { id: "emi",      emoji: "💳", label: "EMI/Loans" },
  { id: "bills",    emoji: "📱", label: "Phone/Bills" },
  { id: "family",   emoji: "👨‍👩‍👧", label: "Family Support" },
  { id: "fun",      emoji: "🎮", label: "Entertainment" },
  { id: "health",   emoji: "🏥", label: "Health" },
  { id: "edu",      emoji: "🎓", label: "Education" },
  { id: "shopping", emoji: "👗", label: "Shopping" },
];
const GOALS = [
  { id: "emergency", emoji: "🛡️", title: "Emergency Fund",   sub: "3 months salary saved",     recommended: true },
  { id: "debt",      emoji: "💳", title: "Become Debt-Free", sub: "Close all loans faster" },
  { id: "gadget",    emoji: "📱", title: "New Phone/Gadget", sub: "Upgrade in 3–6 months" },
  { id: "vehicle",   emoji: "🏍️", title: "Bike or Vehicle",  sub: "Your own ride" },
  { id: "travel",    emoji: "✈️", title: "Vacation/Travel",  sub: "Your next adventure" },
  { id: "home",      emoji: "🏠", title: "Home/House Goal",  sub: "Long-term dream" },
];
const HORIZONS = ["3 months", "6 months", "1 year", "2+ years"];

type State = {
  name: string; city: string; ageGroup: string;
  salary: string; salaryDate: string; situation: string;
  expenses: string[]; hasEmi: boolean; emi: string; loans: string;
  goal: string; goalAmount: string; goalHorizon: string;
};

const initial: State = {
  name: "", city: "", ageGroup: "",
  salary: "", salaryDate: "", situation: "",
  expenses: [], hasEmi: false, emi: "", loans: "",
  goal: "", goalAmount: "", goalHorizon: "",
};

function fmt(n: number) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(n);
}

function OnboardingPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1); // 1..5 plus 6=loading, 7=ready
  const [s, setS] = useState<State>(initial);
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof State>(k: K, v: State[K]) => setS((prev) => ({ ...prev, [k]: v }));

  const salaryNum = useMemo(() => {
    const n = Number(s.salary);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }, [s.salary]);

  const payDay = useMemo(() => parsePayDay(s.salaryDate), [s.salaryDate]);

  /** Live salary-cycle preview — recomputes instantly while typing. */
  const cyclePreview = useMemo(() => {
    if (!salaryNum) return null;
    // Fallback to a 30-day cycle when payday is unknown ("Other" / not picked).
    if (payDay == null) {
      const daily = Math.round(salaryNum / 30);
      return { daysUntil: null as number | null, cycleLength: 30, daily };
    }
    const now = new Date();
    const daysUntil = daysUntilSalary(payDay, now);
    const last = lastSalaryDate(payDay, now);
    const next = nextSalaryDate(payDay, new Date(last.getTime() + 86_400_000));
    const cycleLength = Math.max(
      1,
      Math.round((next.getTime() - last.getTime()) / 86_400_000),
    );
    // "Safe daily spend" until next payday — uses real remaining days, not a fixed 30.
    const denom = Math.max(1, daysUntil);
    const daily = Math.round(salaryNum / denom);
    return { daysUntil, cycleLength, daily };
  }, [salaryNum, payDay]);

  const dailyLimit = cyclePreview?.daily ?? 0;

  const canNext = useMemo(() => {
    if (step === 2) return s.name.trim() && s.city && s.ageGroup;
    if (step === 3) return Number(s.salary) > 0 && s.salaryDate && s.situation;
    if (step === 4) return s.expenses.length > 0 && (!s.hasEmi || (s.hasEmi && Number(s.emi) > 0 && s.loans));
    if (step === 5) return !!s.goal;
    return true;
  }, [step, s]);

  async function finish() {
    setSaving(true);
    setStep(6); // loading
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toast.error("Please sign in again");
      navigate({ to: "/login" });
      return;
    }
    const goalDef = GOALS.find((g) => g.id === s.goal);
    const firstGoal = goalDef
      ? {
          id: crypto.randomUUID(),
          name: goalDef.title,
          kind: s.goal === "emergency" ? "emergency" : s.goal === "debt" ? "debt" : s.goal === "travel" ? "travel" : s.goal === "gadget" ? "gadget" : "custom",
          target: Number(s.goalAmount) || 0,
          current: 0,
          monthly: 0,
          deadline: s.goalHorizon || undefined,
          createdAt: new Date().toISOString(),
        }
      : null;

    const salaryAmount = Number(s.salary) || 0;
    const monthlyEmiAmount = s.hasEmi ? Number(s.emi) || 0 : 0;

    const { error } = await (supabase as any)
      .from("profiles")
      .update({
        full_name: s.name.trim(),
        name: s.name.trim(),
        city: s.city,
        age_group: s.ageGroup,
        monthly_salary: salaryAmount || null,
        salary_date: payDay,
        financial_situation: s.situation,
        expense_categories: s.expenses,
        monthly_emi: monthlyEmiAmount,
        active_loans: s.hasEmi ? parseInt(s.loans, 10) || 0 : 0,
        first_goal: firstGoal,
        currency: "INR",
        onboarding_completed: true,
      })
      .eq("id", session.user.id);

    if (error) {
      toast.error("Could not save your setup. Please try again.");
      setSaving(false);
      setStep(5);
      return;
    }

    // Persist first goal to the cloud Goals table (device cache updated by saveGoal)
    if (firstGoal) {
      try {
        await saveGoal(firstGoal as Goal);
      } catch {
        toast.error("Your goal could not be saved. You can add it again from Goals.");
      }
    }

    // ---- FIX 8: Data Synchronization ----
    // 1. Canonical salary settings consumed by Planner / Dashboard / Insights
    //    via the useSalarySettings hook. Uses the same key + event the hook listens to.
    try {
      localStorage.setItem(
        "fintrackr_salary_settings_v1",
        JSON.stringify({
          amount: salaryAmount || null,
          payDay: payDay,
          employmentType: "salaried",
        }),
      );
      window.dispatchEvent(new Event("fintrackr:salary-updated"));
    } catch {}

    // 2. Legacy key kept for back-compat with any older readers.
    try {
      localStorage.setItem(
        "fintrackr:salary",
        JSON.stringify({ amount: salaryAmount, payDate: payDay ?? 1 }),
      );
    } catch {}

    // 3. Financial Profile — powers the AI Coach, Future tab, Weekly / Home insights.
    try {
      updateFinancialProfile({
        monthlySalary: salaryAmount || undefined,
        salaryDate: s.salaryDate || undefined,
        monthlyEmi: monthlyEmiAmount,
        financialGoal: mapGoalToFinancial(s.goal),
        customGoalNote: goalDef?.title,
      });
      // Seed remembered balance/savings so downstream calcs never fall back to demo data.
      setRememberedBalance(salaryAmount);
      setRememberedSavings(0);
    } catch {}

    setTimeout(() => setStep(7), 2500);
  }


  if (step === 6) return (
    <LoadingScreen
      name={s.name}
      salary={Number(s.salary) || 0}
      payDate={s.salaryDate}
      goal={s.goal}
      expenses={s.expenses}
    />
  );
  if (step === 7) return (
    <ReadyScreen
      name={s.name}
      salary={Number(s.salary) || 0}
      payDate={s.salaryDate}
      dailyLimit={dailyLimit}
      goalTitle={GOALS.find((g) => g.id === s.goal)?.title ?? "—"}
      goalId={s.goal}
      situation={s.situation}
      expenses={s.expenses}
      hasEmi={s.hasEmi}
      onOpen={() => navigate({ to: "/dashboard" })}
    />
  );

  // Step 1 = welcome (dark gradient), 2..5 = white form
  if (step === 1) return <WelcomeScreen onStart={() => setStep(2)} />;

  const totalSteps = 5;
  return (
    <div className="min-h-screen w-full bg-card text-foreground">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col px-5 pt-6 pb-32">
        {/* Top bar */}
        <div className="mb-4 flex items-center gap-3">
          <button
            onClick={() => setStep((x) => Math.max(2, x - 1))}
            className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
            aria-label="Back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex-1">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <motion.div
                className="h-full rounded-full"
                style={{ background: GREEN }}
                initial={false}
                animate={{ width: `${(step / totalSteps) * 100}%` }}
                transition={{ type: "spring", stiffness: 120, damping: 20 }}
              />
            </div>
            <p className="mt-1 text-[11px] font-semibold tracking-wide text-muted-foreground">Step {step} of {totalSteps}</p>
          </div>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 18 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -18 }}
            transition={{ duration: 0.22 }}
            className="flex-1"
          >
            {step === 2 && <PersonalStep s={s} set={set} />}
            {step === 3 && <SalaryStep s={s} set={set} preview={cyclePreview} />}
            {step === 4 && <ExpenseStep s={s} set={set} />}
            {step === 5 && <GoalStep s={s} set={set} />}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 px-5 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-4 backdrop-blur">
        <div className="mx-auto max-w-md">
          <Button
            onClick={() => (step < 5 ? setStep(step + 1) : finish())}
            disabled={!canNext || saving}
            className="h-12 w-full text-base shadow-md transition-transform active:scale-[0.98] disabled:opacity-50"
            style={{ background: GREEN, color: "#FFFFFF", fontWeight: 600, borderRadius: 12 }}
          >
            {step === 5 ? "Build My Survival System" : "Next"}
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
          {step === 3 && (
            <p className="mt-3 text-center text-[11px] text-muted-foreground">🔒 We never connect to your bank</p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------- STEP 1: WELCOME ---------------- */
function WelcomeScreen({ onStart }: { onStart: () => void }) {
  return (
    <div
      className="relative min-h-screen w-full overflow-hidden text-white"
      style={{ background: `linear-gradient(to bottom, ${GREEN} 0%, ${GREEN_DARK} 100%)` }}
    >
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col px-6 pt-12 pb-10">
        {/* Logo */}
        <div className="flex flex-col items-center text-center">
          <div className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-card/15 text-white">₣</div>
            FinTrackr
          </div>
          <p className="mt-1 text-xs text-white/70">Your Salary Survival System</p>
        </div>

        {/* Center */}
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <motion.div
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 18 }}
            className="text-7xl"
          >
            👋
          </motion.div>
          <h1 className="mt-6 text-[28px] font-bold leading-tight">Welcome to FinTrackr</h1>
          <p className="mt-4 max-w-xs text-[15px] leading-relaxed text-white/80">
            Most salary earners struggle to make their salary last until payday. FinTrackr helps you survive, save and grow every month.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
            {["✅ No bank login needed", "🔒 100% private", "⚡ Setup in 2 minutes"].map((p) => (
              <span key={p} className="rounded-full bg-card px-3 py-1.5 text-[12px] font-semibold" style={{ color: GREEN_ACCENT }}>
                {p}
              </span>
            ))}
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="mt-6">
          <button
            onClick={onStart}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-card text-[15px] font-bold shadow-lg active:scale-[0.98]"
            style={{ color: GREEN_DARK }}
          >
            Let's Set Up My Survival System
            <ArrowRight className="h-5 w-5" />
          </button>
          <p className="mt-4 text-center text-[12px] text-white/70">
            Already have an account?{" "}
            <a href="/login" className="font-semibold text-white underline">Sign in</a>
          </p>
        </div>
      </div>
    </div>
  );
}

/* ---------------- STEP 2: PERSONAL ---------------- */
function PersonalStep({ s, set }: { s: State; set: <K extends keyof State>(k: K, v: State[K]) => void }) {
  return (
    <div>
      <p className="text-[11px] font-bold tracking-wider" style={{ color: GREEN_ACCENT }}>
        STEP 2 OF 5 · PERSONAL SETUP
      </p>
      <h1 className="mt-2 text-[24px] font-bold leading-tight">Let's personalize your survival system</h1>

      <div className="mt-7 space-y-6">
        <div>
          <label className="text-sm font-semibold text-foreground">What's your name?</label>
          <Input
            value={s.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="e.g. Vicky"
            className="mt-2 h-12 rounded-xl border-border text-base"
          />
        </div>

        <div>
          <label className="text-sm font-semibold text-foreground">Your city</label>
          <ChipGrid options={CITIES} value={s.city} onChange={(v) => set("city", v)} />
        </div>

        <div>
          <label className="text-sm font-semibold text-foreground">Your age group</label>
          <ChipGrid options={AGE_GROUPS} value={s.ageGroup} onChange={(v) => set("ageGroup", v)} />
        </div>
      </div>
    </div>
  );
}

/* ---------------- STEP 3: SALARY ---------------- */
function SalaryStep({
  s, set, preview,
}: {
  s: State;
  set: <K extends keyof State>(k: K, v: State[K]) => void;
  preview: { daysUntil: number | null; cycleLength: number; daily: number } | null;
}) {
  return (
    <div>
      <p className="text-[11px] font-bold tracking-wider" style={{ color: GREEN_ACCENT }}>
        STEP 3 OF 5 · SALARY SETUP
      </p>
      <h1 className="mt-2 text-[24px] font-bold leading-tight">Tell me about your salary</h1>
      <p className="mt-1 text-sm text-muted-foreground">This is the foundation of your survival system</p>

      <div className="mt-7 space-y-6">
        <div>
          <label className="text-sm font-semibold text-foreground">Monthly take-home salary</label>
          <p className="text-xs text-muted-foreground">After all deductions</p>
          <div className="relative mt-2">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-bold text-muted-foreground">₹</span>
            <Input
              type="number"
              inputMode="numeric"
              value={s.salary}
              onChange={(e) => set("salary", e.target.value)}
              placeholder="0"
              className="h-14 rounded-xl border-border pl-10 text-2xl font-bold tabular-nums"
            />
          </div>
          {preview && preview.daily > 0 && (
            <p className="mt-2 text-xs font-medium" style={{ color: GREEN_ACCENT }}>
              Your daily safe limit will be approximately ₹{fmt(preview.daily)}/day
            </p>
          )}
        </div>

        <div>
          <label className="text-sm font-semibold text-foreground">When do you get paid?</label>
          <ChipGrid options={PAY_DATES} value={s.salaryDate} onChange={(v) => set("salaryDate", v)} />
          {preview && preview.daysUntil != null && (
            <div className="mt-3 grid grid-cols-3 gap-2 rounded-2xl bg-emerald-50 p-3">
              <div className="text-center">
                <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Days to payday</p>
                <p className="mt-1 text-base font-bold tabular-nums" style={{ color: GREEN_ACCENT }}>
                  {preview.daysUntil}
                </p>
              </div>
              <div className="text-center">
                <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Safe / day</p>
                <p className="mt-1 text-base font-bold tabular-nums" style={{ color: GREEN_ACCENT }}>
                  ₹{fmt(preview.daily)}
                </p>
              </div>
              <div className="text-center">
                <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Cycle</p>
                <p className="mt-1 text-base font-bold tabular-nums" style={{ color: GREEN_ACCENT }}>
                  {preview.cycleLength}d
                </p>
              </div>
            </div>
          )}
        </div>


        <div>
          <label className="text-sm font-semibold text-foreground">How would you describe your financial situation?</label>
          <div className="mt-3 space-y-2">
            {SITUATIONS.map((opt) => {
              const active = s.situation === opt.id;
              return (
                <button
                  key={opt.id}
                  onClick={() => set("situation", opt.id)}
                  className={cn(
                    "flex w-full items-start gap-3 rounded-2xl border-2 p-4 text-left transition-all",
                    active ? "bg-emerald-50" : "border-border bg-card hover:border-border",
                  )}
                  style={active ? { borderColor: GREEN_ACCENT } : undefined}
                >
                  <span className="text-2xl">{opt.emoji}</span>
                  <span className="flex-1">
                    <span className="block text-sm font-semibold text-foreground">{opt.title}</span>
                    <span className="block text-xs text-muted-foreground">{opt.sub}</span>
                  </span>
                  {active && <Check className="mt-1 h-5 w-5" style={{ color: GREEN_ACCENT }} />}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- STEP 4: EXPENSES ---------------- */
function ExpenseStep({ s, set }: { s: State; set: <K extends keyof State>(k: K, v: State[K]) => void }) {
  function toggle(id: string) {
    set("expenses", s.expenses.includes(id) ? s.expenses.filter((x) => x !== id) : [...s.expenses, id]);
  }
  return (
    <div>
      <p className="text-[11px] font-bold tracking-wider" style={{ color: GREEN_ACCENT }}>
        STEP 4 OF 5 · YOUR EXPENSES
      </p>
      <h1 className="mt-2 text-[24px] font-bold leading-tight">Where does your salary usually go?</h1>
      <p className="mt-1 text-sm text-muted-foreground">Select all that apply — be honest! 😄</p>

      <div className="mt-5 grid grid-cols-2 gap-3">
        {EXPENSE_CATS.map((c) => {
          const active = s.expenses.includes(c.id);
          return (
            <button
              key={c.id}
              onClick={() => toggle(c.id)}
              className={cn(
                "flex flex-col items-center justify-center gap-2 rounded-xl border-2 p-4 transition-all",
                active ? "text-white" : "border-border bg-card text-foreground hover:border-border",
              )}
              style={active ? { background: GREEN_ACCENT, borderColor: GREEN_ACCENT } : undefined}
            >
              <span className="text-3xl">{c.emoji}</span>
              <span className="text-[13px] font-semibold">{c.label}</span>
            </button>
          );
        })}
      </div>

      {s.expenses.length > 0 && (
        <p className="mt-4 text-sm font-medium" style={{ color: GREEN_ACCENT }}>
          Great! You selected {s.expenses.length} expense {s.expenses.length === 1 ? "category" : "categories"}. We'll track all of these.
        </p>
      )}

      <div className="mt-7">
        <label className="text-sm font-semibold text-foreground">Do you have any EMIs or loans?</label>
        <div className="mt-3 inline-flex rounded-xl bg-muted p-1">
          {[{ k: false, l: "No" }, { k: true, l: "Yes" }].map((o) => {
            const active = s.hasEmi === o.k;
            return (
              <button
                key={o.l}
                onClick={() => set("hasEmi", o.k)}
                className={cn(
                  "rounded-lg px-6 py-2 text-sm font-semibold transition",
                  active ? "text-white shadow" : "text-muted-foreground",
                )}
                style={active ? { background: GREEN_ACCENT } : undefined}
              >
                {o.l}
              </button>
            );
          })}
        </div>

        {s.hasEmi && (
          <div className="mt-4 space-y-4 rounded-2xl bg-muted p-4">
            <div>
              <label className="text-sm font-semibold text-foreground">Total monthly EMI amount</label>
              <div className="relative mt-2">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-muted-foreground">₹</span>
                <Input
                  type="number"
                  inputMode="numeric"
                  value={s.emi}
                  onChange={(e) => set("emi", e.target.value)}
                  placeholder="0"
                  className="h-12 rounded-xl border-border bg-card pl-9 text-base font-semibold tabular-nums"
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-semibold text-foreground">How many active loans?</label>
              <ChipGrid options={["1", "2", "3", "4+"]} value={s.loans} onChange={(v) => set("loans", v)} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------- STEP 5: GOAL ---------------- */
function GoalStep({ s, set }: { s: State; set: <K extends keyof State>(k: K, v: State[K]) => void }) {
  return (
    <div>
      <p className="text-[11px] font-bold tracking-wider" style={{ color: GREEN_ACCENT }}>
        STEP 5 OF 5 · YOUR FIRST GOAL
      </p>
      <h1 className="mt-2 text-[24px] font-bold leading-tight">What's your #1 financial goal right now?</h1>
      <p className="mt-1 text-sm text-muted-foreground">Pick one — you can add more later</p>

      <div className="mt-5 grid grid-cols-2 gap-3">
        {GOALS.map((g) => {
          const active = s.goal === g.id;
          return (
            <button
              key={g.id}
              onClick={() => set("goal", g.id)}
              className={cn(
                "relative flex flex-col items-start gap-1 rounded-2xl border-2 p-4 text-left transition-all",
                active ? "bg-emerald-50" : "border-border bg-card hover:border-border",
              )}
              style={active ? { borderColor: GREEN_ACCENT } : undefined}
            >
              {g.recommended && (
                <span className="absolute right-2 top-2 rounded-full px-2 py-0.5 text-[9px] font-bold text-white"
                  style={{ background: GREEN_ACCENT }}>
                  RECOMMENDED
                </span>
              )}
              <span className="text-3xl">{g.emoji}</span>
              <span className="text-[14px] font-bold text-foreground">{g.title}</span>
              <span className="text-[11px] text-muted-foreground">{g.sub}</span>
          </button>
        );
      })}
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        You can add more goals anytime after setup.
      </p>

      {s.goal && (
        <div className="mt-5 space-y-4 rounded-2xl bg-muted p-4">
          <div>
            <label className="text-sm font-semibold text-foreground">Target amount</label>
            <div className="relative mt-2">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-muted-foreground">₹</span>
              <Input
                type="number"
                inputMode="numeric"
                value={s.goalAmount}
                onChange={(e) => set("goalAmount", e.target.value)}
                placeholder="0"
                className="h-12 rounded-xl border-border bg-card pl-9 text-base font-semibold tabular-nums"
              />
            </div>
          </div>
          <div>
            <label className="text-sm font-semibold text-foreground">By when?</label>
            <ChipGrid options={HORIZONS} value={s.goalHorizon} onChange={(v) => set("goalHorizon", v)} />
          </div>
          <button
            onClick={() => { set("goalAmount", ""); set("goalHorizon", ""); }}
            className="text-xs font-semibold text-muted-foreground underline"
          >
            Skip for now
          </button>
        </div>
      )}
    </div>
  );
}

/* ---------------- COMPLETION: LOADING ---------------- */
function LoadingScreen({
  name, salary, payDate, goal, expenses,
}: {
  name: string; salary: number; payDate: string; goal: string; expenses: string[];
}) {
  const firstName = (name || "").trim().split(" ")[0];
  const messages = useMemo(() => {
    const list: string[] = [];
    list.push(salary > 0
      ? `Calculating Safe Daily Spend from ₹${salary.toLocaleString("en-IN")}...`
      : "Calculating your Safe Daily Spend...");
    list.push(payDate
      ? `Understanding your ${payDate} salary cycle...`
      : "Understanding your salary cycle...");
    if (expenses && expenses.length > 0) {
      list.push(`Mapping ${expenses.length} spending ${expenses.length === 1 ? "category" : "categories"}...`);
    }
    list.push("Preparing your AI Salary Coach...");
    list.push(goal
      ? `Aligning plan with your ${goal.toLowerCase()} goal...`
      : "Building your Survival Score...");
    list.push(firstName
      ? `Finalizing ${firstName}'s dashboard...`
      : "Finalizing your dashboard...");
    return list;
  }, [salary, payDate, goal, expenses, firstName]);

  const [idx, setIdx] = useState(0);
  useEffect(() => {
    if (messages.length <= 1) return;
    const id = setInterval(() => {
      setIdx((i) => (i + 1 < messages.length ? i + 1 : i));
    }, 1000);
    return () => clearInterval(id);
  }, [messages.length]);

  return (
    <div
      className="flex min-h-screen w-full flex-col items-center justify-center px-6 text-center text-white"
      style={{ background: `linear-gradient(to bottom, ${GREEN} 0%, ${GREEN_DARK} 100%)` }}
    >
      <div className="flex items-center gap-2">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="h-3 w-3 rounded-full bg-card"
            animate={{ y: [0, -8, 0], opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }}
          />
        ))}
      </div>
      <div className="mt-6 h-12 max-w-xs">
        <AnimatePresence mode="wait">
          <motion.p
            key={idx}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.25 }}
            className="text-[15px] leading-relaxed"
          >
            ✓ {messages[idx]}
          </motion.p>
        </AnimatePresence>
      </div>
    </div>
  );
}

/* ---------------- COMPLETION: READY ---------------- */
function computeSurvivalScore(s: {
  salary: number; payDate: string; situation: string; expenses: string[]; hasEmi: boolean; goal: string;
}): number {
  let score = 45;
  if (s.salary > 0) score += 15;
  if (s.payDate) score += 10;
  if (s.situation) score += 10;
  if (s.expenses.length > 0) score += 10;
  if (s.hasEmi !== undefined) score += 5;
  if (s.goal) score += 15;
  return Math.min(100, Math.max(0, score));
}

function scoreExplanation(score: number, situation: string): string {
  if (score >= 90) return "Excellent start. You have salary clarity, a goal and a payday plan — the core building blocks of salary survival.";
  if (score >= 75) return "Strong foundation. Knowing your salary, payday and expenses puts you ahead of most month-end strugglers.";
  if (situation === "survive") return "Your score reflects honest awareness. Now FinTrackr can help you stretch your salary until payday.";
  if (situation === "invest") return "You're already thinking ahead. FinTrackr will help you turn that intent into disciplined monthly growth.";
  return "You're building awareness — the first step to surviving the month and growing your money.";
}

function ReadyScreen({
  name, salary, payDate, dailyLimit, goalTitle, goalId, situation, expenses, hasEmi, onOpen,
}: {
  name: string; salary: number; payDate: string; dailyLimit: number; goalTitle: string; goalId: string;
  situation: string; expenses: string[]; hasEmi: boolean; onOpen: () => void;
}) {
  const score = computeSurvivalScore({ salary, payDate, situation, expenses, hasEmi, goal: goalId });
  return (
    <div
      className="flex min-h-screen w-full flex-col px-6 py-10 text-white"
      style={{ background: `linear-gradient(to bottom, ${GREEN} 0%, ${GREEN_DARK} 100%)` }}
    >
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 220, damping: 14 }}
          className="flex h-20 w-20 items-center justify-center rounded-full bg-card"
        >
          <Check className="h-10 w-10" style={{ color: GREEN_ACCENT }} strokeWidth={3} />
        </motion.div>

        <h1 className="mt-6 text-[26px] font-bold">You're all set, {name || "friend"}! 🎉</h1>

        <div className="mt-6 w-full max-w-sm rounded-2xl border-2 bg-card p-5 text-left text-foreground" style={{ borderColor: GREEN_ACCENT }}>
          <p className="text-[11px] font-bold tracking-wider" style={{ color: GREEN_ACCENT }}>YOUR SURVIVAL SYSTEM</p>
          <div className="mt-3 space-y-2 text-sm">
            <p>💰 Salary: <span className="font-bold tabular-nums">₹{fmt(salary)}</span></p>
            <p>📅 Payday: <span className="font-bold">{payDate || "—"} monthly</span></p>
            <p>🎯 Daily limit: <span className="font-bold tabular-nums">₹{fmt(dailyLimit)}/day</span></p>
            <p>🛡️ Goal: <span className="font-bold">{goalTitle}</span></p>
            <p>📊 Survival Score: <span className="font-bold">{score}/100</span></p>
          </div>

          <div className="mt-4 rounded-xl bg-emerald-50 p-3">
            <p className="text-[11px] font-bold" style={{ color: GREEN_ACCENT }}>BASED ON</p>
            <ul className="mt-1 space-y-1 text-xs text-muted-foreground">
              <li>• Salary</li>
              <li>• Spending Profile</li>
              <li>• Goals</li>
              <li>• Payday</li>
            </ul>
          </div>

          <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50/50 p-3">
            <p className="text-[11px] font-bold" style={{ color: GREEN_ACCENT }}>AI INSIGHT</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{scoreExplanation(score, situation)}</p>
          </div>
        </div>

        <p className="mt-6 max-w-sm text-[14px] leading-relaxed text-white/85">
          The average Indian salary earner saves ₹0 by month end. You're already ahead — you have a plan. 💪
        </p>
      </div>

      <button
        onClick={onOpen}
        className="mt-6 flex h-14 w-full items-center justify-center gap-2 text-[15px] shadow-lg active:scale-[0.98]"
        style={{ background: GREEN, color: "#FFFFFF", fontWeight: 600, borderRadius: 12 }}
      >
        Open My Dashboard
        <ArrowRight className="h-5 w-5" />
      </button>
    </div>
  );
}

/* ---------------- helpers ---------------- */
function ChipGrid({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {options.map((opt) => {
        const active = value === opt;
        return (
          <button
            key={opt}
            onClick={() => onChange(opt)}
            className={cn(
              "rounded-full border-2 px-4 py-2 text-sm font-semibold transition-all",
              active ? "text-white" : "border-border bg-card text-muted-foreground hover:border-border",
            )}
            style={active ? { background: GREEN_ACCENT, borderColor: GREEN_ACCENT } : undefined}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}
