import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

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

function write(next: SalarySettings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
    window.dispatchEvent(new Event("fintrackr:salary-updated"));
    window.dispatchEvent(new Event("fintrackr:ai-coach:profile-updated"));
    window.dispatchEvent(new Event("fintrackr:notifications:updated"));
  } catch {}
}

/** Keep the signed-in user's salary in their cloud profile so it survives
 *  logout, refresh and a different device. localStorage stays a fast cache. */
async function syncSalaryWithCloud(local: SalarySettings): Promise<SalarySettings | null> {
  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;
  if (!user) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("monthly_salary, salary_date")
    .eq("id", user.id)
    .maybeSingle();
  if (error) return null;

  const cloudAmount = data?.monthly_salary != null ? Number(data.monthly_salary) : null;
  const cloudPayDay = data?.salary_date != null ? Number(data.salary_date) : null;

  // Nothing stored in the cloud yet but we have local values → push them up.
  if (cloudAmount == null && cloudPayDay == null) {
    if (local.amount != null || local.payDay != null) {
      await supabase
        .from("profiles")
        .update({ monthly_salary: local.amount, salary_date: local.payDay })
        .eq("id", user.id);
    }
    return null;
  }

  const merged: SalarySettings = {
    ...local,
    amount: cloudAmount ?? local.amount,
    payDay: cloudPayDay ?? local.payDay,
  };
  if (merged.amount === local.amount && merged.payDay === local.payDay) return null;
  write(merged);
  return merged;
}

export function useSalarySettings() {
  const [settings, setSettings] = useState<SalarySettings>(read);

  useEffect(() => {
    let cancelled = false;
    syncSalaryWithCloud(read())
      .then((merged) => { if (merged && !cancelled) setSettings(merged); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

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
        window.dispatchEvent(new Event("fintrackr:ai-coach:profile-updated"));
        window.dispatchEvent(new Event("fintrackr:notifications:updated"));
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
