"use client";

import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

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
}

export async function getFollowCounts(profileId: string): Promise<{ followers: number; following: number }> {
  const supabase = getSupabaseBrowserClient();

  const [{ count: followersCount, error: followersError }, { count: followingCount, error: followingError }] =
    await Promise.all([
      supabase.from("follows").select("*", { count: "exact", head: true }).eq("following_id", profileId),
      supabase.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", profileId),
    ]);

  if (followersError) console.error("getFollowCounts followers error", followersError);
  if (followingError) console.error("getFollowCounts following error", followingError);

  return { followers: followersCount ?? 0, following: followingCount ?? 0 };
}

export async function getPostsCount(profileId: string): Promise<number> {
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

  return count ?? 0;
}

