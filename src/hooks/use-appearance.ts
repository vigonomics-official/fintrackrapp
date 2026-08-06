import { useEffect, useState } from "react";
import {
  getAppearance,
  onAppearanceChanged,
  saveAppearance,
  applyAppearance,
  type AppearancePreferences,
} from "@/lib/appearance";

export function useAppearance() {
  const [prefs, setPrefs] = useState<AppearancePreferences>(getAppearance);

  useEffect(() => {
    const current = getAppearance();
    setPrefs(current);
    applyAppearance(current);
    return onAppearanceChanged(() => setPrefs(getAppearance()));
  }, []);

  const save = (next: AppearancePreferences) => setPrefs(saveAppearance(next));

  return { prefs, save };
}
