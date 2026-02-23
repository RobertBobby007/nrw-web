"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Play, Music2, TrendingUp, Bookmark, Flame, Heart } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { parseMediaUrls } from "@/lib/media";
import { requestAuth } from "@/lib/auth-required";

type Clip = {
  id: string;
  title: string;
  creator: string;
  length: string;
  views: string;
  vibe: string;
  gradient: string;
  tags: string[];
  mediaUrl?: string | null;
  postId?: string | null;
  viewsCount?: number | null;
};

const clipFeed: Clip[] = [
  {
    id: "clip-1",
    title: "Noční ride přes město",
    creator: "@nreal.urban",
    length: "0:32",
    views: "12,4 tis.",
    vibe: "Night pulse",
    gradient: "from-neutral-900 via-slate-800 to-indigo-800",
    tags: ["city", "night", "crew"],
  },
  {
    id: "clip-2",
    title: "NRW backstage: první event",
    creator: "@nrw.community",
    length: "0:28",
    views: "8,9 tis.",
    vibe: "Live moment",
    gradient: "from-amber-900 via-orange-700 to-pink-700",
    tags: ["live", "community", "event"],
  },
  {
    id: "clip-3",
    title: "Ranní káva a roadmap",
    creator: "@nrw.team",
    length: "0:19",
    views: "5,1 tis.",
    vibe: "Build mode",
    gradient: "from-sky-900 via-cyan-700 to-emerald-700",
    tags: ["produkt", "update", "nnews"],
  },
  {
    id: "clip-4",
    title: "Sraz v parku",
    creator: "@nreal.friends",
    length: "0:24",
    views: "6,7 tis.",
    vibe: "Sunny vibe",
    gradient: "from-rose-900 via-purple-700 to-indigo-700",
    tags: ["friends", "irl", "summer"],
  },
];

const clipFilters = ["Top", "Pro tebe", "Sleduješ", "Nové"];
const trendingNow = [
  { id: "tr1", label: "Noční ride", stat: "🔥 2.4k" },
  { id: "tr2", label: "NRW backstage", stat: "🔥 1.8k" },
  { id: "tr3", label: "Ranní káva", stat: "🔥 1.2k" },
  { id: "tr4", label: "Sraz v parku", stat: "🔥 960" },
];

export default function ClipsPage() {
  const activeFilter = "Top";
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const searchParams = useSearchParams();
  const router = useRouter();
  const clipPostId = searchParams.get("post");
  const [clips, setClips] = useState<Clip[]>([]);
  const [clipsLoading, setClipsLoading] = useState(false);
  const [clipsError, setClipsError] = useState<string | null>(null);
  const [clipDurations, setClipDurations] = useState<Record<string, number>>({});
  const [likesCountMap, setLikesCountMap] = useState<Record<string, number>>({});
  const [likedClipIds, setLikedClipIds] = useState<Set<string>>(new Set());
  const [likeBusyMap, setLikeBusyMap] = useState<Record<string, boolean>>({});
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [selectedClip, setSelectedClip] = useState<{
    id: string;
    content: string | null;
    mediaUrl: string | null;
  } | null>(null);
  const [clipError, setClipError] = useState<string | null>(null);
  const [clipLoading, setClipLoading] = useState(false);
  const viewTimerRef = useRef<number | null>(null);
  const viewedClipIdsRef = useRef<Set<string>>(new Set());

  const showClipOverlay = Boolean(clipPostId);

  useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(({ data, error }) => {
      if (!active) return;
      if (error) {
        setCurrentUserId(null);
        return;
      }
      setCurrentUserId(data.user?.id ?? null);
    });
    return () => {
      active = false;
    };
  }, [supabase]);

  useEffect(() => {
    let active = true;
    setClipsLoading(true);
    setClipsError(null);
    (async () => {
      try {
        const { data, error } = await supabase
          .from("nreal_posts")
          .select(
            "id, content, media_url, media_type, created_at, status, is_deleted, views_count, profiles (username, display_name)",
          )
          .eq("media_type", "video")
          .eq("status", "approved")
          .order("created_at", { ascending: false })
          .limit(20);

        if (!active) return;
        if (error || !data) {
          setClipsError("Klipy se nepodařilo načíst.");
          setClips([]);
          return;
        }
        const mapped = data
          .filter((post) => !post.is_deleted)
          .map((post, index) => {
            const mediaUrls = parseMediaUrls(post.media_url);
            const mediaUrl = mediaUrls[0] ?? null;
            const rawTitle = (post.content ?? "").trim();
            const title = rawTitle ? rawTitle.split("\n")[0].slice(0, 60) : "Nový klip";
            const profile = Array.isArray(post.profiles) ? post.profiles[0] : post.profiles;
            const creatorHandle = profile?.username ? `@${profile.username}` : "@nrw.clips";
            const gradients = [
              "from-neutral-900 via-slate-800 to-indigo-800",
              "from-amber-900 via-orange-700 to-pink-700",
              "from-sky-900 via-cyan-700 to-emerald-700",
              "from-rose-900 via-purple-700 to-indigo-700",
            ];
            return {
              id: post.id,
              postId: post.id,
              title,
              creator: creatorHandle,
              length: "0:30",
              views: typeof post.views_count === "number" ? `${post.views_count}` : "—",
              vibe: "nClips",
              gradient: gradients[index % gradients.length],
              tags: ["clip"],
              mediaUrl,
              viewsCount: typeof post.views_count === "number" ? post.views_count : null,
            } satisfies Clip;
          })
          .filter((clip) => Boolean(clip.mediaUrl));
        setClips(mapped);
      } finally {
        if (active) setClipsLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [supabase]);

  useEffect(() => {
    let active = true;
    const postIds = clips.map((clip) => clip.postId).filter(Boolean) as string[];
    if (postIds.length === 0) {
      setLikesCountMap({});
      setLikedClipIds(new Set());
      return;
    }
    (async () => {
      const likesCount: Record<string, number> = {};
      const likedSet = new Set<string>();

      const { data: likesData } = await supabase
        .from("nreal_likes")
        .select("post_id")
        .in("post_id", postIds);

      likesData?.forEach((row) => {
        const pid = (row as { post_id: string }).post_id;
        likesCount[pid] = (likesCount[pid] ?? 0) + 1;
      });

      if (currentUserId) {
        const { data: likedData } = await supabase
          .from("nreal_likes")
          .select("post_id")
          .eq("user_id", currentUserId)
          .in("post_id", postIds);

        likedData?.forEach((row) => {
          const pid = (row as { post_id: string }).post_id;
          likedSet.add(pid);
        });
      }

      if (!active) return;
      setLikesCountMap(likesCount);
      setLikedClipIds(likedSet);
    })();

    return () => {
      active = false;
    };
  }, [clips, currentUserId, supabase]);

  const handleToggleLike = useCallback(
    async (postId: string) => {
      if (!currentUserId) {
        requestAuth();
        return;
      }
      if (likeBusyMap[postId]) return;
      setLikeBusyMap((prev) => ({ ...prev, [postId]: true }));

      const isLiked = likedClipIds.has(postId);
      setLikedClipIds((prev) => {
        const next = new Set(prev);
        if (isLiked) next.delete(postId);
        else next.add(postId);
        return next;
      });
      setLikesCountMap((prev) => ({
        ...prev,
        [postId]: Math.max(0, (prev[postId] ?? 0) + (isLiked ? -1 : 1)),
      }));

      const { error } = isLiked
        ? await supabase.from("nreal_likes").delete().eq("post_id", postId).eq("user_id", currentUserId)
        : await supabase.from("nreal_likes").insert({ post_id: postId, user_id: currentUserId });

      if (error) {
        setLikedClipIds((prev) => {
          const next = new Set(prev);
          if (isLiked) next.add(postId);
          else next.delete(postId);
          return next;
        });
        setLikesCountMap((prev) => ({
          ...prev,
          [postId]: Math.max(0, (prev[postId] ?? 0) + (isLiked ? 1 : -1)),
        }));
      }

      setLikeBusyMap((prev) => ({ ...prev, [postId]: false }));
    },
    [currentUserId, likedClipIds, likeBusyMap, supabase],
  );

  const clearViewTimer = useCallback(() => {
    if (viewTimerRef.current) {
      window.clearTimeout(viewTimerRef.current);
      viewTimerRef.current = null;
    }
  }, []);

  const recordView = useCallback(async (postId: string) => {
    if (!postId || viewedClipIdsRef.current.has(postId)) return;
    viewedClipIdsRef.current.add(postId);
    await fetch("/api/nreal/view", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postId }),
    }).catch(() => null);
  }, []);

  const formatViews = useCallback((count: number | null | undefined) => {
    if (typeof count !== "number") return "—";
    if (count < 1000) return `${count}`;
    if (count < 1_000_000) return `${(count / 1000).toFixed(1).replace(/\\.0$/, "")}k`;
    return `${(count / 1_000_000).toFixed(1).replace(/\\.0$/, "")}m`;
  }, []);

  useEffect(() => {
    if (!clipPostId) {
      setSelectedClip(null);
      setClipError(null);
      return;
    }
    let active = true;
    setClipLoading(true);
    setClipError(null);
    (async () => {
      try {
        const { data, error } = await supabase
          .from("nreal_posts")
          .select("id, content, media_url, media_type")
          .eq("id", clipPostId)
          .maybeSingle();

        if (!active) return;
        if (error || !data) {
          setSelectedClip(null);
          setClipError("Klip se nepodařilo načíst.");
          return;
        }
        if (data.media_type !== "video" || !data.media_url) {
          setSelectedClip(null);
          setClipError("Tenhle příspěvek není video klip.");
          return;
        }
        const mediaUrls = parseMediaUrls(data.media_url);
        const firstUrl = mediaUrls[0] ?? null;
        if (!firstUrl) {
          setSelectedClip(null);
          setClipError("Video nemá platnou URL.");
          return;
        }
        setSelectedClip({
          id: data.id,
          content: data.content ?? null,
          mediaUrl: firstUrl,
        });
      } finally {
        if (active) setClipLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [clipPostId, supabase]);

  if (showClipOverlay) {
    return (
      <main className="fixed inset-0 z-50 flex flex-col bg-black text-white">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-white/70">nClips</div>
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-full border border-white/20 px-3 py-1 text-xs font-semibold text-white transition hover:bg-white/10"
          >
            Zpět
          </button>
        </div>
        <div className="flex flex-1 items-center justify-center px-4 pb-6">
          {clipError ? (
            <div className="max-w-md rounded-xl bg-white/10 px-4 py-3 text-sm text-white/90">{clipError}</div>
          ) : clipLoading || !selectedClip ? (
            <div className="text-sm text-white/70">Načítám klip…</div>
          ) : (
            <div className="flex w-full max-w-5xl flex-col items-center gap-4 lg:flex-row lg:items-start">
              <div className="aspect-[9/16] w-full max-w-[520px] overflow-hidden rounded-2xl bg-black">
                <video
                  src={selectedClip.mediaUrl ?? undefined}
                  controls
                  autoPlay
                  muted
                  loop
                  playsInline
                  onPlay={() => {
                    clearViewTimer();
                    viewTimerRef.current = window.setTimeout(() => {
                      if (selectedClip?.id) {
                        recordView(selectedClip.id);
                      }
                    }, 2500);
                  }}
                  onPause={clearViewTimer}
                  onEnded={clearViewTimer}
                  className="h-full w-full object-contain"
                />
              </div>
              <div className="max-w-md space-y-3 text-left">
                <div className="text-sm font-semibold text-white">Přehráváš klip</div>
                {selectedClip.content ? (
                  <p className="text-sm text-white/80 whitespace-pre-line">{selectedClip.content}</p>
                ) : (
                  <p className="text-sm text-white/60">Bez popisku.</p>
                )}
                <div className="flex flex-wrap gap-2 text-xs text-white/70">
                  <span className="rounded-full border border-white/20 px-3 py-1">nClips</span>
                  <span className="rounded-full border border-white/20 px-3 py-1">Video only</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-neutral-50">
      <section className="mx-auto max-w-7xl px-4 py-8 space-y-8">
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight text-neutral-900">Fresh Reels z NRW</h1>
          <p className="max-w-2xl text-sm text-neutral-600">
            Krátká videa a highlighty komunity. Projeď to jako feed, co si pustíš mezi zprávami v
            nChat – rychlé, vizuální a živé.
          </p>
        </header>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          {clipFilters.map((filter) => {
            const isActive = filter === activeFilter;
            return (
              <button
                key={filter}
                type="button"
                className={
                  isActive
                    ? "rounded-full bg-black px-3 py-1 text-[11px] font-medium text-white"
                    : "rounded-full border border-neutral-200 bg-white px-3 py-1 text-[11px] font-medium text-neutral-600"
                }
              >
                {filter}
              </button>
            );
          })}
        </div>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
            {clipsLoading ? (
              <div className="rounded-2xl border border-dashed border-neutral-200 bg-white p-6 text-sm text-neutral-500">
                Načítám klipy…
              </div>
            ) : clipsError ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-700">
                {clipsError}
              </div>
            ) : clips.length === 0 ? (
              <div className="rounded-2xl border border-neutral-200 bg-white p-6 text-sm text-neutral-500">
                Zatím nejsou žádné klipy.
              </div>
            ) : (
              clips.map((clip) => {
                const isRealVideo = Boolean(clip.mediaUrl);
                const href = clip.postId ? `/clips?post=${encodeURIComponent(clip.postId)}` : "/clips";
                const durationSeconds = clipDurations[clip.id];
                const durationLabel =
                  typeof durationSeconds === "number" && Number.isFinite(durationSeconds)
                    ? `${Math.floor(durationSeconds / 60)}:${String(Math.floor(durationSeconds % 60)).padStart(2, "0")}`
                    : "—";
                const likesCount = clip.postId ? likesCountMap[clip.postId] ?? 0 : 0;
                const isLiked = clip.postId ? likedClipIds.has(clip.postId) : false;
                const viewsLabel = formatViews(clip.viewsCount);
                return (
                  <article
                    key={clip.id}
                    className="flex flex-col gap-4 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm"
                  >
                  <Link
                    href={href}
                    className="relative overflow-hidden rounded-2xl border border-neutral-200/60 bg-neutral-900"
                  >
                    <div className="relative flex flex-col gap-3 p-3 text-white">
                      {isRealVideo ? (
                        <div className="relative w-full overflow-hidden rounded-2xl border border-white/10 bg-black/70 aspect-[9/16]">
                          <video
                            src={clip.mediaUrl ?? undefined}
                            muted
                            autoPlay
                            loop
                            playsInline
                            preload="metadata"
                            onCanPlay={(e) => {
                              const el = e.currentTarget;
                              if (el.paused) {
                                el.play().catch(() => null);
                              }
                            }}
                            onLoadedMetadata={(e) => {
                              const el = e.currentTarget;
                              const nextDuration = Number.isFinite(el.duration) ? el.duration : 0;
                              setClipDurations((prev) =>
                                prev[clip.id] === nextDuration ? prev : { ...prev, [clip.id]: nextDuration },
                              );
                            }}
                            onTimeUpdate={(e) => {
                              const el = e.currentTarget;
                              if (el.currentTime >= 5) {
                                el.currentTime = 0;
                                if (el.paused) {
                                  el.play().catch(() => null);
                                }
                              }
                            }}
                            className="h-full w-full object-cover"
                          />
                          <div className="absolute bottom-3 left-3 inline-flex items-center gap-2 rounded-full bg-black/60 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]">
                            <Play className="h-3.5 w-3.5" />
                            {durationLabel}
                          </div>
                          <div className="absolute right-3 top-3 rounded-full bg-black/60 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em]">
                            nClips
                          </div>
                          {clip.postId ? (
                            <button
                              type="button"
                              aria-label={isLiked ? "Odebrat like" : "Dát like"}
                              onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                handleToggleLike(clip.postId as string);
                              }}
                              className={`absolute bottom-3 right-3 inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] transition ${
                                isLiked ? "bg-rose-500/90 text-white" : "bg-black/60 text-white"
                              }`}
                            >
                              <Heart className={`h-3.5 w-3.5 ${isLiked ? "fill-white" : ""}`} />
                              {likesCount}
                            </button>
                          ) : null}
                        </div>
                      ) : null}

                      <div className="space-y-2">
                        <div className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-1 text-[11px] font-medium uppercase tracking-[0.14em]">
                          <TrendingUp className="h-3.5 w-3.5" />
                          {viewsLabel} shlédnutí
                        </div>
                        <h2 className="text-lg font-semibold leading-tight drop-shadow-sm">{clip.title}</h2>
                        <p className="text-sm text-neutral-100">{clip.creator}</p>
                        <div className="flex flex-wrap gap-2 text-[11px]">
                          {clip.tags.map((tag) => (
                            <span
                              key={tag}
                              className="rounded-full bg-white/10 px-2 py-1 font-semibold uppercase tracking-[0.14em] text-neutral-100 backdrop-blur"
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </Link>

                  <div className="flex items-center justify-between text-sm">
                    <div className="space-y-0.5">
                      <p className="font-semibold text-neutral-900">{clip.title}</p>
                      <p className="text-xs text-neutral-500">
                        {clip.creator} · {viewsLabel}
                      </p>
                    </div>
                    <Link
                      href={href}
                      className="rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs font-semibold text-neutral-700 transition hover:-translate-y-0.5 hover:bg-neutral-100"
                    >
                      Pustit
                    </Link>
                  </div>
                </article>
              );
              })
            )}
          </div>

          <aside className="hidden space-y-3 lg:block lg:sticky lg:top-6">
            <div className="space-y-3 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between text-sm font-semibold text-neutral-900">
                Tvoje flow
                <span className="text-xs font-medium text-neutral-500">Mini storyboard</span>
              </div>
              <div className="space-y-2 text-sm text-neutral-700">
                <div className="rounded-xl border border-dashed border-neutral-200 bg-neutral-50 px-3 py-2">
                  <p className="text-xs uppercase tracking-[0.16em] text-neutral-500">Idea</p>
                  <p className="font-semibold text-neutral-900">Co teď natáčíš?</p>
                  <p className="text-xs text-neutral-500">Vhoď sem vibe, hudbu a linkni nChat.</p>
                </div>
                <div className="rounded-xl border border-neutral-200 bg-white px-3 py-2 shadow-sm">
                  <p className="text-xs uppercase tracking-[0.16em] text-neutral-500">Spojka</p>
                  <p className="font-semibold text-neutral-900">Sdílej do nChat</p>
                  <p className="text-xs text-neutral-500">
                    Každý klip má share do nChat – rychlé reakce od lidí, co sleduješ.
                  </p>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-neutral-200 bg-neutral-900 px-3 py-3 text-white shadow-sm">
                  <div>
                    <p className="text-xs uppercase tracking-[0.16em] text-neutral-300">
                      Zvuk týdne
                    </p>
                    <p className="text-sm font-semibold">lofi sprint · 00:18</p>
                  </div>
                  <button className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-semibold text-neutral-900 transition hover:-translate-y-0.5">
                    <Play className="h-4 w-4" />
                    Přehrát
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-3 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between text-sm font-semibold text-neutral-900">
                <span className="inline-flex items-center gap-2">
                  <Flame className="h-4 w-4 text-orange-500" />
                  Trendy dnes
                </span>
                <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-neutral-500">
                  nClips
                </span>
              </div>
              <div className="space-y-2 text-sm text-neutral-800">
                {trendingNow.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between rounded-xl border border-neutral-100 bg-neutral-50 px-3 py-2"
                  >
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-orange-500 shadow-[0_0_0_4px_rgba(249,115,22,0.15)]" />
                      <span className="font-semibold text-neutral-900">{item.label}</span>
                    </div>
                    <span className="text-xs font-semibold text-orange-600">{item.stat}</span>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}
