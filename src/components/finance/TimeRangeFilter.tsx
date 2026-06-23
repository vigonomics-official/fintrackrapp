import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export type RangeKey = "week" | "month" | "year" | "custom";
export type DateRange = { from: string; to: string };

const OPTIONS: { key: RangeKey; label: string }[] = [
  { key: "week", label: "Week" },
  { key: "month", label: "Month" },
  { key: "year", label: "Year" },
  { key: "custom", label: "Custom" },
];

export function computeRange(key: RangeKey, custom?: DateRange): DateRange {
  const today = new Date();
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  if (key === "week") {
    const d = new Date(today);
    const day = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - day);
    return { from: iso(d), to: iso(today) };
  }
  if (key === "month") {
    return { from: iso(new Date(today.getFullYear(), today.getMonth(), 1)), to: iso(today) };
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
  if (key === "month") {
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
  return (
    <div className="space-y-3">
      <div
        style={{
          display: 'flex',
          width: '100%',
          maxWidth: '100%',
          backgroundColor: '#f3f4f6',
          borderRadius: '24px',
          padding: '4px',
          boxSizing: 'border-box',
          overflow: 'hidden',
          gap: '4px',
        }}
        role="tablist"
      >
        {OPTIONS.map((o) => {
          const active = value === o.key;
          return (
            <button
              key={o.key}
              role="tab"
              aria-selected={active}
              onClick={() => onChange(o.key)}
              className={cn("transition-colors", active ? "font-semibold" : "font-medium")}
              style={{
                flex: 1,
                minWidth: 0,
                padding: '8px 2px',
                fontSize: '12px',
                fontWeight: 500,
                textAlign: 'center',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                borderRadius: '20px',
                border: 'none',
                ...(active
                  ? { background: "#1A6B4A", color: "#ffffff" }
                  : { background: "transparent", color: "#9CA3AF" }),
              }}
            >
              {o.label}
            </button>
          );
        })}
      </div>

      {value === "custom" && (
        <div className="flex flex-col gap-2 md:flex-row md:items-end" style={{ width: "100%" }}>
          <div className="min-w-0 flex-1">
            <label className="mb-1 block text-[11px] text-muted-foreground">From</label>
            <Input
              type="date"
              value={custom.from}
              onChange={(e) => onCustomChange({ ...custom, from: e.target.value })}
            />
          </div>
          <div className="min-w-0 flex-1">
            <label className="mb-1 block text-[11px] text-muted-foreground">To</label>
            <Input
              type="date"
              value={custom.to}
              onChange={(e) => onCustomChange({ ...custom, to: e.target.value })}
            />
          </div>
          <Button
            className="w-full text-white hover:opacity-90 md:w-auto"
            style={{ background: "#1A6B4A", flexShrink: 0 }}
            onClick={() => onChange("custom")}
          >
            Apply
          </Button>
        </div>
      )}
    </div>
  );
}
