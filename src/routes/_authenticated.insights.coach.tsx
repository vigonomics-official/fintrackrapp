import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { Sparkles, TrendingDown, PiggyBank, Target, Wallet, AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/finance/PageHeader";
import {
  useTransactions, useCategories, useBudgets, useLoans, useProfile, monthKey,
} from "@/hooks/use-finance";
import { useSalarySettings } from "@/hooks/use-salary-settings";
import { computeSurvival } from "@/lib/survival";
import { formatCurrency } from "@/lib/currency";

export const Route = createFileRoute("/_authenticated/insights/coach")({
  component: CoachPage,
  head: () => ({ meta: [{ title: "AI Financial Coach — FinTrackr" }] }),
});

type Advice = {
  icon: React.ReactNode;
  tone: "primary" | "success" | "warn" | "danger";
  title: string;
  body: string;
  action?: string;
};

const TONE_BG: Record<Advice["tone"], string> = {
  primary: "bg-primary/10 text-primary",
  success: "bg-success/10 text-success",
  warn: "bg-gold/15 text-gold-foreground",
  danger: "bg-destructive/10 text-destructive",
};

function CoachPage() {
  const { data: txs = [] } = useTransactions();
  const { data: categories = [] } = useCategories();
  const { data: budgets = [] } = useBudgets(monthKey());
  const { data: loans = [] } = useLoans();
  const { data: profile } = useProfile();
  const { settings } = useSalarySettings();
  const currency = profile?.currency ?? "INR";

  const now = useMemo(() => new Date(), []);
  const survival = useMemo(
    () => computeSurvival({ transactions: txs, loans, salarySettings: settings, now }),
    [txs, loans, settings, now],
  );

  const advice = useMemo<Advice[]>(() => {
    const out: Advice[] = [];
    if (!txs.length) return out;

    // 1. Spending pace
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

    // 2. Biggest category
    const ym = `${now.getFullYear()}-${now.getMonth()}`;
    const catMap = new Map<string, number>();
    txs.forEach(t => {
      if (t.type !== "expense") return;
      const d = new Date(t.transaction_date);
      if (`${d.getFullYear()}-${d.getMonth()}` !== ym) return;
      const k = t.category_id ?? "uncategorized";
      catMap.set(k, (catMap.get(k) ?? 0) + t.amount);
    });
    const top = [...catMap.entries()].sort((a, b) => b[1] - a[1])[0];
    if (top) {
      const cat = categories.find(c => c.id === top[0]);
      const budget = budgets.find(b => b.category_id === top[0]);
      const overBudget = budget && top[1] > budget.monthly_limit;
      out.push({
        icon: <Target className="h-5 w-5" />,
        tone: overBudget ? "danger" : "primary",
        title: `${cat?.name ?? "Uncategorized"} is your biggest spend`,
        body: overBudget
          ? `You've spent ${formatCurrency(top[1], currency)}, which is ${formatCurrency(top[1] - (budget?.monthly_limit ?? 0), currency)} over your budget. Pause new ${cat?.name?.toLowerCase() ?? "category"} expenses for a week.`
          : `You've spent ${formatCurrency(top[1], currency)} this month on ${cat?.name ?? "this category"}. ${budget ? `That's ${Math.round((top[1] / budget.monthly_limit) * 100)}% of your budget.` : "Setting a budget would help track this automatically."}`,
        action: budget ? undefined : "Tap Budgets and add a monthly limit for this category.",
      });
    }

    // 3. EMI load
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

    // 4. Small spends
    const smallCount = txs.filter(t => {
      const d = new Date(t.transaction_date);
      return t.type === "expense" && `${d.getFullYear()}-${d.getMonth()}` === ym && t.amount < 200;
    }).length;
    if (smallCount >= 10) {
      const smallTotal = txs.filter(t => {
        const d = new Date(t.transaction_date);
        return t.type === "expense" && `${d.getFullYear()}-${d.getMonth()}` === ym && t.amount < 200;
      }).reduce((s, t) => s + t.amount, 0);
      out.push({
        icon: <Wallet className="h-5 w-5" />,
        tone: "warn",
        title: "Small spends add up",
        body: `${smallCount} purchases under ${formatCurrency(200, currency)} this month totaling ${formatCurrency(smallTotal, currency)}. These are usually impulse buys — try a 24h rule before any small purchase.`,
      });
    }

    return out;
  }, [txs, categories, budgets, survival, currency, now]);

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

        {advice.length === 0 ? (
          <Card className="p-5 text-center shadow-soft">
            <p className="text-sm font-semibold">No advice yet</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Start logging expenses and I'll generate personalized tips based on your patterns.
            </p>
          </Card>
        ) : (
          advice.map((a, i) => (
            <Card key={i} className="p-4 shadow-soft">
              <div className="flex items-start gap-3">
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${TONE_BG[a.tone]}`}>
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
          ))
        )}
      </div>
    </div>
  );
}
