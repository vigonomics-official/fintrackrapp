import { useEffect, useState } from "react";
import {
  getLocalization,
  onLocalizationChanged,
  updateLocalization,
  type LocalizationPreferences,
} from "@/lib/localization";

export function useLocalization() {
  const [prefs, setPrefs] = useState<LocalizationPreferences>(getLocalization);

  useEffect(() => {
    setPrefs(getLocalization());
    return onLocalizationChanged(() => setPrefs(getLocalization()));
  }, []);

  const update = (patch: Partial<LocalizationPreferences>) => setPrefs(updateLocalization(patch));

  return { prefs, update };
}
