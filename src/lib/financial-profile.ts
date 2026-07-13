// Persistent Financial Profile for the AI Salary Survival Coach.
// Stores values the user shouldn't have to re-enter every analysis:
//   - Monthly Salary, Salary Date, Monthly Rent, Monthly EMI, Financial Goal
//   - Remembered current-account balance and current-savings
//   - Cached last analysis + signature for smart refresh
//
// Provider-agnostic: consumed by coach-autofill and the AI Coach page.
// Safe to swap the mock analysis for a Gemini call without touching this.

import type { CoachAnalysisInput, CoachAnalysisResult, FinancialGoal } from "@/lib/ai-coach-analysis";

const PROFILE_KEY = "fintrackr:ai-coach:profile:v1";
const BALANCE_KEY = "fintrackr:ai-coach:balance:v1";
const SAVINGS_KEY = "fintrackr:ai-coach:savings:v1";
const CACHE_KEY = "fintrackr:ai-coach:analysis-cache:v1";
const PROFILE_UPDATED_EVENT = "fintrackr:ai-coach:profile-updated";

export type FinancialProfile = {
  monthlySalary?: number;
  salaryDate?: string;
  monthlyRent?: number;
  monthlyEmi?: number;
  financialGoal?: FinancialGoal;
  customGoalNote?: string;
  updatedAt?: string;
};

export type CachedAnalysis = {
  signature: string;
  input: CoachAnalysisInput;
  result: CoachAnalysisResult;
  computedAt: string;
};

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function emit() {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new Event(PROFILE_UPDATED_EVENT));
  } catch {
    /* ignore */
  }
}

export function onProfileUpdated(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(PROFILE_UPDATED_EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(PROFILE_UPDATED_EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

export function getFinancialProfile(): FinancialProfile {
  if (typeof window === "undefined") return {};
  return safeParse<FinancialProfile>(localStorage.getItem(PROFILE_KEY)) ?? {};
}

export function updateFinancialProfile(patch: Partial<FinancialProfile>): FinancialProfile {
  const prev = getFinancialProfile();
  const next: FinancialProfile = { ...prev, ...patch, updatedAt: new Date().toISOString() };
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  emit();
  return next;
}

/** Persist the permanent parts of an analysis input into the Financial Profile. */
export function persistProfileFromInput(input: CoachAnalysisInput): void {
  updateFinancialProfile({
    monthlySalary: input.monthlySalary,
    salaryDate: input.salaryDate,
    monthlyRent: input.monthlyRent,
    monthlyEmi: input.monthlyEmi,
    financialGoal: input.financialGoal,
    customGoalNote: input.customGoalNote,
  });
  if (typeof input.currentAccountBalance === "number") setRememberedBalance(input.currentAccountBalance);
  if (typeof input.currentSavings === "number") setRememberedSavings(input.currentSavings);
}

export function getRememberedBalance(): number | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(BALANCE_KEY);
  const n = raw == null ? NaN : Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export function setRememberedBalance(n: number): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(BALANCE_KEY, String(Math.max(0, Math.round(n))));
    emit();
  } catch {
    /* ignore */
  }
}

export function getRememberedSavings(): number | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(SAVINGS_KEY);
  const n = raw == null ? NaN : Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export function setRememberedSavings(n: number): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(SAVINGS_KEY, String(Math.max(0, Math.round(n))));
    emit();
  } catch {
    /* ignore */
  }
}

/** Deterministic signature — used to decide whether to reuse a cached analysis. */
export function computeAnalysisSignature(
  input: CoachAnalysisInput,
  extras: { transactionCount?: number; lastTxDate?: string | null } = {},
): string {
  const parts = [
    input.monthlySalary,
    input.salaryDate,
    input.currentAccountBalance,
    input.monthlyRent,
    input.monthlyFood,
    input.monthlyTransport,
    input.monthlyEmi,
    input.monthlyBills,
    input.monthlyInvestments,
    input.currentSavings,
    input.otherMonthlyExpenses,
    input.financialGoal,
    input.customGoalNote ?? "",
    extras.transactionCount ?? 0,
    extras.lastTxDate ?? "",
  ];
  return parts.join("|");
}

export function getCachedAnalysis(): CachedAnalysis | null {
  if (typeof window === "undefined") return null;
  return safeParse<CachedAnalysis>(localStorage.getItem(CACHE_KEY));
}

export function setCachedAnalysis(entry: CachedAnalysis): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(entry));
    emit();
  } catch {
    /* ignore */
  }
}

export function clearCachedAnalysis(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(CACHE_KEY);
    emit();
  } catch {
    /* ignore */
  }
}
