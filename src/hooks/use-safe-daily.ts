// Single source of truth for Safe Daily Spend across Home, Planner and Insights.
// Wires the account's data into computeObligations + computeSurvival so every
// screen reserves the same bills, EMIs and planned savings.
import { useMemo } from "react";
import { useTransactions, useCategories, useProfile, useLoans, useLoanPayments } from "@/hooks/use-finance";
import { useSalarySettings } from "@/hooks/use-salary-settings";
import { useBills } from "@/lib/bills";
import { computeObligations, savingsCategoryIds, emiCategoryIds } from "@/lib/safe-daily";
import { computeSurvival } from "@/lib/survival";

export function useSafeDailySurvival(extraSpend = 0) {
  const { data: profile } = useProfile();
  const { data: transactions = [] } = useTransactions();
  const { data: categories = [] } = useCategories();
  const { data: loans = [] } = useLoans();
  const { data: loanPayments = [] } = useLoanPayments();
  const { bills } = useBills();
  const { settings: salarySettings } = useSalarySettings();
  const currency = profile?.currency ?? "INR";
  const savedAlloc = (profile as any)?.allocation;
  const savingsPct = savedAlloc && typeof savedAlloc.savings === "number" ? savedAlloc.savings : null;

  return useMemo(() => {
    const pre = computeSurvival({ transactions, loans, salarySettings });
    const obligations = computeObligations({
      transactions,
      bills,
      loans,
      loanPayments,
      emiCategoryIds: emiCategoryIds(categories),
      savingsCategoryIds: savingsCategoryIds(categories),
      cycleStart: pre.lastSalaryDate,
      nextSalary: pre.nextSalary,
      salary: pre.salary,
      savingsPct,
    });
    const s = computeSurvival({ transactions, loans, salarySettings, obligations, extraSpend });
    return { currency, ...s, obligations };
  }, [transactions, loans, loanPayments, bills, categories, salarySettings, savingsPct, extraSpend, currency]);
}
