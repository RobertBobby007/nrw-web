"use client";

export function formatLastSeen(value?: string | null, now: Date = new Date()) {
  if (!value) return "Offline";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Offline";

  const diffMs = now.getTime() - date.getTime();
  if (diffMs < 0) return "Online";

  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 60) {
    return `před ${diffMin} minutami`;
  }

  const diffH = Math.floor(diffMin / 60);
  if (diffH < 48) {
    return `před ${diffH} hodinami`;
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
