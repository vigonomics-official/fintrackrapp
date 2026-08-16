import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ShoppingBag, Sparkles, Loader2, ShieldCheck, AlertTriangle, XCircle, HelpCircle } from "lucide-react";
import { useTransactions, useLoans, useProfile, useBudgets, monthKey } from "@/hooks/use-finance";
import { useSalarySettings } from "@/hooks/use-salary-settings";
import { computeSurvival } from "@/lib/survival";
import { formatCurrency } from "@/lib/currency";
import { cn } from "@/lib/utils";
import { getRememberedSavings } from "@/lib/financial-profile";
import { emergencyFundTarget, getSurvivalPreferences } from "@/lib/survival-preferences";
import {
  checkPurchaseAffordability, validatePurchaseInput, decisionLabel,
  type PurchaseCheckResult,
} from "@/lib/purchase-affordability";
import { explainPurchase, type PurchaseNarration } from "@/lib/purchase-explain";

const TONE: Record<string, string> = {
  SAFE: "border-success/30 bg-success/10 text-success",
  CAREFUL: "border-gold/30 bg-gold/10 text-gold-foreground",
  NOT_SAFE: "border-destructive/30 bg-destructive/5 text-destructive",
  INSUFFICIENT_DATA: "border-border bg-muted/40 text-foreground",
};

function DecisionIcon({ decision }: { decision: PurchaseCheckResult["decision"] }) {
  const cls = "h-5 w-5 shrink-0";
  if (decision === "SAFE") return <ShieldCheck className={cls} />;
  if (decision === "CAREFUL") return <AlertTriangle className={cls} />;
  if (decision === "NOT_SAFE") return <XCircle className={cls} />;
  return <HelpCircle className={cls} />;
}

export function PurchaseCheckPanel({ compact = false }: { compact?: boolean }) {
  const { data: profile } = useProfile();
  const { data: transactions = [] } = useTransactions();
  const { data: loans = [] } = useLoans();
  const { data: budgets = [] } = useBudgets(monthKey());
  const { settings: salarySettings } = useSalarySettings();
  const currency = profile?.currency ?? "INR";

  const [item, setItem] = useState("");
  const [priceStr, setPriceStr] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PurchaseCheckResult | null>(null);
  const [narration, setNarration] = useState<PurchaseNarration | null>(null);
  const [loading, setLoading] = useState(false);

  const budgetRemaining = useMemo(() => {
    if (budgets.length === 0) return null;
    const total = budgets.reduce((s, b) => s + b.monthly_limit, 0);
    if (total <= 0) return null;
    const month = monthKey().slice(0, 7);
    const spent = transactions
      .filter((t) => t.type === "expense" && String(t.transaction_date).slice(0, 7) === month)
      .reduce((s, t) => s + t.amount, 0);
    return Math.max(0, total - spent);
  }, [budgets, transactions]);

  const runCheck = async () => {
    const valid = validatePurchaseInput(item, priceStr);
    if (!valid.ok) {
      setError(valid.message);
      setResult(null);
      setNarration(null);
      return;
    }
    setError(null);

    const before = computeSurvival({ transactions, loans, salarySettings, extraSpend: 0 });
    const after = computeSurvival({ transactions, loans, salarySettings, extraSpend: valid.price });
    const prefs = getSurvivalPreferences();
    const res = checkPurchaseAffordability({
      itemName: valid.itemName,
      price: valid.price,
      before,
      after,
      currency,
      savings: getRememberedSavings(),
      emergencyTarget: emergencyFundTarget(before.salary, prefs),
      budgetRemaining,
    });

    setResult(res);
    setNarration({ why: res.why, suggestion: res.suggestion, source: "deterministic" });

    if (res.decision === "INSUFFICIENT_DATA") return;
    setLoading(true);
    try {
      setNarration(await explainPurchase(res));
    } finally {
      setLoading(false);
    }
  };

  const v = result?.values;

  return (
    <div className={cn("space-y-4", compact && "space-y-3")}>
      <Card className="shadow-soft">
        <CardContent className="space-y-2.5 p-4">
          <div className="space-y-1.5">
            <Label htmlFor="pcp-item" className="text-xs">Item name</Label>
            <Input id="pcp-item" placeholder="e.g. New headphones" value={item}
              onChange={(e) => { setItem(e.target.value); setError(null); }} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pcp-price" className="text-xs">Price ({currency})</Label>
            <Input id="pcp-price" type="number" inputMode="decimal" placeholder="2000" value={priceStr}
              onChange={(e) => { setPriceStr(e.target.value); setError(null); }} />
          </div>
          {error && <p className="text-xs font-medium text-destructive">{error}</p>}
          <Button className="w-full" onClick={runCheck} disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShoppingBag className="mr-2 h-4 w-4" />}
            Check Purchase
          </Button>
        </CardContent>
      </Card>

      {result && (
        <>
          <Card className={cn("border shadow-soft", TONE[result.decision])}>
            <CardContent className="flex items-start gap-2.5 p-4">
              <DecisionIcon decision={result.decision} />
              <div className="space-y-1 text-sm">
                <p className="font-display text-base font-bold">{decisionLabel(result.decision)}</p>
                <p className="opacity-90">{narration?.why}</p>
              </div>
            </CardContent>
          </Card>

          {v && Object.keys(v).length > 0 && (
            <Card className="shadow-soft">
              <CardContent className="space-y-2 p-4">
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Financial impact</p>
                <Line label="This purchase" value={formatCurrency(result.purchaseAmount, currency)} />
                {v.salaryLeft != null && (
                  <Line label="Salary left" value={formatCurrency(v.salaryLeft, currency)}
                    after={v.salaryLeftAfter != null ? formatCurrency(v.salaryLeftAfter, currency) : undefined} />
                )}
                {v.safeDailySpend != null && (
                  <Line label="Safe daily spend" value={formatCurrency(v.safeDailySpend, currency)}
                    after={v.safeDailySpendAfter != null ? formatCurrency(v.safeDailySpendAfter, currency) : undefined} />
                )}
                {v.daysRemaining != null && <Line label="Days to salary" value={`${v.daysRemaining}`} />}
                {v.forecastBefore != null && (
                  <Line label="Month-end forecast" value={formatCurrency(v.forecastBefore, currency)}
                    after={v.forecastAfter != null ? formatCurrency(v.forecastAfter, currency) : undefined} />
                )}
                {v.survivalScore != null && (
                  <Line label="Survival Score" value={`${v.survivalScore}/100`}
                    after={v.survivalScoreAfter != null ? `${v.survivalScoreAfter}/100` : undefined} />
                )}
                {v.budgetRemaining != null && <Line label="Budget remaining" value={formatCurrency(v.budgetRemaining, currency)} />}
                {v.emiPressure != null && <Line label="EMI pressure" value={v.emiPressure} />}
              </CardContent>
            </Card>
          )}

          <Card className="shadow-soft">
            <CardContent className="space-y-3 p-4 text-sm">
              <div className="flex items-start gap-2">
                <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <div>
                  <p className="font-semibold">Suggestion</p>
                  <p className="text-muted-foreground">{narration?.suggestion}</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t pt-3 text-xs text-muted-foreground">
                <span>Confidence: <span className="font-medium capitalize text-foreground">{result.confidence}</span></span>
                {result.dataUsed.length > 0 && <span>Data used: {result.dataUsed.join(", ")}</span>}
              </div>
              {result.missing.length > 0 && (
                <p className="text-xs text-muted-foreground">Missing: {result.missing.join(", ")}</p>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function Line({ label, value, after }: { label: string; value: string; after?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="flex items-center gap-1.5 font-medium tabular-nums">
        {after ? (
          <>
            <span className="text-muted-foreground line-through opacity-70">{value}</span>
            <span>→</span>
            <span>{after}</span>
          </>
        ) : (
          <span>{value}</span>
        )}
      </span>
    </div>
  );
}
