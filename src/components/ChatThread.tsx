"use client";

import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { MoreHorizontal, X } from "lucide-react";
import { useChatMessages } from "@/hooks/useChatMessages";
import { useTypingIndicator } from "@/hooks/useTypingIndicator";
import { sendMessage } from "@/lib/chat";
import { safeIdentityLabel } from "@/lib/content-filter";
import { reportChatMessage, type ChatReportPayload } from "@/lib/chatReports";

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

function formatMessageTimeLabel(createdAt?: string | null) {
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

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function isYesterday(date: Date, now: Date) {
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  return isSameDay(date, yesterday);
}

function formatDateSeparatorLabel(date: Date, now: Date) {
  if (isSameDay(date, now)) {
    return "Dnes";
  }
  if (isYesterday(date, now)) {
    return "Včera";
  }

  const formatted = date.toLocaleDateString("cs-CZ", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

export function ChatThread({
  chatId,
  className,
  withBorder = true,
  currentUserId,
  otherUser,
}: ChatThreadProps) {
  const { messages, loading } = useChatMessages(chatId, currentUserId ?? null);
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [reportTarget, setReportTarget] = useState<{
    messageId: string;
    reportedUserId: string;
  } | null>(null);
  const [reportReason, setReportReason] = useState("harassment");
  const [reportDetails, setReportDetails] = useState("");
  const [reporting, setReporting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [reportedIds, setReportedIds] = useState<Set<string>>(new Set());
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const typingDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingIdleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingActiveRef = useRef(false);
  const { typingUsers, sendTyping } = useTypingIndicator(chatId, currentUserId ?? null);

  const otherLabel = useMemo(() => {
    const display = safeIdentityLabel(otherUser?.display_name ?? null, "");
    const username = safeIdentityLabel(otherUser?.username ?? null, "");
    return display || username || "Uživatel";
  }, [otherUser]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  const stopTyping = async () => {
    if (typingDebounceRef.current) {
      clearTimeout(typingDebounceRef.current);
      typingDebounceRef.current = null;
    }
    if (typingIdleRef.current) {
      clearTimeout(typingIdleRef.current);
      typingIdleRef.current = null;
    }
    typingActiveRef.current = false;
    await sendTyping(false);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!content.trim() || sending) {
      return;
    }

    setSending(true);
    try {
      await sendMessage(chatId, content);
      setContent("");
      await stopTyping();
    } catch (error) {
      const message = error instanceof Error ? error.message : JSON.stringify(error);
      console.error("Failed to send chat message", message);
    } finally {
      setSending(false);
    }
  };

  const scheduleTyping = (value: string) => {
    if (!currentUserId) return;
    if (!value.trim()) {
      void stopTyping();
      return;
    }

    if (typingDebounceRef.current) {
      clearTimeout(typingDebounceRef.current);
    }
    typingDebounceRef.current = setTimeout(() => {
      if (!typingActiveRef.current) {
        typingActiveRef.current = true;
        void sendTyping(true);
      }
    }, 400);

    if (typingIdleRef.current) {
      clearTimeout(typingIdleRef.current);
    }
    typingIdleRef.current = setTimeout(() => {
      void stopTyping();
    }, 2000);
  };

  useEffect(() => {
    return () => {
      if (typingDebounceRef.current) clearTimeout(typingDebounceRef.current);
      if (typingIdleRef.current) clearTimeout(typingIdleRef.current);
    };
  }, []);

  const openReport = (payload: { messageId: string; reportedUserId: string }) => {
    setReportTarget(payload);
    setReportReason("harassment");
    setReportDetails("");
    setOpenMenuId(null);
  };

  const handleReport = async () => {
    if (!reportTarget) return;
    if (!currentUserId) {
      setToast("Nejprve se přihlaste.");
      return;
    }
    if (reportedIds.has(reportTarget.messageId)) {
      setToast("Tuto zprávu už máte nahlášenou.");
      return;
    }

    setReporting(true);
    try {
      const payload: ChatReportPayload = {
        messageId: reportTarget.messageId,
        chatId,
        reportedUserId: reportTarget.reportedUserId,
        reason: reportReason,
        details: reportDetails.trim() || undefined,
      };
      const response = await reportChatMessage(payload);
      if (!response.ok) {
        throw new Error("Report failed");
      }
      setReportedIds((prev) => {
        const next = new Set(prev);
        next.add(reportTarget.messageId);
        return next;
      });
      setToast("Zpráva byla nahlášena. Děkujeme.");
      setReportTarget(null);
    } catch (error) {
      console.error("Report message failed", error);
      setToast("Nahlášení se nepovedlo. Zkuste to prosím znovu.");
    } finally {
      setReporting(false);
    }
  };

  return (
    <div
      className={`flex h-full min-h-0 flex-col overflow-hidden bg-white${
        withBorder ? " rounded-2xl border border-neutral-200" : ""
      }${
        className ? ` ${className}` : ""
      }`}
    >
      <div
        className="flex-1 space-y-3 overflow-y-auto overscroll-contain p-4"
        onClick={() => setOpenMenuId(null)}
      >
        {loading ? (
          <div className="space-y-3">
            <div className="h-8 w-40 animate-pulse rounded-full bg-neutral-100" />
            <div className="h-8 w-52 animate-pulse rounded-full bg-neutral-100" />
            <div className="h-8 w-32 animate-pulse rounded-full bg-neutral-100" />
          </div>
        ) : messages.length === 0 ? (
          <p className="text-sm text-neutral-500">Zatím žádné zprávy.</p>
        ) : (
          <ul className="space-y-2">
            {messages.map((message, index) => {
              const senderId = message.sender_id ?? message.user_id ?? null;
              const isMe = Boolean(currentUserId && senderId === currentUserId);
              const label = isMe ? "Ty" : otherLabel;
              const timeLabel = formatMessageTimeLabel(message.created_at);
              const messageDate = new Date(message.created_at ?? "");
              const prevDate =
                index > 0 ? new Date(messages[index - 1]?.created_at ?? "") : null;
              const now = new Date();
              const showSeparator =
                !prevDate ||
                Number.isNaN(prevDate.getTime()) ||
                Number.isNaN(messageDate.getTime()) ||
                !isSameDay(messageDate, prevDate);
              const showTime = message.created_at ? isSameDay(messageDate, now) : false;
              const isLastMine =
                isMe &&
                messages
                  .filter((m) => (m.sender_id ?? m.user_id ?? null) === currentUserId)
                  .at(-1)?.id === message.id;
              const readIndicator =
                isLastMine && (message.read_by ?? []).length > 0 ? "Přečteno" : "";
              const canReport = Boolean(
                senderId &&
                  currentUserId &&
                  senderId !== currentUserId &&
                  !reportedIds.has(message.id),
              );
              const showMenu = Boolean(senderId && currentUserId && senderId !== currentUserId);
              return (
                <li key={message.id} className="space-y-2">
                  {showSeparator ? (
                    <div className="flex items-center gap-3 py-2">
                      <div className="h-px flex-1 bg-neutral-200" />
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
                        {formatDateSeparatorLabel(messageDate, now)}
                      </span>
                      <div className="h-px flex-1 bg-neutral-200" />
                    </div>
                  ) : null}
                  <div className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`relative max-w-[70%] rounded-2xl px-3 py-2 text-sm shadow-sm ${
                        isMe ? "rounded-br-sm bg-neutral-900 text-white" : "rounded-bl-sm bg-neutral-100 text-neutral-900"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className={`text-[11px] ${isMe ? "text-white/70" : "text-neutral-500"}`}>{label}</div>
                        {showMenu ? (
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              setOpenMenuId((prev) => (prev === message.id ? null : message.id));
                            }}
                            className="rounded-full p-1 text-neutral-400 hover:bg-neutral-200"
                            aria-label="Menu zprávy"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                        ) : null}
                      </div>
                      <div>{message.content}</div>
                      {isMe ? (
                        showTime ? <div className="mt-1 text-[10px] text-white/50">{timeLabel}</div> : null
                      ) : showTime ? (
                        <div className="mt-1 text-[10px] text-neutral-400">{timeLabel}</div>
                      ) : null}
                      {openMenuId === message.id && showMenu ? (
                        <div
                          className={`absolute z-10 mt-2 w-48 rounded-lg border border-neutral-200 bg-white p-1 text-left text-xs text-neutral-800 shadow-lg ${
                            isMe ? "right-2" : "left-2"
                          } top-full`}
                          onClick={(event) => event.stopPropagation()}
                        >
                          <button
                            type="button"
                            disabled={!canReport}
                            onClick={() =>
                              senderId && openReport({ messageId: message.id, reportedUserId: senderId })
                            }
                            className="w-full rounded-md px-3 py-2 text-left text-xs text-neutral-800 transition hover:bg-neutral-100 disabled:cursor-not-allowed disabled:text-neutral-400"
                          >
                            Nahlásit zprávu
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                  {isMe && readIndicator ? (
                    <div className="flex justify-end">
                      <div className="mt-1 flex items-center gap-2 text-[10px] text-neutral-400">
                        {readIndicator ? <span>{readIndicator}</span> : null}
                      </div>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
        <div ref={bottomRef} />
      </div>
      {typingUsers.some((id) => id && id !== currentUserId) ? (
        <div className="px-4 pb-2">
          <div className="inline-flex items-center gap-2 rounded-2xl rounded-bl-sm bg-neutral-100 px-3 py-2 text-sm text-neutral-600 shadow-sm">
            <span className="text-[11px] text-neutral-500">{otherLabel}</span>
            <span className="flex items-center gap-1">
              <span
                className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-neutral-400"
                style={{ animationDelay: "0ms" }}
              />
              <span
                className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-neutral-400"
                style={{ animationDelay: "150ms" }}
              />
              <span
                className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-neutral-400"
                style={{ animationDelay: "300ms" }}
              />
            </span>
          </div>
        </div>
      ) : null}
      <form
        onSubmit={handleSubmit}
        className="sticky bottom-0 z-10 flex items-center gap-2 border-t border-neutral-200 bg-white px-4 py-2 pb-[calc(env(safe-area-inset-bottom)+8px)]"
      >
        <input
          value={content}
          onChange={(event) => {
            const next = event.target.value;
            setContent(next);
            scheduleTyping(next);
          }}
          onBlur={() => void stopTyping()}
          placeholder="Napište zprávu…"
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

      {reportTarget ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/60 px-4 py-6"
          role="dialog"
          aria-modal="true"
          onClick={() => setReportTarget(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-4 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-neutral-900">Nahlásit zprávu</h2>
              <button
                type="button"
                onClick={() => setReportTarget(null)}
                className="rounded-full p-2 text-neutral-500 transition hover:bg-neutral-100"
                aria-label="Zavřít"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <label className="block text-xs font-semibold text-neutral-600">Důvod</label>
              <select
                value={reportReason}
                onChange={(event) => setReportReason(event.target.value)}
                className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm text-neutral-900"
              >
                <option value="harassment">Obtěžování / harassment</option>
                <option value="spam">Spam</option>
                <option value="sexual">Sexuální obsah</option>
                <option value="violence">Násilí</option>
                <option value="other">Jiné</option>
              </select>

              <label className="block text-xs font-semibold text-neutral-600">Popis (volitelné)</label>
              <textarea
                value={reportDetails}
                onChange={(event) => setReportDetails(event.target.value)}
                rows={3}
                className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm text-neutral-900"
                placeholder="Doplňte podrobnosti…"
              />
            </div>

            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={handleReport}
                disabled={reporting}
                className="rounded-full bg-neutral-900 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                Odeslat hlášení
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {toast ? (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-neutral-900 px-4 py-2 text-sm text-white shadow-lg">
          {toast}
        </div>
      ) : null}
    </div>
  );
}
