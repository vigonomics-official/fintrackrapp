import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { useProfile } from "@/hooks/use-finance";
import { formatCurrency } from "@/lib/currency";
import { useSurvivalPreferences } from "@/hooks/use-survival-preferences";
import type {
  EmergencyFundMode,
  SafeDailyMethod,
  WeeklyBudgetMethod,
} from "@/lib/survival-preferences";

/**
 * Survival preference rows, rendered inside the Salary Survival Settings card
 * so there is a single place for every salary-driven setting.
 */
export function SurvivalPreferenceRows() {
  const { data: profile } = useProfile();
  const currency = profile?.currency ?? "INR";
  const { prefs, update } = useSurvivalPreferences();
  const [custom, setCustom] = useState<string>(
    prefs.emergencyFundCustom != null ? String(prefs.emergencyFundCustom) : "",
  );

  return (
    <>
          <li className="px-3 py-3 sm:px-4">
            <RowHead icon="🛡️" label="Emergency Fund Target" hint="Used across Coach, Planner and Insights" />
            <Chips<EmergencyFundMode>
              value={prefs.emergencyFundMode}
              options={[
                { value: "3m", label: "3 Months Salary" },
                { value: "6m", label: "6 Months Salary" },
                { value: "custom", label: "Custom Amount" },
              ]}
              onChange={(v) => update({ emergencyFundMode: v })}
            />
            {prefs.emergencyFundMode === "custom" && (
              <div className="mt-3 space-y-1.5">
                <Label htmlFor="ef-custom" className="text-xs">
                  Target amount ({currency})
                </Label>
                <Input
                  id="ef-custom"
                  type="number"
                  inputMode="decimal"
                  value={custom}
                  placeholder="100000"
                  onChange={(e) => {
                    setCustom(e.target.value);
                    const n = Number(e.target.value);
                    update({ emergencyFundCustom: e.target.value === "" || Number.isNaN(n) ? null : n });
                  }}
                />
                {prefs.emergencyFundCustom != null && (
                  <p className="text-xs text-muted-foreground">
                    Target: {formatCurrency(prefs.emergencyFundCustom, currency)}
                  </p>
                )}
              </div>
            )}
          </li>

          <li className="px-3 py-3 sm:px-4">
            <RowHead icon="📆" label="Safe Daily Spend Method" hint="How your daily allowance is split" />
            <Chips<SafeDailyMethod>
              value={prefs.safeDailyMethod}
              options={[
                { value: "equal", label: "Equal Daily Budget" },
                { value: "smart", label: "Smart Remaining Days" },
                { value: "weekend", label: "Weekend Balanced" },
              ]}
              onChange={(v) => update({ safeDailyMethod: v })}
            />
          </li>

          <li className="px-3 py-3 sm:px-4">
            <RowHead icon="🗓️" label="Weekly Budget Method" hint="Drives Weekly Report and alerts" />
            <Chips<WeeklyBudgetMethod>
              value={prefs.weeklyBudgetMethod}
              options={[
                { value: "equal", label: "Equal Weeks" },
                { value: "adaptive", label: "Smart Adaptive" },
                { value: "remaining", label: "Remaining Salary Based" },
              ]}
              onChange={(v) => update({ weeklyBudgetMethod: v })}
            />
          </li>

          <li className="px-3 py-3 sm:px-4">
            <RowHead icon="📊" label="Survival Score Preferences" hint="Choose what counts towards your score" />
            <div className="mt-2 space-y-2.5">
              {(
                [
                  ["emergency", "Emergency Fund Weight"],
                  ["savings", "Savings Weight"],
                  ["debt", "Debt Weight"],
                  ["discipline", "Spending Discipline Weight"],
                ] as const
              ).map(([key, label]) => (
                <div key={key} className="flex items-center justify-between gap-3">
                  <span className="min-w-0 truncate text-sm">{label}</span>
                  <Switch
                    checked={prefs.scoreWeights[key]}
                    onCheckedChange={(c) => update({ scoreWeights: { ...prefs.scoreWeights, [key]: c } })}
                  />
                </div>
              ))}
            </div>
          </li>
        </ul>
      </Card>
    </section>
  );
}

function RowHead({ icon, label, hint }: { icon: string; label: string; hint?: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted text-base">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{label}</p>
        {hint && <p className="truncate text-xs text-muted-foreground">{hint}</p>}
      </div>
    </div>
  );
}

function Chips<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="mt-2.5 flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
            value === o.value
              ? "border-success bg-success text-success-foreground"
              : "border-border bg-background text-foreground hover:bg-muted",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
