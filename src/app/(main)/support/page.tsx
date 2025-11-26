export default function SupportPage() {
  return (
    <main className="min-h-screen bg-white mx-auto max-w-4xl px-4 py-10 space-y-6">
      <header className="space-y-1">
        <p className="text-xs uppercase tracking-[0.2em] text-neutral-600">
          Centrum pomoci
        </p>
        <h1 className="text-3xl font-semibold text-neutral-900">Podpora</h1>
        <p className="text-sm text-neutral-700">
          Potřebuješ poradit? Napiš nám, zkontroluj stav účtu nebo nahlas problém.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded-xl border border-neutral-200/70 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-neutral-900">Kontakt</h2>
          <p className="mt-2 text-sm text-neutral-700">
            support@nrw.app nebo in-app chat s podporou. Reagujeme co nejdřív.
          </p>
          <button className="mt-4 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800">
            Otevřít chat s podporou
          </button>
        </section>

        <section className="rounded-xl border border-neutral-200/70 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-neutral-900">Nahlásit problém</h2>
          <p className="mt-2 text-sm text-neutral-700">
            Napiš, co nefunguje nebo co bys chtěl vylepšit. Pomůžeš nám to opravit.
          </p>
          <button className="mt-4 rounded-lg border border-neutral-200/70 px-4 py-2 text-sm font-medium text-neutral-800 transition hover:border-neutral-400">
            Odeslat hlášení
          </button>
        </section>
      </div>

      <section className="rounded-xl border border-neutral-200/70 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-neutral-900">FAQ</h2>
        <ul className="mt-3 space-y-2 text-sm text-neutral-700">
          <li>• Jak změnit heslo nebo e-mail.</li>
          <li>• Jak upravit profil nebo smazat účet.</li>
          <li>• Řešení problémů s přihlášením a notifikacemi.</li>
        </ul>
      </section>
    </main>
  );
}
