/* eslint-disable @next/next/no-img-element */
"use client";

import { useState } from "react";
import { BadgeCheck, Heart, MessageCircle, Send, X } from "lucide-react";

type PostCardProps = {
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

export function PostCard({ author, content, createdAt, mediaUrl, mediaType }: PostCardProps) {
  const [showFullMedia, setShowFullMedia] = useState(false);
  const name = author.displayName || (author.isCurrentUser ? "Ty" : "NRW uživatel");
  const initial = name.charAt(0).toUpperCase() || "N";
  const badgeLabel = author.verified ? author.verificationLabel || "Ověřený profil" : null;
  const hasContent = Boolean(content);
  const hasMedia = Boolean(mediaUrl);

  return (
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
