import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { Sparkles, AlertTriangle, LineChart, ChevronRight, BarChart3, FileBarChart, CalendarDays } from "lucide-react";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/finance/PageHeader";
import { PageShell, PageContainer } from "@/components/finance/PageContainer";
import { cn } from "@/lib/utils";
import { useTransactions, useCategories, useBudgets, useLoans, useProfile, monthKey } from "@/hooks/use-finance";
import { useSalarySettings } from "@/hooks/use-salary-settings";
import { computeSurvival } from "@/lib/survival";
import { formatCurrency } from "@/lib/currency";

export const Route = createFileRoute("/_authenticated/insights")({
  component: InsightsPage,
  head: () => ({
    meta: [
      { title: "Insights — FinTrackr" },
      { name: "description", content: "Smart spending insights, danger alerts, and weekly survival reports." },
      { property: "og:title", content: "Insights — FinTrackr" },
      { property: "og:description", content: "Smart spending insights, danger alerts, and weekly survival reports." },
      { property: "og:url", content: "https://fintrackrapp.lovable.app/insights" },
      { name: "twitter:title", content: "Insights — FinTrackr" },
      { name: "twitter:description", content: "Smart spending insights, danger alerts, and weekly survival reports." },
    ],
    links: [{ rel: "canonical", href: "https://fintrackrapp.lovable.app/insights" }],
  }),
});

function startOfWeek(d: Date) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - day);
  return x;
}

function InsightsPage() {
  const { data: txs = [] } = useTransactions();
  const { data: categories = [] } = useCategories();
  const { data: budgets = [] } = useBudgets(monthKey());
  const { data: loans = [] } = useLoans();
  const { data: profile } = useProfile();
  const { settings } = useSalarySettings();
  const currency = profile?.currency ?? "INR";

  const now = useMemo(() => new Date(), []);
  const hasData = txs.length > 0;

  const survival = useMemo(
    () => computeSurvival({ transactions: txs, loans, salarySettings: settings, now }),
    [txs, loans, settings, now],
  );

  // Cycle progress
  const cycle = useMemo(() => {
    const msPerDay = 86_400_000;
    const totalDays = Math.max(
      1,
      Math.round((survival.nextSalary.getTime() - survival.lastSalaryDate.getTime()) / msPerDay),
    );
    const elapsed = Math.min(totalDays, Math.max(1, totalDays - survival.daysRemaining));
    const pct = Math.min(100, Math.round((elapsed / totalDays) * 100));
    return { totalDays, elapsed, pct };
  }, [survival]);

  // Alert count (mirrors logic of alerts page, lightly)
  const alertCount = useMemo(() => {
    let n = 0;
    if (survival.hasIncome && survival.salary > 0 && survival.salaryLeft / survival.salary < 0.3 && survival.daysRemaining > 0) n++;
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    loans.forEach((l: any) => {
      if (Number(l.remaining_balance) <= 0) return;
      const day = Math.min(Math.max(1, l.due_day || 1), 28);
      let due = new Date(today.getFullYear(), today.getMonth(), day);
      if (due < today) due = new Date(today.getFullYear(), today.getMonth() + 1, day);
      const days = Math.round((due.getTime() - today.getTime()) / 86_400_000);
      if (days <= 5) n++;
    });
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
      if (spent >= b.monthly_limit) n++;
    });
    return n;
  }, [survival, loans, txs, budgets, now]);

  // Week spend
  const weekSpend = useMemo(() => {
    const ws = startOfWeek(now);
    return txs
      .filter(t => t.type === "expense" && new Date(t.transaction_date) >= ws)
      .reduce((s, t) => s + t.amount, 0);
  }, [txs, now]);

  // Top category (this month)
  const topCategory = useMemo(() => {
    const ym = `${now.getFullYear()}-${now.getMonth()}`;
    const map = new Map<string, number>();
    txs.filter(t => t.type === "expense").forEach(t => {
      const d = new Date(t.transaction_date);
      if (`${d.getFullYear()}-${d.getMonth()}` !== ym) return;
      const k = t.category_id ?? "uncategorized";
      map.set(k, (map.get(k) ?? 0) + t.amount);
    });
    const top = [...map.entries()].sort((a, b) => b[1] - a[1])[0];
    if (!top) return null;
    return categories.find(c => c.id === top[0])?.name ?? "Uncategorized";
  }, [txs, categories, now]);

  const cycleFinished = survival.daysRemaining === 0;
  const reportReady = now.getDate() >= 25;
  const monthLabel = now.toLocaleString(undefined, { month: "long", year: "numeric" });

  return (
    <PageShell>
      <PageHeader title="Insights" subtitle="Your money, decoded." />

      <PageContainer>
        {/* Summary card */}
        <div
          className="mb-4 rounded-2xl border border-success/20 bg-success/10 p-4 shadow-soft"
          style={{ borderRadius: 16 }}
        >
          <div className="mb-3 flex items-center gap-1.5 text-xs font-medium text-foreground/80">
            <CalendarDays className="h-3.5 w-3.5" />
            <span>📅 {monthLabel}</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Survival Score</p>
              <p className="mt-0.5 font-display text-2xl font-bold text-foreground">
                {survival.hasIncome ? `${survival.score}` : "—"}
                {survival.hasIncome && <span className="text-sm font-medium text-muted-foreground">/100</span>}
              </p>
            </div>
            <div className="min-w-0 text-right">
              <p className="text-xs text-muted-foreground">Days Left</p>
              <p className="mt-0.5 font-display text-2xl font-bold text-foreground">
                {survival.daysRemaining}
                <span className="ml-1 text-sm font-medium text-muted-foreground">days</span>
              </p>
            </div>
          </div>
          <div className="mt-3">
            <div className="mb-1 flex justify-between text-[11px] text-muted-foreground">
              <span>Day {cycle.elapsed} / {cycle.totalDays}</span>
              <span>{cycle.pct}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-background/60">
              <div className="h-full rounded-full bg-success transition-all" style={{ width: `${cycle.pct}%` }} />
            </div>
          </div>
        </div>

        {!hasData && (
          <Card className="mb-2 p-5 text-center shadow-soft">
            <p className="text-sm font-semibold">No spending data yet</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Start tracking your expenses to unlock personalized insights.
            </p>
          </Card>
        )}

        <div className="space-y-2">
          {/* Card 1 — AI Financial Coach (featured) */}
          <Link to="/insights/coach" preload="intent">
            <Card
              className="relative flex items-center gap-3 overflow-hidden border-0 p-4 text-white shadow-soft transition-transform active:scale-[0.99]"
              style={{ background: "linear-gradient(135deg, oklch(0.55 0.13 165) 0%, oklch(0.42 0.12 170) 100%)" }}
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/15 backdrop-blur">
                <Sparkles className="h-5 w-5" strokeWidth={2} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate font-display text-sm font-semibold">AI Financial Coach</p>
                  <span className="rounded-full bg-white/25 px-1.5 py-0.5 text-[10px] font-bold tracking-wide">NEW</span>
                </div>
                <p className="mt-0.5 truncate text-xs text-white/85">
                  Personalized money advice based on your spending.
                </p>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-white/80" />
            </Card>
          </Link>

          {/* Card 2 — Monthly Report Card */}
          <Link to="/insights/report" preload="intent">
            <Card className="relative flex items-center gap-3 overflow-hidden p-3.5 pl-4 shadow-soft transition-colors hover:bg-muted/30">
              <span className="absolute left-0 top-0 h-full w-1.5 bg-success" />
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-success/10 text-success">
                <FileBarChart className="h-5 w-5" strokeWidth={1.8} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">Monthly Report Card</p>
                <p className="truncate text-xs text-muted-foreground">Your monthly financial summary</p>
              </div>
              {cycleFinished ? (
                <span className="shrink-0 rounded-full bg-success/15 px-2 py-0.5 text-[11px] font-semibold text-success">Ready</span>
              ) : (
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              )}
            </Card>
          </Link>


          {/* Card 4 — Danger Alerts */}
          <InsightLink
            to="/insights/alerts"
            icon={<AlertTriangle className="h-5 w-5" strokeWidth={1.8} />}
            tone="bg-destructive/10 text-destructive"
            title="Danger Alerts"
            subtitle="Low funds, EMI pressure & weekend risk."
            trailing={
              alertCount > 0 ? (
                <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-semibold text-destructive">
                  <span className="h-1.5 w-1.5 rounded-full bg-destructive" />
                  {alertCount} Alert{alertCount === 1 ? "" : "s"}
                </span>
              ) : (
                <span className="shrink-0 text-[11px] font-semibold text-success">All Clear</span>
              )
            }
          />

          {/* Card 5 — Weekly Survival Report */}
          <InsightLink
            to="/insights/weekly"
            icon={<LineChart className="h-5 w-5" strokeWidth={1.8} />}
            tone="bg-success/10 text-success"
            title="Weekly Survival Report"
            subtitle="How your week went vs your safe limit."
            trailing={
              <div className="shrink-0 text-right">
                <p className="text-[10px] text-muted-foreground">Week Spend</p>
                <p className="text-xs font-semibold">{formatCurrency(weekSpend, currency)}</p>
              </div>
            }
          />

          {/* Card 6 — Spending Behavior */}
          <InsightLink
            to="/insights/behavior"
            icon={<BarChart3 className="h-5 w-5" strokeWidth={1.8} />}
            tone="bg-gold/15 text-gold-foreground"
            title="Spending Behavior"
            subtitle="Where your money quietly slips away."
            trailing={
              topCategory ? (
                <div className="shrink-0 text-right">
                  <p className="text-[10px] text-muted-foreground">Top Category</p>
                  <p className="max-w-[100px] truncate text-xs font-semibold">{topCategory}</p>
                </div>
              ) : undefined
            }
          />
        </div>
      </PageContainer>
    </PageShell>
  );
}

function InsightLink({
  to, icon, tone, title, subtitle, trailing,
}: {
  to: string;
  icon: React.ReactNode;
  tone: string;
  title: string;
  subtitle: string;
  trailing?: React.ReactNode;
}) {
  return (
    <Link to={to} preload="intent">
      <Card className="flex items-center gap-3 p-3.5 shadow-soft transition-colors hover:bg-muted/30">
        <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl", tone)}>
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{title}</p>
          <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
        </div>
        {trailing ?? <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
      </Card>
    </Link>
  );
}
