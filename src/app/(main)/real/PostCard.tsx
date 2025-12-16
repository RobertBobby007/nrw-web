/* eslint-disable @next/next/no-img-element */
"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { BadgeCheck, Heart, MessageCircle, MoreHorizontal, Send, X } from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import type { Profile } from "@/lib/profiles";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ReportDialog } from "@/components/ui/ReportDialog";

type CommentAuthor = {
  id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  verified?: boolean | null;
};

type RealComment = {
  id: string;
  post_id: string;
  user_id: string | null;
  content: string;
  created_at: string;
  author?: CommentAuthor | null;
  parent_id: string | null;
  reply_to_user_id?: string | null;
  reply_to_user?: CommentAuthor | null;
  is_deleted?: boolean | null;
};

type PostCardProps = {
  postId: string;
  postUserId: string;
  isDeleted?: boolean | null;
  author: {
    displayName: string;
    username: string | null;
    avatarUrl: string | null;
    isCurrentUser: boolean;
    verified: boolean;
    verificationLabel: string | null;
  };
  content: string;
  createdAt?: string | null;
  mediaUrl?: string | null;
  mediaType?: "image" | "video" | null;
  likesCount: number;
  likedByCurrentUser: boolean;
  commentsCount?: number;
  onToggleLike?: (postId: string) => void;
  likeDisabled?: boolean;
  onDeletePost?: (postId: string) => void;
  onRestorePost?: (postId: string) => void;
  currentUserProfile?: Profile | null;
};

function formatTimeLabel(createdAt?: string | null) {
  if (!createdAt) return "neznámý čas";

  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return "neznámý čas";

  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffH = Math.floor(diffMin / 60);

  if (diffMin < 1) return "před chvílí";
  if (diffMin < 60) return `před ${diffMin} min`;
  if (diffH < 24) return `před ${diffH} h`;

  return date.toLocaleDateString("cs-CZ", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

const COMMENTS_SORT: "asc" | "desc" = "asc";

export function PostCard({
  postId,
  author,
  content,
  createdAt,
  mediaUrl,
  mediaType,
  likesCount,
  likedByCurrentUser,
  commentsCount,
  onToggleLike,
  likeDisabled,
  postUserId,
  isDeleted,
  onDeletePost,
  onRestorePost,
  currentUserProfile,
}: PostCardProps) {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [session, setSession] = useState<Session | null>(null);
  const [comments, setComments] = useState<RealComment[]>([]);
  const [commentCount, setCommentCount] = useState<number>(commentsCount ?? 0);
  const [newComment, setNewComment] = useState("");
  const [replyText, setReplyText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [showFullMedia, setShowFullMedia] = useState(false);
  // reply state
  const [replyToCommentId, setReplyToCommentId] = useState<string | null>(null);
  const [isDeletingPost, setIsDeletingPost] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [reportTarget, setReportTarget] = useState<{ type: "post" | "comment"; id: string } | null>(null);
  const [deleteToast, setDeleteToast] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const name = author.displayName || (author.isCurrentUser ? "Ty" : "NRW uživatel");
  const initial = name.charAt(0).toUpperCase() || "N";
  const badgeLabel = author.verified ? author.verificationLabel || "Ověřený profil" : null;
  const hasContent = Boolean(content);
  const hasMedia = Boolean(mediaUrl);
  const likeActionDisabled = likeDisabled || !onToggleLike;

  const currentUserAuthor = useMemo<CommentAuthor | null>(() => {
    if (currentUserProfile) {
      return {
        id: currentUserProfile.id,
        display_name: currentUserProfile.display_name,
        username: currentUserProfile.username,
        avatar_url: currentUserProfile.avatar_url,
        verified: currentUserProfile.verified,
      };
    }
    const meta = (session?.user?.user_metadata as Record<string, unknown>) ?? {};
    const displayName = typeof meta.display_name === "string" ? meta.display_name : null;
    const username = typeof meta.username === "string" ? meta.username : null;
    const avatarUrl = typeof meta.avatar_url === "string" ? meta.avatar_url : null;
    const verified = typeof meta.verified === "boolean" ? meta.verified : null;
    if (!session?.user?.id) return null;
    return {
      id: session.user.id,
      display_name: displayName,
      username,
      avatar_url: avatarUrl,
      verified,
    };
  }, [currentUserProfile, session]);

  useEffect(() => {
    let isMounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (isMounted) setSession(data.session ?? null);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (isMounted) setSession(nextSession ?? null);
    });
    return () => {
      isMounted = false;
      listener?.subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    if (!deleteToast) return;
    const timer = setTimeout(() => setDeleteToast(null), 2500);
    return () => clearTimeout(timer);
  }, [deleteToast]);

  const mapCommentRow = useCallback((c: any, postIdParam: string): RealComment => {
    return {
      id: c.id,
      content: c.content,
      created_at: c.created_at,
      user_id: c.user_id,
      post_id: postIdParam,
      parent_id: c.reply_to_comment_id ?? c.parent_id ?? null,
      reply_to_user_id: c.reply_to_user_id ?? null,
      author: c.author
        ? {
            id: c.author.id,
            display_name: c.author.display_name,
            username: c.author.username,
            avatar_url: c.author.avatar_url,
            verified: c.author.verified,
          }
        : null,
      reply_to_user: c.reply_to_user
        ? {
            id: c.reply_to_user.id,
            display_name: c.reply_to_user.display_name,
            username: c.reply_to_user.username,
            avatar_url: c.reply_to_user.avatar_url,
            verified: c.reply_to_user.verified,
          }
        : null,
      is_deleted: c.is_deleted ?? null,
    };
  }, []);

  const fetchComments = useCallback(
    async (postIdParam: string) => {
      const { data, error } = await supabase
        .from("nreal_comments")
        .select(
          `
    id,
    post_id,
    content,
    created_at,
    user_id,
    reply_to_comment_id,
    reply_to_user_id,
    is_deleted,
    author:profiles!nreal_comments_user_id_profiles_fkey (
      id,
      username,
      display_name,
      avatar_url,
      verified
    ),
    reply_to_user:profiles!nreal_comments_reply_to_user_fkey (
      id,
      username,
      display_name,
      avatar_url,
      verified
    )
  `,
        )
        .eq("post_id", postIdParam)
        .eq("is_deleted", false)
        .order("created_at", { ascending: true });

      if (error) {
        console.error("Failed to load comments", JSON.stringify(error, null, 2));
        setComments([]);
        setCommentCount(0);
        return;
      }

      if (!data || data.length === 0) {
        setComments([]);
        setCommentCount(0);
        return;
      }

      const mapped: RealComment[] = data.map((c: any) => mapCommentRow(c, postIdParam));

      setComments(mapped);
      setCommentCount(mapped.length);
    },
    [mapCommentRow, supabase],
  );

  const handleToggleComments = async () => {
    const next = !commentsOpen;
    setCommentsOpen(next);
    if (next && postId) {
      await fetchComments(postId);
    }
  };

  const findAuthorForUserId = useCallback(
    (userId: string | null | undefined): CommentAuthor | null => {
      if (!userId) return null;
      const fromExisting = comments.find((c) => c.user_id === userId)?.author;
      if (fromExisting) return fromExisting;
      if (currentUserAuthor && currentUserAuthor.id === userId) return currentUserAuthor;
      return null;
    },
    [comments, currentUserAuthor],
  );

  const handleSubmitComment = async (e: FormEvent) => {
    e.preventDefault();
    const content = newComment.trim();
    if (!content || isSending) return;

    if (!postId) {
      console.error("Cannot post comment: missing postId");
      return;
    }

    const parentComment = comments.find((c) => c.id === replyToCommentId);
    const replyToUserId = parentComment?.user_id ?? null;
    const replyToUserAuthor = parentComment?.author ?? null;

    let tempId: string | null = null;
    setIsSending(true);
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        console.error("Failed to get current user for comment", userError);
        return;
      }

      if (!user) {
        console.error("No user – cannot add comment");
        return;
      }

      const userMeta = (user.user_metadata ?? {}) as Record<string, unknown>;
      const optimisticAuthor: CommentAuthor | null =
        findAuthorForUserId(user.id) ??
        currentUserAuthor ??
        {
          id: user.id,
          display_name: typeof userMeta.display_name === "string" ? userMeta.display_name : null,
          username: typeof userMeta.username === "string" ? userMeta.username : null,
          avatar_url: typeof userMeta.avatar_url === "string" ? userMeta.avatar_url : null,
          verified: typeof userMeta.verified === "boolean" ? userMeta.verified : null,
        };

      tempId = `temp-${Date.now()}`;
      const tempComment: RealComment = {
        id: tempId,
        post_id: postId,
        user_id: user.id,
        parent_id: null,
        is_deleted: false,
        content,
        created_at: new Date().toISOString(),
        author: optimisticAuthor,
      };

      setComments((prev) => [...prev, tempComment]);
      setCommentCount((prev) => prev + 1);
      setNewComment("");

      const { data, error } = await supabase
        .from("nreal_comments")
        .insert({
          post_id: postId,
          user_id: user.id,
          content,
          reply_to_comment_id: null,
          reply_to_user_id: null,
        })
        .select(
          `
          id,
          post_id,
          user_id,
          content,
          reply_to_comment_id,
          reply_to_user_id,
          is_deleted,
          created_at,
          author:profiles!nreal_comments_user_id_profiles_fkey (
            id,
            username,
            display_name,
            avatar_url,
            verified
          ),
          reply_to_user:profiles!nreal_comments_reply_to_user_fkey (
            id,
            username,
            display_name,
            avatar_url,
            verified
          )
        `,
        )
        .single();

      if (error || !data) {
        console.error("Failed to insert comment", error);
        setComments((prev) => prev.filter((c) => c.id !== tempId));
        setCommentCount((prev) => Math.max(prev - 1, 0));
        return;
      }

      const inserted: RealComment = mapCommentRow(data, postId);

      setComments((prev) => {
        const withoutTemp = prev.filter((c) => c.id !== tempId);
        const hasInserted = withoutTemp.some((c) => c.id === inserted.id);
        if (hasInserted) return withoutTemp;
        return [...withoutTemp, inserted];
      });
    } catch (err) {
      console.error("Failed to insert comment (exception)", err);
      if (tempId) {
        setComments((prev) => prev.filter((c) => c.id !== tempId));
        setCommentCount((prev) => Math.max(prev - 1, 0));
      }
    } finally {
      setIsSending(false);
    }
  };

  const handleReplySelect = (commentId: string) => {
    setReplyToCommentId(commentId);
    setReplyText("");
  };

  const handleCancelReply = () => {
    setReplyToCommentId(null);
    setReplyText("");
  };

  const handleSubmitReply = async () => {
    const content = replyText.trim();
    if (!content || isSending || !replyToCommentId) return;

    if (!postId) {
      console.error("Cannot post reply: missing postId");
      return;
    }

    const parentComment = comments.find((c) => c.id === replyToCommentId);
    const replyToUserId = parentComment?.user_id ?? null;
    const replyToUserAuthor = parentComment?.author ?? null;

    let tempId: string | null = null;
    setIsSending(true);
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        console.error("Failed to get current user for reply", userError);
        return;
      }

      if (!user) {
        console.error("No user – cannot add reply");
        return;
      }

      const userMeta = (user.user_metadata ?? {}) as Record<string, unknown>;
      const optimisticAuthor: CommentAuthor | null =
        findAuthorForUserId(user.id) ??
        currentUserAuthor ??
        {
          id: user.id,
          display_name: typeof userMeta.display_name === "string" ? userMeta.display_name : null,
          username: typeof userMeta.username === "string" ? userMeta.username : null,
          avatar_url: typeof userMeta.avatar_url === "string" ? userMeta.avatar_url : null,
          verified: typeof userMeta.verified === "boolean" ? userMeta.verified : null,
        };

      tempId = `temp-${Date.now()}`;
      const tempReply: RealComment = {
        id: tempId,
        post_id: postId,
        user_id: user.id,
        parent_id: replyToCommentId,
        reply_to_user_id: replyToUserId,
        is_deleted: false,
        content,
        created_at: new Date().toISOString(),
        author: optimisticAuthor,
        reply_to_user: replyToUserAuthor,
      };

      setComments((prev) => [...prev, tempReply]);
      setCommentCount((prev) => prev + 1);

      const { data, error } = await supabase
        .from("nreal_comments")
        .insert({
          post_id: postId,
          user_id: user.id,
          content,
          reply_to_comment_id: replyToCommentId,
          reply_to_user_id: replyToUserId,
        })
        .select(
          `
          id,
          post_id,
          user_id,
          content,
          reply_to_comment_id,
          reply_to_user_id,
          is_deleted,
          created_at,
          author:profiles!nreal_comments_user_id_profiles_fkey (
            id,
            username,
            display_name,
            avatar_url,
            verified
          ),
          reply_to_user:profiles!nreal_comments_reply_to_user_fkey (
            id,
            username,
            display_name,
            avatar_url,
            verified
          )
        `,
        )
        .single();

      if (error || !data) {
        console.error("Failed to insert reply", error);
        setComments((prev) => prev.filter((c) => c.id !== tempId));
        setCommentCount((prev) => Math.max(prev - 1, 0));
        return;
      }

      const inserted = mapCommentRow(data, postId);

      setComments((prev) => {
        const withoutTemp = prev.filter((c) => c.id !== tempId);
        const hasInserted = withoutTemp.some((c) => c.id === inserted.id);
        if (hasInserted) return withoutTemp;
        return [...withoutTemp, inserted];
      });

      setReplyToCommentId(null);
      setReplyText("");
    } catch (err) {
      console.error("Failed to insert reply (exception)", err);
      if (tempId) {
        setComments((prev) => prev.filter((c) => c.id !== tempId));
        setCommentCount((prev) => Math.max(prev - 1, 0));
      }
    } finally {
      setIsSending(false);
    }
  };

  const repliesByParentId = useMemo(() => {
    const grouped = comments.reduce<Record<string, RealComment[]>>((acc, comment) => {
      if (!comment.parent_id) return acc;
      if (!acc[comment.parent_id]) acc[comment.parent_id] = [];
      acc[comment.parent_id].push(comment);
      return acc;
    }, {});
    Object.keys(grouped).forEach((key) => {
      grouped[key] = grouped[key].slice().sort((a, b) => {
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      });
    });
    return grouped;
  }, [comments]);

  const topLevelComments = useMemo(() => {
    const list = comments.filter((c) => !c.parent_id);
    const sorted = list.slice().sort((a, b) => {
      const diff = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      return COMMENTS_SORT === "asc" ? diff : -diff;
    });
    return sorted;
  }, [comments]);

  const currentUserId = session?.user?.id ?? null;

  const handleDeletePost = async () => {
    if (isDeletingPost) return;
    setDeleteDialogOpen(false);
    setMenuOpen(false);
    setIsDeletingPost(true);
    try {
      const { data: authData, error: authErr } = await supabase.auth.getUser();
      if (authErr) throw authErr;
      const user = authData?.user;
      if (!user) {
        window.location.href = "/auth/login";
        throw new Error("Nejsi přihlášený.");
      }

      const { data, error } = await supabase
        .from("nreal_posts")
        .update({ is_deleted: true })
        .eq("id", postId)
        .eq("user_id", user.id)
        .select("id");

      if (error) throw error;

      if (!data || data.length === 0) {
        throw new Error("Nemáš právo smazat tenhle příspěvek (nebo už byl smazaný).");
      }

      onDeletePost?.(postId);
      setDeleteToast({ type: "success", message: "Příspěvek smazán." });
    } catch (e: any) {
      console.error("Delete post failed:", JSON.stringify(e, null, 2));
      setDeleteToast({ type: "error", message: e?.message ?? "Smazání příspěvku selhalo." });
    } finally {
      setIsDeletingPost(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!currentUserId) {
      window.location.href = "/auth/login";
      return;
    }
    setComments((prev) =>
      prev.map((c) => (c.id === commentId ? { ...c, is_deleted: true, content: "" } : c)),
    );
    try {
      const { error } = await supabase
        .from("nreal_comments")
        .update({ is_deleted: true, deleted_at: new Date().toISOString() })
        .eq("id", commentId)
        .eq("user_id", currentUserId);
      if (error) {
        console.error("Delete comment failed", error);
        setDeleteToast({ type: "error", message: "Smazání komentáře selhalo." });
        await fetchComments(postId);
      }
    } catch (err) {
      console.error("Delete comment exception", err);
      setDeleteToast({ type: "error", message: "Smazání komentáře selhalo." });
      await fetchComments(postId);
    }
  };

  return (
    isDeleted ? null : (
    <article className="mb-4 rounded-3xl border border-neutral-200 bg-white shadow-sm">
      {/* header */}
      <header className="flex items-center gap-3 px-4 pt-4">
        {author.avatarUrl ? (
          <div className="h-9 w-9 overflow-hidden rounded-full ring-2 ring-neutral-200">
            <img
              src={author.avatarUrl}
              alt={name}
              className="h-full w-full object-cover"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />
          </div>
        ) : (
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-tr from-pink-400 via-amber-300 to-yellow-300 text-xs font-semibold text-white">
            {initial}
          </div>
        )}
        <div className="flex flex-col">
          <div className="flex flex-wrap items-center gap-2 text-sm font-semibold">
            <span className="font-medium text-neutral-900">{name}</span>
            {badgeLabel ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-200">
                <BadgeCheck className="h-3.5 w-3.5" />
                {badgeLabel}
              </span>
            ) : null}
          </div>
          <div className="flex items-center gap-2 text-xs text-neutral-500">
            {author.username ? <span>{author.username}</span> : null}
            <span>{formatTimeLabel(createdAt)}</span>
          </div>
        </div>
        <div className="ml-auto">
          <div className="relative">
            <button
              type="button"
              className="rounded-full p-2 text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-800"
              onClick={() => setMenuOpen((prev) => !prev)}
            >
              <MoreHorizontal className="h-5 w-5" />
            </button>
            {menuOpen ? (
              <div className="absolute right-0 mt-1 w-40 rounded-2xl border border-neutral-200 bg-white shadow-lg">
                {currentUserId && currentUserId === postUserId ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (!currentUserId) {
                        window.location.href = "/auth/login";
                        return;
                      }
                      setDeleteDialogOpen(true);
                      setMenuOpen(false);
                    }}
                    className="block w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                    disabled={isDeletingPost}
                  >
                    Smazat
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => {
                    if (!currentUserId) {
                      window.location.href = "/auth/login";
                      return;
                    }
                    setReportTarget({ type: "post", id: postId });
                    setReportDialogOpen(true);
                    setMenuOpen(false);
                  }}
                  className="block w-full px-4 py-2 text-left text-sm text-neutral-700 hover:bg-neutral-100"
                >
                  Nahlásit
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      {/* obsah postu */}
      <div className="space-y-3 px-4 pb-4 pt-3">
        {hasContent && <div className="text-sm leading-relaxed text-neutral-900 whitespace-pre-line">{content}</div>}
        {hasMedia ? (
          mediaType === "video" ? (
            <div className="mx-auto w-[398px] max-w-full overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-50">
              <video
                src={mediaUrl ?? undefined}
                controls
                className="h-[418px] w-full object-cover bg-black"
                onClick={() => setShowFullMedia(true)}
              />
            </div>
          ) : (
            <div
              className="mx-auto w-[398px] max-w-full overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-100"
              style={{ height: "418px" }}
            >
              <img
                src={mediaUrl ?? undefined}
                alt="Příloha"
                className="h-full w-full cursor-zoom-in object-cover"
                onClick={() => setShowFullMedia(true)}
              />
            </div>
          )
        ) : null}
      </div>

      {showFullMedia && hasMedia && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4">
          <button
            type="button"
            onClick={() => setShowFullMedia(false)}
            className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20"
          >
            <X className="h-6 w-6" />
          </button>
          <div className="max-h-[90vh] max-w-5xl overflow-hidden rounded-2xl bg-black">
            {mediaType === "video" ? (
              <video src={mediaUrl ?? undefined} controls className="h-full max-h-[90vh] w-full object-contain" />
            ) : (
              <img src={mediaUrl ?? undefined} alt="Příloha" className="h-full max-h-[90vh] w-full object-contain" />
            )}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={deleteDialogOpen}
        title="Opravdu smazat příspěvek?"
        message="Tahle akce nejde vrátit."
        confirmText="Smazat"
        cancelText="Zrušit"
        danger
        onCancel={() => setDeleteDialogOpen(false)}
        onConfirm={handleDeletePost}
      />
      <ReportDialog
        open={reportDialogOpen && Boolean(reportTarget?.id)}
        targetType={reportTarget?.type ?? "post"}
        targetId={reportTarget?.id ?? ""}
        onClose={() => {
          setReportDialogOpen(false);
          setReportTarget(null);
        }}
      />
      {deleteToast ? (
        <div
          className={`fixed bottom-4 right-4 z-50 rounded-full px-4 py-2 text-sm font-semibold text-white shadow-lg ${
            deleteToast.type === "success" ? "bg-emerald-600" : "bg-red-600"
          }`}
        >
          {deleteToast.message}
        </div>
      ) : null}

      {/* spodní akce */}
      <footer className="flex items-center gap-3 border-t border-neutral-100 px-4 py-3 text-xs text-neutral-500">
        <button
          type="button"
          disabled={likeActionDisabled}
          onClick={() => onToggleLike?.(postId)}
          className={`flex items-center gap-1 rounded-full px-3 py-1 transition ${
            likedByCurrentUser
              ? "bg-rose-50 text-rose-600 ring-1 ring-rose-100"
              : "hover:bg-neutral-100 text-neutral-600"
          } ${likeActionDisabled ? "cursor-not-allowed opacity-60" : ""}`}
        >
          <Heart className="h-4 w-4" fill={likedByCurrentUser ? "currentColor" : "none"} />
          <span>{likesCount}</span>
        </button>
        <button
          type="button"
          onClick={handleToggleComments}
          className="flex items-center gap-1 rounded-full px-3 py-1 text-neutral-600 transition hover:bg-neutral-100 hover:text-neutral-900"
        >
          <MessageCircle className="h-4 w-4" />
          <span>Komentáře ({commentCount})</span>
        </button>
        <button className="ml-auto flex items-center gap-1 rounded-full px-3 py-1 text-neutral-600 transition hover:bg-neutral-100">
          <Send className="h-4 w-4" />
          <span>Poslat</span>
        </button>
      </footer>

      {commentsOpen && (
        <div className="px-4 pb-3">
          <form onSubmit={handleSubmitComment} className="mt-2 flex items-center gap-2 text-sm">
            <input
              type="text"
              placeholder="Přidej komentář..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              className="flex-1 rounded-full border border-neutral-300 bg-white px-3 py-1 text-sm text-neutral-900 placeholder:text-neutral-500 outline-none focus:border-neutral-500"
            />
            <button
              type="submit"
              disabled={!newComment.trim() || isSending}
              className="text-sm font-medium text-primary transition hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Poslat
            </button>
          </form>

          <div className="mt-3 space-y-2">
            {comments.length === 0 ? (
              <p className="mt-2 text-sm text-gray-400">Zatím žádné komentáře.</p>
            ) : (
              <div className="mt-3 space-y-2">
                {topLevelComments.map((comment) => {
                  const author = comment.author;
                  const authorName = author?.display_name || author?.username || "Neznámý uživatel";
                  const createdLabel = formatTimeLabel(comment.created_at);
                  const commentInitial = authorName.charAt(0).toUpperCase() || "N";
                  const canDeleteComment = currentUserId && comment.user_id === currentUserId;

                  return (
                    <div key={comment.id} className="flex flex-col gap-2 rounded-2xl bg-neutral-50 px-3 py-2 text-sm">
                      <div className="flex gap-3">
                        {author?.avatar_url ? (
                          <div className="mt-1 h-8 w-8 overflow-hidden rounded-full ring-2 ring-neutral-200">
                            <img
                              src={author.avatar_url}
                              alt={authorName}
                              className="h-full w-full object-cover"
                              onError={(e) => {
                                (e.currentTarget as HTMLImageElement).style.display = "none";
                              }}
                            />
                          </div>
                        ) : (
                          <div className="mt-1 flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-tr from-pink-400 via-amber-300 to-yellow-300 text-[11px] font-semibold text-white">
                            {commentInitial}
                          </div>
                        )}
                        <div className="flex-1 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-neutral-900">{authorName}</span>
                            {author?.verified ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-200">
                                <BadgeCheck className="h-3.5 w-3.5" />
                                NRW Verified
                              </span>
                            ) : null}
                            <span className="text-xs font-normal text-neutral-500">{createdLabel}</span>
                          </div>
                          <div className="text-sm text-gray-900">
                            {comment.is_deleted ? <span className="text-neutral-400">Komentář byl smazán</span> : comment.content}
                          </div>
                          {!comment.is_deleted ? (
                            <div className="flex items-center gap-3 text-xs text-neutral-500">
                              <button
                                type="button"
                                onClick={() => handleReplySelect(comment.id)}
                                className="font-semibold text-neutral-600 transition hover:text-neutral-900"
                              >
                                Odpovědět
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  if (!currentUserId) {
                                    window.location.href = "/auth/login";
                                    return;
                                  }
                                  setReportTarget({ type: "comment", id: comment.id });
                                  setReportDialogOpen(true);
                                }}
                                className="font-semibold text-neutral-600 transition hover:text-neutral-900"
                              >
                                Nahlásit
                              </button>
                              {canDeleteComment ? (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteComment(comment.id)}
                                  className="font-semibold text-red-600 transition hover:text-red-700"
                                >
                                  Smazat
                                </button>
                              ) : null}
                            </div>
                          ) : null}
                          {replyToCommentId === comment.id && !comment.is_deleted ? (
                            <form
                              onSubmit={(e) => {
                                e.preventDefault();
                                void handleSubmitReply();
                              }}
                              className="ml-[-0.5rem] mt-2 flex flex-col gap-2"
                            >
                              <div className="flex items-center gap-2 text-sm">
                                <input
                                  type="text"
                                  placeholder={`Odpověď pro ${authorName}`}
                                  value={replyText}
                                  onChange={(e) => setReplyText(e.target.value)}
                                  className="ml-8 flex-1 rounded-full border border-neutral-300 bg-white px-3 py-1 text-sm text-neutral-900 placeholder:text-neutral-500 outline-none focus:border-neutral-500"
                                />
                                <button
                                  type="submit"
                                  disabled={!replyText.trim() || isSending}
                                  className="text-sm font-medium text-primary transition hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                  Odpovědět
                                </button>
                              </div>
                              <div className="ml-8 text-xs">
                                <button
                                  type="button"
                                  onClick={handleCancelReply}
                                  className="font-semibold text-neutral-500 transition hover:text-neutral-900"
                                >
                                  Zrušit odpověď
                                </button>
                              </div>
                            </form>
                          ) : null}
                        </div>
                      </div>
                      {(repliesByParentId[comment.id] ?? []).map((reply) => {
                        const replyAuthor = reply.author;
                        const replyAuthorName = replyAuthor?.display_name || replyAuthor?.username || "Neznámý uživatel";
                        const replyCreatedLabel = formatTimeLabel(reply.created_at);
                        const replyInitial = replyAuthorName.charAt(0).toUpperCase() || "N";
                        const canDeleteReply = currentUserId && reply.user_id === currentUserId;
                        return (
                          <div
                            key={reply.id}
                            className="ml-11 flex gap-3 rounded-2xl bg-white px-3 py-2 text-sm ring-1 ring-neutral-100"
                          >
                            {replyAuthor?.avatar_url ? (
                              <div className="mt-1 h-7 w-7 overflow-hidden rounded-full ring-2 ring-neutral-200">
                                <img
                                  src={replyAuthor.avatar_url}
                                  alt={replyAuthorName}
                                  className="h-full w-full object-cover"
                                  onError={(e) => {
                                    (e.currentTarget as HTMLImageElement).style.display = "none";
                                  }}
                                />
                              </div>
                            ) : (
                              <div className="mt-1 flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-tr from-pink-400 via-amber-300 to-yellow-300 text-[10px] font-semibold text-white">
                                {replyInitial}
                              </div>
                            )}
                            <div className="flex-1 space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-semibold text-neutral-900">{replyAuthorName}</span>
                                {replyAuthor?.verified ? (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-200">
                                    <BadgeCheck className="h-3.5 w-3.5" />
                                    NRW Verified
                                  </span>
                                ) : null}
                                <span className="text-xs font-normal text-neutral-500">{replyCreatedLabel}</span>
                              </div>
                              <div className="text-sm text-gray-900">
                                {reply.is_deleted ? <span className="text-neutral-400">Komentář byl smazán</span> : reply.content}
                              </div>
                              {!reply.is_deleted ? (
                                <div className="flex items-center gap-3 text-xs text-neutral-500">
                                  <button
                                    type="button"
                                    onClick={() => handleReplySelect(reply.id)}
                                    className="font-semibold text-neutral-600 transition hover:text-neutral-900"
                                  >
                                    Odpovědět
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (!currentUserId) {
                                        window.location.href = "/auth/login";
                                        return;
                                      }
                                      setReportTarget({ type: "comment", id: reply.id });
                                      setReportDialogOpen(true);
                                    }}
                                    className="font-semibold text-neutral-600 transition hover:text-neutral-900"
                                  >
                                    Nahlásit
                                  </button>
                                  {canDeleteReply ? (
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteComment(reply.id)}
                                      className="font-semibold text-red-600 transition hover:text-red-700"
                                    >
                                      Smazat
                                    </button>
                                  ) : null}
                                </div>
                              ) : null}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </article>
    )
  );
}
