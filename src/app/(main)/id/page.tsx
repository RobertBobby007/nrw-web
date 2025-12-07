"use client";

import { BadgeCheck, Bookmark, Heart, MessageCircle, MoreHorizontal, Share2 } from "lucide-react";

const media = [
  { id: "m1", label: "Golden hour crew", gradient: "from-amber-300 via-orange-200 to-rose-200" },
  { id: "m2", label: "NRW meetup", gradient: "from-indigo-300 via-blue-200 to-cyan-200" },
  { id: "m3", label: "Studio moment", gradient: "from-slate-800 via-slate-700 to-slate-900" },
  { id: "m4", label: "City run", gradient: "from-emerald-200 via-teal-200 to-cyan-200" },
  { id: "m5", label: "Afterparty", gradient: "from-rose-200 via-fuchsia-200 to-purple-200" },
  { id: "m6", label: "nReal live", gradient: "from-amber-200 via-yellow-200 to-lime-200" },
];

const tweets = [
  {
    id: "t1",
    text: "NRW 0.3.0 drop: nové nLove swipy, rooms a cross-post na profil. Let’s go.",
    meta: "2 h",
    stats: { replies: 24, likes: 210, reposts: 32 },
  },
  {
    id: "t2",
    text: "Dnes na Letný s crew. Přinesu filmovej foťák, kdo chce portrait?",
    meta: "včera",
    stats: { replies: 8, likes: 112, reposts: 9 },
  },
  {
    id: "t3",
    text: "RT @nrw: nReal Talks #12 je venku. Přineste si názory, chceme je slyšet.",
    meta: "2 dny",
    stats: { replies: 5, likes: 76, reposts: 18 },
  },
];

export default function IdPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-neutral-50 to-white">
      <section className="mx-auto max-w-6xl px-4 py-10 lg:py-14">
        <header className="flex flex-wrap items-start justify-between gap-4 rounded-3xl border border-neutral-200 bg-white/90 p-6 shadow-sm backdrop-blur">
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative h-20 w-20 rounded-full bg-gradient-to-br from-rose-400 via-amber-300 to-orange-300 ring-4 ring-white">
              <span className="absolute inset-1 rounded-full bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.45),transparent_45%),radial-gradient(circle_at_70%_70%,rgba(255,255,255,0.3),transparent_45%)]" />
              <span className="absolute inset-0 flex items-center justify-center text-xl font-semibold text-white">
                NRW
              </span>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xl font-semibold text-neutral-900">
                nrw.id
                <BadgeCheck className="h-4 w-4 text-sky-500" />
              </div>
              <p className="text-sm text-neutral-600">Creator · NRW / nReal crew · Praha</p>
              <div className="flex flex-wrap items-center gap-3 text-xs font-semibold text-neutral-700">
                <span>1 024 sledujících</span>
                <span>·</span>
                <span>689 sleduje</span>
                <span>·</span>
                <span>42 momentů</span>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button className="rounded-full border border-neutral-200 px-4 py-2 text-sm font-semibold text-neutral-900 transition hover:bg-neutral-100">
              Upravit profil
            </button>
            <button className="rounded-full bg-neutral-900 px-4 py-2 text-sm font-semibold text-white transition hover:-translate-y-[1px]">
              Sdílet profil
            </button>
          </div>
          <div className="w-full text-sm text-neutral-700 lg:w-auto">
            <p className="leading-relaxed">
              NRW + nReal cross-posty, backstage a link na rooms. Mix fotogridu a krátkých postů na
              jednom ID.
            </p>
          </div>
        </header>

        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-6">
            <ProfileStories />
            <ProfileTabs />
            <InstagramGrid />
            <TwitterFeed />
          </div>

          <aside className="space-y-3 lg:sticky lg:top-10 lg:max-h-[calc(100vh-120px)] lg:overflow-y-auto lg:pr-1">
            <Widget title="Highlighy">
              <Highlights />
            </Widget>
            <Widget title="Trending témata">
              <TwitterHighlights />
            </Widget>
            <Widget title="Společné zájmy">
              <Interests />
            </Widget>
            <Widget title="Linky">
              <Links />
            </Widget>
          </aside>
        </div>
      </section>
    </main>
  );
}

function ProfileStories() {
  const stories = [
    { id: "s1", label: "Crew", color: "from-rose-400 via-orange-300 to-amber-200" },
    { id: "s2", label: "Events", color: "from-indigo-400 via-blue-300 to-cyan-200" },
    { id: "s3", label: "nLove", color: "from-fuchsia-400 via-pink-300 to-rose-200" },
    { id: "s4", label: "Rooms", color: "from-emerald-400 via-teal-300 to-cyan-200" },
  ];
  return (
    <div className="flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
      {stories.map((story) => (
        <div
          key={story.id}
          className="flex w-28 shrink-0 flex-col items-center gap-2 rounded-xl border border-neutral-200 bg-white p-3 shadow-sm"
        >
          <div className={`h-16 w-16 rounded-full bg-gradient-to-br ${story.color} ring-2 ring-white shadow`} />
          <span className="text-xs font-semibold text-neutral-800">{story.label}</span>
        </div>
      ))}
      <button className="flex w-28 shrink-0 flex-col items-center gap-2 rounded-xl border border-dashed border-neutral-300 bg-neutral-50 p-3 text-xs font-semibold text-neutral-600 transition hover:border-neutral-400 hover:text-neutral-900">
        + Highlight
      </button>
    </div>
  );
}

function ProfileTabs() {
  const tabs = [
    { id: "posts", label: "Příspěvky" },
    { id: "reels", label: "Klipy" },
    { id: "tags", label: "Označení" },
    { id: "threads", label: "Vlákna" },
  ];
  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1 text-sm font-semibold text-neutral-700 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
      {tabs.map((tab, idx) => {
        const isActive = idx === 0;
        return (
          <button
            key={tab.id}
            className={`rounded-full border px-4 py-2 transition ${
              isActive
                ? "border-neutral-900 bg-neutral-900 text-white"
                : "border-neutral-200 bg-white hover:border-neutral-300"
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

function InstagramGrid() {
  return (
    <div className="rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-neutral-900">Foto grid</h2>
        <button className="rounded-full px-3 py-1 text-xs font-semibold text-neutral-600 transition hover:bg-neutral-100">
          Archiv
        </button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {media.map((item) => (
          <div
            key={item.id}
            className="group relative aspect-square overflow-hidden rounded-2xl border border-neutral-100 bg-gradient-to-br shadow-sm transition hover:-translate-y-[2px] hover:shadow-md"
          >
            <div className={`absolute inset-0 bg-gradient-to-br ${item.gradient}`} />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.35),transparent_40%),radial-gradient(circle_at_80%_70%,rgba(255,255,255,0.25),transparent_40%)] mix-blend-screen" />
            <div className="absolute inset-0 flex items-end justify-between p-3 text-white">
              <span className="rounded-full bg-black/30 px-3 py-1 text-xs font-semibold backdrop-blur">
                {item.label}
              </span>
              <span className="flex items-center gap-2 rounded-full bg-black/25 px-3 py-1 text-xs font-semibold backdrop-blur">
                <Heart className="h-4 w-4" />
                1.2k
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TwitterFeed() {
  return (
    <div className="rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-neutral-900">Krátké posty</h2>
        <button className="rounded-full px-3 py-1 text-xs font-semibold text-neutral-600 transition hover:bg-neutral-100">
          Zobrazit všechno
        </button>
      </div>
      <div className="divide-y divide-neutral-100">
        {tweets.map((tweet) => (
          <article key={tweet.id} className="space-y-2 py-3">
            <div className="flex items-center justify-between text-xs text-neutral-500">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-900 text-white text-xs font-semibold">
                  NRW
                </span>
                <div className="text-neutral-800 font-semibold">nrw.id</div>
                <span>·</span>
                <span>{tweet.meta}</span>
              </div>
              <MoreHorizontal className="h-4 w-4 text-neutral-400" />
            </div>
            <p className="text-sm leading-relaxed text-neutral-900">{tweet.text}</p>
            <div className="flex items-center gap-4 text-xs font-semibold text-neutral-600">
              <button className="flex items-center gap-1 transition hover:text-neutral-900">
                <MessageCircle className="h-4 w-4" />
                {tweet.stats.replies}
              </button>
              <button className="flex items-center gap-1 transition hover:text-neutral-900">
                <Share2 className="h-4 w-4" />
                {tweet.stats.reposts}
              </button>
              <button className="flex items-center gap-1 transition hover:text-rose-500">
                <Heart className="h-4 w-4" />
                {tweet.stats.likes}
              </button>
              <button className="ml-auto flex items-center gap-1 rounded-full border border-neutral-200 px-3 py-1 text-[11px] font-semibold transition hover:border-neutral-300">
                <Bookmark className="h-4 w-4" />
                Uložit
              </button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function Widget({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white/90 p-4 shadow-sm backdrop-blur">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-neutral-900">{title}</h3>
        <span className="text-[11px] uppercase tracking-[0.14em] text-neutral-400">ID</span>
      </div>
      {children}
    </div>
  );
}

function Highlights() {
  const list = [
    { id: "h1", title: "Letná run", meta: "12k zhlédnutí" },
    { id: "h2", title: "NRW meetup #4", meta: "9.2k zhlédnutí" },
    { id: "h3", title: "Studio live", meta: "7.4k zhlédnutí" },
  ];
  return (
    <div className="space-y-2 text-sm text-neutral-700">
      {list.map((item) => (
        <div
          key={item.id}
          className="flex items-center justify-between rounded-lg border border-neutral-100 bg-neutral-50 px-3 py-2"
        >
          <div>
            <div className="font-semibold text-neutral-900">{item.title}</div>
            <div className="text-[11px] text-neutral-500">{item.meta}</div>
          </div>
          <button className="rounded-full px-3 py-1 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-900 hover:text-white">
            Přehrát
          </button>
        </div>
      ))}
    </div>
  );
}

function TwitterHighlights() {
  const topics = [
    { id: "th1", tag: "#nrw", stat: "trending" },
    { id: "th2", tag: "#nReal", stat: "1.2k tweetů" },
    { id: "th3", tag: "#rooms", stat: "620 tweetů" },
  ];
  return (
    <div className="space-y-2 text-sm text-neutral-700">
      {topics.map((topic) => (
        <div
          key={topic.id}
          className="flex items-center justify-between rounded-lg border border-neutral-100 bg-gradient-to-r from-slate-50 to-white px-3 py-2"
        >
          <div>
            <div className="font-semibold text-neutral-900">{topic.tag}</div>
            <div className="text-[11px] text-neutral-500">{topic.stat}</div>
          </div>
          <button className="rounded-full border border-neutral-200 px-3 py-1 text-xs font-semibold text-neutral-900 transition hover:bg-neutral-900 hover:text-white">
            Sledovat
          </button>
        </div>
      ))}
    </div>
  );
}

function Interests() {
  const interests = ["Foto", "Koncerty", "Produkce", "AI", "nLove", "Meetups"];
  return (
    <div className="flex flex-wrap gap-2 text-xs font-semibold text-neutral-700">
      {interests.map((interest) => (
        <span key={interest} className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1">
          {interest}
        </span>
      ))}
    </div>
  );
}

function Links() {
  const links = [
    { id: "ln1", label: "nReal Talks #12", url: "nrw.link/talks12" },
    { id: "ln2", label: "nLove beta room", url: "nrw.link/love" },
    { id: "ln3", label: "NRW Discord", url: "nrw.link/discord" },
  ];
  return (
    <div className="space-y-2 text-sm text-neutral-700">
      {links.map((link) => (
        <div
          key={link.id}
          className="flex items-center justify-between rounded-lg border border-neutral-100 bg-neutral-50 px-3 py-2"
        >
          <div>
            <div className="font-semibold text-neutral-900">{link.label}</div>
            <div className="text-[11px] text-neutral-500">{link.url}</div>
          </div>
          <button className="rounded-full px-3 py-1 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-900 hover:text-white">
            Otevřít
          </button>
        </div>
      ))}
    </div>
  );
}
