import { useEffect } from "react";
import { useSafeDailySurvival } from "@/hooks/use-safe-daily";
import { publishSharedMetrics } from "@/lib/financial-metrics";

/** Keeps the AI Coach analysis engine on the same Financial Score / savings values. */
export function SharedMetricsPublisher() {
  const s = useSafeDailySurvival();
  const score = s.hasIncome ? s.metrics.score.total : null;
  const rate = s.metrics.savings.rate;
  const target = s.metrics.savings.target;
  useEffect(() => {
    publishSharedMetrics({ score, savingsRate: rate, savingsTarget: target });
    return () => publishSharedMetrics(null);
  }, [score, rate, target]);
  return null;
}
