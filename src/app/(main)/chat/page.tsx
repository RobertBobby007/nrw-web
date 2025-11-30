"use client";

import {
  MessageCircle,
  MoreHorizontal,
  Phone,
  Search,
  Send,
  Smile,
  Video,
  Image as ImageIcon,
  Camera,
  Mic,
} from "lucide-react";
import { useMemo, useState } from "react";

type Participant = {
  id: string;
  name: string;
  handle: string;
  unread?: number;
  status: "online" | "offline" | "away";
};

type Message = {
  id: string;
  from: string;
  text: string;
  time: string;
  isMe?: boolean;
};

type Thread = {
  id: string;
  participants: Participant[];
  preview: string;
  messages: Message[];
};

const threads: Thread[] = [
  {
    id: "t1",
    participants: [
      { id: "p1", name: "Natka", handle: "@nat", unread: 2, status: "online" },
      { id: "me", name: "Ty", handle: "@you", status: "online" },
    ],
    preview: "Poď dnes večer na NRW meetup?",
    messages: [
      { id: "m1", from: "Natka", text: "Hele, jdeš dnes na NRW meetup?", time: "18:20" },
      { id: "m2", from: "Me", text: "Jo, v 19:30 jsem tam.", time: "18:22", isMe: true },
      { id: "m3", from: "Natka", text: "Beru foťák, uděláme momenty.", time: "18:23" },
    ],
  },
  {
    id: "t2",
    participants: [
      { id: "p2", name: "Lukáš", handle: "@lukas", status: "away" },
      { id: "me", name: "Ty", handle: "@you", status: "online" },
    ],
    preview: "Dropni mi link na nLove beta",
    messages: [
      { id: "m4", from: "Lukáš", text: "Dropni mi link na nLove beta?", time: "17:05" },
      { id: "m5", from: "Me", text: "Mrkni do kanálu #beta v appce.", time: "17:08", isMe: true },
    ],
  },
  {
    id: "t3",
    participants: [
      { id: "p3", name: "NRW crew", handle: "@nrw", status: "online" },
      { id: "me", name: "Ty", handle: "@you", status: "online" },
    ],
    preview: "Zítra nahráváme nový díl nReal Talks",
    messages: [
      { id: "m6", from: "NRW crew", text: "Zítra nahráváme nový díl nReal Talks.", time: "09:10" },
      { id: "m7", from: "Me", text: "Chcete shoutouty z komunity?", time: "09:14", isMe: true },
    ],
  },
];

export default function ChatPage() {
  const [activeThreadId, setActiveThreadId] = useState<string>(threads[0]?.id ?? "");
  const [category, setCategory] = useState<"main" | "other" | "rooms" | "requests">("main");
  const activeThread = useMemo(
    () => threads.find((t) => t.id === activeThreadId) ?? threads[0],
    [activeThreadId]
  );

  return (
    <main className="min-h-screen bg-neutral-50 flex">
      <section className="flex w-full flex-1 flex-col gap-4 px-4 py-8 md:px-8">
        <header className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-neutral-500">NRW</p>
            <h1 className="text-3xl font-semibold tracking-tight text-neutral-900">nChat</h1>
            <p className="text-sm text-neutral-600">Rychlé zprávy, rooms i reakce.</p>
          </div>
          <div className="hidden md:block" aria-hidden />
        </header>

        <div className="grid flex-1 min-h-0 gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
          <aside className="flex flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
            <SidebarHeader selectedCategory={category} onSelectCategory={setCategory} />
            <ThreadList activeThreadId={activeThreadId} onSelect={setActiveThreadId} />
          </aside>

          <section className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
            <ThreadHeader participants={activeThread?.participants ?? []} />
            <MessagesList messages={activeThread?.messages ?? []} />
            <Composer />
          </section>
        </div>
      </section>
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

function SidebarHeader({
  selectedCategory,
  onSelectCategory,
}: {
  selectedCategory: "main" | "other" | "rooms" | "requests";
  onSelectCategory: (cat: "main" | "other" | "rooms" | "requests") => void;
}) {
  return (
    <div className="border-b border-neutral-100 px-4 py-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-neutral-500">Chaty</p>
          <p className="text-sm text-neutral-600">Tvůj hlavní inbox</p>
        </div>
        <MessageCircle className="h-5 w-5 text-neutral-400" />
      </div>
      <div className="mt-3">
        <SearchBar />
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
        {[
          { id: "main", label: "Hlavní" },
          { id: "other", label: "Ostatní" },
          { id: "rooms", label: "Rooms" },
          { id: "requests", label: "Žádosti" },
        ].map((cat) => {
          const isActive = selectedCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => onSelectCategory(cat.id as typeof selectedCategory)}
              className={`rounded-full border px-3 py-1 transition ${
                isActive
                  ? "border-neutral-900 bg-neutral-900 text-white"
                  : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300"
              }`}
            >
              {cat.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ThreadList({
  activeThreadId,
  onSelect,
}: {
  activeThreadId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="divide-y divide-neutral-100">
      {threads.map((thread) => {
        const other = thread.participants.find((p) => p.id !== "me") ?? thread.participants[0];
        const isActive = thread.id === activeThreadId;
        const statusDot =
          other?.status === "online"
            ? "bg-emerald-500"
            : other?.status === "away"
            ? "bg-amber-400"
            : "bg-neutral-300";
        return (
          <button
            key={thread.id}
            onClick={() => onSelect(thread.id)}
            className={`flex w-full items-center gap-3 px-4 py-3 text-left transition ${
              isActive ? "bg-neutral-900 text-white shadow-inner" : "hover:bg-neutral-50"
            }`}
          >
            <div
              className={`relative flex h-10 w-10 items-center justify-center rounded-full bg-neutral-900 text-sm font-semibold text-white ring-2 ${
                isActive ? "ring-white/40" : "ring-neutral-100"
              }`}
            >
              {other?.name?.charAt(0) ?? "N"}
              <span className={`absolute -right-1 -bottom-1 h-2.5 w-2.5 rounded-full border-2 border-white ${statusDot}`} />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className={`text-sm font-semibold ${isActive ? "text-white" : "text-neutral-900"}`}>
                  {other?.name ?? "nChat"}
                </span>
              </div>
              <div className={`text-xs ${isActive ? "text-white/80" : "text-neutral-500"}`}>
                {thread.preview}
              </div>
            </div>
            {other?.unread ? (
              <span
                className={`rounded-full px-2 py-[2px] text-[11px] font-semibold ${
                  isActive ? "bg-white/20 text-white" : "bg-neutral-900 text-white"
                }`}
              >
                {other.unread}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

function ThreadHeader({ participants }: { participants: Participant[] }) {
  const other = participants.find((p) => p.id !== "me") ?? participants[0];
  const statusColor =
    other?.status === "online" ? "bg-emerald-500" : other?.status === "away" ? "bg-amber-400" : "bg-neutral-300";

  return (
    <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-3">
      <div className="flex items-center gap-3">
        <div className="relative h-10 w-10 rounded-full bg-gradient-to-br from-neutral-800 to-neutral-600 text-sm font-semibold text-white ring-2 ring-neutral-100 flex items-center justify-center">
          {other?.name?.charAt(0) ?? "N"}
          <span className={`absolute -right-1 -bottom-1 h-3 w-3 rounded-full border-2 border-white ${statusColor}`} />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-neutral-900">{other?.name ?? "nChat"}</span>
            <span className="text-[11px] text-neutral-500">{other?.handle ?? "@nchat"}</span>
          </div>
          <div className="text-[11px] text-neutral-500">
            {other?.status === "online"
              ? "Online"
              : other?.status === "away"
              ? "Pryč"
              : "Offline"}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 text-neutral-600">
        <button className="rounded-full p-2 transition hover:bg-neutral-100" aria-label="Hovor">
          <Phone className="h-5 w-5" />
        </button>
        <button className="rounded-full p-2 transition hover:bg-neutral-100" aria-label="Video">
          <Video className="h-5 w-5" />
        </button>
        <button className="rounded-full p-2 transition hover:bg-neutral-100" aria-label="Více">
          <MoreHorizontal className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}

function MessagesList({ messages }: { messages: Message[] }) {
  return (
    <div className="flex flex-1 flex-col gap-3 overflow-y-auto bg-white px-4 py-4 min-h-0">
      {messages.map((msg) => (
        <div key={msg.id} className={`flex ${msg.isMe ? "justify-end" : "justify-start"}`}>
          <div
            className={`max-w-[70%] rounded-2xl px-3 py-2 text-sm shadow-sm ${
              msg.isMe ? "rounded-br-sm bg-neutral-900 text-white" : "rounded-bl-sm bg-neutral-100 text-neutral-900"
            }`}
          >
            <div className="text-[11px] text-neutral-500">{msg.isMe ? "Ty" : msg.from}</div>
            <div>{msg.text}</div>
            <div className="mt-1 text-[10px] text-neutral-400">{msg.time}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function Composer() {
  return (
    <div className="border-t border-neutral-100 bg-white px-4 py-3">
      <div className="flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-3 py-2 shadow-sm">
        <button className="rounded-full p-1.5 text-neutral-500 transition hover:bg-neutral-100" aria-label="Emoji">
          <Smile className="h-5 w-5" />
        </button>
        <button className="rounded-full p-1.5 text-neutral-500 transition hover:bg-neutral-100" aria-label="Připojit fotku">
          <ImageIcon className="h-5 w-5" />
        </button>
        <button className="rounded-full p-1.5 text-neutral-500 transition hover:bg-neutral-100" aria-label="Otevřít foťák">
          <Camera className="h-5 w-5" />
        </button>
        <button className="rounded-full p-1.5 text-neutral-500 transition hover:bg-neutral-100" aria-label="Nahrát audio">
          <Mic className="h-5 w-5" />
        </button>
        <input
          type="text"
          placeholder="Napiš zprávu..."
          className="flex-1 bg-transparent text-sm text-neutral-900 outline-none placeholder:text-neutral-400"
        />
        <button className="flex items-center gap-1 rounded-full bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:-translate-y-[1px]">
          <Send className="h-4 w-4" />
          Poslat
        </button>
      </div>
    </div>
  );
}
