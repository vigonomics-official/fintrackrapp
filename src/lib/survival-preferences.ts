/**
 * Survival Preferences — user-tunable knobs that drive every survival
 * calculation in FinTrackr (Dashboard, Planner, Insights, AI Coach,
 * Weekly Report, Financial Freedom, Notifications).
 *
 * Stored in localStorage and broadcast through the same events the rest of
 * the app already listens to, so a change instantly re-renders every screen.
 */

export type EmergencyFundMode = "3m" | "6m" | "custom";
export type SafeDailyMethod = "equal" | "smart" | "weekend";
export type WeeklyBudgetMethod = "equal" | "adaptive" | "remaining";

export type ScoreWeights = {
  emergency: boolean;
  savings: boolean;
  debt: boolean;
  discipline: boolean;
};

export type SurvivalPreferences = {
  emergencyFundMode: EmergencyFundMode;
  /** Only used when emergencyFundMode === "custom". */
  emergencyFundCustom: number | null;
  safeDailyMethod: SafeDailyMethod;
  weeklyBudgetMethod: WeeklyBudgetMethod;
  scoreWeights: ScoreWeights;
};

export const DEFAULT_PREFERENCES: SurvivalPreferences = {
  emergencyFundMode: "6m",
  emergencyFundCustom: null,
  safeDailyMethod: "equal",
  weeklyBudgetMethod: "equal",
  scoreWeights: { emergency: true, savings: true, debt: true, discipline: true },
};

const KEY = "fintrackr:survival-preferences:v1";
const EVENT = "fintrackr:survival-preferences-updated";

export function getSurvivalPreferences(): SurvivalPreferences {
  if (typeof window === "undefined") return DEFAULT_PREFERENCES;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_PREFERENCES;
    const parsed = JSON.parse(raw) as Partial<SurvivalPreferences>;
    return {
      ...DEFAULT_PREFERENCES,
      ...parsed,
      scoreWeights: { ...DEFAULT_PREFERENCES.scoreWeights, ...(parsed.scoreWeights ?? {}) },
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function updateSurvivalPreferences(
  patch: Partial<SurvivalPreferences>,
): SurvivalPreferences {
  const next: SurvivalPreferences = {
    ...getSurvivalPreferences(),
    ...patch,
    scoreWeights: { ...getSurvivalPreferences().scoreWeights, ...(patch.scoreWeights ?? {}) },
  };
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  if (typeof window !== "undefined") {
    // Reuse existing app-wide refresh channels so every screen updates now.
    window.dispatchEvent(new Event(EVENT));
    window.dispatchEvent(new Event("fintrackr:salary-updated"));
    window.dispatchEvent(new Event("fintrackr:ai-coach:profile-updated"));
    window.dispatchEvent(new Event("fintrackr:notifications:updated"));
  }
  return next;
}

export function onSurvivalPreferencesChanged(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

// ---------------- derived helpers ----------------

/** Emergency fund target amount for a given monthly salary / expenses. */
export function emergencyFundTarget(
  monthlyBase: number,
  prefs: SurvivalPreferences = getSurvivalPreferences(),
): number {
  if (prefs.emergencyFundMode === "custom") {
    return Math.max(0, prefs.emergencyFundCustom ?? 0);
  }
  const months = prefs.emergencyFundMode === "3m" ? 3 : 6;
  return Math.max(0, monthlyBase) * months;
}

export function emergencyFundLabel(prefs: SurvivalPreferences = getSurvivalPreferences()): string {
  if (prefs.emergencyFundMode === "custom") return "Custom Amount";
  return prefs.emergencyFundMode === "3m" ? "3 Months Salary" : "6 Months Salary";
}

export function safeDailyMethodLabel(m: SafeDailyMethod): string {
  return m === "equal" ? "Equal Daily Budget" : m === "smart" ? "Smart Remaining Days" : "Weekend Balanced";
}

export function weeklyBudgetMethodLabel(m: WeeklyBudgetMethod): string {
  return m === "equal" ? "Equal Weeks" : m === "adaptive" ? "Smart Adaptive" : "Remaining Salary Based";
}

/**
 * Safe spend allowance for `now`, given money left and days left in the cycle.
 * - equal   : flat split across remaining days
 * - smart   : keeps a 10% end-of-cycle buffer, then splits the rest
 * - weekend : weekend days get 1.5× a weekday's share
 */
export function computeSafeDaily(
  salaryLeft: number,
  daysRemaining: number,
  now: Date = new Date(),
  prefs: SurvivalPreferences = getSurvivalPreferences(),
): number {
  const left = Math.max(0, salaryLeft);
  const days = Math.max(1, daysRemaining);
  if (daysRemaining <= 0) return left;

  if (prefs.safeDailyMethod === "smart") {
    return (left * 0.9) / days;
  }

  if (prefs.safeDailyMethod === "weekend") {
    let weekend = 0;
    let weekday = 0;
    const cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    for (let i = 0; i < days; i++) {
      const d = new Date(cursor.getTime() + i * 86_400_000).getDay();
      if (d === 0 || d === 6) weekend++;
      else weekday++;
    }
    const unit = left / Math.max(1, weekday + weekend * 1.5);
    const todayIsWeekend = now.getDay() === 0 || now.getDay() === 6;
    return todayIsWeekend ? unit * 1.5 : unit;
  }

  return left / days;
}

/**
 * Weekly spending budget from a monthly discretionary pool.
 * - equal     : pool / 4.33
 * - adaptive  : scales with how much of the cycle is left
 * - remaining : money actually left divided by remaining weeks
 */
export function computeWeeklyBudget(
  monthlyPool: number,
  opts: { salaryLeft?: number; daysRemaining?: number } = {},
  prefs: SurvivalPreferences = getSurvivalPreferences(),
): number {
  const pool = Math.max(0, monthlyPool);
  const { salaryLeft, daysRemaining } = opts;

  if (prefs.weeklyBudgetMethod === "remaining" && salaryLeft != null && daysRemaining != null) {
    const weeksLeft = Math.max(1, daysRemaining / 7);
    return Math.max(0, salaryLeft) / weeksLeft;
  }

  if (prefs.weeklyBudgetMethod === "adaptive" && daysRemaining != null) {
    const weeksLeft = Math.max(1, daysRemaining / 7);
    const base = pool / 4.33;
    // Blend the flat weekly pool with the pace the remaining days can support.
    const paced = salaryLeft != null ? Math.max(0, salaryLeft) / weeksLeft : base;
    return (base + paced) / 2;
  }

  return pool / 4.33;
}

/**
 * Weighted survival score. Each component is a 0..1 health ratio; disabled
 * weights drop out and the rest are renormalised to 100.
 */
export function weightedScore(
  components: { emergency?: number; savings?: number; debt?: number; discipline?: number },
  prefs: SurvivalPreferences = getSurvivalPreferences(),
): number {
  const w = prefs.scoreWeights;
  const parts: number[] = [];
  if (w.emergency && components.emergency != null) parts.push(clamp01(components.emergency));
  if (w.savings && components.savings != null) parts.push(clamp01(components.savings));
  if (w.debt && components.debt != null) parts.push(clamp01(components.debt));
  if (w.discipline && components.discipline != null) parts.push(clamp01(components.discipline));
  if (!parts.length) return 0;
  return Math.round((parts.reduce((s, n) => s + n, 0) / parts.length) * 100);
}

function clamp01(n: number) {
  return Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));
}
