import { useCallback, useEffect, useState } from "react";

export type EmploymentType = "salaried" | "daily_wage" | "freelance";

export type SalarySettings = {
  amount: number | null;
  /** Day of month (1-31) or 0 for "last day" */
  payDay: number | null;
  employmentType: EmploymentType;
};

const KEY = "fintrackr_salary_settings_v1";

const DEFAULT: SalarySettings = {
  amount: null,
  payDay: null,
  employmentType: "salaried",
};

function read(): SalarySettings {
  if (typeof window === "undefined") return DEFAULT;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT, ...parsed };
  } catch {
    return DEFAULT;
  }
}

export function useSalarySettings() {
  const [settings, setSettings] = useState<SalarySettings>(read);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) setSettings(read());
    };
    const onCustom = () => setSettings(read());
    window.addEventListener("storage", onStorage);
    window.addEventListener("fintrackr:salary-updated", onCustom);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("fintrackr:salary-updated", onCustom);
    };
  }, []);

  const update = useCallback((patch: Partial<SalarySettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
        window.dispatchEvent(new Event("fintrackr:salary-updated"));
      } catch {}
      return next;
    });
  }, []);

  return { settings, update, isConfigured: settings.amount != null && settings.payDay != null };
}

export function payDayLabel(day: number | null): string {
  if (day == null) return "Not set";
  if (day === 0) return "Last day of every month";
  const s = day % 10 === 1 && day !== 11 ? "st"
    : day % 10 === 2 && day !== 12 ? "nd"
    : day % 10 === 3 && day !== 13 ? "rd" : "th";
  return `${day}${s} of every month`;
}

export function employmentLabel(t: EmploymentType): string {
  return t === "salaried" ? "Salaried" : t === "daily_wage" ? "Daily Wage" : "Freelance";
}
