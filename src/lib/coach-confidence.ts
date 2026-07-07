// Data-confidence scoring for the AI Salary Survival Coach.
// UI-agnostic: takes a (partial) CoachAnalysisInput and returns a score,
// level, message and the list of missing fields. Kept isolated so both the
// results page and the analyze form can share a single source of truth.

import type { CoachAnalysisInput } from "@/lib/ai-coach-analysis";

export type ConfidenceLevel = "empty" | "low" | "medium" | "high";

export type ConfidenceField = {
  key: keyof CoachAnalysisInput;
  label: string;
};

export type ConfidenceResult = {
  score: number; // 0-100
  level: ConfidenceLevel;
  label: string; // e.g. "High Confidence"
  message: string;
  filled: number;
  total: number;
  missing: ConfidenceField[];
};

// The 12 fields we consider "required" for a confident analysis.
export const CONFIDENCE_FIELDS: ConfidenceField[] = [
  { key: "monthlySalary", label: "Monthly Salary" },
  { key: "salaryDate", label: "Salary Date" },
  { key: "currentAccountBalance", label: "Current Account Balance" },
  { key: "monthlyRent", label: "Rent" },
  { key: "monthlyFood", label: "Food" },
  { key: "monthlyTransport", label: "Transport" },
  { key: "monthlyEmi", label: "EMI" },
  { key: "monthlyBills", label: "Bills" },
  { key: "monthlyInvestments", label: "Investments" },
  { key: "currentSavings", label: "Savings" },
  { key: "otherMonthlyExpenses", label: "Other Expenses" },
  { key: "financialGoal", label: "Financial Goal" },
];

function isFieldFilled(key: keyof CoachAnalysisInput, value: unknown): boolean {
  if (value == null) return false;
  if (key === "salaryDate" || key === "financialGoal") {
    return typeof value === "string" && value.trim().length > 0;
  }
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function levelFor(score: number, filled: number): ConfidenceLevel {
  if (filled === 0) return "empty";
  if (score >= 90) return "high";
  if (score >= 70) return "medium";
  return "low";
}

function labelFor(level: ConfidenceLevel): string {
  switch (level) {
    case "high":
      return "High Confidence";
    case "medium":
      return "Medium Confidence";
    case "low":
      return "Low Confidence";
    case "empty":
      return "No Data";
  }
}

function messageFor(level: ConfidenceLevel): string {
  switch (level) {
    case "high":
      return "Your recommendations are based on complete financial data.";
    case "medium":
      return "Some information is missing. Results may be less accurate.";
    case "low":
      return "Add more financial information to improve AI accuracy.";
    case "empty":
      return "No financial data available yet.";
  }
}

export function computeConfidence(input: Partial<CoachAnalysisInput> | null | undefined): ConfidenceResult {
  const total = CONFIDENCE_FIELDS.length;
  const missing: ConfidenceField[] = [];
  let filled = 0;

  for (const f of CONFIDENCE_FIELDS) {
    const v = input ? (input as Record<string, unknown>)[f.key] : undefined;
    if (isFieldFilled(f.key, v)) filled += 1;
    else missing.push(f);
  }

  const score = Math.round((filled / total) * 100);
  const level = levelFor(score, filled);

  return {
    score,
    level,
    label: labelFor(level),
    message: messageFor(level),
    filled,
    total,
    missing,
  };
}

// sessionStorage key used to hand the list of missing fields from the
// results page back to the analyze form so it can highlight them.
export const COACH_CONFIDENCE_MISSING_KEY = "fintrackr:ai-coach:missing-fields";
