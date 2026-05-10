import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useMemo } from "react";
import { ArrowDown, ArrowUp, TrendingUp, Sparkles, Landmark, Calendar, ChevronRight, Activity, Target } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, PieChart, Pie, Cell,
} from "recharts";
import { useTransactions, useCategories, useBudgets, monthKey, useProfile, useLoans } from "@/hooks/use-finance";
import { formatCurrency } from "@/lib/currency";
import { PageHeader } from "@/components/finance/PageHeader";

export const Route = createFileRoute("/_authenticated/dashboard")({ component: Dashboard });

function Dashboard() {
  const { data: profile } = useProfile();
  const { data: transactions = [] } = useTransactions();
  const { data: categories = [] } = useCategories();
  const month = monthKey();
  const { data: budgets = [] } = useBudgets(month);
  const { data: loans = [] } = useLoans();
  const currency = profile?.currency ?? "USD";

  const loanStats = useMemo(() => {
    const debt = loans.reduce((s, l) => s + l.remaining_balance, 0);
    const monthlyEmi = loans.reduce((s, l) => s + (l.remaining_balance > 0 ? l.emi_amount : 0), 0);
    const totalBorrowed = loans.reduce((s, l) => s + l.total_amount, 0);
    const pct = totalBorrowed > 0 ? ((totalBorrowed - debt) / totalBorrowed) * 100 : 0;
    const active = loans.filter(l => l.remaining_balance > 0).length;
    const upcoming = [...loans]
      .filter(l => l.remaining_balance > 0)
      .map(l => {
        const today = new Date();
        const d = new Date(today.getFullYear(), today.getMonth(), Math.min(l.due_day, 28));
        if (d < today) d.setMonth(d.getMonth() + 1);
        return { loan: l, due: d };
      })
      .sort((a, b) => a.due.getTime() - b.due.getTime())[0];
    return { debt, monthlyEmi, pct, active, upcoming };
  }, [loans]);

  const stats = useMemo(() => {
    const now = new Date();
    const monthTx = transactions.filter((t) => {
      const d = new Date(t.transaction_date);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
    const income = monthTx.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);
    const expenses = monthTx.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0);
    const totalIncome = transactions.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);
    const totalExpense = transactions.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0);
    const balance = totalIncome - totalExpense;
    return { income, expenses, balance, savings: income - expenses, savingsRate: income > 0 ? ((income - expenses) / income) * 100 : 0 };
  }, [transactions]);

  const netWorth = stats.balance - loanStats.debt;

  // Health score: savings rate (0-50), debt ratio (0-30), budget adherence (0-20)
  const health = useMemo(() => {
    const sr = Math.max(0, Math.min(50, stats.savingsRate / 2));
    const dti = stats.income > 0 ? (loanStats.monthlyEmi / stats.income) * 100 : 0;
    const dtiScore = Math.max(0, 30 - dti * 0.6);
    const overBudget = budgets.filter(b => {
      const spent = transactions.filter(t => t.type === "expense" && t.category_id === b.category_id && t.transaction_date.startsWith(month.slice(0, 7))).reduce((s, t) => s + t.amount, 0);
      return spent > b.monthly_limit;
    }).length;
    const budgetScore = budgets.length === 0 ? 10 : Math.max(0, 20 - overBudget * 5);
    return Math.round(sr + dtiScore + budgetScore);
  }, [stats, loanStats, budgets, transactions, month]);

  const trend = useMemo(() => {
    const months: { key: string; label: string; income: number; expense: number }[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({ key: `${d.getFullYear()}-${d.getMonth()}`, label: d.toLocaleString(undefined, { month: "short" }), income: 0, expense: 0 });
    }
    transactions.forEach((t) => {
      const d = new Date(t.transaction_date);
      const k = `${d.getFullYear()}-${d.getMonth()}`;
      const m = months.find((x) => x.key === k);
      if (!m) return;
      if (t.type === "income") m.income += t.amount;
      if (t.type === "expense") m.expense += t.amount;
    });
    return months;
  }, [transactions]);

  const pieData = useMemo(() => {
    const map = new Map<string, { name: string; value: number; color: string }>();
    transactions.filter(t => t.type === "expense").forEach((t) => {
      const c = categories.find(c => c.id === t.category_id);
      const name = c?.name ?? "Uncategorized";
      const color = c?.color ?? "#94a3b8";
      const cur = map.get(name) ?? { name, value: 0, color };
      cur.value += t.amount;
      map.set(name, cur);
    });
    return [...map.values()].sort((a, b) => b.value - a.value).slice(0, 6);
  }, [transactions, categories]);

  const recent = transactions.slice(0, 6);
  const greeting = (() => {
    const h = new Date().getHours();
    return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
  })();

  return (
    <div>
      <PageHeader title={`${greeting}, ${(profile?.name ?? "there").split(" ")[0]}`} subtitle="Here's your financial snapshot" />

      <div className="space-y-5 px-5 py-5 md:space-y-6 md:px-10 md:py-7">
        {/* Net worth hero */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="overflow-hidden border-0 bg-gradient-hero text-primary-foreground shadow-elegant">
            <CardContent className="relative p-6 md:p-7">
              <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-gold/20 blur-3xl" />
              <div className="relative flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-[11px] font-medium uppercase tracking-[0.18em] opacity-70">Net Worth</p>
                  <p className="mt-2 font-display text-3xl font-bold leading-none md:text-4xl">{formatCurrency(netWorth, currency)}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs opacity-90">
                    <span>Assets {formatCurrency(stats.balance, currency)}</span>
                    {loanStats.debt > 0 && <span>Debt {formatCurrency(loanStats.debt, currency)}</span>}
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end">
                  <span className="rounded-full bg-white/15 px-3 py-1 text-[11px] font-medium backdrop-blur">
                    <Activity className="mr-1 inline h-3 w-3" /> Health {health}
                  </span>
                  <div className="mt-2 h-1.5 w-20 overflow-hidden rounded-full bg-white/20">
                    <div className="h-full bg-gold" style={{ width: `${Math.min(100, health)}%` }} />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Income / Expenses / Savings — compact mobile grid */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <MiniStat label="Income" value={formatCurrency(stats.income, currency)} icon={ArrowUp} tone="success" />
          <MiniStat label="Expenses" value={formatCurrency(stats.expenses, currency)} icon={ArrowDown} tone="destructive" />
          <MiniStat label="Saved" value={formatCurrency(stats.savings, currency)} sub={`${stats.savingsRate.toFixed(0)}% rate`} icon={TrendingUp} tone="gold" className="col-span-2 md:col-span-1" />
        </div>

        {/* Loans strip */}
        {loans.length > 0 && (
          <Link to="/loans" className="block">
            <Card className="overflow-hidden shadow-soft transition-shadow hover:shadow-elegant">
              <CardContent className="flex items-center gap-4 p-4 md:p-5">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Landmark className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">Outstanding debt</p>
                    <p className="text-xs text-muted-foreground">{loanStats.pct.toFixed(0)}% paid</p>
                  </div>
                  <p className="font-display text-lg font-bold leading-tight">{formatCurrency(loanStats.debt, currency)}</p>
                  <Progress value={loanStats.pct} className="mt-2 h-1.5" />
                  <div className="mt-1.5 flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>EMI {formatCurrency(loanStats.monthlyEmi, currency)}/mo</span>
                    {loanStats.upcoming && (
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {loanStats.upcoming.due.toLocaleDateString(undefined, { day: "numeric", month: "short" })}
                      </span>
                    )}
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </CardContent>
            </Card>
          </Link>
        )}

        {/* Charts */}
        <div className="grid gap-5 lg:grid-cols-3">
          <Card className="shadow-soft lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="font-display text-base">Income vs Expenses</CardTitle>
            </CardHeader>
            <CardContent className="h-60 px-2 md:h-72 md:px-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trend} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="g-in" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="oklch(0.62 0.13 165)" stopOpacity={0.6} />
                      <stop offset="100%" stopColor="oklch(0.62 0.13 165)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="g-out" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="oklch(0.65 0.13 50)" stopOpacity={0.5} />
                      <stop offset="100%" stopColor="oklch(0.65 0.13 50)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="label" stroke="oklch(0.55 0.03 160)" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="oklch(0.55 0.03 160)" fontSize={11} tickLine={false} axisLine={false} width={40} />
                  <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12 }} formatter={(v: number) => formatCurrency(v, currency)} />
                  <Area type="monotone" dataKey="income" stroke="oklch(0.5 0.12 165)" strokeWidth={2.5} fill="url(#g-in)" />
                  <Area type="monotone" dataKey="expense" stroke="oklch(0.65 0.13 50)" strokeWidth={2.5} fill="url(#g-out)" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="shadow-soft">
            <CardHeader className="pb-2">
              <CardTitle className="font-display text-base">Top spending</CardTitle>
            </CardHeader>
            <CardContent className="h-60 md:h-72">
              {pieData.length === 0 ? (
                <p className="flex h-full items-center justify-center text-sm text-muted-foreground">No expenses yet.</p>
              ) : (
                <div className="flex h-full items-center gap-3">
                  <div className="h-full flex-1">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={42} outerRadius={70} paddingAngle={2}>
                          {pieData.map((d, i) => <Cell key={i} fill={d.color} />)}
                        </Pie>
                        <Tooltip formatter={(v: number) => formatCurrency(v, currency)} contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <ul className="flex-1 space-y-1.5 text-xs">
                    {pieData.slice(0, 5).map((d) => (
                      <li key={d.name} className="flex items-center gap-2">
                        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: d.color }} />
                        <span className="truncate">{d.name}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Goals progress + Budgets */}
        <div className="grid gap-5 lg:grid-cols-3">
          <Card className="shadow-soft lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="flex items-center gap-2 font-display text-base">
                <Target className="h-4 w-4 text-primary" /> Financial freedom progress
              </CardTitle>
              <Link to="/goals" className="text-xs font-medium text-primary hover:underline">View goals</Link>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex items-baseline justify-between">
                  <p className="text-xs text-muted-foreground">Savings rate</p>
                  <p className="font-display text-sm font-semibold tabular-nums">{stats.savingsRate.toFixed(0)}%</p>
                </div>
                <Progress value={Math.min(100, Math.max(0, stats.savingsRate))} className="mt-1.5 h-2" />
                <p className="mt-1 text-[11px] text-muted-foreground">Target ≥ 30% for freedom track</p>
              </div>
              <div>
                <div className="flex items-baseline justify-between">
                  <p className="text-xs text-muted-foreground">Health score</p>
                  <p className="font-display text-sm font-semibold tabular-nums">{health}/100</p>
                </div>
                <Progress value={health} className="mt-1.5 h-2" />
              </div>
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="flex items-center gap-1.5 text-xs font-medium">
                  <Sparkles className="h-3.5 w-3.5 text-gold" /> AI insight
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {stats.savingsRate >= 30
                    ? "Excellent — you're on the financial freedom track. Consider deploying surplus into investments."
                    : stats.savingsRate >= 15
                      ? "Solid start. Trim 1–2 discretionary categories to push savings rate above 30%."
                      : "Cashflow is tight this month. Review top spending categories and set a budget."}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-soft">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="flex items-center gap-2 font-display text-base">
                <Sparkles className="h-4 w-4 text-gold" /> Budgets
              </CardTitle>
              <Link to="/budgets" className="text-xs font-medium text-primary hover:underline">Manage</Link>
            </CardHeader>
            <CardContent className="space-y-3.5">
              {budgets.length === 0 ? (
                <p className="text-sm text-muted-foreground">No budgets set yet.</p>
              ) : budgets.slice(0, 5).map((b) => {
                const c = categories.find(x => x.id === b.category_id);
                const spent = transactions.filter(t => t.type === "expense" && t.category_id === b.category_id && t.transaction_date.startsWith(month.slice(0, 7))).reduce((s, t) => s + t.amount, 0);
                const pct = Math.min(100, (spent / b.monthly_limit) * 100);
                const over = spent > b.monthly_limit;
                return (
                  <div key={b.id}>
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium">{c?.name ?? "Category"}</span>
                      <span className={over ? "text-destructive" : "text-muted-foreground"}>
                        {formatCurrency(spent, currency)} / {formatCurrency(b.monthly_limit, currency)}
                      </span>
                    </div>
                    <Progress value={pct} className="mt-1.5 h-1.5" />
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function MiniStat({ label, value, sub, icon: Icon, tone, className }: {
  label: string; value: string; sub?: string; icon: typeof ArrowUp;
  tone: "success" | "destructive" | "gold" | "primary"; className?: string;
}) {
  const tones: Record<string, string> = {
    success: "bg-success/10 text-success",
    destructive: "bg-destructive/10 text-destructive",
    gold: "bg-gold/15 text-gold-foreground",
    primary: "bg-primary/10 text-primary",
  };
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={className}>
      <Card className="shadow-soft">
        <CardContent className="p-3.5 md:p-4">
          <div className="flex items-center gap-2">
            <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${tones[tone]}`}>
              <Icon className="h-3.5 w-3.5" />
            </span>
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
          </div>
          <p className="mt-2 font-display text-lg font-bold tabular-nums md:text-xl">{value}</p>
          {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
        </CardContent>
      </Card>
    </motion.div>
  );
}
