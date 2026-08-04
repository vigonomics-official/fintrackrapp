import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useProfile, useTransactions, useLoans } from "@/hooks/use-finance";
import { useSalarySettings } from "@/hooks/use-salary-settings";
import { useSurvivalPreferences } from "@/hooks/use-survival-preferences";
import { computeSurvival } from "@/lib/survival";
import { emergencyFundTarget } from "@/lib/survival-preferences";
import { getRememberedSavings } from "@/lib/financial-profile";
import { formatCurrency } from "@/lib/currency";

/** Emergency Fund progress, shown alongside the Salary Survival Settings. */
export function EmergencyFundProgressCard() {
  const { data: profile } = useProfile();
  const currency = profile?.currency ?? "INR";
  const { settings } = useSalarySettings();
  const { prefs } = useSurvivalPreferences();
  const { data: transactions = [] } = useTransactions();
  const { data: loans = [] } = useLoans();

  const { target, saved, pct } = useMemo(() => {
    const s = computeSurvival({ transactions, loans, salarySettings: settings });
    const t = emergencyFundTarget(s.salary, prefs);
    const sv = getRememberedSavings() ?? 0;
    return { target: t, saved: sv, pct: t > 0 ? Math.min(100, Math.round((sv / t) * 100)) : 0 };
  }, [transactions, loans, settings, prefs]);

  return (
    <Card id="section-emergency-fund" className="space-y-3 p-3 shadow-soft sm:p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold">Emergency Fund Progress</p>
        <span className="text-[11px] text-muted-foreground">{pct}%</span>
      </div>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="text-muted-foreground">Saved vs Target</span>
          <span className="font-medium">
            {target > 0
              ? `${formatCurrency(Math.round(saved), currency)} / ${formatCurrency(Math.round(target), currency)}`
              : "Set a target"}
          </span>
        </div>
        <Progress value={pct} className="h-2" />
      </div>
    </Card>
  );
}
