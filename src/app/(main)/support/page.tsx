"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { requestAuth } from "@/lib/auth-required";
import { useSupportMessages } from "@/hooks/useSupportMessages";

type SupportThread = {
  id: string;
  status: "open" | "closed" | string;
};

export default function SupportPage() {
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
    if (!content.trim() || !threadId || sending || thread?.status === "closed") return;

    setSending(true);
    setSendError(null);
    try {
      const response = await fetch("/api/support/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threadId, content: content.trim() }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { message?: string; error?: string } | null;
        setSendError(payload?.message ?? payload?.error ?? "Odeslání selhalo.");
        return;
      }
      setContent("");
    } finally {
      setSending(false);
    }
  };

  if (showChat) {
    return (
      <main className="min-h-[100dvh] bg-white">
        <section className="mx-auto flex h-[calc(100dvh-80px)] min-h-0 max-w-4xl flex-col overflow-hidden rounded-2xl border border-neutral-200 shadow-sm sm:mt-4">
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-neutral-100 bg-white px-4 py-3">
            <div>
              <div className="text-sm font-semibold text-neutral-900">Support chat</div>
              {thread?.status === "closed" ? (
                <div className="text-xs text-neutral-500">Uzavřená konverzace</div>
              ) : (
                <div className="text-xs text-neutral-500">Otevřené vlákno</div>
              )}
            </div>
            <button
              type="button"
              onClick={() => setShowChat(false)}
              className="rounded-full px-3 py-1 text-xs font-semibold text-neutral-600 transition hover:bg-neutral-100"
            >
              Zavřít chat
            </button>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto overscroll-contain p-4">
            {threadError ? (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{threadError}</div>
            ) : loadingThread || loading ? (
              <div className="space-y-3">
                <div className="h-8 w-40 animate-pulse rounded-full bg-neutral-100" />
                <div className="h-8 w-52 animate-pulse rounded-full bg-neutral-100" />
                <div className="h-8 w-32 animate-pulse rounded-full bg-neutral-100" />
              </div>
            ) : messages.length === 0 ? (
              <p className="text-sm text-neutral-500">Zatím žádné zprávy.</p>
            ) : (
              <ul className="space-y-2">
                {messages.map((message) => {
                  const isSystem = message.sender_type === "system";
                  const isUser = message.sender_type === "user" && message.sender_user_id === currentUserId;
                  return (
                    <li
                      key={message.id}
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
                            {isUser ? "Ty" : "Podpora"}
                          </div>
                        ) : null}
                        <div>{message.content}</div>
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
                  Uzavřená konverzace
                </span>
                <div className="h-px flex-1 bg-neutral-200" />
              </div>
            ) : null}
            <div ref={bottomRef} />
          </div>

          {sendError ? (
            <div className="mx-4 mb-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {sendError}
            </div>
          ) : null}

          <div className="sticky bottom-0 z-10 border-t border-neutral-200 bg-white p-3 pb-[env(safe-area-inset-bottom)]">
            {loadingThread || !threadId ? (
              <div className="mb-2 text-xs text-neutral-500">Načítám vlákno podpory…</div>
            ) : thread?.status === "closed" ? (
              <div className="mb-2 text-xs text-neutral-500">Konverzace je uzavřená.</div>
            ) : null}
            <form onSubmit={handleSubmit} className="flex items-center gap-2">
              <input
                value={content}
                onChange={(event) => setContent(event.target.value)}
                placeholder={thread?.status === "closed" ? "Konverzace je uzavřená" : "Napište zprávu…"}
                disabled={thread?.status === "closed" || !threadId || loadingThread}
                className="flex-1 rounded-full border border-neutral-200 px-4 py-2 text-sm text-neutral-900 outline-none focus:border-neutral-400 disabled:cursor-not-allowed disabled:bg-neutral-50"
              />
              <button
                type="submit"
                disabled={sending || !content.trim() || thread?.status === "closed" || !threadId || loadingThread}
                className="rounded-full bg-neutral-900 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                Odeslat
              </button>
            </form>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white mx-auto max-w-4xl px-4 py-10 space-y-6">
      <header className="space-y-1">
        <p className="text-xs uppercase tracking-[0.2em] text-neutral-600">Centrum pomoci</p>
        <h1 className="text-3xl font-semibold text-neutral-900">Podpora</h1>
        <p className="text-sm text-neutral-700">Napište nám, rádi pomůžeme.</p>
      </header>

      {threadError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{threadError}</div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded-xl border border-neutral-200/70 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-neutral-900">Kontakt</h2>
          <p className="mt-2 text-sm text-neutral-700">
            support@nrw.app nebo in-app chat s podporou. Reagujeme co nejdřív.
          </p>
          <button
            onClick={() => setShowChat(true)}
            className="mt-4 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800"
          >
            Otevřít chat s podporou
          </button>
        </section>

        <section className="rounded-xl border border-neutral-200/70 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-neutral-900">Nahlásit problém</h2>
          <p className="mt-2 text-sm text-neutral-700">
            Napiš, co nefunguje nebo co bys chtěl vylepšit. Pomůžeš nám to opravit.
          </p>
          <button className="mt-4 rounded-lg border border-neutral-200/70 px-4 py-2 text-sm font-medium text-neutral-800 transition hover:border-neutral-400">
            Odeslat hlášení
          </button>
        </section>
      </div>

      <section className="rounded-xl border border-neutral-200/70 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-neutral-900">FAQ</h2>
        <ul className="mt-3 space-y-2 text-sm text-neutral-700">
          <li>• Jak změnit heslo nebo e-mail.</li>
          <li>• Jak upravit profil nebo smazat účet.</li>
          <li>• Řešení problémů s přihlášením a notifikacemi.</li>
        </ul>
      </section>
    </main>
  );
}
