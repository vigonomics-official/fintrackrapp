import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useMemo } from "react";
import { ArrowDown, ArrowUp, Wallet, TrendingUp, Sparkles, Landmark, Calendar, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, PieChart, Pie, Cell,
} from "recharts";
import { useTransactions, useCategories, useBudgets, monthKey, useProfile, useLoans } from "@/hooks/use-finance";
import { formatCurrency } from "@/lib/currency";
import { PageHeader } from "@/components/finance/PageHeader";

export const Route = createFileRoute("/_authenticated/dashboard")({ component: Dashboard });

function StatCard({ label, value, icon: Icon, trend, accent }: {
  label: string; value: string; icon: typeof Wallet; trend?: string; accent?: "primary" | "success" | "destructive" | "gold";
}) {
  const accents: Record<string, string> = {
    primary: "bg-gradient-primary text-primary-foreground",
    success: "bg-success text-success-foreground",
    destructive: "bg-destructive/90 text-destructive-foreground",
    gold: "bg-gradient-gold text-gold-foreground",
  };
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
      <Card className="overflow-hidden shadow-soft">
        <CardContent className="flex items-start justify-between gap-4 p-5">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
            <p className="mt-2 font-display text-2xl font-bold">{value}</p>
            {trend && <p className="mt-1 text-xs text-muted-foreground">{trend}</p>}
          </div>
          <div className={`flex h-11 w-11 items-center justify-center rounded-xl shadow-elegant ${accents[accent ?? "primary"]}`}>
            <Icon className="h-5 w-5" />
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function Dashboard() {
  const { data: profile } = useProfile();
  const { data: transactions = [] } = useTransactions();
  const { data: categories = [] } = useCategories();
  const month = monthKey();
  const { data: budgets = [] } = useBudgets(month);
  const currency = profile?.currency ?? "USD";

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
    return { income, expenses, balance: totalIncome - totalExpense, savings: income - expenses };
  }, [transactions]);

  const trend = useMemo(() => {
    const months: { key: string; label: string; income: number; expense: number }[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({
        key: `${d.getFullYear()}-${d.getMonth()}`,
        label: d.toLocaleString(undefined, { month: "short" }),
        income: 0, expense: 0,
      });
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

  return (
    <div>
      <PageHeader title={`Hi, ${profile?.name ?? "there"} 👋`} subtitle="Here's your financial snapshot." />

      <div className="space-y-6 px-6 py-6 md:px-10">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Total Balance" value={formatCurrency(stats.balance, currency)} icon={Wallet} accent="primary" />
          <StatCard label="This Month Income" value={formatCurrency(stats.income, currency)} icon={ArrowUp} accent="success" />
          <StatCard label="This Month Expenses" value={formatCurrency(stats.expenses, currency)} icon={ArrowDown} accent="destructive" />
          <StatCard label="Net Savings" value={formatCurrency(stats.savings, currency)} icon={TrendingUp} accent="gold" />
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2 shadow-soft">
            <CardHeader>
              <CardTitle className="font-display">Income vs Expenses</CardTitle>
            </CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trend}>
                  <defs>
                    <linearGradient id="g-in" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="oklch(0.62 0.13 165)" stopOpacity={0.6} />
                      <stop offset="100%" stopColor="oklch(0.62 0.13 165)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="g-out" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="oklch(0.78 0.12 85)" stopOpacity={0.6} />
                      <stop offset="100%" stopColor="oklch(0.78 0.12 85)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="label" stroke="oklch(0.55 0.03 160)" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="oklch(0.55 0.03 160)" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12 }}
                    formatter={(v: number) => formatCurrency(v, currency)}
                  />
                  <Area type="monotone" dataKey="income" stroke="oklch(0.5 0.12 165)" strokeWidth={2.5} fill="url(#g-in)" />
                  <Area type="monotone" dataKey="expense" stroke="oklch(0.65 0.13 50)" strokeWidth={2.5} fill="url(#g-out)" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="shadow-soft">
            <CardHeader>
              <CardTitle className="font-display">Spending breakdown</CardTitle>
            </CardHeader>
            <CardContent className="h-72">
              {pieData.length === 0 ? (
                <p className="flex h-full items-center justify-center text-sm text-muted-foreground">No expenses yet.</p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={85} paddingAngle={2}>
                      {pieData.map((d, i) => <Cell key={i} fill={d.color} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => formatCurrency(v, currency)} contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2 shadow-soft">
            <CardHeader>
              <CardTitle className="font-display">Recent transactions</CardTitle>
            </CardHeader>
            <CardContent>
              {recent.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">No transactions yet. Tap the + button to add one.</p>
              ) : (
                <ul className="divide-y">
                  {recent.map((t) => {
                    const c = categories.find(x => x.id === t.category_id);
                    return (
                      <li key={t.id} className="flex items-center justify-between gap-3 py-3">
                        <div className="flex items-center gap-3">
                          <span className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ background: (c?.color ?? "#94a3b8") + "22", color: c?.color ?? "#64748b" }}>
                            {t.type === "income" ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
                          </span>
                          <div>
                            <p className="text-sm font-medium">{c?.name ?? "Uncategorized"}</p>
                            <p className="text-xs text-muted-foreground">{new Date(t.transaction_date).toLocaleDateString()} · {t.payment_method.replace("_", " ")}</p>
                          </div>
                        </div>
                        <p className={`font-display text-sm font-semibold ${t.type === "income" ? "text-success" : "text-foreground"}`}>
                          {t.type === "income" ? "+" : "-"}{formatCurrency(t.amount, currency)}
                        </p>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-soft">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-display">
                <Sparkles className="h-4 w-4 text-gold" /> Budgets
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {budgets.length === 0 ? (
                <p className="text-sm text-muted-foreground">No budgets set yet. Create one in Budgets.</p>
              ) : budgets.map((b) => {
                const c = categories.find(x => x.id === b.category_id);
                const spent = transactions.filter(t => t.type === "expense" && t.category_id === b.category_id && t.transaction_date.startsWith(month.slice(0, 7))).reduce((s, t) => s + t.amount, 0);
                const pct = Math.min(100, (spent / b.monthly_limit) * 100);
                return (
                  <div key={b.id}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{c?.name ?? "Category"}</span>
                      <span className="text-muted-foreground">{formatCurrency(spent, currency)} / {formatCurrency(b.monthly_limit, currency)}</span>
                    </div>
                    <Progress value={pct} className="mt-2" />
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
