"use client";

import {
  Bookmark,
  Flame,
  Heart,
  MessageCircle,
  MoreHorizontal,
  MapPin,
  Plus,
  Send,
} from "lucide-react";
import { useState } from "react";

type Story = {
  id: string;
  user: string;
  isLive: boolean;
  isCloseFriends?: boolean;
  color: string;
};
type Post = {
  id: string;
  user: string;
  location: string;
  timeAgo: string;
  caption: string;
  likes: number;
  comments: { id: string; user: string; text: string }[];
  mediaColor: string;
};

const stories: Story[] = [
  { id: "s1", user: "Natka", isLive: true, color: "from-pink-500 via-red-500 to-orange-400" },
  { id: "s2", user: "Lukáš", isLive: false, isCloseFriends: true, color: "from-indigo-500 via-blue-500 to-cyan-400" },
  { id: "s3", user: "Mates", isLive: false, color: "from-amber-500 via-orange-500 to-rose-400" },
  { id: "s4", user: "Eli", isLive: true, color: "from-emerald-500 via-teal-500 to-cyan-400" },
  { id: "s5", user: "NRW crew", isLive: false, isCloseFriends: true, color: "from-fuchsia-500 via-purple-500 to-indigo-500" },
  { id: "s6", user: "Sára", isLive: false, isCloseFriends: true, color: "from-emerald-400 via-green-500 to-teal-400" },
];
const storyPalette = [
  "from-pink-500 via-red-500 to-orange-400",
  "from-indigo-500 via-blue-500 to-cyan-400",
  "from-amber-500 via-orange-500 to-rose-400",
  "from-emerald-500 via-teal-500 to-cyan-400",
  "from-fuchsia-500 via-purple-500 to-indigo-500",
  "from-slate-900 via-slate-800 to-slate-900",
];

const posts: Post[] = [
  {
    id: "p1",
    user: "Natka",
    location: "Letná · Praha",
    timeAgo: "před 2 h",
    caption: "Dneska nejhezčí sunset. NRW viby ✨",
    likes: 482,
    comments: [
      { id: "c1", user: "Mates", text: "🔥🔥" },
      { id: "c2", user: "Lukáš", text: "Potvrzuju, top nálada." },
    ],
    mediaColor: "from-orange-300 via-amber-200 to-pink-200",
  },
  {
    id: "p2",
    user: "NRW crew",
    location: "NRW Studio",
    timeAgo: "před 5 h",
    caption: "Nahráváme další díl nReal Talks. Kdo chce shoutout?",
    likes: 1021,
    comments: [
      { id: "c3", user: "Eli", text: "Pošli behind the scenes!" },
      { id: "c4", user: "Natka", text: "Chci slyšet nLove story." },
    ],
    mediaColor: "from-slate-900 via-slate-800 to-slate-900",
  },
  {
    id: "p3",
    user: "Mates",
    location: "Brno",
    timeAgo: "včera",
    caption: "Skate spot, který musíte vidět. NRW meetup příští týden?",
    likes: 316,
    comments: [
      { id: "c5", user: "NRW crew", text: "Přijedeme!" },
      { id: "c6", user: "Lukáš", text: "Dejte poll v appce." },
    ],
    mediaColor: "from-emerald-200 via-teal-200 to-cyan-200",
  },
];

export default function RealPage() {
  const [storyList, setStoryList] = useState<Story[]>(stories);

  const handleAddStory = () => {
    setStoryList((prev) => {
      const nextIndex = prev.length % storyPalette.length;
      const nextId = `new-${prev.length + 1}`;
      const isLive = (prev.length + 1) % 3 === 0;
      const isCloseFriends = !isLive && (prev.length + 1) % 2 === 0;
      return [
        ...prev,
        {
          id: nextId,
          user: `Nový story ${prev.length + 1}`,
          isLive,
          isCloseFriends,
          color: storyPalette[nextIndex],
        },
      ];
    });
  };

  return (
    <main className="min-h-screen bg-neutral-50 pb-24">
      <section className="mx-auto max-w-6xl px-4 py-8 space-y-8">
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight text-neutral-900">nReal feed</h1>
          <p className="max-w-2xl text-sm text-neutral-700">
            NRW příběhy a momenty s rychlými widgety na straně.
          </p>
        </header>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-4 lg:space-y-6">
            <StoriesRail stories={storyList} onAddStory={handleAddStory} />
            <PostsList />
          </div>

          <aside className="space-y-3 lg:sticky lg:top-6">
            <WidgetCard title="Trendy dnes">
              <TrendingWidget />
            </WidgetCard>
            <WidgetCard title="Kdo frčí">
              <CreatorsWidget />
            </WidgetCard>
            <WidgetCard title="Rooms">
              <RoomsWidget />
            </WidgetCard>
            <WidgetCard title="Mapa přátel">
              <FriendMapWidget />
            </WidgetCard>
            <WidgetCard title="Inbox">
              <InboxWidget />
            </WidgetCard>
          </aside>
        </div>
      </section>
    </main>
  );
}

function StoriesRail({ stories, onAddStory }: { stories: Story[]; onAddStory: () => void }) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
      <button
        onClick={onAddStory}
        className="group relative flex w-24 shrink-0 flex-col gap-2 rounded-xl border-2 border-dashed border-neutral-300 bg-neutral-50 p-2 text-left text-neutral-600 outline-none transition hover:border-neutral-400 hover:text-neutral-900 focus-visible:outline-none focus:outline-none focus-visible:ring-0 focus-visible:border-neutral-400"
        type="button"
      >
        <div className="flex h-28 w-full items-center justify-center rounded-lg bg-white">
          <Plus className="h-6 w-6" />
        </div>
        <span className="text-[11px] font-semibold leading-4">Přidat story</span>
      </button>

      {stories.map((story) => (
        <button
          key={story.id}
          className={`group relative flex w-24 shrink-0 flex-col gap-2 rounded-xl bg-white p-2 text-left shadow-sm transition ${
            story.isLive
              ? "border-2 border-red-400 shadow-[0_8px_24px_-12px_rgba(248,113,113,0.7)]"
              : story.isCloseFriends
              ? "border-2 border-emerald-400 shadow-[0_8px_24px_-12px_rgba(52,211,153,0.6)]"
              : "border border-neutral-200"
          } outline-none focus-visible:outline-none focus:outline-none focus-visible:ring-0`}
          type="button"
        >
          <div className={`relative h-28 w-full overflow-hidden rounded-lg bg-gradient-to-br ${story.color}`}>
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.45),transparent_35%),radial-gradient(circle_at_80%_70%,rgba(255,255,255,0.35),transparent_35%)] mix-blend-screen" />
            <div className="absolute bottom-2 left-2 rounded-full bg-black/60 px-2 py-[2px] text-[10px] font-semibold uppercase tracking-[0.12em] text-white">
              {story.user.charAt(0)}
            </div>
            {story.isLive ? (
              <span className="absolute left-2 top-2 rounded-full bg-red-500 px-2 py-[2px] text-[10px] font-semibold uppercase tracking-[0.12em] text-white shadow-sm">
                Live
              </span>
            ) : story.isCloseFriends ? (
              <span className="absolute left-2 top-2 rounded-full bg-emerald-500 px-2 py-[2px] text-[10px] font-semibold uppercase tracking-[0.12em] text-white shadow-sm">
                Circle
              </span>
            ) : null}
          </div>
          <span className="line-clamp-2 text-[11px] font-semibold text-neutral-900 leading-4">
            {story.user}
          </span>
        </button>
      ))}
    </div>
  );
}

function PostsList() {
  return (
    <div className="space-y-4">
      {posts.map((post) => (
        <article key={post.id} className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
          <header className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="flex items-center gap-3">
              <div className={`h-10 w-10 rounded-full bg-gradient-to-br ${post.mediaColor} ring-2 ring-neutral-100`} />
              <div>
                <div className="text-sm font-semibold text-neutral-900">nReal · {post.user}</div>
                <div className="text-[11px] text-neutral-500">
                  {post.location} · {post.timeAgo}
                </div>
              </div>
            </div>
            <button
              className="rounded-full p-2 text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-800"
              aria-label="Více"
            >
              <MoreHorizontal className="h-5 w-5" />
            </button>
          </header>

          <div className={`relative bg-gradient-to-br ${post.mediaColor}`}>
            <div className="aspect-[4/5] w-full overflow-hidden">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.45),transparent_35%),radial-gradient(circle_at_80%_70%,rgba(255,255,255,0.35),transparent_35%)] mix-blend-screen" />
              <div className="absolute bottom-4 left-4 rounded-full bg-black/60 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-white">
                nReal moment
              </div>
            </div>
          </div>

          <div className="space-y-3 px-4 py-4">
            <div className="flex items-center justify-between text-neutral-800">
              <div className="flex items-center gap-4 text-sm font-semibold">
                <button className="flex items-center gap-2 transition hover:text-red-500">
                  <Heart className="h-5 w-5" />
                  <span>{post.likes.toLocaleString("cs-CZ")} lajků</span>
                </button>
                <button className="flex items-center gap-2 transition hover:text-neutral-900">
                  <MessageCircle className="h-5 w-5" />
                  <span>Komentáře</span>
                </button>
                <button className="flex items-center gap-2 transition hover:text-neutral-900">
                  <Send className="h-5 w-5" />
                  <span>Poslat</span>
                </button>
              </div>
              <button className="transition hover:text-neutral-900" aria-label="Uložit">
                <Bookmark className="h-5 w-5" />
              </button>
            </div>

            <p className="text-sm text-neutral-900">
              <span className="font-semibold">{post.user}</span> {post.caption}
            </p>

            <div className="space-y-1">
              {post.comments.map((comment) => (
                <p key={comment.id} className="text-sm text-neutral-700">
                  <span className="font-semibold">{comment.user}</span> {comment.text}
                </p>
              ))}
              <button className="text-xs font-medium text-neutral-500 transition hover:text-neutral-900">
                Zobrazit všechny komentáře
              </button>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

function WidgetCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white/90 p-4 shadow-sm backdrop-blur">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-neutral-900">{title}</h3>
        <span aria-hidden className="text-[11px] uppercase tracking-[0.14em] text-neutral-500">
          nReal
        </span>
      </div>
      {children}
    </div>
  );
}

function TrendingWidget() {
  const tags = [
    { id: "t1", label: "#nreal", boost: "+182%", volume: "4.2k" },
    { id: "t2", label: "#nightvibes", boost: "+96%", volume: "2.1k" },
    { id: "t3", label: "#nrwmeetup", boost: "+54%", volume: "1.3k" },
  ];
  return (
    <div className="space-y-2 text-sm text-neutral-700">
      {tags.map((tag) => (
        <div
          key={tag.id}
          className="flex items-center justify-between rounded-lg border border-neutral-100 bg-neutral-50 px-3 py-2"
        >
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-red-50 text-xs font-semibold text-red-500">
              <Flame className="h-4 w-4" />
            </span>
            <div>
              <div className="font-semibold text-neutral-900">{tag.label}</div>
              <div className="text-[11px] text-neutral-500">Objem {tag.volume}</div>
            </div>
          </div>
          <span className="text-xs font-semibold text-red-500">{tag.boost}</span>
        </div>
      ))}
    </div>
  );
}

function CreatorsWidget() {
  const creators = [
    { id: "c1", name: "Natka", stat: "12.4k sledujících" },
    { id: "c2", name: "Lukáš", stat: "8.1k sledujících" },
    { id: "c3", name: "NRW crew", stat: "24k sledujících" },
  ];
  return (
    <div className="space-y-2 text-sm text-neutral-700">
      {creators.map((creator, idx) => (
        <div
          key={creator.id}
          className="flex items-center justify-between rounded-lg border border-neutral-100 bg-neutral-50 px-3 py-2"
        >
          <div className="flex items-center gap-3">
            <div className={`h-9 w-9 rounded-full bg-gradient-to-br ${storyPalette[idx % storyPalette.length]} ring-2 ring-neutral-100`} />
            <div>
              <div className="font-semibold text-neutral-900">{creator.name}</div>
              <div className="text-[11px] text-neutral-500">{creator.stat}</div>
            </div>
          </div>
          <button className="rounded-full border border-neutral-200 px-3 py-1 text-xs font-semibold text-neutral-900 transition hover:bg-neutral-900 hover:text-white">
            Sleduj
          </button>
        </div>
      ))}
    </div>
  );
}

function RoomsWidget() {
  const rooms = [
    { id: "r1", title: "NRW Late night", people: 128 },
    { id: "r2", title: "nLove stories", people: 86 },
    { id: "r3", title: "Creators room", people: 54 },
  ];
  return (
    <div className="space-y-2 text-sm text-neutral-700">
      {rooms.map((room) => (
        <div
          key={room.id}
          className="flex items-center justify-between rounded-lg border border-neutral-100 bg-neutral-50 px-3 py-2"
        >
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-50 text-xs font-semibold text-emerald-600">
              <MessageCircle className="h-4 w-4" />
            </span>
            <div>
              <div className="font-semibold text-neutral-900">{room.title}</div>
              <div className="text-[11px] text-neutral-500">{room.people} lidí poslouchá</div>
            </div>
          </div>
          <button className="rounded-full bg-neutral-900 px-3 py-1 text-xs font-semibold text-white transition hover:-translate-y-[1px]">
            Připojit
          </button>
        </div>
      ))}
    </div>
  );
}

function FriendMapWidget() {
  const heatData = [
    { id: "praha", label: "Praha", value: 82, position: { x: 58, y: 42 } },
    { id: "brno", label: "Brno", value: 64, position: { x: 63, y: 55 } },
    { id: "ostrava", label: "Ostrava", value: 52, position: { x: 74, y: 38 } },
    { id: "plzen", label: "Plzeň", value: 34, position: { x: 44, y: 50 } },
  ];

  const friends = [
    { id: "f1", name: "Natka", position: { x: 56, y: 44 }, color: "bg-red-500" },
    { id: "f2", name: "Mates", position: { x: 65, y: 57 }, color: "bg-emerald-500" },
    { id: "f3", name: "Eli", position: { x: 74, y: 40 }, color: "bg-cyan-500" },
    { id: "f4", name: "NRW crew", position: { x: 46, y: 50 }, color: "bg-purple-500" },
  ];

  return (
    <div className="space-y-3 text-sm text-neutral-700">
      <div className="relative overflow-hidden rounded-2xl border border-neutral-200 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-4 py-4 text-xs text-white shadow-inner">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.06),transparent_45%),radial-gradient(circle_at_70%_80%,rgba(255,255,255,0.05),transparent_40%)]" />
        <div className="absolute inset-3 rounded-xl border border-white/5" />

        <div className="relative aspect-[4/3] w-full">
          {heatData.map((spot) => {
            const intensity = Math.min(1, spot.value / 90);
            const size = 18 + intensity * 20;
            const glow = `rgba(255, 170, 43, ${0.12 + intensity * 0.35})`;
            const core = `rgba(255, 120, 0, ${0.3 + intensity * 0.35})`;
            return (
              <div
                key={spot.id}
                style={{ left: `${spot.position.x}%`, top: `${spot.position.y}%` }}
                className="absolute -translate-x-1/2 -translate-y-1/2"
              >
                <div
                  style={{
                    width: size * 1.6,
                    height: size * 1.6,
                    background: `radial-gradient(circle, ${glow} 0%, transparent 65%)`,
                  }}
                  className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 blur-sm"
                />
                <div
                  style={{
                    width: size,
                    height: size,
                    background: `radial-gradient(circle, ${core} 0%, rgba(255,120,0,0.12) 65%, transparent 100%)`,
                  }}
                  className="relative rounded-full ring-2 ring-orange-500/30"
                />
                <div className="mt-1 text-center text-[10px] font-semibold text-white drop-shadow-sm">
                  {spot.label}
                </div>
              </div>
            );
          })}

          {friends.map((friend) => (
            <div
              key={friend.id}
              style={{ left: `${friend.position.x}%`, top: `${friend.position.y}%` }}
              className="absolute -translate-x-1/2 -translate-y-1/2"
            >
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full ${friend.color} text-[11px] font-semibold text-white shadow-lg ring-2 ring-white/60`}
                title={`${friend.name} · Live poloha`}
              >
                {friend.name.charAt(0)}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-3 flex items-center justify-between text-[11px] text-neutral-200">
          <span className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-emerald-200" />
            Live pozice přátel (mock)
          </span>
          <span className="text-neutral-300">Hotspoty: Praha · Brno · Ostrava</span>
        </div>
      </div>
    </div>
  );
}

function InboxWidget() {
  const items = [
    { id: "i1", user: "Eli", preview: "Poslala ti reakci 🔥" },
    { id: "i2", user: "Mates", preview: "Zve tě na meetup v Brně" },
    { id: "i3", user: "NRW crew", preview: "Nový collaborative post" },
  ];
  return (
    <div className="space-y-2 text-sm text-neutral-700">
      {items.map((item) => (
        <div
          key={item.id}
          className="flex items-center justify-between rounded-lg border border-neutral-100 bg-neutral-50 px-3 py-2"
        >
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-neutral-900 text-xs font-semibold text-white flex items-center justify-center">
              {item.user.charAt(0)}
            </div>
            <div>
              <div className="font-semibold text-neutral-900">{item.user}</div>
              <div className="text-[11px] text-neutral-500">{item.preview}</div>
            </div>
          </div>
          <button className="rounded-full border border-neutral-200 px-3 py-1 text-xs font-semibold text-neutral-900 transition hover:bg-neutral-100">
            Otevřít
          </button>
        </div>
      ))}
    </div>
  );
}
