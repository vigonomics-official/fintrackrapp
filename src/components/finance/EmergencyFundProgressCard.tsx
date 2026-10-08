import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useSafeDailySurvival } from "@/hooks/use-safe-daily";
import { formatCurrency } from "@/lib/currency";

/** Emergency Fund progress from the shared metrics (only Emergency Fund goal money counts). */
export function EmergencyFundProgressCard() {
  const s = useSafeDailySurvival();
  const e = s.metrics.emergency;
  const currency = s.currency;
  return (
    <Card id="section-emergency-fund" className="space-y-3 p-3 shadow-soft sm:p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold">Emergency Fund Progress</p>
        <span className="text-[11px] text-muted-foreground">{e.status} · {e.pct}%</span>
      </div>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="text-muted-foreground">Saved vs Target</span>
          <span className="font-medium">
            {e.target > 0
              ? `${formatCurrency(Math.round(e.saved), currency)} of ${formatCurrency(Math.round(e.target), currency)}`
              : "Set a target"}
          </span>
        </div>
        <Progress value={e.pct} className="h-2" />
        {e.monthsDisplay != null && e.target > 0 && (
          <p className="text-[11px] text-muted-foreground">
            {e.monthsDisplay.toFixed(1)} of {Number(e.targetMonths.toFixed(1))} months covered
          </p>
        )}
      </div>
    </Card>
  );
}
