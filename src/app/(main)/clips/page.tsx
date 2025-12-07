"use client";

import { Play, Music2, TrendingUp, Bookmark, Flame } from "lucide-react";

type Clip = {
  id: string;
  title: string;
  creator: string;
  length: string;
  views: string;
  vibe: string;
  gradient: string;
  tags: string[];
};

const clipFeed: Clip[] = [
  {
    id: "clip-1",
    title: "Noční ride přes město",
    creator: "@nreal.urban",
    length: "0:32",
    views: "12,4 tis.",
    vibe: "Night pulse",
    gradient: "from-neutral-900 via-slate-800 to-indigo-800",
    tags: ["city", "night", "crew"],
  },
  {
    id: "clip-2",
    title: "NRW backstage: první event",
    creator: "@nrw.community",
    length: "0:28",
    views: "8,9 tis.",
    vibe: "Live moment",
    gradient: "from-amber-900 via-orange-700 to-pink-700",
    tags: ["live", "community", "event"],
  },
  {
    id: "clip-3",
    title: "Ranní káva a roadmap",
    creator: "@nrw.team",
    length: "0:19",
    views: "5,1 tis.",
    vibe: "Build mode",
    gradient: "from-sky-900 via-cyan-700 to-emerald-700",
    tags: ["produkt", "update", "nnews"],
  },
  {
    id: "clip-4",
    title: "Sraz v parku",
    creator: "@nreal.friends",
    length: "0:24",
    views: "6,7 tis.",
    vibe: "Sunny vibe",
    gradient: "from-rose-900 via-purple-700 to-indigo-700",
    tags: ["friends", "irl", "summer"],
  },
];

const clipFilters = ["Top", "Pro tebe", "Sleduješ", "Nové"];
const trendingNow = [
  { id: "tr1", label: "Noční ride", stat: "🔥 2.4k" },
  { id: "tr2", label: "NRW backstage", stat: "🔥 1.8k" },
  { id: "tr3", label: "Ranní káva", stat: "🔥 1.2k" },
  { id: "tr4", label: "Sraz v parku", stat: "🔥 960" },
];

export default function ClipsPage() {
  const activeFilter = "Top";

  return (
    <main className="min-h-screen bg-neutral-50">
      <section className="mx-auto max-w-6xl px-4 py-8 space-y-8">
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight text-neutral-900">Fresh Reels z NRW</h1>
          <p className="max-w-2xl text-sm text-neutral-600">
            Krátká videa a highlighty komunity. Projeď to jako feed, co si pustíš mezi zprávami v
            nChat – rychlé, vizuální a živé.
          </p>
        </header>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          {clipFilters.map((filter) => {
            const isActive = filter === activeFilter;
            return (
              <button
                key={filter}
                type="button"
                className={
                  isActive
                    ? "rounded-full bg-black px-3 py-1 text-[11px] font-medium text-white"
                    : "rounded-full border border-neutral-200 bg-white px-3 py-1 text-[11px] font-medium text-neutral-600"
                }
              >
                {filter}
              </button>
            );
          })}
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {clipFeed.map((clip) => (
              <article
                key={clip.id}
                className="flex flex-col gap-3 rounded-2xl border border-neutral-200 bg-white p-3 shadow-sm"
              >
                <div className="relative overflow-hidden rounded-xl border border-neutral-200/60 bg-neutral-900">
                  <div className={`absolute inset-0 bg-gradient-to-br ${clip.gradient}`} />
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(255,255,255,0.2),transparent_35%),radial-gradient(circle_at_80%_85%,rgba(255,255,255,0.15),transparent_40%)]" />
                  <div className="absolute inset-0 opacity-60 mix-blend-screen">
                    <div className="mx-auto h-full w-[55%] bg-[radial-gradient(circle,rgba(255,255,255,0.35)_0%,rgba(255,255,255,0)_60%)]" />
                  </div>

                  <div className="relative flex h-[420px] flex-col justify-between p-4 text-white">
                    <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.18em]">
                      <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-2 py-1 backdrop-blur">
                        <Play className="h-3.5 w-3.5" />
                        {clip.length}
                      </span>
                      <span className="rounded-full bg-white/10 px-2 py-1 text-[10px] backdrop-blur">
                        {clip.vibe}
                      </span>
                    </div>

                    <div className="space-y-2">
                      <div className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-1 text-[11px] font-medium uppercase tracking-[0.14em]">
                        <TrendingUp className="h-3.5 w-3.5" />
                        {clip.views} shlédnutí
                      </div>
                      <h2 className="text-xl font-semibold leading-tight drop-shadow-sm">{clip.title}</h2>
                      <p className="text-sm text-neutral-100">{clip.creator}</p>
                      <div className="flex flex-wrap gap-2 text-[11px]">
                        {clip.tags.map((tag) => (
                          <span
                            key={tag}
                            className="rounded-full bg-white/10 px-2 py-1 font-semibold uppercase tracking-[0.14em] text-neutral-100 backdrop-blur"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs text-neutral-100">
                      <div className="flex items-center gap-3">
                        <button className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-1 font-semibold backdrop-blur transition hover:bg-white/25">
                          <Music2 className="h-3.5 w-3.5" />
                          Audio track
                        </button>
                        <button className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-1 font-semibold backdrop-blur transition hover:bg-white/25">
                          <Bookmark className="h-3.5 w-3.5" />
                          Uložit
                        </button>
                      </div>
                      <button className="rounded-full bg-white/20 px-2 py-1 font-semibold backdrop-blur transition hover:bg-white/30">
                        + Remix
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <div className="space-y-0.5">
                    <p className="font-semibold text-neutral-900">{clip.title}</p>
                    <p className="text-xs text-neutral-500">
                      {clip.creator} · {clip.views}
                    </p>
                  </div>
                  <button className="rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs font-semibold text-neutral-700 transition hover:-translate-y-0.5 hover:bg-neutral-100">
                    Pustit
                  </button>
                </div>
              </article>
            ))}
          </div>

          <aside className="space-y-3 lg:sticky lg:top-6">
            <div className="space-y-3 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between text-sm font-semibold text-neutral-900">
                Tvoje flow
                <span className="text-xs font-medium text-neutral-500">Mini storyboard</span>
              </div>
              <div className="space-y-2 text-sm text-neutral-700">
                <div className="rounded-xl border border-dashed border-neutral-200 bg-neutral-50 px-3 py-2">
                  <p className="text-xs uppercase tracking-[0.16em] text-neutral-500">Idea</p>
                  <p className="font-semibold text-neutral-900">Co teď natáčíš?</p>
                  <p className="text-xs text-neutral-500">Vhoď sem vibe, hudbu a linkni nChat.</p>
                </div>
                <div className="rounded-xl border border-neutral-200 bg-white px-3 py-2 shadow-sm">
                  <p className="text-xs uppercase tracking-[0.16em] text-neutral-500">Spojka</p>
                  <p className="font-semibold text-neutral-900">Sdílej do nChat</p>
                  <p className="text-xs text-neutral-500">
                    Každý klip má share do nChat – rychlé reakce od lidí, co sleduješ.
                  </p>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-neutral-200 bg-neutral-900 px-3 py-3 text-white shadow-sm">
                  <div>
                    <p className="text-xs uppercase tracking-[0.16em] text-neutral-300">
                      Zvuk týdne
                    </p>
                    <p className="text-sm font-semibold">lofi sprint · 00:18</p>
                  </div>
                  <button className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-semibold text-neutral-900 transition hover:-translate-y-0.5">
                    <Play className="h-4 w-4" />
                    Přehrát
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-3 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between text-sm font-semibold text-neutral-900">
                <span className="inline-flex items-center gap-2">
                  <Flame className="h-4 w-4 text-orange-500" />
                  Trendy dnes
                </span>
                <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-neutral-500">
                  nClips
                </span>
              </div>
              <div className="space-y-2 text-sm text-neutral-800">
                {trendingNow.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between rounded-xl border border-neutral-100 bg-neutral-50 px-3 py-2"
                  >
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-orange-500 shadow-[0_0_0_4px_rgba(249,115,22,0.15)]" />
                      <span className="font-semibold text-neutral-900">{item.label}</span>
                    </div>
                    <span className="text-xs font-semibold text-orange-600">{item.stat}</span>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}
