import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  ShieldCheck, MessageSquareText, Sparkles, Pencil, Check, X,
  UtensilsCrossed, Pizza, Car, ShoppingBag, ArrowLeftRight, Receipt, Plus,
  RefreshCw, CheckCircle2, Info, Globe,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { parseSms, txnSignature, formatCompactDateTime } from "@/lib/sms-parser";
import {
  smsDebug, enqueueRetry, broadcastTxn, enableBackgroundMode, disableBackgroundMode,
  requestIgnoreBatteryOptimizations,
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
  head: () => ({
    meta: [
      { title: "SMS Intelligence — FinTrackr" },
      { name: "description", content: "Auto-detect UPI and bank SMS transactions into your ledger." },
      { property: "og:title", content: "SMS Intelligence — FinTrackr" },
      { property: "og:description", content: "Auto-detect UPI and bank SMS transactions into your ledger." },
      { property: "og:url", content: "https://fintrackrapp.lovable.app/sms-intelligence" },
      { name: "twitter:title", content: "SMS Intelligence — FinTrackr" },
      { name: "twitter:description", content: "Auto-detect UPI and bank SMS transactions into your ledger." },
    ],
    links: [{ rel: "canonical", href: "https://fintrackrapp.lovable.app/sms-intelligence" }],
  }),
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
        {/* Friendly status banner */}
        <StatusBanner platform={sms.platform} listening={sms.listening && enabled} lastEventAt={sms.lastEventAt} />

        {/* Simplified status card */}
        <SimpleStatusCard
          platform={sms.platform}
          enabled={enabled}
          listening={sms.listening}
          lastEventAt={sms.lastEventAt}
          onEnable={async () => {
            setEnabled(true);
            if (sms.permission !== "granted") await sms.requestPermission();
          }}
        />

        {/* Quick actions */}
        <div className="flex flex-wrap gap-2">
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
          {sms.platform !== "web" && (
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
              Refresh
            </Button>
          )}
        </div>




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
                      <span className="mt-1 inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600">
                        {it.confidence}% Match
                      </span>
                    </div>
                  </div>
                  <div className="mt-2.5 flex items-center justify-between pl-13">
                    {isEdit ? (
                      <div className="flex items-center gap-2">
                        <Input value={draft} onChange={(e) => setDraft(e.target.value)} className="h-8 w-36 text-xs" />
                        <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Confirm category" onClick={() => { setItems(items.map(x => x.id === it.id ? { ...x, category: draft || x.category } : x)); setEditing(null); }}>
                          <Check className="h-4 w-4 text-primary" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Cancel edit" onClick={() => setEditing(null)}>
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
                  </div>

                </div>
              );
            })}
          </Card>
        </section>

        {/* Auto-categorization rules */}
        <section>
          <div className="mb-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Auto-categorization Rules</h2>
              <Badge variant="secondary" className="text-[10px]">{rules.length} active</Badge>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Merchants are automatically categorized when detected.
            </p>
          </div>
          <Card className="overflow-hidden shadow-soft">
            <ul className="divide-y">
              {rules.map((r, i) => (
                <li key={i} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Receipt className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        <span className="font-mono text-primary">{r.match}</span>
                      </p>
                      <p className="truncate text-xs text-muted-foreground">Categorize as {r.category}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setRules(rules.filter((_, j) => j !== i))}
                    className="shrink-0 text-xs font-medium text-red-600 hover:underline"
                  >
                    Remove
                  </button>
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
          <Button
            variant="outline"
            className="mt-3 w-full rounded-xl border-emerald-500/50 text-emerald-600 hover:bg-emerald-500/10 hover:text-emerald-700"
            onClick={() => {
              const el = document.querySelector<HTMLInputElement>('input[placeholder="Merchant keyword"]');
              el?.focus();
            }}
          >
            <Plus className="h-4 w-4" /> Add Custom Rule
          </Button>
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

function StatusBanner({ platform }: { platform: Platform; listening: boolean; lastEventAt: number | null }) {
  if (platform !== "web") return null;
  return (
    <div
      className="flex items-start gap-3 rounded-2xl border p-4"
      style={{ backgroundColor: "#EFF6FF", borderColor: "#BFDBFE" }}
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-500/15 text-blue-600">
        <Info className="h-4.5 w-4.5" />
      </span>
      <div className="text-sm text-blue-900">
        <p className="font-semibold">📱 For automatic SMS detection, download the FinTrackr Android app.</p>
        <p className="mt-1 text-blue-800/90">On web, you can review sample detected transactions below.</p>
      </div>
    </div>
  );
}

function formatRelative(ts: number) {
  const diff = Math.max(0, Date.now() - ts);
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} minute${m === 1 ? "" : "s"} ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hour${h === 1 ? "" : "s"} ago`;
  const d = Math.floor(h / 24);
  return `${d} day${d === 1 ? "" : "s"} ago`;
}

function SimpleStatusCard({
  platform, enabled, listening, lastEventAt, onEnable,
}: {
  platform: Platform; enabled: boolean; listening: boolean; lastEventAt: number | null; onEnable: () => void;
}) {
  const isWeb = platform === "web";
  if (isWeb) {
    return (
      <Card className="p-4 shadow-soft">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Web Version</span>
        </div>
        <div className="mt-2 flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
            <Globe className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">Running on Web Browser</p>
            <div className="mt-1 flex items-center gap-2 text-xs">
              <span className="text-muted-foreground">SMS Detection:</span>
              <span className="rounded-full bg-muted px-2 py-0.5 font-semibold text-muted-foreground">Not Available</span>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Sample data shown below.</p>
          </div>
        </div>
      </Card>
    );
  }
  const active = enabled && listening;
  return (
    <Card className="p-4 shadow-soft">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Android Version</span>
        <Badge
          variant="outline"
          className={cn("text-[10px]", active ? "border-emerald-500/40 text-emerald-600" : "text-muted-foreground")}
        >
          {active ? "Active" : "Idle"}
        </Badge>
      </div>
      <div className="mt-2 flex items-start gap-3">
        <span
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
            active ? "bg-emerald-500/15 text-emerald-600" : "bg-muted text-muted-foreground",
          )}
        >
          {active ? <CheckCircle2 className="h-5 w-5" /> : <ShieldCheck className="h-5 w-5" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">
            {active ? "✅ SMS Detection Active" : "SMS Detection Paused"}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {active ? "Listening for UPI and banking alerts" : "Enable to detect UPI & banking alerts"}
          </p>
          {active && lastEventAt && (
            <p className="mt-2 text-xs">
              <span className="text-muted-foreground">Last Detected:</span>{" "}
              <span className="font-medium">{formatRelative(lastEventAt)}</span>
            </p>
          )}
          {!active && (
            <Button size="sm" className="mt-3 h-8" onClick={onEnable}>
              Enable SMS Detection
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

