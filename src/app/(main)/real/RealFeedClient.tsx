/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Image as ImageIcon, Video as VideoIcon } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { subscribeToTable } from "@/lib/realtime";
import { containsBlockedContent, safeIdentityLabel } from "@/lib/content-filter";
import { MAX_POST_MEDIA_IMAGES, serializeMediaUrls } from "@/lib/media";
import type { NrealPost, NrealProfile } from "@/types/nreal";
import { PostCard } from "./PostCard";
import { fetchCurrentProfile, type Profile } from "@/lib/profiles";

type SupabasePost = Omit<NrealPost, "profiles" | "likesCount" | "likedByCurrentUser" | "status"> & {
  status?: NrealPost["status"] | null;
  profiles?: NrealProfile | NrealProfile[] | null;
  likesCount?: number;
  likedByCurrentUser?: boolean;
  commentsCount?: number;
};

const MAX_POST_CHARS = 3000;
const POST_CACHE_TTL_MS = 30000;
const POST_CACHE_LIMIT = 60;
let nrealPostsCache: { userId: string | null; posts: NrealPost[]; fetchedAt: number } | null = null;

export function RealFeedClient() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [userId, setUserId] = useState<string | null>(null);
  const [posts, setPosts] = useState<NrealPost[]>([]);
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null);
  const [currentUserMetaProfile, setCurrentUserMetaProfile] = useState<NrealProfile | null>(null);
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [mediaPreviews, setMediaPreviews] = useState<string[]>([]);
  const [mediaType, setMediaType] = useState<"image" | "video" | null>(null);
  const [likingPostIds, setLikingPostIds] = useState<Set<string>>(new Set());
  const deletedPostsRef = useRef<Map<string, NrealPost>>(new Map());

  const cachePosts = (nextPosts: NrealPost[], cacheUserId: string | null) => {
    nrealPostsCache = {
      userId: cacheUserId,
      posts: nextPosts.slice(0, POST_CACHE_LIMIT),
      fetchedAt: Date.now(),
    };
  };

  const setPostsWithCache = (updater: (prev: NrealPost[]) => NrealPost[], cacheUserId: string | null) => {
    setPosts((prev) => {
      const next = updater(prev);
      cachePosts(next, cacheUserId);
      return next;
    });
  };

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

  useEffect(() => {
    let active = true;
    async function load() {
      setError(null);
      const { data: userData } = await supabase.auth.getUser();
      const user = userData?.user ?? null;

      if (!active) return;
      setUserId(user?.id ?? null);
      setCurrentUserId(user?.id ?? null);
      if (user) {
        const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
        setCurrentUserMetaProfile({
          username: typeof meta.username === "string" ? meta.username : null,
          display_name: typeof meta.display_name === "string" ? meta.display_name : null,
          avatar_url: typeof meta.avatar_url === "string" ? meta.avatar_url : null,
          verified: typeof meta.verified === "boolean" ? meta.verified : null,
          verification_label: typeof meta.verification_label === "string" ? meta.verification_label : null,
        });
      } else if (active) {
        setCurrentUserMetaProfile(null);
      }
      if (user?.id) {
        const profileData = await fetchCurrentProfile();
        if (active) setCurrentProfile(profileData);
      } else if (active) {
        setCurrentProfile(null);
      }

      const cacheKey = user?.id ?? null;
      const cacheValid =
        nrealPostsCache &&
        nrealPostsCache.userId === cacheKey &&
        Date.now() - nrealPostsCache.fetchedAt < POST_CACHE_TTL_MS;

      setLoading(!cacheValid);

      if (cacheValid && nrealPostsCache) {
        setPosts(nrealPostsCache.posts);
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

      const { data, error } = await query.order("created_at", { ascending: false });

      if (!active) return;
      if (error) {
        setError(error.message);
      } else if (data) {
        const normalized = (data as SupabasePost[]).map((post) => normalizePost(post));
        const postIds = normalized.map((post) => post.id);
        const likesCountMap: Record<string, number> = {};
        const commentsCountMap: Record<string, number> = {};
        const likedPostIds = new Set<string>();

        if (postIds.length > 0) {
          const { data: likesData } = await supabase
            .from("nreal_likes")
            .select("post_id")
            .in("post_id", postIds);

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

        const withCounts = normalized.map((post) => ({
          ...post,
          likesCount: likesCountMap[post.id] ?? 0,
          likedByCurrentUser: likedPostIds.has(post.id),
          commentsCount: commentsCountMap[post.id] ?? 0,
        }));
        const nextPosts = withCounts.filter((post) => !post.is_deleted);
        setPosts(nextPosts);
        cachePosts(nextPosts, cacheKey);
      }
      setLoading(false);
    }
    load();
    return () => {
      active = false;
    };
  }, [supabase]);

  useEffect(() => {
    if (!currentUserId) return;
    let active = true;
    const profileCache = new Map<string, NrealProfile>();

    const fetchProfileForUser = async (id: string): Promise<NrealProfile | null> => {
      if (id === currentUserId && currentProfile) {
        return {
          username: currentProfile.username ?? null,
          display_name: currentProfile.display_name ?? null,
          avatar_url: currentProfile.avatar_url ?? null,
          verified: currentProfile.verified ?? null,
          verification_label: currentProfile.verification_label ?? null,
        };
      }
      if (id === currentUserId && currentUserMetaProfile) {
        return currentUserMetaProfile;
      }
      const cached = profileCache.get(id);
      if (cached) return cached;
      const { data, error } = await supabase
        .from("profiles")
        .select("username, display_name, avatar_url, verified, verification_label")
        .eq("id", id)
        .maybeSingle();
      if (error || !data) return null;
      const profile: NrealProfile = {
        username: data.username ?? null,
        display_name: data.display_name ?? null,
        avatar_url: data.avatar_url ?? null,
        verified: data.verified ?? null,
        verification_label: data.verification_label ?? null,
      };
      profileCache.set(id, profile);
      return profile;
    };

    const shouldIncludePost = (row: SupabasePost) => {
      if (row.is_deleted) return false;
      const status = row.status ?? "approved";
      if (status === "approved") return true;
      return row.user_id === currentUserId;
    };

    const handlePostInsert = async (row: SupabasePost) => {
      if (!shouldIncludePost(row)) return;
      const profile = await fetchProfileForUser(row.user_id);
      if (!active) return;
      const normalized = normalizePost({
        ...row,
        profiles: profile ? [profile] : [],
      });
      const newPost: NrealPost = {
        ...normalized,
        likesCount: 0,
        likedByCurrentUser: false,
        commentsCount: 0,
      };
      setPostsWithCache((prev) => {
        if (prev.some((post) => post.id === newPost.id)) {
          return prev;
        }
        const tempIndex = prev.findIndex(
          (post) =>
            post.id.startsWith("temp-") &&
            post.user_id === newPost.user_id &&
            (post.content ?? "") === (newPost.content ?? "") &&
            (post.media_url ?? null) === (newPost.media_url ?? null),
        );
        if (tempIndex !== -1) {
          const next = [...prev];
          next[tempIndex] = newPost;
          return next;
        }
        return [newPost, ...prev];
      }, currentUserId);
    };

    const unsubscribePosts = subscribeToTable("nreal_posts", (payload) => {
      if (!payload || payload.eventType !== "INSERT") return;
      const row = payload.new as SupabasePost;
      if (!row) return;
      void handlePostInsert(row);
    });

    const unsubscribeLikes = subscribeToTable("nreal_likes", (payload) => {
      if (!payload || payload.eventType !== "INSERT") return;
      const row = payload.new as { post_id?: string | null; user_id?: string | null };
      const postId = row?.post_id ?? null;
      if (!postId) return;
      setPostsWithCache(
        (prev) =>
          prev.map((post) => {
            if (post.id !== postId) return post;
            if (row.user_id === currentUserId) {
              if (post.likedByCurrentUser) return post;
              return { ...post, likesCount: post.likesCount + 1, likedByCurrentUser: true };
            }
            return { ...post, likesCount: post.likesCount + 1 };
          }),
        currentUserId,
      );
    });

    const unsubscribeComments = subscribeToTable("nreal_comments", (payload) => {
      if (!payload || payload.eventType !== "INSERT") return;
      const row = payload.new as { post_id?: string | null; is_deleted?: boolean | null };
      const postId = row?.post_id ?? null;
      if (!postId || row?.is_deleted) return;
      setPostsWithCache(
        (prev) =>
          prev.map((post) => {
            if (post.id !== postId) return post;
            return { ...post, commentsCount: (post.commentsCount ?? 0) + 1 };
          }),
        currentUserId,
      );
    });

    return () => {
      active = false;
      unsubscribePosts();
      unsubscribeLikes();
      unsubscribeComments();
    };
  }, [currentProfile, currentUserId, currentUserMetaProfile, supabase]);

  const resetMedia = () => {
    mediaPreviews.forEach((url) => URL.revokeObjectURL(url));
    setMediaFiles([]);
    setMediaPreviews([]);
    setMediaType(null);
  };

  const handleFileChange = (fileList?: FileList | null) => {
    setError(null);
    const files = fileList ? Array.from(fileList) : [];
    if (files.length === 0) {
      resetMedia();
      return;
    }
    const containsVideo = files.some((file) => file.type.startsWith("video"));
    const hasExistingMedia = mediaFiles.length > 0;
    if (containsVideo) {
      if (files.length > 1 || hasExistingMedia) {
        setError("Video nelze kombinovat s fotkami a jde nahrát jen jedno.");
        return;
      }
      const file = files.find((f) => f.type.startsWith("video")) ?? files[0];
      resetMedia();
      setMediaFiles([file]);
      setMediaPreviews([URL.createObjectURL(file)]);
      setMediaType("video");
      return;
    }

    const nextFiles = [...(mediaType === "image" ? mediaFiles : []), ...files].slice(0, MAX_POST_MEDIA_IMAGES);
    if (nextFiles.length < (mediaFiles.length + files.length)) {
      setError(`Maximálně ${MAX_POST_MEDIA_IMAGES} fotky.`);
    }
    resetMedia();
    setMediaFiles(nextFiles);
    setMediaPreviews(nextFiles.map((file) => URL.createObjectURL(file)));
    setMediaType("image");
  };

  const uploadMedia = async (files: File[], userId: string) => {
    const uploaded: string[] = [];
    for (const [index, file] of files.entries()) {
      const ext = file.name.split(".").pop() || "bin";
      const path = `${userId}/${Date.now()}-${index}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("nreal_media").upload(path, file, {
        upsert: true,
        cacheControl: "3600",
      });
      if (uploadError) {
        setError("Nahrání souboru selhalo.");
        return null;
      }
      const { data } = supabase.storage.from("nreal_media").getPublicUrl(path);
      if (data.publicUrl) uploaded.push(data.publicUrl);
    }
    return uploaded;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (posting) return;
    if (!userId) {
      setError("Musíš být přihlášený.");
      return;
    }
    const trimmed = content.trim();
    if (!trimmed && mediaFiles.length === 0) return;
    if (trimmed.length > MAX_POST_CHARS) {
      setError(`Text je moc dlouhý (max ${MAX_POST_CHARS} znaků).`);
      return;
    }
    if (trimmed) {
      const { hit } = containsBlockedContent(trimmed);
      if (hit) {
        setError("Uprav text – obsahuje zakázané výrazy, které mohou být urážlivé. Pokud si myslíš, že jde o omyl, kontaktuj podporu.");
        return;
      }
    }

    setPosting(true);
    setError(null);
    const mediaUrls = mediaFiles.length > 0 ? await uploadMedia(mediaFiles, userId) : null;
    if (mediaFiles.length > 0 && !mediaUrls) {
      setPosting(false);
      return;
    }
    const mediaUrl = mediaUrls ? serializeMediaUrls(mediaUrls) : null;
    if (mediaFiles.length > 0 && !mediaUrl) {
      setPosting(false);
      return;
    }
    const optimisticId = `temp-${Date.now()}`;
    const optimisticStatus = currentProfile?.can_post_without_review ? "approved" : "pending";
    const optimisticProfiles = currentProfile
      ? [
          {
            username: currentProfile.username ?? null,
            display_name: currentProfile.display_name ?? null,
            avatar_url: currentProfile.avatar_url ?? null,
            verified: currentProfile.verified ?? null,
            verification_label: currentProfile.verification_label ?? null,
          },
        ]
      : currentUserMetaProfile
        ? [currentUserMetaProfile]
        : [];
    const optimisticPost: NrealPost = {
      id: optimisticId,
      user_id: userId,
      content: trimmed || null,
      created_at: new Date().toISOString(),
      status: optimisticStatus,
      media_url: mediaUrl,
      media_type: mediaType,
      is_deleted: false,
      profiles: optimisticProfiles,
      likesCount: 0,
      likedByCurrentUser: false,
      commentsCount: 0,
    };
    setPostsWithCache((prev) => [optimisticPost, ...prev], userId);

    let response: Response;
    let payload: { error?: string; message?: string; data?: unknown; max?: number } | null = null;
    try {
      response = await fetch("/api/nreal/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: trimmed || null,
          media_url: mediaUrl,
          media_type: mediaType,
        }),
      });
      payload = await response.json().catch(() => null);
    } catch (err) {
      setPosting(false);
      setPostsWithCache((prev) => prev.filter((post) => post.id !== optimisticId), userId);
      setError(err instanceof Error ? err.message : "Publikace selhala.");
      return;
    }

    setPosting(false);

    if (!response.ok) {
      setPosts((prev) => prev.filter((post) => post.id !== optimisticId));
      if (payload?.error === "blocked_content") {
        setError("Uprav text – obsahuje zakázané výrazy.");
      } else if (payload?.error === "content_too_long") {
        setError(`Text je moc dlouhý (max ${payload?.max ?? MAX_POST_CHARS} znaků).`);
      } else if (payload?.error === "unauthorized") {
        setError("Musíš být přihlášený.");
      } else {
        setError(payload?.message ?? "Publikace selhala.");
      }
      return;
    }
    const data = payload?.data as SupabasePost | undefined;
      if (data) {
      const typed = normalizePost(data as SupabasePost);
      const resolvedStatus = data.status ?? optimisticStatus;
      const fallbackProfiles = typed.profiles.length
        ? typed.profiles
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
          : currentUserMetaProfile
            ? [currentUserMetaProfile]
            : [];
      const withProfile: NrealPost = {
        ...typed,
        status: resolvedStatus,
        is_deleted: false,
        profiles: fallbackProfiles,
        likesCount: 0,
        likedByCurrentUser: false,
        commentsCount: 0,
      };
      setPostsWithCache((prev) => prev.map((post) => (post.id === optimisticId ? withProfile : post)), userId);
      setContent("");
      resetMedia();
    } else {
      setPostsWithCache((prev) => prev.filter((post) => post.id !== optimisticId), userId);
    }
  };

  const toggleLike = async (postId: string) => {
    if (!currentUserId) {
      setError("Musíš být přihlášený.");
      return;
    }

    if (likingPostIds.has(postId)) return;

    const targetPost = posts.find((p) => p.id === postId);
    if (!targetPost) return;

    const wasLiked = targetPost.likedByCurrentUser;
    const previousLikes = targetPost.likesCount;

    setLikingPostIds((prev) => {
      const next = new Set(prev);
      next.add(postId);
      return next;
    });

    setPostsWithCache(
      (prev) =>
        prev.map((post) => {
          if (post.id !== postId) return post;
          const nextLiked = !wasLiked;
          const nextLikes = Math.max(0, previousLikes + (nextLiked ? 1 : -1));
          return { ...post, likedByCurrentUser: nextLiked, likesCount: nextLikes };
        }),
      currentUserId,
    );

    const { error } = wasLiked
      ? await supabase.from("nreal_likes").delete().eq("post_id", postId).eq("user_id", currentUserId)
      : await supabase.from("nreal_likes").insert({ post_id: postId, user_id: currentUserId });

    if (error) {
      setPostsWithCache(
        (prev) =>
          prev.map((post) => {
            if (post.id !== postId) return post;
            return { ...post, likedByCurrentUser: wasLiked, likesCount: previousLikes };
          }),
        currentUserId,
      );
      setError(error.message);
    }

    setLikingPostIds((prev) => {
      const next = new Set(prev);
      next.delete(postId);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="rounded-xl border border-neutral-200 bg-white p-4 text-sm text-neutral-700 shadow-sm">
        Načítám příspěvky…
      </div>
    );
  }

  const sanitizeVerificationLabel = (value: string | null | undefined) => {
    const trimmed = (value ?? "").trim();
    if (!trimmed) return null;
    const lower = trimmed.toLowerCase();
    if (lower === "null" || lower === "undefined") return null;
    return trimmed;
  };

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-neutral-200 bg-white shadow-sm">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-6 py-5">
          <textarea
            value={content}
            maxLength={MAX_POST_CHARS}
            onChange={(e) => setContent(e.target.value.slice(0, MAX_POST_CHARS))}
            placeholder="Co se děje v NRW?"
            className="min-h-[120px] w-full resize-none border-none bg-transparent text-sm outline-none placeholder:text-neutral-400"
          />
          <div className="flex items-center justify-between text-xs text-neutral-500">
            <span>{content.length}/{MAX_POST_CHARS}</span>
            {content.length >= MAX_POST_CHARS ? (
              <span className="font-semibold text-red-600">Limit dosažen</span>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-neutral-300 px-3 py-2 text-xs font-semibold text-neutral-700 transition hover:border-neutral-500">
              <input
                type="file"
                accept="image/*,video/*"
                className="hidden"
                multiple
                onChange={(e) => handleFileChange(e.target.files)}
              />
              {mediaType === "video" ? (
                <VideoIcon className="h-4 w-4 text-neutral-500" />
              ) : (
                <ImageIcon className="h-4 w-4 text-neutral-500" />
              )}
              {mediaPreviews.length > 0 ? "Přidat další" : "Přidat foto/video"}
            </label>
            {mediaPreviews.length > 0 && (
              <button
                type="button"
                onClick={resetMedia}
                className="rounded-lg border border-neutral-200 px-3 py-1 text-xs font-semibold text-neutral-600 transition hover:border-neutral-400"
              >
                Odebrat
              </button>
            )}
            {mediaPreviews.length > 0 && (
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-500">
                {mediaType === "video" ? "Video" : "Foto"}
              </span>
            )}
          </div>
          {mediaPreviews.length > 0 && (
            <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3">
              <div className="mb-2 text-xs font-semibold text-neutral-700">Náhled</div>
              {mediaType === "video" ? (
                <video
                  src={mediaPreviews[0]}
                  controls
                  className="w-full max-h-[480px] rounded-2xl border border-neutral-200 object-contain"
                />
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {mediaPreviews.map((preview, index) => (
                    <div key={preview} className="relative overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-100">
                      <img
                        src={preview}
                        alt={`Náhled ${index + 1}`}
                        className="h-full w-full object-cover"
                        onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const nextFiles = mediaFiles.filter((_, i) => i !== index);
                          const nextPreviews = mediaPreviews.filter((_, i) => i !== index);
                          mediaPreviews.forEach((url, i) => {
                            if (i === index) URL.revokeObjectURL(url);
                          });
                          setMediaFiles(nextFiles);
                          setMediaPreviews(nextPreviews);
                          if (nextFiles.length === 0) setMediaType(null);
                        }}
                        className="absolute right-2 top-2 rounded-full bg-white/90 px-2 py-1 text-[11px] font-semibold text-neutral-700 shadow-sm"
                      >
                        Odebrat
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          {error && (
            <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
          )}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={posting || (!content.trim() && mediaFiles.length === 0) || !userId}
              className="rounded-full bg-black px-5 py-2 text-sm font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-50"
            >
              {posting ? "Odesílám…" : "Přidat příspěvek"}
            </button>
          </div>
        </form>
      </div>

      <div className="space-y-4">
        {posts.map((post) => (
          <PostCard
            key={post.id}
            postUserId={post.user_id}
            isDeleted={post.is_deleted ?? false}
            author={{
              displayName: safeIdentityLabel(
                post.profiles?.[0]?.display_name ?? null,
                safeIdentityLabel(post.profiles?.[0]?.username ?? null, "") || "NRW uživatel",
              ),
              username: (() => {
                const safeUsername = safeIdentityLabel(post.profiles?.[0]?.username ?? null, "");
                return safeUsername ? `@${safeUsername}` : null;
              })(),
              avatarUrl: post.profiles?.[0]?.avatar_url ?? null,
              isCurrentUser: post.user_id === currentUserId,
              verified: Boolean(post.profiles?.[0]?.verified),
              verificationLabel: sanitizeVerificationLabel(post.profiles?.[0]?.verification_label),
            }}
            postId={post.id}
            content={post.content ?? ""}
            createdAt={post.created_at}
            status={post.status}
            mediaUrl={post.media_url ?? null}
            mediaType={(post.media_type as "image" | "video" | null) ?? null}
            likesCount={post.likesCount}
            likedByCurrentUser={post.likedByCurrentUser}
            commentsCount={post.commentsCount ?? 0}
            onToggleLike={toggleLike}
            likeDisabled={!currentUserId || likingPostIds.has(post.id)}
            currentUserProfile={currentProfile}
            onDeletePost={(id) =>
              setPostsWithCache((prev) => {
                const found = prev.find((p) => p.id === id);
                if (found) deletedPostsRef.current.set(id, found);
                return prev.filter((p) => p.id !== id);
              }, currentUserId)
            }
            onRestorePost={(id) => {
              const cached = deletedPostsRef.current.get(id);
              if (cached) {
                setPostsWithCache((prev) => {
                  if (prev.some((p) => p.id === id)) return prev;
                  return [cached, ...prev];
                }, currentUserId);
                deletedPostsRef.current.delete(id);
              }
            }}
          />
        ))}
      {posts.length === 0 && (
        <div className="rounded-3xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-600 shadow-sm">
          Zatím žádné příspěvky.
        </div>
      )}
    </div>
  </div>
);
}
