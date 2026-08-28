import { supabase } from "@/integrations/supabase/client";

/**
 * Shared goal storage + read-only planning math.
 *
 * Goals live in the existing `fintrackr_goals_v1` localStorage record used by
 * the Goals page and the Planner → Goals tab. No new database table is created
 * and no existing field is renamed — `completedAt` is an additive optional flag.
 *
 * Every helper here is pure/read-only: nothing creates transactions, moves
 * money, or changes budgets, salary or investments.
 */

export type GoalKind =
  | "savings" | "emergency" | "fire" | "debt"
  | "investment" | "travel" | "gadget" | "custom";

export interface Goal {
  id: string;
  name: string;
  kind: GoalKind;
  /** Target amount */
  target: number;
  /** Current saved amount */
  current: number;
  /** Planned monthly contribution (0 when not set) */
  monthly: number;
  /** Target date (ISO yyyy-mm-dd) */
  deadline?: string;
  createdAt: string;
  /** Set when the goal reached its target (history is preserved). */
  completedAt?: string;
}

export const GOALS_KEY = "fintrackr_goals_v1";
export const GOALS_EVENT = "fintrackr:goals-updated";

export const GOAL_KINDS: { value: GoalKind; label: string }[] = [
  { value: "savings", label: "Savings" },
  { value: "emergency", label: "Emergency Fund" },
  { value: "fire", label: "Financial Freedom" },
  { value: "debt", label: "Debt Payoff" },
  { value: "investment", label: "Investment" },
  { value: "travel", label: "Travel" },
  { value: "gadget", label: "Gadget" },
  { value: "custom", label: "Custom" },
];

export const goalKindLabel = (k: GoalKind) =>
  GOAL_KINDS.find((x) => x.value === k)?.label ?? "Custom";

function normalize(raw: any): Goal | null {
  if (!raw || typeof raw !== "object" || !raw.id) return null;
  const target = Number(raw.target) || 0;
  const current = Number(raw.current) || 0;
  return {
    id: String(raw.id),
    name: String(raw.name ?? "Goal"),
    kind: (raw.kind ?? "savings") as GoalKind,
    target,
    current,
    monthly: Number(raw.monthly) || 0,
    deadline: raw.deadline || undefined,
    createdAt: raw.createdAt ?? new Date().toISOString(),
    completedAt:
      raw.completedAt ??
      (target > 0 && current >= target ? new Date().toISOString() : undefined),
  };
}

export function loadGoals(): Goal[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = JSON.parse(localStorage.getItem(GOALS_KEY) || "[]");
    return Array.isArray(raw) ? (raw.map(normalize).filter(Boolean) as Goal[]) : [];
  } catch {
    return [];
  }
}

export function saveGoals(goals: Goal[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(GOALS_KEY, JSON.stringify(goals));
    window.dispatchEvent(new Event(GOALS_EVENT));
  } catch {
    /* storage unavailable — keep in-memory state */
  }
}

/** Upsert a goal without ever removing the other stored goals. */
export function upsertGoal(goal: Goal): Goal[] {
  const existing = loadGoals();
  const idx = existing.findIndex((g) => g.id === goal.id);
  const next = idx >= 0
    ? existing.map((g) => (g.id === goal.id ? goal : g))
    : [goal, ...existing];
  saveGoals(next);
  return next;
}

export function isCompleted(g: Goal) {
  return g.target > 0 && g.current >= g.target;
}

/** Applies the completion stamp when a goal has reached its target. */
export function stampCompletion(g: Goal): Goal {
  if (isCompleted(g)) return { ...g, completedAt: g.completedAt ?? new Date().toISOString() };
  const { completedAt: _drop, ...rest } = g;
  return rest as Goal;
}

export type GoalStatus = "completed" | "on_track" | "behind" | "no_date";

export interface GoalPlan {
  progressPct: number;
  remaining: number;
  /** Whole months left until the target date (null when no date is set). */
  monthsRemaining: number | null;
  /** Remaining ÷ months left, rounded up (null without a target date). */
  requiredMonthly: number | null;
  /** Approximate weekly slice of the required monthly amount. */
  requiredWeekly: number | null;
  /** Extra amount needed on top of the current planned contribution. */
  shortfallMonthly: number | null;
  status: GoalStatus;
  /** Projected finish month from the current contribution (null if none). */
  etaMonths: number | null;
  overdue: boolean;
}

export function monthsUntil(deadline: string, from = new Date()): number {
  const d = new Date(deadline);
  if (Number.isNaN(d.getTime())) return 0;
  const months =
    (d.getFullYear() - from.getFullYear()) * 12 + (d.getMonth() - from.getMonth());
  const partial = d.getDate() >= from.getDate() ? 0 : -1;
  return months + partial;
}

export function computeGoalPlan(g: Goal, now = new Date()): GoalPlan {
  const remaining = Math.max(0, g.target - g.current);
  const progressPct = g.target > 0 ? Math.min(100, (g.current / g.target) * 100) : 0;
  const completed = isCompleted(g);

  let monthsRemaining: number | null = null;
  let overdue = false;
  if (g.deadline) {
    const m = monthsUntil(g.deadline, now);
    overdue = m <= 0 && !completed;
    monthsRemaining = Math.max(0, m);
  }

  const usableMonths = monthsRemaining && monthsRemaining > 0 ? monthsRemaining : null;
  const requiredMonthly = usableMonths ? Math.ceil(remaining / usableMonths) : null;
  const requiredWeekly = requiredMonthly ? Math.ceil(requiredMonthly / 4.33) : null;
  const shortfallMonthly =
    requiredMonthly != null ? Math.max(0, requiredMonthly - (g.monthly || 0)) : null;

  const etaMonths = g.monthly > 0 && remaining > 0 ? Math.ceil(remaining / g.monthly) : null;

  let status: GoalStatus;
  if (completed) status = "completed";
  else if (!g.deadline) status = "no_date";
  else if (requiredMonthly == null) status = "behind"; // date passed, target not met
  else status = (g.monthly || 0) >= requiredMonthly ? "on_track" : "behind";

  return {
    progressPct, remaining, monthsRemaining, requiredMonthly, requiredWeekly,
    shortfallMonthly, status, etaMonths, overdue,
  };
}

export const GOAL_STATUS_LABEL: Record<GoalStatus, string> = {
  completed: "Completed",
  on_track: "On Track",
  behind: "Behind",
  no_date: "No target date",
};

/* ------------------------- Cloud persistence (Supabase) -------------------------
 * The localStorage record stays as a device cache so every existing reader keeps
 * working synchronously. The authenticated `goals` table is the source of truth.
 */


type GoalRow = {
  id: string;
  name: string;
  kind: string;
  target: number | string;
  current: number | string;
  monthly: number | string;
  deadline: string | null;
  completed_at: string | null;
  created_at: string;
};

function fromRow(r: GoalRow): Goal {
  return normalize({
    id: r.id,
    name: r.name,
    kind: r.kind,
    target: Number(r.target),
    current: Number(r.current),
    monthly: Number(r.monthly),
    deadline: r.deadline ?? undefined,
    createdAt: r.created_at,
    completedAt: r.completed_at ?? undefined,
  })!;
}

function toRow(g: Goal, userId: string) {
  return {
    id: g.id,
    user_id: userId,
    name: g.name,
    kind: g.kind,
    target: g.target,
    current: g.current,
    monthly: g.monthly,
    deadline: g.deadline ?? null,
    completed_at: g.completedAt ?? null,
    created_at: g.createdAt,
  };
}

async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.id ?? null;
}

/**
 * Loads the signed-in user's cloud goals, migrating any local-only goals up
 * once (never overwriting newer cloud rows, never deleting local data before
 * the cloud write succeeds). Returns the merged list and refreshes the cache.
 */
export async function syncGoalsFromCloud(): Promise<Goal[]> {
  const userId = await currentUserId();
  if (!userId) return loadGoals();

  const { data, error } = await supabase
    .from("goals")
    .select("id,name,kind,target,current,monthly,deadline,completed_at,created_at")
    .order("created_at", { ascending: false });
  if (error) throw error;

  const cloud = (data ?? []).map((r) => fromRow(r as GoalRow));
  const cloudIds = new Set(cloud.map((g) => g.id));
  const localOnly = loadGoals().filter((g) => !cloudIds.has(g.id));

  if (localOnly.length) {
    const { error: insertError } = await supabase
      .from("goals")
      .insert(localOnly.map((g) => toRow(g, userId)));
    if (insertError) throw insertError;
  }

  const merged = [...localOnly, ...cloud];
  saveGoals(merged);
  return merged;
}

/** Writes a single goal to the cloud (insert or update by id). */
export async function persistGoal(goal: Goal): Promise<void> {
  const userId = await currentUserId();
  if (!userId) return;
  const { error } = await supabase.from("goals").upsert(toRow(goal, userId));
  if (error) throw error;
}

/** Removes a goal from the cloud. */
export async function deleteGoalRemote(id: string): Promise<void> {
  const userId = await currentUserId();
  if (!userId) return;
  const { error } = await supabase.from("goals").delete().eq("id", id);
  if (error) throw error;
}

/**
 * Cloud-first save: the cloud row is written (and must succeed) before the
 * device cache is refreshed. Signed-out users fall back to the cache only.
 */
export async function saveGoal(goal: Goal): Promise<Goal> {
  const stamped = stampCompletion(goal);
  await persistGoal(stamped);
  upsertGoal(stamped);
  return stamped;
}

/** Cloud-first delete: removes the cloud row first, then the cached copy. */
export async function removeGoal(id: string): Promise<void> {
  await deleteGoalRemote(id);
  saveGoals(loadGoals().filter((g) => g.id !== id));
}
