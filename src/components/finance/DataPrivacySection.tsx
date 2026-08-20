import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import { useTransactions } from "@/hooks/use-finance";
import {
  APP_VERSION,
  clearLocalData,
  formatBytes,
  localStorageBytes,
} from "@/lib/local-storage-stats";
import { notifyNotificationsChanged } from "@/lib/notifications";

function formatWhen(iso: string | null): string {
  if (!iso) return "No data yet";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "No data yet";
  const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  if (d.toDateString() === new Date().toDateString()) return `Today ${time}`;
  return `${d.toLocaleDateString(undefined, { day: "numeric", month: "short" })} ${time}`;
}

export function DataPrivacySection() {
  const { user } = useAuth();
  const { data: transactions = [] } = useTransactions();
  const [bytes, setBytes] = useState(0);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    setBytes(localStorageBytes());
  }, [transactions]);

  const lastSync = useMemo(() => {
    let latest: string | null = null;
    for (const t of transactions) {
      const ts = t.created_at ?? t.transaction_date;
      if (ts && (!latest || ts > latest)) latest = ts;
    }
    return latest;
  }, [transactions]);

  const cloud = !!user;

  return (
    <section id="section-data-privacy">
      <h2 className="mb-2.5 px-1 truncate text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground sm:text-xs">
        Data
      </h2>

      <Card className="overflow-hidden shadow-soft">
        <div className="grid grid-cols-3 gap-2 border-b px-3 py-3 sm:px-4">
          <Stat
            label="Backup"
            value={cloud ? "Cloud Sync Enabled" : "Local Device Storage"}
            tone={cloud ? "text-success" : undefined}
          />
          <Stat label="Last Sync" value={formatWhen(lastSync)} />
          <Stat label="Storage Used" value={formatBytes(bytes)} />
        </div>

        <ul className="divide-y">
          <RowLink to="/import" label="Import CSV" hint="Bring in statements from your bank" />
          <RowLink to="/transactions" label="Export Data" hint="Download your transactions" />

          <li className="px-3 py-3 sm:px-4">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-destructive">Delete All Data</p>
                <p className="truncate text-xs text-muted-foreground">
                  Clears local preferences, caches and AI history on this device — your account records stay
                </p>
              </div>
              {!confirming ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 shrink-0 border-destructive/30 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => setConfirming(true)}
                >
                  Delete
                </Button>
              ) : (
                <div className="flex shrink-0 gap-1.5">
                  <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setConfirming(false)}>
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="h-8 text-xs"
                    onClick={() => {
                      const n = clearLocalData();
                      setConfirming(false);
                      setBytes(localStorageBytes());
                      notifyNotificationsChanged();
                      toast.success(`Cleared ${n} local items`);
                    }}
                  >
                    Confirm
                  </Button>
                </div>
              )}
            </div>
          </li>

          <li className="flex items-center justify-between gap-2 px-3 py-3 sm:px-4">
            <p className="truncate text-sm font-medium">App Version</p>
            <span className="shrink-0 text-xs text-muted-foreground">v{APP_VERSION}</span>
          </li>
        </ul>
      </Card>
    </section>
  );
}

function RowLink({ to, label, hint }: { to: string; label: string; hint: string }) {
  return (
    <li>
      <Link
        to={to}
        preload="intent"
        className="flex items-center justify-between gap-2 px-3 py-3 transition-colors hover:bg-muted/40 sm:px-4"
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{label}</p>
          <p className="truncate text-xs text-muted-foreground">{hint}</p>
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
      </Link>
    </li>
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
