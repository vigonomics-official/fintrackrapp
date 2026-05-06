import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";
import { useTransactions, useCategories, useProfile } from "@/hooks/use-finance";
import { formatCurrency } from "@/lib/currency";
import { PageHeader } from "@/components/finance/PageHeader";

export const Route = createFileRoute("/_authenticated/reports")({ component: ReportsPage });

function ReportsPage() {
  const { data: txs = [] } = useTransactions();
  const { data: categories = [] } = useCategories();
  const { data: profile } = useProfile();
  const currency = profile?.currency ?? "USD";

  const monthly = useMemo(() => {
    const map = new Map<string, { label: string; income: number; expense: number }>();
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      map.set(`${d.getFullYear()}-${d.getMonth()}`, {
        label: d.toLocaleString(undefined, { month: "short" }),
        income: 0, expense: 0,
      });
    }
    txs.forEach((t) => {
      const d = new Date(t.transaction_date);
      const k = `${d.getFullYear()}-${d.getMonth()}`;
      const m = map.get(k); if (!m) return;
      if (t.type === "income") m.income += t.amount;
      if (t.type === "expense") m.expense += t.amount;
    });
    return [...map.values()];
  }, [txs]);

  const topCats = useMemo(() => {
    const map = new Map<string, { name: string; value: number; color: string }>();
    txs.filter(t => t.type === "expense").forEach((t) => {
      const c = categories.find(x => x.id === t.category_id);
      const name = c?.name ?? "Uncategorized";
      const cur = map.get(name) ?? { name, value: 0, color: c?.color ?? "#94a3b8" };
      cur.value += t.amount;
      map.set(name, cur);
    });
    return [...map.values()].sort((a, b) => b.value - a.value).slice(0, 8);
  }, [txs, categories]);

  const insights = useMemo(() => {
    const out: string[] = [];
    const now = new Date();
    const cur = txs.filter(t => { const d = new Date(t.transaction_date); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear() && t.type === "expense"; });
    const prev = txs.filter(t => { const d = new Date(t.transaction_date); const p = new Date(now.getFullYear(), now.getMonth() - 1, 1); return d.getMonth() === p.getMonth() && d.getFullYear() === p.getFullYear() && t.type === "expense"; });
    const curTotal = cur.reduce((s, t) => s + t.amount, 0);
    const prevTotal = prev.reduce((s, t) => s + t.amount, 0);
    if (prevTotal > 0) {
      const diff = ((curTotal - prevTotal) / prevTotal) * 100;
      if (Math.abs(diff) > 5) out.push(`You ${diff > 0 ? "spent" : "saved"} ${Math.abs(diff).toFixed(0)}% ${diff > 0 ? "more" : "less"} this month than last.`);
    }
    const top = topCats[0];
    if (top) out.push(`Your top expense category is ${top.name} at ${formatCurrency(top.value, currency)}.`);
    const totalIncome = txs.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);
    const totalExpense = txs.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0);
    const rate = totalIncome > 0 ? ((totalIncome - totalExpense) / totalIncome) * 100 : 0;
    if (totalIncome > 0) out.push(`Lifetime savings rate: ${rate.toFixed(0)}%.`);
    return out;
  }, [txs, topCats, currency]);

  return (
    <div>
      <PageHeader title="Reports & Insights" subtitle="Trends, breakdowns and smart observations." />

      <div className="space-y-6 px-6 py-6 md:px-10">
        <Card className="shadow-soft">
          <CardHeader><CardTitle className="flex items-center gap-2 font-display"><Sparkles className="h-4 w-4 text-gold" /> Smart insights</CardTitle></CardHeader>
          <CardContent>
            {insights.length === 0
              ? <p className="text-sm text-muted-foreground">Add a few transactions to start seeing insights.</p>
              : <ul className="space-y-2">{insights.map((i, idx) => <li key={idx} className="rounded-lg border-l-4 border-primary bg-primary/5 px-3 py-2 text-sm">{i}</li>)}</ul>
            }
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardHeader><CardTitle className="font-display">Last 12 months</CardTitle></CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthly}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.9 0.015 140)" />
                <XAxis dataKey="label" stroke="oklch(0.55 0.03 160)" fontSize={12} />
                <YAxis stroke="oklch(0.55 0.03 160)" fontSize={12} />
                <Tooltip formatter={(v: number) => formatCurrency(v, currency)} contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12 }} />
                <Bar dataKey="income" fill="oklch(0.5 0.12 165)" radius={[6, 6, 0, 0]} />
                <Bar dataKey="expense" fill="oklch(0.78 0.12 85)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardHeader><CardTitle className="font-display">Top spending categories</CardTitle></CardHeader>
          <CardContent>
            {topCats.length === 0 ? <p className="text-sm text-muted-foreground">No expenses yet.</p> : (
              <ul className="space-y-3">
                {topCats.map((c) => {
                  const max = topCats[0].value;
                  return (
                    <li key={c.name}>
                      <div className="flex justify-between text-sm font-medium">
                        <span>{c.name}</span>
                        <span>{formatCurrency(c.value, currency)}</span>
                      </div>
                      <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full" style={{ width: `${(c.value / max) * 100}%`, background: c.color }} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
