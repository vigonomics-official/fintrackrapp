// Single source of truth for Safe Daily Spend AND the shared financial metrics
// (Emergency Fund, Savings Rate, Net Worth, savings target, Financial Score)
// across Home, Planner, Insights, Goals and AI Coach.
import { useEffect, useMemo, useState } from "react";
import { useTransactions, useCategories, useProfile, useLoans, useLoanPayments } from "@/hooks/use-finance";
import { useSalarySettings } from "@/hooks/use-salary-settings";
import { useSurvivalPreferences } from "@/hooks/use-survival-preferences";
import { useBills } from "@/lib/bills";
import { computeObligations, savingsCategoryIds, emiCategoryIds } from "@/lib/safe-daily";
import { computeSurvival } from "@/lib/survival";
import { payDayInMonth } from "@/lib/salary-cycle";
import { computeFinancialMetrics } from "@/lib/financial-metrics";
import { loadGoals, GOALS_EVENT, type Goal } from "@/lib/goals-store";
import { getRememberedSavings, onProfileUpdated } from "@/lib/financial-profile";

/** Goals + remembered savings from device storage, read after hydration. */
function useLocalFinance() {
  const [state, setState] = useState<{ goals: Goal[]; saved: number | null }>({ goals: [], saved: null });
  useEffect(() => {
    const read = () => setState({ goals: loadGoals(), saved: getRememberedSavings() });
    read();
    window.addEventListener(GOALS_EVENT, read);
    window.addEventListener("focus", read);
    const off = onProfileUpdated(read);
    return () => {
      window.removeEventListener(GOALS_EVENT, read);
      window.removeEventListener("focus", read);
      off();
    };
  }, []);
  return state;
}

export function useSafeDailySurvival(extraSpend = 0) {
  const { data: profile } = useProfile();
  const { data: transactions = [] } = useTransactions();
  const { data: categories = [] } = useCategories();
  const { data: loans = [] } = useLoans();
  const { data: loanPayments = [] } = useLoanPayments();
  const { bills } = useBills();
  const { settings: salarySettings } = useSalarySettings();
  const { prefs } = useSurvivalPreferences();
  const local = useLocalFinance();
  const currency = profile?.currency ?? "INR";
  const savedAlloc = (profile as any)?.allocation;
  const savingsPct = savedAlloc && typeof savedAlloc.savings === "number" ? savedAlloc.savings : null;

  return useMemo(() => {
    const pre = computeSurvival({ transactions, loans, salarySettings });
    // On payday, nextSalary equals today, which would collapse the obligations
    // window to zero and ignore every upcoming bill/EMI. Reserve against the
    // following payday instead — the money just received must cover that cycle.
    let obligationsNextSalary = pre.nextSalary;
    if (obligationsNextSalary.getTime() <= pre.lastSalaryDate.getTime()) {
      const payDay = salarySettings.payDay;
      obligationsNextSalary =
        payDay != null
          ? payDayInMonth(pre.lastSalaryDate.getFullYear(), pre.lastSalaryDate.getMonth() + 1, payDay)
          : new Date(pre.lastSalaryDate.getFullYear(), pre.lastSalaryDate.getMonth() + 1, 1);
    }
    const saveCats = savingsCategoryIds(categories);
    const obligations = computeObligations({
      transactions,
      bills,
      loans,
      loanPayments,
      emiCategoryIds: emiCategoryIds(categories),
      savingsCategoryIds: saveCats,
      cycleStart: pre.lastSalaryDate,
      nextSalary: obligationsNextSalary,
      salary: pre.salary,
      savingsPct,
    });
    const s = computeSurvival({ transactions, loans, salarySettings, obligations, extraSpend });
    const metrics = computeFinancialMetrics({
      survival: s,
      obligations,
      transactions,
      loans,
      goals: local.goals,
      savingsCategoryIds: saveCats,
      savingsPct,
      rememberedSavings: local.saved,
      prefs,
    });
    // `score` is the one user-facing Financial Score everywhere.
    return { currency, ...s, score: metrics.score.total ?? 0, obligations, metrics };
  }, [transactions, loans, loanPayments, bills, categories, salarySettings, savingsPct, extraSpend, currency, local, prefs]);
}

export type SharedSurvival = ReturnType<typeof useSafeDailySurvival>;
