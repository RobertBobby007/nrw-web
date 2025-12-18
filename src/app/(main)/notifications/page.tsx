"use client";

import { useEffect, useMemo, useState } from "react";
import { Megaphone } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { safeIdentityLabel } from "@/lib/content-filter";

type ActorProfile = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
};

type NotificationRow = {
  id: string;
  type: string;
  actor_id: string | null;
  created_at: string;
  read_at: string | null;
  title?: string | null;
  body?: string | null;
  severity?: "info" | "warn" | "urgent" | string | null;
  url?: string | null;
};

function errorMessage(err: unknown) {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  return null;
}

function formatTimeLabel(createdAt?: string | null) {
  if (!createdAt) return "neznámý čas";
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return "neznámý čas";
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffH = Math.floor(diffMin / 60);
  if (diffMin < 1) return "před chvílí";
  if (diffMin < 60) return `před ${diffMin} min`;
  if (diffH < 24) return `před ${diffH} h`;
  return date.toLocaleDateString("cs-CZ", { day: "numeric", month: "short" });
}

function notificationText(type: string) {
  const t = (type ?? "").toLowerCase();
  if (t === "follow" || t === "followed") return "začal/a tě sledovat";
  return "poslal/a notifikaci";
}

function severityLabel(value: string | null | undefined): string | null {
  const v = (value ?? "").toLowerCase();
  if (v === "info") return "Info";
  if (v === "warn") return "Varování";
  if (v === "urgent") return "Důležité";
  return null;
}

function severityClasses(value: string | null | undefined): string {
  const v = (value ?? "").toLowerCase();
  if (v === "urgent") return "bg-rose-50 text-rose-700 ring-1 ring-rose-200";
  if (v === "warn") return "bg-amber-50 text-amber-800 ring-1 ring-amber-200";
  return "bg-sky-50 text-sky-700 ring-1 ring-sky-200";
}

export default function NotificationsPage() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [actorsById, setActorsById] = useState<Record<string, ActorProfile>>({});

  const unreadCount = items.filter((n) => !n.read_at).length;

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from("notifications")
        .select(
          `
          id,
          type,
          actor_id,
          created_at,
          read_at,
          title,
          body,
          severity,
          url
        `,
        )
        .order("created_at", { ascending: false })
        .limit(50);

      if (!active) return;
      if (error) {
        setError(error.message);
        setItems([]);
        setActorsById({});
      } else {
        const notifications = ((data as NotificationRow[] | null) ?? []).filter(Boolean);
        setItems(notifications);

        const actorIds = Array.from(
          new Set(notifications.map((n) => n.actor_id).filter((id): id is string => Boolean(id))),
        );

        if (actorIds.length === 0) {
          setActorsById({});
        } else {
          const { data: profilesData, error: profilesError } = await supabase
            .from("profiles")
            .select("id, username, display_name, avatar_url")
            .in("id", actorIds);

          if (!active) return;

          if (profilesError) {
            console.error("Notifications profiles fetch error", profilesError);
            setActorsById({});
          } else {
            const map: Record<string, ActorProfile> = {};
            (profilesData ?? []).forEach((p: ActorProfile) => {
              map[p.id] = p;
            });
            setActorsById(map);
          }
        }
      }
      setLoading(false);
    };
    void load();
    return () => {
      active = false;
    };
  }, [supabase]);

  const markAllAsRead = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    const now = new Date().toISOString();
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user?.id) throw new Error("Musíš být přihlášený.");

      const { error } = await supabase
        .from("notifications")
        .update({ read_at: now })
        .eq("user_id", user.id)
        .is("read_at", null);

      if (error) throw error;
      setItems((prev) => prev.map((n) => (n.read_at ? n : { ...n, read_at: now })));
      window.dispatchEvent(new CustomEvent("nrw:notifications_updated"));
    } catch (e: unknown) {
      console.error("markAllAsRead failed", e);
      setError(errorMessage(e) ?? "Akce se nepovedla.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen bg-white mx-auto max-w-4xl px-4 py-10 space-y-4">
      <header className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.2em] text-neutral-600">Centrum upozornění</p>
          <h1 className="text-3xl font-semibold text-neutral-900">Oznámení</h1>
          <p className="text-sm text-neutral-700">Tvoje oznámení a systémové zprávy.</p>
        </div>

        <button
          type="button"
          disabled={busy || unreadCount === 0 || loading}
          onClick={markAllAsRead}
          className="rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold text-neutral-900 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Označit vše jako přečtené
        </button>
      </header>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      ) : null}

      <div className="rounded-xl border border-neutral-200/70 bg-white p-2 shadow-sm">
        {loading ? (
          <div className="p-4 text-sm text-neutral-600">Načítám notifikace…</div>
        ) : items.length === 0 ? (
          <div className="p-4 text-sm text-neutral-600">Zatím žádné notifikace.</div>
        ) : (
          <div className="divide-y divide-neutral-100">
            {items.map((n) => {
              const actor = n.actor_id ? actorsById[n.actor_id] : null;
              const safeUsername = safeIdentityLabel(actor?.username ?? null, "");
              const name = safeIdentityLabel(actor?.display_name ?? null, safeUsername || "NRW uživatel");
              const username = safeUsername ? `@${safeUsername}` : null;
              const unread = !n.read_at;
              const isAnnouncement = (n.type ?? "").toLowerCase() === "announcement";
              const annTitle = (n.title ?? "").trim() || "Oznámení";
              const annBody = (n.body ?? "").trim();
              const annSeverity = severityLabel(n.severity);
              const hasUrl = Boolean((n.url ?? "").trim());
              return (
                <div
                  key={n.id}
                  className={`flex items-center justify-between gap-3 p-4 text-sm ${
                    unread ? "bg-amber-50/60" : "bg-white"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {actor?.avatar_url ? (
                      <img
                        src={actor.avatar_url}
                        alt={name}
                        className="h-10 w-10 rounded-full object-cover ring-1 ring-neutral-200"
                        onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")}
                      />
                    ) : isAnnouncement ? (
                      <div
                        className={`flex h-10 w-10 items-center justify-center rounded-full ${severityClasses(
                          n.severity,
                        )}`}
                        aria-hidden
                      >
                        <Megaphone className="h-5 w-5" />
                      </div>
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-neutral-200 to-neutral-100 text-xs font-semibold text-neutral-700 ring-1 ring-neutral-200">
                        {name.slice(0, 1).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      {isAnnouncement ? (
                        <>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-neutral-900">{annTitle}</span>
                            {annSeverity ? (
                              <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${severityClasses(n.severity)}`}>
                                {annSeverity}
                              </span>
                            ) : null}
                          </div>
                          {annBody ? <div className="mt-0.5 text-sm text-neutral-700">{annBody}</div> : null}
                          {actor ? (
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-neutral-500">
                              <span>{name}</span>
                              {username ? <span>{username}</span> : null}
                            </div>
                          ) : null}
                        </>
                      ) : (
                        <>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-neutral-900">{name}</span>
                            {username ? <span className="text-xs text-neutral-500">{username}</span> : null}
                          </div>
                          <div className="text-sm text-neutral-700">{notificationText(n.type)}</div>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-xs font-semibold text-neutral-500">{formatTimeLabel(n.created_at)}</div>
                    {isAnnouncement && hasUrl ? (
                      <a
                        href={(n.url ?? "").trim()}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 inline-flex rounded-full border border-neutral-200 bg-white px-3 py-1 text-[11px] font-semibold text-neutral-900 transition hover:bg-neutral-50"
                      >
                        Otevřít
                      </a>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
