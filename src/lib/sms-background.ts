// Lightweight background-service helpers for SMS Intelligence.
// Pure runtime utilities — no UI. Safe to import from anywhere.

export type DebugTag =
  | "sms"
  | "parse"
  | "insert"
  | "permission"
  | "listener"
  | "retry"
  | "battery"
  | "background";

export type DebugEntry = {
  ts: number;
  tag: DebugTag;
  level: "info" | "warn" | "error" | "success";
  message: string;
  meta?: Record<string, unknown>;
};

const MAX_LOGS = 200;
const logs: DebugEntry[] = [];
const LOG_EVENT = "fintrackr:sms-log";
export const TXN_EVENT = "fintrackr:txn-inserted";

export function smsDebug(
  tag: DebugTag,
  level: DebugEntry["level"],
  message: string,
  meta?: Record<string, unknown>,
) {
  const entry: DebugEntry = { ts: Date.now(), tag, level, message, meta };
  logs.unshift(entry);
  if (logs.length > MAX_LOGS) logs.length = MAX_LOGS;
  // mirror to devtools so power users can inspect on a USB-debug device
  // eslint-disable-next-line no-console
  (console[level === "success" ? "log" : level] ?? console.log).call(
    console,
    `[FinTrackr/${tag}] ${message}`,
    meta ?? "",
  );
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(LOG_EVENT, { detail: entry }));
  }
}

export function getSmsLogs(): DebugEntry[] {
  return logs.slice();
}

export function subscribeSmsLogs(cb: (entry: DebugEntry) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = (e: Event) => cb((e as CustomEvent<DebugEntry>).detail);
  window.addEventListener(LOG_EVENT, handler as EventListener);
  return () => window.removeEventListener(LOG_EVENT, handler as EventListener);
}

// ---------- Retry queue ---------------------------------------------------
type RetryJob = {
  id: string;
  attempts: number;
  nextAt: number;
  run: () => Promise<void>;
};

const queue = new Map<string, RetryJob>();
let timer: ReturnType<typeof setTimeout> | null = null;
const MAX_ATTEMPTS = 5;
const BACKOFF_MS = [1_000, 3_000, 8_000, 20_000, 60_000];

function scheduleNext() {
  if (timer) return;
  const next = [...queue.values()].sort((a, b) => a.nextAt - b.nextAt)[0];
  if (!next) return;
  const delay = Math.max(250, next.nextAt - Date.now());
  timer = setTimeout(async () => {
    timer = null;
    const job = queue.get(next.id);
    if (!job) return scheduleNext();
    try {
      await job.run();
      queue.delete(job.id);
      smsDebug("retry", "success", `Retry succeeded for ${job.id}`);
    } catch (err: any) {
      job.attempts += 1;
      if (job.attempts >= MAX_ATTEMPTS) {
        queue.delete(job.id);
        smsDebug("retry", "error", `Gave up on ${job.id}`, { error: err?.message });
      } else {
        job.nextAt = Date.now() + BACKOFF_MS[Math.min(job.attempts, BACKOFF_MS.length - 1)];
        smsDebug("retry", "warn", `Retry ${job.attempts}/${MAX_ATTEMPTS} for ${job.id}`);
      }
    }
    scheduleNext();
  }, delay);
}

export function enqueueRetry(id: string, run: () => Promise<void>) {
  if (queue.has(id)) return;
  queue.set(id, { id, attempts: 0, nextAt: Date.now() + BACKOFF_MS[0], run });
  smsDebug("retry", "info", `Queued retry for ${id}`);
  scheduleNext();
}

// ---------- Real-time broadcast --------------------------------------------
export type TxnBroadcast = {
  amount: number;
  type: "income" | "expense";
  merchant: string;
  category?: string;
};

export function broadcastTxn(detail: TxnBroadcast) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(TXN_EVENT, { detail }));
}

// ---------- Background mode (OEM hardening) ------------------------------
// Best-effort calls into Capacitor plugins if installed. All no-ops on web.
async function callPlugin<T = unknown>(path: string[], method: string, args?: unknown): Promise<T | null> {
  if (typeof window === "undefined") return null;
  const w = window as any;
  let node: any = w.Capacitor?.Plugins;
  for (const p of path) node = node?.[p];
  if (!node || typeof node[method] !== "function") return null;
  try { return (await node[method](args)) as T; } catch { return null; }
}

export async function enableBackgroundMode() {
  // Cordova background-mode plugin (legacy but widely used on Oppo/Vivo/Xiaomi)
  const w = typeof window !== "undefined" ? (window as any) : null;
  try { w?.cordova?.plugins?.backgroundMode?.enable?.(); } catch { /* noop */ }
  try { w?.cordova?.plugins?.backgroundMode?.disableWebViewOptimizations?.(); } catch { /* noop */ }
  // Capacitor BackgroundMode plugin
  await callPlugin(["BackgroundMode"], "enable");
  // Foreground service plugin (keeps process alive on Xiaomi/Realme)
  await callPlugin(["ForegroundService"], "start", {
    id: 7421,
    title: "FinTrackr SMS Intelligence",
    body: "Detecting transaction alerts in the background",
    icon: "ic_stat_icon",
    silent: true,
  });
  smsDebug("background", "info", "Background mode requested");
}

export async function disableBackgroundMode() {
  const w = typeof window !== "undefined" ? (window as any) : null;
  try { w?.cordova?.plugins?.backgroundMode?.disable?.(); } catch { /* noop */ }
  await callPlugin(["BackgroundMode"], "disable");
  await callPlugin(["ForegroundService"], "stop");
}

export async function requestIgnoreBatteryOptimizations() {
  const res = await callPlugin<{ value?: boolean }>(
    ["BatteryOptimization"], "requestIgnoreBatteryOptimizations",
  );
  smsDebug("battery", "info", "Requested battery-opt exemption", { res });
  return res;
}

// Detect known restrictive OEMs so the UI can warn the user.
export function detectOem(): "xiaomi" | "oppo" | "vivo" | "realme" | "samsung" | "other" {
  if (typeof navigator === "undefined") return "other";
  const ua = (navigator.userAgent || "").toLowerCase();
  if (/miui|xiaomi|redmi|poco/.test(ua)) return "xiaomi";
  if (/oppo|cph\d/.test(ua)) return "oppo";
  if (/vivo|v\d{4}/.test(ua)) return "vivo";
  if (/realme|rmx\d/.test(ua)) return "realme";
  if (/samsung|sm-\w+/.test(ua)) return "samsung";
  return "other";
}

export function oemAutostartHint(oem: ReturnType<typeof detectOem>): string | null {
  switch (oem) {
    case "xiaomi":
      return "Xiaomi/MIUI: enable Autostart and lock FinTrackr in Recent Apps to keep SMS detection alive.";
    case "oppo":
    case "realme":
      return "Oppo/Realme ColorOS: turn ON 'Allow auto-launch' and 'Allow background activity' for FinTrackr.";
    case "vivo":
      return "Vivo FunTouch OS: enable 'High background power consumption' for FinTrackr.";
    case "samsung":
      return "Samsung One UI: add FinTrackr to 'Never sleeping apps' under Battery settings.";
    default:
      return null;
  }
}
