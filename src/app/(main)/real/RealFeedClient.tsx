"use client";

import { useEffect, useMemo, useState } from "react";
import { Image as ImageIcon, Video as VideoIcon } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import type { NrealPost, NrealProfile } from "@/types/nreal";
import { PostCard } from "./PostCard";
import type { Profile } from "@/lib/profiles";

export function RealFeedClient() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [userId, setUserId] = useState<string | null>(null);
  const [posts, setPosts] = useState<NrealPost[]>([]);
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<"image" | "video" | null>(null);

  const normalizePost = (post: any): NrealPost => {
    const rawProfiles = post?.profiles as NrealProfile[] | NrealProfile | null | undefined;
    const profiles = Array.isArray(rawProfiles) ? rawProfiles : rawProfiles ? [rawProfiles] : [];
    return { ...post, profiles };
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
      setCurrentUserEmail(user?.email ?? null);
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
            profiles (
              username,
              display_name,
              avatar_url,
              verified,
              verification_label
            )
          `,
        )
        .order("created_at", { ascending: false });

      if (!active) return;
      if (error) {
        setError(error.message);
      } else if (data) {
        setPosts((data as NrealPost[]).map((post) => normalizePost(post)));
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
    const { data, error } = await supabase
      .from("nreal_posts")
      .insert({ content: trimmed || null, user_id: userId, media_url: mediaUrl, media_type: mediaType })
      .select()
      .single();

    setPosting(false);

    if (error) {
      setError(error.message);
      return;
    }
    if (data) {
      const typed = normalizePost(data as NrealPost);
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
        profiles: fallbackProfiles,
      };
      setPosts((prev) => [withProfile, ...prev]);
      setContent("");
      handleFileChange(null);
    }
  };

  if (loading) {
    return (
      <div className="rounded-xl border border-neutral-200 bg-white p-4 text-sm text-neutral-700 shadow-sm">
        Načítám příspěvky…
      </div>
    );
  }

  const formatDate = (iso?: string | null) => {
    if (!iso) return "neznámý čas";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "neznámý čas";
    return d.toLocaleString("cs-CZ", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  };

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
            author={{
              displayName: post.profiles?.[0]?.display_name || post.profiles?.[0]?.username || "NRW uživatel",
              username: post.profiles?.[0]?.username ? `@${post.profiles[0]?.username}` : null,
              avatarUrl: post.profiles?.[0]?.avatar_url ?? null,
              isCurrentUser: post.user_id === currentUserId,
              verified: Boolean(post.profiles?.[0]?.verified),
              verificationLabel: sanitizeVerificationLabel(post.profiles?.[0]?.verification_label),
            }}
            content={post.content ?? ""}
            createdAt={post.created_at}
            mediaUrl={post.media_url ?? null}
            mediaType={(post.media_type as "image" | "video" | null) ?? null}
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
