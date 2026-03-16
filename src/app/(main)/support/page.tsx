"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { ChevronLeft, MessageCircle } from "lucide-react";
import { useLocale, useTranslations } from "@/components/i18n/LocaleProvider";
import { getIntlLocale } from "@/lib/i18n";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { requestAuth } from "@/lib/auth-required";
import { useSupportMessages } from "@/hooks/useSupportMessages";

type SupportThread = {
  id: string;
  status: "open" | "closed" | string;
};

type SupportDevicePayload = {
  userAgent?: string | null;
  platform?: string | null;
  language?: string | null;
  timezone?: string | null;
  viewportWidth?: number | null;
  viewportHeight?: number | null;
  screenWidth?: number | null;
  screenHeight?: number | null;
  pixelRatio?: number | null;
};

function collectSupportDevicePayload(): SupportDevicePayload {
  if (typeof window === "undefined") return {};
  const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
  return {
    userAgent: nav.userAgent ?? null,
    platform: nav.userAgentData?.platform ?? nav.platform ?? null,
    language: nav.language ?? null,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone ?? null,
    viewportWidth: Number.isFinite(window.innerWidth) ? window.innerWidth : null,
    viewportHeight: Number.isFinite(window.innerHeight) ? window.innerHeight : null,
    screenWidth: Number.isFinite(window.screen?.width) ? window.screen.width : null,
    screenHeight: Number.isFinite(window.screen?.height) ? window.screen.height : null,
    pixelRatio: Number.isFinite(window.devicePixelRatio) ? window.devicePixelRatio : null,
  };
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function isYesterday(date: Date, now: Date) {
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  return isSameDay(date, yesterday);
}

function formatDateSeparatorLabel(locale: string, date: Date, now: Date) {
  if (isSameDay(date, now)) return locale.startsWith("en") ? "Today" : "Dnes";
  if (isYesterday(date, now)) return locale.startsWith("en") ? "Yesterday" : "Včera";
  const formatted = date.toLocaleDateString(getIntlLocale(locale), {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

function formatMessageTimeLabel(locale: string, createdAt?: string | null) {
  if (!createdAt) return "";
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString(getIntlLocale(locale), {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function SupportPage() {
  const t = useTranslations();
  const { locale } = useLocale();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [thread, setThread] = useState<SupportThread | null>(null);
  const [loadingThread, setLoadingThread] = useState(true);
  const [threadError, setThreadError] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [showChat, setShowChat] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const threadId = thread?.id ?? null;
  const { messages, loading } = useSupportMessages(threadId);

  useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!active) return;
      setCurrentUserId(data.user?.id ?? null);
    });

    return () => {
      active = false;
    };
  }, [supabase]);

  useEffect(() => {
    if (!showChat) {
      setThread(null);
      setLoadingThread(false);
      setThreadError(null);
      return;
    }
    if (!currentUserId) {
      setThread(null);
      setLoadingThread(false);
      requestAuth({ message: "Přihlaste se pro podporu." });
      return;
    }

    let active = true;
    setLoadingThread(true);
    setThreadError(null);

    const loadThread = async () => {
      const response = await fetch("/api/support/thread", {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });
      const payload = (await response.json().catch(() => null)) as
        | { thread?: SupportThread; error?: string; message?: string }
        | null;

      if (!active) return;

      if (!response.ok || !payload?.thread?.id) {
        console.error("Support thread fetch failed", payload?.message ?? payload?.error);
        setThreadError("Nepodařilo se načíst podporu.");
        setLoadingThread(false);
        return;
      }

      setThread({ id: payload.thread.id, status: payload.thread.status ?? "open" });
      setLoadingThread(false);
    };

    void loadThread();

    return () => {
      active = false;
    };
  }, [currentUserId, showChat]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!content.trim() || !threadId || sending) return;

    setSending(true);
    setSendError(null);
    try {
      const response = await fetch("/api/support/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          threadId,
          content: content.trim(),
          device: collectSupportDevicePayload(),
        }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { message?: string; error?: string } | null;
        setSendError(payload?.message ?? payload?.error ?? t("support.sendError"));
        return;
      }
      const payload = (await response.json().catch(() => null)) as
        | { ok?: boolean; threadId?: string; status?: string }
        | null;
      if (payload?.threadId) {
        setThread({ id: payload.threadId, status: payload.status ?? "open" });
      } else {
        setThread((prev) => (prev ? { ...prev, status: "open" } : prev));
      }
      setContent("");
    } finally {
      setSending(false);
    }
  };

  if (showChat) {
    return (
      <main className="flex h-[calc(100dvh-80px)] min-h-[calc(100svh-80px)] overflow-hidden bg-neutral-50 md:h-screen md:overflow-hidden">
        <section className="flex h-full w-full flex-1 flex-col gap-0 px-0 py-0 md:px-8 md:py-8 min-h-0">
          <header className="hidden items-center justify-between gap-4 md:flex">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-neutral-900">{t("support.title")}</h1>
              <p className="text-sm text-neutral-600">{t("support.chatDescription")}</p>
            </div>
          </header>

          <div className="grid flex-1 min-h-0 gap-4">
            <section className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white md:rounded-2xl md:border md:border-neutral-200 md:shadow-sm">
              <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setShowChat(false)}
                    className="rounded-full p-2 text-neutral-600 transition hover:bg-neutral-100 md:hidden"
                    aria-label={t("support.backAria")}
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-100 text-neutral-700">
                    <MessageCircle className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-neutral-900">{t("support.chatTitle")}</div>
                    <div className="text-xs text-neutral-500">
                      {thread?.status === "closed" ? t("support.threadClosed") : t("support.threadOpen")}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowChat(false)}
                  className="hidden rounded-full px-3 py-1 text-xs font-semibold text-neutral-600 transition hover:bg-neutral-100 md:inline-flex"
                >
                  {t("support.closeChat")}
                </button>
              </div>

              <div className="flex-1 min-h-0 space-y-3 overflow-y-auto overscroll-contain p-4 pb-[calc(env(safe-area-inset-bottom)+120px)] md:pb-4">
                {threadError ? (
                  <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{threadError}</div>
                ) : loadingThread || loading ? (
                  <div className="space-y-3">
                    <div className="h-8 w-40 animate-pulse rounded-full bg-neutral-100" />
                    <div className="h-8 w-52 animate-pulse rounded-full bg-neutral-100" />
                    <div className="h-8 w-32 animate-pulse rounded-full bg-neutral-100" />
                  </div>
                ) : messages.length === 0 ? (
                  <p className="text-sm text-neutral-500">{t("support.noMessages")}</p>
                ) : (
                  <ul className="space-y-2">
                    {messages.map((message, index) => {
                      const isSystem = message.sender_type === "system";
                      const isUser = message.sender_type === "user" && message.sender_user_id === currentUserId;
                      const messageDate = new Date(message.created_at ?? "");
                      const prevDate =
                        index > 0 ? new Date(messages[index - 1]?.created_at ?? "") : null;
                      const nowDate = new Date();
                      const showSeparator =
                        !prevDate ||
                        Number.isNaN(prevDate.getTime()) ||
                        Number.isNaN(messageDate.getTime()) ||
                        !isSameDay(messageDate, prevDate);

                      return (
                        <li key={message.id} className="space-y-2">
                          {showSeparator ? (
                            <div className="flex items-center gap-3 py-2">
                              <div className="h-px flex-1 bg-neutral-200" />
                              <span className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
                                {formatDateSeparatorLabel(locale, messageDate, nowDate)}
                              </span>
                              <div className="h-px flex-1 bg-neutral-200" />
                            </div>
                          ) : null}
                          <div
                            className={`flex ${
                              isSystem ? "justify-center" : isUser ? "justify-end" : "justify-start"
                            }`}
                          >
                            <div
                              className={`max-w-[70%] rounded-2xl px-3 py-2 text-sm shadow-sm ${
                                isSystem
                                  ? "bg-neutral-100 text-neutral-600"
                                  : isUser
                                  ? "rounded-br-sm bg-neutral-900 text-white"
                                  : "rounded-bl-sm bg-neutral-100 text-neutral-900"
                              }`}
                            >
                              {!isSystem ? (
                                <div className={`text-[11px] ${isUser ? "text-white/70" : "text-neutral-500"}`}>
                                  {isUser ? t("support.you") : t("support.supportTeam")}
                                </div>
                              ) : null}
                              <div>{message.content}</div>
                              <div
                                className={`mt-1 text-right text-[10px] ${
                                  isUser ? "text-white/50" : "text-neutral-400"
                                }`}
                              >
                                {formatMessageTimeLabel(locale, message.created_at)}
                              </div>
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
                {thread?.status === "closed" ? (
                  <div className="flex items-center gap-3 py-2">
                    <div className="h-px flex-1 bg-neutral-200" />
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
                      {t("support.threadClosed")}
                    </span>
                    <div className="h-px flex-1 bg-neutral-200" />
                  </div>
                ) : null}
                <div ref={bottomRef} />
              </div>

              <div className="fixed inset-x-0 bottom-[calc(80px+env(safe-area-inset-bottom))] z-20 border-t border-neutral-200 bg-white px-4 py-2 pb-[calc(env(safe-area-inset-bottom)+8px)] md:static md:bottom-auto md:z-auto md:shrink-0">
                {sendError ? (
                  <div className="mb-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                    {sendError}
                  </div>
                ) : null}
                {loadingThread || !threadId ? (
                  <div className="mb-2 text-xs text-neutral-500">{t("support.loadingThread")}</div>
                ) : null}
                <form onSubmit={handleSubmit} className="flex items-center gap-2">
                  <input
                    value={content}
                    onChange={(event) => setContent(event.target.value)}
                    placeholder={t("support.messagePlaceholder")}
                    disabled={!threadId || loadingThread}
                    className="flex-1 rounded-full border border-neutral-200 px-4 py-2 text-sm text-neutral-900 outline-none focus:border-neutral-400 disabled:cursor-not-allowed disabled:bg-neutral-50"
                  />
                  <button
                    type="submit"
                    disabled={sending || !content.trim() || !threadId || loadingThread}
                    className="rounded-full bg-neutral-900 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {t("common.actions.send")}
                  </button>
                </form>
              </div>
            </section>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white mx-auto max-w-4xl px-4 py-10 space-y-6">
      <header className="space-y-1">
        <p className="text-xs uppercase tracking-[0.2em] text-neutral-600">{t("support.eyebrow")}</p>
        <h1 className="text-3xl font-semibold text-neutral-900">{t("support.title")}</h1>
        <p className="text-sm text-neutral-700">{t("support.description")}</p>
      </header>

      {threadError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{threadError}</div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded-xl border border-neutral-200/70 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-neutral-900">{t("support.contactTitle")}</h2>
          <p className="mt-2 text-sm text-neutral-700">
            {t("support.contactText")}
          </p>
          <button
            onClick={() => setShowChat(true)}
            className="mt-4 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800"
          >
            {t("support.openSupportChat")}
          </button>
        </section>

        <section className="rounded-xl border border-neutral-200/70 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-neutral-900">{t("support.reportIssueTitle")}</h2>
          <p className="mt-2 text-sm text-neutral-700">
            {t("support.reportIssueText")}
          </p>
          <button className="mt-4 rounded-lg border border-neutral-200/70 px-4 py-2 text-sm font-medium text-neutral-800 transition hover:border-neutral-400">
            {t("support.sendReport")}
          </button>
        </section>
      </div>

      <section className="rounded-xl border border-neutral-200/70 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-neutral-900">{t("support.faqTitle")}</h2>
        <ul className="mt-3 space-y-2 text-sm text-neutral-700">
          <li>• Jak změnit heslo nebo e-mail.</li>
          <li>• Jak upravit profil nebo smazat účet.</li>
          <li>• Řešení problémů s přihlášením a notifikacemi.</li>
        </ul>
      </section>
    </main>
  );
}
