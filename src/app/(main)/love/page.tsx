"use client";

import {
  Flame,
  Heart,
  MapPin,
  Music2,
  Sparkles,
  Star,
  X,
  Info,
} from "lucide-react";
import { useMemo, useState } from "react";

type Profile = {
  id: string;
  name: string;
  age: number;
  distance: string;
  bio: string;
  vibe: string;
  interests: string[];
  anthem: string;
  gradient: string;
  badge: string;
};

const profiles: Profile[] = [
  {
    id: "p1",
    name: "Natka",
    age: 24,
    distance: "2 km",
    bio: "Vibe hunter, festivaly a noční Praha. Hledám někoho na nReal moments.",
    vibe: "Night vibes · coffee walks",
    interests: ["Koncerty", "Analog foto", "Patra"],
    anthem: "Raye – Escapism",
    gradient: "from-rose-300 via-red-200 to-amber-200",
    badge: "Hot match",
  },
  {
    id: "p2",
    name: "Lukáš",
    age: 27,
    distance: "5 km",
    bio: "Produkt v NRW, ale mimo práci viby, kafe a longboard.",
    vibe: "Sunny lanes · rooftop talks",
    interests: ["Longboard", "Flat white", "nReal Talks"],
    anthem: "Kaytranada – Lite Spots",
    gradient: "from-indigo-300 via-blue-200 to-cyan-200",
    badge: "Creator",
  },
  {
    id: "p3",
    name: "Eli",
    age: 23,
    distance: "1 km",
    bio: "Do všeho skočím, hlavně cestování a spontánní meetupy.",
    vibe: "Weekend trips · microadventures",
    interests: ["Běhání", "Streetfood", "Umění"],
    anthem: "Fred again.. – Delilah",
    gradient: "from-emerald-200 via-teal-200 to-cyan-200",
    badge: "New",
  },
  {
    id: "p4",
    name: "Mates",
    age: 25,
    distance: "3 km",
    bio: "Skate, foto a dobrý stories. Nahrávám nReal moments denně.",
    vibe: "Golden hour · city moves",
    interests: ["Skate", "Fotka", "NRW meetups"],
    anthem: "Disclosure – Latch",
    gradient: "from-amber-200 via-orange-200 to-rose-200",
    badge: "Top pick",
  },
];

export default function LovePage() {
  const [currentIndex, setCurrentIndex] = useState(0);

  const visibleCards = useMemo(
    () => profiles.slice(currentIndex, currentIndex + 3),
    [currentIndex]
  );

  const handleAction = (direction: "left" | "right" | "superlike") => {
    const delta = direction === "superlike" ? 1 : 1;
    const nextIndex = currentIndex + delta;
    setCurrentIndex(nextIndex >= profiles.length ? 0 : nextIndex);
  };

  const activeProfile = visibleCards[0];

  return (
    <main className="min-h-screen bg-gradient-to-b from-rose-50 via-white to-amber-50 lg:h-screen lg:overflow-hidden">
      <section className="mx-auto max-w-6xl px-4 py-10 lg:flex lg:h-full lg:min-h-0 lg:flex-col lg:py-14 lg:px-8 xl:px-10">
        <header className="flex flex-col gap-2">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <div>
                <h1 className="text-3xl font-semibold tracking-tight text-neutral-900">Tinder styl pro NRW</h1>
                <p className="text-sm text-neutral-600">Swipuj profily, přidej superlike a sleduj widgety napravo.</p>
              </div>
            </div>
        </header>

        <div className="mt-8 grid gap-6 lg:flex-1 lg:min-h-0 lg:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-4 lg:min-h-0 lg:overflow-y-auto lg:pr-2">
            <CardStack cards={visibleCards} />
            <SwipeControls onAction={handleAction} />
          </div>

          <aside className="hidden space-y-3 lg:block lg:sticky lg:top-10 lg:h-full lg:min-h-0 lg:overflow-y-auto lg:pr-1">
            <Widget title="Match queue">
              <MatchQueue currentIndex={currentIndex} />
            </Widget>
            <Widget title="Prompt dne">
              <PromptWidget />
            </Widget>
            <Widget title="NRW vibe radar">
              <RadarWidget profile={activeProfile} />
            </Widget>
            <Widget title="Bezpečný swipe">
              <SafetyWidget />
            </Widget>
          </aside>
        </div>
      </section>
    </main>
  );
}

function CardStack({ cards }: { cards: Profile[] }) {
  return (
    <div className="relative h-[520px] w-full rounded-3xl bg-white/70 p-3 shadow-[0_14px_50px_-24px_rgba(0,0,0,0.4)] ring-1 ring-neutral-200/80">
      {cards.length === 0 && (
        <div className="flex h-full items-center justify-center text-sm text-neutral-500">
          Žádné další profily. Resetujeme feed.
        </div>
      )}
      {cards.map((profile, idx) => {
        const scale = 1 - idx * 0.04;
        const translateY = idx * 10;
        return (
          <article
            key={profile.id}
            style={{
              zIndex: cards.length - idx,
              transform: `translateY(${translateY}px) scale(${scale})`,
              boxShadow: idx === 0 ? "0 18px 38px -22px rgba(0,0,0,0.35)" : undefined,
            }}
            className="absolute inset-3 rounded-2xl bg-gradient-to-br transition-transform duration-300"
            aria-label={`${profile.name} profil`}
          >
            <div
              className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${profile.gradient}`}
              style={{ filter: "saturate(1.05)" }}
            />
            <div className="absolute inset-0 rounded-2xl bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.35),transparent_45%),radial-gradient(circle_at_75%_70%,rgba(255,255,255,0.25),transparent_45%)] mix-blend-screen" />
            <div className="relative flex h-full flex-col justify-between rounded-2xl border border-white/50 bg-gradient-to-b from-black/10 via-black/0 to-black/40 p-6 text-white shadow-inner">
              <div className="flex items-center justify-between">
                <div className="rounded-full bg-white/30 px-3 py-1 text-xs font-semibold backdrop-blur">
                  {profile.badge}
                </div>
                <button
                  className="rounded-full bg-black/30 p-2 text-white backdrop-blur transition hover:bg-black/40"
                  type="button"
                  aria-label="Více info"
                >
                  <Info className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <div className="flex items-end gap-2">
                    <h2 className="text-3xl font-semibold leading-tight drop-shadow-sm">
                      {profile.name}, {profile.age}
                    </h2>
                    <span className="flex items-center gap-1 rounded-full bg-white/25 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] backdrop-blur">
                      <MapPin className="h-3 w-3" />
                      {profile.distance}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-white/90 drop-shadow-sm">
                    {profile.bio}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  {profile.interests.map((interest) => (
                    <span
                      key={interest}
                      className="rounded-full bg-white/20 px-3 py-1 text-xs font-semibold backdrop-blur"
                    >
                      {interest}
                    </span>
                  ))}
                </div>

                <div className="flex items-center justify-between rounded-xl bg-white/15 px-3 py-3 text-sm backdrop-blur">
                  <div className="flex items-center gap-2 text-white">
                    <Sparkles className="h-4 w-4" />
                    <span>{profile.vibe}</span>
                  </div>
                  <div className="flex items-center gap-2 text-white/90">
                    <Music2 className="h-4 w-4" />
                    <span className="text-xs font-semibold">{profile.anthem}</span>
                  </div>
                </div>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function SwipeControls({ onAction }: { onAction: (dir: "left" | "right" | "superlike") => void }) {
  return (
    <div className="flex items-center justify-center gap-4 rounded-2xl border border-neutral-200 bg-white/90 px-4 py-3 shadow-sm backdrop-blur">
      <button
        onClick={() => onAction("left")}
        className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-rose-500 ring-1 ring-rose-100 transition hover:-translate-y-[2px] hover:bg-rose-50 hover:ring-rose-200"
        aria-label="Nezajímá"
      >
        <X className="h-6 w-6" />
      </button>
      <button
        onClick={() => onAction("superlike")}
        className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-sky-500 ring-1 ring-sky-100 transition hover:-translate-y-[2px] hover:bg-sky-50 hover:ring-sky-200"
        aria-label="Superlike"
      >
        <Star className="h-6 w-6" />
      </button>
      <button
        onClick={() => onAction("right")}
        className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-emerald-500 ring-1 ring-emerald-100 transition hover:-translate-y-[2px] hover:bg-emerald-50 hover:ring-emerald-200"
        aria-label="Líbí se"
      >
        <Heart className="h-6 w-6" />
      </button>
    </div>
  );
}

function Widget({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white/90 p-4 shadow-sm backdrop-blur">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-neutral-900">{title}</h3>
        <span className="text-[11px] uppercase tracking-[0.14em] text-neutral-400">nLove</span>
      </div>
      {children}
    </div>
  );
}

function MatchQueue({ currentIndex }: { currentIndex: number }) {
  const queue = profiles.slice(currentIndex + 1, currentIndex + 5);
  return (
    <div className="space-y-2 text-sm text-neutral-700">
      {queue.map((p) => (
        <div
          key={p.id}
          className="flex items-center justify-between rounded-xl border border-neutral-100 bg-neutral-50 px-3 py-2"
        >
          <div className="flex items-center gap-3">
            <div className={`h-10 w-10 rounded-full bg-gradient-to-br ${p.gradient} ring-2 ring-white shadow-sm`} />
            <div>
              <div className="font-semibold text-neutral-900">{p.name}, {p.age}</div>
              <div className="text-[11px] text-neutral-500">{p.distance} · {p.badge}</div>
            </div>
          </div>
          <button className="rounded-full border border-neutral-200 px-3 py-1 text-xs font-semibold text-neutral-900 transition hover:bg-neutral-900 hover:text-white">
            Otevřít
          </button>
        </div>
      ))}
      {queue.length === 0 && <p className="text-xs text-neutral-500">Reset feedu, nic dalšího v řadě.</p>}
    </div>
  );
}

function PromptWidget() {
  const prompts = [
    { id: "pr1", prompt: "Moje perfektní NRW noc", answer: "Streetfood, koncert a noční tram vibe." },
    { id: "pr2", prompt: "Nejlepší nReal moment", answer: "Golden hour na Letný s crew." },
  ];
  return (
    <div className="space-y-2 text-sm text-neutral-700">
      {prompts.map((item) => (
        <div key={item.id} className="rounded-xl border border-neutral-100 bg-gradient-to-br from-rose-50 to-orange-50 px-3 py-3">
          <p className="text-[11px] uppercase tracking-[0.14em] text-rose-500">{item.prompt}</p>
          <p className="mt-1 font-semibold text-neutral-900">{item.answer}</p>
        </div>
      ))}
      <button className="text-xs font-semibold text-rose-500 transition hover:text-rose-600">
        Přidat svou odpověď
      </button>
    </div>
  );
}

function RadarWidget({ profile }: { profile?: Profile }) {
  if (!profile) {
    return <p className="text-sm text-neutral-500">Žádný aktivní profil.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="relative h-32 overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.08),transparent_50%),radial-gradient(circle_at_80%_70%,rgba(255,255,255,0.06),transparent_45%)]" />
        <div className="absolute inset-3 rounded-xl border border-white/5" />
        <div className="absolute left-1/2 top-1/2 h-36 w-36 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/10" />
        <div className="absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/10" />
        <div className="absolute left-1/2 top-1/2 h-14 w-14 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/10" />
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-rose-500 px-3 py-1 text-xs font-semibold shadow-lg ring-2 ring-white/60">
          {profile.name}
        </div>
        <div className="absolute left-[22%] top-[30%] rounded-full bg-emerald-500 px-2 py-[2px] text-[11px] font-semibold shadow ring-2 ring-white/50">
          92% vibe
        </div>
        <div className="absolute right-[18%] bottom-[28%] rounded-full bg-sky-500 px-2 py-[2px] text-[11px] font-semibold shadow ring-2 ring-white/50">
          8 km max
        </div>
      </div>
      <div className="space-y-1 text-sm text-neutral-700">
        <div className="flex items-center justify-between rounded-lg border border-neutral-100 bg-neutral-50 px-3 py-2">
          <span className="flex items-center gap-2 text-neutral-800">
            <Flame className="h-4 w-4 text-rose-500" />
            Doporučený match vibe
          </span>
          <span className="text-xs font-semibold text-neutral-600">{profile.vibe}</span>
        </div>
        <div className="flex items-center justify-between rounded-lg border border-neutral-100 bg-neutral-50 px-3 py-2">
          <span className="flex items-center gap-2 text-neutral-800">
            <MapPin className="h-4 w-4 text-emerald-500" />
            Lokace
          </span>
          <span className="text-xs font-semibold text-neutral-600">{profile.distance}</span>
        </div>
      </div>
    </div>
  );
}

function SafetyWidget() {
  const tips = [
    "Chat přes nChat, než se uvidíte.",
    "První setkání na veřejném místě.",
    "Sdílej polohu s NRW crew.",
  ];
  return (
    <div className="space-y-2 text-sm text-neutral-700">
      {tips.map((tip, idx) => (
        <div key={tip} className="flex items-center gap-2 rounded-lg border border-neutral-100 bg-neutral-50 px-3 py-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-rose-50 text-[11px] font-semibold text-rose-500">
            {idx + 1}
          </span>
          <span className="text-neutral-800">{tip}</span>
        </div>
      ))}
      <button className="text-xs font-semibold text-neutral-500 transition hover:text-neutral-800">
        Zobrazit podmínky bezpečí
      </button>
    </div>
  );
}
