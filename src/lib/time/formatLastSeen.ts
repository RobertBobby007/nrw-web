"use client";

function resolveLocale(locale?: string) {
  if (locale) return locale;
  if (typeof document !== "undefined") return document.documentElement.lang || "cs";
  return "cs";
}

export function formatLastSeen(value?: string | null, now: Date = new Date(), locale?: string) {
  const resolvedLocale = resolveLocale(locale);
  const isCzech = resolvedLocale.startsWith("cs");
  if (!value) return isCzech ? "Offline" : "Offline";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return isCzech ? "Offline" : "Offline";

  const diffMs = now.getTime() - date.getTime();
  if (diffMs < 0) return isCzech ? "Online" : "Online";

  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 60) {
    return isCzech
      ? `p\u0159ed ${diffMin} minutami`
      : `${diffMin} minute${diffMin === 1 ? "" : "s"} ago`;
  }

  const diffH = Math.floor(diffMin / 60);
  if (diffH < 48) {
    return isCzech
      ? `p\u0159ed ${diffH} hodinami`
      : `${diffH} hour${diffH === 1 ? "" : "s"} ago`;
  }

  const day = date.getDate();
  const month = date.getMonth() + 1;
  const year = date.getFullYear();
  return `${day}. ${month}. ${year}`;
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
