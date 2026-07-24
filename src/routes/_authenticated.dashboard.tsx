import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Shield, Wallet, ShoppingBag, ArrowRight, Plus, Sparkles, MessageCircle, X, PiggyBank } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { useTransactions, useCategories, useBudgets, monthKey, useProfile, useLoans } from "@/hooks/use-finance";
import { useSalarySettings } from "@/hooks/use-salary-settings";
import { computeSurvival } from "@/lib/survival";
import { daysLeftLabel } from "@/lib/salary-cycle";
import { formatCurrency } from "@/lib/currency";
import { PageHeader } from "@/components/finance/PageHeader";
import { getFinancialProfile, onProfileUpdated } from "@/lib/financial-profile";
import { enqueuePlannerTask } from "@/lib/coach-plan";
import {
  computeDailyStatus,
  computeTodayMission,
  computeSalaryHealth,
  computeUpcomingRisks,
  recentDailyAverage,
  nextBillDueDays,
  type UpcomingRisk,
} from "@/lib/home-insights";

const MISSION_DISMISS_KEY = "fintrackr:home:dismissed-missions:v1";
function readDismissed(): string[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(sessionStorage.getItem(MISSION_DISMISS_KEY) ?? "[]"); } catch { return []; }
}
function writeDismissed(ids: string[]) {
  try { sessionStorage.setItem(MISSION_DISMISS_KEY, JSON.stringify(ids)); } catch {}
}

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
  head: () => ({
    meta: [
      { title: "Dashboard — FinTrackr" },
      { name: "description", content: "Your money at a glance — balances, recent activity, and AI insights." },
      { property: "og:title", content: "Dashboard — FinTrackr" },
      { property: "og:description", content: "Your money at a glance — balances, recent activity, and AI insights." },
      { property: "og:url", content: "https://fintrackrapp.lovable.app/dashboard" },
      { name: "twitter:title", content: "Dashboard — FinTrackr" },
      { name: "twitter:description", content: "Your money at a glance — balances, recent activity, and AI insights." },
    ],
    links: [{ rel: "canonical", href: "https://fintrackrapp.lovable.app/dashboard" }],
  }),
});

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
  const { settings: salarySettings } = useSalarySettings();
  const currency = profile?.currency ?? "INR";

  const [fp, setFp] = useState(getFinancialProfile);
  useEffect(() => onProfileUpdated(() => setFp(getFinancialProfile())), []);

  const [dismissed, setDismissed] = useState<string[]>(readDismissed);
  const dismissMission = (id: string) => {
    const next = Array.from(new Set([...dismissed, id]));
    setDismissed(next);
    writeDismissed(next);
  };

  const now = new Date();


  const survival = useMemo(() => {
    const base = computeSurvival({ transactions, loans, salarySettings });
    const stretchDaily = base.safeDaily * 0.85;
    const remainingToday = Math.max(0, base.safeDaily - base.spentToday);
    const mood: "safe" | "careful" | "danger" =
      base.score >= 70 && base.spentToday <= base.safeDaily
        ? "safe"
        : base.score >= 45
          ? "careful"
          : "danger";
    const upcoming = [...loans]
      .filter((l) => l.remaining_balance > 0)
      .map((l) => {
        const d = new Date(now.getFullYear(), now.getMonth(), Math.min(l.due_day, 28));
        if (d < now) d.setMonth(d.getMonth() + 1);
        return { loan: l, due: d };
      })
      .sort((a, b) => a.due.getTime() - b.due.getTime())[0];
    return { ...base, stretchDaily, remainingToday, mood, upcoming };
  }, [transactions, loans, salarySettings, now.getDate()]);

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
        {!hasExpenses && (
          <Card className="border-dashed shadow-soft">
            <CardContent className="flex flex-col items-center gap-3 p-6 text-center">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Wallet className="h-5 w-5" />
              </span>
              <div>
                <p className="font-display text-base font-semibold">No expenses recorded yet</p>
                <p className="mt-1 text-xs text-muted-foreground">Start tracking expenses to calculate your safe daily spending.</p>
              </div>
              <Button asChild size="sm" className="mt-1">
                <Link to="/transactions"><Plus className="mr-1 h-4 w-4" /> Add Expense</Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {/* 1. Salary Survival Hero */}
        <h2 className="sr-only">Salary Survival</h2>
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="overflow-hidden border-0 bg-gradient-hero text-primary-foreground shadow-elegant">
            <CardContent className="relative p-6 md:p-7">
              <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-gold/20 blur-3xl" />
              <div className="relative">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium uppercase tracking-[0.18em] opacity-70">Salary Left</p>
                    <p className="mt-2 font-display text-3xl font-bold leading-none md:text-4xl tabular-nums">{formatCurrency(survival.salaryLeft, currency)}</p>
                    <p className="mt-3 text-white" style={{ fontSize: "16px", fontWeight: 600 }}>
                      Safe to spend {formatCurrency(survival.safeDaily, currency)}/day
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-full bg-white/15 px-3 py-1 text-[11px] font-medium backdrop-blur`}>
                    {moodMeta.dot} {moodMeta.label}
                  </span>
                </div>

                {(() => {
                  const day = now.getDate();
                  const totalDays = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
                  const monthProgress = day / totalDays;
                  const monthExpense = transactions
                    .filter(t => {
                      const d = new Date(t.transaction_date);
                      return t.type === "expense" && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
                    })
                    .reduce((s, t) => s + t.amount, 0);
                  const spendProgress = survival.salary > 0 ? monthExpense / survival.salary : 0;
                  const onTrack = spendProgress <= monthProgress;
                  return (
                    <div className="mt-4">
                      <div className="h-1 w-full overflow-hidden rounded-full bg-white/20">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${Math.min(100, Math.max(0, monthProgress * 100))}%`,
                            background: onTrack ? "#22c55e" : "#f97316",
                          }}
                        />
                      </div>
                      <p className="mt-1.5 text-white" style={{ fontSize: "11px", opacity: 0.8 }}>
                        Day {day} of {totalDays} • {Math.round(monthProgress * 100)}% of month gone
                      </p>
                    </div>
                  );
                })()}

                <div className="mt-5 grid grid-cols-3 gap-2 text-center">
                  <SurvivalStat label="Days left" value={survival.isSalaryToday ? "Today 🎉" : String(survival.days)} />
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

        {/* Info chips */}
        <div className="flex justify-center gap-2">
          <span
            className="inline-flex items-center rounded-full bg-white shadow-soft"
            style={{ color: "#374151", fontSize: "13px", padding: "6px 12px", borderRadius: "20px" }}
          >
            📅 {survival.isSalaryToday ? "Salary Today 🎉" : `${daysLeftLabel(survival.days)} to salary`}
          </span>
          <span
            className="inline-flex items-center rounded-full bg-white shadow-soft"
            style={{ color: "#374151", fontSize: "13px", padding: "6px 12px", borderRadius: "20px" }}
          >
            🎯 Score: {survival.score}/100
          </span>
        </div>

        {/* Today's Pulse */}
        <h2 className="sr-only">Today's Pulse</h2>
        <div className="grid grid-cols-2 gap-3">
          <Card className="shadow-soft" style={{ borderRadius: "12px" }}>
            <CardContent className="p-4">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Spent Today</p>
              <p className="mt-1 font-display text-lg font-bold tabular-nums" style={{ color: "#374151" }}>
                {formatCurrency(survival.spentToday, currency)}
              </p>
            </CardContent>
          </Card>
          <Card className="shadow-soft" style={{ borderRadius: "12px" }}>
            <CardContent className="p-4">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Left Today</p>
              {(() => {
                const left = survival.safeDaily - survival.spentToday;
                const positive = left > 0;
                return (
                  <p
                    className="mt-1 font-display text-lg font-bold tabular-nums"
                    style={{ color: positive ? "#16a34a" : "#dc2626" }}
                  >
                    {!positive && "⚠️ "}
                    {formatCurrency(Math.max(0, left), currency)}
                  </p>
                );
              })()}
            </CardContent>
          </Card>
        </div>

        {/* Spending Streak */}
        {(() => {
          const safeDailyRounded = Math.max(0, Math.round(survival.safeDaily));
          const days: { key: string; spent: number; under: boolean; hasData: boolean }[] = [];
          for (let i = 6; i >= 0; i--) {
            const d = new Date(now);
            d.setDate(now.getDate() - i);
            const key = d.toISOString().slice(0, 10);
            const dayTx = transactions.filter(t => t.type === "expense" && t.transaction_date.slice(0, 10) === key);
            const spent = dayTx.reduce((s, t) => s + t.amount, 0);
            days.push({ key, spent, under: survival.safeDaily > 0 && spent <= survival.safeDaily, hasData: dayTx.length > 0 });
          }
          let streak = 0;
          for (let i = days.length - 1; i >= 0; i--) {
            if (days[i].under) streak++;
            else break;
          }
          return (
            <div
              style={{
                background: "#F0FDF4",
                border: "1px solid #BBF7D0",
                borderRadius: "12px",
                padding: "14px 16px",
              }}
              className="flex items-center gap-4"
            >
              <div className="flex flex-col items-center justify-center" style={{ minWidth: 56 }}>
                <span style={{ fontSize: 28, lineHeight: 1 }}>🔥</span>
                <span className="font-display font-bold tabular-nums" style={{ fontSize: 28, lineHeight: 1.1, color: "#166534" }}>{streak}</span>
                <span style={{ fontSize: 11, color: "#15803d" }}>day streak</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold" style={{ color: "#166534", fontSize: 14 }}>Under Budget Streak</p>
                <p style={{ fontSize: 11, color: "#15803d" }}>
                  {streak === 0
                    ? `Start today — spend under ${formatCurrency(safeDailyRounded, currency)} to begin your streak`
                    : `Stay under ${formatCurrency(safeDailyRounded, currency)}/day to keep it going`}
                </p>
                <div className="mt-2 flex items-center gap-1.5">
                  {days.map((d) => (
                    <span
                      key={d.key}
                      title={d.key}
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: "50%",
                        background: d.under && d.hasData ? "#22c55e" : "#d1d5db",
                        display: "inline-block",
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
          );
        })()}


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

        <Link to="/transactions" className="flex items-center justify-center gap-2 rounded-xl border bg-card p-4 shadow-soft text-sm font-medium text-primary transition-colors hover:bg-accent">
          View all <ArrowRight className="h-4 w-4" />
        </Link>

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
            ) : (() => {
              const byCat = new Map<string, typeof budgets[number]>();
              for (const b of budgets) {
                const key = b.category_id ?? `__none_${b.id}`;
                const existing = byCat.get(key);
                if (!existing || (b.monthly_limit ?? 0) > (existing.monthly_limit ?? 0)) {
                  byCat.set(key, b);
                }
              }
              return [...byCat.values()].slice(0, 5);
            })().map((b) => {
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
