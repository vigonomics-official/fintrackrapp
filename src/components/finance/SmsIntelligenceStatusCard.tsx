import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTransactions } from "@/hooks/use-finance";
import {
  checkSmsPermission,
  computeSmsStats,
  requestSmsPermission,
  smsPlatform,
  type SmsPermission,
} from "@/lib/sms-status";

function formatWhen(iso: string | null): string {
  if (!iso) return "Never";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Never";
  const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return `Today ${time}`;
  const yesterday = new Date(today.getTime() - 86_400_000);
  if (d.toDateString() === yesterday.toDateString()) return `Yesterday ${time}`;
  return `${d.toLocaleDateString(undefined, { day: "numeric", month: "short" })} ${time}`;
}

export function SmsIntelligenceStatusCard() {
  const { data: transactions = [] } = useTransactions();
  const [permission, setPermission] = useState<SmsPermission>("unsupported");
  const platform = typeof window === "undefined" ? "web" : smsPlatform();

  useEffect(() => {
    let alive = true;
    checkSmsPermission().then((p) => {
      if (alive) setPermission(p);
    });
    return () => {
      alive = false;
    };
  }, []);

  const stats = computeSmsStats(transactions);
  const active = permission === "granted";

  return (
    <section id="section-sms-intelligence">
      <h2 className="mb-2.5 px-1 truncate text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground sm:text-xs">
        SMS Intelligence
      </h2>

      <Card className="overflow-hidden shadow-soft">
        <div className="flex items-center justify-between gap-2 border-b px-3 py-3 sm:px-4">
          <div className="min-w-0 flex-1">
            <p className={cn("truncate text-sm font-semibold", active ? "text-success" : "text-destructive")}>
              {active ? "🟢 SMS Active" : "🔴 SMS Permission Required"}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {active
                ? "Spends are detected automatically on this device"
                : platform === "web"
                  ? "Auto-detect needs the FinTrackr Android app"
                  : "Allow SMS access to auto-detect UPI spends"}
            </p>
          </div>
          {!active && platform !== "web" && (
            <Button
              size="sm"
              variant="outline"
              className="h-8 shrink-0 text-xs"
              onClick={async () => setPermission(await requestSmsPermission())}
            >
              Enable SMS Detection
            </Button>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2 px-3 py-3 sm:px-4">
          <Stat label="Last Sync" value={formatWhen(stats.lastSyncAt)} />
          <Stat label="Imported" value={stats.imported > 0 ? `${stats.imported} txns` : "None yet"} />
          <Stat label="Accuracy" value={stats.accuracy != null ? `${stats.accuracy}%` : "—"} />
        </div>

        <Link
          to="/sms-intelligence"
          preload="intent"
          className="flex items-center justify-between gap-2 border-t px-3 py-3 transition-colors hover:bg-muted/40 sm:px-4"
        >
          <span className="truncate text-sm font-medium">Open SMS Intelligence</span>
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        </Link>
      </Card>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl bg-muted/50 px-2.5 py-2">
      <p className="truncate text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="truncate text-sm font-semibold">{value}</p>
    </div>
  );
}
