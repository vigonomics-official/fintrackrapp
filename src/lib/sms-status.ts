// Real SMS Intelligence status derived from the user's own transactions plus
// the runtime SMS bridge. No sample or placeholder numbers.

import type { Transaction } from "@/hooks/use-finance";

export type SmsPermission = "granted" | "denied" | "prompt" | "unsupported";

function getBridge(): any | null {
  if (typeof window === "undefined") return null;
  const w = window as any;
  return (
    w.SMSInboxReader ||
    w.SMSReceive ||
    w.cordova?.plugins?.smsRetriever ||
    w.Capacitor?.Plugins?.SmsInboxReader ||
    w.Capacitor?.Plugins?.CapacitorSMS ||
    null
  );
}

export function smsPlatform(): "android-native" | "ios-native" | "web" {
  if (typeof window === "undefined") return "web";
  const cap = (window as any).Capacitor;
  if (cap?.isNativePlatform?.()) return cap.getPlatform?.() === "ios" ? "ios-native" : "android-native";
  return "web";
}

/** Live permission check against the native bridge, when one exists. */
export async function checkSmsPermission(): Promise<SmsPermission> {
  const bridge = getBridge();
  if (!bridge) return "unsupported";
  try {
    const res = await bridge.checkPermissions?.();
    const granted = res?.read === "granted" || res?.receive === "granted" || res === true;
    return granted ? "granted" : "prompt";
  } catch {
    return "denied";
  }
}

export async function requestSmsPermission(): Promise<SmsPermission> {
  const bridge = getBridge();
  if (!bridge) return "unsupported";
  try {
    const res = await (bridge.requestPermission?.({ permissions: ["READ_SMS", "RECEIVE_SMS"] }) ??
      bridge.checkPermissions?.());
    const granted = res?.read === "granted" || res?.receive === "granted" || res === true;
    return granted ? "granted" : "denied";
  } catch {
    return "denied";
  }
}

export type SmsStats = {
  imported: number;
  lastSyncAt: string | null;
  /** Share of SMS-imported transactions that got a category — real accuracy. */
  accuracy: number | null;
};

const isSms = (t: Transaction) => Array.isArray(t.tags) && t.tags.includes("sms");

export function computeSmsStats(transactions: Transaction[]): SmsStats {
  const sms = transactions.filter(isSms);
  if (sms.length === 0) return { imported: 0, lastSyncAt: null, accuracy: null };
  let lastSyncAt: string | null = null;
  let categorized = 0;
  for (const t of sms) {
    const ts = t.created_at ?? t.transaction_date;
    if (ts && (!lastSyncAt || ts > lastSyncAt)) lastSyncAt = ts;
    if (t.category_id) categorized += 1;
  }
  return {
    imported: sms.length,
    lastSyncAt,
    accuracy: Math.round((categorized / sms.length) * 100),
  };
}
