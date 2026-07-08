import { AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { CoachAnalysisInput } from "@/lib/ai-coach-analysis";

export type CoachWarning = { id: string; message: string };

export function computeCoachWarnings(input: Partial<CoachAnalysisInput>): CoachWarning[] {
  const warnings: CoachWarning[] = [];
  const salary = input.monthlySalary;
  const balance = input.currentAccountBalance;
  const savings = input.currentSavings;

  if (salary == null || salary <= 0) {
    warnings.push({ id: "missing-salary", message: "Monthly salary is missing. Analysis needs a salary to be accurate." });
  }
  if (!input.salaryDate) {
    warnings.push({ id: "missing-salary-date", message: "Salary date is missing. Cash-flow timing may be off." });
  }
  if (typeof balance === "number" && balance < 0) {
    warnings.push({ id: "negative-balance", message: "Your current account balance is negative." });
  }

  const expenses =
    (input.monthlyRent ?? 0) +
    (input.monthlyFood ?? 0) +
    (input.monthlyTransport ?? 0) +
    (input.monthlyEmi ?? 0) +
    (input.monthlyBills ?? 0) +
    (input.monthlyInvestments ?? 0) +
    (input.otherMonthlyExpenses ?? 0);

  if (typeof salary === "number" && salary > 0 && expenses > salary) {
    warnings.push({
      id: "expenses-gt-salary",
      message: "We detected expenses greater than your salary. Recommendations may not be accurate.",
    });
  }
  if (typeof salary === "number" && salary > 0 && typeof savings === "number" && savings >= 0 && savings < salary * 0.5) {
    warnings.push({ id: "low-savings", message: "Your savings are very low compared to your monthly salary." });
  }
  return warnings;
}

export function CoachSmartWarnings({ warnings }: { warnings: CoachWarning[] }) {
  if (warnings.length === 0) return null;
  return (
    <Card className="border-gold/40 bg-gold/5 p-3 shadow-soft">
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
        <div className="min-w-0 flex-1">
          <p className="font-display text-xs font-semibold text-gold">Before you analyze</p>
          <ul className="mt-1 space-y-0.5">
            {warnings.map((w) => (
              <li key={w.id} className="text-[11px] leading-relaxed text-muted-foreground">
                • {w.message}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Card>
  );
}
