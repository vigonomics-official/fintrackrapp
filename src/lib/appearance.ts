// Appearance preferences: theme, accent, font size, reduced motion.
export type ThemeMode = "light" | "dark" | "system";
export type FontSize = "small" | "medium" | "large";
export type AccentColor = "emerald" | "blue" | "violet" | "amber" | "rose";

export type AppearancePreferences = {
  theme: ThemeMode;
  accent: AccentColor;
  fontSize: FontSize;
  reduceAnimations: boolean;
};

const KEY = "fintrackr_appearance_v1";
const EVENT = "fintrackr:appearance-updated";

export const DEFAULT_APPEARANCE: AppearancePreferences = {
  theme: "system",
  accent: "emerald",
  fontSize: "medium",
  reduceAnimations: false,
};

export const ACCENTS: { id: AccentColor; label: string; primary: string; glow: string; swatch: string }[] = [
  { id: "emerald", label: "Emerald", primary: "oklch(0.52 0.12 165)", glow: "oklch(0.62 0.13 165)", swatch: "#12876a" },
  { id: "blue", label: "Ocean", primary: "oklch(0.55 0.15 245)", glow: "oklch(0.65 0.16 245)", swatch: "#2563eb" },
  { id: "violet", label: "Violet", primary: "oklch(0.55 0.18 300)", glow: "oklch(0.66 0.18 300)", swatch: "#7c3aed" },
  { id: "amber", label: "Amber", primary: "oklch(0.62 0.14 70)", glow: "oklch(0.74 0.14 80)", swatch: "#d97706" },
  { id: "rose", label: "Rose", primary: "oklch(0.56 0.17 15)", glow: "oklch(0.66 0.18 15)", swatch: "#e11d48" },
];

export const FONT_SCALE: Record<FontSize, string> = {
  small: "15px",
  medium: "16px",
  large: "18px",
};

export function getAppearance(): AppearancePreferences {
  if (typeof window === "undefined") return DEFAULT_APPEARANCE;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_APPEARANCE;
    return { ...DEFAULT_APPEARANCE, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_APPEARANCE;
  }
}

export function saveAppearance(prefs: AppearancePreferences): AppearancePreferences {
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(KEY, JSON.stringify(prefs));
    } catch {}
    applyAppearance(prefs);
    window.dispatchEvent(new Event(EVENT));
  }
  return prefs;
}

export function onAppearanceChanged(cb: () => void) {
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

function resolveDark(theme: ThemeMode): boolean {
  if (theme === "dark") return true;
  if (theme === "light") return false;
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

/** Applies preferences to the document root so the whole app updates instantly. */
export function applyAppearance(prefs: AppearancePreferences) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.toggle("dark", resolveDark(prefs.theme));
  root.style.fontSize = FONT_SCALE[prefs.fontSize];
  root.classList.toggle("reduce-animations", prefs.reduceAnimations);
  const accent = ACCENTS.find((a) => a.id === prefs.accent) ?? ACCENTS[0];
  root.style.setProperty("--primary", accent.primary);
  root.style.setProperty("--primary-glow", accent.glow);
  root.style.setProperty("--ring", accent.primary);
  root.style.setProperty("--gradient-primary", `linear-gradient(135deg, ${accent.primary}, ${accent.glow})`);
}
