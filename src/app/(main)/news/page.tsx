"use client";

import { Flame } from "lucide-react";

type NewsItem = {
  id: string;
  category: string;
  title: string;
  excerpt: string;
  meta: string;
};

const demoNews: NewsItem[] = [
  {
    id: "1",
    category: "Update aplikace",
    title: "NRW 0.2.0: první veřejná alpha",
    excerpt: "Přinášíme nový sidebar, NRStream feed a základní přihlášení uživatelů...",
    meta: "NRW Team · dnes",
  },
  {
    id: "2",
    category: "Bezpečnost",
    title: "Změny v ochraně soukromí",
    excerpt: "Upravili jsme, jak pracujeme s daty a jak si můžeš nastavit viditelnost profilu...",
    meta: "NRW Trust & Safety · před 2 dny",
  },
  {
    id: "3",
    category: "Komunita",
    title: "NRW Community event #1",
    excerpt: "První setkání uživatelů NRW – online i offline, společně o budoucnosti platformy...",
    meta: "NRW Community · minulý týden",
  },
];

const categories = ["Vše", "Navrhováno pro vás", "Sleduji"];

export default function NewsPage() {
  const activeCategory = "Vše";

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

        <div className="flex flex-wrap items-center gap-2 text-xs">
          {categories.map((category) => {
            const isActive = category === activeCategory;
            return (
              <button
                key={category}
                type="button"
                className={
                  isActive
                    ? "rounded-full bg-black px-3 py-1 text-[11px] font-medium text-white"
                    : "rounded-full border border-neutral-200 bg-white px-3 py-1 text-[11px] font-medium text-neutral-600"
                }
              >
                {category}
              </button>
            );
          })}
        </div>

        <div className="grid gap-6 lg:flex-1 lg:min-h-0 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="space-y-3 lg:min-h-0 lg:overflow-y-auto lg:pr-2">
            {demoNews.map((item) => (
              <article
                key={item.id}
                className="space-y-1 rounded-xl border border-neutral-200 bg-white p-4 text-sm shadow-sm"
              >
                <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-neutral-500">
                  {item.category}
                </p>
                <h2 className="text-base font-semibold tracking-tight">{item.title}</h2>
                <p className="text-xs text-neutral-600">{item.excerpt}</p>
                <p className="text-[11px] text-neutral-400">{item.meta}</p>
              </article>
            ))}
          </div>

          <aside className="hidden space-y-3 lg:block lg:sticky lg:top-6 lg:h-full lg:min-h-0 lg:overflow-y-auto lg:pr-1">
            <CategoryWidget />
            <TagWidget />
          </aside>
        </div>
      </section>
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
