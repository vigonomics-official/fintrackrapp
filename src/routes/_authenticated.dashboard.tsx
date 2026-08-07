import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Shield, Wallet, ShoppingBag, ArrowRight, Plus, Sparkles, MessageCircle, X, PiggyBank, Bell } from "lucide-react";
import { computeNotifications, onNotificationsChanged, unreadCount } from "@/lib/notifications";
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
import { GettingStartedChecklist } from "@/components/finance/GettingStartedChecklist";
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

function NotificationsBell({
  transactions,
  settings,
  loans,
  categories,
}: {
  transactions: ReturnType<typeof useTransactions>["data"];
  settings: ReturnType<typeof useSalarySettings>["settings"];
  loans?: ReturnType<typeof useLoans>["data"];
  categories?: ReturnType<typeof useCategories>["data"];
}) {
  const [tick, setTick] = useState(0);
  useEffect(() => onNotificationsChanged(() => setTick((t) => t + 1)), []);
  const count = useMemo(
    () =>
      unreadCount(
        computeNotifications({
          transactions: transactions ?? [],
          loans: loans ?? [],
          categories: categories ?? [],
          salarySettings: settings,
        }),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [transactions, loans, categories, settings, tick],
  );

  return (
    <Link
      to="/notifications"
      className="relative grid h-9 w-9 place-items-center rounded-full border bg-card hover:bg-muted"
      aria-label={`Notifications${count > 0 ? ` (${count} new)` : ""}`}
    >
      <Bell className="h-4 w-4" />
      {count > 0 && (
        <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
          {count > 9 ? "9+" : count}
        </span>
      )}
    </Link>
  );
}

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

  // --- Home intelligence: Status, Mission, Salary Health, Upcoming Risks
  const recentAvg = useMemo(() => recentDailyAverage(transactions, 7, now), [transactions, now.getDate()]);
  const billsSoon = useMemo(() => nextBillDueDays(loans, now), [loans, now.getDate()]);

  const dailyStatus = useMemo(
    () => computeDailyStatus({ survival, billsDueSoonDays: billsSoon, recentDailyAvg: recentAvg, currency }),
    [survival, billsSoon, recentAvg, currency],
  );

  const mission = useMemo(() => {
    const m = computeTodayMission({ survival, transactions, categories, now, currency });
    if (!m || dismissed.includes(m.id)) return null;
    return m;
  }, [survival, transactions, categories, currency, dismissed, now.getDate()]);

  const salaryHealth = useMemo(
    () => computeSalaryHealth({ survival, transactions, categories, now }),
    [survival, transactions, categories, now.getMonth()],
  );

  const homeRisks = useMemo(
    () => computeUpcomingRisks({ survival, transactions, categories, budgets, loans, profile: fp, now, currency }),
    [survival, transactions, categories, budgets, loans, fp, currency, now.getDate()],
  );

  const applyMissionToPlanner = () => {
    if (!mission) return;
    enqueuePlannerTask({
      id: `home-mission-${mission.id}-${new Date().toISOString().slice(0, 10)}`,
      title: mission.title,
      detail: mission.detail + (mission.saving > 0 ? ` · Potential saving ${formatCurrency(mission.saving, currency)}` : ""),
    });
    toast.success("Added to Planner");
  };



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
      <PageHeader
        title={`${greeting}, ${(profile?.name ?? "there").split(" ")[0]}`}
        subtitle="Your salary survival snapshot"
        action={<NotificationsBell transactions={transactions} settings={salarySettings} loans={loans} categories={categories} />}
      />


      <div className="space-y-3 px-4 py-4 md:space-y-4 md:px-10 md:py-6">
        {!hasExpenses && (
          <GettingStartedChecklist
            hasSalary={(salarySettings.amount ?? fp.monthlySalary ?? 0) > 0}
            hasGoal={!!fp.financialGoal}
            hasExpense={hasExpenses}
            hasEmergencyFund={fp.financialGoal === "Emergency Fund"}
          />
        )}

        {/* ============ 1. SALARY SNAPSHOT (hero) ============ */}
        <h2 className="sr-only">Salary Snapshot</h2>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="overflow-hidden border-0 bg-gradient-hero text-primary-foreground shadow-elegant">
            <CardContent className="relative p-5 md:p-7">
              <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-gold/20 blur-3xl" />
              <div className="relative">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] opacity-90">Salary Left</p>
                    <p className="mt-2 font-display text-3xl font-bold leading-none md:text-4xl tabular-nums">{formatCurrency(survival.salaryLeft, currency)}</p>
                    <p className="mt-2.5 text-sm font-semibold">
                      Safe to spend {formatCurrency(survival.safeDaily, currency)}/day
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-white/20 px-3 py-1 text-[11px] font-semibold backdrop-blur">
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
                    <div className="mt-3.5">
                      <div className="h-1 w-full overflow-hidden rounded-full bg-white/25">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${Math.min(100, Math.max(0, monthProgress * 100))}%`,
                            background: onTrack ? "var(--success)" : "var(--warning)",
                          }}
                        />
                      </div>
                      <p className="mt-1.5 text-[11px] font-medium opacity-90">
                        Day {day} of {totalDays} • {Math.round(monthProgress * 100)}% of month gone
                      </p>
                    </div>
                  );
                })()}

                <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                  <SurvivalStat label="Days left" value={survival.isSalaryToday ? "Today 🎉" : String(survival.days)} />
                  <SurvivalStat label="EMI pressure" value={`${emiTone} ${survival.emiLevel}`} />
                  <SurvivalStat label="Survival Score" value={`${survival.score}/100`} />
                </div>
                <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-white/25">
                  <div className="h-full bg-gold transition-all" style={{ width: `${Math.min(100, Math.max(0, survival.score))}%` }} />
                </div>
                <p className="mt-2 text-[11px] font-medium opacity-85">
                  Based on Salary Left · Days Until Salary · EMI Pressure · Spending Speed
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Daily survival status — safe zone accent */}
        {(() => {
          const toneCls =
            dailyStatus.level === "safe"
              ? "border-success/35 bg-success/10 text-success"
              : dailyStatus.level === "careful"
                ? "border-warning/40 bg-warning/10 text-gold-foreground"
                : "border-destructive/35 bg-destructive/10 text-destructive";
          return (
            <Card className={`shadow-soft ${toneCls}`}>
              <CardContent className="flex items-start gap-3 p-3.5">
                <span className="text-xl leading-none">{dailyStatus.dot}</span>
                <div className="min-w-0 flex-1">
                  <p className="font-display text-sm font-semibold">{dailyStatus.headline}</p>
                  <p className="mt-0.5 text-[11.5px] font-medium opacity-95">{dailyStatus.detail}</p>
                </div>
              </CardContent>
            </Card>
          );
        })()}

        {/* Info chips */}
        <div className="flex justify-center gap-2">
          <span className="inline-flex items-center rounded-full border bg-card px-3 py-1.5 text-[13px] font-medium text-foreground shadow-soft">
            📅 {survival.isSalaryToday ? "Salary Today 🎉" : `${daysLeftLabel(survival.days)} to salary`}
          </span>
          <span className="inline-flex items-center rounded-full border bg-card px-3 py-1.5 text-[13px] font-medium text-foreground shadow-soft">
            🎯 Score: {survival.score}/100
          </span>
        </div>

        {/* Today's pulse */}
        <div className="grid grid-cols-2 gap-2.5">
          <Card className="shadow-soft">
            <CardContent className="p-3.5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Spent Today</p>
              <p className="mt-1 font-display text-lg font-bold tabular-nums text-foreground">
                {formatCurrency(survival.spentToday, currency)}
              </p>
            </CardContent>
          </Card>
          <Card className="shadow-soft">
            <CardContent className="p-3.5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Left Today</p>
              {(() => {
                const left = survival.safeDaily - survival.spentToday;
                const positive = left > 0;
                return (
                  <p className={`mt-1 font-display text-lg font-bold tabular-nums ${positive ? "text-success" : "text-destructive"}`}>
                    {!positive && "⚠️ "}
                    {formatCurrency(Math.max(0, left), currency)}
                  </p>
                );
              })()}
            </CardContent>
          </Card>
        </div>

        {/* ============ 2. TODAY'S MISSION (AI Coach — emerald) ============ */}
        {mission && (
          <Card className="border-primary/30 bg-primary/5 shadow-soft">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 font-display text-base">
                <Sparkles className="h-4 w-4 text-primary" /> Today's mission
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="font-display text-base font-semibold">{mission.title}</p>
                <p className="mt-0.5 text-xs font-medium text-foreground/80">{mission.detail}</p>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-xl bg-card px-2 py-2 text-center">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Save</p>
                  <p className="mt-0.5 font-display text-sm font-semibold tabular-nums">
                    {mission.saving > 0 ? formatCurrency(mission.saving, currency) : "—"}
                  </p>
                </div>
                <div className="rounded-xl bg-card px-2 py-2 text-center">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Score</p>
                  <p className="mt-0.5 font-display text-sm font-semibold text-success tabular-nums">+{mission.scoreBoost}</p>
                </div>
                <div className="rounded-xl bg-card px-2 py-2 text-center">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Time</p>
                  <p className="mt-0.5 font-display text-sm font-semibold tabular-nums">{mission.minutes}m</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={applyMissionToPlanner}>
                  <Plus className="mr-1 h-4 w-4" /> Apply to Planner
                </Button>
                <Button asChild size="sm" variant="secondary">
                  <Link to="/insights/ai-coach"><MessageCircle className="mr-1 h-4 w-4" /> Ask AI Coach</Link>
                </Button>
                <Button size="sm" variant="ghost" onClick={() => dismissMission(mission.id)}>
                  <X className="mr-1 h-4 w-4" /> Dismiss
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ============ 3. UPCOMING RISKS (warnings — orange) ============ */}
        <Card className="border-warning/30 shadow-soft">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="flex items-center gap-2 font-display text-base">
              <AlertTriangle className="h-4 w-4 text-gold-foreground" /> Upcoming risks
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {homeRisks.length === 0 ? (
              <p className="py-1 text-sm text-muted-foreground">No risks detected. You're spending calmly.</p>
            ) : homeRisks.map((r: UpcomingRisk) => {
              const tone = r.urgency === "High"
                ? "border-destructive/30 bg-destructive/10"
                : r.urgency === "Medium"
                  ? "border-warning/35 bg-warning/10"
                  : "border-border bg-muted/40";
              const badgeCls = r.urgency === "High"
                ? "bg-destructive/20 text-destructive"
                : r.urgency === "Medium"
                  ? "bg-warning/20 text-gold-foreground"
                  : "bg-muted text-muted-foreground";
              return (
                <div key={r.id} className={`rounded-xl border px-3 py-2.5 ${tone}`}>
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-foreground">{r.title}</p>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${badgeCls}`}>
                      {r.urgency}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs font-medium tabular-nums text-foreground/80">{r.moneyLabel}</p>
                  <p className="mt-1 text-[11.5px] text-foreground/90">💡 {r.suggestion}</p>
                  <p className="mt-0.5 text-[11px] font-medium text-muted-foreground">Confidence: {r.confidence}</p>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* ============ 4. BUDGETS (blue) ============ */}
        <Card className="border-info/30 shadow-soft">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="flex items-center gap-2 font-display text-base">
              <Shield className="h-4 w-4 text-info" /> Budgets
            </CardTitle>
            <Link to="/budgets" className="text-xs font-semibold text-info hover:underline">Manage</Link>
          </CardHeader>
          <CardContent className="space-y-3.5">
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
                    <span className={`text-xs font-semibold ${status.cls}`}>{status.text}</span>
                  </div>
                  <Progress value={pct} className="mt-1.5 h-1.5" />
                  <div className="mt-1.5 flex items-center justify-between text-[11.5px] font-medium tabular-nums text-foreground/75">
                    <span>Budget {formatCurrency(b.monthly_limit, currency)} · Spent {formatCurrency(spent, currency)}</span>
                    <span className={over ? "font-semibold text-destructive" : "text-foreground/85"}>
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

        {/* ============ 5. SALARY HEALTH (teal) ============ */}
        {salaryHealth.salary > 0 && (
          <Card className="border-teal/30 shadow-soft">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 font-display text-base">
                <PiggyBank className="h-4 w-4 text-teal" /> Salary health
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5">
              <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
                {salaryHealth.slices.map((s) => {
                  const bg =
                    s.bucket === "needs" ? "var(--destructive)"
                    : s.bucket === "savings" ? "var(--success)"
                    : s.bucket === "investments" ? "var(--info)"
                    : s.bucket === "lifestyle" ? "var(--gold)"
                    : "var(--muted-foreground)";
                  if (s.pct <= 0) return null;
                  return <div key={s.bucket} style={{ width: `${Math.min(100, s.pct)}%`, background: bg }} />;
                })}
              </div>
              <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                {salaryHealth.slices.map((s) => {
                  const dot =
                    s.bucket === "needs" ? "var(--destructive)"
                    : s.bucket === "savings" ? "var(--success)"
                    : s.bucket === "investments" ? "var(--info)"
                    : s.bucket === "lifestyle" ? "var(--gold)"
                    : "var(--muted-foreground)";
                  return (
                    <div key={s.bucket} className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-2">
                        <span className="inline-block h-2 w-2 rounded-full" style={{ background: dot }} />
                        <span className="font-medium">{s.label}</span>
                      </span>
                      <span className="font-medium tabular-nums text-foreground/80">
                        {formatCurrency(s.amount, currency)} · {s.pct}%
                      </span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* ============ 6. UNDER BUDGET STREAK (green) ============ */}
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
            <div className="flex items-center gap-4 rounded-xl border border-success/30 bg-success/10 px-4 py-3.5">
              <div className="flex flex-col items-center justify-center" style={{ minWidth: 56 }}>
                <span style={{ fontSize: 28, lineHeight: 1 }}>🔥</span>
                <span className="font-display text-[28px] font-bold leading-tight tabular-nums text-success">{streak}</span>
                <span className="text-[11px] font-medium text-success">day streak</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground">Under Budget Streak</p>
                <p className="text-[11.5px] font-medium text-foreground/80">
                  {streak === 0
                    ? `Start today — spend under ${formatCurrency(safeDailyRounded, currency)} to begin your streak`
                    : `Stay under ${formatCurrency(safeDailyRounded, currency)}/day to keep it going`}
                </p>
                <div className="mt-2 flex items-center gap-1.5">
                  {days.map((d) => (
                    <span
                      key={d.key}
                      title={d.key}
                      className={`inline-block h-2.5 w-2.5 rounded-full ${d.under && d.hasData ? "bg-success" : "bg-muted-foreground/40"}`}
                    />
                  ))}
                </div>
              </div>
            </div>
          );
        })()}

        {/* ============ 7. CAN I BUY THIS? ============ */}
        <Card className="shadow-soft">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 font-display text-base">
              <ShoppingBag className="h-4 w-4 text-primary" /> Can I buy this?
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-[1fr_120px] gap-2">
              <Input placeholder="Item name" value={item} onChange={(e) => setItem(e.target.value)} className="h-10 text-sm" />
              <Input type="number" inputMode="decimal" placeholder="Price" value={priceStr} onChange={(e) => setPriceStr(e.target.value)} className="h-10 text-sm tabular-nums" />
            </div>
            {price > 0 && (() => {
              const dropPct = survival.score > 0 ? ((survival.score - afterBuy.newScore) / survival.score) * 100 : 0;
              const ratio = survival.salaryLeft > 0 ? price / survival.salaryLeft : 1;
              const impact = ratio > 0.4 || dropPct > 25 || afterBuy.newLeft <= 0
                ? { dot: "🔴", text: "Not Recommended", cls: "bg-destructive/20 text-destructive" }
                : ratio > 0.2 || dropPct > 12
                  ? { dot: "🟡", text: "Think Twice", cls: "bg-warning/20 text-gold-foreground" }
                  : { dot: "🟢", text: "Safe Purchase", cls: "bg-success/20 text-success" };
              return (
                <div className="rounded-xl bg-muted/50 p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">After purchase{item ? ` · ${item}` : ""}</p>
                    <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${impact.cls}`}>{impact.dot} {impact.text}</span>
                  </div>
                  <BuyRow label="Salary Left" before={formatCurrency(survival.salaryLeft, currency)} after={formatCurrency(afterBuy.newLeft, currency)} />
                  <BuyRow label="Safe Daily Spend" before={`${formatCurrency(survival.safeDaily, currency)}/day`} after={`${formatCurrency(afterBuy.newDaily, currency)}/day`} />
                  <BuyRow label="Survival Score" before={`${survival.score}`} after={`${afterBuy.newScore}`} />
                </div>
              );
            })()}
          </CardContent>
        </Card>

        <Link to="/transactions" className="flex items-center justify-center gap-2 rounded-xl border bg-card p-3.5 text-sm font-semibold text-primary shadow-soft transition-colors hover:bg-accent">
          View all <ArrowRight className="h-4 w-4" />
        </Link>
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
