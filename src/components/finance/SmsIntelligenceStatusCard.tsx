import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTransactions } from "@/hooks/use-finance";
import { checkSmsPermission, computeSmsStats, type SmsPermission } from "@/lib/sms-status";

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
        <Link
          to="/sms-intelligence"
          preload="intent"
          className="block transition-colors hover:bg-muted/40 active:bg-muted/60"
        >
          <div className="flex items-center justify-between gap-2 border-b px-3 py-3 sm:px-4">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">Status</p>
              <p className={cn("truncate text-xs", active ? "text-success" : "text-muted-foreground")}>
                {active ? "Active — spends detected automatically" : "Permission required"}
              </p>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          </div>

          <div className="grid grid-cols-3 gap-2 px-3 py-3 sm:px-4">
            <Stat label="Last Sync" value={formatWhen(stats.lastSyncAt)} />
            <Stat label="Imported" value={stats.imported > 0 ? `${stats.imported} txns` : "None yet"} />
            <Stat label="Accuracy" value={stats.accuracy != null ? `${stats.accuracy}%` : "—"} />
          </div>
        </Link>
      </Card>
    </section>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="min-w-0 rounded-xl bg-muted/50 px-2.5 py-2">
      <p className="truncate text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={cn("truncate text-sm font-semibold", tone)}>{value}</p>
    </div>
  );
}
