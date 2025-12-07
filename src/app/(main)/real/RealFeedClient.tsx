"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import type { NrealPost } from "@/types/nreal";
import { PostCard } from "./PostCard";

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
      const { data, error } = await supabase
        .from("nreal_posts")
        .select("id, user_id, content, created_at")
        .order("created_at", { ascending: false });

      if (!active) return;
      if (error) {
        setError(error.message);
      } else if (data) {
        setPosts(data as NrealPost[]);
      }
      setLoading(false);
    }
    load();
    return () => {
      active = false;
    };
  }, [supabase]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) {
      setError("Musíš být přihlášený.");
      return;
    }
    const trimmed = content.trim();
    if (!trimmed) return;

    setPosting(true);
    setError(null);
    const { data, error } = await supabase
      .from("nreal_posts")
      .insert({ content: trimmed, user_id: userId })
      .select()
      .single();

    setPosting(false);

    if (error) {
      setError(error.message);
      return;
    }
    if (data) {
      setPosts((prev) => [data as NrealPost, ...prev]);
      setContent("");
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

  const displayName = (post: NrealPost) => {
    if (post.user_id === userId) return "Ty";
    if (post.user_id) return `Uživatel ${post.user_id.slice(0, 6)}`;
    return "nReal";
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
          {error && (
            <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
          )}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={posting || !content.trim() || !userId}
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
            authorName={post.user_id === currentUserId ? "Ty" : "NRW uživatel"}
            content={post.content ?? ""}
            createdAt={post.created_at}
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
