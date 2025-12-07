"use client";

import { Heart, MessageCircle, Send } from "lucide-react";

type PostCardProps = {
  authorName: string;
  content: string;
  createdAt?: string | null;
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

export function PostCard({ authorName, content, createdAt }: PostCardProps) {
  const initial = authorName.charAt(0).toUpperCase() || "N";

  return (
    <article className="mb-4 rounded-3xl border border-neutral-200 bg-white shadow-sm">
      {/* header */}
      <header className="flex items-center gap-3 px-4 pt-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-tr from-pink-400 via-amber-300 to-yellow-300 text-xs font-semibold text-white">
          {initial}
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-semibold">
            nReal · <span className="font-medium">{authorName}</span>
          </span>
          <span className="text-xs text-neutral-500">{formatTimeLabel(createdAt)}</span>
        </div>
      </header>

      {/* obsah postu */}
      <div className="px-4 pb-4 pt-3 text-sm leading-relaxed text-neutral-900">
        {content}
      </div>

      {/* spodní akce */}
      <footer className="flex items-center gap-6 border-t border-neutral-100 px-4 py-3 text-xs text-neutral-500">
        <button className="flex items-center gap-1 hover:text-neutral-900">
          <Heart className="h-4 w-4" />
          <span>Lajk</span>
        </button>
        <button className="flex items-center gap-1 hover:text-neutral-900">
          <MessageCircle className="h-4 w-4" />
          <span>Komentář</span>
        </button>
        <button className="ml-auto flex items-center gap-1 hover:text-neutral-900">
          <Send className="h-4 w-4" />
          <span>Poslat</span>
        </button>
      </footer>
    </article>
  );
}
