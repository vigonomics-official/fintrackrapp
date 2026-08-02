// Per-channel Smart Notification preferences.
// Stored locally and applied inside the notification engine so every consumer
// (bell, notifications page, snapshot card) stays in sync automatically.

import type { NotificationItem } from "@/lib/notifications";

const KEY = "fintrackr:notification-settings:v1";
const SEEN_KEY = "fintrackr:notifications:last-seen:v1";
export const NOTIFICATION_SETTINGS_EVENT = "fintrackr:notification-settings-updated";

export type NotificationChannel =
  | "salary"
  | "bill"
  | "weekly"
  | "goal"
  | "ai"
  | "danger"
  | "monthly"
  | "emergency";

export type NotificationSettings = Record<NotificationChannel, boolean>;

export const NOTIFICATION_CHANNELS: {
  key: NotificationChannel;
  label: string;
  hint: string;
}[] = [
  { key: "salary", label: "Salary Reminder", hint: "Pay day, delays and credits" },
  { key: "bill", label: "Bill Reminder", hint: "Rent, bills and EMI due dates" },
  { key: "weekly", label: "Weekly Survival Report", hint: "Weekly budget status" },
  { key: "goal", label: "Goal Reminder", hint: "Milestones on your savings goals" },
  { key: "ai", label: "AI Coach Suggestions", hint: "Personalised money advice" },
  { key: "danger", label: "Danger Alerts", hint: "Risk level and overspend warnings" },
  { key: "monthly", label: "Monthly Summary", hint: "Month-end survival review" },
  { key: "emergency", label: "Emergency Fund Reminder", hint: "Top-up nudges for your buffer" },
];

const DEFAULTS: NotificationSettings = {
  salary: true,
  bill: true,
  weekly: true,
  goal: true,
  ai: true,
  danger: true,
  monthly: true,
  emergency: true,
};

export function getNotificationSettings(): NotificationSettings {
  if (typeof window === "undefined") return { ...DEFAULTS };
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...DEFAULTS, ...(JSON.parse(raw) as Partial<NotificationSettings>) } : { ...DEFAULTS };
  } catch {
    return { ...DEFAULTS };
  }
}

export function updateNotificationSettings(
  patch: Partial<NotificationSettings>,
): NotificationSettings {
  const next = { ...getNotificationSettings(), ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
    window.dispatchEvent(new Event(NOTIFICATION_SETTINGS_EVENT));
  } catch {
    /* ignore */
  }
  return next;
}

/** Which channel a generated notification belongs to. */
export function channelOf(n: Pick<NotificationItem, "id" | "kind">): NotificationChannel {
  const id = n.id.toLowerCase();
  if (id.includes("emergency")) return "emergency";
  if (id.includes("monthly")) return "monthly";
  if (id.includes("weekly") || n.kind === "budget") return "weekly";
  switch (n.kind) {
    case "salary":
      return "salary";
    case "bill":
    case "emi":
      return "bill";
    case "goal":
      return "goal";
    case "risk":
      return "danger";
    default:
      return "ai";
  }
}

export function filterByChannelSettings<T extends Pick<NotificationItem, "id" | "kind">>(
  items: T[],
  settings: NotificationSettings = getNotificationSettings(),
): T[] {
  return items.filter((n) => settings[channelOf(n)]);
}

/** Browser notification permission, when the API exists. */
export type BrowserPermission = "granted" | "denied" | "default" | "unsupported";

export function getBrowserPermission(): BrowserPermission {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return (window as unknown as { Notification: { permission: BrowserPermission } }).Notification
    .permission;
}

export async function requestBrowserPermission(): Promise<BrowserPermission> {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  try {
    const res = await Notification.requestPermission();
    window.dispatchEvent(new Event(NOTIFICATION_SETTINGS_EVENT));
    return res as BrowserPermission;
  } catch {
    return "denied";
  }
}

export function onNotificationSettingsChanged(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(NOTIFICATION_SETTINGS_EVENT, cb);
  return () => window.removeEventListener(NOTIFICATION_SETTINGS_EVENT, cb);
}

export function getLastSeenAt(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(SEEN_KEY);
}

export function markNotificationsSeen() {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(SEEN_KEY, new Date().toISOString());
    window.dispatchEvent(new Event(NOTIFICATION_SETTINGS_EVENT));
  } catch {
    /* ignore */
  }
}

/** Most recent generation time across the active notifications. */
export function lastNotificationAt(items: NotificationItem[]): string | null {
  let latest: string | null = null;
  for (const n of items) {
    if (!latest || n.generatedAt > latest) latest = n.generatedAt;
  }
  return latest;
}
