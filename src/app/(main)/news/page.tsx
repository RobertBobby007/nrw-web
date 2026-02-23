"use client";

import { Check, ChevronDown, Flame } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { NNewsFeedItem } from "@/lib/nnews";
import { detectNewsTopics, NEWS_TOPICS, topicLabel, type NewsTopicId } from "@/lib/news-topics";
import { NewsPreviewModal } from "@/components/news/NewsPreviewModal";

type NewsItem = {
  id: string;
  category: string;
  title: string;
  excerpt: string;
  meta: string;
  url: string | null;
  imageUrl: string | null;
  createdAt: string;
  topics: NewsTopicId[];
};

type NewsFeedResponse = {
  success?: boolean;
  items?: NNewsFeedItem[];
  error?: string;
};

function formatNewsDate(iso: string) {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleDateString("cs-CZ", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function getFaviconUrl(link?: string | null) {
  if (!link) return null;
  try {
    const hostname = new URL(link).hostname;
    if (!hostname) return null;
    return `https://www.google.com/s2/favicons?domain=${hostname}&sz=32`;
  } catch {
    return null;
  }
}

export default function NewsPage() {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTopics, setSelectedTopics] = useState<NewsTopicId[]>([]);
  const [isTopicMenuOpen, setIsTopicMenuOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState<string | null>(null);
  const availableTopics = useMemo(
    () =>
      NEWS_TOPICS.filter((topic) =>
        items.some((item) => item.topics.includes(topic.id)),
      ),
    [items],
  );

  const visibleItems = useMemo(() => {
    if (selectedTopics.length === 0) return items;
    return items.filter((item) => item.topics.some((topic) => selectedTopics.includes(topic)));
  }, [items, selectedTopics]);

  const toggleTopic = (topic: NewsTopicId) => {
    setSelectedTopics((prev) =>
      prev.includes(topic) ? prev.filter((entry) => entry !== topic) : [...prev, topic],
    );
  };

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/news/feed?limit=60", { cache: "no-store" });
        const payload = (await res.json()) as NewsFeedResponse;
        if (!res.ok || payload.success === false) {
          throw new Error(payload.error ?? "Nepodařilo se načíst nNews.");
        }
        if (!active) return;
        setItems(
          (payload.items ?? []).map((item) => ({
            id: item.id,
            category: item.sourceName ?? "nNews",
            title: item.title,
            excerpt: item.excerpt,
            meta: item.meta,
            url: item.url,
            imageUrl: item.imageUrl ?? null,
            createdAt: item.createdAt,
            topics: detectNewsTopics(item),
          })),
        );
      } catch (err) {
        if (!active) return;
        setItems([]);
        setError(err instanceof Error ? err.message : "Nepodařilo se načíst nNews.");
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="min-h-screen bg-neutral-50 lg:h-screen lg:overflow-hidden">
      <section className="mx-auto max-w-6xl px-4 py-8 space-y-8 lg:flex lg:h-full lg:min-h-0 lg:flex-col">
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">NRW News – přehled novinek</h1>
          <p className="max-w-xl text-sm text-neutral-600">
            Aktualizace z NRW světa, nové funkce, změny v aplikaci a důležité zprávy na jednom
            místě.
          </p>
        </header>

        <div className="relative inline-flex items-center">
          <button
            type="button"
            onClick={() => setIsTopicMenuOpen((prev) => !prev)}
            className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-[11px] font-medium text-neutral-700 shadow-sm hover:bg-neutral-50"
          >
            Témata
            <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] text-neutral-600">
              {selectedTopics.length === 0 ? "Vše" : selectedTopics.length}
            </span>
            <ChevronDown className="h-3.5 w-3.5" />
          </button>

          {isTopicMenuOpen ? (
            <div className="absolute left-0 top-full z-20 mt-2 w-72 rounded-xl border border-neutral-200 bg-white p-2 shadow-lg">
              <button
                type="button"
                onClick={() => setSelectedTopics([])}
                className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs text-neutral-700 hover:bg-neutral-50"
              >
                <span>Všechna témata</span>
                {selectedTopics.length === 0 ? <Check className="h-4 w-4" /> : null}
              </button>
              <div className="my-1 h-px bg-neutral-100" />
              <div className="max-h-64 overflow-y-auto">
                {availableTopics.map((topic) => {
                  const isActive = selectedTopics.includes(topic.id);
                  return (
                    <button
                      key={topic.id}
                      type="button"
                      onClick={() => toggleTopic(topic.id)}
                      className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs text-neutral-700 hover:bg-neutral-50"
                    >
                      <span className="truncate">{topicLabel(topic.id)}</span>
                      {isActive ? <Check className="h-4 w-4" /> : null}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>

        <div className="grid gap-6 lg:flex-1 lg:min-h-0 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="space-y-3 lg:min-h-0 lg:overflow-y-auto lg:pr-2">
            {error ? (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                Nepodařilo se načíst nNews: {error}
              </div>
            ) : null}
            {loading ? (
              <div className="rounded-xl border border-neutral-200 bg-white p-4 text-sm text-neutral-600 shadow-sm">
                Načítám nNews…
              </div>
            ) : null}
            {!loading && !error && visibleItems.length === 0 ? (
              <div className="rounded-xl border border-neutral-200 bg-white p-4 text-sm text-neutral-600 shadow-sm">
                Zatím tu nic není.
              </div>
            ) : null}
            {visibleItems.map((item) => {
              const favicon = getFaviconUrl(item.url);
              return (
                <article
                  key={item.id}
                  className="rounded-xl border border-neutral-200 bg-white p-4 text-sm shadow-sm"
                >
                  <div className="grid grid-cols-[1fr_88px] gap-4 sm:grid-cols-[1fr_104px]">
                    <div className="min-w-0 space-y-1">
                      <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-neutral-500">
                        {item.category}
                      </p>
                      <h2 className="line-clamp-2 text-base font-semibold tracking-tight">{item.title}</h2>
                      <p className="line-clamp-3 text-xs text-neutral-600">{item.excerpt}</p>
                    </div>
                    {item.imageUrl ? (
                      <img
                        src={item.imageUrl}
                        alt={item.title}
                        className="h-[88px] w-[88px] rounded-lg object-cover sm:h-[104px] sm:w-[104px]"
                        loading="lazy"
                      />
                    ) : (
                      <div className="h-[88px] w-[88px] rounded-lg border border-neutral-200 bg-neutral-100 sm:h-[104px] sm:w-[104px]" />
                    )}
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-1.5 text-[11px] text-neutral-400">
                      {favicon ? (
                        <img
                          src={favicon}
                          alt=""
                          className="h-4 w-4 rounded-sm"
                          loading="lazy"
                        />
                      ) : null}
                      <span className="truncate">{item.category}</span>
                      <span>·</span>
                      <span>{formatNewsDate(item.createdAt)}</span>
                    </div>
                    {item.url ? (
                      <button
                        type="button"
                        onClick={() => {
                          setPreviewUrl(item.url);
                          setPreviewTitle(item.title);
                        }}
                        className="text-[11px] font-medium text-neutral-700 hover:text-neutral-900"
                      >
                        Otevřít
                      </button>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>

          <aside className="hidden space-y-3 lg:block lg:sticky lg:top-6 lg:h-full lg:min-h-0 lg:overflow-y-auto lg:pr-1">
            <CategoryWidget />
            <TagWidget />
          </aside>
        </div>
      </section>
      <NewsPreviewModal
        open={Boolean(previewUrl)}
        url={previewUrl}
        title={previewTitle}
        onClose={() => {
          setPreviewUrl(null);
          setPreviewTitle(null);
        }}
      />
    </main>
  );
}

const categoryHotspots = [
  { id: "world", label: "Zprávy ze světa", count: 8 },
  { id: "updates", label: "Update aplikace", count: 12 },
  { id: "security", label: "Bezpečnost", count: 5 },
  { id: "community", label: "Komunita", count: 9 },
  { id: "events", label: "Eventy a livestreamy", count: 3 },
  { id: "tips", label: "Tipy a návody", count: 6 },
];

function CategoryWidget() {
  return (
    <div className="space-y-2 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between text-sm font-semibold text-neutral-900">
        Kategorie
        <span className="flex items-center gap-1 text-xs font-medium text-neutral-500">
          <Flame className="h-4 w-4 text-red-500" />
          Nejvíc čtené
        </span>
      </div>
      <div className="space-y-2 text-sm text-neutral-700">
        {categoryHotspots.map((item) => (
          <div
            key={item.id}
            className="flex items-center justify-between rounded-lg border border-neutral-100 bg-neutral-50 px-3 py-2"
          >
            <span className="font-medium text-neutral-900">{item.label}</span>
            <span className="rounded-full bg-neutral-900 px-2 py-0.5 text-[11px] font-semibold text-white">
              {item.count}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

const tags = ["NRW", "Produkt", "nReal", "nChat", "Bezpečnost", "Aktualizace", "Komunita", "Podpora"];

function TagWidget() {
  return (
    <div className="space-y-3 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="text-sm font-semibold text-neutral-900">Další štítky</div>
      <div className="flex flex-wrap gap-2 text-[11px] text-neutral-600">
        {tags.map((tag) => (
          <span
            key={tag}
            className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 font-medium"
          >
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
}
