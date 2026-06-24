import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { Sparkles, TrendingUp, Flame, CalendarClock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/finance/PageHeader";
import { useTransactions, useCategories, useBudgets, useLoans, useProfile, monthKey } from "@/hooks/use-finance";
import { useSalarySettings } from "@/hooks/use-salary-settings";
import { computeSurvival } from "@/lib/survival";
import { formatCurrency } from "@/lib/currency";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/insights/ai")({
  component: AIInsightsPage,
  head: () => ({ meta: [{ title: "AI Insights — FinTrackr" }] }),
});

type Tone = "primary" | "success" | "warn" | "danger";
const BARS: Record<Tone, string> = {
  primary: "bg-primary",
  success: "bg-success",
  warn: "bg-gold",
  danger: "bg-destructive",
};

function InsightCard({
  tone, icon, title, body, tip,
}: { tone: Tone; icon: React.ReactNode; title: string; body: React.ReactNode; tip?: string }) {
  return (
    <Card className="relative overflow-hidden p-4 pl-5 shadow-soft">
      <span className={cn("absolute left-0 top-0 h-full w-1.5", BARS[tone])} />
      <div className="flex items-start gap-3">
        <div className="mt-0.5 text-xl leading-none">{icon}</div>
        <div className="min-w-0 flex-1 space-y-1">
          <p className="font-display text-sm font-semibold">{title}</p>
          <div className="text-sm text-foreground/90">{body}</div>
          {tip && <p className="text-xs text-muted-foreground">{tip}</p>}
        </div>
      </div>
    </Card>
  );
}

function AIInsightsPage() {
  const { data: txs = [] } = useTransactions();
  const { data: categories = [] } = useCategories();
  const { data: budgets = [] } = useBudgets(monthKey());
  const { data: loans = [] } = useLoans();
  const { data: profile } = useProfile();
  const { settings } = useSalarySettings();
  const currency = profile?.currency ?? "INR";

  const now = new Date();
  const ym = `${now.getFullYear()}-${now.getMonth()}`;

  const monthExpenses = useMemo(
    () => txs.filter(t => {
      const d = new Date(t.transaction_date);
      return t.type === "expense" && `${d.getFullYear()}-${d.getMonth()}` === ym;
    }),
    [txs, ym],
  );

  const topCat = useMemo(() => {
    const map = new Map<string, number>();
    monthExpenses.forEach(t => {
      const k = t.category_id ?? "uncategorized";
      map.set(k, (map.get(k) ?? 0) + t.amount);
    });
    const arr = [...map.entries()].sort((a, b) => b[1] - a[1]);
    if (!arr.length) return null;
    const [id, amt] = arr[0];
    const c = categories.find(x => x.id === id);
    const budget = budgets.find(b => b.category_id === id);
    return { name: c?.name ?? "Uncategorized", icon: c?.icon ?? "💸", amount: amt, budget: budget?.monthly_limit ?? null };
  }, [monthExpenses, categories, budgets]);

  const survival = useMemo(
    () => computeSurvival({ transactions: txs, loans, salarySettings: settings, now }),
    [txs, loans, settings, now],
  );

  // Streak: consecutive days (ending today) where daily spend <= safeDaily.
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

  return (
    <div className="w-full overflow-x-hidden">
      <PageHeader title="AI Insights" subtitle="Smart guidance based on your spending" />
      <div className="mx-auto w-full max-w-3xl space-y-3 px-4 py-5 sm:px-6 md:px-10">
        {/* Card 1 — Top Spending */}
        {topCat ? (
          <InsightCard
            tone={topCat.budget != null && topCat.amount > topCat.budget ? "danger" : "primary"}
            icon={<span>{topCat.icon}</span>}
            title={`${topCat.name} is your biggest expense`}
            body={
              <>
                You've spent <b>{formatCurrency(topCat.amount, currency)}</b> this month
                {topCat.budget != null && (
                  topCat.amount > topCat.budget
                    ? <> — <span className="text-destructive font-medium">{formatCurrency(topCat.amount - topCat.budget, currency)} above</span> your {formatCurrency(topCat.budget, currency)} budget.</>
                    : <> — {formatCurrency(topCat.budget - topCat.amount, currency)} below your {formatCurrency(topCat.budget, currency)} budget.</>
                )}
                {topCat.budget == null && "."}
              </>
            }
            tip="Tip: set a monthly budget for this category to track it automatically."
          />
        ) : (
          <EmptyCard title="No spending yet" message="Add a few expenses to see your top category." />
        )}

        {/* Card 2 — Savings forecast */}
        {survival.hasIncome ? (
          <InsightCard
            tone={survival.forecastBalance >= 0 ? "success" : "warn"}
            icon={survival.forecastBalance >= 0 ? <span>💰</span> : <span>⚠️</span>}
            title={survival.forecastBalance >= 0
              ? `You can save ${formatCurrency(survival.forecastBalance, currency)} this month`
              : `At this rate you'll overspend by ${formatCurrency(Math.abs(survival.forecastBalance), currency)}`}
            body={
              <>Based on your average daily spend of {formatCurrency(Math.max(0, (survival.salary - survival.salaryLeft) / Math.max(1, Math.ceil((now.getTime() - survival.lastSalaryDate.getTime()) / 86_400_000) || 1)), currency)}.</>
            }
            tip={survival.forecastBalance >= 0 ? "Keep your daily spend at or below the safe limit." : "Trim discretionary spending for the rest of the cycle."}
          />
        ) : (
          <EmptyCard title="Set your salary" message="Add salary in Planner to forecast your month-end balance." />
        )}

        {/* Card 3 — Streak */}
        <InsightCard
          tone="success"
          icon={<Flame className="h-5 w-5 text-orange-500" />}
          title={streak > 0 ? `You've stayed under budget for ${streak} day${streak === 1 ? "" : "s"} in a row` : "Start your streak today"}
          body={streak > 0 ? "Keep it up — you're building great money habits." : "Spend under your safe daily limit today to start a streak."}
        />

        {/* Card 4 — Upcoming risk */}
        {upcomingEmi ? (
          <InsightCard
            tone="warn"
            icon={<CalendarClock className="h-5 w-5 text-amber-600" />}
            title={`EMI of ${formatCurrency((upcomingEmi as any).amount, currency)} due in ${(upcomingEmi as any).days} day${(upcomingEmi as any).days === 1 ? "" : "s"}`}
            body={<>{(upcomingEmi as any).name} — due {(upcomingEmi as any).dueDate.toLocaleDateString()}.</>}
            tip="Make sure you don't overspend before then."
          />
        ) : (
          <InsightCard
            tone="primary"
            icon={<Sparkles className="h-5 w-5" />}
            title="No EMIs due soon"
            body="Your upcoming bills look clear."
          />
        )}
      </div>
    </div>
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
