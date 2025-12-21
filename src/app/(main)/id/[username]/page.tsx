/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { BadgeCheck } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
<<<<<<< HEAD
import { safeIdentityLabel } from "@/lib/content-filter";
import { follow, getFollowCounts, getPostsCount, isFollowing, unfollow } from "@/lib/follows";
import type { Profile } from "@/lib/profiles";
=======
import { follow, getFollowCounts, getPostsCount, isFollowing, peekFollowCounts, peekPostsCount, unfollow } from "@/lib/follows";
import { fetchCurrentProfile, getCachedProfile, type Profile } from "@/lib/profiles";
>>>>>>> origin/main
import type { NrealPost, NrealProfile } from "@/types/nreal";
import { PostCard } from "../../real/PostCard";

function toUsernameParam(value: string) {
  return decodeURIComponent(value).trim().replace(/^@+/, "");
}

function formatCount(value: number) {
  return value.toLocaleString("cs-CZ");
}

const PROFILE_CACHE_TTL_MS = 60000;
const profileCache = new Map<string, { profile: Profile; fetchedAt: number }>();

export default function PublicProfilePage() {
  const params = useParams<{ username: string }>();
  const router = useRouter();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);

  const usernameParam = toUsernameParam(params?.username ?? "");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserProfile, setCurrentUserProfile] = useState<Profile | null>(null);
  const [counts, setCounts] = useState<{ posts: number; followers: number; following: number }>({
    posts: 0,
    followers: 0,
    following: 0,
  });

  const [posts, setPosts] = useState<NrealPost[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [postsError, setPostsError] = useState<string | null>(null);
  const [showAllPosts, setShowAllPosts] = useState(false);
  const [likingPostIds, setLikingPostIds] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<"posts" | "reels" | "tags" | "threads">("posts");

  const [following, setFollowing] = useState<boolean>(false);
  const [followBusy, setFollowBusy] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const cachedEntry = profileCache.get(usernameParam);
      const currentCached = getCachedProfile();
      const cachedProfile =
        (cachedEntry && Date.now() - cachedEntry.fetchedAt < PROFILE_CACHE_TTL_MS ? cachedEntry.profile : null) ??
        (currentCached && currentCached.username === usernameParam ? currentCached : null);
      if (cachedProfile) {
        setProfile(cachedProfile);
        const cachedFollow = peekFollowCounts(cachedProfile.id);
        const cachedPosts = peekPostsCount(cachedProfile.id);
        if (cachedFollow || cachedPosts !== null) {
          setCounts((prev) => ({
            posts: cachedPosts ?? prev.posts,
            followers: cachedFollow?.followers ?? prev.followers,
            following: cachedFollow?.following ?? prev.following,
          }));
        }
      }
      setLoading(!cachedProfile);
      setError(null);

      const [{ data: authData }, { data: profileData, error: profileError }] = await Promise.all([
        supabase.auth.getUser(),
        supabase.from("profiles").select("*").eq("username", usernameParam).maybeSingle<Profile>(),
      ]);

      if (!active) return;

      const uid = authData?.user?.id ?? null;
      setCurrentUserId(uid);
      if (uid) {
        const viewerProfile = await fetchCurrentProfile();
        if (active) setCurrentUserProfile(viewerProfile);
      } else {
        setCurrentUserProfile(null);
      }

      if (profileError) {
        setError(profileError.message);
        setProfile(null);
        setLoading(false);
        return;
      }

      if (!profileData) {
        setError("Profil nenalezen.");
        setProfile(null);
        setLoading(false);
        return;
      }

      setProfile(profileData);
      profileCache.set(usernameParam, { profile: profileData, fetchedAt: Date.now() });

      const cachedFollow = peekFollowCounts(profileData.id);
      const cachedPosts = peekPostsCount(profileData.id);
      if (cachedFollow || cachedPosts !== null) {
        setCounts((prev) => ({
          posts: cachedPosts ?? prev.posts,
          followers: cachedFollow?.followers ?? prev.followers,
          following: cachedFollow?.following ?? prev.following,
        }));
      }

      if (profileData.banned_at) {
        setCounts({ posts: 0, followers: 0, following: 0 });
        setFollowing(false);
        setPosts([]);
        setPostsError(null);
        setPostsLoading(false);
        setLoading(false);
        return;
      }

      const [posts, followCounts, isF] = await Promise.all([
        getPostsCount(profileData.id),
        getFollowCounts(profileData.id),
        uid ? isFollowing({ followerId: uid, followingId: profileData.id }) : Promise.resolve(false),
      ]);

      if (!active) return;
      setCounts({ posts, followers: followCounts.followers, following: followCounts.following });
      setFollowing(isF);
      setLoading(false);
    };

    void load();
    return () => {
      active = false;
    };
  }, [supabase, usernameParam]);

  const isOwnProfile = Boolean(currentUserId && profile?.id && currentUserId === profile.id);
  const isBannedProfile = Boolean(profile?.banned_at);

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
    if (!profile?.id || profile?.banned_at) {
      setPosts([]);
      setPostsError(null);
      setPostsLoading(false);
      return;
    }
    let active = true;
    const loadPosts = async () => {
      setPostsLoading(true);
      setPostsError(null);

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
        .eq("user_id", profile.id)
        .eq("is_deleted", false);

      const isOwnPostView = Boolean(currentUserId && profile?.id && currentUserId === profile.id);
      if (!isOwnPostView) {
        query = query.or("status.eq.approved,status.is.null");
      }

      const { data, error } = await query.order("created_at", { ascending: false }).limit(30);

      if (!active) return;

      if (error) {
        setPostsError(error.message);
        setPosts([]);
        setPostsLoading(false);
        return;
      }

      const normalized = ((data as SupabasePost[] | null) ?? []).map((p) => normalizePost(p));
      const postIds = normalized.map((p) => p.id);
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

      const withCounts = normalized.map((p) => ({
        ...p,
        likesCount: likesCountMap[p.id] ?? 0,
        likedByCurrentUser: likedPostIds.has(p.id),
        commentsCount: commentsCountMap[p.id] ?? 0,
      }));

      setPosts(withCounts.filter((p) => !p.is_deleted));
      setPostsLoading(false);
    };

    void loadPosts();
    return () => {
      active = false;
    };
  }, [currentUserId, profile?.id, supabase]);

  const toggleLike = async (postId: string) => {
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
          ? { ...p, likedByCurrentUser: !wasLiked, likesCount: Math.max(0, previousLikes + (wasLiked ? -1 : 1)) }
          : p,
      ),
    );

    try {
      const { error } = wasLiked
        ? await supabase.from("nreal_likes").delete().eq("post_id", postId).eq("user_id", currentUserId)
        : await supabase.from("nreal_likes").insert({ post_id: postId, user_id: currentUserId });
      if (error) throw error;
    } catch (e) {
      console.error("Toggle like failed", e);
      setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, likedByCurrentUser: wasLiked, likesCount: previousLikes } : p)));
    } finally {
      setLikingPostIds((prev) => {
        const next = new Set(prev);
        next.delete(postId);
        return next;
      });
    }
  };

  const handleToggleFollow = async () => {
    if (!profile || !currentUserId || followBusy) return;
    if (isOwnProfile) return;

    const prev = following;
    const next = !prev;
    setFollowBusy(true);
    setFollowing(next);
    setCounts((c) => ({ ...c, followers: Math.max(0, c.followers + (next ? 1 : -1)) }));

    try {
      if (next) {
        await follow({ followerId: currentUserId, followingId: profile.id });
        setToast({ type: "success", message: "Sleduješ uživatele." });
      } else {
        await unfollow({ followerId: currentUserId, followingId: profile.id });
        setToast({ type: "success", message: "Přestal(a) jsi sledovat." });
      }
    } catch (e) {
      console.error("Follow toggle failed", e);
      setFollowing(prev);
      setCounts((c) => ({ ...c, followers: Math.max(0, c.followers + (prev ? 1 : -1)) }));
      setToast({ type: "error", message: "Akce se nepovedla. Zkus to prosím znovu." });
    } finally {
      setFollowBusy(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-neutral-50 to-white pb-24">
      <section className="mx-auto w-full max-w-4xl px-4 py-8 space-y-6 sm:space-y-8 lg:max-w-6xl lg:py-12">
        <header className="rounded-3xl border border-neutral-200 bg-white/90 p-4 shadow-sm backdrop-blur sm:p-6">
          {loading ? (
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="h-20 w-20 animate-pulse rounded-full bg-neutral-200" />
                <div className="space-y-2 pt-1">
                  <div className="h-6 w-56 animate-pulse rounded bg-neutral-200" />
                  <div className="h-4 w-40 animate-pulse rounded bg-neutral-200" />
                  <div className="h-4 w-72 animate-pulse rounded bg-neutral-200" />
                </div>
              </div>
              <div className="h-10 w-28 animate-pulse rounded-full bg-neutral-200" />
            </div>
          ) : error ? (
            <div className="text-sm text-red-700">{error}</div>
          ) : !profile ? (
            <div className="text-sm text-neutral-600">Profil nenalezen.</div>
          ) : isBannedProfile ? (
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-4">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-neutral-200 text-sm font-semibold text-neutral-600">
                  NRW
                </div>
                <div className="space-y-1">
                  <h1 className="text-xl font-semibold text-neutral-900">
                    Tento účet byl smazán nebo deaktivován
                  </h1>
                  <p className="text-sm text-neutral-600">Profil není veřejně dostupný.</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex min-w-0 items-start gap-4">
                <div className="relative h-20 w-20 overflow-hidden rounded-full ring-2 ring-neutral-200">
                  {profile.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt="Avatar"
                      className="h-full w-full object-cover"
                      onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")}
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-neutral-200 to-neutral-100 text-lg font-semibold text-neutral-700">
                      {safeIdentityLabel(
                        profile.display_name,
                        safeIdentityLabel(profile.username, "NRW"),
                      )
                        .slice(0, 2)
                        .toUpperCase()}
                    </div>
                  )}
                </div>

                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="truncate text-2xl font-semibold tracking-tight text-neutral-900">
                      {safeIdentityLabel(
                        profile.display_name,
                        safeIdentityLabel(profile.username, "Uživatel"),
                      )}
                    </h1>
                    {profile.verified ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-200">
                        <BadgeCheck className="h-3.5 w-3.5" />
                        {profile.verification_label || "NRW Verified"}
                      </span>
                    ) : null}
                  </div>

                  <div className="truncate text-sm text-neutral-600">
                    @{safeIdentityLabel(profile.username, usernameParam)}
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-sm font-semibold text-neutral-700">
                    <span className="whitespace-nowrap">{formatCount(counts.followers)} sledujících</span>
                    <span className="whitespace-nowrap">· {formatCount(counts.following)} sleduje</span>
                    <span className="whitespace-nowrap">· {formatCount(counts.posts)} postů</span>
                  </div>

                  <p className="max-w-2xl text-sm text-neutral-700">{profile.bio?.trim() ? profile.bio : "—"}</p>
                </div>
              </div>

              <div className="ml-auto flex items-center justify-end gap-2">
                {currentUserId && isOwnProfile ? (
                  <Link
                    href="/id"
                    className="rounded-full border border-neutral-200 bg-white px-5 py-2 text-sm font-semibold text-neutral-900 shadow-sm transition hover:bg-neutral-50"
                  >
                    Upravit profil
                  </Link>
                ) : currentUserId ? (
                  <button
                    type="button"
                    disabled={followBusy}
                    onClick={handleToggleFollow}
                    className={`rounded-full px-5 py-2 text-sm font-semibold shadow-sm transition disabled:cursor-not-allowed disabled:opacity-70 ${
                      following
                        ? "border border-neutral-200 bg-white text-neutral-900 hover:bg-neutral-50"
                        : "bg-neutral-900 text-white hover:bg-neutral-800"
                    }`}
                  >
                    {following ? "Sleduji" : "Sledovat"}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => router.push("/auth/login")}
                    className="rounded-full bg-neutral-900 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-neutral-800"
                  >
                    Přihlásit se
                  </button>
                )}
              </div>
            </div>
          )}
        </header>

        <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-6">
<<<<<<< HEAD
            <ProfileStories canAdd={isOwnProfile} />
            <ProfileTabs activeTab={activeTab} onChange={setActiveTab} />

            {activeTab === "posts" ? (
              <>
                <PhotoGrid
                  items={posts
                    .filter((p) => Boolean(p.media_url))
                    .slice(0, 9)
                    .map((p) => ({
                      id: p.id,
                      url: p.media_url as string,
                      type: (p.media_type as "image" | "video" | null) ?? "image",
                    }))}
                />

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-neutral-900">Krátké posty</h2>
                    {posts.length > 0 ? (
                      <button
                        type="button"
                        onClick={() => setShowAllPosts((p) => !p)}
                        className="rounded-full px-3 py-1 text-xs font-semibold text-neutral-600 transition hover:bg-neutral-100"
                      >
                        {showAllPosts ? "Skrýt" : "Zobrazit všechno"}
                      </button>
                    ) : null}
                  </div>

                  {postsError ? (
                    <div className="rounded-3xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 shadow-sm">
                      Nepodařilo se načíst příspěvky: {postsError}
                    </div>
                  ) : null}

                  {postsLoading ? (
                    <div className="rounded-3xl border border-neutral-200 bg-white p-4 text-sm text-neutral-600 shadow-sm">
                      Načítám příspěvky…
                    </div>
                  ) : posts.length === 0 ? (
                    <div className="rounded-3xl border border-neutral-200 bg-white p-4 text-sm text-neutral-600 shadow-sm">
                      Zatím žádné příspěvky.
                    </div>
                  ) : (
                    (showAllPosts ? posts : posts.slice(0, 3)).map((post) => {
                      const author = post.profiles?.[0] ?? null;
                      const safeUsername = safeIdentityLabel(author?.username ?? null, "");
                      const authorName = safeIdentityLabel(
                        author?.display_name ?? null,
                        safeUsername || safeIdentityLabel(profile?.display_name ?? null, "NRW uživatel"),
                      );
                      const authorUsername = safeUsername ? `@${safeUsername}` : null;
                      const verificationLabel = author?.verified
                        ? author?.verification_label || "NRW Verified"
                        : null;
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
                          mediaUrl={post.media_url ?? null}
                          mediaType={post.media_type ?? null}
                          likesCount={post.likesCount ?? 0}
                          likedByCurrentUser={post.likedByCurrentUser ?? false}
                          commentsCount={post.commentsCount ?? 0}
                          onToggleLike={toggleLike}
                          likeDisabled={likingPostIds.has(post.id)}
                          currentUserProfile={currentUserProfile}
                        />
                      );
                    })
                  )}
                </div>
              </>
            ) : (
=======
            {isBannedProfile ? (
>>>>>>> origin/main
              <div className="rounded-3xl border border-neutral-200 bg-white p-4 text-sm text-neutral-600 shadow-sm">
                Tento účet byl smazán nebo deaktivován. Obsah profilu není dostupný.
              </div>
            ) : (
              <>
                <ProfileStories canAdd={isOwnProfile} />
                <ProfileTabs activeTab={activeTab} onChange={setActiveTab} />

                {activeTab === "posts" ? (
                  <>
                    <PhotoGrid
                      items={posts
                        .filter((p) => Boolean(p.media_url))
                        .slice(0, 9)
                        .map((p) => ({
                          id: p.id,
                          url: p.media_url as string,
                          type: (p.media_type as "image" | "video" | null) ?? "image",
                        }))}
                    />

                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h2 className="text-sm font-semibold text-neutral-900">Krátké posty</h2>
                        {posts.length > 0 ? (
                          <button
                            type="button"
                            onClick={() => setShowAllPosts((p) => !p)}
                            className="rounded-full px-3 py-1 text-xs font-semibold text-neutral-600 transition hover:bg-neutral-100"
                          >
                            {showAllPosts ? "Skrýt" : "Zobrazit všechno"}
                          </button>
                        ) : null}
                      </div>

                      {postsError ? (
                        <div className="rounded-3xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 shadow-sm">
                          Nepodařilo se načíst příspěvky: {postsError}
                        </div>
                      ) : null}

                      {postsLoading ? (
                        <div className="rounded-3xl border border-neutral-200 bg-white p-4 text-sm text-neutral-600 shadow-sm">
                          Načítám příspěvky…
                        </div>
                      ) : posts.length === 0 ? (
                        <div className="rounded-3xl border border-neutral-200 bg-white p-4 text-sm text-neutral-600 shadow-sm">
                          Zatím žádné příspěvky.
                        </div>
                      ) : (
                        (showAllPosts ? posts : posts.slice(0, 3)).map((post) => {
                          const author = post.profiles?.[0] ?? null;
                          const authorName =
                            author?.display_name || author?.username || profile?.display_name || "NRW uživatel";
                          const authorUsername = author?.username ? `@${author.username}` : null;
                          const verificationLabel = author?.verified
                            ? author?.verification_label || "NRW Verified"
                            : null;
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
                              onToggleLike={toggleLike}
                              likeDisabled={likingPostIds.has(post.id)}
                              currentUserProfile={currentUserProfile}
                            />
                          );
                        })
                      )}
                    </div>
                  </>
                ) : (
                  <div className="rounded-3xl border border-neutral-200 bg-white p-4 text-sm text-neutral-600 shadow-sm">
                    {activeTab === "reels"
                      ? "Klipy se zobrazí brzy."
                      : activeTab === "tags"
                        ? "Označené příspěvky se zobrazí brzy."
                        : "Vlákna se zobrazí brzy."}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </section>

      {toast ? (
        <div
          className={`fixed bottom-4 right-4 z-50 rounded-full px-4 py-2 text-sm font-semibold text-white shadow-lg ${
            toast.type === "success" ? "bg-emerald-600" : "bg-red-600"
          }`}
        >
          {toast.message}
        </div>
      ) : null}
    </main>
  );
}

function ProfileStories({ canAdd }: { canAdd: boolean }) {
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
      {canAdd ? (
        <button
          type="button"
          className="flex w-28 shrink-0 flex-col items-center gap-2 rounded-xl border border-dashed border-neutral-300 bg-neutral-50 p-3 text-xs font-semibold text-neutral-600 transition hover:border-neutral-400 hover:text-neutral-900"
        >
          + Highlight
        </button>
      ) : null}
    </div>
  );
}

function ProfileTabs({
  activeTab,
  onChange,
}: {
  activeTab: "posts" | "reels" | "tags" | "threads";
  onChange: (tab: "posts" | "reels" | "tags" | "threads") => void;
}) {
  const tabs: Array<{ id: "posts" | "reels" | "tags" | "threads"; label: string }> = [
    { id: "posts", label: "Příspěvky" },
    { id: "reels", label: "Klipy" },
    { id: "tags", label: "Označení" },
    { id: "threads", label: "Vlákna" },
  ];
  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1 text-sm font-semibold text-neutral-700 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
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

function PhotoGrid({ items }: { items: Array<{ id: string; url: string; type: "image" | "video" | null }> }) {
  return (
    <div className="rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold text-neutral-900">Foto grid</h2>
        <button
          type="button"
          className="rounded-full px-3 py-1 text-xs font-semibold text-neutral-600 transition hover:bg-neutral-100"
        >
          Archiv
        </button>
      </div>

      <div className="grid grid-cols-3 gap-1 overflow-hidden rounded-2xl border border-neutral-100 sm:gap-2">
        {(items.length ? items : Array.from({ length: 9 }).map((_, i) => ({ id: `ph-${i}`, url: "", type: null }))).map(
          (item) => (
            <div key={item.id} className="group relative aspect-square overflow-hidden bg-neutral-100">
              {item.url ? (
                item.type === "video" ? (
                  <video
                    src={item.url}
                    muted
                    playsInline
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                ) : (
                  <img src={item.url} alt="" className="absolute inset-0 h-full w-full object-cover" />
                )
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-neutral-100 via-white to-neutral-200" />
              )}
              <div className="absolute inset-0 bg-black/0 transition group-hover:bg-black/10" />
            </div>
          ),
        )}
      </div>
    </div>
  );
}
