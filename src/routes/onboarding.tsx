import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldCheck, Wallet, Bell, Sparkles, ArrowRight, Check,
  MessageSquareText, PieChart, Target, IndianRupee,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/onboarding")({
  head: () => ({
    meta: [
      { title: "Get started — FinTrackr" },
      { name: "description", content: "Set up your FinTrackr account in under 30 seconds." },
    ],
  }),
  component: OnboardingPage,
});

const BRAND = {
  primary: "#1A56DB",
  accent: "#10B981",
  bg: "#F9FAFB",
  text: "#111827",
};

type Goal = "save" | "budget" | "track" | "invest";

const GOALS: { id: Goal; label: string; sub: string; icon: typeof Target }[] = [
  { id: "save",   label: "Save more",        sub: "Build the habit",          icon: Target },
  { id: "budget", label: "Stick to a budget", sub: "Control monthly spend",   icon: PieChart },
  { id: "track",  label: "Track UPI spends",  sub: "Auto from SMS",           icon: MessageSquareText },
  { id: "invest", label: "Grow wealth",       sub: "SIPs, gold, stocks",      icon: Sparkles },
];

const PERMS = [
  { icon: MessageSquareText, title: "Read transaction SMS", desc: "Auto-detect UPI & bank alerts. Stays on your device." },
  { icon: Bell,              title: "Smart notifications",  desc: "Budget alerts, salary countdown, bill reminders." },
  { icon: ShieldCheck,       title: "Private by default",   desc: "Your data is encrypted. We never sell it." },
];

function OnboardingPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [salary, setSalary] = useState("");
  const [goals, setGoals] = useState<Set<Goal>>(new Set());

  const totalSteps = 4;
  const progress = ((step + 1) / totalSteps) * 100;

  const canContinue =
    (step === 0) ||
    (step === 1 && name.trim().length > 0) ||
    (step === 2 && goals.size > 0) ||
    (step === 3);

  function toggleGoal(g: Goal) {
    setGoals((prev) => {
      const n = new Set(prev);
      n.has(g) ? n.delete(g) : n.add(g);
      return n;
    });
  }

  function next() {
    if (step < totalSteps - 1) setStep(step + 1);
    else finish();
  }

  function finish() {
    try {
      localStorage.setItem(
        "fintrackr:onboarding",
        JSON.stringify({ name, salary, goals: [...goals], completedAt: Date.now() }),
      );
    } catch {}
    navigate({ to: "/dashboard" });
  }

  return (
    <div
      className="min-h-screen w-full"
      style={{ background: BRAND.bg, color: BRAND.text }}
    >
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col px-5 pt-6 pb-32">
        {/* Header / progress */}
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
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
            >
              {step === 0 && <WelcomeStep />}
              {step === 1 && (
                <ProfileStep
                  name={name}
                  setName={setName}
                  salary={salary}
                  setSalary={setSalary}
                />
              )}
              {step === 2 && <GoalsStep goals={goals} toggle={toggleGoal} />}
              {step === 3 && <PermissionsStep />}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Sticky bottom CTA */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-gray-100 bg-white/90 px-5 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-4 backdrop-blur">
        <div className="mx-auto max-w-md">
          <Button
            onClick={next}
            disabled={!canContinue}
            className="h-12 w-full rounded-2xl text-base font-semibold shadow-lg transition-transform active:scale-[0.98] disabled:opacity-50"
            style={{ background: BRAND.accent, color: "white" }}
          >
            {step === totalSteps - 1 ? "Enter FinTrackr" : "Continue"}
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
          <p className="mt-3 text-center text-[11px] text-gray-500">
            Takes under 30 seconds · No card required
          </p>
        </div>
      </div>
    </div>
  );
}

function WelcomeStep() {
  return (
    <div className="pt-2">
      <div
        className="mb-6 inline-flex h-14 w-14 items-center justify-center rounded-2xl text-white shadow-lg"
        style={{ background: BRAND.primary }}
      >
        <Wallet className="h-7 w-7" />
      </div>
      <h1 className="font-display text-3xl font-bold leading-tight tracking-tight">
        Welcome to FinTrackr
      </h1>
      <p className="mt-3 text-base leading-relaxed text-gray-600">
        Your calm, simple money control center — built for Indian salary life.
        Let's set you up in a few taps.
      </p>

      <div className="mt-8 space-y-3">
        {[
          { icon: MessageSquareText, t: "Auto-tracks UPI & bank SMS" },
          { icon: PieChart,          t: "See where money really goes" },
          { icon: ShieldCheck,       t: "Private. On-device. Yours." },
        ].map((row) => (
          <div
            key={row.t}
            className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm"
          >
            <div
              className="flex h-10 w-10 items-center justify-center rounded-xl"
              style={{ background: `${BRAND.primary}14`, color: BRAND.primary }}
            >
              <row.icon className="h-5 w-5" />
            </div>
            <p className="text-sm font-medium">{row.t}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProfileStep({
  name, setName, salary, setSalary,
}: {
  name: string; setName: (v: string) => void;
  salary: string; setSalary: (v: string) => void;
}) {
  return (
    <div className="pt-2">
      <h1 className="font-display text-2xl font-bold tracking-tight">
        A little about you
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-gray-600">
        Just the basics — so we can personalize your dashboard.
      </p>

      <div className="mt-7 space-y-5">
        <div className="space-y-2">
          <Label className="text-sm font-medium">Your name</Label>
          <Input
            placeholder="e.g. Aarav"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-12 rounded-xl border-gray-200 bg-white text-base"
            autoFocus
          />
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium">
            Monthly salary <span className="text-gray-400">(optional)</span>
          </Label>
          <div className="relative">
            <IndianRupee className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              inputMode="numeric"
              placeholder="50,000"
              value={salary}
              onChange={(e) => setSalary(e.target.value.replace(/[^\d]/g, ""))}
              className="h-12 rounded-xl border-gray-200 bg-white pl-9 text-base"
            />
          </div>
          <p className="text-xs text-gray-500">
            Used to power salary countdown & savings insights.
          </p>
        </div>
      </div>
    </div>
  );
}

function GoalsStep({
  goals, toggle,
}: { goals: Set<Goal>; toggle: (g: Goal) => void }) {
  return (
    <div className="pt-2">
      <h1 className="font-display text-2xl font-bold tracking-tight">
        What matters most?
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-gray-600">
        Pick one or more. We'll tune your dashboard around them.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-3">
        {GOALS.map((g) => {
          const active = goals.has(g.id);
          const Icon = g.icon;
          return (
            <button
              key={g.id}
              onClick={() => toggle(g.id)}
              className={cn(
                "relative flex flex-col items-start gap-3 rounded-2xl border bg-white p-4 text-left shadow-sm transition-all active:scale-[0.98]",
                active
                  ? "border-transparent ring-2 shadow-md"
                  : "border-gray-100 hover:border-gray-200",
              )}
              style={active ? { boxShadow: `0 0 0 2px ${BRAND.primary}` } : undefined}
            >
              <span
                className="flex h-10 w-10 items-center justify-center rounded-xl"
                style={{
                  background: active ? BRAND.primary : `${BRAND.primary}14`,
                  color: active ? "white" : BRAND.primary,
                }}
              >
                <Icon className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-semibold">{g.label}</p>
                <p className="text-xs text-gray-500">{g.sub}</p>
              </div>
              {active && (
                <span
                  className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full"
                  style={{ background: BRAND.accent }}
                >
                  <Check className="h-3 w-3 text-white" strokeWidth={3} />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function PermissionsStep() {
  return (
    <div className="pt-2">
      <h1 className="font-display text-2xl font-bold tracking-tight">
        You're in control
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-gray-600">
        Here's what FinTrackr uses — and what stays private. You can change
        anything later in Settings.
      </p>

      <div className="mt-6 space-y-3">
        {PERMS.map((p) => (
          <div
            key={p.title}
            className="flex items-start gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm"
          >
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
              style={{ background: `${BRAND.accent}1a`, color: BRAND.accent }}
            >
              <p.icon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold">{p.title}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-gray-500">{p.desc}</p>
            </div>
          </div>
        ))}
      </div>

      <div
        className="mt-6 rounded-2xl p-4 text-sm"
        style={{ background: `${BRAND.primary}0d`, color: BRAND.primary }}
      >
        <div className="flex items-center gap-2 font-semibold">
          <ShieldCheck className="h-4 w-4" /> Privacy-first promise
        </div>
        <p className="mt-1 text-xs leading-relaxed text-gray-600">
          SMS parsing happens on your device. We never read message content on
          our servers.
        </p>
      </div>
    </div>
  );
}
