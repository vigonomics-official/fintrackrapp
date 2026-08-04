import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { useProfile, useTransactions, useLoans } from "@/hooks/use-finance";
import { useSalarySettings } from "@/hooks/use-salary-settings";
import { computeSurvival } from "@/lib/survival";
import { formatCurrency } from "@/lib/currency";

export function FinancialSnapshotCard() {
  const { data: profile } = useProfile();
  const currency = profile?.currency ?? "INR";
  const { settings } = useSalarySettings();
  const { data: transactions = [] } = useTransactions();
  const { data: loans = [] } = useLoans();
  const s = useMemo(
    () => computeSurvival({ transactions, loans, salarySettings: settings }),
    [transactions, loans, settings],
  );

  return (
    <Card id="section-snapshot" className="space-y-3 p-3 shadow-soft sm:p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold">Financial Snapshot</p>
        <span className="text-[11px] text-muted-foreground">Live</span>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Metric label="Survival Score" value={`${s.score}/100`} />
        <Metric label="Salary Left" value={formatCurrency(Math.round(s.salaryLeft), currency)} />
        <Metric
          label="Days Until Payday"
          value={settings.payDay != null ? (s.days === 0 ? "Today" : `${s.days}d`) : "Not set"}
        />
      </div>
    </Card>
  );
}


function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-muted/50 px-2.5 py-2">
      <p className="truncate text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="truncate text-sm font-semibold">{value}</p>
    </div>
  );
}
