"use client";

import type { NrealPost } from "@/types/nreal";

export type FeedVariant = "chronological" | "ranked";

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

// Score for MVP ranking: likes + comments + follow boost + recency bonus.
export function computePostScore(post: NrealPost, followingSet: Set<string>, now: Date): number {
  const likes = post.likesCount ?? 0;
  const comments = post.commentsCount ?? 0;
  const isFollowingAuthor = followingSet.has(post.user_id);
  const createdAt = new Date(post.created_at ?? "");
  const hoursSince = Number.isNaN(createdAt.getTime())
    ? 24
    : Math.max(0, (now.getTime() - createdAt.getTime()) / 36e5);
  const recencyBonus = Math.max(0, 24 - hoursSince);

  return likes * 2 + comments * 4 + (isFollowingAuthor ? 20 : 0) + recencyBonus;
}

export function rankPosts(posts: NrealPost[], followingSet: Set<string>, variant: FeedVariant, now: Date) {
  if (variant === "chronological") {
    return [...posts].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }
  return posts
    .map((post) => ({ post, score: computePostScore(post, followingSet, now) }))
    .sort((a, b) => b.score - a.score)
    .map(({ post }) => post);
}
