import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/finance/PageHeader";
import { useTransactions, useCategories, useProfile } from "@/hooks/use-finance";
import { useSalarySettings } from "@/hooks/use-salary-settings";
import { useLoans } from "@/hooks/use-finance";
import { computeSurvival } from "@/lib/survival";
import { formatCurrency } from "@/lib/currency";
import { cn } from "@/lib/utils";
import { computeWeeklyScore, buildWeeklySummary, buildComparison } from "@/lib/weekly-insights";

export const Route = createFileRoute("/_authenticated/insights/weekly")({
  component: WeeklyReportPage,
  head: () => ({ meta: [{ title: "Weekly Survival Report — FinTrackr" }] }),
});

function startOfWeek(d: Date) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = (x.getDay() + 6) % 7; // Mon=0
  x.setDate(x.getDate() - day);
  return x;
}

function WeeklyReportPage() {
  const { data: txs = [] } = useTransactions();
  const { data: categories = [] } = useCategories();
  const { data: loans = [] } = useLoans();
  const { data: profile } = useProfile();
  const { settings } = useSalarySettings();
  const currency = profile?.currency ?? "INR";
  const fmt = (n: number) => formatCurrency(n, currency);

  const now = new Date();
  const weekStart = useMemo(() => startOfWeek(now), [now]);
  const weekEnd = useMemo(() => {
    const e = new Date(weekStart); e.setDate(e.getDate() + 6); return e;
  }, [weekStart]);
  const prevStart = useMemo(() => {
    const p = new Date(weekStart); p.setDate(p.getDate() - 7); return p;
  }, [weekStart]);

  const inRange = (t: any, start: Date, end: Date) => {
    const k = String(t.transaction_date).slice(0, 10);
    const sk = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`;
    const ek = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, "0")}-${String(end.getDate()).padStart(2, "0")}`;
    return k >= sk && k <= ek;
  };

  const weekTxs = useMemo(() => txs.filter(t => t.type === "expense" && inRange(t, weekStart, weekEnd)), [txs, weekStart, weekEnd]);
  const prevTxs = useMemo(() => txs.filter(t => t.type === "expense" && inRange(t, prevStart, weekStart)), [txs, prevStart, weekStart]);

  const survival = useMemo(
    () => computeSurvival({ transactions: txs, loans, salarySettings: settings, now }),
    [txs, loans, settings, now],
  );
  const weekBudget = survival.safeDaily * 7;
  const spent = weekTxs.reduce((s, t) => s + t.amount, 0);
  const remaining = Math.max(0, weekBudget - spent);
  const over = spent > weekBudget && weekBudget > 0;

  // Days elapsed this week (Mon..today, min 1)
  const daysElapsed = Math.max(
    1,
    Math.min(7, Math.floor((now.getTime() - weekStart.getTime()) / 86_400_000) + 1),
  );
  const avgDailyThisWeek = spent / daysElapsed;

  const weekly = useMemo(
    () => computeWeeklyScore({
      weekSpent: spent,
      weekBudget,
      safeDaily: survival.safeDaily,
      salaryLeft: survival.salaryLeft,
      salary: survival.salary,
      daysRemaining: survival.daysRemaining,
      avgDailyThisWeek,
    }),
    [spent, weekBudget, survival.safeDaily, survival.salaryLeft, survival.salary, survival.daysRemaining, avgDailyThisWeek],
  );

  // Previous week: use same weekly budget baseline, historical spend fully realized (7 days)
  const prevSpent = prevTxs.reduce((s, t) => s + t.amount, 0);
  const prevWeekly = useMemo(
    () => computeWeeklyScore({
      weekSpent: prevSpent,
      weekBudget,
      safeDaily: survival.safeDaily,
      salaryLeft: survival.salary,
      salary: survival.salary,
      daysRemaining: 7,
      avgDailyThisWeek: prevSpent / 7,
    }),
    [prevSpent, weekBudget, survival.safeDaily, survival.salary],
  );

  const summary = useMemo(
    () => buildWeeklySummary({
      weekSpent: spent,
      weekBudget,
      weekTxs,
      categories,
      survival,
      fmt,
    }),
    [spent, weekBudget, weekTxs, categories, survival, currency],
  );

  const comparison = useMemo(
    () => buildComparison({
      weekSpent: spent,
      prevSpent,
      weekTxs,
      prevTxs,
      categories,
      weeklyScore: weekly.score,
      prevWeeklyScore: prevWeekly.score,
      safeDaily: survival.safeDaily,
      prevSafeDaily: survival.safeDaily, // baseline; safe daily is cycle-derived, stable across weeks in same cycle
      fmt,
    }),
    [spent, prevSpent, weekTxs, prevTxs, categories, weekly.score, prevWeekly.score, survival.safeDaily, currency],
  );

  // Day breakdown
  const days = useMemo(() => {
    const labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    return labels.map((label, i) => {
      const d = new Date(weekStart); d.setDate(d.getDate() + i);
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const amount = weekTxs.filter(t => String(t.transaction_date).slice(0, 10) === k).reduce((s, t) => s + t.amount, 0);
      return { label, amount, over: survival.safeDaily > 0 && amount > survival.safeDaily, future: d > now };
    });
  }, [weekStart, weekTxs, survival.safeDaily, now]);

  // Top 3 categories
  const topCats = useMemo(() => {
    const map = new Map<string, number>();
    weekTxs.forEach(t => {
      const k = t.category_id ?? "uncategorized";
      map.set(k, (map.get(k) ?? 0) + t.amount);
    });
    const arr = [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
    const max = arr[0]?.[1] ?? 1;
    return arr.map(([id, amt]) => {
      const c = categories.find(x => x.id === id);
      return { name: c?.name ?? "Uncategorized", color: c?.color ?? "#94a3b8", amount: amt, pct: (amt / max) * 100 };
    });
  }, [weekTxs, categories]);

  const fmtRange = `${weekStart.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${weekEnd.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;

  const toneClass = (t: "success" | "warning" | "danger" | "muted") =>
    t === "success" ? "bg-success/10 text-success"
    : t === "warning" ? "bg-warning/10 text-warning"
    : t === "danger" ? "bg-destructive/10 text-destructive"
    : "bg-muted text-muted-foreground";

  return (
    <div className="w-full overflow-x-hidden">
      <PageHeader title="Weekly Survival Report" subtitle={`Week of ${fmtRange}`} />
      <div className="mx-auto w-full max-w-3xl space-y-4 px-4 py-5 sm:px-6 md:px-10">

        {/* Weekly Survival Score */}
        <Card className="p-4 shadow-soft">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Weekly Survival Score</p>
              <p className="mt-1 font-display text-3xl font-bold">{weekly.score}<span className="text-base text-muted-foreground">/100</span></p>
              <span className={cn("mt-2 inline-block rounded-full px-3 py-1 text-xs font-medium", toneClass(weekly.status.tone))}>
                {weekly.status.emoji} {weekly.status.label}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="rounded-md bg-muted/40 px-2 py-1"><span className="text-muted-foreground">Adherence</span> <span className="font-semibold">{weekly.factors.adherence}</span></div>
              <div className="rounded-md bg-muted/40 px-2 py-1"><span className="text-muted-foreground">Pace</span> <span className="font-semibold">{weekly.factors.pace}</span></div>
              <div className="rounded-md bg-muted/40 px-2 py-1"><span className="text-muted-foreground">Buffer</span> <span className="font-semibold">{weekly.factors.salaryBuffer}</span></div>
              <div className="rounded-md bg-muted/40 px-2 py-1"><span className="text-muted-foreground">Cover</span> <span className="font-semibold">{weekly.factors.daysCover}</span></div>
            </div>
          </div>
        </Card>

        {/* AI Weekly Summary */}
        <Card className="p-4 shadow-soft">
          <p className="mb-2 font-display text-sm font-semibold">AI Weekly Summary</p>
          <p className={cn("text-sm font-medium",
            summary.tone === "danger" ? "text-destructive"
            : summary.tone === "warning" ? "text-warning"
            : summary.tone === "success" ? "text-success"
            : "text-foreground")}>
            {summary.headline}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{summary.detail}</p>
        </Card>

        {/* Summary */}
        <Card className="p-4 shadow-soft">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div><p className="text-xs text-muted-foreground">Week Budget</p><p className="mt-1 font-display text-sm font-semibold">{fmt(weekBudget)}</p></div>
            <div><p className="text-xs text-muted-foreground">Spent</p><p className="mt-1 font-display text-sm font-semibold">{fmt(spent)}</p></div>
            <div><p className="text-xs text-muted-foreground">Remaining</p><p className="mt-1 font-display text-sm font-semibold">{fmt(remaining)}</p></div>
          </div>
          <div className="mt-3 text-center">
            <span className={cn("inline-block rounded-full px-3 py-1 text-xs font-medium",
              over ? "bg-destructive/10 text-destructive" : "bg-success/10 text-success")}>
              {over ? "Over Budget ⚠️" : "Under Budget ✅"}
            </span>
          </div>
        </Card>

        {/* Day breakdown */}
        <Card className="p-4 shadow-soft">
          <p className="mb-3 font-display text-sm font-semibold">Day breakdown</p>
          <div className="grid grid-cols-7 gap-2 text-center">
            {days.map(d => (
              <div key={d.label} className="min-w-0">
                <p className="text-[11px] text-muted-foreground">{d.label}</p>
                <p className="mt-1 truncate text-[11px] font-medium">{d.future ? "—" : fmt(d.amount)}</p>
                <span className={cn("mx-auto mt-1.5 block h-2 w-2 rounded-full",
                  d.future ? "bg-muted" : d.over ? "bg-destructive" : "bg-success")} />
              </div>
            ))}
          </div>
        </Card>

        {/* Top categories OR salary survival snapshot when nothing spent */}
        <Card className="p-4 shadow-soft">
          <p className="mb-3 font-display text-sm font-semibold">
            {topCats.length === 0 ? "Salary Survival Snapshot" : "Top categories"}
          </p>
          {topCats.length === 0 ? (
            <div className="grid grid-cols-2 gap-3 text-center sm:grid-cols-4">
              <div>
                <p className="text-[11px] text-muted-foreground">Salary Left</p>
                <p className="mt-1 font-display text-sm font-semibold">{fmt(survival.salaryLeft)}</p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">Safe Daily Spend</p>
                <p className="mt-1 font-display text-sm font-semibold">{fmt(survival.safeDaily)}</p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">Days Until Salary</p>
                <p className="mt-1 font-display text-sm font-semibold">{survival.daysRemaining}</p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">Forecast Balance</p>
                <p className="mt-1 font-display text-sm font-semibold">{fmt(Math.max(0, survival.forecastBalance))}</p>
              </div>
            </div>
          ) : (
            <ul className="space-y-3">
              {topCats.map(c => (
                <li key={c.name}>
                  <div className="flex justify-between text-sm font-medium"><span>{c.name}</span><span>{fmt(c.amount)}</span></div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full" style={{ width: `${c.pct}%`, background: c.color }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Comparison */}
        <Card className="p-4 shadow-soft">
          <p className="mb-1 font-display text-sm font-semibold">Vs. last week</p>
          <p className="text-sm text-foreground">{comparison}</p>
        </Card>
      </div>
    </div>
  );
}
