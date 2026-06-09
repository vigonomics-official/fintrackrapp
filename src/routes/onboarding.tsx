import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldCheck, Wallet, Sparkles, ArrowRight, Check,
  PiggyBank, TrendingDown, Eye, CreditCard,
  PieChart, IndianRupee, Lock, Globe, Clock, Plus, BarChart3, Calendar,
  MessageSquareText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/onboarding")({
  head: () => ({
    meta: [
      { title: "Get started — FinTrackr" },
      { name: "description", content: "Set up your FinTrackr account in under 60 seconds." },
      { property: "og:title", content: "Get started — FinTrackr" },
      { property: "og:description", content: "Set up your FinTrackr account in under 60 seconds." },
      { property: "og:url", content: "/onboarding" },
    ],
    links: [{ rel: "canonical", href: "/onboarding" }],
  }),
  component: OnboardingPage,
});

const BRAND = {
  primary: "#1A56DB",
  accent: "#10B981",
  bg: "#F9FAFB",
  text: "#111827",
};

const PAY_DATES = [1, 5, 10, 15, 25, 30];

type Goal = "save" | "stop" | "understand" | "debt";

const GOALS: { id: Goal; label: string; sub: string; icon: typeof PiggyBank; tint: string }[] = [
  { id: "save",       label: "Save more every month",       sub: "Build a healthy savings habit",          icon: PiggyBank,    tint: "#10B981" },
  { id: "stop",       label: "Stop overspending",           sub: "Catch leaks before they grow",           icon: TrendingDown, tint: "#F59E0B" },
  { id: "understand", label: "Understand where money goes", sub: "Clear, simple spend breakdown",          icon: Eye,          tint: "#1A56DB" },
  { id: "debt",       label: "Pay off EMI / debt faster",   sub: "Plan and track repayments",              icon: CreditCard,   tint: "#8B5CF6" },
];

function OnboardingPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [salary, setSalary] = useState("");
  const [payDate, setPayDate] = useState<number | null>(null);
  const [goal, setGoal] = useState<Goal | null>(null);

  const totalSteps = 4;
  const progress = ((step + 1) / totalSteps) * 100;

  const canContinue =
    (step === 0) ||
    (step === 1 && salary.trim().length > 0 && payDate !== null) ||
    (step === 2 && goal !== null) ||
    (step === 3);

  function next() {
    if (step < totalSteps - 1) setStep(step + 1);
    else finish();
  }

  function finish() {
    try {
      localStorage.setItem(
        "fintrackr:onboarding",
        JSON.stringify({ salary, payDate, goal, completedAt: Date.now() }),
      );
    } catch {}
    navigate({ to: "/dashboard" });
  }

  const ctaLabel =
    step === 0 ? "Get Started" :
    step === 1 ? "Next" :
    step === 2 ? "Take me to my dashboard" :
    "Add First Expense";

  return (
    <div className="min-h-screen w-full" style={{ background: BRAND.bg, color: BRAND.text }}>
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col px-5 pt-6 pb-32">
        <header className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-xl text-white text-sm font-bold"
              style={{ background: BRAND.primary }}
            >
              ₣
            </div>
            <span className="font-semibold tracking-tight">FinTrackr</span>
          </div>
          <button
            onClick={finish}
            className="text-sm font-medium text-gray-500 hover:text-gray-800"
          >
            Skip
          </button>
        </header>

        <div className="mb-8">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
            <motion.div
              className="h-full rounded-full"
              style={{ background: BRAND.accent }}
              initial={false}
              animate={{ width: `${progress}%` }}
              transition={{ type: "spring", stiffness: 120, damping: 20 }}
            />
          </div>
          <p className="mt-2 text-xs font-medium text-gray-500">
            Step {step + 1} of {totalSteps}
          </p>
        </div>

        <div className="flex-1">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              className="h-full"
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
            >
              {step === 0 && <WelcomeStep />}
              {step === 1 && (
                <SalaryStep
                  salary={salary}
                  setSalary={setSalary}
                  payDate={payDate}
                  setPayDate={setPayDate}
                />
              )}
              {step === 2 && <GoalStep goal={goal} setGoal={setGoal} />}
              {step === 3 && <FirstDashboardStep />}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-gray-100 bg-white/90 px-5 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-4 backdrop-blur">
        <div className="mx-auto max-w-md">
          <Button
            onClick={next}
            disabled={!canContinue}
            className="h-12 w-full rounded-2xl text-base font-semibold shadow-lg transition-transform active:scale-[0.98] disabled:opacity-50"
            style={{ background: BRAND.accent, color: "white" }}
          >
            {ctaLabel}
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
          <p className="mt-3 text-center text-[11px] text-gray-500">
            Takes under 60 seconds · No card required
          </p>
        </div>
      </div>
    </div>
  );
}

function WelcomeStep() {
  return (
    <div className="relative flex h-full flex-col items-center justify-center text-center">
      <div className="pointer-events-none absolute inset-0 -mx-5 -mt-6 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-blue-50/80 via-white/40 to-transparent" />
        <div
          className="absolute -top-16 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full opacity-60 blur-3xl"
          style={{ background: "radial-gradient(circle, #BFDBFE 0%, #DBEAFE 50%, transparent 100%)" }}
        />
      </div>

      <motion.div
        className="pointer-events-none absolute top-6 right-2 z-0 rounded-2xl bg-white/95 p-3 shadow-elegant backdrop-blur-sm"
        animate={{ y: [0, -6, 0] }}
        transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
      >
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-500">
            <IndianRupee className="h-4 w-4" />
          </div>
          <div className="text-left">
            <p className="text-xs font-bold text-gray-900">₹2,340 saved</p>
            <p className="text-[10px] text-gray-500">this month</p>
          </div>
        </div>
      </motion.div>

      <motion.div
        className="pointer-events-none absolute top-24 left-2 z-0 rounded-2xl bg-white/95 p-3 shadow-elegant backdrop-blur-sm"
        animate={{ y: [0, 7, 0] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 0.6 }}
      >
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-orange-50 text-orange-500">
            <PieChart className="h-4 w-4" />
          </div>
          <div className="text-left">
            <p className="text-xs font-bold text-gray-900">Food ↓ 18%</p>
            <p className="text-[10px] text-gray-500">vs last month</p>
          </div>
        </div>
      </motion.div>

      <motion.div
        className="pointer-events-none absolute bottom-36 right-2 z-0 rounded-2xl bg-white/95 p-3 shadow-elegant backdrop-blur-sm"
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut", delay: 1.2 }}
      >
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 text-blue-500">
            <Clock className="h-4 w-4" />
          </div>
          <div className="text-left">
            <p className="text-xs font-bold text-gray-900">Salary in 5 days</p>
            <p className="text-[10px] text-gray-500">₹45,000 incoming</p>
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: "easeOut" }}
        className="relative z-10 flex flex-col items-center"
      >
        <div
          className="mb-8 flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-[1.5rem] text-white"
          style={{
            background: "linear-gradient(135deg, #1A56DB 0%, #3B82F6 100%)",
            boxShadow: "0 12px 40px -8px rgba(26, 86, 219, 0.35)",
          }}
        >
          <Wallet className="h-9 w-9" />
        </div>

        <h1 className="max-w-[17rem] text-[1.75rem] font-bold leading-[1.15] tracking-tight text-gray-900">
          Finally understand where your money goes.
        </h1>

        <p className="mt-4 max-w-[18rem] text-[0.95rem] leading-relaxed text-gray-500">
          FinTrackr helps Indian salary earners track spending, reduce stress, and save more.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.25 }}
        className="relative z-10 mt-10 flex flex-wrap items-center justify-center gap-x-3 gap-y-2"
      >
        <div className="flex items-center gap-1.5 rounded-full bg-white/80 px-3 py-1.5 text-xs font-semibold text-gray-600 shadow-soft">
          <Lock className="h-3.5 w-3.5 text-emerald-500" />
          No bank login needed
        </div>
        <div className="flex items-center gap-1.5 rounded-full bg-white/80 px-3 py-1.5 text-xs font-semibold text-gray-600 shadow-soft">
          <Globe className="h-3.5 w-3.5 text-blue-500" />
          Built for India
        </div>
        <div className="flex items-center gap-1.5 rounded-full bg-white/80 px-3 py-1.5 text-xs font-semibold text-gray-600 shadow-soft">
          <Clock className="h-3.5 w-3.5 text-amber-500" />
          Setup takes less than 60 seconds
        </div>
      </motion.div>
    </div>
  );
}

function SalaryStep({
  salary, setSalary, payDate, setPayDate,
}: {
  salary: string; setSalary: (v: string) => void;
  payDate: number | null; setPayDate: (d: number) => void;
}) {
  return (
    <div className="pt-2">
      <h1 className="font-display text-2xl font-bold tracking-tight">
        Let's set up your salary profile
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-gray-600">
        Two quick details power your countdown, budgets, and insights.
      </p>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="mt-7 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm"
      >
        <Label className="text-sm font-medium text-gray-700">Monthly salary</Label>
        <div className="relative mt-2">
          <IndianRupee className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            inputMode="numeric"
            placeholder="25,000"
            value={salary}
            onChange={(e) => setSalary(e.target.value.replace(/[^\d]/g, ""))}
            className="h-12 rounded-xl border-gray-200 bg-gray-50 pl-9 text-base font-medium"
            autoFocus
          />
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.08 }}
        className="mt-4 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm"
      >
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-gray-500" />
          <Label className="text-sm font-medium text-gray-700">
            When do you usually get paid?
          </Label>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          {PAY_DATES.map((d) => {
            const active = payDate === d;
            return (
              <button
                key={d}
                onClick={() => setPayDate(d)}
                className={cn(
                  "relative h-12 rounded-xl border text-sm font-semibold transition-all active:scale-[0.97]",
                  active
                    ? "border-transparent text-white shadow-md"
                    : "border-gray-200 bg-gray-50 text-gray-700 hover:border-gray-300",
                )}
                style={active ? { background: BRAND.primary } : undefined}
              >
                {d}
                <span className={cn("ml-0.5 text-[10px] font-normal", active ? "opacity-80" : "text-gray-400")}>
                  {ordinal(d)}
                </span>
              </button>
            );
          })}
        </div>

        <p className="mt-3 text-xs text-gray-500">
          Used only for salary countdown and budget insights.
        </p>
      </motion.div>
    </div>
  );
}

function ordinal(n: number) {
  if (n === 1) return "st";
  if (n === 5 || n === 25) return "th";
  if (n === 10 || n === 15 || n === 30) return "th";
  return "th";
}

function GoalStep({
  goal, setGoal,
}: { goal: Goal | null; setGoal: (g: Goal) => void }) {
  return (
    <div className="pt-2">
      <h1 className="font-display text-2xl font-bold tracking-tight">
        What would you like help with first?
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-gray-600">
        Pick one — you can change this anytime.
      </p>

      <div className="mt-6 space-y-3">
        {GOALS.map((g, i) => {
          const active = goal === g.id;
          const Icon = g.icon;
          return (
            <motion.button
              key={g.id}
              onClick={() => setGoal(g.id)}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: i * 0.05 }}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.98 }}
              className={cn(
                "relative flex w-full items-center gap-4 rounded-2xl border bg-white p-4 text-left shadow-sm transition-all",
                active ? "border-transparent shadow-md" : "border-gray-100 hover:border-gray-200",
              )}
              style={active ? { boxShadow: `0 0 0 2px ${BRAND.primary}, 0 8px 24px -10px ${BRAND.primary}55` } : undefined}
            >
              <span
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                style={{
                  background: active ? g.tint : `${g.tint}1a`,
                  color: active ? "white" : g.tint,
                }}
              >
                <Icon className="h-5 w-5" />
              </span>
              <div className="flex-1">
                <p className="text-sm font-semibold text-gray-900">{g.label}</p>
                <p className="mt-0.5 text-xs text-gray-500">{g.sub}</p>
              </div>
              {active && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
                  style={{ background: BRAND.accent }}
                >
                  <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />
                </motion.span>
              )}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

function FirstDashboardStep() {
  return (
    <div className="pt-2">
      {/* Welcome card */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative overflow-hidden rounded-2xl p-5 text-white shadow-lg"
        style={{
          background: "linear-gradient(135deg, #1A56DB 0%, #3B82F6 100%)",
          boxShadow: "0 12px 32px -10px rgba(26, 86, 219, 0.4)",
        }}
      >
        <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/10 blur-2xl" />
        <h2 className="text-lg font-bold">You're all set 🎉</h2>
        <p className="mt-1 text-sm text-white/85">
          Let's start understanding your money better.
        </p>
      </motion.div>

      {/* Salary + Budget ring */}
      <div className="mt-4 grid grid-cols-2 gap-3">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.05 }}
          className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm"
        >
          <div className="flex items-center gap-2 text-xs font-medium text-gray-500">
            <IndianRupee className="h-3.5 w-3.5" /> Salary
          </div>
          <p className="mt-2 text-lg font-bold text-gray-900">₹--,---</p>
          <Shimmer className="mt-2 h-2 w-16 rounded-full" />
          <p className="mt-2 text-[11px] text-gray-400">Next pay in --d</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="flex flex-col items-center justify-center rounded-2xl border border-gray-100 bg-white p-4 shadow-sm"
        >
          <BudgetRing />
          <p className="mt-2 text-[11px] font-medium text-gray-500">Budget</p>
        </motion.div>
      </div>

      {/* Empty insights */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.15 }}
        className="mt-3 rounded-2xl border border-dashed border-gray-200 bg-white p-5 text-center"
      >
        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-500">
          <Sparkles className="h-5 w-5" />
        </div>
        <p className="mt-2 text-sm font-semibold text-gray-900">No insights yet</p>
        <p className="mt-1 text-xs text-gray-500">
          Add a few expenses and we'll surface smart patterns here.
        </p>
      </motion.div>

      {/* Analytics placeholder */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.2 }}
        className="mt-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-medium text-gray-500">
            <BarChart3 className="h-3.5 w-3.5" /> Spending analytics
          </div>
          <span className="text-[10px] font-medium text-gray-400">This week</span>
        </div>
        <div className="mt-3 flex h-20 items-end gap-2">
          {[35, 60, 25, 80, 45, 70, 50].map((h, i) => (
            <Shimmer key={i} className="flex-1 rounded-md" style={{ height: `${h}%` }} />
          ))}
        </div>
      </motion.div>

      {/* Motivational insight */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.25 }}
        className="mt-4 flex items-start gap-3 rounded-2xl p-4"
        style={{ background: `${BRAND.accent}10` }}
      >
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl"
          style={{ background: BRAND.accent, color: "white" }}
        >
          <Plus className="h-4 w-4" />
        </div>
        <p className="text-xs leading-relaxed text-gray-700">
          <span className="font-semibold text-gray-900">Pro tip:</span> If you track expenses daily,
          most users save <span className="font-semibold">₹2,000–₹5,000</span> monthly.
        </p>
      </motion.div>
    </div>
  );
}

function BudgetRing() {
  const r = 22;
  const c = 2 * Math.PI * r;
  return (
    <svg width="64" height="64" viewBox="0 0 64 64" className="-rotate-90">
      <circle cx="32" cy="32" r={r} stroke="#E5E7EB" strokeWidth="6" fill="none" />
      <motion.circle
        cx="32" cy="32" r={r}
        stroke={BRAND.primary}
        strokeWidth="6"
        strokeLinecap="round"
        fill="none"
        strokeDasharray={c}
        initial={{ strokeDashoffset: c }}
        animate={{ strokeDashoffset: c * 0.35 }}
        transition={{ duration: 1.2, ease: "easeOut" }}
      />
    </svg>
  );
}

function Shimmer({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={cn("relative overflow-hidden bg-gray-100", className)}
      style={style}
    >
      <motion.div
        className="absolute inset-0"
        style={{
          background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.7), transparent)",
        }}
        animate={{ x: ["-100%", "100%"] }}
        transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
      />
    </div>
  );
}
