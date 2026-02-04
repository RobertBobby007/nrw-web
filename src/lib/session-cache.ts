type SessionCachePayload<T> = {
  value: T;
  fetchedAt: number;
  userId?: string | null;
};

export const AUTH_SESSION_KEY = "nrw.auth.user";
export const AUTH_SESSION_TTL_MS = 60 * 60 * 1000;

export function canHydrateFromSession() {
  return typeof window !== "undefined" && (window as { __nrw_hydrated?: boolean }).__nrw_hydrated === true;
}

export function readSessionCache<T>(
  key: string,
  ttlMs: number,
  userId?: string | null,
): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const payload = JSON.parse(raw) as SessionCachePayload<T> | null;
    if (!payload || typeof payload.fetchedAt !== "number") return null;
    if (Date.now() - payload.fetchedAt > ttlMs) return null;
    if (userId !== undefined && payload.userId !== userId) return null;
    return payload.value ?? null;
  } catch {
    return null;
  }
}

export function writeSessionCache<T>(key: string, value: T, userId?: string | null) {
  if (typeof window === "undefined") return;
  try {
    const payload: SessionCachePayload<T> = {
      value,
      fetchedAt: Date.now(),
      userId: userId ?? null,
    };
    sessionStorage.setItem(key, JSON.stringify(payload));
  } catch {
    // ignore sessionStorage failures
  }
}
