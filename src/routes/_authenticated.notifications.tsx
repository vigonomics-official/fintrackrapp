import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Bell, Check, X, ArrowRight, AlertTriangle, Calendar, Wallet, Receipt, Landmark, Sparkles, Target, ShieldAlert, MessageCircle, ClipboardPlus } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/finance/PageHeader";
import { useTransactions, useLoans, useCategories } from "@/hooks/use-finance";
import { useSalarySettings } from "@/hooks/use-salary-settings";
import { enqueuePlannerTask } from "@/lib/coach-plan";
import {
  completeNotification,
  computeNotifications,
  dismissNotification,
  groupNotifications,
  onNotificationsChanged,
  type NotifAction,
  type NotifKind,
  type NotifPriority,
  type NotificationItem,
} from "@/lib/notifications";
import { cn } from "@/lib/utils";


export const Route = createFileRoute("/_authenticated/notifications")({
  component: NotificationsPage,
  head: () => ({
    meta: [
      { title: "Notifications — FinTrackr" },
      {
        name: "description",
        content:
          "Smart salary, budget and bill reminders based on your real financial activity.",
      },
      { property: "og:title", content: "Notifications — FinTrackr" },
      {
        property: "og:description",
        content:
          "Smart salary, budget and bill reminders based on your real financial activity.",
      },
      { property: "og:url", content: "https://fintrackrapp.lovable.app/notifications" },
      { name: "twitter:title", content: "Notifications — FinTrackr" },
      {
        name: "twitter:description",
        content:
          "Smart salary, budget and bill reminders based on your real financial activity.",
      },
    ],
    links: [{ rel: "canonical", href: "https://fintrackrapp.lovable.app/notifications" }],
  }),
});

const KIND_ICON: Record<NotifKind, typeof Wallet> = {
  salary: Wallet,
  budget: AlertTriangle,
  bill: Receipt,
  emi: Landmark,
  ai: Sparkles,
  goal: Target,
  risk: ShieldAlert,
};


const PRIORITY_STYLE: Record<NotifPriority, string> = {
  High: "bg-destructive/15 text-destructive border-destructive/30",
  Medium: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
  Low: "bg-muted text-muted-foreground border-border",
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMin = Math.round((now.getTime() - d.getTime()) / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

function NotificationCard({
  n,
  onDismiss,
  onComplete,
  onPlanner,
}: {
  n: NotificationItem;
  onDismiss: (id: string) => void;
  onComplete: (id: string) => void;
  onPlanner: (n: NotificationItem, a: NotifAction) => void;
}) {

  const Icon = KIND_ICON[n.kind];
  const isCompleted = n.group === "Completed";
  return (
    <Card
      className={cn(
        "p-3.5 transition-opacity",
        isCompleted && "opacity-60",
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "grid h-9 w-9 shrink-0 place-items-center rounded-full border",
            PRIORITY_STYLE[n.priority],
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-sm font-semibold leading-tight">{n.title}</h3>
            <Badge
              variant="outline"
              className={cn("shrink-0 text-[10px]", PRIORITY_STYLE[n.priority])}
            >
              {n.priority}
            </Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{n.message}</p>
          <p className="mt-1.5 text-[10px] uppercase tracking-wide text-muted-foreground/70">
            {formatTime(n.generatedAt)}
          </p>
          {!isCompleted && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {n.action?.to ? (
                <Button
                  size="sm"
                  className="h-8 gap-1 text-xs"
                  asChild
                  onClick={() => onComplete(n.id)}
                >
                  <Link to={n.action.to}>
                    {n.action.label}
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                </Button>
              ) : (
                <Button
                  size="sm"
                  className="h-8 gap-1 text-xs"
                  onClick={() => onComplete(n.id)}
                >
                  <Check className="h-3 w-3" />
                  Done
                </Button>
              )}
              {(n.actions ?? []).map((a) =>
                a.kind === "planner" ? (
                  <Button
                    key={a.label}
                    size="sm"
                    variant="outline"
                    className="h-8 gap-1 text-xs"
                    onClick={() => onPlanner(n, a)}
                  >
                    <ClipboardPlus className="h-3 w-3" />
                    {a.label}
                  </Button>
                ) : (
                  <Button
                    key={a.label}
                    size="sm"
                    variant="outline"
                    className="h-8 gap-1 text-xs"
                    asChild
                  >
                    <Link to={a.to ?? "/insights/ai-coach"}>
                      <MessageCircle className="h-3 w-3" />
                      {a.label}
                    </Link>
                  </Button>
                ),
              )}
              {n.action?.to && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 gap-1 text-xs text-muted-foreground"
                  onClick={() => onComplete(n.id)}
                >
                  <Check className="h-3 w-3" />
                  Mark Done
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                className="h-8 gap-1 text-xs text-muted-foreground"
                onClick={() => onDismiss(n.id)}
              >
                <X className="h-3 w-3" />
                Dismiss
              </Button>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

function NotificationsPage() {
  const { data: transactions = [] } = useTransactions();
  const { data: loans = [] } = useLoans();
  const { data: categories = [] } = useCategories();
  const { settings } = useSalarySettings();
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const off = onNotificationsChanged(() => setTick((t) => t + 1));
    return off;
  }, []);

  const items = useMemo(
    () =>
      computeNotifications({
        transactions,
        loans,
        categories,
        salarySettings: settings,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [transactions, loans, categories, settings, tick],
  );


  const grouped = useMemo(() => groupNotifications(items), [items]);

  const handleDismiss = (id: string) => {
    dismissNotification(id);
    setTick((t) => t + 1);
  };
  const handleComplete = (id: string) => {
    completeNotification(id);
    setTick((t) => t + 1);
  };
  const handlePlanner = (n: NotificationItem, a: NotifAction) => {
    if (!a.plannerTask) return;
    enqueuePlannerTask(a.plannerTask);
    toast.success("Added to Planner", { description: a.plannerTask.title });
    completeNotification(n.id);
    setTick((t) => t + 1);
  };


  const total = items.length;

  return (
    <div>
      <PageHeader
        title="Notifications"
        subtitle="Smart reminders from your real data"
      />

      <div className="space-y-6 px-5 py-5 md:px-10 md:py-7">
        {total === 0 && (
          <Card className="p-8 text-center">
            <Bell className="mx-auto mb-3 h-10 w-10 text-muted-foreground/60" />
            <h3 className="text-sm font-semibold">You're all caught up</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              We'll ping you when there's something worth your attention — payday, budget limits, or bills.
            </p>
          </Card>
        )}

        {(["Today", "Upcoming", "Completed"] as const).map((group) => {
          const list = grouped[group];
          if (list.length === 0) return null;
          return (
            <section key={group} className="space-y-2.5">
              <div className="flex items-center gap-2">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {group}
                </h2>
                <span className="text-xs text-muted-foreground/70">
                  {list.length}
                </span>
              </div>
              <div className="space-y-2.5">
                {list.map((n) => (
                  <NotificationCard
                    key={n.id}
                    n={n}
                    onDismiss={handleDismiss}
                    onComplete={handleComplete}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
