"use client";

import { Flame, MessageCircle, MapPin } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useTranslations } from "@/components/i18n/LocaleProvider";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { RealFeedClient } from "./RealFeedClient";
import { StoriesRail } from "./StoriesRail";

const storyPalette = [
  "from-pink-500 via-red-500 to-orange-400",
  "from-indigo-500 via-blue-500 to-cyan-400",
  "from-amber-500 via-orange-500 to-rose-400",
  "from-emerald-500 via-teal-500 to-cyan-400",
  "from-fuchsia-500 via-purple-500 to-indigo-500",
  "from-slate-900 via-slate-800 to-slate-900",
];

export default function RealPage() {
  const t = useTranslations();

  return (
    <main className="min-h-screen bg-neutral-50 pb-24 lg:h-screen lg:overflow-hidden lg:pb-0">
      <section className="mx-auto w-full max-w-4xl px-4 py-6 space-y-6 sm:space-y-8 sm:py-8 lg:flex lg:h-full lg:min-h-0 lg:max-w-6xl lg:flex-col">
        <header className="space-y-1 sm:space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 sm:text-3xl">{t("real.title")}</h1>
          <p className="max-w-2xl text-sm text-neutral-700 sm:text-base">{t("real.description")}</p>
        </header>

        <div className="grid grid-cols-1 gap-5 sm:gap-6 lg:flex-1 lg:min-h-0 lg:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-4 sm:space-y-6 lg:min-h-0 lg:overflow-y-auto lg:pr-2">
            <StoriesRail />
            <RealFeedClient />
          </div>

          <aside className="hidden space-y-3 lg:sticky lg:top-6 lg:h-full lg:min-h-0 lg:overflow-y-auto lg:pr-1 lg:block">
            <WidgetCard title={t("real.widgets.trending.title")} widgetLabel={t("real.widgetLabel")}>
              <TrendingWidget />
            </WidgetCard>
            <WidgetCard title={t("real.widgets.creators.title")} widgetLabel={t("real.widgetLabel")}>
              <CreatorsWidget />
            </WidgetCard>
            <WidgetCard title={t("real.widgets.rooms.title")} widgetLabel={t("real.widgetLabel")}>
              <RoomsWidget />
            </WidgetCard>
            <WidgetCard title={t("real.widgets.friendMap.title")} widgetLabel={t("real.widgetLabel")}>
              <FriendMapWidget />
            </WidgetCard>
            <WidgetCard title={t("real.widgets.inbox.title")} widgetLabel={t("real.widgetLabel")}>
              <InboxWidget />
            </WidgetCard>
          </aside>
        </div>
      </section>
    </main>
  );
}

function WidgetCard({ title, widgetLabel, children }: { title: string; widgetLabel: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white/90 p-4 shadow-sm backdrop-blur">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-neutral-900">{title}</h3>
        <span aria-hidden className="text-[11px] uppercase tracking-[0.14em] text-neutral-500">
          {widgetLabel}
        </span>
      </div>
      {children}
    </div>
  );
}

function TrendingWidget() {
  const t = useTranslations();
  const [items, setItems] = useState<
    Array<{ token: string; recentCount: number; prevCount: number; growthPercent: number }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);

  const fetchTrends = useMemo(() => {
    return () => {
      setLoading(true);
      setError(null);
      fetch("/api/nreal/trends")
        .then((res) => res.json())
        .then((payload) => {
          const next = Array.isArray(payload?.items) ? payload.items : [];
          setItems(next);
        })
        .catch(() => {
          setError(t("real.widgets.trending.error"));
        })
        .finally(() => {
          setLoading(false);
        });
    };
  }, [t]);

  useEffect(() => {
    fetchTrends();
  }, [fetchTrends]);

  useEffect(() => {
    const channel = supabase
      .channel("nreal-token-trends")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "nreal_token_hourly_counts" },
        () => {
          fetchTrends();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchTrends, supabase]);

  const formatVolume = useMemo(() => {
    return (count: number) => {
      if (count < 1000) return `${count}`;
      if (count < 1_000_000) return `${(count / 1000).toFixed(1).replace(/\\.0$/, "")}k`;
      return `${(count / 1_000_000).toFixed(1).replace(/\\.0$/, "")}m`;
    };
  }, []);

  return (
    <div className="space-y-2 text-sm text-neutral-700">
      {loading ? (
        <div className="rounded-lg border border-dashed border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-500">
          {t("real.widgets.trending.loading")}
        </div>
      ) : error ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
          {error}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-500">
          {t("real.widgets.trending.empty")}
        </div>
      ) : (
        items.map((item) => {
          const boostLabel = `${item.growthPercent > 0 ? "+" : ""}${item.growthPercent}%`;
          return (
            <div
              key={item.token}
              className="flex items-center justify-between rounded-lg border border-neutral-100 bg-neutral-50 px-3 py-2"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-red-50 text-xs font-semibold text-red-500">
                  <Flame className="h-4 w-4" />
                </span>
                <div>
                  <div className="font-semibold text-neutral-900">{item.token}</div>
                  <div className="text-[11px] text-neutral-500">
                    {t("real.widgets.trending.volume", { count: formatVolume(item.recentCount) })}
                  </div>
                </div>
              </div>
              <span className="text-xs font-semibold text-red-500">{boostLabel}</span>
            </div>
          );
        })
      )}
    </div>
  );
}

function CreatorsWidget() {
  const t = useTranslations();
  const creators = [
    { id: "c1", name: "Natka", stat: t("real.widgets.creators.items.natka") },
    { id: "c2", name: "Lukáš", stat: t("real.widgets.creators.items.lukas") },
    { id: "c3", name: "NRW crew", stat: t("real.widgets.creators.items.crew") },
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
            {t("real.widgets.creators.follow")}
          </button>
        </div>
      ))}
    </div>
  );
}

function RoomsWidget() {
  const t = useTranslations();
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
              <div className="text-[11px] text-neutral-500">
                {t("real.widgets.rooms.listeners", { count: room.people })}
              </div>
            </div>
          </div>
          <button className="rounded-full bg-neutral-900 px-3 py-1 text-xs font-semibold text-white transition hover:-translate-y-[1px]">
            {t("real.widgets.rooms.join")}
          </button>
        </div>
      ))}
    </div>
  );
}

function FriendMapWidget() {
  const t = useTranslations();
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
                title={t("real.widgets.friendMap.livePosition", { name: friend.name })}
              >
                {friend.name.charAt(0)}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-3 flex items-center justify-between text-[11px] text-neutral-200">
          <span className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-emerald-200" />
            {t("real.widgets.friendMap.mock")}
          </span>
          <span className="text-neutral-300">{t("real.widgets.friendMap.hotspots")}</span>
        </div>
      </div>
    </div>
  );
}

function InboxWidget() {
  const t = useTranslations();
  const items = [
    { id: "i1", user: "Eli", preview: t("real.widgets.inbox.items.eli") },
    { id: "i2", user: "Mates", preview: t("real.widgets.inbox.items.mates") },
    { id: "i3", user: "NRW crew", preview: t("real.widgets.inbox.items.crew") },
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
            {t("real.widgets.inbox.open")}
          </button>
        </div>
      ))}
    </div>
  );
}
