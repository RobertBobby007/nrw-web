"use client";

import { useEffect } from "react";
import {
  THEME_EVENT_NAME,
  applyThemePreference,
  getStoredTheme,
  normalizeTheme,
} from "@/lib/theme";

export function ThemeProvider() {
  useEffect(() => {
    const applyStored = () => {
      const stored = getStoredTheme();
      applyThemePreference(stored);
      return stored;
    };

    let currentPreference = applyStored();

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handleMedia = () => {
      if (currentPreference === "system") {
        applyThemePreference("system");
      }
    };

    const handleThemeEvent = (event: Event) => {
      const detail = (event as CustomEvent<string>).detail;
      currentPreference = normalizeTheme(detail);
      applyThemePreference(currentPreference);
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== "nrw.theme") return;
      currentPreference = normalizeTheme(event.newValue);
      applyThemePreference(currentPreference);
    };

    media.addEventListener("change", handleMedia);
    window.addEventListener(THEME_EVENT_NAME, handleThemeEvent);
    window.addEventListener("storage", handleStorage);

    return () => {
      media.removeEventListener("change", handleMedia);
      window.removeEventListener(THEME_EVENT_NAME, handleThemeEvent);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  return null;
}
