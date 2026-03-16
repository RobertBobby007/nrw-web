"use client";

import { getIntlLocale, resolveLocale as normalizeAppLocale } from "@/lib/i18n";

function resolveDocumentLocale(locale?: string) {
  if (locale) return locale;
  if (typeof document !== "undefined") return document.documentElement.lang || "cs";
  return "cs";
}

export function formatLastSeen(value?: string | null, now: Date = new Date(), locale?: string) {
  const resolvedLocale = resolveDocumentLocale(locale);
  const appLocale = normalizeAppLocale(resolvedLocale);
  const isCzech = appLocale === "cs";
  const isSlovak = appLocale === "sk";
  if (!value) return "Offline";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Offline";

  const diffMs = now.getTime() - date.getTime();
  if (diffMs < 0) return "Online";

  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 60) {
    if (isCzech) return `p\u0159ed ${diffMin} minutami`;
    if (isSlovak) return `pred ${diffMin} min\u00fatami`;
    return `${diffMin} minute${diffMin === 1 ? "" : "s"} ago`;
  }

  const diffH = Math.floor(diffMin / 60);
  if (diffH < 48) {
    if (isCzech) return `p\u0159ed ${diffH} hodinami`;
    if (isSlovak) return `pred ${diffH} hodinami`;
    return `${diffH} hour${diffH === 1 ? "" : "s"} ago`;
  }

  return date.toLocaleDateString(getIntlLocale(appLocale));
}

export function getLastSeenTone(value?: string | null, now: Date = new Date()) {
  if (!value) return "offline";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "offline";
  const diffMs = now.getTime() - date.getTime();
  if (diffMs < 0) return "online";
  const diffH = diffMs / 36e5;
  if (diffH < 10) return "recent";
  return "offline";
}
