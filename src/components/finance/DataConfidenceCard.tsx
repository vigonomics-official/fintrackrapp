import { useState } from "react";
import { ShieldCheck, ShieldAlert, ShieldQuestion, Sparkles, ChevronDown, Check, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import type { ConfidenceResult, ConfidenceLevel } from "@/lib/coach-confidence";

export type DataConfidenceCardProps = {
  confidence: ConfidenceResult;
  /** Shown when confidence is below 90% (and not empty). */
  onImprove?: () => void;
  /** Shown when there is no data at all. */
  onStart?: () => void;
  className?: string;
};

const TONE: Record<ConfidenceLevel, { text: string; bg: string; ring: string; badge: string; icon: React.ReactNode }> = {
  high: {
    text: "text-success",
    bg: "bg-success/10",
    ring: "ring-success/20",
    badge: "bg-success/10 text-success",
    icon: <ShieldCheck className="h-5 w-5" />,
  },
  medium: {
    text: "text-gold",
    bg: "bg-gold/10",
    ring: "ring-gold/20",
    badge: "bg-gold/10 text-gold",
    icon: <ShieldAlert className="h-5 w-5" />,
  },
  low: {
    text: "text-destructive",
    bg: "bg-destructive/10",
    ring: "ring-destructive/20",
    badge: "bg-destructive/10 text-destructive",
    icon: <ShieldAlert className="h-5 w-5" />,
  },
  empty: {
    text: "text-muted-foreground",
    bg: "bg-muted",
    ring: "ring-border",
    badge: "bg-muted text-muted-foreground",
    icon: <ShieldQuestion className="h-5 w-5" />,
  },
};

const DOT: Record<ConfidenceLevel, string> = {
  high: "🟢",
  medium: "🟡",
  low: "🔴",
  empty: "⚪",
};

export function DataConfidenceCard({ confidence, onImprove, onStart, className }: DataConfidenceCardProps) {
  const tone = TONE[confidence.level];
  const showImprove = confidence.level !== "empty" && confidence.score < 90 && onImprove;
  const showStart = confidence.level === "empty" && onStart;

  return (
    <Card className={cn("p-4 shadow-soft sm:p-5", className)}>
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ring-1",
            tone.bg,
            tone.ring,
            tone.text,
          )}
          aria-hidden
        >
          {tone.icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <p className="font-display text-sm font-semibold">Data Confidence</p>
            <span
              className={cn(
                "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                tone.badge,
              )}
            >
              <span aria-hidden className="mr-1">{DOT[confidence.level]}</span>
              {confidence.label}
            </span>
          </div>

          <div className="mt-2 flex items-baseline gap-2">
            <p className={cn("font-display text-3xl font-bold leading-none", tone.text)}>
              {confidence.score}
              <span className="text-base font-semibold text-muted-foreground">%</span>
            </p>
            <p className="text-[11px] text-muted-foreground">
              {confidence.filled}/{confidence.total} fields
            </p>
          </div>

          <Progress
            value={confidence.score}
            className="mt-3 h-1.5"
            aria-label={`Data confidence ${confidence.score}%`}
          />

          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{confidence.message}</p>

          {confidence.level !== "empty" && (confidence.present.length > 0 || confidence.missing.length > 0) && (
            <ConfidenceDetails confidence={confidence} />
          )}

          {(showImprove || showStart) && (
            <div className="mt-3">
              {showStart ? (
                <Button size="sm" className="w-full sm:w-auto" onClick={onStart}>
                  <Sparkles className="mr-1.5 h-4 w-4" />
                  Start Analysis
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full sm:w-auto"
                  onClick={onImprove}
                >
                  Improve My Data
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

function ConfidenceDetails({ confidence }: { confidence: ConfidenceResult }) {
  const [open, setOpen] = useState(false);
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="mt-3">
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center justify-between rounded-md bg-muted/40 px-2 py-1.5 text-left text-[11px] font-medium text-foreground/80 transition-colors hover:bg-muted"
        >
          <span>
            Why {confidence.score}% — {confidence.present.length} present, {confidence.missing.length} missing
          </span>
          <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 transition-transform", open && "rotate-180")} />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <ul className="mt-2 grid grid-cols-1 gap-1 sm:grid-cols-2">
          {confidence.present.map((f) => (
            <li key={String(f.key)} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Check className="h-3 w-3 shrink-0 text-success" />
              <span className="min-w-0 flex-1 truncate">{f.label}</span>
            </li>
          ))}
          {confidence.missing.map((f) => (
            <li key={String(f.key)} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <X className="h-3 w-3 shrink-0 text-destructive/70" />
              <span className="min-w-0 flex-1 truncate">{f.label}</span>
            </li>
          ))}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  );
}
