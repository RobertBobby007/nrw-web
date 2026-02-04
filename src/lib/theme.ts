export type ThemePreference = "system" | "light" | "dark";

export const THEME_STORAGE_KEY = "nrw.theme";
export const THEME_EVENT_NAME = "nrw:theme";

const THEMES: ThemePreference[] = ["system", "light", "dark"];

export function normalizeTheme(value: string | null | undefined): ThemePreference {
  if (value && THEMES.includes(value as ThemePreference)) {
    return value as ThemePreference;
  }
  return "system";
}

export function getStoredTheme(): ThemePreference {
  if (typeof window === "undefined") return "system";
  return normalizeTheme(window.localStorage.getItem(THEME_STORAGE_KEY));
}

export function resolveTheme(preference: ThemePreference, prefersDark: boolean): "light" | "dark" {
  if (preference === "dark") return "dark";
  if (preference === "light") return "light";
  return prefersDark ? "dark" : "light";
}

export function applyThemePreference(preference: ThemePreference) {
  if (typeof document === "undefined") return;
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const resolved = resolveTheme(preference, prefersDark);
  const root = document.documentElement;
  root.classList.toggle("dark", resolved === "dark");
  root.dataset.theme = preference;
  root.style.colorScheme = resolved;
}

export function setThemePreference(preference: ThemePreference) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(THEME_STORAGE_KEY, preference);
  applyThemePreference(preference);
  window.dispatchEvent(new CustomEvent(THEME_EVENT_NAME, { detail: preference }));
}
