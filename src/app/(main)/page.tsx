"use client";

import {
  CalendarDays,
  Flame,
  GripVertical,
  MapPin,
  LocateFixed,
  Moon,
  Sun,
  Users,
} from "lucide-react";
import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { requestAuth } from "@/lib/auth-required";
import { PostCard } from "./real/PostCard";
import { fetchCurrentProfile, type Profile } from "@/lib/profiles";
import type { NrealPost, NrealProfile } from "@/types/nreal";
import { useWeather } from "@/hooks/useWeather";
import { useRealtimeNRealFeed } from "@/hooks/useRealtimeNRealFeed";
import { getFeedVariant, rankPosts } from "@/lib/nreal-feed-ranking";
import {
  AUTH_SESSION_KEY,
  AUTH_SESSION_TTL_MS,
  canHydrateFromSession,
  readSessionCache,
  writeSessionCache,
} from "@/lib/session-cache";

type FeedItem = {
  id: string;
  type: "nReal" | "nNews";
  title: string;
  excerpt: string;
  meta: string;
  createdAt: string;
};

type WidgetId = "weather" | "date" | "suggested" | "heatmap";
type WeatherSnapshot = ReturnType<typeof useWeather>;

const WIDGETS_STORAGE_KEY = "nrw.widget.layout";

const tabs = ["Mix", "nReal", "nNews"] as const;
type StreamTab = (typeof tabs)[number];

type SupabasePost = Omit<NrealPost, "profiles" | "likesCount" | "likedByCurrentUser" | "status"> & {
  status?: NrealPost["status"] | null;
  profiles?: NrealProfile | NrealProfile[] | null;
  likesCount?: number;
  likedByCurrentUser?: boolean;
  commentsCount?: number;
};

const MAIN_FEED_CACHE_TTL_MS = 30000;
const MAIN_FEED_CACHE_LIMIT = 30;
let nrealFeedCache: { userId: string | null; posts: NrealPost[]; fetchedAt: number } | null = null;
const MAIN_FEED_SESSION_KEY = "nrw.feed.main";
const MAIN_FEED_SESSION_TTL_MS = 30000;

type StreamItem =
  | { kind: "nReal"; createdAt: string; post: NrealPost }
  | { kind: "nNews"; createdAt: string; item: FeedItem };

const widgetConfig: Record<
  WidgetId,
  {
    title: string;
    render: (today: Date | undefined, weather: WeatherSnapshot) => ReactNode;
  }
> = {
  weather: { title: "Počasí", render: (today, weather) => <WeatherWidget today={today} weather={weather} /> },
  date: { title: "Kalendář", render: (today, _weather) => <DateWidget today={today} /> },
  suggested: { title: "Návrhy", render: (_today, _weather) => <SuggestionsWidget /> },
  heatmap: { title: "Heat mapa", render: (_today, _weather) => <HeatmapWidget /> },
};

const defaultWidgetOrder: WidgetId[] = ["weather", "date", "suggested", "heatmap"];

function formatStreamDate(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "neznámé datum";
  return date.toLocaleDateString("cs-CZ", { day: "2-digit", month: "2-digit", year: "numeric" });
}

const normalizePost = (post: SupabasePost): NrealPost => {
  const rawProfiles = post?.profiles;
  const profiles = Array.isArray(rawProfiles) ? rawProfiles : rawProfiles ? [rawProfiles] : [];
  return {
    ...post,
    status: post.status ?? "approved",
    is_deleted: (post as SupabasePost).is_deleted ?? null,
    profiles,
    likesCount: post.likesCount ?? 0,
    likedByCurrentUser: post.likedByCurrentUser ?? false,
    commentsCount: post.commentsCount ?? 0,
  };
};

export default function HomePage() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const weather = useWeather();
  const canHydrate = canHydrateFromSession();
  const initialUserId = canHydrate
    ? readSessionCache<string | null>(AUTH_SESSION_KEY, AUTH_SESSION_TTL_MS) ?? null
    : null;
  const initialFeed = canHydrate
    ? readSessionCache<NrealPost[]>(MAIN_FEED_SESSION_KEY, MAIN_FEED_SESSION_TTL_MS, initialUserId)
    : null;
  const hasInitialFeed = initialFeed !== null;
  const [activeTab, setActiveTab] = useState<StreamTab>("Mix");
  const [today] = useState<Date>(() => new Date());
  const [isEditing, setIsEditing] = useState(false);
  const [widgetOrder, setWidgetOrder] = useState<WidgetId[]>(defaultWidgetOrder);
  const [hasHydrated, setHasHydrated] = useState(false);
  const [draggingId, setDraggingId] = useState<WidgetId | null>(null);
  const [nrealPosts, setNrealPosts] = useState<NrealPost[]>(() => initialFeed ?? []);
  const [nrealLoading, setNrealLoading] = useState(() => !hasInitialFeed);
  const [nrealError, setNrealError] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(initialUserId);
  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null);
  const [likingPostIds, setLikingPostIds] = useState<Set<string>>(new Set());

  const cacheNrealPosts = (nextPosts: NrealPost[], cacheUserId: string | null) => {
    nrealFeedCache = {
      userId: cacheUserId,
      posts: nextPosts.slice(0, MAIN_FEED_CACHE_LIMIT),
      fetchedAt: Date.now(),
    };
    writeSessionCache(MAIN_FEED_SESSION_KEY, nrealFeedCache.posts, cacheUserId);
  };

  const setNrealPostsWithCache = (updater: (prev: NrealPost[]) => NrealPost[], cacheUserId: string | null) => {
    setNrealPosts((prev) => {
      const next = updater(prev);
      cacheNrealPosts(next, cacheUserId);
      return next;
    });
  };

  const applyNrealRealtimeUpdate = useCallback(
    (update: NrealPost[] | ((prev: NrealPost[]) => NrealPost[])) => {
      const updater = typeof update === "function" ? update : () => update;
      setNrealPostsWithCache(updater, currentUserId);
    },
    [currentUserId],
  );

  useEffect(() => {
    const stored = window.localStorage.getItem(WIDGETS_STORAGE_KEY);
    const storedOrder = stored ? (JSON.parse(stored) as WidgetId[]) : null;
    if (storedOrder?.length) {
      const known = storedOrder.filter((id) => id in widgetConfig) as WidgetId[];
      const missing = (Object.keys(widgetConfig) as WidgetId[]).filter((id) => !known.includes(id));
      setWidgetOrder([...known, ...missing]);
    }
    setHasHydrated(true);
  }, []);

  useEffect(() => {
    if (!hasHydrated) return;
    window.localStorage.setItem(WIDGETS_STORAGE_KEY, JSON.stringify(widgetOrder));
  }, [widgetOrder, hasHydrated]);

  useEffect(() => {
    let active = true;
    const loadNreal = async () => {
      setNrealError(null);
      const cachedUserId = readSessionCache<string | null>(AUTH_SESSION_KEY, AUTH_SESSION_TTL_MS);
      const optimisticUserId = cachedUserId ?? null;
      if (optimisticUserId && optimisticUserId !== currentUserId) {
        setCurrentUserId(optimisticUserId);
      }

      const cacheKey = optimisticUserId;
      const cacheValid =
        nrealFeedCache &&
        nrealFeedCache.userId === cacheKey &&
        Date.now() - nrealFeedCache.fetchedAt < MAIN_FEED_CACHE_TTL_MS;

      const sessionCached = !cacheValid
        ? readSessionCache<NrealPost[]>(MAIN_FEED_SESSION_KEY, MAIN_FEED_SESSION_TTL_MS, cacheKey)
        : null;

      if (sessionCached) {
        setNrealPosts(sessionCached);
        cacheNrealPosts(sessionCached, cacheKey);
      }

      setNrealLoading(!(cacheValid || Boolean(sessionCached)));

      const { data: userData } = await supabase.auth.getUser();
      const user = userData?.user ?? null;
      const resolvedUserId = user?.id ?? null;
      setCurrentUserId(resolvedUserId);
      writeSessionCache(AUTH_SESSION_KEY, resolvedUserId, resolvedUserId ?? null);
      const { variant: variantToUse } = getFeedVariant(user?.id ?? null);
      if (user?.id) {
        const profileData = await fetchCurrentProfile();
        if (active) setCurrentProfile(profileData);
      } else if (active) {
        setCurrentProfile(null);
      }

      const confirmedCacheKey = user?.id ?? null;
      const confirmedCacheValid =
        nrealFeedCache &&
        nrealFeedCache.userId === confirmedCacheKey &&
        Date.now() - nrealFeedCache.fetchedAt < MAIN_FEED_CACHE_TTL_MS;

      if (confirmedCacheValid && active && nrealFeedCache) {
        let followingSet = new Set<string>();
        if (user?.id) {
          const { data: followRows } = await supabase
            .from("follows")
            .select("following_id")
            .eq("follower_id", user.id);
          followingSet = new Set(
            (followRows ?? [])
              .map((row) => (row as { following_id?: string | null }).following_id)
              .filter(Boolean) as string[],
          );
        }
        const now = new Date();
        const ranked = rankPosts(nrealFeedCache.posts, followingSet, variantToUse, now);
        setNrealPosts(ranked);
        cacheNrealPosts(ranked, confirmedCacheKey);
      }

      let query = supabase
        .from("nreal_posts")
        .select(
          `
          id,
          user_id,
          content,
          created_at,
          status,
          media_url,
          media_type,
          is_deleted,
          profiles (
            username,
            display_name,
            avatar_url,
            verified,
            verification_label
          )
        `,
        )
        .eq("is_deleted", false);

      if (user?.id) {
        query = query.or(`status.eq.approved,status.is.null,user_id.eq.${user.id}`);
      } else {
        query = query.or("status.eq.approved,status.is.null");
      }

      const { data, error } = await query.order("created_at", { ascending: false }).limit(20);

      if (!active) return;
      if (error) {
        setNrealError(error.message);
        if (!cacheValid) {
          setNrealPosts([]);
        }
      } else {
        const normalized = ((data as SupabasePost[] | null) ?? []).map((post) => normalizePost(post));
        const postIds = normalized.map((post) => post.id);
        const likesCountMap: Record<string, number> = {};
        const commentsCountMap: Record<string, number> = {};
        const likedPostIds = new Set<string>();
        let followingSet = new Set<string>();

        if (postIds.length > 0) {
          const { data: likesData } = await supabase.from("nreal_likes").select("post_id").in("post_id", postIds);
          likesData?.forEach((row) => {
            const pid = (row as { post_id: string }).post_id;
            likesCountMap[pid] = (likesCountMap[pid] ?? 0) + 1;
          });

          if (user?.id) {
            const { data: likedData } = await supabase
              .from("nreal_likes")
              .select("post_id")
              .eq("user_id", user.id)
              .in("post_id", postIds);
            likedData?.forEach((row) => {
              const pid = (row as { post_id: string }).post_id;
              likedPostIds.add(pid);
            });
          }

          const { data: commentsData } = await supabase
            .from("nreal_comments")
            .select("post_id")
            .in("post_id", postIds)
            .eq("is_deleted", false);
          commentsData?.forEach((row) => {
            const pid = (row as { post_id: string }).post_id;
            commentsCountMap[pid] = (commentsCountMap[pid] ?? 0) + 1;
          });
        }

        if (user?.id) {
          const { data: followRows } = await supabase
            .from("follows")
            .select("following_id")
            .eq("follower_id", user.id);
          followingSet = new Set(
            (followRows ?? [])
              .map((row) => (row as { following_id?: string | null }).following_id)
              .filter(Boolean) as string[],
          );
        }

        const withCounts = normalized.map((post) => ({
          ...post,
          likesCount: likesCountMap[post.id] ?? 0,
          likedByCurrentUser: likedPostIds.has(post.id),
          commentsCount: commentsCountMap[post.id] ?? 0,
        }));
        const visible = withCounts.filter((post) => !post.is_deleted);
        const now = new Date();
        const nextPosts = rankPosts(visible, followingSet, variantToUse, now);

        setNrealPosts(nextPosts);
        cacheNrealPosts(nextPosts, cacheKey);
      }
      setNrealLoading(false);
    };
    void loadNreal();
    return () => {
      active = false;
    };
  }, [supabase]);

  useRealtimeNRealFeed({ currentUserId, setPosts: applyNrealRealtimeUpdate });

  const visibleItems = useMemo<StreamItem[]>(() => {
    if (activeTab === "nReal") {
      return nrealPosts.map((post) => ({ kind: "nReal", createdAt: post.created_at, post }));
    }
    if (activeTab === "nNews") {
      return [];
    }
    return nrealPosts.map((post) => ({ kind: "nReal" as const, createdAt: post.created_at, post }));
  }, [activeTab, nrealPosts]);

  const toggleLike = async (postId: string) => {
    if (!currentUserId) {
      requestAuth();
      return;
    }
    if (likingPostIds.has(postId)) return;

    setLikingPostIds((prev) => new Set(prev).add(postId));
    const post = nrealPosts.find((p) => p.id === postId);
    const currentlyLiked = Boolean(post?.likedByCurrentUser);
    setNrealPostsWithCache(
      (prev) =>
        prev.map((p) =>
          p.id === postId
            ? {
                ...p,
                likedByCurrentUser: !currentlyLiked,
                likesCount: Math.max(0, (p.likesCount ?? 0) + (currentlyLiked ? -1 : 1)),
              }
            : p,
        ),
      currentUserId,
    );

    try {
      if (currentlyLiked) {
        const { error } = await supabase
          .from("nreal_likes")
          .delete()
          .eq("post_id", postId)
          .eq("user_id", currentUserId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("nreal_likes").insert({ post_id: postId, user_id: currentUserId });
        if (error) throw error;
      }
    } catch (err) {
      console.error("Toggle like failed", err);
      setNrealPostsWithCache(
        (prev) =>
          prev.map((p) =>
            p.id === postId
              ? {
                  ...p,
                  likedByCurrentUser: currentlyLiked,
                  likesCount: Math.max(0, (p.likesCount ?? 0) + (currentlyLiked ? 1 : -1)),
                }
              : p,
          ),
        currentUserId,
      );
    } finally {
      setLikingPostIds((prev) => {
        const next = new Set(prev);
        next.delete(postId);
        return next;
      });
    }
  };

  const reorderWidgets = (dragId: WidgetId, overId: WidgetId) => {
    if (!dragId || dragId === overId) return;
    setWidgetOrder((current) => {
      const dragIndex = current.findIndex((w) => w === dragId);
      const overIndex = current.findIndex((w) => w === overId);
      if (dragIndex === -1 || overIndex === -1) return current;
      const updated = [...current];
      const [moved] = updated.splice(dragIndex, 1);
      updated.splice(overIndex, 0, moved);
      return updated;
    });
  };

  return (
    <main className="min-h-screen bg-neutral-50 pb-24">
      <section className="mx-auto max-w-6xl px-4 py-8 space-y-8">
        <h1 className="sr-only">NRStream</h1>

        <MobileWeatherCard today={today} weather={weather} />

        <div className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-2 py-1 text-xs text-neutral-700">
          {tabs.map((tab) => {
            const isActive = tab === activeTab;
            return (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`rounded-full px-3 py-1 font-medium transition ${
                  isActive ? "bg-neutral-900 text-white" : "text-neutral-700 hover:bg-neutral-100"
                }`}
              >
                {tab}
              </button>
            );
          })}
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-3">
            {nrealError && (activeTab === "Mix" || activeTab === "nReal") ? (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                Nepodařilo se načíst nReal příspěvky: {nrealError}
              </div>
            ) : null}
            {nrealLoading && (activeTab === "Mix" || activeTab === "nReal") ? (
              <div className="rounded-xl border border-neutral-200 bg-white p-4 text-sm text-neutral-600 shadow-sm">
                Načítám nReal feed…
              </div>
            ) : null}
            {!nrealLoading && !nrealError && visibleItems.length === 0 ? (
              <div className="rounded-xl border border-neutral-200 bg-white p-4 text-sm text-neutral-600 shadow-sm">
                Zatím tu nic není.
              </div>
            ) : null}
            {visibleItems.map((streamItem) => {
              if (streamItem.kind === "nReal") {
                const post = streamItem.post;
                const author = post.profiles?.[0] ?? null;
                const authorName = author?.display_name || author?.username || "NRW uživatel";
                const authorIsCurrentUser = Boolean(currentUserId && post.user_id === currentUserId);
                return (
                  <PostCard
                    key={`nreal-${post.id}`}
                    postId={post.id}
                    postUserId={post.user_id}
                    isDeleted={post.is_deleted ?? null}
                    author={{
                      displayName: authorName,
                      username: author?.username ?? null,
                      avatarUrl: author?.avatar_url ?? null,
                      isCurrentUser: authorIsCurrentUser,
                      verified: Boolean(author?.verified),
                      verificationLabel: author?.verification_label ?? null,
                    }}
                    content={post.content ?? ""}
                    createdAt={post.created_at}
                    status={post.status}
                    mediaUrl={post.media_url ?? null}
                    mediaType={post.media_type ?? null}
                    likesCount={post.likesCount ?? 0}
                    likedByCurrentUser={post.likedByCurrentUser ?? false}
                    commentsCount={post.commentsCount ?? 0}
                    onToggleLike={toggleLike}
                    likeDisabled={likingPostIds.has(post.id)}
                    currentUserProfile={currentProfile}
                  />
                );
              }

              const item = streamItem.item;
              return (
                <article
                  key={`nnews-${item.id}`}
                  className="rounded-xl border border-neutral-200 bg-white p-4 text-sm shadow-sm"
                >
                  <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-neutral-500">
                    NNEWS
                  </div>
                  <h2 className="text-base font-semibold text-neutral-900">{item.title}</h2>
                  {item.excerpt ? <p className="mt-1 text-xs text-neutral-600">{item.excerpt}</p> : null}
                  <p className="mt-3 text-[11px] text-neutral-400">{item.meta}</p>
                </article>
              );
            })}
          </div>

          <aside className="hidden space-y-3 lg:block lg:sticky lg:top-6 lg:max-h-[calc(100vh-96px)] lg:overflow-y-auto lg:pr-1">
            {isEditing && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditing(false);
                    setDraggingId(null);
                  }}
                  className="flex items-center justify-center gap-2 rounded-lg bg-neutral-800 px-3 py-2 text-sm font-semibold text-white shadow-sm ring-2 ring-neutral-300 transition hover:-translate-y-px hover:bg-neutral-800"
                >
                  Hotovo
                </button>
              </div>
            )}

            {widgetOrder.map((widgetId) => {
              const config = widgetConfig[widgetId];
              if (!config) return null;
              return (
                <WidgetCard
                  key={widgetId}
                  id={widgetId}
                  title={config.title}
                  isDragging={draggingId === widgetId}
                  isEditing={isEditing}
                  onDragStart={() => isEditing && setDraggingId(widgetId)}
                  onDragEnter={() => isEditing && draggingId && reorderWidgets(draggingId, widgetId)}
                  onDragEnd={() => setDraggingId(null)}
                >
                  {config.render(today, weather)}
                </WidgetCard>
              );
            })}

            {!isEditing && (
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="mt-1 flex w-full items-center justify-center gap-2 rounded-lg bg-neutral-900 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-px hover:bg-neutral-800"
              >
                Upravit widgety
              </button>
            )}
          </aside>
        </div>
      </section>
    </main>
  );
}

function WidgetCard({
  id,
  title,
  children,
  isDragging,
  isEditing,
  onDragStart,
  onDragEnter,
  onDragEnd,
}: {
  id: WidgetId;
  title: string;
  children: React.ReactNode;
  isDragging: boolean;
  isEditing: boolean;
  onDragStart: () => void;
  onDragEnter: () => void;
  onDragEnd: () => void;
}) {
  return (
    <div
      data-widget-id={id}
      draggable={isEditing}
      onDragStart={onDragStart}
      onDragEnter={onDragEnter}
      onDragEnd={onDragEnd}
      onDragOver={(e) => e.preventDefault()}
      className={`rounded-xl border border-neutral-200 bg-white/90 p-4 shadow-sm backdrop-blur transition ${isDragging ? "scale-[1.01] border-neutral-300 shadow-md ring-2 ring-neutral-200" : "hover:-translate-y-px hover:shadow-md"} ${isEditing ? "cursor-grab ring-1 ring-neutral-200 animate-pulse" : ""}`}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-neutral-900">{title}</h3>
        {isEditing ? (
          <div className="flex items-center gap-2 rounded-lg bg-neutral-900 px-2 py-1 text-[11px] font-medium text-white shadow-sm">
            <GripVertical className="h-4 w-4" />
            <span className="hidden sm:inline">Chyť a přetáhni</span>
          </div>
        ) : (
          <span aria-hidden className="h-4 w-4" />
        )}
      </div>
      {children}
    </div>
  );
}

function MobileWeatherCard({ today, weather }: { today?: Date; weather: WeatherSnapshot }) {
  const forecastFallback = ["Út", "St", "Čt", "Pá", "So"].map((day, idx) => ({
    day,
    max: 6 + idx,
    min: -1 + idx,
    icon: null,
  }));
  const forecast = weather.forecast.length ? weather.forecast : forecastFallback;
  const nextDay = forecast[0];
  const nowTemp = weather.temp !== null ? `${weather.temp}°` : "--°";
  const nightTemp = nextDay ? `${nextDay.min}°` : "--°";
  const tomorrowTemp = nextDay ? `${nextDay.max}°` : "--°";
  const dateLabel = today
    ? today.toLocaleDateString("cs-CZ", { weekday: "long", day: "numeric", month: "long" })
    : "Dnes";

  return (
    <div className="lg:hidden">
      <div className="rounded-2xl border border-slate-200/70 bg-gradient-to-br from-white via-slate-50 to-amber-50 p-3 shadow-sm">
        <div className="text-sm text-slate-600">
          <span className="capitalize">{dateLabel}</span>
        </div>

        <div className="mt-3 rounded-xl border border-slate-200/70 bg-white/90 px-3 py-2 text-slate-900 shadow-sm">
          {weather.loading ? (
            <div className="grid grid-cols-3 gap-2">
              {Array.from({ length: 3 }).map((_, idx) => (
                <div
                  key={`weather-skeleton-${idx}`}
                  className="h-12 rounded-lg bg-slate-100"
                />
              ))}
            </div>
          ) : weather.error ? (
            <div className="py-1 text-sm text-slate-500">Počasí je teď nedostupné.</div>
          ) : (
            <div className="grid grid-cols-3 items-center text-sm">
              <div className="flex items-center gap-2">
                {weather.icon ? (
                  <img
                    src={`https://openweathermap.org/img/wn/${weather.icon}@2x.png`}
                    alt={weather.description ?? "Počasí"}
                    className="h-9 w-9"
                  />
                ) : (
                  <Sun className="h-5 w-5 text-amber-500" />
                )}
                <div>
                  <div className="text-lg font-semibold text-slate-900">{nowTemp}</div>
                  <div className="text-xs text-slate-500">Právě teď</div>
                </div>
              </div>

              <div className="flex items-center gap-2 border-l border-slate-200/80 pl-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100">
                  <Moon className="h-4 w-4 text-slate-500" />
                </div>
                <div>
                  <div className="text-lg font-semibold text-slate-900">{nightTemp}</div>
                  <div className="text-xs text-slate-500">V noci</div>
                </div>
              </div>

              <div className="flex items-center gap-2 border-l border-slate-200/80 pl-3">
                {nextDay?.icon ? (
                  <img
                    src={`https://openweathermap.org/img/wn/${nextDay.icon}@2x.png`}
                    alt=""
                    className="h-9 w-9"
                  />
                ) : (
                  <Sun className="h-5 w-5 text-amber-500" />
                )}
                <div>
                  <div className="text-lg font-semibold text-slate-900">{tomorrowTemp}</div>
                  <div className="text-xs text-slate-500">Zítra</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function WeatherWidget({ today, weather }: { today?: Date; weather: WeatherSnapshot }) {
  const lastUpdate = weather.updatedAt
    ? new Date(weather.updatedAt).toLocaleTimeString("cs-CZ", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : today?.toLocaleTimeString("cs-CZ", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="space-y-3 text-sm text-neutral-700">
      {weather.loading ? (
        <>
          <div className="flex items-center gap-2 text-neutral-500">
            <div className="h-4 w-4 animate-pulse rounded-full bg-neutral-200" />
            <div className="h-3 w-24 animate-pulse rounded bg-neutral-200" />
          </div>
          <div className="flex items-center gap-2 text-neutral-900">
            <div className="h-5 w-5 animate-pulse rounded-full bg-neutral-200" />
            <div className="h-4 w-32 animate-pulse rounded bg-neutral-200" />
          </div>
        </>
      ) : weather.error ? (
        <div className="text-sm text-neutral-500">Počasí nedostupné</div>
      ) : (
        <>
          <div className="flex items-center gap-2 text-neutral-500">
            <MapPin className="h-4 w-4" />
            <span>{weather.city ?? "Praha, Česko"}</span>
            <button
              type="button"
              onClick={() => weather.refreshWithLocation()}
              className="ml-auto inline-flex h-7 w-7 items-center justify-center rounded-full border border-neutral-200 text-neutral-600 transition hover:border-neutral-300 hover:text-neutral-900"
              aria-label="Použít aktuální polohu"
              title="Použít aktuální polohu"
            >
              <LocateFixed className="h-4 w-4" />
            </button>
          </div>
          <div className="flex items-center gap-2 text-neutral-900">
            {weather.icon ? (
              <img
                src={`https://openweathermap.org/img/wn/${weather.icon}@2x.png`}
                alt={weather.description ?? "Počasí"}
                className="h-10 w-10"
              />
            ) : (
              <Sun className="h-5 w-5 text-amber-500" />
            )}
            <span className="font-semibold">
              {weather.description ? `Dnes bude ${weather.description}` : "Dnes bude jasno"}
            </span>
          </div>
        </>
      )}
      <div className="grid grid-cols-5 gap-2 text-xs text-neutral-600">
        {(weather.forecast.length
          ? weather.forecast
          : ["Po", "Út", "St", "Čt"].map((day, idx) => ({
              day,
              max: 18 + idx,
              min: 9 + idx,
              icon: null,
            }))
        ).map((item) => (
          <div
            key={item.day}
            className="flex flex-col items-center rounded-lg border border-neutral-100 bg-neutral-50 px-2 py-2"
          >
            <span className="font-semibold text-neutral-900">{item.day}</span>
            {item.icon ? (
              <img
                src={`https://openweathermap.org/img/wn/${item.icon}@2x.png`}
                alt=""
                className="h-7 w-7"
              />
            ) : (
              <div className="h-7 w-7 rounded-full bg-neutral-200" />
            )}
            <span className="text-[11px] text-neutral-500">
              {item.max}° / {item.min}°
            </span>
          </div>
        ))}
      </div>
      <p className="text-[11px] text-neutral-500">
        Aktualizováno {lastUpdate ?? "—:—"}.
      </p>
    </div>
  );
}

function DateWidget({ today }: { today?: Date }) {
  const monthFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat("cs-CZ", {
        month: "long",
        day: "numeric",
        weekday: "long",
      }),
    []
  );

  const baseDate = today ?? new Date("2024-01-01T00:00:00Z");
  const dayNames = ["Po", "Út", "St", "Čt", "Pá", "So", "Ne"];
  const currentWeekday = baseDate.getDay() === 0 ? 7 : baseDate.getDay(); // neděle = 7
  const startOfWeek = baseDate.getDate() - currentWeekday + 1; // začátek týdne pondělí
  const weekDays = Array.from({ length: 7 }).map((_, idx) => startOfWeek + idx);

  return (
    <div className="space-y-3 text-sm text-neutral-700">
      <div className="flex items-center gap-2 text-neutral-900">
        <CalendarDays className="h-5 w-5 text-indigo-500" />
        <div className="space-y-0.5">
          <div className="text-xs uppercase tracking-[0.18em] text-neutral-500">Dnes</div>
          <div className="font-semibold">
            {today ? monthFormatter.format(today) : "Načítám datum…"}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs">
        {weekDays.map((day, idx) => {
          const date = new Date(baseDate);
          date.setDate(day);
          const isToday = today ? date.toDateString() === today.toDateString() : false;
          return (
            <div
              key={`${dayNames[idx]}-${date.getDate()}`}
              className={`rounded-lg border px-1 py-2 ${
                isToday
                  ? "border-neutral-900 bg-neutral-900 text-white"
                  : "border-neutral-100 bg-neutral-50 text-neutral-700"
              }`}
            >
              <div className="text-[10px] uppercase tracking-[0.14em] text-neutral-500">
                {dayNames[idx]}
              </div>
              <div className="text-sm font-semibold">{date.getDate()}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SuggestionsWidget() {
  const suggestions = [
    { id: "p1", type: "Příspěvek", title: "nReal: Nový příběh z Ostravy" },
    { id: "p2", type: "Uživatel", title: "Sleduj @nreal-community" },
    { id: "p3", type: "Příspěvek", title: "nNews: Co čeká NRW tento týden" },
  ];

  return (
    <div className="space-y-2 text-sm text-neutral-700">
      {suggestions.map((item) => (
        <div
          key={item.id}
          className="flex items-center justify-between rounded-lg border border-neutral-100 bg-neutral-50 px-3 py-2"
        >
          <div className="space-y-0.5">
            <div className="text-[10px] uppercase tracking-[0.14em] text-neutral-500">
              {item.type}
            </div>
            <div className="font-semibold text-neutral-900">{item.title}</div>
          </div>
          <button className="rounded-full border border-neutral-200 px-3 py-1 text-xs font-medium text-neutral-700 transition hover:bg-neutral-100">
            Přidat
          </button>
        </div>
      ))}
      <div className="flex items-center gap-2 rounded-lg border border-dashed border-neutral-200 px-3 py-2 text-xs text-neutral-500">
        <Users className="h-4 w-4" />
        <span>Další návrhy se načtou z feedu…</span>
      </div>
    </div>
  );
}

function HeatmapWidget() {
  const heatData = [
    { id: "praha", label: "Praha", value: 82, position: { x: 58, y: 42 } },
    { id: "brno", label: "Brno", value: 67, position: { x: 64, y: 54 } },
    { id: "ostrava", label: "Ostrava", value: 55, position: { x: 75, y: 38 } },
    { id: "plzen", label: "Plzeň", value: 38, position: { x: 46, y: 50 } },
    { id: "liberec", label: "Liberec", value: 32, position: { x: 62, y: 30 } },
    { id: "bratislava", label: "Bratislava", value: 44, position: { x: 70, y: 62 } },
  ];

  return (
    <div className="space-y-3 text-sm text-neutral-700">
      <div className="flex items-center gap-2 text-neutral-900">
        <Flame className="h-5 w-5 text-orange-500" />
        <span className="font-semibold">Heat mapa příspěvků (live feeling)</span>
      </div>

      <div className="relative overflow-hidden rounded-2xl border border-neutral-200 bg-linear-to-br from-slate-900 via-slate-800 to-slate-900 px-4 py-4 text-xs text-white shadow-inner">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.06),transparent_45%),radial-gradient(circle_at_70%_80%,rgba(255,255,255,0.05),transparent_40%)]" />
        <div className="absolute inset-4 rounded-xl border border-white/5" />

        <div className="relative aspect-4/3 w-full">
          {heatData.map((spot) => {
            const intensity = Math.min(1, spot.value / 90);
            const size = 26 + intensity * 24;
            const glow = `rgba(255, 170, 43, ${0.15 + intensity * 0.4})`;
            const core = `rgba(255, 120, 0, ${0.35 + intensity * 0.45})`;
            return (
              <div
                key={spot.id}
                style={{
                  left: `${spot.position.x}%`,
                  top: `${spot.position.y}%`,
                }}
                className="absolute -translate-x-1/2 -translate-y-1/2"
              >
                <div
                  style={{
                    width: size * 1.5,
                    height: size * 1.5,
                    background: `radial-gradient(circle, ${glow} 0%, transparent 65%)`,
                  }}
                  className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 blur-sm"
                />
                <div
                  style={{
                    width: size,
                    height: size,
                    background: `radial-gradient(circle, ${core} 0%, rgba(255,120,0,0.15) 65%, transparent 100%)`,
                  }}
                  className="relative rounded-full ring-2 ring-orange-500/30"
                />
                <div className="mt-1 text-center text-[11px] font-semibold text-white drop-shadow-sm">
                  {spot.label}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-3 flex items-center justify-between text-[11px] text-neutral-200">
          <span className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-orange-400" />
            Přetahuj mapu pro live přehled (mock data)
          </span>
          <span className="text-neutral-300">Nejvíc: Praha · {heatData[0].value}+</span>
        </div>
      </div>

      <p className="text-[11px] text-neutral-500">
        Podobně jako Snapchat Map – ukazuje hotspoty, kde se teď objevuje nejvíc nReal/nNews
        příspěvků. Data jsou zatím demo.
      </p>
    </div>
  );
}
