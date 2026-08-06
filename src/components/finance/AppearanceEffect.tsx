import { useEffect } from "react";
import { applyAppearance, getAppearance, onAppearanceChanged } from "@/lib/appearance";

/** Applies saved appearance preferences on load and keeps them in sync. */
export function AppearanceEffect() {
  useEffect(() => {
    applyAppearance(getAppearance());
    const off = onAppearanceChanged(() => applyAppearance(getAppearance()));
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onScheme = () => {
      if (getAppearance().theme === "system") applyAppearance(getAppearance());
    };
    mq.addEventListener("change", onScheme);
    return () => {
      off();
      mq.removeEventListener("change", onScheme);
    };
  }, []);
  return null;
}
