import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Sparkles, Target, ArrowRight, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/currency";

const KEY = "fintrackr_journey_v1";

export type JourneyAnswers = {
  challenge: "loans" | "paycheck" | "save" | "invest" | "goal";
  saving: "0" | "1-2k" | "2-5k" | "5k+";
  goal: "debtfree" | "emergency" | "vehicle" | "house" | "invest" | "freedom";
};

type Q = { key: keyof JourneyAnswers; title: string; options: { value: string; label: string }[] };

const QUESTIONS: Q[] = [
  {
    key: "challenge",
    title: "What is your biggest financial challenge?",
    options: [
      { value: "loans", label: "Too many Loans & EMIs" },
      { value: "paycheck", label: "Living paycheck to paycheck" },
      { value: "save", label: "Unable to save money" },
      { value: "invest", label: "Want to start investing" },
      { value: "goal", label: "Saving for a major goal" },
    ],
  },
  {
    key: "saving",
    title: "How much do you usually save each month?",
    options: [
      { value: "0", label: "₹0" },
      { value: "1-2k", label: "₹1 – ₹2,000" },
      { value: "2-5k", label: "₹2,000 – ₹5,000" },
      { value: "5k+", label: "₹5,000+" },
    ],
  },
  {
    key: "goal",
    title: "What is your main financial goal?",
    options: [
      { value: "debtfree", label: "Become debt-free" },
      { value: "emergency", label: "Build emergency fund" },
      { value: "vehicle", label: "Buy a bike/car" },
      { value: "house", label: "Buy a house" },
      { value: "invest", label: "Start investing" },
      { value: "freedom", label: "Financial freedom" },
    ],
  },
];

function load(): JourneyAnswers | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as JourneyAnswers) : null;
  } catch {
    return null;
  }
}

const savingMap: Record<JourneyAnswers["saving"], number> = {
  "0": 0,
  "1-2k": 1500,
  "2-5k": 3500,
  "5k+": 6000,
};

type StageInfo = {
  stage: string;
  emoji: string;
  tone: string;
  nextAction: string;
  monthlyTarget: number;
  targetTotal: number;
  current: number;
};

function deriveStage(
  a: JourneyAnswers,
  ctx: { monthlyEmi: number; salary: number; outstanding: number }
): StageInfo {
  const save = savingMap[a.saving];
  // Debt Reduction
  if (a.challenge === "loans" || a.goal === "debtfree" || ctx.monthlyEmi > 0) {
    return {
      stage: "Debt Reduction Mode",
      emoji: "🔥",
      tone: "bg-destructive/15 text-destructive",
      nextAction: "Close highest-interest loan first. Add ₹500 extra to EMI.",
      monthlyTarget: Math.max(500, Math.round(ctx.monthlyEmi * 0.1)),
      targetTotal: ctx.outstanding || 50000,
      current: Math.max(0, (ctx.outstanding ? ctx.outstanding * 0.15 : 7500)),
    };
  }
  // Emergency Fund
  if (a.challenge === "paycheck" || a.goal === "emergency" || a.challenge === "save") {
    const target = Math.max(30000, Math.round(ctx.salary * 3));
    return {
      stage: "Emergency Fund Builder",
      emoji: "🛡️",
      tone: "bg-primary/15 text-primary",
      nextAction: `Save ${formatCurrency(Math.max(1500, save || 1500), "INR")} this month into a separate account.`,
      monthlyTarget: Math.max(1500, save || 1500),
      targetTotal: target,
      current: Math.min(target, save * 4),
    };
  }
  // Savings Growth
  if (a.goal === "vehicle" || a.goal === "house") {
    const target = a.goal === "house" ? 500000 : 80000;
    return {
      stage: "Savings Growth Mode",
      emoji: "🌱",
      tone: "bg-success/15 text-success",
      nextAction: `Automate ${formatCurrency(Math.max(2000, save), "INR")} every payday toward your goal.`,
      monthlyTarget: Math.max(2000, save),
      targetTotal: target,
      current: Math.min(target, save * 6),
    };
  }
  // Investment Ready
  if (a.challenge === "invest" || a.goal === "invest") {
    return {
      stage: "Investment Ready",
      emoji: "📈",
      tone: "bg-gold/20 text-gold-foreground",
      nextAction: `Start a ${formatCurrency(Math.max(2000, save), "INR")}/month SIP in an index fund.`,
      monthlyTarget: Math.max(2000, save),
      targetTotal: 120000,
      current: Math.min(120000, save * 8),
    };
  }
  // Goal Achievement / Freedom
  return {
    stage: "Goal Achievement Mode",
    emoji: "🎯",
    tone: "bg-primary/15 text-primary",
    nextAction: `Increase monthly savings to ${formatCurrency(Math.max(5000, save + 1000), "INR")}.`,
    monthlyTarget: Math.max(5000, save + 1000),
    targetTotal: 1000000,
    current: Math.min(1000000, save * 10),
  };
}

export function FinancialJourney({
  monthlyEmi,
  salary,
  outstanding,
  currency,
}: {
  monthlyEmi: number;
  salary: number;
  outstanding: number;
  currency: string;
}) {
  const [answers, setAnswers] = useState<JourneyAnswers | null>(null);
  const [setupOpen, setSetupOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Partial<JourneyAnswers>>({});

  useEffect(() => {
    const a = load();
    setAnswers(a);
    if (!a) setSetupOpen(true);
  }, []);

  function persist(a: JourneyAnswers) {
    localStorage.setItem(KEY, JSON.stringify(a));
    setAnswers(a);
    setSetupOpen(false);
    setStep(0);
    setDraft({});
  }

  function pick(value: string) {
    const q = QUESTIONS[step];
    const next = { ...draft, [q.key]: value } as Partial<JourneyAnswers>;
    setDraft(next);
    if (step < QUESTIONS.length - 1) setStep(step + 1);
    else persist(next as JourneyAnswers);
  }

  const info = useMemo(
    () => (answers ? deriveStage(answers, { monthlyEmi, salary, outstanding }) : null),
    [answers, monthlyEmi, salary, outstanding]
  );

  if (setupOpen || !answers || !info) {
    const q = QUESTIONS[step];
    return (
      <Card className="border-primary/30 bg-primary/5 shadow-soft">
        <CardContent className="space-y-3 p-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">
              Financial Journey · Step {step + 1} of {QUESTIONS.length}
            </p>
          </div>
          <p className="text-sm font-semibold text-foreground">{q.title}</p>
          <div className="space-y-1.5">
            {q.options.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => pick(o.value)}
                className="flex w-full items-center justify-between rounded-lg border border-border/60 bg-card px-3 py-2.5 text-left text-sm font-medium transition-colors hover:border-primary/50 hover:bg-primary/5"
              >
                <span>{o.label}</span>
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const pct = Math.min(100, Math.round((info.current / Math.max(1, info.targetTotal)) * 100));
  const remaining = Math.max(0, info.targetTotal - info.current);
  const months = info.monthlyTarget > 0 ? Math.ceil(remaining / info.monthlyTarget) : 0;
  const eta = new Date();
  eta.setMonth(eta.getMonth() + months);

  return (
    <Card className="shadow-soft">
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 space-y-1">
            <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider", info.tone)}>
              {info.emoji} {info.stage}
            </span>
            <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Target className="h-3 w-3" /> Financial Journey
            </p>
          </div>
          <button
            type="button"
            onClick={() => { setSetupOpen(true); setStep(0); setDraft({}); }}
            className="shrink-0 text-[11px] font-medium text-primary hover:underline"
          >
            Edit
          </button>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-muted-foreground">
              {formatCurrency(info.current, currency)} of {formatCurrency(info.targetTotal, currency)}
            </span>
            <span className="font-semibold tabular-nums">{pct}%</span>
          </div>
          <Progress value={pct} className="h-1.5" />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg border bg-muted/30 p-2">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Monthly Target</p>
            <p className="mt-0.5 font-display text-sm font-bold tabular-nums">
              {formatCurrency(info.monthlyTarget, currency)}
            </p>
          </div>
          <div className="rounded-lg border bg-muted/30 p-2">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Est. Completion</p>
            <p className="mt-0.5 font-display text-sm font-bold">
              {months > 0
                ? eta.toLocaleDateString(undefined, { month: "short", year: "numeric" })
                : "—"}
            </p>
          </div>
        </div>

        <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
            <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">Next Action</p>
          </div>
          <p className="mt-1 text-sm leading-snug text-foreground">{info.nextAction}</p>
        </div>
      </CardContent>
    </Card>
  );
}
