/**
 * Salary cycle date math.
 *
 * payDay convention:
 *   - 1..31 → that calendar day (clamped to last day of month if needed)
 *   - 0     → "last day of every month"
 */

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function lastDayOfMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

export function payDayInMonth(year: number, month: number, payDay: number): Date {
  const last = lastDayOfMonth(year, month);
  const day = payDay === 0 ? last : Math.min(Math.max(1, payDay), last);
  return new Date(year, month, day);
}

/**
 * The next salary date on or after `from` (today counts as 0 days remaining).
 */
export function nextSalaryDate(payDay: number, from: Date = new Date()): Date {
  const today = startOfDay(from);
  const cand = payDayInMonth(today.getFullYear(), today.getMonth(), payDay);
  if (cand.getTime() >= today.getTime()) return cand;
  return payDayInMonth(today.getFullYear(), today.getMonth() + 1, payDay);
}

/**
 * The most recent salary date strictly on or before `from`.
 * Used as the start of the current pay cycle.
 */
export function lastSalaryDate(payDay: number, from: Date = new Date()): Date {
  const today = startOfDay(from);
  const cand = payDayInMonth(today.getFullYear(), today.getMonth(), payDay);
  if (cand.getTime() <= today.getTime()) return cand;
  return payDayInMonth(today.getFullYear(), today.getMonth() - 1, payDay);
}

/**
 * Whole calendar days between today and next salary date.
 * Returns 0 when today is the salary day.
 */
export function daysUntilSalary(payDay: number, from: Date = new Date()): number {
  const today = startOfDay(from);
  const next = nextSalaryDate(payDay, today);
  return Math.round((next.getTime() - today.getTime()) / 86_400_000);
}

export function daysLeftLabel(days: number): string {
  if (days <= 0) return "Salary Today 🎉";
  if (days === 1) return "1 day";
  return `${days} days`;
}
