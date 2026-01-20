/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck, Camera, X } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import {
  fetchCurrentProfile,
  getCachedProfile,
  type Profile,
  updateCurrentProfile,
  uploadAvatar,
  deleteAvatarByUrl,
} from "@/lib/profiles";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import type { NrealPost, NrealProfile } from "@/types/nreal";
import { PostCard } from "../real/PostCard";
import { getFollowCounts, getPostsCount, peekFollowCounts, peekPostsCount } from "@/lib/follows";
import { containsBlockedContent } from "@/lib/content-filter";

const media = [
  { id: "m1", label: "Golden hour crew", gradient: "from-amber-300 via-orange-200 to-rose-200" },
  { id: "m2", label: "NRW meetup", gradient: "from-indigo-300 via-blue-200 to-cyan-200" },
  { id: "m3", label: "Studio moment", gradient: "from-slate-800 via-slate-700 to-slate-900" },
  { id: "m4", label: "City run", gradient: "from-emerald-200 via-teal-200 to-cyan-200" },
  { id: "m5", label: "Afterparty", gradient: "from-rose-200 via-fuchsia-200 to-purple-200" },
  { id: "m6", label: "nReal live", gradient: "from-amber-200 via-yellow-200 to-lime-200" },
];

export default function IdPage() {
  const router = useRouter();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [profile, setProfile] = useState<Profile | null>(() => getCachedProfile());
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(() => !getCachedProfile());
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [bioInput, setBioInput] = useState("");
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarCroppedFile, setAvatarCroppedFile] = useState<File | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [showCropper, setShowCropper] = useState(false);
  const [cropImageUrl, setCropImageUrl] = useState<string | null>(null);
  const [cropZoom, setCropZoom] = useState(1);
  const [cropOffsetX, setCropOffsetX] = useState(0);
  const [cropOffsetY, setCropOffsetY] = useState(0);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const [imageSize, setImageSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const offsetStart = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const [cropSize, setCropSize] = useState(600);
  const previewRef = useRef<HTMLDivElement | null>(null);
  const [posts, setPosts] = useState<NrealPost[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [showVerificationInfo, setShowVerificationInfo] = useState(false);
  const [likingPostIds, setLikingPostIds] = useState<Set<string>>(new Set());
  const [stats, setStats] = useState<{ followers: number; following: number; posts: number }>(() => {
    const cached = getCachedProfile();
    const cachedFollow = cached ? peekFollowCounts(cached.id) : null;
    const cachedPosts = cached ? peekPostsCount(cached.id) : null;
    return {
      followers: cachedFollow?.followers ?? 0,
      following: cachedFollow?.following ?? 0,
      posts: cachedPosts ?? 0,
    };
  });
  const [statsLoading, setStatsLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadProfile() {
      const cached = getCachedProfile();
      if (!cached) {
        setLoading(true);
      }
      const p = await fetchCurrentProfile();
      if (isMounted) {
        setProfile(p ?? cached ?? null);
        setLoading(false);
      }
    }

    loadProfile();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!isMounted) return;
      setUser(data.user ?? null);
    });
    return () => {
      isMounted = false;
    };
  }, [supabase]);

  useEffect(() => {
    if (!profile) return;
    setBioInput(profile.bio ?? "");
    setAvatarPreview(profile.avatar_url ?? null);
  }, [profile]);

  const meta = (user?.user_metadata ?? {}) as Record<string, unknown>;
  const metaDisplayName = typeof meta.display_name === "string" ? meta.display_name : null;
  const metaUsername = typeof meta.username === "string" ? meta.username : null;
  const displayName = profile?.display_name ?? metaDisplayName ?? "Uživatel";
  const resolvedUsername = profile?.username ?? metaUsername ?? "";
  const username = resolvedUsername ? `@${resolvedUsername}` : "";
  const bio = profile?.bio ?? "Ještě sis nenastavil bio.";
  const bioText = loading ? "Načítám profil…" : bio;
  const canEdit = Boolean(profile);
  const isVerified = profile?.verified ?? false;
  const sanitizeVerificationLabel = (value: string | null | undefined) => {
    const trimmed = (value ?? "").trim();
    if (!trimmed) return null;
    const lower = trimmed.toLowerCase();
    if (lower === "null" || lower === "undefined") return null;
    return trimmed;
  };
  const verificationLabel = sanitizeVerificationLabel(profile?.verification_label) ?? "Ověřený profil";

  type SupabasePost = Omit<NrealPost, "profiles" | "likesCount" | "likedByCurrentUser" | "status"> & {
    status?: NrealPost["status"] | null;
    profiles?: NrealProfile | NrealProfile[] | null;
    likesCount?: number;
    likedByCurrentUser?: boolean;
    commentsCount?: number;
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
    if (!supabase || !profile?.id) return;

    setPostsLoading(true);

    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      const currentUserId = userData?.user?.id ?? null;

      const { data, error } = await supabase
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
          profiles(username, display_name, avatar_url, verified, verification_label)
        `,
        )
        .eq("user_id", profile.id)
        .eq("is_deleted", false)
        .order("created_at", { ascending: false });

      if (!error && data) {
        const normalized = ((data as SupabasePost[] | null) ?? []).map((p) => normalizePost(p));
        const postIds = normalized.map((post) => post.id);
        const likesCountMap: Record<string, number> = {};
        const commentsCountMap: Record<string, number> = {};
        const likedPostIds = new Set<string>();

        if (postIds.length > 0) {
          const { data: likesData } = await supabase.from("nreal_likes").select("post_id").in("post_id", postIds);
          likesData?.forEach((row) => {
            const pid = (row as { post_id: string }).post_id;
            likesCountMap[pid] = (likesCountMap[pid] ?? 0) + 1;
          });

          if (currentUserId) {
            const { data: likedData } = await supabase
              .from("nreal_likes")
              .select("post_id")
              .eq("user_id", currentUserId)
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

        setPosts(withCounts.filter((p) => !p.is_deleted));
      } else {
        setPosts([]);
      }

      setPostsLoading(false);
    })();
  }, [profile?.id, supabase]);

  useEffect(() => {
    if (!profile?.id) return;
    let active = true;
    const cachedFollow = peekFollowCounts(profile.id);
    const cachedPosts = peekPostsCount(profile.id);
    if (cachedFollow || cachedPosts !== null) {
      setStats((prev) => ({
        followers: cachedFollow?.followers ?? prev.followers,
        following: cachedFollow?.following ?? prev.following,
        posts: cachedPosts ?? prev.posts,
      }));
    }
    setStatsLoading(!(cachedFollow || cachedPosts !== null));
    Promise.all([getFollowCounts(profile.id), getPostsCount(profile.id)])
      .then(([followCounts, postsCount]) => {
        if (!active) return;
        setStats({ followers: followCounts.followers, following: followCounts.following, posts: postsCount });
      })
      .finally(() => {
        if (active) setStatsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [profile?.id]);

  const toggleLike = async (postId: string) => {
    const currentUserId = profile?.id ?? null;
    if (!currentUserId) {
      router.push("/auth/login");
      return;
    }
    if (likingPostIds.has(postId)) return;

    const targetPost = posts.find((p) => p.id === postId);
    if (!targetPost) return;

    const wasLiked = targetPost.likedByCurrentUser;
    const previousLikes = targetPost.likesCount;

    setLikingPostIds((prev) => new Set(prev).add(postId));
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? {
              ...p,
              likedByCurrentUser: !wasLiked,
              likesCount: Math.max(0, previousLikes + (wasLiked ? -1 : 1)),
            }
          : p,
      ),
    );

    try {
      const { error } = wasLiked
        ? await supabase.from("nreal_likes").delete().eq("post_id", postId).eq("user_id", currentUserId)
        : await supabase.from("nreal_likes").insert({ post_id: postId, user_id: currentUserId });
      if (error) throw error;
    } catch (err) {
      console.error("Toggle like failed", err);
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId ? { ...p, likedByCurrentUser: wasLiked, likesCount: previousLikes } : p,
        ),
      );
    } finally {
      setLikingPostIds((prev) => {
        const next = new Set(prev);
        next.delete(postId);
        return next;
      });
    }
  };

  const offsetBounds = useMemo(() => {
    const size = cropSize;
    const { w, h } = imageSize;
    if (!w || !h) return { maxX: 200, maxY: 200 };
    const baseScale = size / Math.max(w, h);
    const drawW = w * baseScale * cropZoom;
    const drawH = h * baseScale * cropZoom;
    const maxX = Math.max(0, (drawW - size) / 2);
    const maxY = Math.max(0, (drawH - size) / 2);
    return { maxX, maxY };
  }, [cropSize, imageSize, cropZoom]);

  const clampOffset = (value: number, axis: "x" | "y") => {
    const bounds = axis === "x" ? offsetBounds.maxX : offsetBounds.maxY;
    return Math.min(Math.max(value, -bounds), bounds);
  };

  const handleAvatarChange = (file?: File | null) => {
    setProfileMessage(null);
    setProfileError(null);
    if (!file) {
      setAvatarFile(null);
      setAvatarCroppedFile(null);
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    setAvatarFile(file);
    setAvatarCroppedFile(null);
    setAvatarPreview(objectUrl);
    setCropImageUrl(objectUrl);
    setCropZoom(1);
    setCropOffsetX(0);
    setCropOffsetY(0);
    setImageSize({ w: 0, h: 0 });
    setShowCropper(true);
  };

  const handleSaveProfile = async () => {
    if (!canEdit || savingProfile) return;
    setProfileError(null);
    setProfileMessage(null);
    setSavingProfile(true);

    const previousAvatar = profile?.avatar_url ?? null;
    let avatarUrl = profile?.avatar_url ?? null;

    if (avatarCroppedFile || avatarFile) {
      const fileToUpload = avatarCroppedFile ?? avatarFile;
      const uploaded = fileToUpload ? await uploadAvatar(fileToUpload) : null;
      if (uploaded) {
        avatarUrl = uploaded;
      } else {
        setProfileError("Nepodařilo se nahrát fotku.");
        setSavingProfile(false);
        return;
      }
    }

    const nextBio = bioInput.trim();
    if (nextBio && containsBlockedContent(nextBio).hit) {
      setProfileError("Životopis obsahuje nevhodný text.");
      setSavingProfile(false);
      return;
    }

    const updated = await updateCurrentProfile({
      bio: nextBio || null,
      avatarUrl,
      displayName: profile?.display_name ?? null,
      username: profile?.username ?? null,
    });

    if (!updated) {
      setProfileError("Profil se nepodařilo uložit.");
      setSavingProfile(false);
      return;
    }

    if (previousAvatar && avatarUrl && previousAvatar !== avatarUrl) {
      await deleteAvatarByUrl(previousAvatar);
    }

    setProfile({
      ...updated,
      bio: nextBio || null,
      avatar_url: avatarUrl,
    });

    setProfileMessage("Profil uložen.");
    setSavingProfile(false);
    setIsEditingProfile(false);
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-neutral-50 to-white pb-24">
      <section className="mx-auto w-full max-w-4xl px-4 py-8 space-y-6 sm:space-y-8 lg:max-w-6xl lg:py-12">
        <header className="flex flex-col gap-4 rounded-3xl border border-neutral-200 bg-white/90 p-4 shadow-sm backdrop-blur sm:flex-row sm:flex-wrap sm:items-start sm:justify-between sm:p-6">
          <div className="flex flex-wrap items-center gap-4 sm:gap-6">
            <label className="group relative h-16 w-16 cursor-pointer rounded-full bg-gradient-to-br from-rose-400 via-amber-300 to-orange-300 ring-4 ring-white transition hover:scale-[1.02] sm:h-20 sm:w-20">
              {avatarPreview ? (
                <img
                  src={avatarPreview}
                  alt="Avatar"
                  className="absolute inset-0 h-full w-full rounded-full object-cover"
                  onError={() => setAvatarPreview(null)}
                />
              ) : (
                <>
                  <span className="absolute inset-1 rounded-full bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.45),transparent_45%),radial-gradient(circle_at_70%_70%,rgba(255,255,255,0.3),transparent_45%)]" />
                  <span className="absolute inset-0 flex items-center justify-center text-xl font-semibold text-white">
                    NRW
                  </span>
                </>
              )}
              {isEditingProfile && (
                <input
                  type="file"
                  accept="image/*"
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                  onChange={(e) => handleAvatarChange(e.target.files?.[0] ?? null)}
                />
              )}
              {isEditingProfile && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 rounded-full bg-black/55 text-white opacity-0 transition group-hover:opacity-100">
                  <Camera className="h-5 w-5" />
                  <span className="text-[11px] font-semibold tracking-[0.14em] uppercase">Změnit</span>
                </div>
              )}
            </label>
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2 text-xl font-semibold text-neutral-900">
                <span>{displayName}</span>
                <div
                  className="relative inline-flex"
                  onMouseEnter={() => setShowVerificationInfo(true)}
                  onMouseLeave={() => setShowVerificationInfo(false)}
                  onFocus={() => setShowVerificationInfo(true)}
                  onBlur={() => setShowVerificationInfo(false)}
                >
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold ${
                      isVerified
                        ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                        : "bg-neutral-100 text-neutral-700 ring-1 ring-neutral-200"
                    }`}
                    tabIndex={0}
                    aria-label={isVerified ? "Ověřený profil" : "Neověřený profil"}
                  >
                    <BadgeCheck className="h-4 w-4" />
                    {isVerified ? verificationLabel : "Neověřeno"}
                  </span>
                  {isVerified && showVerificationInfo && (
                    <div className="absolute left-0 top-full z-20 mt-2 w-64 rounded-xl border border-neutral-200 bg-white p-3 text-[13px] text-neutral-700 shadow-lg">
                      <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-neutral-900">
                        <BadgeCheck className="h-4 w-4 text-emerald-600" />
                        Ověřený profil
                      </div>
                      <p>
                        Identita potvrzená v nID. Dostáváš prioritní ochranu a důvěryhodný štítek u obsahu.
                      </p>
                    </div>
                  )}
                </div>
              </div>
              <p className="text-sm text-neutral-600">{username}</p>
              <div className="flex flex-wrap items-center gap-3 text-xs font-semibold text-neutral-700">
                <span>{statsLoading ? "—" : stats.followers.toLocaleString("cs-CZ")} sledujících</span>
                <span>·</span>
                <span>{statsLoading ? "—" : stats.following.toLocaleString("cs-CZ")} sleduje</span>
                <span>·</span>
                <span>{statsLoading ? "—" : stats.posts.toLocaleString("cs-CZ")} postů</span>
              </div>
              <p className="text-sm text-neutral-700">{bioText}</p>
            </div>
          </div>
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            <button
              onClick={() => router.push("/settings")}
              className="flex-1 rounded-full border border-neutral-200 px-4 py-2 text-sm font-semibold text-neutral-900 transition hover:bg-neutral-100 sm:flex-none"
            >
              Upravit profil
            </button>
            <button className="rounded-full bg-neutral-900 px-4 py-2 text-sm font-semibold text-white transition hover:-translate-y-[1px]">
              Sdílet profil
            </button>
          </div>
        </header>

        {isEditingProfile && (
          <section className="rounded-2xl border border-neutral-200 bg-white/90 p-5 shadow-sm backdrop-blur">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold text-neutral-900">Upravit profil</h2>
                  <p className="text-sm text-neutral-600">Bio a fotka profilu</p>
                </div>
                <div className="text-xs text-neutral-500">{username}</div>
              </div>

            <div className="space-y-3">
              <label className="block space-y-2 text-sm text-neutral-700">
                <span className="font-semibold text-neutral-900">Bio</span>
                <textarea
                  rows={3}
                  value={bioInput}
                  onChange={(e) => setBioInput(e.target.value)}
                  className="w-full resize-none rounded-lg border border-neutral-200 px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-500 outline-none focus:border-neutral-400"
                  placeholder="Napiš něco o sobě..."
                />
              </label>

              <div className="flex items-center gap-3 text-sm text-neutral-700">
                <div className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold text-neutral-700">
                  Fotka profilu
                </div>
                <span className="text-xs text-neutral-500">Klikni na avatar nahoře pro změnu</span>
              </div>

              {profileError && (
                <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{profileError}</div>
              )}
              {profileMessage && (
                <div className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{profileMessage}</div>
              )}

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsEditingProfile(false)}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-neutral-700 transition hover:text-neutral-900"
                >
                  Zavřít
                </button>
                <button
                  type="button"
                  disabled={savingProfile}
                  onClick={handleSaveProfile}
                  className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-80"
                >
                  {savingProfile ? "Ukládám…" : "Uložit profil"}
                </button>
              </div>
            </div>
          </section>
        )}

        {showCropper && cropImageUrl && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
            <div className="w-full max-w-3xl rounded-2xl border border-neutral-200 bg-white p-4 shadow-xl">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-semibold text-neutral-900">Upravit fotku</h3>
                  <p className="text-sm text-neutral-600">Přibliž, posuň, ulož ořez.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCropper(false)}
                  className="rounded-full p-2 text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-900"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="grid gap-4 lg:grid-cols-[1fr_260px]">
                <div
                  ref={previewRef}
                  className="relative mx-auto aspect-square w-full max-w-2xl overflow-hidden rounded-full border border-neutral-200 bg-neutral-950 touch-none"
                  onPointerDown={(e) => {
                    e.preventDefault();
                    panStart.current = { x: e.clientX, y: e.clientY };
                    offsetStart.current = { x: cropOffsetX, y: cropOffsetY };
                    setIsPanning(true);
                  }}
                  onPointerMove={(e) => {
                    if (!isPanning) return;
                    e.preventDefault();
                    const dx = e.clientX - panStart.current.x;
                    const dy = e.clientY - panStart.current.y;
                    setCropOffsetX(clampOffset(offsetStart.current.x + dx, "x"));
                    setCropOffsetY(clampOffset(offsetStart.current.y + dy, "y"));
                  }}
                  onPointerUp={() => setIsPanning(false)}
                  onPointerLeave={() => setIsPanning(false)}
                >
                  <img
                    ref={imageRef}
                    src={cropImageUrl}
                    alt="Crop preview"
                    className="absolute inset-0 h-full w-full object-contain"
                    style={{
                      transform: `translate(${cropOffsetX}px, ${cropOffsetY}px) scale(${cropZoom})`,
                      transformOrigin: "center",
                    }}
                    onLoad={(e) => {
                    const img = e.currentTarget;
                    const naturalW = img.naturalWidth || img.width;
                    const naturalH = img.naturalHeight || img.height;
                    setImageSize({ w: naturalW, h: naturalH });
                    const containerSize = previewRef.current?.clientWidth ?? 600;
                    setCropSize(containerSize);
                    setCropOffsetX((prev) => clampOffset(prev, "x"));
                    setCropOffsetY((prev) => clampOffset(prev, "y"));
                    }}
                  />
                  <div className="pointer-events-none absolute inset-0 rounded-full border border-white/40">
                    <div className="absolute inset-0 grid grid-cols-3 grid-rows-3">
                      {Array.from({ length: 9 }).map((_, idx) => (
                        <span key={idx} className="border border-white/15" />
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="block space-y-1 text-sm">
                    <span className="font-semibold text-neutral-900">Zoom</span>
                    <input
                      type="range"
                      min={1}
                      max={3}
                      step={0.01}
                      value={cropZoom}
                      onChange={(e) => {
                        const next = Number(e.target.value);
                        setCropZoom(next);
                        setCropOffsetX((prev) => clampOffset(prev, "x"));
                        setCropOffsetY((prev) => clampOffset(prev, "y"));
                      }}
                      className="w-full"
                    />
                  </label>

                  <p className="text-xs text-neutral-500">Fotku můžeš chytit a posunout myší/prstem.</p>

                  <div className="flex items-center gap-3 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setCropZoom(1);
                        setCropOffsetX(0);
                        setCropOffsetY(0);
                      }}
                      className="rounded-lg border border-neutral-200 px-3 py-2 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-100"
                    >
                      Reset
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        if (!imageRef.current) return;
                        const img = imageRef.current;
                        const canvas = document.createElement("canvas");
                        const size = cropSize || 600;
                        canvas.width = size;
                        canvas.height = size;
                        const ctx = canvas.getContext("2d");
                        if (!ctx) return;

                        const naturalW = img.naturalWidth || img.width;
                        const naturalH = img.naturalHeight || img.height;
                        const baseScale = size / Math.max(naturalW, naturalH);
                        const scale = baseScale * cropZoom;
                        const drawW = naturalW * scale;
                        const drawH = naturalH * scale;
                        const drawX = (size - drawW) / 2 + cropOffsetX;
                        const drawY = (size - drawH) / 2 + cropOffsetY;

                        ctx.clearRect(0, 0, size, size);
                        ctx.save();
                        ctx.beginPath();
                        ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
                        ctx.closePath();
                        ctx.clip();
                        ctx.drawImage(img, drawX, drawY, drawW, drawH);
                        ctx.restore();

                        canvas.toBlob((blob) => {
                          if (!blob) return;
                          const file = new File([blob], "avatar-crop.png", { type: "image/png" });
                          setAvatarCroppedFile(file);
                          const objectUrl = URL.createObjectURL(file);
                          setAvatarPreview(objectUrl);
                          setShowCropper(false);
                        }, "image/png");
                      }}
                      className="rounded-lg bg-neutral-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800"
                    >
                      Uložit ořez
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-6">
            <ProfileStories />
            <ProfileTabs />
            <InstagramGrid />
            <TwitterFeed
              displayName={displayName}
              posts={posts}
              loading={postsLoading}
              sanitizeVerificationLabel={sanitizeVerificationLabel}
              currentUserId={profile?.id ?? null}
              currentUserProfile={profile}
              onToggleLike={toggleLike}
              likeDisabled={likingPostIds}
            />
          </div>

          <aside className="space-y-3 lg:sticky lg:top-10 lg:max-h-[calc(100vh-120px)] lg:overflow-y-auto lg:pr-1">
            <Widget title="Highlighy">
              <Highlights />
            </Widget>
            <Widget title="Trending témata">
              <TwitterHighlights />
            </Widget>
            <Widget title="Společné zájmy">
              <Interests />
            </Widget>
            <Widget title="Linky">
              <Links />
            </Widget>
          </aside>
        </div>
      </section>
    </main>
  );
}

function ProfileStories() {
  const stories = [
    { id: "s1", label: "Crew", color: "from-rose-400 via-orange-300 to-amber-200" },
    { id: "s2", label: "Events", color: "from-indigo-400 via-blue-300 to-cyan-200" },
    { id: "s3", label: "nLove", color: "from-fuchsia-400 via-pink-300 to-rose-200" },
    { id: "s4", label: "Rooms", color: "from-emerald-400 via-teal-300 to-cyan-200" },
  ];
  return (
    <div className="flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
      {stories.map((story) => (
        <div
          key={story.id}
          className="flex w-28 shrink-0 flex-col items-center gap-2 rounded-xl border border-neutral-200 bg-white p-3 shadow-sm"
        >
          <div className={`h-16 w-16 rounded-full bg-gradient-to-br ${story.color} ring-2 ring-white shadow`} />
          <span className="text-xs font-semibold text-neutral-800">{story.label}</span>
        </div>
      ))}
      <button className="flex w-28 shrink-0 flex-col items-center gap-2 rounded-xl border border-dashed border-neutral-300 bg-neutral-50 p-3 text-xs font-semibold text-neutral-600 transition hover:border-neutral-400 hover:text-neutral-900">
        + Highlight
      </button>
    </div>
  );
}

function ProfileTabs() {
  const tabs = [
    { id: "posts", label: "Příspěvky" },
    { id: "reels", label: "Klipy" },
    { id: "tags", label: "Označení" },
    { id: "threads", label: "Vlákna" },
  ];
  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1 text-sm font-semibold text-neutral-700 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
      {tabs.map((tab, idx) => {
        const isActive = idx === 0;
        return (
          <button
            key={tab.id}
            className={`rounded-full border px-4 py-2 transition ${
              isActive
                ? "border-neutral-900 bg-neutral-900 text-white"
                : "border-neutral-200 bg-white hover:border-neutral-300"
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

function InstagramGrid() {
  return (
    <div className="rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold text-neutral-900">Foto grid</h2>
        <button className="rounded-full px-3 py-1 text-xs font-semibold text-neutral-600 transition hover:bg-neutral-100">
          Archiv
        </button>
      </div>

      <div className="grid grid-cols-3 gap-1 overflow-hidden rounded-2xl border border-neutral-100 sm:gap-2">
        {media.map((item) => (
          <div
            key={item.id}
            className="group relative aspect-square overflow-hidden bg-neutral-100"
          >
            <div className={`absolute inset-0 bg-gradient-to-br ${item.gradient}`} />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.28),transparent_42%),radial-gradient(circle_at_80%_70%,rgba(255,255,255,0.22),transparent_38%)] mix-blend-screen" />
            <div className="absolute inset-0 bg-black/0 transition group-hover:bg-black/10" />
          </div>
        ))}
      </div>
    </div>
  );
}

function TwitterFeed({
  displayName,
  posts,
  loading,
  sanitizeVerificationLabel,
  currentUserId,
  currentUserProfile,
  onToggleLike,
  likeDisabled,
}: {
  displayName: string;
  posts: NrealPost[];
  loading: boolean;
  sanitizeVerificationLabel: (value: string | null | undefined) => string | null;
  currentUserId: string | null;
  currentUserProfile: Profile | null;
  onToggleLike: (postId: string) => void;
  likeDisabled: Set<string>;
}) {
  const [showAll, setShowAll] = useState(false);

  const hasPosts = posts.length > 0;
  const visiblePosts = showAll ? posts : posts.slice(0, 3);

  return (
    <div className="rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-neutral-900">Krátké posty</h2>
        {hasPosts ? (
          <button
            className="rounded-full px-3 py-1 text-xs font-semibold text-neutral-600 transition hover:bg-neutral-100"
            onClick={() => setShowAll((prev) => !prev)}
          >
            {showAll ? "Skrýt" : "Zobrazit všechno"}
          </button>
        ) : null}
      </div>
      <div className="space-y-4">
        {loading ? (
          <div className="py-3 text-sm text-neutral-600">Načítám příspěvky…</div>
        ) : hasPosts ? (
          visiblePosts.map((post) => {
            const author = post.profiles?.[0] ?? null;
            const authorName = author?.display_name || author?.username || displayName;
            const authorUsername = author?.username ? `@${author.username}` : null;
            const verificationLabel =
              author?.verified ? sanitizeVerificationLabel(author.verification_label) || "Ověřený profil" : null;

            return (
              <PostCard
                key={post.id}
                postId={post.id}
                postUserId={post.user_id}
                isDeleted={post.is_deleted ?? null}
                author={{
                  displayName: authorName,
                  username: authorUsername,
                  avatarUrl: author?.avatar_url ?? null,
                  isCurrentUser: Boolean(currentUserId && post.user_id === currentUserId),
                  verified: Boolean(author?.verified),
                  verificationLabel,
                }}
                content={post.content ?? ""}
                createdAt={post.created_at}
                status={post.status}
                mediaUrl={post.media_url ?? null}
                mediaType={post.media_type ?? null}
                likesCount={post.likesCount ?? 0}
                likedByCurrentUser={post.likedByCurrentUser ?? false}
                commentsCount={post.commentsCount ?? 0}
                onToggleLike={onToggleLike}
                likeDisabled={likeDisabled.has(post.id)}
                currentUserProfile={currentUserProfile}
              />
            );
          })
        ) : (
          <div className="py-3 text-sm text-neutral-600">Zatím nemáš žádné příspěvky.</div>
        )}        
      </div>
    </div>
  );
}

function Widget({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white/90 p-4 shadow-sm backdrop-blur">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-neutral-900">{title}</h3>
        <span className="text-[11px] uppercase tracking-[0.14em] text-neutral-400">ID</span>
      </div>
      {children}
    </div>
  );
}

function Highlights() {
  const list = [
    { id: "h1", title: "Letná run", meta: "12k zhlédnutí" },
    { id: "h2", title: "NRW meetup #4", meta: "9.2k zhlédnutí" },
    { id: "h3", title: "Studio live", meta: "7.4k zhlédnutí" },
  ];
  return (
    <div className="space-y-2 text-sm text-neutral-700">
      {list.map((item) => (
        <div
          key={item.id}
          className="flex items-center justify-between rounded-lg border border-neutral-100 bg-neutral-50 px-3 py-2"
        >
          <div>
            <div className="font-semibold text-neutral-900">{item.title}</div>
            <div className="text-[11px] text-neutral-500">{item.meta}</div>
          </div>
          <button className="rounded-full px-3 py-1 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-900 hover:text-white">
            Přehrát
          </button>
        </div>
      ))}
    </div>
  );
}

function TwitterHighlights() {
  const topics = [
    { id: "th1", tag: "#nrw", stat: "trending" },
    { id: "th2", tag: "#nReal", stat: "1.2k tweetů" },
    { id: "th3", tag: "#rooms", stat: "620 tweetů" },
  ];
  return (
    <div className="space-y-2 text-sm text-neutral-700">
      {topics.map((topic) => (
        <div
          key={topic.id}
          className="flex items-center justify-between rounded-lg border border-neutral-100 bg-gradient-to-r from-slate-50 to-white px-3 py-2"
        >
          <div>
            <div className="font-semibold text-neutral-900">{topic.tag}</div>
            <div className="text-[11px] text-neutral-500">{topic.stat}</div>
          </div>
          <button className="rounded-full border border-neutral-200 px-3 py-1 text-xs font-semibold text-neutral-900 transition hover:bg-neutral-900 hover:text-white">
            Sledovat
          </button>
        </div>
      ))}
    </div>
  );
}

function Interests() {
  const interests = ["Foto", "Koncerty", "Produkce", "AI", "nLove", "Meetups"];
  return (
    <div className="flex flex-wrap gap-2 text-xs font-semibold text-neutral-700">
      {interests.map((interest) => (
        <span key={interest} className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1">
          {interest}
        </span>
      ))}
    </div>
  );
}

function Links() {
  const links = [
    { id: "ln1", label: "nReal Talks #12", url: "nrw.link/talks12" },
    { id: "ln2", label: "nLove beta room", url: "nrw.link/love" },
    { id: "ln3", label: "NRW Discord", url: "nrw.link/discord" },
  ];
  return (
    <div className="space-y-2 text-sm text-neutral-700">
      {links.map((link) => (
        <div
          key={link.id}
          className="flex items-center justify-between rounded-lg border border-neutral-100 bg-neutral-50 px-3 py-2"
        >
          <div>
            <div className="font-semibold text-neutral-900">{link.label}</div>
            <div className="text-[11px] text-neutral-500">{link.url}</div>
          </div>
          <button className="rounded-full px-3 py-1 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-900 hover:text-white">
            Otevřít
          </button>
        </div>
      ))}
    </div>
  );
}
