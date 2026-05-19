import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import {
  ShieldCheck, MessageSquareText, Sparkles, Pencil, Check, X,
  UtensilsCrossed, Pizza, Car, ShoppingBag, ArrowLeftRight, Receipt, Plus,
  RadioTower, BatteryCharging, Smartphone, RefreshCw, AlertTriangle, CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { parseSms, txnSignature, formatCompactDateTime } from "@/lib/sms-parser";
import {
  smsDebug, enqueueRetry, broadcastTxn, enableBackgroundMode, disableBackgroundMode,
  requestIgnoreBatteryOptimizations, detectOem, oemAutostartHint,
  subscribeSmsLogs, getSmsLogs, type DebugEntry,
} from "@/lib/sms-background";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/finance/PageHeader";
import { formatCurrency } from "@/lib/currency";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/sms-intelligence")({
  component: SmsIntelligencePage,
});

type Detected = {
  id: string;
  merchant: string;
  amount: number;
  category: string;
  icon: typeof UtensilsCrossed;
  tint: string;
  channel: "UPI" | "Card" | "Bank";
  confidence: number;
  raw: string;
  time: string;
};

const SAMPLE: Detected[] = [
  { id: "1", merchant: "Swiggy", amount: 486, category: "Food", icon: UtensilsCrossed, tint: "text-orange-500 bg-orange-500/10", channel: "UPI", confidence: 96, raw: "Sent Rs.486 to SWIGGY@ybl via UPI", time: "Today, 8:42 PM" },
  { id: "2", merchant: "Zomato", amount: 312, category: "Dining", icon: Pizza, tint: "text-red-500 bg-red-500/10", channel: "UPI", confidence: 94, raw: "Paid Rs.312.00 to ZOMATO-ORDERS", time: "Today, 1:10 PM" },
  { id: "3", merchant: "Uber", amount: 184, category: "Transport", icon: Car, tint: "text-blue-500 bg-blue-500/10", channel: "UPI", confidence: 92, raw: "Debited Rs.184 UBER INDIA", time: "Yesterday" },
  { id: "4", merchant: "Amazon", amount: 1499, category: "Shopping", icon: ShoppingBag, tint: "text-amber-500 bg-amber-500/10", channel: "Card", confidence: 88, raw: "Card spend Rs.1499 AMAZON.IN", time: "Yesterday" },
  { id: "5", merchant: "PhonePe", amount: 2500, category: "Transfers", icon: ArrowLeftRight, tint: "text-violet-500 bg-violet-500/10", channel: "UPI", confidence: 99, raw: "UPI/PhonePe to Rahul S Rs.2500", time: "2 days ago" },
];

const RULES_SEED = [
  { match: "SWIGGY", category: "Food" },
  { match: "ZOMATO", category: "Dining" },
  { match: "UBER", category: "Transport" },
  { match: "OLA", category: "Transport" },
  { match: "AMAZON", category: "Shopping" },
];

// ---------- SMS runtime bridge (Capacitor / Cordova / Web fallback) ----------
type PermState = "granted" | "denied" | "prompt" | "unsupported";
type Platform = "android-native" | "ios-native" | "web";

function detectPlatform(): Platform {
  if (typeof window === "undefined") return "web";
  const w = window as any;
  const cap = w.Capacitor;
  if (cap?.isNativePlatform?.()) {
    return cap.getPlatform?.() === "ios" ? "ios-native" : "android-native";
  }
  return "web";
}

function getSmsBridge(): any | null {
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

function useSmsListener(enabled: boolean, autoCat: boolean, onMessage: (raw: string) => void) {
  const platform = detectPlatform();
  const bridge = getSmsBridge();
  const [permission, setPermission] = useState<PermState>(
    platform === "web" || !bridge ? "unsupported" : "prompt",
  );
  const [listening, setListening] = useState(false);
  const [lastEventAt, setLastEventAt] = useState<number | null>(null);
  const [batteryRestricted, setBatteryRestricted] = useState<boolean | null>(null);
  const subRef = useRef<{ remove?: () => void } | null>(null);
  const seenRef = useRef<Set<string>>(new Set());

  const requestPermission = async () => {
    if (!bridge) {
      setPermission("unsupported");
      smsDebug("permission", "warn", "No native SMS bridge available");
      toast.info("SMS auto-detect needs the FinTrackr Android app.");
      return;
    }
    try {
      const res = await (bridge.requestPermission?.({ permissions: ["READ_SMS", "RECEIVE_SMS"] })
        ?? bridge.checkPermissions?.());
      const granted = res?.read === "granted" || res?.receive === "granted" || res === true;
      setPermission(granted ? "granted" : "denied");
      smsDebug("permission", granted ? "success" : "warn",
        granted ? "SMS permission granted" : "SMS permission denied", { res });
      if (!granted) toast.error("Permission denied — enable SMS access in Settings.");
      else await requestIgnoreBatteryOptimizations();
    } catch (e: any) {
      setPermission("denied");
      smsDebug("permission", "error", "Permission request threw", { error: e?.message });
    }
  };

  const checkBattery = async () => {
    try {
      const w = window as any;
      const opt = await w.Capacitor?.Plugins?.BatteryOptimization?.isIgnoringBatteryOptimizations?.();
      if (typeof opt?.value === "boolean") {
        setBatteryRestricted(!opt.value);
        smsDebug("battery", opt.value ? "info" : "warn",
          opt.value ? "Battery optimization disabled for app" : "Battery optimization is restricting app");
      }
    } catch { /* noop */ }
  };

  const startListener = () => {
    if (!bridge || permission !== "granted" || subRef.current) return;
    try {
      const handler = (msg: any) => {
        const raw: string = msg?.body ?? msg?.message ?? String(msg ?? "");
        const key = `${msg?.address ?? ""}|${msg?.date ?? ""}|${raw.slice(0, 64)}`;
        if (seenRef.current.has(key)) return; // dedupe
        seenRef.current.add(key);
        setLastEventAt(Date.now());
        smsDebug("sms", "info", `SMS received from ${msg?.address ?? "unknown"}`,
          { len: raw.length });
        if (autoCat) onMessage(raw);
      };
      const sub = bridge.addListener?.("smsReceived", handler)
        ?? bridge.startWatch?.(handler)
        ?? bridge.watchSMS?.(handler);
      subRef.current = sub && typeof sub.then === "function" ? null : sub ?? { remove: () => bridge.stopWatch?.() };
      Promise.resolve(sub).then((s) => { if (s?.remove) subRef.current = s; });
      setListening(true);
      smsDebug("listener", "success", "SMS listener started");
      // Best-effort: keep the process alive when the screen is locked.
      enableBackgroundMode();
    } catch (e: any) {
      setListening(false);
      smsDebug("listener", "error", "Failed to start SMS listener", { error: e?.message });
      toast.error("Could not start SMS listener.");
    }
  };

  const stopListener = () => {
    try { subRef.current?.remove?.(); } catch { /* noop */ }
    subRef.current = null;
    setListening(false);
    disableBackgroundMode();
    smsDebug("listener", "info", "SMS listener stopped");
  };

  useEffect(() => {
    if (!enabled) { stopListener(); return; }
    if (permission === "granted") startListener();
    checkBattery();
    return () => stopListener();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, permission, autoCat]);

  return { platform, permission, listening, lastEventAt, batteryRestricted, requestPermission, startListener, stopListener };
}

function SmsIntelligencePage() {
  const { user } = useAuth();
  const [enabled, setEnabled] = useState(false);
  const [autoCat, setAutoCat] = useState(true);
  const [items, setItems] = useState(SAMPLE);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [rules, setRules] = useState(RULES_SEED);
  const [newRule, setNewRule] = useState({ match: "", category: "" });
  const insertedRef = useRef<Set<string>>(new Set());

  const handleIncomingSms = async (raw: string) => {
    const parsed = parseSms(raw, new Date());
    if (!parsed) {
      smsDebug("parse", "warn", "SMS skipped — not financial", { sample: raw.slice(0, 60) });
      return;
    }
    if (parsed.type !== "income" && parsed.type !== "expense") {
      smsDebug("parse", "info", "SMS skipped — non-cash transfer", { type: parsed.type });
      return;
    }
    const txnType: "income" | "expense" = parsed.type;
    smsDebug("parse", "success", `Parsed ₹${parsed.amount} → ${parsed.merchant}`,
      { type: parsed.type, method: parsed.paymentMethod, conf: parsed.confidence });

    const sig = txnSignature(parsed);
    if (insertedRef.current.has(sig)) return; // dedupe in-session
    insertedRef.current.add(sig);

    // Apply user rule for instant categorisation.
    const matched = rules.find((r) => parsed.merchant.toUpperCase().includes(r.match));
    const category = matched?.category ?? "Uncategorized";

    setItems((prev) => [
      {
        id: `live-${Date.now()}`,
        merchant: parsed.merchant,
        amount: parsed.amount,
        category,
        icon: MessageSquareText as any,
        tint: "text-primary bg-primary/10",
        channel: parsed.paymentMethod === "upi" ? "UPI" : parsed.paymentMethod.includes("card") ? "Card" : "Bank",
        confidence: parsed.confidence,
        raw: parsed.raw,
        time: formatCompactDateTime(parsed.occurredAt),
      },
      ...prev,
    ]);

    if (!user) return;
    const insert = async () => {
      const { error } = await supabase.from("transactions").insert({
        user_id: user.id,
        type: txnType,
        amount: parsed.amount,
        payment_method: parsed.paymentMethod,
        transaction_date: parsed.occurredAt.toISOString().slice(0, 10),
        notes: [parsed.bank, parsed.upiRef ? `Ref ${parsed.upiRef}` : null, parsed.raw]
          .filter(Boolean).join(" · ").slice(0, 500),
        tags: ["sms", parsed.paymentMethod, category].filter(Boolean) as string[],
      });
      if (error) throw error;
      smsDebug("insert", "success", `Inserted ₹${parsed.amount} (${parsed.merchant})`);
      broadcastTxn({
        amount: parsed.amount, type: txnType,
        merchant: parsed.merchant, category,
      });
      toast.success(
        `${parsed.type === "income" ? "Received" : "Spent"} ₹${parsed.amount} · ${parsed.merchant}`,
        { description: `Categorized as ${category}` },
      );
    };
    try {
      await insert();
    } catch (e: any) {
      smsDebug("insert", "error", "Insert failed — queued for retry", { error: e?.message });
      insertedRef.current.delete(sig); // allow retry path to re-add
      enqueueRetry(`txn:${sig}`, async () => {
        insertedRef.current.add(sig);
        await insert();
      });
      toast.error("Saving transaction failed — will retry automatically.");
    }
  };

  const sms = useSmsListener(enabled, autoCat, handleIncomingSms);

  const total = items.reduce((s, i) => s + i.amount, 0);

  return (
    <div>
      <PageHeader title="SMS Intelligence" subtitle="Auto-detect UPI & SMS transactions, privately on-device." />

      <div className="space-y-6 px-6 py-6 md:px-10">
        {/* Privacy hero */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="overflow-hidden border-0 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-5 shadow-soft">
            <div className="flex items-start gap-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
                <ShieldCheck className="h-5 w-5" />
              </span>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-semibold">Privacy-first detection</h3>
                  <Badge variant="secondary" className="text-[10px] uppercase tracking-wider">On-device</Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  We parse only financial SMS locally. No bank login, no data leaves your phone.
                </p>
                <div className="mt-4 flex items-center justify-between rounded-xl border bg-card/60 px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">SMS permission</p>
                    <p className="truncate text-xs text-muted-foreground">Required to read transaction alerts.</p>
                  </div>
                  <Switch
                    checked={enabled && sms.permission === "granted"}
                    onCheckedChange={async (v) => {
                      setEnabled(v);
                      if (v && sms.permission !== "granted") await sms.requestPermission();
                    }}
                  />
                </div>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Inline quick actions (replaces FAB) */}
        <div className="-mt-2 flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            className="h-9 gap-1.5"
            onClick={() => sms.requestPermission()}
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            Re-check Permissions
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-9 gap-1.5"
            onClick={() => {
              const sample = `Sent Rs.${(Math.floor(Math.random() * 400) + 50)}.00 to TEST-MERCHANT@upi via UPI Ref ${Date.now().toString().slice(-8)}`;
              smsDebug("sms", "info", "Test SMS injected", { sample });
              handleIncomingSms(sample);
            }}
          >
            <Sparkles className="h-3.5 w-3.5" />
            Test SMS Detection
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-9 gap-1.5"
            onClick={() => {
              sms.stopListener();
              setTimeout(() => sms.startListener(), 120);
              toast.success("Listener refreshed");
            }}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh Listener
          </Button>
        </div>

        {/* Permission & Listener Status */}
        <PermissionStatusPanel sms={sms} enabled={enabled} onRetry={sms.requestPermission} />

        {/* Debug log stream */}
        <DebugLogPanel />


        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <Stat label="Detected" value={String(items.length)} />
          <Stat label="This month" value={formatCurrency(total)} />
          <Stat label="Accuracy" value="94%" />
        </div>

        {/* Detected list */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Detected Transactions</h2>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5" /> Auto-categorize
              <Switch checked={autoCat} onCheckedChange={setAutoCat} />
            </div>
          </div>
          <Card className="divide-y overflow-hidden shadow-soft">
            {items.map((it) => {
              const Icon = it.icon;
              const isEdit = editing === it.id;
              return (
                <div key={it.id} className="px-4 py-3.5">
                  <div className="flex items-center gap-3">
                    <span className={cn("flex h-10 w-10 items-center justify-center rounded-xl", it.tint)}>
                      <Icon className="h-4.5 w-4.5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-medium">{it.merchant}</p>
                        <Badge variant="outline" className="h-5 px-1.5 text-[10px]">{it.channel}</Badge>
                      </div>
                      <p className="truncate text-xs text-muted-foreground">{it.time} · {it.raw}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold tabular-nums">−{formatCurrency(it.amount)}</p>
                      <p className="text-[10px] text-muted-foreground">{it.confidence}% match</p>
                    </div>
                  </div>
                  <div className="mt-2.5 flex items-center justify-between pl-13">
                    {isEdit ? (
                      <div className="flex items-center gap-2">
                        <Input value={draft} onChange={(e) => setDraft(e.target.value)} className="h-8 w-36 text-xs" />
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setItems(items.map(x => x.id === it.id ? { ...x, category: draft || x.category } : x)); setEditing(null); }}>
                          <Check className="h-4 w-4 text-primary" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditing(null)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setEditing(it.id); setDraft(it.category); }}
                        className="group inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-medium hover:bg-muted/80"
                      >
                        {it.category}
                        <Pencil className="h-3 w-3 text-muted-foreground group-hover:text-foreground" />
                      </button>
                    )}
                    <ConfidenceBar value={it.confidence} />
                  </div>
                </div>
              );
            })}
          </Card>
        </section>

        {/* Smart rules */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Smart Rules</h2>
            <Badge variant="secondary" className="text-[10px]">{rules.length} active</Badge>
          </div>
          <Card className="overflow-hidden shadow-soft">
            <ul className="divide-y">
              {rules.map((r, i) => (
                <li key={i} className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Receipt className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="text-sm font-medium">If merchant contains <span className="font-mono text-primary">{r.match}</span></p>
                      <p className="text-xs text-muted-foreground">→ Categorize as {r.category}</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setRules(rules.filter((_, j) => j !== i))}>
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
            <div className="flex items-center gap-2 border-t bg-muted/30 px-4 py-3">
              <Input placeholder="Merchant keyword" value={newRule.match} onChange={(e) => setNewRule({ ...newRule, match: e.target.value.toUpperCase() })} className="h-9" />
              <Input placeholder="Category" value={newRule.category} onChange={(e) => setNewRule({ ...newRule, category: e.target.value })} className="h-9" />
              <Button size="sm" onClick={() => { if (newRule.match && newRule.category) { setRules([...rules, newRule]); setNewRule({ match: "", category: "" }); } }}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </Card>
        </section>

        <p className="flex items-center justify-center gap-2 pt-2 text-xs text-muted-foreground">
          <MessageSquareText className="h-3.5 w-3.5" />
          SMS parsing happens locally. We never store your messages.
        </p>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-3 text-center shadow-soft">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 text-base font-semibold tabular-nums">{value}</p>
    </Card>
  );
}

function ConfidenceBar({ value }: { value: number }) {
  return (
    <div className="flex h-1.5 w-20 overflow-hidden rounded-full bg-muted">
      <div className="bg-primary transition-all" style={{ width: `${value}%` }} />
    </div>
  );
}

function PermissionStatusPanel({
  sms, enabled, onRetry,
}: {
  sms: ReturnType<typeof useSmsListener>;
  enabled: boolean;
  onRetry: () => void;
}) {
  const isWeb = sms.platform === "web";
  const permLabel: Record<string, string> = {
    granted: "Granted", denied: "Denied", prompt: "Not requested", unsupported: "Unavailable on web",
  };
  const permTone: Record<string, string> = {
    granted: "text-emerald-600 bg-emerald-500/10",
    denied: "text-red-600 bg-red-500/10",
    prompt: "text-amber-600 bg-amber-500/10",
    unsupported: "text-muted-foreground bg-muted",
  };
  const listenerOn = enabled && sms.listening;
  return (
    <Card className="overflow-hidden p-4 shadow-soft">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <RadioTower className={cn("h-4 w-4", listenerOn ? "text-emerald-500" : "text-muted-foreground")} />
          <h3 className="text-sm font-semibold">Listener status</h3>
        </div>
        <Badge variant="outline" className={cn("text-[10px]", listenerOn ? "border-emerald-500/40 text-emerald-600" : "")}>
          {listenerOn ? "Active" : "Idle"}
        </Badge>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <StatusRow
          icon={<Smartphone className="h-4 w-4" />}
          label="Platform"
          value={sms.platform === "android-native" ? "Android (native)" : sms.platform === "ios-native" ? "iOS (native)" : "Web browser"}
        />
        <StatusRow
          icon={sms.permission === "granted" ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
          label="READ_SMS / RECEIVE_SMS"
          value={permLabel[sms.permission]}
          tone={permTone[sms.permission]}
        />
        <StatusRow
          icon={<RadioTower className="h-4 w-4" />}
          label="Background listener"
          value={listenerOn ? "Running" : enabled ? "Waiting for permission" : "Off"}
        />
        <StatusRow
          icon={<BatteryCharging className="h-4 w-4" />}
          label="Battery optimization"
          value={sms.batteryRestricted == null ? "Unknown" : sms.batteryRestricted ? "Restricted" : "Unrestricted"}
          tone={sms.batteryRestricted ? "text-amber-600 bg-amber-500/10" : ""}
        />
      </div>
      {(isWeb || sms.permission !== "granted" || sms.batteryRestricted) && (
        <div className="mt-3 rounded-xl border bg-muted/40 p-3 text-xs text-muted-foreground">
          {isWeb ? (
            <p>Real-time SMS detection requires the FinTrackr Android app. The web preview shows sample data only.</p>
          ) : sms.permission !== "granted" ? (
            <p>Grant SMS access so FinTrackr can detect bank & UPI alerts the moment they arrive.</p>
          ) : (
            <p>Battery optimization may pause the listener in the background. Disable it for FinTrackr to keep detection reliable.</p>
          )}
          {(() => {
            const hint = oemAutostartHint(detectOem());
            return hint ? <p className="mt-1.5">{hint}</p> : null;
          })()}
          <div className="mt-2 flex gap-2">
            <Button size="sm" variant="outline" onClick={onRetry}>
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Re-check permissions
            </Button>
            <Button size="sm" variant="outline" onClick={() => requestIgnoreBatteryOptimizations()}>
              <BatteryCharging className="mr-1.5 h-3.5 w-3.5" /> Disable battery limits
            </Button>
          </div>
        </div>
      )}
      {sms.lastEventAt && (
        <p className="mt-3 text-[11px] text-muted-foreground">
          Last SMS event: {new Date(sms.lastEventAt).toLocaleTimeString()}
        </p>
      )}
    </Card>
  );
}

function StatusRow({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone?: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl border bg-card/60 px-3 py-2.5">
      <div className="flex min-w-0 items-center gap-2">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">{icon}</span>
        <p className="truncate text-xs font-medium">{label}</p>
      </div>
      <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", tone || "bg-muted text-muted-foreground")}>{value}</span>
    </div>
  );
}

function DebugLogPanel() {
  const [entries, setEntries] = useState<DebugEntry[]>(() => getSmsLogs());
  const [open, setOpen] = useState(false);
  useEffect(() => subscribeSmsLogs((e) => setEntries((prev) => [e, ...prev].slice(0, 200))), []);
  const toneFor = (lvl: DebugEntry["level"]) =>
    lvl === "error" ? "text-red-600" :
    lvl === "warn" ? "text-amber-600" :
    lvl === "success" ? "text-emerald-600" : "text-muted-foreground";
  return (
    <Card className="overflow-hidden p-4 shadow-soft">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <RadioTower className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Debug log</h3>
          <Badge variant="secondary" className="text-[10px]">{entries.length}</Badge>
        </div>
        <span className="text-xs text-muted-foreground">{open ? "Hide" : "Show"}</span>
      </button>
      {open && (
        <ul className="mt-3 max-h-56 space-y-1 overflow-y-auto rounded-lg bg-muted/30 p-2 font-mono text-[11px]">
          {entries.length === 0 && (
            <li className="text-muted-foreground">No events yet — enable the listener to start capturing.</li>
          )}
          {entries.map((e, i) => (
            <li key={i} className={cn("flex gap-2", toneFor(e.level))}>
              <span className="shrink-0 text-muted-foreground">
                {new Date(e.ts).toLocaleTimeString([], { hour12: false })}
              </span>
              <span className="shrink-0 uppercase tracking-wider opacity-70">[{e.tag}]</span>
              <span className="truncate">{e.message}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
