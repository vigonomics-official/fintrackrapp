import { useEffect, useState } from "react";
import {
  getSurvivalPreferences,
  onSurvivalPreferencesChanged,
  updateSurvivalPreferences,
  type SurvivalPreferences,
} from "@/lib/survival-preferences";

export function useSurvivalPreferences() {
  const [prefs, setPrefs] = useState<SurvivalPreferences>(getSurvivalPreferences);

  useEffect(() => {
    setPrefs(getSurvivalPreferences());
    return onSurvivalPreferencesChanged(() => setPrefs(getSurvivalPreferences()));
  }, []);

  const update = (patch: Partial<SurvivalPreferences>) => {
    setPrefs(updateSurvivalPreferences(patch));
  };

  return { prefs, update };
}
