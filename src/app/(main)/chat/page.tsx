"use client";

import { ChevronLeft, Info, MessageCircle, Plus, Search, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { requestAuth } from "@/lib/auth-required";
import { getOrCreateDirectChat } from "@/lib/chat";
import { ChatThread } from "@/components/ChatThread";
import { useOnlineUsers, useUserPresence } from "@/lib/presence/useUserPresence";
import { formatLastSeen, getLastSeenTone } from "@/lib/time/formatLastSeen";
import {
  AUTH_SESSION_KEY,
  AUTH_SESSION_TTL_MS,
  canHydrateFromSession,
  readSessionCache,
  writeSessionCache,
} from "@/lib/session-cache";

type ProfileLite = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  last_seen?: string | null;
};

type ChatSummary = {
  id: string;
  other: ProfileLite | null;
  lastMessageAt?: string | null;
};

const CHAT_CACHE_KEY = "nrw.chat.threads";
const CHAT_CACHE_TTL_MS = 30000;

function profileLabel(profile: ProfileLite | null) {
  const name = profile?.display_name?.trim() || profile?.username?.trim() || "nChat";
  const username = profile?.username?.trim();
  return { name, username: username ? `@${username}` : null };
}

function profileInitial(profile: ProfileLite | null) {
  const label = profile?.display_name?.trim() || profile?.username?.trim() || "N";
  return label.charAt(0).toUpperCase();
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function isYesterday(date: Date, now: Date) {
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  return isSameDay(date, yesterday);
}

function formatLastMessageLabel(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const now = new Date();
  if (isSameDay(date, now)) return "dnes";
  if (isYesterday(date, now)) return "včera";

  const day = date.getDate();
  const month = date.getMonth() + 1;
  const year = date.getFullYear();
  if (year === now.getFullYear()) {
    return `${day}.${month}`;
  }
  return `${day}.${month}.${year}`;
}

function sortChatsByRecent(a: ChatSummary, b: ChatSummary) {
  const aParsed = a.lastMessageAt ? Date.parse(a.lastMessageAt) : 0;
  const bParsed = b.lastMessageAt ? Date.parse(b.lastMessageAt) : 0;
  const aTime = Number.isFinite(aParsed) ? aParsed : 0;
  const bTime = Number.isFinite(bParsed) ? bParsed : 0;
  return bTime - aTime;
}

export default function ChatPage() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const searchParams = useSearchParams();
  const canHydrate = canHydrateFromSession();
  const initialUserId = canHydrate
    ? readSessionCache<string | null>(AUTH_SESSION_KEY, AUTH_SESSION_TTL_MS)
    : null;
  const initialChats =
    canHydrate && initialUserId
      ? readSessionCache<ChatSummary[]>(CHAT_CACHE_KEY, CHAT_CACHE_TTL_MS, initialUserId)
      : null;
  const hasInitialChats = initialChats !== null;
  const requestedChatId = searchParams.get("chatId");
  const appliedChatIdRef = useRef(false);

  const [currentUserId, setCurrentUserId] = useState<string | null>(initialUserId);
  const [chats, setChats] = useState<ChatSummary[]>(() => initialChats ?? []);
  const [activeChatId, setActiveChatId] = useState<string>("");
  const [loadingChats, setLoadingChats] = useState(() => !hasInitialChats);
  const [chatError, setChatError] = useState<string | null>(null);
  const [isDesktop, setIsDesktop] = useState(false);
  const [mobileView, setMobileView] = useState<"list" | "chat">("list");
  const [showInfo, setShowInfo] = useState(false);
  const refetchedForRequestedChat = useRef(false);

  const [newChatOpen, setNewChatOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ProfileLite[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [creatingUserId, setCreatingUserId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(({ data, error }) => {
      if (!active) return;
      if (error) {
        console.error("Failed to fetch user", error);
        setCurrentUserId(null);
        return;
      }
      const resolvedUserId = data.user?.id ?? null;
      setCurrentUserId(resolvedUserId);
      writeSessionCache(AUTH_SESSION_KEY, resolvedUserId, resolvedUserId ?? null);
    });

    return () => {
      active = false;
    };
  }, [supabase]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia("(min-width: 768px)");
    const update = () => setIsDesktop(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  const fetchChats = useCallback(async () => {
    if (!currentUserId) {
      setChats([]);
      setLoadingChats(false);
      return;
    }

    const cached = readSessionCache<ChatSummary[]>(CHAT_CACHE_KEY, CHAT_CACHE_TTL_MS, currentUserId);
    if (cached) {
      setChats(cached);
      setLoadingChats(false);
    } else {
      setLoadingChats(true);
    }
    setChatError(null);

    const response = await fetch("/api/chat/threads", {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    const payload = (await response.json().catch(() => null)) as
      | { chats?: ChatSummary[]; error?: string }
      | null;

    if (!response.ok || !payload?.chats) {
      console.error("Failed to fetch chats", payload?.error);
      if (!cached) {
        setChatError("Nepodarilo se nacist chaty.");
      }
      setLoadingChats(false);
      return;
    }

    const sorted = [...payload.chats].sort(sortChatsByRecent);
    setChats(sorted);
    writeSessionCache(CHAT_CACHE_KEY, sorted, currentUserId);
    setLoadingChats(false);
  }, [currentUserId]);

  useEffect(() => {
    void fetchChats();
  }, [fetchChats]);

  useEffect(() => {
    if (appliedChatIdRef.current) return;
    if (!requestedChatId) return;
    refetchedForRequestedChat.current = false;
    setActiveChatId(requestedChatId);
    setMobileView("chat");
    appliedChatIdRef.current = true;
  }, [requestedChatId]);

  useEffect(() => {
    if (!requestedChatId || loadingChats) return;
    if (chats.some((chat) => chat.id === requestedChatId)) return;
    if (refetchedForRequestedChat.current) return;
    refetchedForRequestedChat.current = true;
    void fetchChats();
  }, [chats, fetchChats, loadingChats, requestedChatId]);

  useEffect(() => {
    if (!isDesktop) return;
    if (!chats.length && activeChatId) {
      setActiveChatId("");
    }
  }, [activeChatId, chats.length, isDesktop]);

  useEffect(() => {
    if (!newChatOpen) {
      setSearchQuery("");
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }

    if (!currentUserId) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }

    const term = searchQuery.trim();
    if (!term) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }

    let active = true;
    setSearchLoading(true);
    const handle = setTimeout(async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url")
        .or(`username.ilike.%${term}%,display_name.ilike.%${term}%`)
        .limit(10);

      if (!active) return;

      if (error) {
        console.error("Search profiles failed", error);
        setSearchResults([]);
        setSearchLoading(false);
        return;
      }

      const rows = (data ?? []).filter((row) => row.id !== currentUserId) as ProfileLite[];
      setSearchResults(rows);
      setSearchLoading(false);
    }, 300);

    return () => {
      active = false;
      clearTimeout(handle);
    };
  }, [currentUserId, newChatOpen, searchQuery, supabase]);

  const activeChat = chats.find((chat) => chat.id === activeChatId) ?? null;

  const handleOpenNewChat = () => {
    if (!currentUserId) {
      requestAuth({ message: "Přihlaste se pro nChat." });
      return;
    }
    setNewChatOpen(true);
  };

  const handleSelectChat = (chatId: string) => {
    setActiveChatId(chatId);
    setMobileView("chat");
    setShowInfo(false);
  };

  const handleOpenInfo = () => {
    if (!activeChat?.other) return;
    setShowInfo(true);
  };

  const handleSelectUser = async (profile: ProfileLite) => {
    if (!currentUserId) {
      requestAuth({ message: "Přihlaste se pro nChat." });
      return;
    }

    setCreatingUserId(profile.id);
    try {
      const chatId = await getOrCreateDirectChat(profile.id);
      setChats((prev) => {
        if (prev.some((chat) => chat.id === chatId)) {
          return prev;
        }
        return [{ id: chatId, other: profile }, ...prev];
      });
      setActiveChatId(chatId);
      setMobileView("chat");
      setNewChatOpen(false);
    } catch (error) {
      console.error("Failed to start direct chat", error);
    } finally {
      setCreatingUserId(null);
    }
  };

  return (
    <main className="flex h-[calc(100dvh-80px)] min-h-[calc(100svh-80px)] overflow-hidden bg-neutral-50 md:h-screen md:overflow-hidden">
      <section className="flex h-full w-full flex-1 flex-col gap-0 px-0 py-0 md:gap-4 md:px-8 md:py-8 min-h-0">
        <header className="hidden md:flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-neutral-900">nChat</h1>
            <p className="text-sm text-neutral-600">Rychlé zprávy, rooms i reakce.</p>
          </div>
          <div className="hidden md:block" aria-hidden />
        </header>

        <div className="grid flex-1 min-h-0 gap-4 md:gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
          <aside
            className={`flex min-h-0 flex-col overflow-hidden bg-white ${
              mobileView === "chat" ? "hidden" : "flex"
            } md:flex md:rounded-2xl md:border md:border-neutral-200 md:shadow-sm`}
          >
            <SidebarHeader onNewChat={handleOpenNewChat} />
            {chatError ? (
              <div className="p-4 text-sm text-red-600">{chatError}</div>
            ) : loadingChats ? (
              <ThreadListSkeleton />
            ) : (
              <ThreadList chats={chats} activeChatId={activeChatId} onSelect={handleSelectChat} />
            )}
          </aside>

          <section
            className={`flex min-h-0 flex-col ${mobileView === "chat" ? "flex" : "hidden"} md:flex`}
          >
            {activeChatId ? (
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white md:rounded-2xl md:border md:border-neutral-200 md:shadow-sm">
                <ThreadHeader
                  chatId={activeChatId}
                  profile={activeChat?.other ?? null}
                  onBack={() => {
                    setActiveChatId("");
                    setMobileView("list");
                    setShowInfo(false);
                  }}
                  onInfo={handleOpenInfo}
                />
                {showInfo && activeChat?.other ? (
                  <ChatInfoPanel profile={activeChat.other} onClose={() => setShowInfo(false)} />
                ) : (
                  <ChatThread
                    chatId={activeChatId}
                    withBorder={false}
                    className="flex-1"
                    currentUserId={currentUserId}
                    otherUser={activeChat?.other ?? null}
                  />
                )}
              </div>
            ) : (
              <div className="flex min-h-0 flex-1 items-center justify-center bg-white md:rounded-2xl md:border md:border-dashed md:border-neutral-200">
                <div className="flex max-w-sm flex-col items-center gap-4 px-6 py-10 text-center">
                  <div className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-neutral-900 text-neutral-900">
                    <MessageCircle className="h-8 w-8" />
                  </div>
                  <div>
                    <p className="text-lg font-semibold text-neutral-900">Vaše zprávy</p>
                    <p className="mt-1 text-sm text-neutral-500">
                      Pošlete příteli nebo skupině soukromé fotky a zprávy.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleOpenNewChat}
                    className="rounded-full bg-neutral-900 px-5 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800"
                  >
                    Odeslat zprávu
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>
      </section>

      <NewChatOverlay
        open={newChatOpen}
        query={searchQuery}
        loading={searchLoading}
        results={searchResults}
        creatingUserId={creatingUserId}
        onClose={() => setNewChatOpen(false)}
        onQueryChange={setSearchQuery}
        onSelect={handleSelectUser}
      />
    </main>
  );
}

function SearchBar() {
  return (
    <div className="flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-700 shadow-sm">
      <Search className="h-4 w-4 text-neutral-400" />
      <input
        type="search"
        placeholder="Hledej lidi nebo vlákna"
        className="w-48 bg-transparent text-sm text-neutral-800 outline-none placeholder:text-neutral-400"
      />
    </div>
  );
}

function SidebarHeader({ onNewChat }: { onNewChat: () => void }) {
  return (
    <div className="border-b border-neutral-100 px-4 py-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-neutral-500">Chaty</p>
          <p className="text-sm text-neutral-600">Tvůj hlavní inbox</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onNewChat}
            className="rounded-full border border-neutral-200 p-2 text-neutral-600 transition hover:border-neutral-300 hover:bg-neutral-50"
            aria-label="Nový chat"
          >
            <Plus className="h-4 w-4" />
          </button>
          <MessageCircle className="h-5 w-5 text-neutral-400" />
        </div>
      </div>
      <div className="mt-3">
        <SearchBar />
      </div>
    </div>
  );
}

function ThreadList({
  chats,
  activeChatId,
  onSelect,
}: {
  chats: ChatSummary[];
  activeChatId: string;
  onSelect: (id: string) => void;
}) {
  const { onlineIds } = useOnlineUsers();
  if (!chats.length) {
    return (
      <div className="flex flex-1 items-center justify-center px-4 py-10 text-sm text-neutral-500">
        Začni nový chat.
      </div>
    );
  }

  return (
    <div className="divide-y divide-neutral-100">
      {chats.map((chat) => {
        const { name, username } = profileLabel(chat.other);
        const isActive = chat.id === activeChatId;
        const lastLabel = formatLastMessageLabel(chat.lastMessageAt);
        const isOnline = Boolean(chat.other?.id && onlineIds.has(chat.other.id));
        const lastSeenTone = getLastSeenTone(chat.other?.last_seen ?? null);
        const offlineDot =
          isOnline ? "bg-emerald-500" : lastSeenTone === "recent" ? "bg-orange-400" : "bg-red-400";
        return (
          <button
            key={chat.id}
            onClick={() => onSelect(chat.id)}
            className={`flex w-full items-center gap-3 px-4 py-3 text-left transition ${
              isActive ? "bg-neutral-900 text-white shadow-inner" : "hover:bg-neutral-50"
            }`}
          >
            <div className="relative">
              {chat.other?.avatar_url ? (
                <img
                  src={chat.other.avatar_url}
                  alt={name}
                  className={`h-10 w-10 rounded-full object-cover ring-2 ${
                    isActive ? "ring-white/40" : "ring-neutral-100"
                  }`}
                  onError={(event) => ((event.currentTarget as HTMLImageElement).style.display = "none")}
                />
              ) : (
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-full bg-neutral-900 text-sm font-semibold text-white ring-2 ${
                    isActive ? "ring-white/40" : "ring-neutral-100"
                  }`}
                >
                  {profileInitial(chat.other)}
                </div>
              )}
              <span
                className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full ring-2 ${
                  isActive ? "ring-neutral-900" : "ring-white"
                } ${offlineDot}`}
                aria-hidden
              />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className={`text-sm font-semibold ${isActive ? "text-white" : "text-neutral-900"}`}>{name}</span>
                {lastLabel ? (
                  <span className={`text-[11px] ${isActive ? "text-white/70" : "text-neutral-400"}`}>
                    {lastLabel}
                  </span>
                ) : null}
              </div>
              <div className={`text-xs ${isActive ? "text-white/80" : "text-neutral-500"}`}>
                {username ?? "Direct chat"}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function ThreadListSkeleton() {
  return (
    <div className="space-y-3 p-4">
      <div className="h-12 w-full animate-pulse rounded-xl bg-neutral-100" />
      <div className="h-12 w-full animate-pulse rounded-xl bg-neutral-100" />
      <div className="h-12 w-full animate-pulse rounded-xl bg-neutral-100" />
    </div>
  );
}

function ThreadHeader({
  chatId,
  profile,
  onBack,
  onInfo,
}: {
  chatId: string;
  profile: ProfileLite | null;
  onBack?: () => void;
  onInfo?: () => void;
}) {
  const { name, username } = profileLabel(profile);
  const { isOnline } = useUserPresence(profile?.id ?? null);
  const lastSeenLabel = isOnline ? "Online" : formatLastSeen(profile?.last_seen ?? null);
  const lastSeenTone = getLastSeenTone(profile?.last_seen ?? null);
  const statusDot = isOnline
    ? "bg-emerald-500"
    : lastSeenTone === "recent"
    ? "bg-orange-400"
    : "bg-red-400";
  return (
    <div className="sticky top-0 z-10 flex items-center justify-between border-b border-neutral-100 bg-white px-4 py-3">
      <div className="flex items-center gap-3">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="md:hidden rounded-full p-2 text-neutral-500 transition hover:bg-neutral-100"
            aria-label="Zpět na chaty"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        ) : null}
        {profile?.username ? (
          <Link
            href={`/id/${profile.username}?fromChatId=${encodeURIComponent(chatId)}`}
            className="flex items-center gap-3"
          >
            {profile?.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={name}
                className="h-10 w-10 rounded-full object-cover ring-2 ring-neutral-100"
                onError={(event) => ((event.currentTarget as HTMLImageElement).style.display = "none")}
              />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-neutral-800 to-neutral-600 text-sm font-semibold text-white ring-2 ring-neutral-100">
                {profileInitial(profile)}
              </div>
            )}
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-neutral-900">{name}</span>
                {username ? <span className="text-[11px] text-neutral-500">{username}</span> : null}
              </div>
              {profile?.id ? (
                <div className="flex items-center gap-2 text-[11px] text-neutral-500">
                  <span className={`inline-flex h-2 w-2 rounded-full ${statusDot}`} />
                  <span>{isOnline ? "Online" : lastSeenLabel}</span>
                </div>
              ) : (
                <div className="text-[11px] text-neutral-500">Direct chat</div>
              )}
            </div>
          </Link>
        ) : (
          <>
            {profile?.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={name}
                className="h-10 w-10 rounded-full object-cover ring-2 ring-neutral-100"
                onError={(event) => ((event.currentTarget as HTMLImageElement).style.display = "none")}
              />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-neutral-800 to-neutral-600 text-sm font-semibold text-white ring-2 ring-neutral-100">
                {profileInitial(profile)}
              </div>
            )}
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-neutral-900">{name}</span>
                {username ? <span className="text-[11px] text-neutral-500">{username}</span> : null}
              </div>
              {profile?.id ? (
                <div className="flex items-center gap-2 text-[11px] text-neutral-500">
                  <span className={`inline-flex h-2 w-2 rounded-full ${statusDot}`} />
                  <span>{isOnline ? "Online" : lastSeenLabel}</span>
                </div>
              ) : (
                <div className="text-[11px] text-neutral-500">Direct chat</div>
              )}
            </div>
          </>
        )}
      </div>
      {onInfo ? (
        <button
          type="button"
          onClick={onInfo}
          className="rounded-full p-2 text-neutral-500 transition hover:bg-neutral-100"
          aria-label="Info o chatu"
        >
          <Info className="h-5 w-5" />
        </button>
      ) : null}
    </div>
  );
}

function ChatInfoPanel({
  profile,
  onClose,
}: {
  profile: ProfileLite | null;
  onClose: () => void;
}) {
  if (!profile) return null;
  const { name, username } = profileLabel(profile);

  return (
    <div className="flex flex-1 flex-col overflow-y-auto p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-neutral-900">Info o chatu</h2>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full p-2 text-neutral-500 transition hover:bg-neutral-100"
          aria-label="Zavřít"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-4 flex items-center gap-3">
        {profile.avatar_url ? (
          <img
            src={profile.avatar_url}
            alt={name}
            className="h-12 w-12 rounded-full object-cover ring-2 ring-neutral-100"
            onError={(event) => ((event.currentTarget as HTMLImageElement).style.display = "none")}
          />
        ) : (
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-neutral-900 text-sm font-semibold text-white ring-2 ring-neutral-100">
            {profileInitial(profile)}
          </div>
        )}
        <div>
          <div className="text-sm font-semibold text-neutral-900">{name}</div>
          {username ? <div className="text-xs text-neutral-500">{username}</div> : null}
        </div>
      </div>

      <div className="mt-6 space-y-3">
        <div className="rounded-xl border border-neutral-200 p-3">
          <div className="text-xs font-semibold text-neutral-500">Sdílená média</div>
          <div className="mt-2 text-sm text-neutral-600">Zatím žádné fotky.</div>
        </div>
        <div className="rounded-xl border border-neutral-200 p-3">
          <div className="text-xs font-semibold text-neutral-500">Akce</div>
          <div className="mt-3 flex flex-col gap-2">
            <button
              type="button"
              disabled
              className="rounded-lg border border-neutral-200 px-3 py-2 text-left text-sm text-neutral-400"
            >
              Zablokovat účet (připravujeme)
            </button>
            <button
              type="button"
              disabled
              className="rounded-lg border border-neutral-200 px-3 py-2 text-left text-sm text-neutral-400"
            >
              Nahlásit účet (připravujeme)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function NewChatOverlay({
  open,
  query,
  loading,
  results,
  creatingUserId,
  onClose,
  onQueryChange,
  onSelect,
}: {
  open: boolean;
  query: string;
  loading: boolean;
  results: ProfileLite[];
  creatingUserId: string | null;
  onClose: () => void;
  onQueryChange: (value: string) => void;
  onSelect: (profile: ProfileLite) => void;
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/60 px-4 py-6"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl border border-neutral-200 bg-white p-4 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-neutral-900">Nový chat</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-neutral-500 transition hover:bg-neutral-100"
            aria-label="Zavřít"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-700 shadow-sm">
          <Search className="h-4 w-4 text-neutral-400" />
          <input
            type="text"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Vyhledat uživatele"
            className="w-full bg-transparent text-sm text-neutral-800 outline-none placeholder:text-neutral-400"
          />
        </div>

        <div className="mt-4 max-h-[360px] overflow-y-auto">
          {loading ? (
            <div className="p-3 text-sm text-neutral-500">Hledám…</div>
          ) : query.trim().length === 0 ? (
            <div className="p-3 text-sm text-neutral-500">Zadej jméno nebo username.</div>
          ) : results.length === 0 ? (
            <div className="p-3 text-sm text-neutral-500">Žádné výsledky.</div>
          ) : (
            <ul className="space-y-2">
              {results.map((profile) => {
                const { name, username } = profileLabel(profile);
                const isCreating = creatingUserId === profile.id;
                return (
                  <li key={profile.id}>
                    <button
                      type="button"
                      onClick={() => onSelect(profile)}
                      disabled={isCreating}
                      className="flex w-full items-center gap-3 rounded-xl border border-neutral-200 px-3 py-2 text-left text-sm transition hover:border-neutral-300 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {profile.avatar_url ? (
                        <img
                          src={profile.avatar_url}
                          alt={name}
                          className="h-10 w-10 rounded-full object-cover ring-1 ring-neutral-200"
                          onError={(event) => ((event.currentTarget as HTMLImageElement).style.display = "none")}
                        />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-900 text-xs font-semibold text-white">
                          {profileInitial(profile)}
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="truncate font-semibold text-neutral-900">{name}</div>
                        {username ? <div className="text-xs text-neutral-500">{username}</div> : null}
                      </div>
                      {isCreating ? <span className="ml-auto text-xs text-neutral-500">Otevírám…</span> : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
