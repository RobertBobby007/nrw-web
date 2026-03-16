/* eslint-disable @next/next/no-img-element */
"use client";

import {
  ChevronLeft,
  ChevronRight,
  Image as ImageIcon,
  LoaderCircle,
  MoreHorizontal,
  Play,
  Plus,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "@/components/i18n/LocaleProvider";
import { safeIdentityLabel } from "@/lib/content-filter";
import { fetchCurrentProfile, type Profile } from "@/lib/profiles";
import { subscribeToTable } from "@/lib/realtime";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import type { NrealStory } from "@/types/nreal";

const IMAGE_STORY_DURATION_MS = 5000;
const VIDEO_SOFT_UPLOAD_LIMIT_BYTES = 95 * 1024 * 1024;

type StoryGroup = {
  key: string;
  userId: string;
  stories: NrealStory[];
  latestStory: NrealStory;
};

type TranslateFn = (key: string, values?: Record<string, string | number>) => string;

function sortStories(items: NrealStory[]) {
  return [...items]
    .filter((story) => Date.parse(story.expires_at) > Date.now())
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
}

function buildStoryGroups(items: NrealStory[]) {
  const grouped = new Map<string, NrealStory[]>();
  for (const story of items) {
    const existing = grouped.get(story.user_id);
    if (existing) {
      existing.push(story);
    } else {
      grouped.set(story.user_id, [story]);
    }
  }

  return [...grouped.entries()]
    .map(([userId, groupedStories]) => {
      const descending = [...groupedStories].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
      const ascending = [...groupedStories].sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
      return {
        key: userId,
        userId,
        stories: ascending,
        latestStory: descending[0],
      } satisfies StoryGroup;
    })
    .sort((a, b) => Date.parse(b.latestStory.created_at) - Date.parse(a.latestStory.created_at));
}

function formatStoryAge(createdAt: string, t: TranslateFn) {
  const diffMs = Date.now() - Date.parse(createdAt);
  const diffMinutes = Math.max(0, Math.round(diffMs / 60000));
  if (diffMinutes < 1) return t("real.stories.now");
  if (diffMinutes < 60) return t("real.stories.minutesAgo", { count: diffMinutes });
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return t("real.stories.hoursAgo", { count: diffHours });
  return t("real.stories.dayAgo");
}

function formatTimeLeft(expiresAt: string, t: TranslateFn) {
  const diffMs = Date.parse(expiresAt) - Date.now();
  if (diffMs <= 0) return t("real.stories.expiresNow");
  const diffMinutes = Math.ceil(diffMs / 60000);
  if (diffMinutes < 60) return t("real.stories.expiresInMinutes", { count: diffMinutes });
  const diffHours = Math.ceil(diffMinutes / 60);
  return t("real.stories.expiresInHours", { count: diffHours });
}

function profileLabel(profile: Profile | null | undefined, fallback: string) {
  return safeIdentityLabel(profile?.display_name ?? profile?.username, fallback);
}

function storyAuthorLabel(story: NrealStory, currentUserId: string | null, currentProfile: Profile | null, t: TranslateFn) {
  if (story.user_id === currentUserId) {
    return profileLabel(currentProfile, t("real.stories.myProfile"));
  }
  const profile = story.profiles[0];
  return safeIdentityLabel(profile?.display_name ?? profile?.username, t("real.stories.userFallback"));
}

export function StoriesRail() {
  const t = useTranslations();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const activeStoryVideoRef = useRef<HTMLVideoElement | null>(null);
  const [stories, setStories] = useState<NrealStory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const [activeGroupKey, setActiveGroupKey] = useState<string | null>(null);
  const [activeStoryIndex, setActiveStoryIndex] = useState(0);
  const [storyProgress, setStoryProgress] = useState(0);

  const storyGroups = useMemo(() => buildStoryGroups(stories), [stories]);
  const activeStoryGroup = storyGroups.find((group) => group.key === activeGroupKey) ?? null;
  const activeGroupPosition = useMemo(
    () => (activeGroupKey ? storyGroups.findIndex((group) => group.key === activeGroupKey) : -1),
    [activeGroupKey, storyGroups],
  );
  const activeStory =
    activeStoryGroup && activeStoryIndex >= 0 && activeStoryIndex < activeStoryGroup.stories.length
      ? activeStoryGroup.stories[activeStoryIndex]
      : null;

  const closeViewer = useCallback(() => {
    setActiveGroupKey(null);
    setActiveStoryIndex(0);
    setStoryProgress(0);
  }, []);

  const openGroupAt = useCallback(
    (groupIndex: number, storyIndex: number) => {
      const targetGroup = storyGroups[groupIndex];
      if (!targetGroup) {
        closeViewer();
        return;
      }
      const nextStoryIndex = Math.max(0, Math.min(storyIndex, targetGroup.stories.length - 1));
      setActiveGroupKey(targetGroup.key);
      setActiveStoryIndex(nextStoryIndex);
      setStoryProgress(0);
    },
    [closeViewer, storyGroups],
  );

  const goToNextStory = useCallback(() => {
    if (!activeStoryGroup) return;
    if (activeStoryIndex < activeStoryGroup.stories.length - 1) {
      setActiveStoryIndex((current) => current + 1);
      setStoryProgress(0);
      return;
    }
    if (activeGroupPosition >= 0 && activeGroupPosition < storyGroups.length - 1) {
      openGroupAt(activeGroupPosition + 1, 0);
      return;
    }
    closeViewer();
  }, [activeGroupPosition, activeStoryGroup, activeStoryIndex, closeViewer, openGroupAt, storyGroups.length]);

  const goToPreviousStory = useCallback(() => {
    if (!activeStoryGroup) return;
    if (activeStoryIndex > 0) {
      setActiveStoryIndex((current) => current - 1);
      setStoryProgress(0);
      return;
    }
    if (activeGroupPosition > 0) {
      const previousGroup = storyGroups[activeGroupPosition - 1];
      openGroupAt(activeGroupPosition - 1, previousGroup.stories.length - 1);
      return;
    }
    setStoryProgress(0);
    if (activeStoryVideoRef.current) {
      activeStoryVideoRef.current.currentTime = 0;
      void activeStoryVideoRef.current.play().catch(() => {});
    }
  }, [activeGroupPosition, activeStoryGroup, activeStoryIndex, openGroupAt, storyGroups]);

  useEffect(() => {
    let active = true;

    async function hydrateUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!active) return;
      setCurrentUserId(user?.id ?? null);
      if (user?.id) {
        const profile = await fetchCurrentProfile();
        if (!active) return;
        setCurrentProfile(profile);
      } else {
        setCurrentProfile(null);
      }
    }

    void hydrateUser();

    return () => {
      active = false;
    };
  }, [supabase]);

  useEffect(() => {
    let active = true;

    async function loadStories() {
      setLoading(true);
      setError(null);
      const response = await fetch("/api/nreal/stories", {
        method: "GET",
        credentials: "include",
      }).catch(() => null);

      if (!active) return;
      if (!response) {
        setError(t("real.stories.loadError"));
        setLoading(false);
        return;
      }

      const payload = await response.json().catch(() => null);
      if (!active) return;
      if (!response.ok) {
        setError(payload?.message ?? t("real.stories.loadError"));
        setLoading(false);
        return;
      }

      const nextStories = Array.isArray(payload?.data) ? (payload.data as NrealStory[]) : [];
      setStories(sortStories(nextStories));
      setLoading(false);
    }

    void loadStories();

    return () => {
      active = false;
    };
  }, [reloadTick, t]);

  useEffect(() => {
    const unsubscribe = subscribeToTable("nreal_stories", () => {
      setReloadTick((value) => value + 1);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!activeGroupKey) return;
    const group = storyGroups.find((entry) => entry.key === activeGroupKey);
    if (!group) {
      setActiveGroupKey(null);
      setActiveStoryIndex(0);
      return;
    }
    if (activeStoryIndex >= group.stories.length) {
      setActiveStoryIndex(Math.max(0, group.stories.length - 1));
    }
  }, [activeGroupKey, activeStoryIndex, storyGroups]);

  useEffect(() => {
    if (!activeStory) {
      setStoryProgress(0);
      return;
    }

    let intervalId: number | null = null;
    let frameId = 0;
    let closeTimeoutId: number | null = null;

    const completeStory = () => {
      setStoryProgress(100);
      closeTimeoutId = window.setTimeout(() => {
        goToNextStory();
      }, 120);
    };

    if (activeStory.media_type === "video") {
      setStoryProgress(0);
      let cleanupVideo: (() => void) | null = null;

      const attachToVideo = () => {
        const video = activeStoryVideoRef.current;
        if (!video) {
          frameId = window.requestAnimationFrame(attachToVideo);
          return;
        }

        const syncProgress = () => {
          const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 0;
          const progress = duration > 0 ? Math.min(100, (video.currentTime / duration) * 100) : 0;
          setStoryProgress(progress);
        };

        const handleLoadedMetadata = () => {
          video.currentTime = 0;
          syncProgress();
          void video.play().catch(() => {});
        };

        const handleTimeUpdate = () => {
          syncProgress();
        };

        const handleEnded = () => {
          completeStory();
        };

        video.addEventListener("loadedmetadata", handleLoadedMetadata);
        video.addEventListener("timeupdate", handleTimeUpdate);
        video.addEventListener("ended", handleEnded);

        if (video.readyState >= 1) {
          handleLoadedMetadata();
        }

        intervalId = window.setInterval(syncProgress, 80);

        cleanupVideo = () => {
          video.pause();
          video.removeEventListener("loadedmetadata", handleLoadedMetadata);
          video.removeEventListener("timeupdate", handleTimeUpdate);
          video.removeEventListener("ended", handleEnded);
        };
      };

      attachToVideo();

      return () => {
        if (intervalId !== null) window.clearInterval(intervalId);
        if (closeTimeoutId !== null) window.clearTimeout(closeTimeoutId);
        if (frameId) window.cancelAnimationFrame(frameId);
        cleanupVideo?.();
      };
    }

    const startedAt = Date.now();
    setStoryProgress(0);
    intervalId = window.setInterval(() => {
      const progress = Math.min(100, ((Date.now() - startedAt) / IMAGE_STORY_DURATION_MS) * 100);
      setStoryProgress(progress);
      if (progress >= 100) {
        if (intervalId !== null) {
          window.clearInterval(intervalId);
        }
        completeStory();
      }
    }, 50);

    return () => {
      if (intervalId !== null) window.clearInterval(intervalId);
      if (closeTimeoutId !== null) window.clearTimeout(closeTimeoutId);
    };
  }, [activeStory, goToNextStory]);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const resetComposer = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setComposerOpen(false);
    setSelectedFile(null);
    setPreviewUrl(null);
    setPosting(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const openPicker = () => {
    if (!currentUserId) {
      setError(t("real.stories.loginRequired"));
      return;
    }
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    if (!file) return;

    if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
      setError(t("real.stories.invalidType"));
      return;
    }

    if (file.type.startsWith("video/") && file.size > VIDEO_SOFT_UPLOAD_LIMIT_BYTES) {
      setError(t("real.stories.videoTooLarge", { size: Math.round(file.size / 1024 / 1024) }));
      return;
    }

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    setError(null);
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setComposerOpen(true);
  };

  const handleSubmit = async () => {
    if (!currentUserId || !selectedFile) return;

    setPosting(true);
    setError(null);

    const extension = selectedFile.name.split(".").pop() || "bin";
    const path = `${currentUserId}/stories/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`;
    const mediaType = selectedFile.type.startsWith("video/") ? "video" : "image";

    const { error: uploadError } = await supabase.storage.from("nreal_media").upload(path, selectedFile, {
      upsert: true,
      cacheControl: "3600",
      contentType: selectedFile.type || "application/octet-stream",
    });

    if (uploadError) {
      setError(t("real.stories.uploadFailed", { message: uploadError.message }));
      setPosting(false);
      return;
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("nreal_media").getPublicUrl(path);

    const response = await fetch("/api/nreal/stories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        media_url: publicUrl,
        media_type: mediaType,
      }),
    }).catch(() => null);

    const payload = response ? await response.json().catch(() => null) : null;
    if (!response || !response.ok) {
      setError(payload?.message ?? t("real.stories.saveFailed"));
      setPosting(false);
      return;
    }

    const createdStory = payload?.data as NrealStory | undefined;
    if (createdStory) {
      const optimisticStory: NrealStory = {
        ...createdStory,
        profiles:
          createdStory.profiles?.length
            ? createdStory.profiles
            : currentProfile
              ? [
                  {
                    username: currentProfile.username ?? null,
                    display_name: currentProfile.display_name ?? null,
                    avatar_url: currentProfile.avatar_url ?? null,
                    verified: currentProfile.verified ?? null,
                    verification_label: currentProfile.verification_label ?? null,
                  },
                ]
              : [],
      };
      setStories((prev) => sortStories([optimisticStory, ...prev.filter((story) => story.id !== optimisticStory.id)]));
    }

    resetComposer();
    setReloadTick((value) => value + 1);
  };

  return (
    <>
      <div className="space-y-3">
        <input
          ref={fileInputRef}
          accept="image/*,video/*"
          className="hidden"
          type="file"
          onChange={handleFileChange}
        />

        <div className="flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          <button
            onClick={openPicker}
            className="group relative flex w-[118px] shrink-0 flex-col rounded-[28px] border border-neutral-800 bg-[#171717] p-3 text-left text-white shadow-[0_18px_40px_-24px_rgba(0,0,0,0.85)] transition hover:border-neutral-700 hover:bg-[#1b1b1b] sm:w-[132px]"
            type="button"
          >
            <div className="relative overflow-hidden rounded-[22px] bg-[radial-gradient(circle_at_top,rgba(114,68,255,0.35),transparent_55%),linear-gradient(180deg,#30205f_0%,#24104a_50%,#190c33_100%)]">
              <div className="flex h-36 w-full items-center justify-center sm:h-40">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/12 ring-1 ring-white/15 backdrop-blur">
                  <Plus className="h-7 w-7" />
                </div>
              </div>
              <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/45 to-transparent" />
              <div className="absolute bottom-3 right-3 rounded-full bg-black/45 px-3 py-1 text-[11px] font-semibold text-white backdrop-blur">
                nStory
              </div>
            </div>
            <div className="px-1 pt-3">
              <span className="block text-[12px] font-semibold leading-4 text-white">
                {profileLabel(currentProfile, t("real.stories.myProfile"))}
              </span>
              <span className="mt-1 block text-[11px] leading-4 text-neutral-400">{t("real.stories.add")}</span>
            </div>
          </button>

          {loading ? (
            <div className="flex h-[204px] w-[118px] shrink-0 items-center justify-center rounded-[28px] border border-neutral-800 bg-[#171717] text-neutral-400 sm:w-[132px]">
              <LoaderCircle className="h-5 w-5 animate-spin" />
            </div>
          ) : stories.length === 0 ? (
            <div className="flex h-[204px] w-52 shrink-0 items-center rounded-[28px] border border-dashed border-neutral-700 bg-[#171717] px-4 text-sm text-neutral-400">
              {t("real.stories.empty")}
            </div>
          ) : (
            storyGroups.map((group) => {
              const label = storyAuthorLabel(group.latestStory, currentUserId, currentProfile, t);
              return (
                <button
                  key={group.key}
                  onClick={() => {
                    setActiveGroupKey(group.key);
                    setActiveStoryIndex(0);
                    setStoryProgress(0);
                  }}
                  className={`group relative flex w-[118px] shrink-0 flex-col rounded-[28px] border bg-[#171717] p-3 text-left text-white shadow-[0_18px_40px_-24px_rgba(0,0,0,0.85)] transition sm:w-[132px] ${
                    group.userId === currentUserId
                      ? "border-violet-500/70 shadow-[0_18px_40px_-24px_rgba(88,28,255,0.6)]"
                      : "border-neutral-800 hover:border-neutral-700"
                  }`}
                  type="button"
                >
                  <div className="relative overflow-hidden rounded-[22px] bg-gradient-to-br from-slate-900 via-slate-700 to-slate-900">
                    {group.latestStory.media_type === "image" ? (
                      <img alt={label} className="h-36 w-full object-cover sm:h-40" src={group.latestStory.media_url} />
                    ) : (
                      <>
                        <video
                          className="h-36 w-full object-cover sm:h-40"
                          muted
                          playsInline
                          preload="metadata"
                          src={group.latestStory.media_url}
                        />
                        <span className="absolute right-3 top-3 rounded-full bg-black/55 p-1.5 text-white backdrop-blur">
                          <Play className="h-3.5 w-3.5 fill-current" />
                        </span>
                      </>
                    )}
                    <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/60 via-black/20 to-transparent" />
                    <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/80 via-black/25 to-transparent" />
                    <span className="absolute right-3 bottom-3 rounded-full bg-black/45 px-3 py-1 text-[11px] font-semibold text-white backdrop-blur">
                      {formatStoryAge(group.latestStory.created_at, t)}
                    </span>
                  </div>
                  <div className="px-1 pt-3">
                    <span className="block line-clamp-1 text-[12px] font-semibold leading-4 text-white">{label}</span>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {error ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
            {error}
          </div>
        ) : null}
      </div>

      {composerOpen && selectedFile && previewUrl ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-4 sm:items-center">
          <div className="w-full max-w-sm rounded-3xl bg-white p-4 shadow-2xl sm:p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-neutral-900">{t("real.stories.newTitle")}</h3>
                <p className="text-sm text-neutral-500">{t("real.stories.newDescription")}</p>
              </div>
              <button
                onClick={resetComposer}
                className="rounded-full border border-neutral-200 p-2 text-neutral-500 transition hover:text-neutral-900"
                type="button"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="relative overflow-hidden rounded-2xl border border-neutral-200 bg-[radial-gradient(circle_at_top,rgba(114,68,255,0.25),transparent_55%),linear-gradient(180deg,#30205f_0%,#24104a_50%,#190c33_100%)]">
              {selectedFile.type.startsWith("video/") ? (
                <video
                  className="h-[58vh] min-h-64 w-full rounded-2xl object-cover"
                  controls
                  playsInline
                  src={previewUrl}
                />
              ) : (
                <img
                  alt={t("real.stories.previewAlt")}
                  className="h-[58vh] min-h-64 w-full rounded-2xl object-cover"
                  src={previewUrl}
                />
              )}
            </div>

            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <button
                onClick={openPicker}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-neutral-200 px-4 py-2 text-sm font-semibold text-neutral-700 transition hover:border-neutral-300 hover:text-neutral-900"
                type="button"
              >
                <ImageIcon className="h-4 w-4" />
                {t("real.stories.changeMedia")}
              </button>
              <button
                onClick={() => void handleSubmit()}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-neutral-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={posting}
                type="button"
              >
                {posting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                {t("real.stories.share")}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {activeStory ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0a0d12] p-2 sm:bg-black/80 sm:p-4">
          <div className="relative h-[calc(100dvh-16px)] w-full overflow-hidden rounded-[28px] bg-neutral-950 text-white shadow-2xl sm:h-auto sm:max-w-md sm:rounded-3xl">
            <button
              onClick={closeViewer}
              className="absolute right-3 top-3 z-20 rounded-full bg-black/40 p-2 text-white transition hover:bg-black/60"
              type="button"
            >
              <X className="h-4 w-4" />
            </button>

            <button
              aria-label={t("real.stories.previousAria")}
              className="absolute inset-y-0 left-0 z-10 w-1/2 sm:hidden"
              onClick={goToPreviousStory}
              type="button"
            />
            <button
              aria-label={t("real.stories.nextAria")}
              className="absolute inset-y-0 right-0 z-10 w-1/2 sm:hidden"
              onClick={goToNextStory}
              type="button"
            />

            <button
              aria-label={t("real.stories.previousAria")}
              className="absolute left-4 top-1/2 z-20 hidden -translate-y-1/2 items-center justify-center rounded-full bg-black/45 p-3 text-white transition hover:bg-black/60 sm:flex"
              onClick={goToPreviousStory}
              type="button"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              aria-label={t("real.stories.nextAria")}
              className="absolute right-4 top-1/2 z-20 hidden -translate-y-1/2 items-center justify-center rounded-full bg-black/45 p-3 text-white transition hover:bg-black/60 sm:flex"
              onClick={goToNextStory}
              type="button"
            >
              <ChevronRight className="h-5 w-5" />
            </button>

            <div className="absolute left-4 right-16 top-4 z-20 flex gap-1">
              {(activeStoryGroup?.stories ?? []).map((story, index) => (
                <div key={story.id} className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/20">
                  <div
                    className="h-full rounded-full bg-white/90 transition-[width] duration-100 ease-linear"
                    style={{
                      width:
                        index < activeStoryIndex
                          ? "100%"
                          : index === activeStoryIndex
                            ? `${storyProgress}%`
                            : "0%",
                    }}
                  />
                </div>
              ))}
            </div>

            <div className="relative h-full sm:h-auto">
              {activeStory.media_type === "video" ? (
                <video
                  ref={activeStoryVideoRef}
                  className="h-full w-full object-contain sm:aspect-[9/16] sm:h-auto sm:object-cover"
                  autoPlay
                  muted
                  playsInline
                  src={activeStory.media_url}
                />
              ) : (
                <img
                  alt={storyAuthorLabel(activeStory, currentUserId, currentProfile, t)}
                  className="h-full w-full object-contain sm:aspect-[9/16] sm:h-auto sm:object-cover"
                  src={activeStory.media_url}
                />
              )}
              <div className="absolute inset-x-0 top-0 h-36 bg-gradient-to-b from-black/80 via-black/22 to-transparent sm:h-28" />
              <div className="absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-[#0a0d12] via-black/45 to-transparent sm:h-40" />
            </div>

            <div className="absolute left-4 right-20 top-7 z-20 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">{storyAuthorLabel(activeStory, currentUserId, currentProfile, t)}</div>
                <div className="text-xs text-white/75">
                  {formatStoryAge(activeStory.created_at, t)} · {formatTimeLeft(activeStory.expires_at, t)}
                </div>
              </div>
              <button
                className="hidden rounded-full bg-black/35 p-2 text-white/90 sm:inline-flex"
                type="button"
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </div>

            <div className="absolute inset-x-0 bottom-0 z-20 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-0 sm:pb-0">
              {activeStory.caption ? (
                <div className="hidden px-4 pb-5 sm:block">
                  <div className="rounded-2xl bg-black/45 px-4 py-3 text-sm leading-6 text-white/95 backdrop-blur-sm">
                    {activeStory.caption}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
