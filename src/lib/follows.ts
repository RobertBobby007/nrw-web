"use client";

import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

const COUNTS_CACHE_TTL_MS = 30000;
const followCountsCache = new Map<string, { followers: number; following: number; fetchedAt: number }>();
const postsCountCache = new Map<string, { count: number; fetchedAt: number }>();

export function peekFollowCounts(profileId: string): { followers: number; following: number } | null {
  const cached = followCountsCache.get(profileId);
  if (!cached) return null;
  if (Date.now() - cached.fetchedAt > COUNTS_CACHE_TTL_MS) return null;
  return { followers: cached.followers, following: cached.following };
}

export function peekPostsCount(profileId: string): number | null {
  const cached = postsCountCache.get(profileId);
  if (!cached) return null;
  if (Date.now() - cached.fetchedAt > COUNTS_CACHE_TTL_MS) return null;
  return cached.count;
}

function cacheFollowCounts(profileId: string, counts: { followers: number; following: number }) {
  followCountsCache.set(profileId, { ...counts, fetchedAt: Date.now() });
}

function cachePostsCount(profileId: string, count: number) {
  postsCountCache.set(profileId, { count, fetchedAt: Date.now() });
}

function invalidateFollowCaches(profileIds: string[]) {
  profileIds.forEach((id) => {
    followCountsCache.delete(id);
  });
}

export async function isFollowing(params: { followerId: string; followingId: string }): Promise<boolean> {
  const supabase = getSupabaseBrowserClient();
  const { followerId, followingId } = params;
  const { count, error } = await supabase
    .from("follows")
    .select("*", { count: "exact", head: true })
    .eq("follower_id", followerId)
    .eq("following_id", followingId);

  if (error) {
    console.error("isFollowing error", error);
    return false;
  }

  return (count ?? 0) > 0;
}

export async function follow(params: { followerId: string; followingId: string }): Promise<void> {
  const supabase = getSupabaseBrowserClient();
  const { followerId, followingId } = params;
  const { error } = await supabase.from("follows").insert({
    follower_id: followerId,
    following_id: followingId,
  });

  if (error) throw error;
  invalidateFollowCaches([followerId, followingId]);
}

export async function unfollow(params: { followerId: string; followingId: string }): Promise<void> {
  const supabase = getSupabaseBrowserClient();
  const { followerId, followingId } = params;
  const { error } = await supabase
    .from("follows")
    .delete()
    .eq("follower_id", followerId)
    .eq("following_id", followingId);

  if (error) throw error;
  invalidateFollowCaches([followerId, followingId]);
}

export async function getFollowCounts(profileId: string): Promise<{ followers: number; following: number }> {
  const cached = peekFollowCounts(profileId);
  if (cached) return cached;
  const supabase = getSupabaseBrowserClient();

  const [{ count: followersCount, error: followersError }, { count: followingCount, error: followingError }] =
    await Promise.all([
      supabase.from("follows").select("*", { count: "exact", head: true }).eq("following_id", profileId),
      supabase.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", profileId),
    ]);

  if (followersError) console.error("getFollowCounts followers error", followersError);
  if (followingError) console.error("getFollowCounts following error", followingError);

  const counts = { followers: followersCount ?? 0, following: followingCount ?? 0 };
  cacheFollowCounts(profileId, counts);
  return counts;
}

export async function getPostsCount(profileId: string): Promise<number> {
  const cached = peekPostsCount(profileId);
  if (cached !== null) return cached;
  const supabase = getSupabaseBrowserClient();
  const { count, error } = await supabase
    .from("nreal_posts")
    .select("*", { count: "exact", head: true })
    .eq("user_id", profileId)
    .eq("is_deleted", false);

  if (error) {
    console.error("getPostsCount error", error);
    return 0;
  }

  const total = count ?? 0;
  cachePostsCount(profileId, total);
  return total;
}
