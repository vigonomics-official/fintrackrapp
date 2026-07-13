import { CheckCircle2, MessageSquareText, PencilLine, CalendarClock, FileSpreadsheet } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CoachDataSource } from "@/lib/coach-autofill";

const SOURCE_META: Record<CoachDataSource, { label: string; icon: React.ReactNode }> = {
  auto: { label: "Transaction History", icon: <CheckCircle2 className="h-3 w-3" /> },
  profile: { label: "Financial Profile", icon: <CheckCircle2 className="h-3 w-3" /> },
  sms: { label: "SMS", icon: <MessageSquareText className="h-3 w-3" /> },
  manual: { label: "Manual Entry", icon: <PencilLine className="h-3 w-3" /> },
  planner: { label: "Planner", icon: <CalendarClock className="h-3 w-3" /> },
  csv: { label: "Imported CSV", icon: <FileSpreadsheet className="h-3 w-3" /> },
};

export function CoachSourceBadge({
  source,
  className,
}: {
  source: CoachDataSource;
  className?: string;
}) {
  const meta = SOURCE_META[source];
  const tone =
    source === "manual"
      ? "text-muted-foreground"
      : "text-primary/80";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-[10px] font-medium leading-none",
        tone,
        className,
      )}
    >
      {meta.icon}
      <span>{meta.label}</span>
    </span>
  );
}
