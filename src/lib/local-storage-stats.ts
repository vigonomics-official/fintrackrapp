// Local storage accounting + destructive data actions for the Data & Privacy
// section. Only touches FinTrackr's own localStorage keys.

export const APP_VERSION = "1.4.0";

const PREFIX_MATCH = /^(fintrackr|ft\.)/i;

export function localKeys(): string[] {
  if (typeof window === "undefined") return [];
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i += 1) {
    const k = localStorage.key(i);
    if (k && PREFIX_MATCH.test(k)) keys.push(k);
  }
  return keys;
}

/** Approximate bytes used by FinTrackr keys in localStorage. */
export function localStorageBytes(): number {
  if (typeof window === "undefined") return 0;
  return localKeys().reduce((sum, k) => sum + k.length + (localStorage.getItem(k)?.length ?? 0), 0) * 2;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/** Wipe every local FinTrackr key (profile, prefs, caches, goals, rules). */
export function clearLocalData(): number {
  const keys = localKeys();
  for (const k of keys) {
    try {
      localStorage.removeItem(k);
    } catch {
      /* ignore */
    }
  }
  try {
    sessionStorage.clear();
  } catch {
    /* ignore */
  }
  return keys.length;
}

/** Reset only derived/cached values, keeping the user's saved profile data. */
export function resetCaches(): number {
  const keys = localKeys().filter((k) => /cache|snapshot|dismissed|completed|history|logs/i.test(k));
  for (const k of keys) {
    try {
      localStorage.removeItem(k);
    } catch {
      /* ignore */
    }
  }
  return keys.length;
}
