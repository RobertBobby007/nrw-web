import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-white">
      <section className="mx-auto max-w-5xl px-4 py-12 space-y-10">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-[0.2em] text-neutral-700">
            NRW · web alpha
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-neutral-900">
            Vítej v NRW.
          </h1>
          <p className="max-w-xl text-sm text-neutral-800">
            Tohle je zatím interní web verze NRW. Odsud se dostaneš do chatu,
            seznamování, příběhů, novinek a správy účtu.
          </p>
        </header>

        <section className="grid gap-4 md:grid-cols-3">
          <Link
            href="/chat"
            className="group rounded-xl border border-neutral-200 bg-white p-4 text-sm shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="mb-2 text-xs font-medium uppercase tracking-[0.18em] text-neutral-700">
              nChat
            </div>
            <p className="font-semibold mb-1 text-neutral-900">Zprávy & hovory</p>
            <p className="text-xs text-neutral-700">
              Soukromé zprávy, skupiny a později audio/video hovory.
            </p>
          </Link>

          <Link
            href="/love"
            className="group rounded-xl border border-neutral-200 bg-white p-4 text-sm shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="mb-2 text-xs font-medium uppercase tracking-[0.18em] text-neutral-700">
              nLove
            </div>
            <p className="font-semibold mb-1 text-neutral-900">Seznamování</p>
            <p className="text-xs text-neutral-700">
              Profily, matchování a bezpečné seznamování v NRW ekosystému.
            </p>
          </Link>

          <Link
            href="/real"
            className="group rounded-xl border border-neutral-200 bg-white p-4 text-sm shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="mb-2 text-xs font-medium uppercase tracking-[0.18em] text-neutral-700">
              nReal
            </div>
            <p className="font-semibold mb-1 text-neutral-900">Příběhy & blog</p>
            <p className="text-xs text-neutral-700">
              Dlouhé posty, články, deníčky a osobní příběhy.
            </p>
          </Link>

          <Link
            href="/news"
            className="group rounded-xl border border-neutral-200 bg-white p-4 text-sm shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="mb-2 text-xs font-medium uppercase tracking-[0.18em] text-neutral-700">
              nNews
            </div>
            <p className="font-semibold mb-1 text-neutral-900">Novinky & přehled</p>
            <p className="text-xs text-neutral-700">
              Kurátorovaný feed informací a update z NRW světa.
            </p>
          </Link>

          <Link
            href="/id"
            className="group rounded-xl border border-neutral-200 bg-white p-4 text-sm shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="mb-2 text-xs font-medium uppercase tracking-[0.18em] text-neutral-700">
              nID
            </div>
            <p className="font-semibold mb-1 text-neutral-900">Účet & identita</p>
            <p className="text-xs text-neutral-700">
              Přihlášení, správa účtu, preference a bezpečnost.
            </p>
          </Link>
        </section>
      </section>
    </main>
  );
}
