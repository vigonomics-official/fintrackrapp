import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTransactions, useLoans, useCategories } from "@/hooks/use-finance";
import { useSalarySettings } from "@/hooks/use-salary-settings";
import {
  computeNotifications,
  unreadCount,
  onNotificationsChanged,
} from "@/lib/notifications";
import {
  NOTIFICATION_CHANNELS,
  getBrowserPermission,
  getNotificationSettings,
  lastNotificationAt,
  onNotificationSettingsChanged,
  requestBrowserPermission,
  updateNotificationSettings,
  type NotificationSettings,
} from "@/lib/notification-settings";

function formatWhen(iso: string | null): string {
  if (!iso) return "No alerts yet";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "No alerts yet";
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  if (sameDay) return `Today ${time}`;
  const yesterday = new Date(today.getTime() - 86_400_000);
  if (d.toDateString() === yesterday.toDateString()) return `Yesterday ${time}`;
  return `${d.toLocaleDateString(undefined, { day: "numeric", month: "short" })} ${time}`;
}

export function NotificationSettingsSection() {
  const { settings: salarySettings } = useSalarySettings();
  const { data: transactions = [] } = useTransactions();
  const { data: loans = [] } = useLoans();
  const { data: categories = [] } = useCategories();
  const [prefs, setPrefs] = useState<NotificationSettings>(getNotificationSettings);
  const [permission, setPermission] = useState(getBrowserPermission);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    setPrefs(getNotificationSettings());
    setPermission(getBrowserPermission());
    const offA = onNotificationsChanged(() => setTick((t) => t + 1));
    const offB = onNotificationSettingsChanged(() => {
      setPrefs(getNotificationSettings());
      setPermission(getBrowserPermission());
      setTick((t) => t + 1);
    });
    return () => {
      offA();
      offB();
    };
  }, []);

  const { unread, lastAt } = useMemo(() => {
    const items = computeNotifications({ salarySettings, transactions, loans, categories });
    return { unread: unreadCount(items), lastAt: lastNotificationAt(items) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [salarySettings, transactions, loans, categories, prefs, tick]);

  const permLabel =
    permission === "granted"
      ? "Allowed"
      : permission === "denied"
        ? "Blocked"
        : permission === "default"
          ? "Not asked"
          : "In-app only";
  const permTone =
    permission === "granted" ? "text-success" : permission === "denied" ? "text-destructive" : "text-muted-foreground";

  const toggle = (key: keyof NotificationSettings, value: boolean) => {
    setPrefs(updateNotificationSettings({ [key]: value }));
  };

  return (
    <section id="section-notifications">
      <h2 className="mb-2.5 px-1 truncate text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground sm:text-xs">
        Smart Notifications
      </h2>

      <Card className="overflow-hidden shadow-soft">
        <div className="grid grid-cols-3 gap-2 border-b px-3 py-3 sm:px-4">
          <Stat label="Permission" value={permLabel} tone={permTone} />
          <Stat label="Last Alert" value={formatWhen(lastAt)} />
          <Stat label="Unread" value={String(unread)} />
        </div>

        {(permission === "default" || permission === "denied") && (
          <div className="flex items-center justify-between gap-2 border-b bg-muted/40 px-3 py-2.5 sm:px-4">
            <p className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
              {permission === "denied"
                ? "Alerts are blocked in your browser settings."
                : "Allow alerts so reminders reach you outside the app."}
            </p>
            {permission === "default" && (
              <Button
                size="sm"
                variant="outline"
                className="h-8 shrink-0 text-xs"
                onClick={async () => setPermission(await requestBrowserPermission())}
              >
                Enable
              </Button>
            )}
          </div>
        )}

        <ul className="divide-y">
          {NOTIFICATION_CHANNELS.map((c) => (
            <li key={c.key} className="flex items-center justify-between gap-3 px-3 py-3 sm:px-4">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{c.label}</p>
                <p className="truncate text-xs text-muted-foreground">{c.hint}</p>
              </div>
              <Switch checked={prefs[c.key]} onCheckedChange={(v) => toggle(c.key, v)} />
            </li>
          ))}
        </ul>
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
