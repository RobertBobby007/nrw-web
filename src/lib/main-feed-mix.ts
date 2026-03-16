import type { NrealPost } from "@/types/nreal";
import { computeNnewsScore } from "@/lib/nnews";
import type { NewsTopicId } from "@/lib/news-topics";

type MixedNnewsItem = {
  id: string;
  type: "nNews";
  title: string;
  excerpt: string;
  meta: string;
  createdAt: string;
  url?: string | null;
  imageUrl?: string | null;
  sourceName?: string | null;
  topics?: NewsTopicId[];
};

export type MixedStreamItem =
  | { kind: "nReal"; createdAt: string; post: NrealPost }
  | { kind: "nNews"; createdAt: string; item: MixedNnewsItem };

type Candidate =
  | {
      kind: "nReal";
      createdAtMs: number;
      baseScore: number;
      post: NrealPost;
      id: string;
      authorId: string;
    }
  | {
      kind: "nNews";
      createdAtMs: number;
      baseScore: number;
      item: MixedNnewsItem;
      id: string;
      source: string;
    };

const TOP_FRESH_NREAL_IN_MIX = 2;
const FRESH_NREAL_BOOST_WINDOW_HOURS = 6;
const FRESH_NREAL_MAX_BOOST = 18;

function scoreNrealForMix(post: NrealPost, now: Date): number {
  const likes = post.likesCount ?? 0;
  const comments = post.commentsCount ?? 0;
  const createdAt = new Date(post.created_at ?? "");
  const hoursSince = Number.isNaN(createdAt.getTime())
    ? 24
    : Math.max(0, (now.getTime() - createdAt.getTime()) / 36e5);
  const recencyScore = Math.exp(-hoursSince / 16) * 34;
  const engagement = Math.log1p(likes) * 6 + Math.log1p(comments) * 10;
  const mediaBonus = post.media_url ? 3 : 0;
  return recencyScore + engagement + mediaBonus;
}

function sourceFromNews(item: MixedNnewsItem) {
  if (item.sourceName?.trim()) return item.sourceName.trim();
  try {
    return item.url ? new URL(item.url).hostname : "unknown";
  } catch {
    return "unknown";
  }
}

function createdAtMs(value: string) {
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? 0 : t;
}

export function mixMainFeed(posts: NrealPost[], nnewsItems: MixedNnewsItem[], now = new Date()): MixedStreamItem[] {
  const candidates: Candidate[] = [
    ...posts.map((post) => ({
      kind: "nReal" as const,
      createdAtMs: createdAtMs(post.created_at),
      baseScore: scoreNrealForMix(post, now),
      post,
      id: post.id,
      authorId: post.user_id,
    })),
    ...nnewsItems.map((item) => ({
      kind: "nNews" as const,
      createdAtMs: createdAtMs(item.createdAt),
      baseScore: computeNnewsScore(
        {
          id: item.id,
          title: item.title,
          excerpt: item.excerpt,
          meta: item.meta,
          createdAt: item.createdAt,
          url: item.url ?? null,
          imageUrl: item.imageUrl ?? null,
          sourceName: item.sourceName ?? null,
        },
        now,
      ),
      item,
      id: item.id,
      source: sourceFromNews(item),
    })),
  ];

  const freshestPosts = [...posts]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, TOP_FRESH_NREAL_IN_MIX);
  const freshestIds = new Set(freshestPosts.map((post) => post.id));

  const output: MixedStreamItem[] = [];
  const remaining = [...candidates];

  while (remaining.length > 0) {
    let bestIndex = 0;
    let bestScore = Number.NEGATIVE_INFINITY;

    for (let i = 0; i < remaining.length; i += 1) {
      const candidate = remaining[i];
      let adjusted = candidate.baseScore;

      const previous = output.at(-1);
      const twoBack = output.at(-2);

      if (previous?.kind === candidate.kind && twoBack?.kind === candidate.kind) {
        adjusted -= 10;
      }

      if (candidate.kind === "nReal" && previous?.kind === "nReal" && previous.post.user_id === candidate.authorId) {
        adjusted -= 7;
      }

      if (candidate.kind === "nNews" && previous?.kind === "nNews") {
        const prevSource = sourceFromNews(previous.item);
        if (prevSource === candidate.source) adjusted -= 6;
      }

      if (candidate.kind === "nReal" && freshestIds.has(candidate.id)) {
        const hoursSince = Math.max(0, (now.getTime() - candidate.createdAtMs) / 36e5);
        const freshnessRatio = Math.max(0, 1 - hoursSince / FRESH_NREAL_BOOST_WINDOW_HOURS);
        adjusted += FRESH_NREAL_MAX_BOOST * freshnessRatio;
      }

      adjusted += Math.min(14, Math.max(0, (candidate.createdAtMs - (now.getTime() - 24 * 36e5)) / 36e5) * 0.7);

      if (adjusted > bestScore) {
        bestScore = adjusted;
        bestIndex = i;
      }
    }

    const [picked] = remaining.splice(bestIndex, 1);
    if (picked.kind === "nReal") {
      output.push({ kind: "nReal", createdAt: picked.post.created_at, post: picked.post });
    } else {
      output.push({ kind: "nNews", createdAt: picked.item.createdAt, item: picked.item });
    }
  }

  return output;
}
