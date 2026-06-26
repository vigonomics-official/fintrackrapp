import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/finance/PageHeader";
import {
  useTransactions, useCategories, useBudgets, useLoans, useProfile, monthKey,
} from "@/hooks/use-finance";
import { useSalarySettings } from "@/hooks/use-salary-settings";
import { computeSurvival } from "@/lib/survival";
import { formatCurrency } from "@/lib/currency";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/insights/report")({
  component: ReportPage,
  head: () => ({ meta: [{ title: "Monthly Report Card — FinTrackr" }] }),
});

function grade(score: number): { letter: string; tone: string } {
  if (score >= 90) return { letter: "A+", tone: "text-success" };
  if (score >= 80) return { letter: "A", tone: "text-success" };
  if (score >= 70) return { letter: "B", tone: "text-primary" };
  if (score >= 60) return { letter: "C", tone: "text-gold-foreground" };
  if (score >= 50) return { letter: "D", tone: "text-gold-foreground" };
  return { letter: "F", tone: "text-destructive" };
}

function ScoreCard({ title, score, hint }: { title: string; score: number; hint: string }) {
  const g = grade(score);
  return (
    <Card className="p-4 shadow-soft">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground">{title}</p>
          <p className="mt-0.5 font-display text-2xl font-bold">
            {score}<span className="text-sm text-muted-foreground">/100</span>
          </p>
        </div>
        <span className={cn("font-display text-3xl font-bold", g.tone)}>{g.letter}</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full", score >= 70 ? "bg-success" : score >= 50 ? "bg-gold" : "bg-destructive")} style={{ width: `${score}%` }} />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{hint}</p>
    </Card>
  );
}

function ReportPage() {
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

  const monthData = useMemo(() => {
    const ym = `${now.getFullYear()}-${now.getMonth()}`;
    const monthTxs = txs.filter(t => {
      const d = new Date(t.transaction_date);
      return `${d.getFullYear()}-${d.getMonth()}` === ym;
    });
    const expenses = monthTxs.filter(t => t.type === "expense");
    const income = monthTxs.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);
    const totalSpent = expenses.reduce((s, t) => s + t.amount, 0);

    // Biggest expense
    const biggest = expenses.length
      ? expenses.reduce((m, t) => (t.amount > m.amount ? t : m), expenses[0])
      : null;

    // Biggest win: category most under budget (or most disciplined)
    const spendByCat = new Map<string, number>();
    expenses.forEach(t => {
      const k = t.category_id ?? "uncategorized";
      spendByCat.set(k, (spendByCat.get(k) ?? 0) + t.amount);
    });
    const wins = budgets
      .filter(b => b.category_id && b.monthly_limit > 0)
      .map(b => {
        const spent = spendByCat.get(b.category_id!) ?? 0;
        const saved = b.monthly_limit - spent;
        const c = categories.find(x => x.id === b.category_id);
        return { name: c?.name ?? "Category", saved };
      })
      .filter(w => w.saved > 0)
      .sort((a, b) => b.saved - a.saved);
    const bestWin: { name: string; saved: number } | null = wins[0] ?? null;

    // Budget score: % of budgets respected
    let budgetScore = 100;
    if (budgets.length > 0) {
      const respected = budgets.filter(b => {
        const spent = b.category_id ? (spendByCat.get(b.category_id) ?? 0) : 0;
        return spent <= b.monthly_limit;
      }).length;
      budgetScore = Math.round((respected / budgets.length) * 100);
    }

    // Spending score: relative to safe daily * days elapsed
    let spendingScore = 75;
    if (survival.hasIncome && survival.salary > 0) {
      const ratio = totalSpent / survival.salary;
      spendingScore = Math.max(0, Math.min(100, Math.round(100 - ratio * 100)));
    }

    // Savings score: salaryLeft ratio
    let savingsScore = 50;
    if (survival.hasIncome && survival.salary > 0) {
      savingsScore = Math.max(0, Math.min(100, Math.round((survival.salaryLeft / survival.salary) * 100)));
    }

    return { totalSpent, income, biggest, bestWin, budgetScore, spendingScore, savingsScore, txCount: expenses.length };
  }, [txs, budgets, categories, survival, now]);

  const biggestCat = monthData.biggest
    ? categories.find(c => c.id === monthData.biggest!.category_id)?.name ?? "Uncategorized"
    : null;

  const recommendation = useMemo(() => {
    if (!txs.length) return "Start logging expenses to unlock your monthly report.";
    if (survival.forecastBalance < 0) {
      return `Pull back this week — you're projected to overspend by ${formatCurrency(Math.abs(survival.forecastBalance), currency)}. Cap daily spending at ${formatCurrency(survival.safeDaily, currency)}.`;
    }
    if (monthData.savingsScore >= 60) {
      return `Great month so far. Lock in ${formatCurrency(Math.round(survival.salaryLeft * 0.5), currency)} into savings before payday.`;
    }
    return `Trim discretionary spending and aim to keep daily spend below ${formatCurrency(survival.safeDaily, currency)}.`;
  }, [txs.length, survival, monthData.savingsScore, currency]);

  const monthLabel = now.toLocaleString(undefined, { month: "long", year: "numeric" });

  if (!txs.length) {
    return (
      <div className="w-full overflow-x-hidden">
        <PageHeader title="Monthly Report Card" subtitle={monthLabel} />
        <div className="mx-auto w-full max-w-3xl px-4 py-5 sm:px-6 md:px-10">
          <Card className="p-5 text-center shadow-soft">
            <p className="text-sm font-semibold">No data yet for this month</p>
            <p className="mt-1 text-xs text-muted-foreground">Add a few expenses to generate your report card.</p>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full overflow-x-hidden">
      <PageHeader title="Monthly Report Card" subtitle={monthLabel} />
      <div className="mx-auto w-full max-w-3xl space-y-3 px-4 py-5 sm:px-6 md:px-10">
        <div className="grid grid-cols-2 gap-3">
          <ScoreCard title="Survival" score={survival.score} hint="Overall financial health" />
          <ScoreCard title="Budget" score={monthData.budgetScore} hint="Budgets respected" />
          <ScoreCard title="Spending" score={monthData.spendingScore} hint="Vs your salary" />
          <ScoreCard title="Savings" score={monthData.savingsScore} hint="% of salary left" />
        </div>

        <Card className="p-4 shadow-soft">
          <p className="text-xs text-muted-foreground">Biggest Expense</p>
          {monthData.biggest ? (
            <div className="mt-1 flex items-baseline justify-between gap-3">
              <p className="min-w-0 truncate font-display text-base font-semibold">
                {biggestCat}
                {monthData.biggest.notes ? <span className="ml-1 text-xs font-normal text-muted-foreground">· {monthData.biggest.notes}</span> : null}
              </p>
              <p className="shrink-0 font-display text-lg font-bold text-destructive">
                {formatCurrency(monthData.biggest.amount, currency)}
              </p>
            </div>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">No expenses yet.</p>
          )}
        </Card>

        <Card className="p-4 shadow-soft">
          <p className="text-xs text-muted-foreground">Biggest Win</p>
          {monthData.bestWin ? (
            <div className="mt-1 flex items-baseline justify-between gap-3">
              <p className="min-w-0 truncate font-display text-base font-semibold">{monthData.bestWin.name}</p>
              <p className="shrink-0 font-display text-lg font-bold text-success">
                {formatCurrency(monthData.bestWin.saved, currency)} saved
              </p>
            </div>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">
              {budgets.length === 0 ? "Set monthly budgets to unlock wins." : "No category came in under budget yet."}
            </p>
          )}
        </Card>

        <Card className="p-4 shadow-soft">
          <p className="mb-2 font-display text-sm font-semibold">Month Summary</p>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-[10px] text-muted-foreground">Income</p>
              <p className="mt-0.5 truncate font-display text-sm font-semibold">{formatCurrency(monthData.income, currency)}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground">Spent</p>
              <p className="mt-0.5 truncate font-display text-sm font-semibold">{formatCurrency(monthData.totalSpent, currency)}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground">Transactions</p>
              <p className="mt-0.5 font-display text-sm font-semibold">{monthData.txCount}</p>
            </div>
          </div>
        </Card>

        <Card
          className="relative overflow-hidden border-0 p-4 text-white shadow-soft"
          style={{ background: "linear-gradient(135deg, oklch(0.55 0.13 165) 0%, oklch(0.42 0.12 170) 100%)" }}
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-white/80">AI Recommendation</p>
          <p className="mt-1 text-sm">{recommendation}</p>
        </Card>
      </div>
    </div>
  );
}
