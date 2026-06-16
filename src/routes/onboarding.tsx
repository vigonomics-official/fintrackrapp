import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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

  const dailyLimit = useMemo(() => {
    const n = Number(s.salary);
    if (!n || n <= 0) return 0;
    return Math.round(n / 30);
  }, [s.salary]);

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

    const { error } = await (supabase as any)
      .from("profiles")
      .update({
        full_name: s.name.trim(),
        name: s.name.trim(),
        city: s.city,
        age_group: s.ageGroup,
        monthly_salary: Number(s.salary) || null,
        salary_date: s.salaryDate ? parseInt(s.salaryDate.replace(/\D/g, ""), 10) || null : null,
        financial_situation: s.situation,
        expense_categories: s.expenses,
        monthly_emi: s.hasEmi ? Number(s.emi) || 0 : 0,
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

    // Persist first goal in the same localStorage shape the app uses
    if (firstGoal) {
      try {
        const raw = localStorage.getItem("fintrackr_goals_v1");
        const arr = raw ? JSON.parse(raw) : [];
        arr.push(firstGoal);
        localStorage.setItem("fintrackr_goals_v1", JSON.stringify(arr));
      } catch {}
    }

    // Seed salary settings so Planner / Home work immediately
    try {
      localStorage.setItem(
        "fintrackr:salary",
        JSON.stringify({
          amount: Number(s.salary) || 0,
          payDate: parseInt(s.salaryDate.replace(/\D/g, ""), 10) || 1,
        }),
      );
    } catch {}

    setTimeout(() => setStep(7), 2500);
  }

  if (step === 6) return <LoadingScreen />;
  if (step === 7) return (
    <ReadyScreen
      name={s.name}
      salary={Number(s.salary) || 0}
      payDate={s.salaryDate}
      dailyLimit={dailyLimit}
      goalTitle={GOALS.find((g) => g.id === s.goal)?.title ?? "—"}
      onOpen={() => navigate({ to: "/dashboard" })}
    />
  );

  // Step 1 = welcome (dark gradient), 2..5 = white form
  if (step === 1) return <WelcomeScreen onStart={() => setStep(2)} />;

  const totalSteps = 5;
  return (
    <div className="min-h-screen w-full bg-white text-gray-900">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col px-5 pt-6 pb-32">
        {/* Top bar */}
        <div className="mb-4 flex items-center gap-3">
          <button
            onClick={() => setStep((x) => Math.max(2, x - 1))}
            className="flex h-9 w-9 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100"
            aria-label="Back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex-1">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
              <motion.div
                className="h-full rounded-full"
                style={{ background: GREEN_ACCENT }}
                initial={false}
                animate={{ width: `${(step - 1) / totalSteps * 100 + 20}%` }}
                transition={{ type: "spring", stiffness: 120, damping: 20 }}
              />
            </div>
            <p className="mt-1 text-[11px] font-semibold tracking-wide text-gray-500">{step - 1} of {totalSteps}</p>
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
            {step === 3 && <SalaryStep s={s} set={set} dailyLimit={dailyLimit} />}
            {step === 4 && <ExpenseStep s={s} set={set} />}
            {step === 5 && <GoalStep s={s} set={set} />}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-gray-100 bg-white/95 px-5 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-4 backdrop-blur">
        <div className="mx-auto max-w-md">
          <Button
            onClick={() => (step < 5 ? setStep(step + 1) : finish())}
            disabled={!canNext || saving}
            className="h-12 w-full rounded-2xl text-base font-semibold shadow-md transition-transform active:scale-[0.98] disabled:opacity-50"
            style={{ background: GREEN_ACCENT, color: "white" }}
          >
            {step === 5 ? "Build My Survival System" : "Next"}
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
          {step === 3 && (
            <p className="mt-3 text-center text-[11px] text-gray-500">🔒 We never connect to your bank</p>
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
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 text-white">₣</div>
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
            Most salary earners don't know where their money goes. You're about to change that.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
            {["✅ No bank login needed", "🔒 100% private", "⚡ Setup in 2 minutes"].map((p) => (
              <span key={p} className="rounded-full bg-white px-3 py-1.5 text-[12px] font-semibold" style={{ color: GREEN_ACCENT }}>
                {p}
              </span>
            ))}
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="mt-6">
          <button
            onClick={onStart}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-white text-[15px] font-bold shadow-lg active:scale-[0.98]"
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
          <label className="text-sm font-semibold text-gray-800">What's your name?</label>
          <Input
            value={s.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="e.g. Vicky"
            className="mt-2 h-12 rounded-xl border-gray-200 text-base"
          />
        </div>

        <div>
          <label className="text-sm font-semibold text-gray-800">Your city</label>
          <ChipGrid options={CITIES} value={s.city} onChange={(v) => set("city", v)} />
        </div>

        <div>
          <label className="text-sm font-semibold text-gray-800">Your age group</label>
          <ChipGrid options={AGE_GROUPS} value={s.ageGroup} onChange={(v) => set("ageGroup", v)} />
        </div>
      </div>
    </div>
  );
}

/* ---------------- STEP 3: SALARY ---------------- */
function SalaryStep({
  s, set, dailyLimit,
}: {
  s: State; set: <K extends keyof State>(k: K, v: State[K]) => void; dailyLimit: number;
}) {
  return (
    <div>
      <p className="text-[11px] font-bold tracking-wider" style={{ color: GREEN_ACCENT }}>
        STEP 3 OF 5 · SALARY SETUP
      </p>
      <h1 className="mt-2 text-[24px] font-bold leading-tight">Tell me about your salary</h1>
      <p className="mt-1 text-sm text-gray-500">This is the foundation of your survival system</p>

      <div className="mt-7 space-y-6">
        <div>
          <label className="text-sm font-semibold text-gray-800">Monthly take-home salary</label>
          <p className="text-xs text-gray-500">After all deductions</p>
          <div className="relative mt-2">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-bold text-gray-700">₹</span>
            <Input
              type="number"
              inputMode="numeric"
              value={s.salary}
              onChange={(e) => set("salary", e.target.value)}
              placeholder="0"
              className="h-14 rounded-xl border-gray-200 pl-10 text-2xl font-bold tabular-nums"
            />
          </div>
          {dailyLimit > 0 && (
            <p className="mt-2 text-xs font-medium" style={{ color: GREEN_ACCENT }}>
              Your daily safe limit will be approximately ₹{fmt(dailyLimit)}/day
            </p>
          )}
        </div>

        <div>
          <label className="text-sm font-semibold text-gray-800">When do you get paid?</label>
          <ChipGrid options={PAY_DATES} value={s.salaryDate} onChange={(v) => set("salaryDate", v)} />
        </div>

        <div>
          <label className="text-sm font-semibold text-gray-800">How would you describe your financial situation?</label>
          <div className="mt-3 space-y-2">
            {SITUATIONS.map((opt) => {
              const active = s.situation === opt.id;
              return (
                <button
                  key={opt.id}
                  onClick={() => set("situation", opt.id)}
                  className={cn(
                    "flex w-full items-start gap-3 rounded-2xl border-2 p-4 text-left transition-all",
                    active ? "bg-emerald-50" : "border-gray-200 bg-white hover:border-gray-300",
                  )}
                  style={active ? { borderColor: GREEN_ACCENT } : undefined}
                >
                  <span className="text-2xl">{opt.emoji}</span>
                  <span className="flex-1">
                    <span className="block text-sm font-semibold text-gray-900">{opt.title}</span>
                    <span className="block text-xs text-gray-500">{opt.sub}</span>
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
      <h1 className="mt-2 text-[24px] font-bold leading-tight">What eats your salary?</h1>
      <p className="mt-1 text-sm text-gray-500">Select all that apply — be honest! 😄</p>

      <div className="mt-5 grid grid-cols-2 gap-3">
        {EXPENSE_CATS.map((c) => {
          const active = s.expenses.includes(c.id);
          return (
            <button
              key={c.id}
              onClick={() => toggle(c.id)}
              className={cn(
                "flex flex-col items-center justify-center gap-2 rounded-xl border-2 p-4 transition-all",
                active ? "text-white" : "border-gray-200 bg-white text-gray-900 hover:border-gray-300",
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
        <label className="text-sm font-semibold text-gray-800">Do you have any EMIs or loans?</label>
        <div className="mt-3 inline-flex rounded-xl bg-gray-100 p-1">
          {[{ k: false, l: "No" }, { k: true, l: "Yes" }].map((o) => {
            const active = s.hasEmi === o.k;
            return (
              <button
                key={o.l}
                onClick={() => set("hasEmi", o.k)}
                className={cn(
                  "rounded-lg px-6 py-2 text-sm font-semibold transition",
                  active ? "text-white shadow" : "text-gray-600",
                )}
                style={active ? { background: GREEN_ACCENT } : undefined}
              >
                {o.l}
              </button>
            );
          })}
        </div>

        {s.hasEmi && (
          <div className="mt-4 space-y-4 rounded-2xl bg-gray-50 p-4">
            <div>
              <label className="text-sm font-semibold text-gray-800">Total monthly EMI amount</label>
              <div className="relative mt-2">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-gray-700">₹</span>
                <Input
                  type="number"
                  inputMode="numeric"
                  value={s.emi}
                  onChange={(e) => set("emi", e.target.value)}
                  placeholder="0"
                  className="h-12 rounded-xl border-gray-200 bg-white pl-9 text-base font-semibold tabular-nums"
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-semibold text-gray-800">How many active loans?</label>
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
      <p className="mt-1 text-sm text-gray-500">Pick one — you can add more later</p>

      <div className="mt-5 grid grid-cols-2 gap-3">
        {GOALS.map((g) => {
          const active = s.goal === g.id;
          return (
            <button
              key={g.id}
              onClick={() => set("goal", g.id)}
              className={cn(
                "relative flex flex-col items-start gap-1 rounded-2xl border-2 p-4 text-left transition-all",
                active ? "bg-emerald-50" : "border-gray-200 bg-white hover:border-gray-300",
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
              <span className="text-[14px] font-bold text-gray-900">{g.title}</span>
              <span className="text-[11px] text-gray-500">{g.sub}</span>
            </button>
          );
        })}
      </div>

      {s.goal && (
        <div className="mt-5 space-y-4 rounded-2xl bg-gray-50 p-4">
          <div>
            <label className="text-sm font-semibold text-gray-800">Target amount</label>
            <div className="relative mt-2">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-gray-700">₹</span>
              <Input
                type="number"
                inputMode="numeric"
                value={s.goalAmount}
                onChange={(e) => set("goalAmount", e.target.value)}
                placeholder="0"
                className="h-12 rounded-xl border-gray-200 bg-white pl-9 text-base font-semibold tabular-nums"
              />
            </div>
          </div>
          <div>
            <label className="text-sm font-semibold text-gray-800">By when?</label>
            <ChipGrid options={HORIZONS} value={s.goalHorizon} onChange={(v) => set("goalHorizon", v)} />
          </div>
          <button
            onClick={() => { set("goalAmount", ""); set("goalHorizon", ""); }}
            className="text-xs font-semibold text-gray-500 underline"
          >
            Skip for now
          </button>
        </div>
      )}
    </div>
  );
}

/* ---------------- COMPLETION: LOADING ---------------- */
function LoadingScreen() {
  return (
    <div
      className="flex min-h-screen w-full flex-col items-center justify-center px-6 text-center text-white"
      style={{ background: `linear-gradient(to bottom, ${GREEN} 0%, ${GREEN_DARK} 100%)` }}
    >
      <div className="flex items-center gap-2">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="h-3 w-3 rounded-full bg-white"
            animate={{ y: [0, -8, 0], opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }}
          />
        ))}
      </div>
      <p className="mt-6 max-w-xs text-[16px] leading-relaxed">
        Building your personalized survival system...
      </p>
    </div>
  );
}

/* ---------------- COMPLETION: READY ---------------- */
function ReadyScreen({
  name, salary, payDate, dailyLimit, goalTitle, onOpen,
}: {
  name: string; salary: number; payDate: string; dailyLimit: number; goalTitle: string; onOpen: () => void;
}) {
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
          className="flex h-20 w-20 items-center justify-center rounded-full bg-white"
        >
          <Check className="h-10 w-10" style={{ color: GREEN_ACCENT }} strokeWidth={3} />
        </motion.div>

        <h1 className="mt-6 text-[26px] font-bold">You're all set, {name || "friend"}! 🎉</h1>

        <div className="mt-6 w-full max-w-sm rounded-2xl border-2 bg-white p-5 text-left text-gray-900" style={{ borderColor: GREEN_ACCENT }}>
          <p className="text-[11px] font-bold tracking-wider" style={{ color: GREEN_ACCENT }}>YOUR SURVIVAL SYSTEM</p>
          <div className="mt-3 space-y-2 text-sm">
            <p>💰 Salary: <span className="font-bold tabular-nums">₹{fmt(salary)}</span></p>
            <p>📅 Payday: <span className="font-bold">{payDate || "—"} monthly</span></p>
            <p>🎯 Daily limit: <span className="font-bold tabular-nums">₹{fmt(dailyLimit)}/day</span></p>
            <p>🛡️ Goal: <span className="font-bold">{goalTitle}</span></p>
            <p>📊 Starting score: <span className="font-bold">70</span></p>
          </div>
        </div>

        <p className="mt-6 max-w-sm text-[14px] leading-relaxed text-white/85">
          The average Indian salary earner saves ₹0 by month end. You're already ahead — you have a plan. 💪
        </p>
      </div>

      <button
        onClick={onOpen}
        className="mt-6 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-white text-[15px] font-bold shadow-lg active:scale-[0.98]"
        style={{ color: GREEN_DARK }}
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
              active ? "text-white" : "border-gray-200 bg-white text-gray-700 hover:border-gray-300",
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
