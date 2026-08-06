// Currency & localization preferences shared across the app.
export type DateFormat = "DD/MM/YYYY" | "MM/DD/YYYY";
export type NumberFormat = "indian" | "international";
export type LanguageCode = "en" | "ta";

export type LocalizationPreferences = {
  currency: string;
  dateFormat: DateFormat;
  numberFormat: NumberFormat;
  language: LanguageCode;
  /** null = auto detect from device */
  timeZone: string | null;
};

const KEY = "fintrackr_localization_v1";
const EVENT = "fintrackr:localization-updated";

export const DEFAULT_LOCALIZATION: LocalizationPreferences = {
  currency: "INR",
  dateFormat: "DD/MM/YYYY",
  numberFormat: "indian",
  language: "en",
  timeZone: null,
};

export const SUPPORTED_CURRENCIES: { code: string; label: string; symbol: string }[] = [
  { code: "INR", label: "Indian Rupee", symbol: "₹" },
  { code: "USD", label: "US Dollar", symbol: "$" },
  { code: "EUR", label: "Euro", symbol: "€" },
  { code: "GBP", label: "British Pound", symbol: "£" },
  { code: "AED", label: "UAE Dirham", symbol: "AED " },
];

export const LANGUAGES: { code: LanguageCode; label: string }[] = [
  { code: "en", label: "English" },
  { code: "ta", label: "தமிழ்" },
];

export function detectTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata";
  } catch {
    return "Asia/Kolkata";
  }
}

export function getLocalization(): LocalizationPreferences {
  if (typeof window === "undefined") return DEFAULT_LOCALIZATION;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_LOCALIZATION;
    return { ...DEFAULT_LOCALIZATION, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_LOCALIZATION;
  }
}

export function updateLocalization(patch: Partial<LocalizationPreferences>): LocalizationPreferences {
  const next = { ...getLocalization(), ...patch };
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {}
    window.dispatchEvent(new Event(EVENT));
    // Downstream consumers that cache derived numbers.
    window.dispatchEvent(new Event("fintrackr:notifications:updated"));
  }
  return next;
}

export function onLocalizationChanged(cb: () => void) {
  if (typeof window === "undefined") return () => {};
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) cb();
  };
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", onStorage);
  };
}

export function numberLocale(format: NumberFormat) {
  return format === "indian" ? "en-IN" : "en-US";
}

/** Formats a plain number using the saved number-format preference. */
export function formatNumber(value: number, opts?: Intl.NumberFormatOptions) {
  const prefs = getLocalization();
  return value.toLocaleString(numberLocale(prefs.numberFormat), opts);
}

/** Formats a date using the saved date-format and time zone preference. */
export function formatDate(input: Date | string | number): string {
  const prefs = getLocalization();
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: prefs.timeZone ?? detectTimeZone(),
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const dd = get("day");
  const mm = get("month");
  const yyyy = get("year");
  return prefs.dateFormat === "MM/DD/YYYY" ? `${mm}/${dd}/${yyyy}` : `${dd}/${mm}/${yyyy}`;
}
