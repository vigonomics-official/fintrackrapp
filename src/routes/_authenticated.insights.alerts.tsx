import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { CheckCircle2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/finance/PageHeader";
import { useTransactions, useCategories, useBudgets, useLoans, useProfile, monthKey } from "@/hooks/use-finance";
import { useSalarySettings } from "@/hooks/use-salary-settings";
import { computeSurvival } from "@/lib/survival";
import { formatCurrency } from "@/lib/currency";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/insights/alerts")({
  component: AlertsPage,
  head: () => ({ meta: [{ title: "Danger Alerts — FinTrackr" }] }),
});

type Tone = "danger" | "warn" | "info";
const BARS: Record<Tone, string> = {
  danger: "bg-destructive",
  warn: "bg-gold",
  info: "bg-primary",
};
const ICON: Record<Tone, string> = { danger: "🔴", warn: "🟡", info: "📅" };

function AlertCard({ tone, title, body }: { tone: Tone; title: string; body: React.ReactNode }) {
  return (
    <Card className="relative overflow-hidden p-4 pl-5 shadow-soft">
      <span className={cn("absolute left-0 top-0 h-full w-1.5", BARS[tone])} />
      <div className="flex items-start gap-3">
        <span className="text-xl leading-none">{ICON[tone]}</span>
        <div className="min-w-0 flex-1 space-y-1">
          <p className="font-display text-sm font-semibold">{title}</p>
          <div className="text-sm text-foreground/90">{body}</div>
        </div>
      </div>
    </Card>
  );
}

function AlertsPage() {
  const { data: txs = [] } = useTransactions();
  const { data: categories = [] } = useCategories();
  const { data: budgets = [] } = useBudgets(monthKey());
  const { data: loans = [] } = useLoans();
  const { data: profile } = useProfile();
  const { settings } = useSalarySettings();
  const currency = profile?.currency ?? "INR";

  const now = new Date();
  const survival = useMemo(
    () => computeSurvival({ transactions: txs, loans, salarySettings: settings, now }),
    [txs, loans, settings, now],
  );

  const alerts: { tone: Tone; title: string; body: React.ReactNode }[] = [];

  // Low balance
  if (survival.hasIncome && survival.salary > 0 && survival.salaryLeft / survival.salary < 0.3 && survival.daysRemaining > 0) {
    alerts.push({
      tone: "danger",
      title: "Low Balance Warning",
      body: <>Only <b>{formatCurrency(survival.salaryLeft, currency)}</b> left for {survival.daysRemaining} day{survival.daysRemaining === 1 ? "" : "s"}. Safe limit: {formatCurrency(survival.safeDaily, currency)}/day.</>,
    });
  }

  // EMI due soon
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  loans.forEach((l: any) => {
    if (Number(l.remaining_balance) <= 0) return;
    const day = Math.min(Math.max(1, l.due_day || 1), 28);
    let due = new Date(today.getFullYear(), today.getMonth(), day);
    if (due < today) due = new Date(today.getFullYear(), today.getMonth() + 1, day);
    const days = Math.round((due.getTime() - today.getTime()) / 86_400_000);
    if (days <= 5) {
      alerts.push({
        tone: "warn",
        title: "EMI Due Soon",
        body: <><b>{formatCurrency(Number(l.emi_amount), currency)}</b> ({l.loan_name}) due on {due.toLocaleDateString()}.</>,
      });
    }
  });

  // Category overspend
  const ym = `${now.getFullYear()}-${now.getMonth()}`;
  const spendByCat = new Map<string, number>();
  txs.filter(t => t.type === "expense").forEach(t => {
    const d = new Date(t.transaction_date);
    if (`${d.getFullYear()}-${d.getMonth()}` !== ym) return;
    const k = t.category_id ?? "uncategorized";
    spendByCat.set(k, (spendByCat.get(k) ?? 0) + t.amount);
  });
  budgets.forEach(b => {
    if (!b.category_id || b.monthly_limit <= 0) return;
    const spent = spendByCat.get(b.category_id) ?? 0;
    const pct = (spent / b.monthly_limit) * 100;
    if (pct >= 100) {
      const c = categories.find(x => x.id === b.category_id);
      alerts.push({
        tone: "warn",
        title: `${c?.name ?? "Category"} Overspent`,
        body: <>You've used <b>{Math.round(pct)}%</b> of your {formatCurrency(b.monthly_limit, currency)} budget.</>,
      });
    }
  });

  // Weekend risk
  const dow = now.getDay(); // Thu=4, Fri=5
  if ((dow === 4 || dow === 5) && survival.safeDaily > 0) {
    const weekendBudget = survival.safeDaily * 2;
    alerts.push({
      tone: "info",
      title: "Weekend Spending Risk",
      body: <>Keep spending under <b>{formatCurrency(weekendBudget, currency)}</b> this weekend to stay on track.</>,
    });
  }

  return (
    <div className="w-full overflow-x-hidden">
      <PageHeader title="⚠️ Danger Alerts" subtitle="Stay ahead of risks" />
      <div className="mx-auto w-full max-w-3xl space-y-3 px-4 py-5 sm:px-6 md:px-10">
        {alerts.length === 0 ? (
          <Card className="relative overflow-hidden p-5 text-center shadow-soft">
            <span className="absolute left-0 top-0 h-full w-1.5 bg-success" />
            <CheckCircle2 className="mx-auto h-8 w-8 text-success" />
            <p className="mt-2 font-display text-sm font-semibold">✅ All Clear</p>
            <p className="mt-1 text-xs text-muted-foreground">No financial risks detected. You're doing great this month.</p>
          </Card>
        ) : alerts.map((a, i) => <AlertCard key={i} {...a} />)}
      </div>
    </div>
  );
}
