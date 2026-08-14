// Intent detection for the AI Salary Survival Coach.
//
// The Coach must answer the QUESTION the user actually asked using FinTrackr
// data — never a generic financial lecture. Every intent below maps to a
// deterministic reply builder that reads real numbers.

export type CoachIntent =
  | "monthStatus" // "How am I doing this month?"
  | "overspend" // "Where am I spending too much?"
  | "affordAmount" // "Can I buy something for ₹2,000?"
  | "saveHowMuch" // "How much can I save?"
  | "safeToday" // "How much can I safely spend today?"
  | "beforeSalary" // "What should I do before salary day?"
  | "emergencyGoal" // "How can I reach my emergency fund goal?"
  | "biggestProblem" // "What is my biggest financial problem?"
  | "compare"
  | "whatIf"
  | "explainMetric"
  | "goalDelay"
  | "afford"
  | "improveScore"
  | "reduceFood"
  | "emergency"
  | "goal"
  | "budget"
  | "reduceFirst"
  | "generic";

/** Rupee amount mentioned in the question, if any. */
export function extractAmount(text: string): number | null {
  const m = text.match(/(?:₹|rs\.?\s*)?(\d[\d,]{2,})/i);
  if (!m) return null;
  const n = Number(m[1].replace(/,/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Investment-flavoured questions get a small contextual note. Normal
 * budgeting / spending / salary questions must NOT show a disclaimer.
 */
export function isInvestmentQuestion(text: string): boolean {
  return /\b(invest|investment|investing|sip|mutual fund|stock|stocks|equity|shares|nifty|crypto|gold bond|fd|fixed deposit|ppf|nps|portfolio|returns?)\b/i.test(
    text,
  );
}

export function classifyIntent(text: string): CoachIntent {
  const q = text.toLowerCase().trim();

  // --- Specific, high-value questions first ---
  if (/(how am i doing|how'?s my month|how is my month|this month.*(doing|going)|monthly (status|summary|update))/.test(q))
    return "monthStatus";
  if (/(spending too much|overspend|spending the most|too much on|leaking|where.*(over)?spending)/.test(q))
    return "overspend";
  if (/(safely spend|safe to spend|spend today|spend per day|daily (spend|limit))/.test(q)) return "safeToday";
  if (/(before salary|until salary|till salary|before payday|salary day)/.test(q) && !/what if/.test(q))
    return "beforeSalary";
  if (/(emergency fund|rainy day fund|safety net).*(goal|reach|build|target)|reach.*emergency/.test(q))
    return "emergencyGoal";
  if (/(biggest|main|worst) (financial )?(problem|issue|risk|mistake|weakness)/.test(q)) return "biggestProblem";
  if (/how much can i save|how much should i save|can i save/.test(q)) return "saveHowMuch";

  // --- Existing intents ---
  if (/\bvs\b|versus|compare/.test(q)) return "compare";
  if (/what if|what-if|whatif/.test(q)) return "whatIf";
  if (
    /explain (my |this )?(score|number|safe daily|safe purchase|savings target|goal forecast)/.test(q) ||
    /why is my survival score/.test(q)
  )
    return "explainMetric";
  if (/(delay|push (out|back)|when should i buy|better date)/.test(q)) return "goalDelay";
  if (/(can i (buy|afford)|afford|buy something|purchase)/.test(q) && extractAmount(q) !== null) return "affordAmount";
  if (/(afford|buy|purchase|phone|laptop|weekend budget|weekend)/.test(q)) return "afford";
  if (/(survival score|improve score|health score|why.*low)/.test(q)) return "improveScore";
  if (/food|grocer|eating|delivery/.test(q)) return "reduceFood";
  if (/emergency|rainy day|safety net|bills due/.test(q)) return "emergency";
  if (/goal|gold|bike|house|vacation|target|sip|investment|mutual fund|invest\b/.test(q)) return "goal";
  if (/budget|breakdown|where.*money|expense.*split/.test(q)) return "budget";
  if (/reduce|cut|which expense|save|first/.test(q)) return "reduceFirst";
  return "generic";
}
