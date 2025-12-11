"use client";

import {
  CalendarDays,
  Flame,
  GripVertical,
  MapPin,
  Sun,
  Users,
} from "lucide-react";
import { type ReactNode, useEffect, useMemo, useState } from "react";

type FeedItem = {
  id: string;
  type: "nReal" | "nNews";
  title: string;
  excerpt: string;
  meta: string;
};

type WidgetId = "weather" | "date" | "suggested" | "heatmap";

const WIDGETS_STORAGE_KEY = "nrw.widget.layout";

const demoItems: FeedItem[] = [
  {
    id: "1",
    type: "nReal",
    title: "První příběh v NRW",
    excerpt: "Krátký popis příběhu, který se v budoucnu načte z backendu…",
    meta: "Autor · datum",
  },
  {
    id: "2",
    type: "nNews",
    title: "NRW News: první update",
    excerpt: "Krátká zpráva z NRW světa, která bude později generovaná dynamicky…",
    meta: "NRW News · datum",
  },
  {
    id: "3",
    type: "nReal",
    title: "Příběh komunity",
    excerpt: "Další ukázka příběhu, který se později načte z nReal feedu…",
    meta: "NRW · datum",
  },
];

const tabs = ["Mix", "nReal", "nNews"];

const widgetConfig: Record<
  WidgetId,
  {
    title: string;
    render: (today?: Date) => ReactNode;
  }
> = {
  weather: { title: "Počasí", render: (today) => <WeatherWidget today={today} /> },
  date: { title: "Kalendář", render: (today) => <DateWidget today={today} /> },
  suggested: { title: "Návrhy", render: () => <SuggestionsWidget /> },
  heatmap: { title: "Heat mapa", render: () => <HeatmapWidget /> },
};

const defaultWidgetOrder: WidgetId[] = ["weather", "date", "suggested", "heatmap"];

export default function HomePage() {
  const activeTab = "Mix";
  const [today] = useState<Date>(() => new Date());
  const [isEditing, setIsEditing] = useState(false);
  const [widgetOrder, setWidgetOrder] = useState<WidgetId[]>(defaultWidgetOrder);
  const [hasHydrated, setHasHydrated] = useState(false);
  const [draggingId, setDraggingId] = useState<WidgetId | null>(null);

  useEffect(() => {
    const stored = window.localStorage.getItem(WIDGETS_STORAGE_KEY);
    const storedOrder = stored ? (JSON.parse(stored) as WidgetId[]) : null;
    if (storedOrder?.length) {
      const known = storedOrder.filter((id) => id in widgetConfig) as WidgetId[];
      const missing = (Object.keys(widgetConfig) as WidgetId[]).filter((id) => !known.includes(id));
      setWidgetOrder([...known, ...missing]);
    }
    setHasHydrated(true);
  }, []);

  useEffect(() => {
    if (!hasHydrated) return;
    window.localStorage.setItem(WIDGETS_STORAGE_KEY, JSON.stringify(widgetOrder));
  }, [widgetOrder, hasHydrated]);

  const reorderWidgets = (dragId: WidgetId, overId: WidgetId) => {
    if (!dragId || dragId === overId) return;
    setWidgetOrder((current) => {
      const dragIndex = current.findIndex((w) => w === dragId);
      const overIndex = current.findIndex((w) => w === overId);
      if (dragIndex === -1 || overIndex === -1) return current;
      const updated = [...current];
      const [moved] = updated.splice(dragIndex, 1);
      updated.splice(overIndex, 0, moved);
      return updated;
    });
  };

  return (
    <main className="min-h-screen bg-neutral-50 pb-24">
      <section className="mx-auto max-w-6xl px-4 py-8 space-y-8">
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight text-neutral-900">
            NRStream – hlavní přehled
          </h1>
          <p className="max-w-2xl text-sm text-neutral-700">
            Jeden mix z nReal a nNews. Sleduj příběhy, novinky a aktualizace na jednom
            místě.
          </p>
        </header>

        <div className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-2 py-1 text-xs text-neutral-700">
          {tabs.map((tab) => {
            const isActive = tab === activeTab;
            return (
              <button
                key={tab}
                type="button"
                className={`rounded-full px-3 py-1 font-medium transition ${
                  isActive ? "bg-neutral-900 text-white" : "text-neutral-700 hover:bg-neutral-100"
                }`}
              >
                {tab}
              </button>
            );
          })}
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-3">
            {demoItems.map((item) => (
              <article
                key={item.id}
                className="rounded-xl border border-neutral-200 bg-white p-4 text-sm shadow-sm"
              >
                <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-neutral-500">
                  {item.type}
                </div>
                <h2 className="text-base font-semibold text-neutral-900">{item.title}</h2>
                <p className="mt-1 text-xs text-neutral-600">{item.excerpt}</p>
                <p className="mt-3 text-[11px] text-neutral-400">{item.meta}</p>
              </article>
            ))}
          </div>

          <aside className="space-y-3 lg:sticky lg:top-6 lg:max-h-[calc(100vh-96px)] lg:overflow-y-auto lg:pr-1">
            {isEditing && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditing(false);
                    setDraggingId(null);
                  }}
                  className="flex items-center justify-center gap-2 rounded-lg bg-neutral-800 px-3 py-2 text-sm font-semibold text-white shadow-sm ring-2 ring-neutral-300 transition hover:-translate-y-px hover:bg-neutral-800"
                >
                  Hotovo
                </button>
              </div>
            )}

            {widgetOrder.map((widgetId) => {
              const config = widgetConfig[widgetId];
              if (!config) return null;
              return (
                <WidgetCard
                  key={widgetId}
                  id={widgetId}
                  title={config.title}
                  isDragging={draggingId === widgetId}
                  isEditing={isEditing}
                  onDragStart={() => isEditing && setDraggingId(widgetId)}
                  onDragEnter={() => isEditing && draggingId && reorderWidgets(draggingId, widgetId)}
                  onDragEnd={() => setDraggingId(null)}
                >
                  {config.render(today)}
                </WidgetCard>
              );
            })}

            {!isEditing && (
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="mt-1 flex w-full items-center justify-center gap-2 rounded-lg bg-neutral-900 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-px hover:bg-neutral-800"
              >
                Upravit widgety
              </button>
            )}
          </aside>
        </div>
      </section>
    </main>
  );
}

function WidgetCard({
  id,
  title,
  children,
  isDragging,
  isEditing,
  onDragStart,
  onDragEnter,
  onDragEnd,
}: {
  id: WidgetId;
  title: string;
  children: React.ReactNode;
  isDragging: boolean;
  isEditing: boolean;
  onDragStart: () => void;
  onDragEnter: () => void;
  onDragEnd: () => void;
}) {
  return (
    <div
      data-widget-id={id}
      draggable={isEditing}
      onDragStart={onDragStart}
      onDragEnter={onDragEnter}
      onDragEnd={onDragEnd}
      onDragOver={(e) => e.preventDefault()}
      className={`rounded-xl border border-neutral-200 bg-white/90 p-4 shadow-sm backdrop-blur transition ${isDragging ? "scale-[1.01] border-neutral-300 shadow-md ring-2 ring-neutral-200" : "hover:-translate-y-px hover:shadow-md"} ${isEditing ? "cursor-grab ring-1 ring-neutral-200 animate-pulse" : ""}`}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-neutral-900">{title}</h3>
        {isEditing ? (
          <div className="flex items-center gap-2 rounded-lg bg-neutral-900 px-2 py-1 text-[11px] font-medium text-white shadow-sm">
            <GripVertical className="h-4 w-4" />
            <span className="hidden sm:inline">Chyť a přetáhni</span>
          </div>
        ) : (
          <span aria-hidden className="h-4 w-4" />
        )}
      </div>
      {children}
    </div>
  );
}

function WeatherWidget({ today }: { today?: Date }) {
  const lastUpdate =
    today &&
    today.toLocaleTimeString("cs-CZ", {
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <div className="space-y-3 text-sm text-neutral-700">
      <div className="flex items-center gap-2 text-neutral-900">
        <Sun className="h-5 w-5 text-amber-500" />
        <span className="font-semibold">18°C · Jasno</span>
      </div>
      <div className="flex items-center gap-2 text-neutral-500">
        <MapPin className="h-4 w-4" />
        <span>Praha, Česko</span>
      </div>
      <div className="grid grid-cols-4 gap-2 text-xs text-neutral-600">
        {["Po", "Út", "St", "Čt"].map((day, idx) => (
          <div
            key={day}
            className="flex flex-col items-center rounded-lg border border-neutral-100 bg-neutral-50 px-2 py-2"
          >
            <span className="font-semibold text-neutral-900">{day}</span>
            <span className="text-[11px] text-neutral-500">
              {18 + idx}° / {9 + idx}°
            </span>
          </div>
        ))}
      </div>
      <p className="text-[11px] text-neutral-500">
        Aktualizováno {lastUpdate ?? "—:—"}.
      </p>
    </div>
  );
}

function DateWidget({ today }: { today?: Date }) {
  const monthFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat("cs-CZ", {
        month: "long",
        day: "numeric",
        weekday: "long",
      }),
    []
  );

  const baseDate = today ?? new Date("2024-01-01T00:00:00Z");
  const dayNames = ["Po", "Út", "St", "Čt", "Pá", "So", "Ne"];
  const currentWeekday = baseDate.getDay() === 0 ? 7 : baseDate.getDay(); // neděle = 7
  const startOfWeek = baseDate.getDate() - currentWeekday + 1; // začátek týdne pondělí
  const weekDays = Array.from({ length: 7 }).map((_, idx) => startOfWeek + idx);

  return (
    <div className="space-y-3 text-sm text-neutral-700">
      <div className="flex items-center gap-2 text-neutral-900">
        <CalendarDays className="h-5 w-5 text-indigo-500" />
        <div className="space-y-0.5">
          <div className="text-xs uppercase tracking-[0.18em] text-neutral-500">Dnes</div>
          <div className="font-semibold">
            {today ? monthFormatter.format(today) : "Načítám datum…"}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs">
        {weekDays.map((day, idx) => {
          const date = new Date(baseDate);
          date.setDate(day);
          const isToday = today ? date.toDateString() === today.toDateString() : false;
          return (
            <div
              key={`${dayNames[idx]}-${date.getDate()}`}
              className={`rounded-lg border px-1 py-2 ${
                isToday
                  ? "border-neutral-900 bg-neutral-900 text-white"
                  : "border-neutral-100 bg-neutral-50 text-neutral-700"
              }`}
            >
              <div className="text-[10px] uppercase tracking-[0.14em] text-neutral-500">
                {dayNames[idx]}
              </div>
              <div className="text-sm font-semibold">{date.getDate()}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SuggestionsWidget() {
  const suggestions = [
    { id: "p1", type: "Příspěvek", title: "nReal: Nový příběh z Ostravy" },
    { id: "p2", type: "Uživatel", title: "Sleduj @nreal-community" },
    { id: "p3", type: "Příspěvek", title: "nNews: Co čeká NRW tento týden" },
  ];

  return (
    <div className="space-y-2 text-sm text-neutral-700">
      {suggestions.map((item) => (
        <div
          key={item.id}
          className="flex items-center justify-between rounded-lg border border-neutral-100 bg-neutral-50 px-3 py-2"
        >
          <div className="space-y-0.5">
            <div className="text-[10px] uppercase tracking-[0.14em] text-neutral-500">
              {item.type}
            </div>
            <div className="font-semibold text-neutral-900">{item.title}</div>
          </div>
          <button className="rounded-full border border-neutral-200 px-3 py-1 text-xs font-medium text-neutral-700 transition hover:bg-neutral-100">
            Přidat
          </button>
        </div>
      ))}
      <div className="flex items-center gap-2 rounded-lg border border-dashed border-neutral-200 px-3 py-2 text-xs text-neutral-500">
        <Users className="h-4 w-4" />
        <span>Další návrhy se načtou z feedu…</span>
      </div>
    </div>
  );
}

function HeatmapWidget() {
  const heatData = [
    { id: "praha", label: "Praha", value: 82, position: { x: 58, y: 42 } },
    { id: "brno", label: "Brno", value: 67, position: { x: 64, y: 54 } },
    { id: "ostrava", label: "Ostrava", value: 55, position: { x: 75, y: 38 } },
    { id: "plzen", label: "Plzeň", value: 38, position: { x: 46, y: 50 } },
    { id: "liberec", label: "Liberec", value: 32, position: { x: 62, y: 30 } },
    { id: "bratislava", label: "Bratislava", value: 44, position: { x: 70, y: 62 } },
  ];

  return (
    <div className="space-y-3 text-sm text-neutral-700">
      <div className="flex items-center gap-2 text-neutral-900">
        <Flame className="h-5 w-5 text-orange-500" />
        <span className="font-semibold">Heat mapa příspěvků (live feeling)</span>
      </div>

      <div className="relative overflow-hidden rounded-2xl border border-neutral-200 bg-linear-to-br from-slate-900 via-slate-800 to-slate-900 px-4 py-4 text-xs text-white shadow-inner">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.06),transparent_45%),radial-gradient(circle_at_70%_80%,rgba(255,255,255,0.05),transparent_40%)]" />
        <div className="absolute inset-4 rounded-xl border border-white/5" />

        <div className="relative aspect-4/3 w-full">
          {heatData.map((spot) => {
            const intensity = Math.min(1, spot.value / 90);
            const size = 26 + intensity * 24;
            const glow = `rgba(255, 170, 43, ${0.15 + intensity * 0.4})`;
            const core = `rgba(255, 120, 0, ${0.35 + intensity * 0.45})`;
            return (
              <div
                key={spot.id}
                style={{
                  left: `${spot.position.x}%`,
                  top: `${spot.position.y}%`,
                }}
                className="absolute -translate-x-1/2 -translate-y-1/2"
              >
                <div
                  style={{
                    width: size * 1.5,
                    height: size * 1.5,
                    background: `radial-gradient(circle, ${glow} 0%, transparent 65%)`,
                  }}
                  className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 blur-sm"
                />
                <div
                  style={{
                    width: size,
                    height: size,
                    background: `radial-gradient(circle, ${core} 0%, rgba(255,120,0,0.15) 65%, transparent 100%)`,
                  }}
                  className="relative rounded-full ring-2 ring-orange-500/30"
                />
                <div className="mt-1 text-center text-[11px] font-semibold text-white drop-shadow-sm">
                  {spot.label}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-3 flex items-center justify-between text-[11px] text-neutral-200">
          <span className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-orange-400" />
            Přetahuj mapu pro live přehled (mock data)
          </span>
          <span className="text-neutral-300">Nejvíc: Praha · {heatData[0].value}+</span>
        </div>
      </div>

      <p className="text-[11px] text-neutral-500">
        Podobně jako Snapchat Map – ukazuje hotspoty, kde se teď objevuje nejvíc nReal/nNews
        příspěvků. Data jsou zatím demo.
      </p>
    </div>
  );
}
