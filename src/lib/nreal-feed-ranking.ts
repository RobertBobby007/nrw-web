"use client";

import type { NrealPost } from "@/types/nreal";

export type FeedVariant = "chronological" | "ranked";
const TOP_FRESH_SLOTS = 2;

export function getFeedVariant(userId: string | null) {
  if (!userId || typeof window === "undefined") {
    return { variant: "ranked" as FeedVariant, storageKey: null };
  }
  const storageKey = `nrw.feed.variant:${userId}`;
  const stored = window.localStorage.getItem(storageKey) as FeedVariant | null;
  if (stored === "chronological" || stored === "ranked") {
    return { variant: stored, storageKey };
  }
  const variant: FeedVariant = Math.random() < 0.5 ? "chronological" : "ranked";
  window.localStorage.setItem(storageKey, variant);
  return { variant, storageKey };
}

export function computePostScore(post: NrealPost, followingSet: Set<string>, now: Date): number {
  const likes = post.likesCount ?? 0;
  const comments = post.commentsCount ?? 0;
  const isFollowingAuthor = followingSet.has(post.user_id);
  const createdAt = new Date(post.created_at ?? "");
  const hoursSince = Number.isNaN(createdAt.getTime())
    ? 24
    : Math.max(0, (now.getTime() - createdAt.getTime()) / 36e5);
  const engagementScore = Math.log1p(likes) * 6 + Math.log1p(comments) * 10;
  const recencyScore = Math.exp(-hoursSince / 18) * 30;
  const followBoost = isFollowingAuthor ? 16 : 0;
  const mediaBonus = post.media_url ? 3 : 0;
  const discussionBonus = comments >= 3 ? 4 : 0;

  return engagementScore + recencyScore + followBoost + mediaBonus + discussionBonus;
}

export function rankPosts(posts: NrealPost[], followingSet: Set<string>, variant: FeedVariant, now: Date) {
  if (variant === "chronological") {
    return [...posts].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }
  const ranked = posts
    .map((post) => ({ post, score: computePostScore(post, followingSet, now) }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return new Date(b.post.created_at).getTime() - new Date(a.post.created_at).getTime();
    })
    .map(({ post }) => post);

  const freshest = [...posts]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, TOP_FRESH_SLOTS);
  const freshIds = new Set(freshest.map((post) => post.id));
  const rest = ranked.filter((post) => !freshIds.has(post.id));

  return [...freshest, ...rest];
}
