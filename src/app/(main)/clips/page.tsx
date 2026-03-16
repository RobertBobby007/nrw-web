"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Play,
  Flame,
  Heart,
  MessageCircle,
  Send,
  Plus,
  Bookmark,
  MoreHorizontal,
  Volume2,
  VolumeX,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { useTranslations } from "@/components/i18n/LocaleProvider";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { parseMediaUrls } from "@/lib/media";
import { requestAuth } from "@/lib/auth-required";

type Clip = {
  id: string;
  title: string;
  creator: string;
  creatorAvatarUrl?: string | null;
  length: string;
  views: string;
  vibe: string;
  gradient: string;
  tags: string[];
  mediaUrl?: string | null;
  postId?: string | null;
  viewsCount?: number | null;
};

function formatDuration(seconds: number | null | undefined) {
  if (typeof seconds !== "number" || !Number.isFinite(seconds) || seconds <= 0) return "—";
  const total = Math.round(seconds);
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

const clipFilters = ["top", "forYou", "following", "new"] as const;
const trendingNow = [
  { id: "tr1", stat: "🔥 2.4k" },
  { id: "tr2", stat: "🔥 1.8k" },
  { id: "tr3", stat: "🔥 1.2k" },
  { id: "tr4", stat: "🔥 960" },
];

export default function ClipsPage() {
  const t = useTranslations();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const searchParams = useSearchParams();
  const router = useRouter();
  const clipPostId = searchParams.get("post");
  const [activeFilter, setActiveFilter] = useState<(typeof clipFilters)[number]>("top");
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
  const [activeMobileClipId, setActiveMobileClipId] = useState<string | null>(null);
  const [mobileMuted, setMobileMuted] = useState(true);
  const [clipError, setClipError] = useState<string | null>(null);
  const [clipLoading, setClipLoading] = useState(false);
  const [overlayMuted, setOverlayMuted] = useState(true);
  const viewTimerRef = useRef<number | null>(null);
  const viewedClipIdsRef = useRef<Set<string>>(new Set());
  const mobileFeedRef = useRef<HTMLDivElement | null>(null);
  const mobileClipRefs = useRef<Record<string, HTMLElement | null>>({});
  const mobileVideoRefs = useRef<Record<string, HTMLVideoElement | null>>({});
  const overlayVideoRef = useRef<HTMLVideoElement | null>(null);

  const showClipOverlay = Boolean(clipPostId);
  const activeOverlayClip = useMemo(
    () => (selectedClip?.id ? clips.find((clip) => clip.id === selectedClip.id) ?? null : null),
    [clips, selectedClip],
  );
  const selectedOverlayIndex = useMemo(
    () => (selectedClip?.id ? clips.findIndex((clip) => clip.id === selectedClip.id) : -1),
    [clips, selectedClip],
  );

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
            "id, content, media_url, media_type, created_at, status, is_deleted, views_count, profiles (username, display_name, avatar_url)",
          )
          .eq("media_type", "video")
          .eq("status", "approved")
          .order("created_at", { ascending: false })
          .limit(20);

        if (!active) return;
        if (error || !data) {
          setClipsError(t("clips.loadError"));
          setClips([]);
          return;
        }
        const mapped = data
          .filter((post) => !post.is_deleted)
          .map((post, index) => {
            const mediaUrls = parseMediaUrls(post.media_url);
            const mediaUrl = mediaUrls[0] ?? null;
            const rawDescription = (post.content ?? "").trim();
            const title = rawDescription ? rawDescription.replace(/\s+/g, " ").slice(0, 120) : t("clips.untitled");
            const profile = Array.isArray(post.profiles) ? post.profiles[0] : post.profiles;
            const creatorHandle = profile?.username ? `@${profile.username}` : t("clips.creatorFallback");
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
              creatorAvatarUrl: profile?.avatar_url ?? null,
              length: "—",
              views: typeof post.views_count === "number" ? `${post.views_count}` : "—",
              vibe: t("clips.vibe"),
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
  }, [supabase, t]);

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

  const openOverlayByIndex = useCallback(
    (index: number) => {
      const next = clips[index];
      if (!next?.postId) return;
      router.push(`/clips?post=${encodeURIComponent(next.postId)}`);
    },
    [clips, router],
  );

  const handleShareOverlayClip = useCallback(async () => {
    const clipId = selectedClip?.id;
    if (!clipId) return;
    const shareUrl =
      typeof window !== "undefined"
        ? `${window.location.origin}/clips?post=${encodeURIComponent(clipId)}`
        : `/clips?post=${encodeURIComponent(clipId)}`;
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ title: "nClips", url: shareUrl });
        return;
      }
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
      }
    } catch {
      // no-op
    }
  }, [selectedClip]);

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
          setClipError(t("clips.overlay.loadError"));
          return;
        }
        if (data.media_type !== "video" || !data.media_url) {
          setSelectedClip(null);
          setClipError(t("clips.overlay.notVideo"));
          return;
        }
        const mediaUrls = parseMediaUrls(data.media_url);
        const firstUrl = mediaUrls[0] ?? null;
        if (!firstUrl) {
          setSelectedClip(null);
          setClipError(t("clips.overlay.invalidUrl"));
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
  }, [clipPostId, supabase, t]);

  useEffect(() => {
    setOverlayMuted(true);
  }, [selectedClip?.id]);

  const toggleOverlayMute = useCallback(() => {
    const nextMuted = !overlayMuted;
    const video = overlayVideoRef.current;
    setOverlayMuted(nextMuted);
    if (!video) return;

    video.muted = nextMuted;
    video.defaultMuted = nextMuted;
    if (!nextMuted) {
      video.volume = 1;
      void video.play().catch(() => {
        setOverlayMuted(true);
        video.muted = true;
        video.defaultMuted = true;
      });
    }
  }, [overlayMuted]);

  useEffect(() => {
    if (clips.length === 0) {
      setActiveMobileClipId(null);
      return;
    }
    setActiveMobileClipId((prev) => prev ?? clips[0]?.id ?? null);
  }, [clips]);

  useEffect(() => {
    const root = mobileFeedRef.current;
    if (!root || clips.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        const first = visible[0];
        if (!first) return;
        const clipId = (first.target as HTMLElement).dataset.clipId;
        if (clipId) {
          setActiveMobileClipId(clipId);
        }
      },
      {
        root,
        threshold: [0.6, 0.75, 0.9],
      },
    );

    clips.forEach((clip) => {
      const element = mobileClipRefs.current[clip.id];
      if (element) observer.observe(element);
    });

    return () => observer.disconnect();
  }, [clips]);

  useEffect(() => {
    clips.forEach((clip) => {
      const video = mobileVideoRefs.current[clip.id];
      if (!video) return;
      if (clip.id === activeMobileClipId) {
        video.play().catch(() => null);
      } else {
        video.pause();
      }
    });
  }, [activeMobileClipId, clips]);

  const toggleMobileSound = useCallback((clipId: string) => {
    const video = mobileVideoRefs.current[clipId];
    const nextMuted = !mobileMuted;
    setMobileMuted(nextMuted);
    if (!video) return;
    video.muted = nextMuted;
    video.defaultMuted = nextMuted;
    if (!nextMuted) {
      video.volume = 1;
      void video.play().catch(() => {
        setMobileMuted(true);
        video.muted = true;
        video.defaultMuted = true;
      });
    }
  }, [mobileMuted]);

  if (showClipOverlay) {
    const overlayLikes = selectedClip?.id ? likesCountMap[selectedClip.id] ?? 0 : 0;
    const overlayLiked = selectedClip?.id ? likedClipIds.has(selectedClip.id) : false;
    const canGoPrev = selectedOverlayIndex > 0;
    const canGoNext = selectedOverlayIndex >= 0 && selectedOverlayIndex < clips.length - 1;
    const overlayCreator = activeOverlayClip?.creator ?? "@nrw.clips";
    const overlayAvatar = activeOverlayClip?.creatorAvatarUrl ?? null;
    const overlayInitial = overlayCreator.replace(/^@/, "").charAt(0).toUpperCase() || "N";
    const overlayViews = formatViews(activeOverlayClip?.viewsCount);
    const overlayCaption = selectedClip?.content?.trim() || activeOverlayClip?.title || t("clips.untitled");

    return (
      <main className="fixed inset-0 z-[140] overflow-hidden bg-[#060b12] text-white">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_22%_38%,rgba(37,99,235,0.2),transparent_36%),radial-gradient(circle_at_74%_52%,rgba(6,182,212,0.16),transparent_40%)]" />
        <div className="relative flex h-full flex-col">
          <header className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-3 md:px-6">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-white/70">nClips</div>
            <button
              type="button"
              onClick={() => router.back()}
              className="rounded-full border border-white/20 px-3 py-1 text-xs font-semibold text-white transition hover:bg-white/10"
            >
              {t("clips.overlay.back")}
            </button>
          </header>

          <div className="relative flex flex-1 items-center justify-center px-4 pb-6 md:px-8 md:pb-8">
          {clipError ? (
            <div className="max-w-md rounded-xl bg-white/10 px-4 py-3 text-sm text-white/90">{clipError}</div>
          ) : clipLoading || !selectedClip ? (
            <div className="text-sm text-white/70">{t("clips.overlay.loading")}</div>
          ) : (
            <div className="relative flex w-full items-center justify-center">
              <div className="relative w-[min(84vw,360px)] md:w-[min(34vw,400px)]">
                <div className="absolute inset-0 -z-10 scale-105 rounded-[30px] bg-black/70 blur-2xl" />
                <div className="relative mx-auto aspect-[9/16] overflow-hidden rounded-[28px] border border-white/15 bg-black shadow-[0_24px_90px_rgba(0,0,0,0.7)]">
                <video
                  ref={overlayVideoRef}
                  src={selectedClip.mediaUrl ?? undefined}
                  autoPlay
                  muted={overlayMuted}
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
                  className="h-full w-full object-cover"
                />
                  <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/45 to-transparent" />
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-black/75 via-black/25 to-transparent" />
                  <div className="absolute bottom-[calc(env(safe-area-inset-bottom)+14px)] left-4 right-4 flex items-end justify-between gap-3">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2.5">
                        <div className="h-9 w-9 overflow-hidden rounded-full border border-white/35 bg-white/10">
                          {overlayAvatar ? (
                            <img src={overlayAvatar} alt={overlayCreator} className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-white/90">
                              {overlayInitial}
                            </div>
                          )}
                        </div>
                        <span className="text-base font-semibold">{overlayCreator}</span>
                        <button
                          type="button"
                          className="rounded-full border border-white/45 px-3 py-1 text-xs font-semibold text-white transition hover:bg-white/10"
                        >
                          {t("clips.overlay.follow")}
                        </button>
                      </div>
                      <p className="line-clamp-2 max-w-[280px] text-sm text-white/90">{overlayCaption}</p>
                      <p className="text-xs text-white/70">{t("clips.overlay.views", { count: overlayViews })}</p>
                    </div>
                    <button
                      type="button"
                      onClick={toggleOverlayMute}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-black/55 text-white transition hover:bg-black/70"
                      aria-label={overlayMuted ? t("clips.overlay.soundOnAria") : t("clips.overlay.soundOffAria")}
                    >
                      {overlayMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-center gap-4 md:hidden">
                  {selectedClip.id ? (
                    <button
                      type="button"
                      onClick={() => handleToggleLike(selectedClip.id)}
                      className="inline-flex items-center gap-2 rounded-full bg-black/55 px-3 py-2 text-sm font-semibold text-white"
                    >
                      <Heart className={`h-4 w-4 ${overlayLiked ? "fill-rose-500 text-rose-500" : ""}`} />
                      {overlayLikes}
                    </button>
                  ) : null}
                    <button
                      type="button"
                      onClick={handleShareOverlayClip}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-black/55 text-white"
                      aria-label={t("clips.overlay.shareAria")}
                    >
                      <Send className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-black/55 text-white"
                      aria-label={t("clips.overlay.saveAria")}
                    >
                      <Bookmark className="h-4 w-4" />
                    </button>
                </div>
              </div>

              <aside className="hidden md:flex absolute right-8 top-1/2 -translate-y-1/2 flex-col items-center gap-4">
                <button
                  type="button"
                  onClick={() => canGoPrev && openOverlayByIndex(selectedOverlayIndex - 1)}
                  disabled={!canGoPrev}
                  className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-35"
                  aria-label={t("clips.overlay.previousAria")}
                >
                  <ChevronUp className="h-6 w-6" />
                </button>
                <button
                  type="button"
                  onClick={() => canGoNext && openOverlayByIndex(selectedOverlayIndex + 1)}
                  disabled={!canGoNext}
                  className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-35"
                  aria-label={t("clips.overlay.nextAria")}
                >
                  <ChevronDown className="h-6 w-6" />
                </button>
                {selectedClip.id ? (
                  <button
                    type="button"
                    onClick={() => handleToggleLike(selectedClip.id)}
                    className="mt-2 flex flex-col items-center gap-1 text-white"
                    aria-label={overlayLiked ? t("clips.overlay.unlikeAria") : t("clips.overlay.likeAria")}
                  >
                    <span className={`inline-flex h-12 w-12 items-center justify-center rounded-full ${overlayLiked ? "bg-rose-500" : "bg-black/55"}`}>
                      <Heart className={`h-6 w-6 ${overlayLiked ? "fill-white" : ""}`} />
                    </span>
                    <span className="text-sm font-semibold">{overlayLikes}</span>
                  </button>
                ) : null}

                <button
                  type="button"
                  className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-black/55 text-white transition hover:bg-black/70"
                  aria-label={t("clips.overlay.commentsAria")}
                >
                  <MessageCircle className="h-6 w-6" />
                </button>
                <button
                  type="button"
                  onClick={handleShareOverlayClip}
                  className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-black/55 text-white transition hover:bg-black/70"
                  aria-label={t("clips.overlay.shareAria")}
                >
                  <Send className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-black/55 text-white transition hover:bg-black/70"
                  aria-label={t("clips.overlay.saveAria")}
                >
                  <Bookmark className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-black/55 text-white transition hover:bg-black/70"
                  aria-label={t("clips.overlay.moreAria")}
                >
                  <MoreHorizontal className="h-5 w-5" />
                </button>
              </aside>
            </div>
          )}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-neutral-50">
      <section className="fixed inset-x-0 top-0 bottom-[calc(env(safe-area-inset-bottom)+76px)] z-30 flex flex-col bg-black text-white md:hidden">
        <div ref={mobileFeedRef} className="min-h-0 flex-1 snap-y snap-mandatory overflow-y-auto">
          {clipsLoading ? (
            <div className="flex h-full items-center justify-center px-6 text-sm text-white/70">{t("clips.mobile.loading")}</div>
          ) : clipsError ? (
            <div className="flex h-full items-center justify-center px-6 text-center text-sm text-amber-200">
              {clipsError}
            </div>
          ) : clips.length === 0 ? (
            <div className="flex h-full items-center justify-center px-6 text-sm text-white/70">
              {t("clips.mobile.empty")}
            </div>
          ) : (
            clips.map((clip) => {
              const likesCount = clip.postId ? likesCountMap[clip.postId] ?? 0 : 0;
              const isLiked = clip.postId ? likedClipIds.has(clip.postId) : false;
              const viewsLabel = formatViews(clip.viewsCount);
              const href = clip.postId ? `/clips?post=${encodeURIComponent(clip.postId)}` : "/clips";
              return (
                <article
                  key={clip.id}
                  data-clip-id={clip.id}
                  ref={(element) => {
                    mobileClipRefs.current[clip.id] = element;
                  }}
                  className="relative h-full snap-start snap-always bg-black"
                >
                  <video
                    ref={(element) => {
                      mobileVideoRefs.current[clip.id] = element;
                    }}
                    src={clip.mediaUrl ?? undefined}
                    muted={mobileMuted}
                    loop
                    playsInline
                    preload="metadata"
                    onPlay={() => {
                      if (!clip.postId) return;
                      clearViewTimer();
                      viewTimerRef.current = window.setTimeout(() => {
                        recordView(clip.postId as string);
                      }, 2500);
                    }}
                    onPause={clearViewTimer}
                    onEnded={clearViewTimer}
                    className="h-full w-full object-cover"
                    onLoadedMetadata={(e) => {
                      const el = e.currentTarget;
                      const nextDuration = Number.isFinite(el.duration) ? el.duration : 0;
                      setClipDurations((prev) =>
                        prev[clip.id] === nextDuration ? prev : { ...prev, [clip.id]: nextDuration },
                      );
                    }}
                    onClick={() => toggleMobileSound(clip.id)}
                  />
                  <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-black/55 to-transparent" />
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-64 bg-gradient-to-t from-black/85 via-black/40 to-transparent" />
                  <div className="absolute bottom-[calc(env(safe-area-inset-bottom)+14px)] left-4 right-20 space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 overflow-hidden rounded-full border border-white/30 bg-white/10">
                        {clip.creatorAvatarUrl ? (
                          <img src={clip.creatorAvatarUrl} alt={clip.creator} className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-white/90">
                            {(clip.creator ?? "@n").replace(/^@/, "").charAt(0).toUpperCase() || "N"}
                          </div>
                        )}
                      </div>
                      <p className="text-base font-semibold">{clip.creator}</p>
                      <button
                        type="button"
                        className="rounded-full border border-white/40 px-3 py-1 text-xs font-semibold text-white"
                      >
                        {t("clips.mobile.follow")}
                      </button>
                    </div>
                    <p className="line-clamp-2 text-xs font-normal leading-snug text-white/90">{clip.title}</p>
                    <p className="text-xs text-white/80">{t("clips.desktop.views", { count: viewsLabel })}</p>
                  </div>
                  <div className="absolute bottom-30 right-3 flex flex-col items-center gap-4">
                    {clip.postId ? (
                      <button
                        type="button"
                        aria-label={isLiked ? t("clips.overlay.unlikeAria") : t("clips.overlay.likeAria")}
                        onClick={() => handleToggleLike(clip.postId as string)}
                        className="flex flex-col items-center gap-1 text-white"
                      >
                        <span
                          className={`inline-flex h-11 w-11 items-center justify-center rounded-full ${
                            isLiked ? "bg-rose-500" : "bg-black/50"
                          }`}
                        >
                          <Heart className={`h-6 w-6 ${isLiked ? "fill-white" : ""}`} />
                        </span>
                        <span className="text-xs font-semibold">{likesCount}</span>
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => router.push(href)}
                      className="flex flex-col items-center gap-1 text-white"
                      aria-label={t("clips.mobile.commentsAria")}
                    >
                      <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-black/50">
                        <MessageCircle className="h-6 w-6" />
                      </span>
                      <span className="text-xs font-semibold">{t("clips.mobile.commentsLabel")}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => router.push(href)}
                      className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-black/50 text-white"
                      aria-label={t("clips.mobile.shareAria")}
                    >
                      <Send className="h-5 w-5" />
                    </button>
                  </div>
                  <div className="absolute bottom-6 right-4">
                    {(() => {
                      const durationLabel = formatDuration(clipDurations[clip.id]);
                      return (
                    <div className="inline-flex items-center gap-2 rounded-full bg-black/55 px-3 py-1 text-sm font-semibold uppercase tracking-[0.14em]">
                      <Play className="h-4 w-4" />
                      {durationLabel === "—" ? clip.length : durationLabel}
                    </div>
                      );
                    })()}
                  </div>
                </article>
              );
            })
          )}
        </div>
        <div className="pointer-events-none absolute inset-x-0 top-0 z-40 px-4 pt-[calc(env(safe-area-inset-top)+10px)]">
          <div className="pointer-events-auto flex items-center justify-between text-white">
            <button
              type="button"
              onClick={() => router.push("/create")}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-black/45"
              aria-label={t("clips.mobile.addAria")}
            >
              <Plus className="h-6 w-6" />
            </button>
            <div className="text-3xl font-semibold tracking-tight">nClips</div>
            <span className="text-sm font-semibold tracking-[0.16em] text-white/85">NRW</span>
          </div>
          <div className="pointer-events-auto mt-3 flex items-center justify-center gap-4 text-sm font-semibold">
            {clipFilters.map((filter) => {
              const isActive = filter === activeFilter;
              return (
                <button
                  key={filter}
                  type="button"
                  onClick={() => setActiveFilter(filter)}
                  className={isActive ? "text-white" : "text-white/55"}
                >
                  {t(`clips.filters.${filter}`)}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <section className="mx-auto hidden max-w-7xl space-y-8 px-4 py-8 md:block">
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight text-neutral-900">{t("clips.desktop.title")}</h1>
          <p className="max-w-2xl text-sm text-neutral-600">{t("clips.desktop.description")}</p>
        </header>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          {clipFilters.map((filter) => {
            const isActive = filter === activeFilter;
            return (
                <button
                  key={filter}
                  type="button"
                  onClick={() => setActiveFilter(filter)}
                  className={
                    isActive
                      ? "rounded-full bg-black px-3 py-1 text-[11px] font-medium text-white"
                      : "rounded-full border border-neutral-200 bg-white px-3 py-1 text-[11px] font-medium text-neutral-600"
                }
              >
                {t(`clips.filters.${filter}`)}
              </button>
            );
          })}
        </div>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
            {clipsLoading ? (
              <div className="rounded-2xl border border-dashed border-neutral-200 bg-white p-6 text-sm text-neutral-500">
                {t("clips.desktop.loading")}
              </div>
            ) : clipsError ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-700">
                {clipsError}
              </div>
            ) : clips.length === 0 ? (
              <div className="rounded-2xl border border-neutral-200 bg-white p-6 text-sm text-neutral-500">
                {t("clips.desktop.empty")}
              </div>
            ) : (
              clips.map((clip) => {
                const isRealVideo = Boolean(clip.mediaUrl);
                const href = clip.postId ? `/clips?post=${encodeURIComponent(clip.postId)}` : "/clips";
                const durationSeconds = clipDurations[clip.id];
                const durationLabel = formatDuration(durationSeconds);
                const likesCount = clip.postId ? likesCountMap[clip.postId] ?? 0 : 0;
                const isLiked = clip.postId ? likedClipIds.has(clip.postId) : false;
                const viewsLabel = formatViews(clip.viewsCount);
                return (
                  <article
                    key={clip.id}
                    className="flex flex-col"
                  >
                  <Link
                    href={href}
                    className="relative overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900"
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
                          <div className="absolute right-3 top-3 rounded-full bg-black/60 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em]">
                            nClips
                          </div>
                          <div className="absolute bottom-12 right-3 flex flex-col items-end gap-3">
                            {clip.postId ? (
                              <button
                                type="button"
                                aria-label={isLiked ? t("clips.overlay.unlikeAria") : t("clips.overlay.likeAria")}
                                onClick={(event) => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  handleToggleLike(clip.postId as string);
                                }}
                                className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] transition ${
                                  isLiked ? "bg-rose-500/90 text-white" : "bg-black/60 text-white"
                                }`}
                              >
                                <Heart className={`h-3.5 w-3.5 ${isLiked ? "fill-white" : ""}`} />
                                {likesCount}
                              </button>
                            ) : null}
                            {clip.postId ? (
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  router.push(href);
                                }}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white transition hover:bg-black/70"
                                aria-label={t("clips.desktop.commentsAria")}
                              >
                                <MessageCircle className="h-4 w-4" />
                              </button>
                            ) : null}
                            {clip.postId ? (
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  router.push(href);
                                }}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white transition hover:bg-black/70"
                                aria-label={t("clips.desktop.shareClipAria")}
                              >
                                <Send className="h-4 w-4" />
                              </button>
                            ) : null}
                            <div className="inline-flex items-center gap-2 rounded-full bg-black/60 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white">
                              <Play className="h-3.5 w-3.5" />
                              {durationLabel}
                            </div>
                          </div>
                        </div>
                      ) : null}

                      <div className="space-y-2">
                        <p className="text-sm text-neutral-100">{clip.creator}</p>
                        <div className="flex items-center justify-between gap-3">
                          <p className="flex-1 text-sm font-normal leading-snug text-white/90">{clip.title}</p>
                          <div className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white/10 px-2 py-1 text-[11px] font-medium uppercase tracking-[0.14em]">
                            {t("clips.desktop.views", { count: viewsLabel })}
                          </div>
                        </div>
                      </div>
                    </div>
                  </Link>

                </article>
              );
              })
            )}
          </div>

          <aside className="hidden space-y-3 lg:block lg:sticky lg:top-6">
            <div className="space-y-3 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between text-sm font-semibold text-neutral-900">
                {t("clips.sidebar.flowTitle")}
                <span className="text-xs font-medium text-neutral-500">{t("clips.sidebar.flowBadge")}</span>
              </div>
              <div className="space-y-2 text-sm text-neutral-700">
                <div className="rounded-xl border border-dashed border-neutral-200 bg-neutral-50 px-3 py-2">
                  <p className="text-xs uppercase tracking-[0.16em] text-neutral-500">{t("clips.sidebar.ideaEyebrow")}</p>
                  <p className="font-semibold text-neutral-900">{t("clips.sidebar.ideaTitle")}</p>
                  <p className="text-xs text-neutral-500">{t("clips.sidebar.ideaBody")}</p>
                </div>
                <div className="rounded-xl border border-neutral-200 bg-white px-3 py-2 shadow-sm">
                  <p className="text-xs uppercase tracking-[0.16em] text-neutral-500">{t("clips.sidebar.bridgeEyebrow")}</p>
                  <p className="font-semibold text-neutral-900">{t("clips.sidebar.bridgeTitle")}</p>
                  <p className="text-xs text-neutral-500">{t("clips.sidebar.bridgeBody")}</p>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-neutral-200 bg-neutral-900 px-3 py-3 text-white shadow-sm">
                  <div>
                    <p className="text-xs uppercase tracking-[0.16em] text-neutral-300">{t("clips.sidebar.soundEyebrow")}</p>
                    <p className="text-sm font-semibold">lofi sprint · 00:18</p>
                  </div>
                  <button className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-semibold text-neutral-900 transition hover:-translate-y-0.5">
                    <Play className="h-4 w-4" />
                    {t("clips.sidebar.play")}
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-3 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between text-sm font-semibold text-neutral-900">
                <span className="inline-flex items-center gap-2">
                  <Flame className="h-4 w-4 text-orange-500" />
                  {t("clips.sidebar.trendingTitle")}
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
                      <span className="font-semibold text-neutral-900">{t(`clips.trending.${item.id}`)}</span>
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
