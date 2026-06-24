import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/finance/PageHeader";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { useTransactions, useProfile } from "@/hooks/use-finance";
import { formatCurrency } from "@/lib/currency";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/insights/behavior")({
  component: BehaviorPage,
  head: () => ({ meta: [{ title: "Spending Behavior — FinTrackr" }] }),
});

function BehaviorPage() {
  const { data: txs = [] } = useTransactions();
  const { data: profile } = useProfile();
  const currency = profile?.currency ?? "INR";

  const expenses = useMemo(() => txs.filter(t => t.type === "expense"), [txs]);

  // Day-of-week (last 30 days)
  const now = new Date();
  const cutoff = new Date(now); cutoff.setDate(cutoff.getDate() - 30);
  const dowLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const dowData = useMemo(() => {
    const arr = [0, 0, 0, 0, 0, 0, 0];
    expenses.forEach(t => {
      const d = new Date(t.transaction_date);
      if (d < cutoff) return;
      const idx = (d.getDay() + 6) % 7;
      arr[idx] += t.amount;
    });
    const max = Math.max(...arr, 1);
    return arr.map((v, i) => ({ label: dowLabels[i], amount: v, pct: (v / max) * 100, top: v === Math.max(...arr) && v > 0 }));
  }, [expenses, cutoff]);

  // Time-of-day (uses created_at since transaction_date is a date)
  const timeBuckets = useMemo(() => {
    const buckets = { morning: 0, afternoon: 0, evening: 0 };
    expenses.forEach(t => {
      const d = new Date((t as any).created_at);
      const h = d.getHours();
      if (h >= 6 && h < 12) buckets.morning += t.amount;
      else if (h >= 12 && h < 18) buckets.afternoon += t.amount;
      else if (h >= 18 && h < 24) buckets.evening += t.amount;
    });
    const total = buckets.morning + buckets.afternoon + buckets.evening;
    const pct = (v: number) => total > 0 ? Math.round((v / total) * 100) : 0;
    return [
      { label: "Morning", sub: "6am–12pm", amount: buckets.morning, pct: pct(buckets.morning) },
      { label: "Afternoon", sub: "12pm–6pm", amount: buckets.afternoon, pct: pct(buckets.afternoon) },
      { label: "Evening", sub: "6pm–12am", amount: buckets.evening, pct: pct(buckets.evening) },
    ];
  }, [expenses]);

  // Small spends (< 200) this month
  const ym = `${now.getFullYear()}-${now.getMonth()}`;
  const smallSpends = useMemo(() => {
    const items = expenses.filter(t => {
      const d = new Date(t.transaction_date);
      return `${d.getFullYear()}-${d.getMonth()}` === ym && t.amount < 200;
    });
    const total = items.reduce((s, t) => s + t.amount, 0);
    const map = new Map<string, { count: number; total: number }>();
    items.forEach(t => {
      const key = (t.notes?.trim() || (t as any).subcategory || "Misc") as string;
      const cur = map.get(key) ?? { count: 0, total: 0 };
      cur.count += 1; cur.total += t.amount;
      map.set(key, cur);
    });
    const top = [...map.entries()].sort((a, b) => b[1].count - a[1].count).slice(0, 5);
    return { count: items.length, total, top };
  }, [expenses, ym]);

  // Monthly trend (last 3 months)
  const trend = useMemo(() => {
    const months: { key: string; label: string; total: number }[] = [];
    for (let i = 2; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({
        key: `${d.getFullYear()}-${d.getMonth()}`,
        label: d.toLocaleString(undefined, { month: "short" }),
        total: 0,
      });
    }
    expenses.forEach(t => {
      const d = new Date(t.transaction_date);
      const k = `${d.getFullYear()}-${d.getMonth()}`;
      const m = months.find(x => x.key === k);
      if (m) m.total += t.amount;
    });
    let direction: "Increasing" | "Stable" | "Decreasing" = "Stable";
    if (months[0].total > 0) {
      const diff = (months[2].total - months[0].total) / months[0].total;
      if (diff > 0.1) direction = "Increasing";
      else if (diff < -0.1) direction = "Decreasing";
    }
    return { months, direction };
  }, [expenses, now]);

  return (
    <div className="w-full overflow-x-hidden">
      <PageHeader title="Spending Behavior" subtitle="Where your money quietly slips away" />
      <div className="mx-auto w-full max-w-3xl space-y-4 px-4 py-5 sm:px-6 md:px-10">

        {/* Section 1 — Day of week */}
        <Card className="p-4 shadow-soft">
          <p className="mb-3 font-display text-sm font-semibold">Spending by day of week</p>
          {expenses.length === 0 ? <Empty text="No expenses yet." /> : (
            <div className="space-y-2">
              {dowData.map(d => (
                <div key={d.label} className="flex items-center gap-3">
                  <span className={cn("w-10 text-xs font-medium", d.top && "text-primary")}>{d.label}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                    <div className={cn("h-full rounded-full", d.top ? "bg-primary" : "bg-primary/40")} style={{ width: `${d.pct}%` }} />
                  </div>
                  <span className="w-20 text-right text-xs">{formatCurrency(d.amount, currency)}</span>
                </div>
              ))}
              <p className="pt-1 text-xs text-muted-foreground">Highlighted bar = highest spend day (last 30 days).</p>
            </div>
          )}
        </Card>

        {/* Section 2 — Time of day */}
        <Card className="p-4 shadow-soft">
          <p className="mb-3 font-display text-sm font-semibold">Time of day analysis</p>
          {expenses.length === 0 ? <Empty text="No expenses yet." /> : (
            <div className="grid grid-cols-3 gap-3 text-center">
              {timeBuckets.map(b => (
                <div key={b.label} className="rounded-lg border bg-muted/30 p-3">
                  <p className="text-xs font-medium">{b.label}</p>
                  <p className="text-[10px] text-muted-foreground">{b.sub}</p>
                  <p className="mt-1 truncate font-display text-sm font-semibold">{formatCurrency(b.amount, currency)}</p>
                  <p className="text-xs text-muted-foreground">{b.pct}%</p>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Section 3 — Small spend analysis */}
        <Card className="p-4 shadow-soft">
          <p className="mb-3 font-display text-sm font-semibold">Small spend analysis</p>
          {smallSpends.count === 0 ? <Empty text={`No small purchases (under ${formatCurrency(200, currency)}) this month.`} /> : (
            <>
              <p className="text-sm">You made <b>{smallSpends.count}</b> small purchases this month totaling <b>{formatCurrency(smallSpends.total, currency)}</b>.</p>
              {smallSpends.top.length > 0 && (
                <ul className="mt-3 space-y-1.5">
                  {smallSpends.top.map(([name, v]) => (
                    <li key={name} className="flex justify-between text-xs">
                      <span className="truncate text-muted-foreground">{name} <span className="opacity-60">×{v.count}</span></span>
                      <span className="font-medium">{formatCurrency(v.total, currency)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </Card>

        {/* Section 4 — Monthly trend */}
        <Card className="p-4 shadow-soft">
          <div className="mb-2 flex items-center justify-between">
            <p className="font-display text-sm font-semibold">Monthly trend</p>
            <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium",
              trend.direction === "Increasing" ? "bg-destructive/10 text-destructive" :
              trend.direction === "Decreasing" ? "bg-success/10 text-success" :
              "bg-muted text-muted-foreground")}>
              {trend.direction}
            </span>
          </div>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend.months}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.9 0.015 140)" />
                <XAxis dataKey="label" stroke="oklch(0.55 0.03 160)" fontSize={12} />
                <YAxis stroke="oklch(0.55 0.03 160)" fontSize={12} />
                <Tooltip formatter={(v: number) => formatCurrency(v, currency)} contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12 }} />
                <Line type="monotone" dataKey="total" stroke="oklch(0.5 0.12 165)" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="text-xs text-muted-foreground">{text}</p>;
}
