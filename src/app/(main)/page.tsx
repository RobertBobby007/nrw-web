type FeedItem = {
  id: string;
  type: "nReal" | "nNews";
  title: string;
  excerpt: string;
  meta: string;
};

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

export default function HomePage() {
  const activeTab = "Mix";

  return (
    <main className="min-h-screen bg-neutral-50 pb-24">
      <section className="mx-auto max-w-5xl px-4 py-8 space-y-8">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-[0.2em] text-neutral-600">
            NRW · Home
          </p>
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
      </section>
    </main>
  );
}
