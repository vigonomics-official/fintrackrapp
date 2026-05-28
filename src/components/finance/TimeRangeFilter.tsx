import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarIcon } from "lucide-react";

export type RangeKey = "week" | "month" | "lastMonth" | "year" | "custom";
export type DateRange = { from: string; to: string };

const OPTIONS: { key: RangeKey; label: string }[] = [
  { key: "week", label: "This Week" },
  { key: "month", label: "This Month" },
  { key: "lastMonth", label: "Last Month" },
  { key: "year", label: "This Year" },
  { key: "custom", label: "Custom" },
];

export function computeRange(key: RangeKey, custom?: DateRange): DateRange {
  const today = new Date();
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  if (key === "week") {
    const d = new Date(today);
    const day = (d.getDay() + 6) % 7; // Mon = 0
    d.setDate(d.getDate() - day);
    return { from: iso(d), to: iso(today) };
  }
  if (key === "month") {
    return { from: iso(new Date(today.getFullYear(), today.getMonth(), 1)), to: iso(today) };
  }
  if (key === "lastMonth") {
    const from = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const to = new Date(today.getFullYear(), today.getMonth(), 0);
    return { from: iso(from), to: iso(to) };
  }
  if (key === "year") {
    return { from: iso(new Date(today.getFullYear(), 0, 1)), to: iso(today) };
  }
  return custom ?? { from: iso(today), to: iso(today) };
}

export function previousRange(key: RangeKey, range: DateRange): DateRange {
  const from = new Date(range.from);
  const to = new Date(range.to);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  if (key === "month" || key === "lastMonth") {
    const pf = new Date(from.getFullYear(), from.getMonth() - 1, 1);
    const pt = new Date(from.getFullYear(), from.getMonth(), 0);
    return { from: iso(pf), to: iso(pt) };
  }
  if (key === "year") {
    return {
      from: iso(new Date(from.getFullYear() - 1, 0, 1)),
      to: iso(new Date(from.getFullYear() - 1, 11, 31)),
    };
  }
  // week / custom: shift by same number of days
  const days = Math.max(1, Math.round((to.getTime() - from.getTime()) / 86400000) + 1);
  const pt = new Date(from); pt.setDate(pt.getDate() - 1);
  const pf = new Date(pt); pf.setDate(pf.getDate() - (days - 1));
  return { from: iso(pf), to: iso(pt) };
}

type Props = {
  value: RangeKey;
  onChange: (key: RangeKey) => void;
  custom: DateRange;
  onCustomChange: (r: DateRange) => void;
};

export function TimeRangeFilter({ value, onChange, custom, onCustomChange }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
      {OPTIONS.map((o) => {
        const active = value === o.key;
        if (o.key === "custom") {
          return (
            <Popover key={o.key} open={open} onOpenChange={setOpen}>
              <PopoverTrigger asChild>
                <button
                  onClick={() => onChange("custom")}
                  className={cn(
                    "flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                    active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card text-muted-foreground hover:text-foreground"
                  )}
                >
                  <CalendarIcon className="h-3 w-3" />
                  {active ? `${custom.from} → ${custom.to}` : "Custom"}
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-64 space-y-2 p-3">
                <div>
                  <label className="text-[11px] text-muted-foreground">From</label>
                  <Input type="date" value={custom.from} onChange={(e) => onCustomChange({ ...custom, from: e.target.value })} />
                </div>
                <div>
                  <label className="text-[11px] text-muted-foreground">To</label>
                  <Input type="date" value={custom.to} onChange={(e) => onCustomChange({ ...custom, to: e.target.value })} />
                </div>
                <Button size="sm" className="w-full" onClick={() => { onChange("custom"); setOpen(false); }}>Apply</Button>
              </PopoverContent>
            </Popover>
          );
        }
        return (
          <button
            key={o.key}
            onClick={() => onChange(o.key)}
            className={cn(
              "shrink-0 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
              active
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:text-foreground"
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
