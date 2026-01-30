"use client";

import { useEffect, useMemo } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import type { NrealPost } from "@/types/nreal";

type RealtimePost = Partial<NrealPost> & {
  id?: string;
  is_deleted?: boolean | null;
  approved_at?: string | null;
  status?: string | null;
  likes_count?: number | null;
  comments_count?: number | null;
};

type UpdateFields = Pick<NrealPost, "likesCount" | "commentsCount" | "status"> &
  Partial<Pick<NrealPost, "is_deleted" | "profiles" | "media_url" | "media_type">>;

const isApproved = (post: RealtimePost) => {
  if (post.approved_at) return true;
  if (post.status) return post.status === "approved";
  return true;
};

const pickLikes = (post: RealtimePost) => {
  if (typeof post.likesCount === "number") return post.likesCount;
  if (typeof post.likes_count === "number") return post.likes_count;
  return 0;
};

const pickComments = (post: RealtimePost) => {
  if (typeof post.commentsCount === "number") return post.commentsCount;
  if (typeof post.comments_count === "number") return post.comments_count;
  return 0;
};

export function useRealtimeNRealFeed(params: {
  currentUserId: string | null;
  setPosts: React.Dispatch<React.SetStateAction<NrealPost[]>>;
}) {
  const { currentUserId, setPosts } = params;
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);

  useEffect(() => {
    if (!currentUserId) return;

    const channel = supabase
      .channel("nreal_posts:realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "nreal_posts" },
        (payload) => {
          const next = payload.new as RealtimePost;
          if (!next?.id) return;
          if (next.is_deleted) return;
          if (!isApproved(next)) return;

          const hydrateAndInsert = async () => {
            const profiles = next.profiles?.length
              ? next.profiles
              : (await supabase
                  .from("profiles")
                  .select("username, display_name, avatar_url, verified, verification_label")
                  .eq("id", next.user_id ?? "")
                  .limit(1)
                  .maybeSingle()
                  .then(({ data }) => (data ? [data] : []))
                  .catch(() => []));

            const hydrated: NrealPost = {
              ...(next as NrealPost),
              profiles,
              likesCount: pickLikes(next),
              commentsCount: pickComments(next),
              likedByCurrentUser: false,
            };

            setPosts((prev) => {
              if (prev.some((post) => post.id === hydrated.id)) {
                return prev;
              }
              return [hydrated, ...prev];
            });
          };

          void hydrateAndInsert();
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "nreal_posts" },
        (payload) => {
          const next = payload.new as RealtimePost;
          if (!next?.id) return;

          setPosts((prev) => {
            const exists = prev.some((post) => post.id === next.id);
            const shouldShow = !next.is_deleted && isApproved(next);

            if (!exists) {
              if (!shouldShow) return prev;
              const hydrated: NrealPost = {
                ...(next as NrealPost),
                profiles: (next.profiles as NrealPost["profiles"]) ?? [],
                likesCount: pickLikes(next),
                commentsCount: pickComments(next),
                likedByCurrentUser: false,
              };
              return [hydrated, ...prev];
            }

            if (!shouldShow) {
              return prev.filter((post) => post.id !== next.id);
            }

            return prev.map((post) => {
              if (post.id !== next.id) return post;
              const update: UpdateFields = {
                likesCount: pickLikes(next) ?? post.likesCount,
                commentsCount: pickComments(next) ?? post.commentsCount,
                status: (next as NrealPost).status ?? post.status,
                is_deleted: (next as NrealPost).is_deleted ?? post.is_deleted,
                profiles: (next.profiles as NrealPost["profiles"]) ?? post.profiles,
                media_url: (next as NrealPost).media_url ?? post.media_url,
                media_type: (next as NrealPost).media_type ?? post.media_type,
              };
              return { ...post, ...update };
            });
          });
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "nreal_posts" },
        (payload) => {
          const oldRow = payload.old as RealtimePost;
          if (!oldRow?.id) return;
          setPosts((prev) => prev.filter((post) => post.id !== oldRow.id));
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId, setPosts, supabase]);
}
