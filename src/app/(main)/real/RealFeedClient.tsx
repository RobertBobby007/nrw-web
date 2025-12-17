/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Image as ImageIcon, Video as VideoIcon } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { containsBlockedContent } from "@/lib/content-filter";
import type { NrealPost, NrealProfile } from "@/types/nreal";
import { PostCard } from "./PostCard";
import type { Profile } from "@/lib/profiles";

type SupabasePost = Omit<NrealPost, "profiles" | "likesCount" | "likedByCurrentUser"> & {
  profiles?: NrealProfile | NrealProfile[] | null;
  likesCount?: number;
  likedByCurrentUser?: boolean;
  commentsCount?: number;
};

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
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<"image" | "video" | null>(null);
  const [likingPostIds, setLikingPostIds] = useState<Set<string>>(new Set());
  const deletedPostsRef = useRef<Map<string, NrealPost>>(new Map());

  const normalizePost = (post: SupabasePost): NrealPost => {
    const rawProfiles = post?.profiles;
    const profiles = Array.isArray(rawProfiles) ? rawProfiles : rawProfiles ? [rawProfiles] : [];
    return {
      ...post,
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
      setLoading(true);
      setError(null);
      const { data: userData } = await supabase.auth.getUser();
      const user = userData?.user ?? null;

      if (!active) return;
      setUserId(user?.id ?? null);
      setCurrentUserId(user?.id ?? null);
      if (user?.id) {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .maybeSingle<Profile>();
        if (active && profileData) setCurrentProfile(profileData);
      }
      const { data, error } = await supabase
        .from("nreal_posts")
        .select(
          `
            id,
            user_id,
            content,
            created_at,
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
        .eq("is_deleted", false)
        .order("created_at", { ascending: false });

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
        setPosts(withCounts.filter((post) => !post.is_deleted));
      }
      setLoading(false);
    }
    load();
    return () => {
      active = false;
    };
  }, [supabase]);

  const handleFileChange = (file?: File | null) => {
    setError(null);
    if (!file) {
      setMediaFile(null);
      setMediaPreview(null);
      setMediaType(null);
      return;
    }
    const type = file.type.startsWith("video") ? "video" : "image";
    setMediaFile(file);
    setMediaPreview(URL.createObjectURL(file));
    setMediaType(type);
  };

  const uploadMedia = async (file: File, userId: string) => {
    const ext = file.name.split(".").pop() || "bin";
    const path = `${userId}/${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage.from("nreal_media").upload(path, file, {
      upsert: true,
      cacheControl: "3600",
    });
    if (uploadError) {
      setError("Nahrání souboru selhalo.");
      return null;
    }
    const { data } = supabase.storage.from("nreal_media").getPublicUrl(path);
    return data.publicUrl ?? null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) {
      setError("Musíš být přihlášený.");
      return;
    }
    const trimmed = content.trim();
    if (!trimmed && !mediaFile) return;
    if (trimmed) {
      const { hit } = containsBlockedContent(trimmed);
      if (hit) {
        setError("Uprav text – obsahuje zakázané výrazy.");
        return;
      }
    }

    setPosting(true);
    setError(null);
    let mediaUrl: string | null = null;
    if (mediaFile) {
      mediaUrl = await uploadMedia(mediaFile, userId);
      if (!mediaUrl) {
        setPosting(false);
        return;
      }
    }
    const response = await fetch("/api/nreal/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: trimmed || null,
        media_url: mediaUrl,
        media_type: mediaType,
      }),
    });
    const payload = await response.json().catch(() => null);

    setPosting(false);

    if (!response.ok) {
      if (payload?.error === "blocked_content") {
        setError("Uprav text – obsahuje zakázané výrazy.");
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
          : [];
      const withProfile: NrealPost = {
        ...typed,
        is_deleted: false,
        profiles: fallbackProfiles,
        likesCount: 0,
        likedByCurrentUser: false,
        commentsCount: 0,
      };
      setPosts((prev) => [withProfile, ...prev]);
      setContent("");
      handleFileChange(null);
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

    setPosts((prev) =>
      prev.map((post) => {
        if (post.id !== postId) return post;
        const nextLiked = !wasLiked;
        const nextLikes = Math.max(0, previousLikes + (nextLiked ? 1 : -1));
        return { ...post, likedByCurrentUser: nextLiked, likesCount: nextLikes };
      }),
    );

    const { error } = wasLiked
      ? await supabase.from("nreal_likes").delete().eq("post_id", postId).eq("user_id", currentUserId)
      : await supabase.from("nreal_likes").insert({ post_id: postId, user_id: currentUserId });

    if (error) {
      setPosts((prev) =>
        prev.map((post) => {
          if (post.id !== postId) return post;
          return { ...post, likedByCurrentUser: wasLiked, likesCount: previousLikes };
        }),
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
            onChange={(e) => setContent(e.target.value)}
            placeholder="Co se děje v NRW?"
            className="min-h-[120px] w-full resize-none border-none bg-transparent text-sm outline-none placeholder:text-neutral-400"
          />
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-neutral-300 px-3 py-2 text-xs font-semibold text-neutral-700 transition hover:border-neutral-500">
              <input
                type="file"
                accept="image/*,video/*"
                className="hidden"
                onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
              />
              {mediaType === "video" ? (
                <VideoIcon className="h-4 w-4 text-neutral-500" />
              ) : (
                <ImageIcon className="h-4 w-4 text-neutral-500" />
              )}
              {mediaPreview ? "Změnit soubor" : "Přidat foto/video"}
            </label>
            {mediaPreview && (
              <button
                type="button"
                onClick={() => handleFileChange(null)}
                className="rounded-lg border border-neutral-200 px-3 py-1 text-xs font-semibold text-neutral-600 transition hover:border-neutral-400"
              >
                Odebrat
              </button>
            )}
            {mediaPreview && (
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-500">
                {mediaType === "video" ? "Video" : "Foto"}
              </span>
            )}
          </div>
          {mediaPreview && (
            <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3">
              <div className="mb-2 text-xs font-semibold text-neutral-700">Náhled</div>
              {mediaType === "video" ? (
                <video
                  src={mediaPreview}
                  controls
                  className="w-full max-h-[480px] rounded-2xl border border-neutral-200 object-contain"
                />
              ) : (
                <div className="relative w-full overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-100" style={{ aspectRatio: "3 / 4" }}>
                  <img
                    src={mediaPreview}
                    alt="Náhled"
                    className="h-full w-full object-cover"
                    onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")}
                  />
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
              disabled={posting || (!content.trim() && !mediaFile) || !userId}
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
              displayName: post.profiles?.[0]?.display_name || post.profiles?.[0]?.username || "NRW uživatel",
              username: post.profiles?.[0]?.username ? `@${post.profiles[0]?.username}` : null,
              avatarUrl: post.profiles?.[0]?.avatar_url ?? null,
              isCurrentUser: post.user_id === currentUserId,
              verified: Boolean(post.profiles?.[0]?.verified),
              verificationLabel: sanitizeVerificationLabel(post.profiles?.[0]?.verification_label),
            }}
            postId={post.id}
            content={post.content ?? ""}
            createdAt={post.created_at}
            mediaUrl={post.media_url ?? null}
            mediaType={(post.media_type as "image" | "video" | null) ?? null}
            likesCount={post.likesCount}
            likedByCurrentUser={post.likedByCurrentUser}
            commentsCount={post.commentsCount ?? 0}
            onToggleLike={toggleLike}
            likeDisabled={!currentUserId || likingPostIds.has(post.id)}
            currentUserProfile={currentProfile}
            onDeletePost={(id) =>
              setPosts((prev) => {
                const found = prev.find((p) => p.id === id);
                if (found) deletedPostsRef.current.set(id, found);
                return prev.filter((p) => p.id !== id);
              })
            }
            onRestorePost={(id) => {
              const cached = deletedPostsRef.current.get(id);
              if (cached) {
                setPosts((prev) => {
                  if (prev.some((p) => p.id === id)) return prev;
                  return [cached, ...prev];
                });
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
