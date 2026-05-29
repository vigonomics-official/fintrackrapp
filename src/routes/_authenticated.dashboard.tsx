import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import { Sparkles, Calendar, AlertTriangle, Shield, Wallet, ShoppingBag, ArrowRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { useTransactions, useCategories, useBudgets, monthKey, useProfile, useLoans } from "@/hooks/use-finance";
import { formatCurrency } from "@/lib/currency";
import { PageHeader } from "@/components/finance/PageHeader";

export const Route = createFileRoute("/_authenticated/dashboard")({ component: Dashboard });

function simplifyCategory(name?: string | null) {
  if (!name) return "Others";
  const n = name.toLowerCase();
  if (/food|dining|swiggy|zomato|restaurant|grocer/.test(n)) return "Food";
  if (/transport|uber|ola|fuel|travel|cab|metro/.test(n)) return "Travel";
  if (/emi|loan/.test(n)) return "EMI";
  if (/bill|utilit|recharge|electric|internet|mobile/.test(n)) return "Bills";
  if (/shop|amazon|flipkart|myntra/.test(n)) return "Shopping";
  if (/rent|housing/.test(n)) return "Rent";
  return "Others";
}

const ESSENTIAL = new Set(["EMI", "Bills", "Rent"]);

function Dashboard() {
  const { data: profile } = useProfile();
  const { data: transactions = [] } = useTransactions();
  const { data: categories = [] } = useCategories();
  const month = monthKey();
  const { data: budgets = [] } = useBudgets(month);
  const { data: loans = [] } = useLoans();
  const currency = profile?.currency ?? "INR";

  const now = new Date();

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

    const nextSalary = new Date(lastSalaryDate);
    nextSalary.setMonth(nextSalary.getMonth() + 1);
    const days = Math.max(1, Math.ceil((nextSalary.getTime() - now.getTime()) / 86_400_000));
    const safeDaily = salaryLeft / days;
    const stretchDaily = safeDaily * 0.85;

    const todayKey = now.toISOString().slice(0, 10);
    const spentToday = transactions
      .filter(t => t.type === "expense" && t.transaction_date.slice(0, 10) === todayKey)
      .reduce((s, t) => s + t.amount, 0);
    const remainingToday = Math.max(0, safeDaily - spentToday);

    const monthlyEmi = loans.reduce((s, l) => s + (l.remaining_balance > 0 ? l.emi_amount : 0), 0);
    const emiRatio = salary > 0 ? (monthlyEmi / salary) * 100 : 0;
    const emiLevel: "Low" | "Medium" | "High" = emiRatio < 20 ? "Low" : emiRatio < 40 ? "Medium" : "High";

    const buffer = salary > 0 ? Math.min(50, (salaryLeft / salary) * 50) : 25;
    const emiScore = Math.max(0, 30 - emiRatio * 0.5);
    const pace = spentToday <= safeDaily ? 20 : Math.max(0, 20 - ((spentToday - safeDaily) / Math.max(1, safeDaily)) * 20);
    const score = Math.round(buffer + emiScore + pace);

    const mood: "safe" | "careful" | "danger" =
      score >= 70 && spentToday <= safeDaily ? "safe" :
      score >= 45 ? "careful" : "danger";

    const upcoming = [...loans].filter(l => l.remaining_balance > 0).map(l => {
      const d = new Date(now.getFullYear(), now.getMonth(), Math.min(l.due_day, 28));
      if (d < now) d.setMonth(d.getMonth() + 1);
      return { loan: l, due: d };
    }).sort((a, b) => a.due.getTime() - b.due.getTime())[0];

    return { salary, salaryLeft, days, safeDaily, stretchDaily, spentToday, remainingToday, monthlyEmi, emiRatio, emiLevel, score, mood, upcoming, lastSalaryDate, nextSalary };
  }, [transactions, loans, now.getDate()]);

  // Per-category spending (this month vs last month) for risks + insights
  const catStats = useMemo(() => {
    const thisM = new Map<string, number>();
    const lastM = new Map<string, number>();
    const last = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    transactions.forEach(t => {
      if (t.type !== "expense") return;
      const d = new Date(t.transaction_date);
      const cat = simplifyCategory(categories.find(c => c.id === t.category_id)?.name);
      if (d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()) {
        thisM.set(cat, (thisM.get(cat) ?? 0) + t.amount);
      } else if (d.getMonth() === last.getMonth() && d.getFullYear() === last.getFullYear()) {
        lastM.set(cat, (lastM.get(cat) ?? 0) + t.amount);
      }
    });
    const topCat = [...thisM.entries()].sort((a, b) => b[1] - a[1])[0];
    return { thisM, lastM, topCat };
  }, [transactions, categories]);

  // Spending risks — merged per category (budget overage + MoM increase combined)
  const risks = useMemo(() => {
    type Risk = { tone: "warn" | "info" | "danger"; title: string; main: string; reason?: string };
    const byCat = new Map<string, Risk>();

    // Budget overages first (highest priority)
    budgets.forEach(b => {
      const c = categories.find(x => x.id === b.category_id);
      const cat = simplifyCategory(c?.name);
      const spent = catStats.thisM.get(cat) ?? 0;
      if (spent > b.monthly_limit) {
        byCat.set(cat, {
          tone: "danger",
          title: `${cat} Budget Alert`,
          main: `Overspent by ${formatCurrency(spent - b.monthly_limit, currency)}`,
        });
      }
    });

    // Month-over-month jumps — attach as reason, or standalone
    catStats.thisM.forEach((amt, cat) => {
      const prev = catStats.lastM.get(cat) ?? 0;
      if (prev > 0 && amt > prev * 1.2) {
        const delta = amt - prev;
        const reason = `${cat} spending increased by ${formatCurrency(delta, currency)} vs last month`;
        const existing = byCat.get(cat);
        if (existing) {
          existing.reason = `Main reason: ${cat.toLowerCase()} spending up ${formatCurrency(delta, currency)} this month.`;
        } else {
          byCat.set(cat, { tone: "warn", title: `${cat} Spending Up`, main: reason });
        }
      }
    });

    const list: Risk[] = [...byCat.values()];

    if (survival.upcoming) {
      const d = Math.ceil((survival.upcoming.due.getTime() - now.getTime()) / 86_400_000);
      if (d <= 5) list.push({ tone: "warn", title: "EMI Due Soon", main: `${formatCurrency(survival.upcoming.loan.emi_amount, currency)} due in ${d} day${d === 1 ? "" : "s"}` });
    }

    if (list.length === 0 && survival.safeDaily > 0) {
      list.push({ tone: "info", title: "Safe Spending Limit", main: `${formatCurrency(survival.safeDaily, currency)}/day to stay on track` });
    }

    return list.slice(0, 5);
  }, [budgets, catStats, categories, survival, currency]);

  // AI actionable insight — practical recommendations
  const insight = useMemo(() => {
    const top = catStats.topCat;
    if (top && top[1] > 0) {
      const [name, monthSpend] = top;
      if (name === "Food") {
        const orderCost = Math.max(250, Math.round((monthSpend / 30) * 0.6));
        const save = orderCost * 8; // ~2 orders/week
        return {
          title: "Save Opportunity",
          action: "Reduce food delivery by 2 orders this week",
          save: `${formatCurrency(save, currency)}/month`,
        };
      }
      if (name === "Travel") {
        const dailyCut = Math.max(40, Math.round((monthSpend * 0.2) / 30 / 10) * 10);
        return {
          title: "Save Opportunity",
          action: `Reduce transport spending by ${formatCurrency(dailyCut, currency)}/day`,
          save: `${formatCurrency(dailyCut * 30, currency)}/month`,
        };
      }
      if (name === "Shopping") {
        return {
          title: "Save Opportunity",
          action: "Skip 1 non-essential shopping order this week",
          save: `${formatCurrency(Math.round(monthSpend * 0.15), currency)}/month`,
        };
      }
      const dailyCut = Math.max(20, Math.round((monthSpend * 0.17) / 30 / 10) * 10);
      return {
        title: "Save Opportunity",
        action: `Reduce ${name.toLowerCase()} spending by ${formatCurrency(dailyCut, currency)}/day`,
        save: `${formatCurrency(dailyCut * 30, currency)}/month`,
      };
    }
    return {
      title: "Save Opportunity",
      action: `Stay under ${formatCurrency(survival.safeDaily, currency)}/day this week`,
      save: `${formatCurrency(Math.max(200, Math.round(survival.safeDaily * 0.2)) * 30, currency)}/month`,
    };
  }, [catStats, currency, survival.safeDaily]);

  const recent = useMemo(() => transactions.slice(0, 6), [transactions]);
  const hasExpenses = useMemo(() => transactions.some(t => t.type === "expense"), [transactions]);

  const greeting = (() => {
    const h = new Date().getHours();
    return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
  })();

  const moodMeta = {
    safe: { dot: "🟢", label: "Safe Zone", cls: "bg-success/15 text-success" },
    careful: { dot: "🟡", label: "Watch Spending", cls: "bg-gold/20 text-gold-foreground" },
    danger: { dot: "🔴", label: "Danger Zone", cls: "bg-destructive/15 text-destructive" },
  }[survival.mood];

  const emiTone = survival.emiLevel === "Low" ? "🟢" : survival.emiLevel === "Medium" ? "🟡" : "🔴";

  // "Can I buy this?" inline mini
  const [item, setItem] = useState("");
  const [priceStr, setPriceStr] = useState("");
  const price = Number(priceStr) || 0;
  const afterBuy = useMemo(() => {
    const newLeft = Math.max(0, survival.salaryLeft - price);
    const newDaily = newLeft / Math.max(1, survival.days);
    const buffer = survival.salary > 0 ? Math.min(50, (newLeft / survival.salary) * 50) : 25;
    const emiScore = Math.max(0, 30 - survival.emiRatio * 0.5);
    const newScore = Math.round(buffer + emiScore + 20);
    return { newLeft, newDaily, newScore };
  }, [price, survival]);

  return (
    <div>
      <PageHeader title={`${greeting}, ${(profile?.name ?? "there").split(" ")[0]}`} subtitle="Your salary survival snapshot" />

      <div className="space-y-5 px-5 py-5 md:space-y-6 md:px-10 md:py-7">
        {/* 1. Salary Survival Hero */}
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
                  <SurvivalStat label="Survival Score" value={`${survival.score}/100`} />
                </div>
                <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/20">
                  <div className="h-full bg-gold transition-all" style={{ width: `${Math.min(100, Math.max(0, survival.score))}%` }} />
                </div>
                <p className="mt-2.5 text-[10.5px] opacity-75">
                  Based on Salary Left · Days Until Salary · EMI Pressure · Spending Speed
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* 2. Today's Safe Limit */}
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

        {/* 3. Next Salary Card */}
        <Card className="shadow-soft">
          <CardContent className="p-4 md:p-5">
            <div className="flex items-center gap-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Calendar className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Next salary</p>
                <p className="font-display text-lg font-bold leading-tight">{survival.days} day{survival.days === 1 ? "" : "s"} left</p>
                <p className="text-[11px] text-muted-foreground">
                  Around {survival.nextSalary.toLocaleDateString(undefined, { day: "numeric", month: "short" })}
                </p>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-muted/40 px-3 py-2.5">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Recommended</p>
                <p className="mt-0.5 font-display text-sm font-semibold tabular-nums">{formatCurrency(survival.safeDaily, currency)}/day</p>
              </div>
              <div className="rounded-xl bg-success/10 px-3 py-2.5">
                <p className="text-[10px] uppercase tracking-wider text-success/80">Stretch goal</p>
                <p className="mt-0.5 font-display text-sm font-semibold tabular-nums text-success">{formatCurrency(survival.stretchDaily, currency)}/day</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 4. AI Insight (actionable save opportunity) */}
        <Card className="shadow-soft">
          <CardContent className="flex items-start gap-3 p-4 md:p-5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gold/15 text-gold-foreground">
              <Sparkles className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{insight.title}</p>
              <p className="mt-1 text-sm text-foreground/90">{insight.action}</p>
              <p className="mt-2 text-[11px] uppercase tracking-wider text-muted-foreground">Potential savings</p>
              <p className="font-display text-lg font-bold text-success tabular-nums">{insight.save}</p>
            </div>
          </CardContent>
        </Card>

        {/* 5. Can I buy this? (compact inline) */}
        <Card className="shadow-soft">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 font-display text-base">
              <ShoppingBag className="h-4 w-4 text-primary" /> Can I buy this?
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-[1fr_120px] gap-2">
              <Input placeholder="Item name" value={item} onChange={(e) => setItem(e.target.value)} className="h-9 text-sm" />
              <Input type="number" inputMode="decimal" placeholder="Price" value={priceStr} onChange={(e) => setPriceStr(e.target.value)} className="h-9 text-sm tabular-nums" />
            </div>
            {price > 0 && (() => {
              const dropPct = survival.score > 0 ? ((survival.score - afterBuy.newScore) / survival.score) * 100 : 0;
              const ratio = survival.salaryLeft > 0 ? price / survival.salaryLeft : 1;
              const impact = ratio > 0.4 || dropPct > 25 || afterBuy.newLeft <= 0
                ? { dot: "🔴", text: "Not Recommended", cls: "bg-destructive/15 text-destructive" }
                : ratio > 0.2 || dropPct > 12
                  ? { dot: "🟡", text: "Think Twice", cls: "bg-gold/20 text-gold-foreground" }
                  : { dot: "🟢", text: "Safe Purchase", cls: "bg-success/15 text-success" };
              return (
                <div className="rounded-xl bg-muted/40 p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">After purchase{item ? ` · ${item}` : ""}</p>
                    <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-medium ${impact.cls}`}>{impact.dot} {impact.text}</span>
                  </div>
                  <BuyRow label="Salary Left" before={formatCurrency(survival.salaryLeft, currency)} after={formatCurrency(afterBuy.newLeft, currency)} />
                  <BuyRow label="Safe Daily Spend" before={`${formatCurrency(survival.safeDaily, currency)}/day`} after={`${formatCurrency(afterBuy.newDaily, currency)}/day`} />
                  <BuyRow label="Survival Score" before={`${survival.score}`} after={`${afterBuy.newScore}`} />
                </div>
              );
            })()}
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
              const title = isIncome ? "Salary Credited" : (catName || simple);

              // Determine if this category is over-budget or surged this month
              const budget = budgets.find(b => b.category_id === t.category_id);
              const spentInCat = catStats.thisM.get(simple) ?? 0;
              const overBudget = budget ? spentInCat > budget.monthly_limit : false;
              const prevCat = catStats.lastM.get(simple) ?? 0;
              const surged = prevCat > 0 && spentInCat > prevCat * 1.2;

              let label = "Optional Expense";
              let labelCls = "text-muted-foreground";
              if (isIncome) {
                label = "Income Received ✅";
                labelCls = "text-success";
              } else if (ESSENTIAL.has(simple)) {
                label = "Essential Expense";
                labelCls = "text-foreground/70";
              } else if (overBudget) {
                label = "Budget Alert ⚠";
                labelCls = "text-destructive";
              } else if (simple === "Food" && survival.safeDaily > 0 && t.amount > survival.safeDaily * 0.5) {
                label = "Above Safe Limit ⚠";
                labelCls = "text-destructive";
              } else if (surged) {
                label = "Spending Up This Month";
                labelCls = "text-gold-foreground";
              }

              return (
                <div key={t.id} className="flex items-center justify-between gap-3 rounded-lg px-2 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{title}</p>
                    <p className={`truncate text-[11px] ${labelCls}`}>{label}</p>
                  </div>
                  <p className={`shrink-0 font-display text-sm font-semibold tabular-nums ${isIncome ? "text-success" : ""}`}>
                    {isIncome ? "+" : ""}{formatCurrency(t.amount, currency)}
                  </p>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* 7. Spending Risks */}
        <Card className="shadow-soft">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="flex items-center gap-2 font-display text-base">
              <AlertTriangle className="h-4 w-4 text-gold-foreground" /> Spending risks
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {risks.length === 0 ? (
              <p className="py-1 text-sm text-muted-foreground">No risks detected. You're spending calmly.</p>
            ) : risks.map((r, i) => {
              const tone = r.tone === "danger"
                ? "border-destructive/20 bg-destructive/5"
                : r.tone === "warn"
                  ? "border-gold/25 bg-gold/10"
                  : "border-border bg-muted/40";
              const titleCls = r.tone === "danger" ? "text-destructive" : r.tone === "warn" ? "text-gold-foreground" : "text-foreground";
              return (
                <div key={i} className={`rounded-xl border px-3 py-2.5 ${tone}`}>
                  <p className={`text-[11px] font-semibold uppercase tracking-wider ${titleCls}`}>{r.title}</p>
                  <p className="mt-0.5 text-sm font-medium text-foreground/90 tabular-nums">{r.main}</p>
                  {r.reason && <p className="mt-1 text-[11px] text-muted-foreground">{r.reason}</p>}
                </div>
              );
            })}
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
          <CardContent className="space-y-4">
            {budgets.length === 0 ? (
              <p className="text-sm text-muted-foreground">No budgets set yet.</p>
            ) : budgets.slice(0, 5).map((b) => {
              const c = categories.find(x => x.id === b.category_id);
              const name = simplifyCategory(c?.name);
              const spent = transactions
                .filter(t => t.type === "expense" && t.category_id === b.category_id && t.transaction_date.startsWith(month.slice(0, 7)))
                .reduce((s, t) => s + t.amount, 0);
              const pctRaw = (spent / b.monthly_limit) * 100;
              const pct = Math.min(100, pctRaw);
              const over = spent > b.monthly_limit;
              const warn = !over && pctRaw >= 80;
              const remaining = Math.max(0, b.monthly_limit - spent);
              const status = over
                ? { text: "Overspent ⚠", cls: "text-destructive" }
                : warn
                  ? { text: "Warning", cls: "text-gold-foreground" }
                  : { text: "On Track ✅", cls: "text-success" };

              return (
                <div key={b.id}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{name}</span>
                    <span className={`text-xs font-medium ${status.cls}`}>{status.text}</span>
                  </div>
                  <Progress value={pct} className="mt-1.5 h-1.5" />
                  <div className="mt-1.5 flex items-center justify-between text-[11px] tabular-nums text-muted-foreground">
                    <span>Budget {formatCurrency(b.monthly_limit, currency)} · Spent {formatCurrency(spent, currency)}</span>
                    <span className={over ? "font-medium text-destructive" : "text-foreground/70"}>
                      {over
                        ? `Overspent ${formatCurrency(spent - b.monthly_limit, currency)}`
                        : `${formatCurrency(remaining, currency)} left · ${Math.round(pctRaw)}% used`}
                    </span>
                  </div>
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

function BuyRow({ label, before, after }: { label: string; before: string; after: string }) {
  return (
    <div className="mt-1.5 flex items-center justify-between gap-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="flex items-center gap-1.5 text-xs font-medium tabular-nums">
        <span className="text-muted-foreground line-through opacity-70">{before}</span>
        <ArrowRight className="h-3 w-3 text-muted-foreground" />
        <span className="font-semibold">{after}</span>
      </span>
    </div>
  );
}
