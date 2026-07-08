import { Clock, Database } from "lucide-react";
import { Card } from "@/components/ui/card";

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  const time = d.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  return `${sameDay ? "Today" : d.toLocaleDateString()} • ${time}`;
}

export function CoachLastUpdatedCard({
  computedAt,
  transactionCount,
}: {
  computedAt?: string | null;
  transactionCount: number;
}) {
  if (!computedAt) {
    return (
      <Card className="flex items-start gap-2 p-3 shadow-soft">
        <Database className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <p className="text-xs text-muted-foreground">No transaction data available.</p>
      </Card>
    );
  }
  return (
    <Card className="p-3 shadow-soft">
      <div className="flex items-start gap-2">
        <Clock className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
            <p className="font-display text-xs font-semibold">Last Updated</p>
            <p className="text-[11px] text-muted-foreground">{formatTime(computedAt)}</p>
          </div>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Using {transactionCount} transaction{transactionCount === 1 ? "" : "s"} • Current Month
          </p>
        </div>
      </div>
    </Card>
  );
}
