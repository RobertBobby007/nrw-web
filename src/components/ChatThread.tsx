"use client";

import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useChatMessages } from "@/hooks/useChatMessages";
import { sendMessage } from "@/lib/chat";
import { safeIdentityLabel } from "@/lib/content-filter";

type ChatThreadProps = {
  chatId: string;
  className?: string;
  withBorder?: boolean;
  currentUserId?: string | null;
  otherUser?: {
    id?: string | null;
    username?: string | null;
    display_name?: string | null;
  } | null;
};

export function ChatThread({
  chatId,
  className,
  withBorder = true,
  currentUserId,
  otherUser,
}: ChatThreadProps) {
  const { messages } = useChatMessages(chatId);
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const otherLabel = useMemo(() => {
    const display = safeIdentityLabel(otherUser?.display_name ?? null, "");
    const username = safeIdentityLabel(otherUser?.username ?? null, "");
    return display || username || "Uzivatel";
  }, [otherUser]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!content.trim() || sending) {
      return;
    }

    setSending(true);
    try {
      await sendMessage(chatId, content);
      setContent("");
    } catch (error) {
      const message = error instanceof Error ? error.message : JSON.stringify(error);
      console.error("Failed to send chat message", message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      className={`flex h-full flex-col overflow-hidden bg-white${withBorder ? " rounded-2xl border border-neutral-200" : ""}${
        className ? ` ${className}` : ""
      }`}
    >
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <p className="text-sm text-neutral-500">Zatim zadne zpravy.</p>
        ) : (
          <ul className="space-y-2">
            {messages.map((message) => {
              const senderId = message.sender_id ?? message.user_id ?? null;
              const isMe = Boolean(currentUserId && senderId === currentUserId);
              const label = isMe ? "Ty" : otherLabel;
              return (
                <li key={message.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[70%] rounded-2xl px-3 py-2 text-sm shadow-sm ${
                      isMe ? "rounded-br-sm bg-neutral-900 text-white" : "rounded-bl-sm bg-neutral-100 text-neutral-900"
                    }`}
                  >
                    <div className={`text-[11px] ${isMe ? "text-white/70" : "text-neutral-500"}`}>{label}</div>
                    <div>{message.content}</div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <div ref={bottomRef} />
      </div>
      <form onSubmit={handleSubmit} className="flex items-center gap-2 border-t border-neutral-200 p-3">
        <input
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder="Napisete zpravu..."
          className="flex-1 rounded-full border border-neutral-200 px-4 py-2 text-sm text-neutral-900 outline-none focus:border-neutral-400"
        />
        <button
          type="submit"
          disabled={sending || !content.trim()}
          className="rounded-full bg-neutral-900 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          Odeslat
        </button>
      </form>
    </div>
  );
}
