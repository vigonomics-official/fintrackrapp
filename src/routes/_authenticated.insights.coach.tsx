import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Sparkles, TrendingDown, PiggyBank, Target, Wallet, AlertTriangle,
  Flame, CalendarClock, TrendingUp, ShieldCheck,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PageHeader } from "@/components/finance/PageHeader";
import {
  useTransactions, useCategories, useBudgets, useLoans, useProfile, monthKey,
} from "@/hooks/use-finance";
import { useSalarySettings } from "@/hooks/use-salary-settings";
import { computeSurvival } from "@/lib/survival";
import { formatCurrency } from "@/lib/currency";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/insights/coach")({
  component: CoachPage,
  head: () => ({ meta: [{ title: "AI Financial Coach — FinTrackr" }] }),
});

type Tone = "primary" | "success" | "warn" | "danger";
const TONE_BG: Record<Tone, string> = {
  primary: "bg-primary/10 text-primary",
  success: "bg-success/10 text-success",
  warn: "bg-gold/15 text-gold-foreground",
  danger: "bg-destructive/10 text-destructive",
};
const TONE_BAR: Record<Tone, string> = {
  primary: "bg-primary",
  success: "bg-success",
  warn: "bg-gold",
  danger: "bg-destructive",
};

type Advice = {
  icon: React.ReactNode;
  tone: Tone;
  title: string;
  body: string;
  action?: string;
};

function CoachPage() {
  const { data: txs = [] } = useTransactions();
  const { data: categories = [] } = useCategories();
  const { data: budgets = [] } = useBudgets(monthKey());
  const { data: loans = [] } = useLoans();
  const { data: profile } = useProfile();
  const { settings } = useSalarySettings();
  const currency = profile?.currency ?? "INR";
  const [tab, setTab] = useState<"analyze" | "advice" | "plan">("analyze");

  const now = useMemo(() => new Date(), []);
  const survival = useMemo(
    () => computeSurvival({ transactions: txs, loans, salarySettings: settings, now }),
    [txs, loans, settings, now],
  );

  const ym = `${now.getFullYear()}-${now.getMonth()}`;
  const monthExpenses = useMemo(
    () => txs.filter(t => {
      const d = new Date(t.transaction_date);
      return t.type === "expense" && `${d.getFullYear()}-${d.getMonth()}` === ym;
    }),
    [txs, ym],
  );
  const monthSpent = useMemo(() => monthExpenses.reduce((s, t) => s + t.amount, 0), [monthExpenses]);

  const catBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    monthExpenses.forEach(t => {
      const k = t.category_id ?? "uncategorized";
      map.set(k, (map.get(k) ?? 0) + t.amount);
    });
    return [...map.entries()]
      .map(([id, amt]) => {
        const c = categories.find(x => x.id === id);
        const budget = budgets.find(b => b.category_id === id);
        return {
          id,
          name: c?.name ?? "Uncategorized",
          icon: c?.icon ?? "💸",
          amount: amt,
          budget: budget?.monthly_limit ?? null,
        };
      })
      .sort((a, b) => b.amount - a.amount);
  }, [monthExpenses, categories, budgets]);

  const topCat = catBreakdown[0] ?? null;

  const largestExpense = useMemo(() => {
    if (!monthExpenses.length) return null;
    return [...monthExpenses].sort((a, b) => b.amount - a.amount)[0];
  }, [monthExpenses]);

  // Streak
  const streak = useMemo(() => {
    if (survival.safeDaily <= 0) return 0;
    const byDay = new Map<string, number>();
    txs.filter(t => t.type === "expense").forEach(t => {
      const k = String(t.transaction_date).slice(0, 10);
      byDay.set(k, (byDay.get(k) ?? 0) + t.amount);
    });
    let count = 0;
    for (let i = 0; i < 90; i++) {
      const d = new Date(now); d.setDate(d.getDate() - i);
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const spent = byDay.get(k) ?? 0;
      if (spent <= survival.safeDaily) count++; else break;
    }
    return count;
  }, [txs, survival.safeDaily, now]);

  // Upcoming EMI
  const upcomingEmi = useMemo(() => {
    if (!loans.length) return null;
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let best: { name: string; amount: number; dueDate: Date; days: number } | null = null;
    loans.forEach((l: any) => {
      if (Number(l.remaining_balance) <= 0) return;
      const day = Math.min(Math.max(1, l.due_day || 1), 28);
      let due = new Date(today.getFullYear(), today.getMonth(), day);
      if (due < today) due = new Date(today.getFullYear(), today.getMonth() + 1, day);
      const days = Math.round((due.getTime() - today.getTime()) / 86_400_000);
      if (!best || days < best.days) best = { name: l.loan_name, amount: Number(l.emi_amount), dueDate: due, days };
    });
    return best;
  }, [loans, now]);

  // Advice list (existing coach logic)
  const advice = useMemo<Advice[]>(() => {
    const out: Advice[] = [];
    if (!txs.length) return out;

    if (survival.hasIncome) {
      if (survival.forecastBalance < 0) {
        out.push({
          icon: <TrendingDown className="h-5 w-5" />,
          tone: "danger",
          title: "Slow down — you're on track to overspend",
          body: `At your current pace you'll overshoot by ${formatCurrency(Math.abs(survival.forecastBalance), currency)} before next salary. Cut your daily spend to ${formatCurrency(survival.safeDaily, currency)} or less for the rest of the cycle.`,
          action: "Review today's expenses and skip one non-essential purchase.",
        });
      } else if (survival.forecastBalance > survival.salary * 0.15) {
        out.push({
          icon: <PiggyBank className="h-5 w-5" />,
          tone: "success",
          title: `You can save ${formatCurrency(survival.forecastBalance, currency)} this month`,
          body: `Your spending pace is healthy. Consider moving ${formatCurrency(Math.round(survival.forecastBalance * 0.6), currency)} into savings before payday so you don't accidentally spend it.`,
          action: "Set up a recurring transfer to your savings account.",
        });
      }
    } else {
      out.push({
        icon: <Wallet className="h-5 w-5" />,
        tone: "primary",
        title: "Add your salary to get sharper advice",
        body: "Once your salary and pay day are set, I can forecast month-end balance and personalize every tip.",
      });
    }

    if (topCat) {
      const overBudget = topCat.budget != null && topCat.amount > topCat.budget;
      out.push({
        icon: <Target className="h-5 w-5" />,
        tone: overBudget ? "danger" : "primary",
        title: `${topCat.name} is your biggest spend`,
        body: overBudget
          ? `You've spent ${formatCurrency(topCat.amount, currency)}, which is ${formatCurrency(topCat.amount - (topCat.budget ?? 0), currency)} over your budget. Pause new ${topCat.name.toLowerCase()} expenses for a week.`
          : `You've spent ${formatCurrency(topCat.amount, currency)} this month on ${topCat.name}. ${topCat.budget != null ? `That's ${Math.round((topCat.amount / topCat.budget) * 100)}% of your budget.` : "Setting a budget would help track this automatically."}`,
        action: topCat.budget != null ? undefined : "Tap Budgets and add a monthly limit for this category.",
      });
    }

    if (survival.monthlyEmi > 0) {
      if (survival.emiLevel === "High") {
        out.push({
          icon: <AlertTriangle className="h-5 w-5" />,
          tone: "danger",
          title: "EMIs are eating your salary",
          body: `${Math.round(survival.emiRatio)}% of your income (${formatCurrency(survival.monthlyEmi, currency)}) is locked in EMIs. Avoid taking on any new debt this cycle.`,
          action: "Consider prepaying the smallest loan first to free up cash flow.",
        });
      } else if (survival.emiLevel === "Medium") {
        out.push({
          icon: <Target className="h-5 w-5" />,
          tone: "warn",
          title: "EMI load is manageable but watch it",
          body: `EMIs use ${Math.round(survival.emiRatio)}% of your salary. Keep this under 40% by avoiding new loans until one closes.`,
        });
      }
    }

    const small = monthExpenses.filter(t => t.amount < 200);
    if (small.length >= 10) {
      const smallTotal = small.reduce((s, t) => s + t.amount, 0);
      out.push({
        icon: <Wallet className="h-5 w-5" />,
        tone: "warn",
        title: "Small spends add up",
        body: `${small.length} purchases under ${formatCurrency(200, currency)} this month totaling ${formatCurrency(smallTotal, currency)}. These are usually impulse buys — try a 24h rule before any small purchase.`,
      });
    }

    if (streak >= 3) {
      out.push({
        icon: <Flame className="h-5 w-5 text-orange-500" />,
        tone: "success",
        title: `${streak}-day safe-spending streak`,
        body: "You've stayed under your safe daily limit. Keep the momentum going.",
      });
    }

    return out;
  }, [txs, survival, topCat, monthExpenses, streak, currency]);

  // Monthly action plan
  const plan = useMemo<Advice[]>(() => {
    const out: Advice[] = [];
    if (!survival.hasIncome) {
      out.push({
        icon: <Wallet className="h-5 w-5" />,
        tone: "primary",
        title: "Set your salary in Planner",
        body: "Add your monthly salary and payday so I can build a personalized plan.",
      });
      return out;
    }

    out.push({
      icon: <ShieldCheck className="h-5 w-5" />,
      tone: survival.forecastBalance >= 0 ? "success" : "warn",
      title: `Keep daily spend under ${formatCurrency(survival.safeDaily, currency)}`,
      body: survival.forecastBalance >= 0
        ? `You're on track to finish with ${formatCurrency(survival.forecastBalance, currency)} left. Hold this pace for ${survival.daysRemaining} more day${survival.daysRemaining === 1 ? "" : "s"}.`
        : `At the current pace you'll be short by ${formatCurrency(Math.abs(survival.forecastBalance), currency)}. Trim daily spending to recover into the safe zone.`,
      action: "Check your Spent Today card each evening.",
    });

    // Budget recommendations
    const overspentCats = catBreakdown.filter(c => c.budget != null && c.amount > c.budget);
    const noBudgetTop = catBreakdown.slice(0, 3).filter(c => c.budget == null && c.amount > 0);

    if (overspentCats.length > 0) {
      const top = overspentCats[0];
      out.push({
        icon: <Target className="h-5 w-5" />,
        tone: "danger",
        title: `Rebalance your ${top.name} budget`,
        body: `You're ${formatCurrency(top.amount - (top.budget ?? 0), currency)} over the ${formatCurrency(top.budget ?? 0, currency)} limit. Either raise the cap next month or cut back for the rest of this one.`,
        action: "Open Budgets to adjust the limit.",
      });
    }
    if (noBudgetTop.length > 0) {
      out.push({
        icon: <Target className="h-5 w-5" />,
        tone: "primary",
        title: "Set budgets for your top categories",
        body: `${noBudgetTop.map(c => c.name).join(", ")} together account for ${formatCurrency(noBudgetTop.reduce((s, c) => s + c.amount, 0), currency)} this month with no limits set.`,
        action: "Add monthly limits in Budgets.",
      });
    }

    // Savings plan
    if (survival.forecastBalance > 0) {
      const saveTarget = Math.round(survival.forecastBalance * 0.6);
      out.push({
        icon: <PiggyBank className="h-5 w-5" />,
        tone: "success",
        title: `Auto-save ${formatCurrency(saveTarget, currency)} this cycle`,
        body: `That's roughly 60% of your projected surplus. Move it out of your spending account before payday so it's not accidentally spent.`,
        action: "Create a recurring transfer to savings.",
      });
    }

    // Upcoming EMI reminder
    if (upcomingEmi) {
      out.push({
        icon: <CalendarClock className="h-5 w-5" />,
        tone: "warn",
        title: `EMI of ${formatCurrency((upcomingEmi as any).amount, currency)} due in ${(upcomingEmi as any).days} day${(upcomingEmi as any).days === 1 ? "" : "s"}`,
        body: `${(upcomingEmi as any).name} — due ${(upcomingEmi as any).dueDate.toLocaleDateString()}. Make sure the balance covers it.`,
      });
    }

    // Goals nudge
    out.push({
      icon: <TrendingUp className="h-5 w-5" />,
      tone: "primary",
      title: "Review your financial goals",
      body: "Break big goals into monthly contributions and set aside a small amount as soon as salary hits.",
      action: "Open Goals to review or add one.",
    });

    return out;
  }, [survival, catBreakdown, upcomingEmi, currency]);

  const avgDaily = useMemo(() => {
    if (!survival.hasIncome) return 0;
    const days = Math.max(1, Math.ceil((now.getTime() - survival.lastSalaryDate.getTime()) / 86_400_000));
    return (survival.salary - survival.salaryLeft) / days;
  }, [survival, now]);

  return (
    <div className="w-full overflow-x-hidden">
      <PageHeader title="AI Financial Coach" subtitle="Personalized money advice, built from your data" />
      <div className="mx-auto w-full max-w-3xl space-y-3 px-4 py-5 sm:px-6 md:px-10">
        {/* Greeting */}
        <Card
          className="relative overflow-hidden border-0 p-4 text-white shadow-soft"
          style={{ background: "linear-gradient(135deg, oklch(0.55 0.13 165) 0%, oklch(0.42 0.12 170) 100%)" }}
        >
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15">
              <Sparkles className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="font-display text-base font-semibold">
                {survival.hasIncome
                  ? `Survival Score: ${survival.score}/100`
                  : "Let's get you set up"}
              </p>
              <p className="mt-0.5 text-xs text-white/85">
                {survival.hasIncome
                  ? `${formatCurrency(survival.salaryLeft, currency)} left for ${survival.daysRemaining} day${survival.daysRemaining === 1 ? "" : "s"} · Safe daily ${formatCurrency(survival.safeDaily, currency)}`
                  : "Add your salary in Planner so I can coach you better."}
              </p>
            </div>
          </div>
        </Card>

        <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="w-full">
          <TabsList className="grid h-9 w-full grid-cols-3">
            <TabsTrigger value="analyze">Analyze</TabsTrigger>
            <TabsTrigger value="advice">Advice</TabsTrigger>
            <TabsTrigger value="plan">Plan</TabsTrigger>
          </TabsList>

          {/* ANALYZE */}
          <TabsContent value="analyze" className="mt-3 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Card className="p-3 shadow-soft">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Spent this month</p>
                <p className="mt-1 font-display text-lg font-bold">{formatCurrency(monthSpent, currency)}</p>
              </Card>
              <Card className="p-3 shadow-soft">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Avg daily</p>
                <p className="mt-1 font-display text-lg font-bold">{formatCurrency(Math.round(avgDaily), currency)}</p>
              </Card>
            </div>

            {catBreakdown.length > 0 ? (
              <Card className="p-4 shadow-soft">
                <p className="mb-3 font-display text-sm font-semibold">Spending by category</p>
                <div className="space-y-2.5">
                  {catBreakdown.slice(0, 5).map(c => {
                    const pct = monthSpent > 0 ? Math.round((c.amount / monthSpent) * 100) : 0;
                    const over = c.budget != null && c.amount > c.budget;
                    return (
                      <div key={c.id} className="min-w-0">
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <span className="min-w-0 truncate font-medium">
                            <span className="mr-1">{c.icon}</span>{c.name}
                          </span>
                          <span className={cn("shrink-0 tabular-nums", over ? "text-destructive font-semibold" : "text-muted-foreground")}>
                            {formatCurrency(c.amount, currency)}
                          </span>
                        </div>
                        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                          <div
                            className={cn("h-full rounded-full", over ? "bg-destructive" : "bg-primary")}
                            style={{ width: `${Math.min(100, pct)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            ) : (
              <EmptyCard title="No spending yet" message="Add a few expenses to see your breakdown." />
            )}

            {largestExpense && (
              <Card className="p-4 shadow-soft">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Largest expense</p>
                <p className="mt-1 font-display text-sm font-semibold">
                  {largestExpense.description || "Expense"} — {formatCurrency(largestExpense.amount, currency)}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {new Date(largestExpense.transaction_date).toLocaleDateString()}
                </p>
              </Card>
            )}

            <Card className="p-4 shadow-soft">
              <div className="flex items-center gap-3">
                <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", TONE_BG.success)}>
                  <Flame className="h-5 w-5 text-orange-500" />
                </span>
                <div className="min-w-0">
                  <p className="font-display text-sm font-semibold">
                    {streak > 0 ? `${streak}-day safe streak` : "No active streak"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {streak > 0 ? "Consecutive days under your safe daily limit." : "Spend under your safe limit today to start one."}
                  </p>
                </div>
              </div>
            </Card>
          </TabsContent>

          {/* ADVICE */}
          <TabsContent value="advice" className="mt-3 space-y-3">
            {advice.length === 0 ? (
              <EmptyCard title="No advice yet" message="Start logging expenses and I'll generate personalized tips." />
            ) : (
              advice.map((a, i) => <AdviceRow key={i} a={a} />)
            )}
          </TabsContent>

          {/* PLAN */}
          <TabsContent value="plan" className="mt-3 space-y-3">
            {plan.map((a, i) => <AdviceRow key={i} a={a} withBar />)}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function AdviceRow({ a, withBar = false }: { a: Advice; withBar?: boolean }) {
  return (
    <Card className={cn("relative p-4 shadow-soft", withBar && "overflow-hidden pl-5")}>
      {withBar && <span className={cn("absolute left-0 top-0 h-full w-1.5", TONE_BAR[a.tone])} />}
      <div className="flex items-start gap-3">
        <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", TONE_BG[a.tone])}>
          {a.icon}
        </span>
        <div className="min-w-0 flex-1 space-y-1">
          <p className="font-display text-sm font-semibold">{a.title}</p>
          <p className="text-sm text-foreground/90">{a.body}</p>
          {a.action && (
            <p className="mt-1 rounded-md bg-muted/50 px-2 py-1.5 text-xs text-muted-foreground">
              💡 {a.action}
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}

function EmptyCard({ title, message }: { title: string; message: string }) {
  return (
    <Card className="p-5 text-center shadow-soft">
      <p className="text-sm font-semibold">{title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{message}</p>
    </Card>
  );
}
