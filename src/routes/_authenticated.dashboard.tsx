import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useMemo } from "react";
import { Sparkles, Calendar, ChevronRight, AlertTriangle, Shield, TrendingUp, Wallet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ResponsiveContainer, AreaChart, Area, XAxis, Tooltip } from "recharts";
import { useTransactions, useCategories, useBudgets, monthKey, useProfile, useLoans } from "@/hooks/use-finance";
import { formatCurrency } from "@/lib/currency";
import { PageHeader } from "@/components/finance/PageHeader";

export const Route = createFileRoute("/_authenticated/dashboard")({ component: Dashboard });

const SIMPLE_CATEGORIES = ["Food", "Travel", "EMI", "Bills", "Shopping", "Others"];
function simplifyCategory(name?: string | null) {
  if (!name) return "Others";
  const n = name.toLowerCase();
  if (/food|dining|swiggy|zomato|restaurant|grocer/.test(n)) return "Food";
  if (/transport|uber|ola|fuel|travel|cab|metro/.test(n)) return "Travel";
  if (/emi|loan/.test(n)) return "EMI";
  if (/bill|utilit|recharge|electric|internet|mobile/.test(n)) return "Bills";
  if (/shop|amazon|flipkart|myntra/.test(n)) return "Shopping";
  return "Others";
}

function Dashboard() {
  const { data: profile } = useProfile();
  const { data: transactions = [] } = useTransactions();
  const { data: categories = [] } = useCategories();
  const month = monthKey();
  const { data: budgets = [] } = useBudgets(month);
  const { data: loans = [] } = useLoans();
  const currency = profile?.currency ?? "INR";

  const now = new Date();

  // Salary survival math
  const survival = useMemo(() => {
    const monthTx = transactions.filter((t) => {
      const d = new Date(t.transaction_date);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
    const incomeTx = monthTx.filter(t => t.type === "income").sort((a, b) =>
      new Date(a.transaction_date).getTime() - new Date(b.transaction_date).getTime());
    const salary = incomeTx.reduce((s, t) => s + t.amount, 0);
    const lastSalaryDate = incomeTx.length ? new Date(incomeTx[incomeTx.length - 1].transaction_date) : new Date(now.getFullYear(), now.getMonth(), 1);
    const expensesSinceSalary = transactions
      .filter(t => t.type === "expense" && new Date(t.transaction_date) >= lastSalaryDate)
      .reduce((s, t) => s + t.amount, 0);
    const salaryLeft = Math.max(0, salary - expensesSinceSalary);

    // Days until next salary: assume same day next month
    const nextSalary = new Date(lastSalaryDate);
    nextSalary.setMonth(nextSalary.getMonth() + 1);
    const days = Math.max(1, Math.ceil((nextSalary.getTime() - now.getTime()) / 86_400_000));
    const safeDaily = salaryLeft / days;

    // Today's spend
    const todayKey = now.toISOString().slice(0, 10);
    const spentToday = transactions
      .filter(t => t.type === "expense" && t.transaction_date.slice(0, 10) === todayKey)
      .reduce((s, t) => s + t.amount, 0);
    const remainingToday = Math.max(0, safeDaily - spentToday);

    // EMI pressure
    const monthlyEmi = loans.reduce((s, l) => s + (l.remaining_balance > 0 ? l.emi_amount : 0), 0);
    const emiRatio = salary > 0 ? (monthlyEmi / salary) * 100 : 0;
    const emiLevel: "Low" | "Medium" | "High" = emiRatio < 20 ? "Low" : emiRatio < 40 ? "Medium" : "High";

    // Survival score: salary buffer (50) + emi pressure (30) + spending pace (20)
    const buffer = salary > 0 ? Math.min(50, (salaryLeft / salary) * 50) : 25;
    const emiScore = Math.max(0, 30 - emiRatio * 0.5);
    const pace = spentToday <= safeDaily ? 20 : Math.max(0, 20 - ((spentToday - safeDaily) / Math.max(1, safeDaily)) * 20);
    const score = Math.round(buffer + emiScore + pace);

    const mood: "safe" | "careful" | "danger" =
      score >= 70 && spentToday <= safeDaily ? "safe" :
      score >= 45 ? "careful" : "danger";

    // Upcoming EMI
    const upcoming = [...loans].filter(l => l.remaining_balance > 0).map(l => {
      const d = new Date(now.getFullYear(), now.getMonth(), Math.min(l.due_day, 28));
      if (d < now) d.setMonth(d.getMonth() + 1);
      return { loan: l, due: d };
    }).sort((a, b) => a.due.getTime() - b.due.getTime())[0];

    return { salary, salaryLeft, days, safeDaily, spentToday, remainingToday, monthlyEmi, emiRatio, emiLevel, score, mood, upcoming, lastSalaryDate, nextSalary };
  }, [transactions, loans, now.getDate()]);

  // Danger alerts + smart insight inputs
  const insightData = useMemo(() => {
    const monthExpenses = transactions.filter(t => {
      const d = new Date(t.transaction_date);
      return t.type === "expense" && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
    const byCat = new Map<string, number>();
    monthExpenses.forEach(t => {
      const c = categories.find(c => c.id === t.category_id)?.name;
      const k = simplifyCategory(c);
      byCat.set(k, (byCat.get(k) ?? 0) + t.amount);
    });
    const total = [...byCat.values()].reduce((a, b) => a + b, 0);
    const topCat = [...byCat.entries()].sort((a, b) => b[1] - a[1])[0];

    // Last 7 days spend & weekend pattern
    const last7 = transactions.filter(t => {
      if (t.type !== "expense") return false;
      const d = new Date(t.transaction_date);
      return (now.getTime() - d.getTime()) / 86_400_000 <= 7;
    });
    const weekendSpend = last7.filter(t => {
      const day = new Date(t.transaction_date).getDay();
      return day === 0 || day === 6;
    }).reduce((s, t) => s + t.amount, 0);
    const weekdaySpend = last7.reduce((s, t) => s + t.amount, 0) - weekendSpend;
    const weekendRisk = weekendSpend > weekdaySpend * 0.5 && weekendSpend > survival.safeDaily * 2;

    return { byCat, total, topCat, weekendSpend, weekendRisk };
  }, [transactions, categories, survival.safeDaily]);

  const alerts = useMemo(() => {
    const list: { icon: string; text: string }[] = [];
    if (survival.salaryLeft < survival.safeDaily * survival.days * 0.5 && survival.days > 3) {
      list.push({ icon: "⚠", text: `Only ${formatCurrency(survival.salaryLeft, currency)} left for ${survival.days} days` });
    }
    if (survival.upcoming) {
      const daysToEmi = Math.ceil((survival.upcoming.due.getTime() - now.getTime()) / 86_400_000);
      if (daysToEmi <= 5) list.push({ icon: "⚠", text: `EMI due in ${daysToEmi} day${daysToEmi === 1 ? "" : "s"} · ${formatCurrency(survival.upcoming.loan.emi_amount, currency)}` });
    }
    if (survival.spentToday > survival.safeDaily && survival.safeDaily > 0) {
      list.push({ icon: "⚠", text: "You've crossed today's safe spend limit" });
    }
    const day = now.getDay();
    if (insightData.weekendRisk && (day >= 4 || day === 0)) {
      list.push({ icon: "🛍", text: "High spending risk expected this weekend" });
    }
    insightData.byCat.forEach((v, k) => {
      if (insightData.total > 0 && v / insightData.total > 0.4) list.push({ icon: "⚠", text: `${k} spending above safe limit` });
    });
    return list.slice(0, 4);
  }, [survival, insightData, currency]);


  // Mini trend — last 7 days expense
  const trend = useMemo(() => {
    const days: { label: string; spend: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const spend = transactions.filter(t => t.type === "expense" && t.transaction_date.slice(0, 10) === key).reduce((s, t) => s + t.amount, 0);
      days.push({ label: d.toLocaleDateString(undefined, { weekday: "short" }), spend });
    }
    return days;
  }, [transactions]);

  const recent = useMemo(() => transactions.slice(0, 6), [transactions]);

  const greeting = (() => {
    const h = new Date().getHours();
    return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
  })();

  const moodMeta = {
    safe: { dot: "🟢", label: "Safe", cls: "bg-success/10 text-success" },
    careful: { dot: "🟡", label: "Careful", cls: "bg-gold/15 text-gold-foreground" },
    danger: { dot: "🔴", label: "Danger Zone", cls: "bg-destructive/10 text-destructive" },
  }[survival.mood];

  const emiTone = survival.emiLevel === "Low" ? "🟢" : survival.emiLevel === "Medium" ? "🟡" : "🔴";

  return (
    <div>
      <PageHeader title={`${greeting}, ${(profile?.name ?? "there").split(" ")[0]}`} subtitle="Your salary survival snapshot" />

      <div className="space-y-5 px-5 py-5 md:space-y-6 md:px-10 md:py-7">
        {/* 1. Salary Survival Card */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="overflow-hidden border-0 bg-gradient-hero text-primary-foreground shadow-elegant">
            <CardContent className="relative p-6 md:p-7">
              <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-gold/20 blur-3xl" />
              <div className="relative">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium uppercase tracking-[0.18em] opacity-70">Salary Left</p>
                    <p className="mt-2 font-display text-3xl font-bold leading-none md:text-4xl tabular-nums">{formatCurrency(survival.salaryLeft, currency)}</p>
                    <p className="mt-2 text-xs opacity-90">{survival.days} days until salary · Safe spend {formatCurrency(survival.safeDaily, currency)}/day</p>
                  </div>
                  <span className={`shrink-0 rounded-full bg-white/15 px-3 py-1 text-[11px] font-medium backdrop-blur`}>
                    {moodMeta.dot} {moodMeta.label}
                  </span>
                </div>

                <div className="mt-5 grid grid-cols-3 gap-2 text-center">
                  <SurvivalStat label="Days left" value={String(survival.days)} />
                  <SurvivalStat label="EMI pressure" value={`${emiTone} ${survival.emiLevel}`} />
                  <SurvivalStat label="Survival" value={`${survival.score}%`} />
                </div>
                <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/20">
                  <div className="h-full bg-gold transition-all" style={{ width: `${Math.min(100, Math.max(0, survival.score))}%` }} />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* 2. Today's Safe Spending */}
        <Card className="shadow-soft">
          <CardContent className="p-4 md:p-5">
            <div className="flex items-baseline justify-between">
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Today's safe limit</p>
                <p className="mt-1 font-display text-2xl font-bold tabular-nums">{formatCurrency(survival.remainingToday, currency)}</p>
                <p className="text-[11px] text-muted-foreground">remaining today</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Spent today</p>
                <p className="font-display text-base font-semibold tabular-nums">{formatCurrency(survival.spentToday, currency)}</p>
              </div>
            </div>
            <Progress
              value={survival.safeDaily > 0 ? Math.min(100, (survival.spentToday / survival.safeDaily) * 100) : 0}
              className="mt-3 h-2"
            />
            <p className="mt-2 text-[11px] text-muted-foreground">
              {survival.spentToday <= survival.safeDaily
                ? "You're on track for today. Keep it calm."
                : "You've crossed today's limit — pause non-essential spends."}
            </p>
          </CardContent>
        </Card>

        {/* 3. Salary Countdown */}
        <Card className="shadow-soft">
          <CardContent className="flex items-center gap-4 p-4 md:p-5">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Calendar className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Next salary in</p>
              <p className="font-display text-lg font-bold leading-tight">{survival.days} day{survival.days === 1 ? "" : "s"}</p>
              <p className="text-[11px] text-muted-foreground">
                Around {survival.nextSalary.toLocaleDateString(undefined, { day: "numeric", month: "short" })} · stretch {formatCurrency(survival.salaryLeft, currency)} till then
              </p>
            </div>
          </CardContent>
        </Card>

        {/* 4. Danger Alerts */}
        {alerts.length > 0 && (
          <Card className="border-destructive/20 bg-destructive/5 shadow-soft">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 font-display text-base">
                <AlertTriangle className="h-4 w-4 text-destructive" /> Danger alerts
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {alerts.map((a, i) => (
                <div key={i} className="flex items-start gap-2 text-sm">
                  <span aria-hidden>{a.icon}</span>
                  <span className="text-foreground/90">{a.text}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* 5. AI Insight */}
        <Card className="shadow-soft">
          <CardContent className="flex items-start gap-3 p-4 md:p-5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gold/15 text-gold-foreground">
              <Sparkles className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">AI insight</p>
              <p className="mt-1 text-sm text-foreground/90">
                {(() => {
                  const top = insightData.topCat;
                  if (top && top[1] > survival.safeDaily * 3) {
                    const save = Math.round(top[1] * 0.25);
                    return `You spent ${formatCurrency(top[1], currency)} on ${top[0]} this month. Cutting back ~25% could save you ${formatCurrency(save, currency)}.`;
                  }
                  if (survival.mood === "safe") {
                    return `Nicely paced. Stay under ${formatCurrency(survival.safeDaily, currency)}/day and you'll glide to next salary.`;
                  }
                  if (survival.mood === "careful") {
                    return `You're slightly ahead of pace. Skipping 2 food-delivery orders this week can ease the squeeze.`;
                  }
                  return `Stretched thin. Pause non-essentials and protect EMIs + bills for the next ${survival.days} day${survival.days === 1 ? "" : "s"}.`;
                })()}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* 6. Smart Transactions */}
        <Card className="shadow-soft">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="flex items-center gap-2 font-display text-base">
              <Wallet className="h-4 w-4 text-primary" /> Smart transactions
            </CardTitle>
            <Link to="/transactions" className="text-xs font-medium text-primary hover:underline">View all</Link>
          </CardHeader>
          <CardContent className="space-y-1">
            {recent.length === 0 ? (
              <p className="py-2 text-sm text-muted-foreground">No transactions yet.</p>
            ) : recent.map(t => {
              const catName = categories.find(c => c.id === t.category_id)?.name;
              const simple = simplifyCategory(catName);
              const isIncome = t.type === "income";
              const title = isIncome ? "Salary Credited" : (t.notes?.split(/\s|·/)[0] || catName || simple);
              const breach = !isIncome && simple === "Food" && t.amount > survival.safeDaily * 0.5 && survival.safeDaily > 0;
              return (
                <div key={t.id} className="flex items-center justify-between gap-3 rounded-lg px-2 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{title}</p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {isIncome ? "Income" : simple}{breach ? " · Above safe limit ⚠" : ""}
                    </p>
                  </div>
                  <p className={`shrink-0 font-display text-sm font-semibold tabular-nums ${isIncome ? "text-success" : ""}`}>
                    {isIncome ? "+" : ""}{formatCurrency(t.amount, currency)}
                  </p>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* 7. Mini Spending Trend */}
        <Card className="shadow-soft">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="flex items-center gap-2 font-display text-base">
              <TrendingUp className="h-4 w-4 text-primary" /> Spending trend
            </CardTitle>
            <span className="text-[11px] text-muted-foreground">Last 7 days</span>
          </CardHeader>
          <CardContent className="h-32 px-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend} margin={{ top: 5, right: 6, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="g-spend" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="oklch(0.55 0.12 180)" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="oklch(0.55 0.12 180)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="label" stroke="oklch(0.55 0.03 160)" fontSize={10} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12 }} formatter={(v: number) => formatCurrency(v, currency)} />
                <Area type="monotone" dataKey="spend" stroke="oklch(0.5 0.12 180)" strokeWidth={2} fill="url(#g-spend)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* 8. Budgets */}
        <Card className="shadow-soft">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="flex items-center gap-2 font-display text-base">
              <Shield className="h-4 w-4 text-primary" /> Budgets
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
                    <span className="font-medium">{simplifyCategory(c?.name)}</span>
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
  );
}

function SurvivalStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/10 px-2 py-2 backdrop-blur">
      <p className="text-[10px] uppercase tracking-wider opacity-75">{label}</p>
      <p className="mt-0.5 font-display text-sm font-semibold tabular-nums">{value}</p>
    </div>
  );
}
