import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/currency";
import type { Budget, Category, Transaction } from "@/hooks/use-finance";
import { TrendingDown, TrendingUp } from "lucide-react";

type Props = {
  range: "week" | "month" | "year" | "custom";
  currency: string;
  rangeTxs: Transaction[];        // already filtered to current range
  prevRangeTxs: Transaction[];    // same length window before current
  allTxs: Transaction[];          // for yearly view
  categories: Category[];
  budgets?: Budget[];
};

function topCategoryTotals(txs: Transaction[], categories: Category[], limit = 4) {
  const map = new Map<string, number>();
  txs.filter(t => t.type === "expense").forEach(t => {
    const k = t.category_id ?? "uncategorized";
    map.set(k, (map.get(k) ?? 0) + t.amount);
  });
  return [...map.entries()]
    .map(([id, amt]) => {
      const c = categories.find(x => x.id === id);
      return { id, name: c?.name ?? "Other", color: c?.color ?? "#94a3b8", amount: amt };
    })
    .sort((a, b) => b.amount - a.amount)
    .slice(0, limit);
}

export function SpendingOverview({ range, currency, rangeTxs, prevRangeTxs, allTxs, categories, budgets = [] }: Props) {
  const income = useMemo(() => rangeTxs.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0), [rangeTxs]);
  const expense = useMemo(() => rangeTxs.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0), [rangeTxs]);
  const remaining = income - expense;
  const topCats = useMemo(() => topCategoryTotals(rangeTxs, categories), [rangeTxs, categories]);
  const maxCat = topCats[0]?.amount ?? 1;

  // Daily average + survival status (for month/lastMonth)
  const days = useMemo(() => {
    const dates = new Set(rangeTxs.map(t => t.transaction_date));
    return Math.max(dates.size, 1);
  }, [rangeTxs]);
  const dailyAvg = expense / days;
  const expenseCount = rangeTxs.filter(t => t.type === "expense").length;

  // Comparison vs previous window
  const prevExpense = prevRangeTxs.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const comparisons = useMemo(() => {
    const cur = new Map<string, number>();
    const prev = new Map<string, number>();
    rangeTxs.filter(t => t.type === "expense").forEach(t => {
      const k = t.category_id ?? "uncategorized";
      cur.set(k, (cur.get(k) ?? 0) + t.amount);
    });
    prevRangeTxs.filter(t => t.type === "expense").forEach(t => {
      const k = t.category_id ?? "uncategorized";
      prev.set(k, (prev.get(k) ?? 0) + t.amount);
    });
    const rows: { name: string; pct: number; up: boolean }[] = [];
    for (const [id, amt] of cur) {
      const p = prev.get(id) ?? 0;
      if (p === 0 && amt === 0) continue;
      const name = categories.find(c => c.id === id)?.name ?? "Other";
      if (p === 0) { rows.push({ name, pct: 100, up: true }); continue; }
      const pct = Math.round(((amt - p) / p) * 100);
      if (Math.abs(pct) < 8) continue;
      rows.push({ name, pct, up: pct > 0 });
    }
    return rows.sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct)).slice(0, 3);
  }, [rangeTxs, prevRangeTxs, categories]);

  // Status based on monthly budget consumption
  const totalBudget = budgets.reduce((s, b) => s + (b.monthly_limit || 0), 0);
  const budgetRatio = totalBudget > 0 ? expense / totalBudget : 0;
  const status =
    totalBudget === 0
      ? { dot: "bg-muted-foreground", label: "Tracking" }
      : budgetRatio < 0.3
      ? { dot: "bg-success", label: "On Track" }
      : budgetRatio <= 0.7
      ? { dot: "bg-gold", label: "Moderate" }
      : { dot: "bg-destructive", label: "Tight" };

  // Yearly stats
  const yearly = useMemo(() => {
    if (range !== "year") return null;
    const year = new Date().getFullYear();
    const inYear = allTxs.filter(t => new Date(t.transaction_date).getFullYear() === year);
    const expenses = inYear.filter(t => t.type === "expense");
    const byMonth = new Array(12).fill(0);
    expenses.forEach(t => {
      byMonth[new Date(t.transaction_date).getMonth()] += t.amount;
    });
    let maxMonth = 0;
    byMonth.forEach((v, i) => { if (v > byMonth[maxMonth]) maxMonth = i; });
    const top = topCategoryTotals(inYear, categories, 1)[0];
    const totalExp = expenses.reduce((s, t) => s + t.amount, 0);
    const activeMonths = byMonth.filter(v => v > 0).length || 1;
    const avgMonthly = totalExp / activeMonths;
    const largest = expenses.reduce<Transaction | null>(
      (acc, t) => (!acc || t.amount > acc.amount ? t : acc),
      null
    );
    const largestCatName = largest
      ? (categories.find(c => c.id === largest.category_id)?.name ?? "Other")
      : "—";
    return {
      highestMonth: byMonth[maxMonth] > 0
        ? new Date(year, maxMonth, 1).toLocaleString(undefined, { month: "long" })
        : "—",
      highestMonthAmt: byMonth[maxMonth],
      topCat: top?.name ?? "—",
      topCatAmt: top?.amount ?? 0,
      avgMonthly,
      largestAmt: largest?.amount ?? 0,
      largestCatName,
      largestDate: largest?.transaction_date ?? "",
      byMonth,
    };
  }, [range, allTxs, categories]);

  const rangeLabel = {
    week: "this week",
    month: "this month",
    year: "this year",
    custom: "selected period",
  }[range];

  const headingLabel = {
    week: "This Week's Spending",
    month: "This Month's Spending",
    year: "This Year's Spending",
    custom: "Selected Period Spending",
  }[range];

  const spentLabel = {
    week: "THIS WEEK",
    month: "THIS MONTH",
    year: "THIS YEAR",
    custom: "TOTAL SPENT",
  }[range];

  const formatAmount = (amount: number) => {
    const abs = Math.abs(amount);
    if (abs >= 100000) {
      return '₹' + (abs / 100000).toFixed(2) + 'L';
    }
    if (abs >= 1000) {
      return '₹' + Math.round(abs).toLocaleString('en-IN');
    }
    return '₹' + Math.round(abs);
  };

  return (
    <div className="space-y-3">
      {/* This month's spending */}
      <Card className="shadow-soft">
        <CardContent className="space-y-3 p-4">
          <div className="flex items-baseline justify-between gap-2">
            <p className="min-w-0 truncate text-sm font-semibold">{headingLabel}</p>
            <p className="shrink-0 text-[11px] text-muted-foreground">{rangeLabel}</p>
          </div>

          <div className="flex items-baseline gap-3">
            <div style={{ flex: 1, minWidth: 0 }} />
            <div
              className="text-right"
              style={{ width: "auto", minWidth: 0, maxWidth: "100%", overflow: "hidden" }}
            >
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{spentLabel}</p>
              <p
                className="font-display font-bold tabular-nums"
                style={{
                  color: "#374151",
                  fontSize: "clamp(18px, 4vw, 32px)",
                  lineHeight: 1.1,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  maxWidth: "100%",
                }}
                title={formatCurrency(Math.abs(expense), currency)}
              >
                {formatAmount(expense)}
              </p>
            </div>
          </div>



          {topCats.length > 0 ? (
            <ul className="space-y-2 pt-1">
              {topCats.map((c) => {
                const pct = Math.min(100, Math.round((c.amount / maxCat) * 100));
                return (
                  <li key={c.id} className="min-w-0">
                    <div className="mb-1 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 text-[13px]">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: c.color }} />
                        <span className="truncate font-medium">{c.name}</span>
                      </span>
                      <span className="shrink-0 text-right font-display tabular-nums">
                        {formatCurrency(c.amount, currency)}
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: c.color }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="py-2 text-center text-xs text-muted-foreground">No spending {rangeLabel} yet.</p>
          )}
        </CardContent>
      </Card>

      {/* Stats grid */}
      {expense > 0 && (
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col justify-center rounded-2xl bg-white p-4 shadow-soft min-w-0">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Total Spent</p>
            <p className="truncate font-display text-base font-bold tabular-nums">{formatCurrency(expense, currency)}</p>
          </div>
          <div className="flex flex-col justify-center rounded-2xl bg-white p-4 shadow-soft min-w-0">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Daily Average</p>
            <p className="truncate font-display text-base font-bold tabular-nums">{formatCurrency(dailyAvg, currency)}</p>
          </div>
          <div className="flex flex-col justify-center rounded-2xl bg-white p-4 shadow-soft min-w-0">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Highest Category</p>
            <p className="truncate text-sm font-semibold">{topCats[0]?.name ?? "—"}</p>
            <p className="truncate text-[11px] tabular-nums text-muted-foreground">{topCats[0] ? formatCurrency(topCats[0].amount, currency) : ""}</p>
          </div>
          <div className="flex flex-col justify-center rounded-2xl bg-white p-4 shadow-soft min-w-0">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Total Transactions</p>
            <p className="truncate font-display text-base font-bold tabular-nums">{expenseCount}</p>
          </div>
        </div>
      )}

      {/* Comparison */}
      {comparisons.length > 0 && range !== "year" && days >= 10 && rangeTxs.length >= 5 && prevExpense > 0 && (
        <Card className="shadow-soft">
          <CardContent className="space-y-2 p-4">
            <div className="flex items-baseline justify-between">
              <p className="text-sm font-semibold">Compared to last period</p>
              <p className="text-[11px] tabular-nums text-muted-foreground">
                {prevExpense > 0 ? `${expense >= prevExpense ? "+" : ""}${Math.round(((expense - prevExpense) / prevExpense) * 100)}% total` : ""}
              </p>
            </div>
            <ul className="space-y-1.5">
              {comparisons.map((c) => (
                <li key={c.name} className="flex items-center justify-between text-[13px]">
                  <span className="font-medium">{c.name}</span>
                  <span className={`flex items-center gap-1 font-medium tabular-nums ${c.up ? "text-destructive" : "text-success"}`}>
                    {c.up ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                    {c.up ? "+" : ""}{c.pct}%
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Yearly view */}
      {range === "year" && yearly && (
        <Card className="shadow-soft">
          <CardContent className="space-y-3 p-4">
            <p className="text-sm font-semibold">Year so far</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Highest month</p>
                <p className="text-sm font-semibold">{yearly.highestMonth}</p>
                <p className="truncate text-[11px] tabular-nums text-muted-foreground">{formatCurrency(yearly.highestMonthAmt, currency)}</p>
              </div>
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Biggest category</p>
                <p className="truncate text-sm font-semibold">{yearly.topCat}</p>
                <p className="truncate text-[11px] tabular-nums text-muted-foreground">{formatCurrency(yearly.topCatAmt, currency)}</p>
              </div>
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Total EMI</p>
                <p className="truncate font-display text-sm font-bold tabular-nums">{formatCurrency(yearly.emi, currency)}</p>
              </div>
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Total savings</p>
                <p className="truncate font-display text-sm font-bold tabular-nums text-success">{formatCurrency(yearly.savings, currency)}</p>
              </div>
            </div>
            {/* mini trend */}
            <div className="flex h-12 items-end gap-1 pt-1">
              {yearly.byMonth.map((v, i) => {
                const max = Math.max(...yearly.byMonth, 1);
                const h = Math.max(4, Math.round((v / max) * 100));
                const now = new Date().getMonth();
                return (
                  <div
                    key={i}
                    className={`flex-1 rounded-sm ${i === now ? "bg-primary" : "bg-muted-foreground/30"}`}
                    style={{ height: `${h}%` }}
                    title={`${new Date(2000, i, 1).toLocaleString(undefined, { month: "short" })}: ${formatCurrency(v, currency)}`}
                  />
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
