export default function TermsPage() {
  return (
    <main className="min-h-screen bg-white mx-auto max-w-4xl px-4 py-10 space-y-6">
      <header className="space-y-1">
        <p className="text-xs uppercase tracking-[0.2em] text-neutral-600">Právní informace</p>
        <h1 className="text-3xl font-semibold text-neutral-900">Smluvní podmínky</h1>
        <p className="text-sm text-neutral-700">
          Základní pravidla používání služby NRW. Detailní znění podmínek doplníme.
        </p>
      </header>

      <section className="rounded-xl border border-neutral-200/70 bg-white p-5 shadow-sm space-y-3">
        <h2 className="text-lg font-semibold text-neutral-900">Účet a přístup</h2>
        <ul className="text-sm text-neutral-700 space-y-2">
          <li>• Jsi odpovědný za bezpečnost svého účtu.</li>
          <li>• Nepoužívej službu k nelegálním nebo škodlivým účelům.</li>
          <li>• Můžeme omezit účet při porušení pravidel nebo zákona.</li>
        </ul>
      </section>

      <section className="rounded-xl border border-neutral-200/70 bg-white p-5 shadow-sm space-y-3">
        <h2 className="text-lg font-semibold text-neutral-900">Obsah</h2>
        <ul className="text-sm text-neutral-700 space-y-2">
          <li>• Za svůj obsah odpovídáš ty.</li>
          <li>• V rámci moderace můžeme obsah skrýt nebo odstranit.</li>
          <li>• Respektuj práva ostatních uživatelů.</li>
          <li>• Nezveřejňuj citlivé údaje, které nechceš sdílet.</li>
        </ul>
      </section>

      <section className="rounded-xl border border-neutral-200/70 bg-white p-5 shadow-sm space-y-3">
        <h2 className="text-lg font-semibold text-neutral-900">Pravidla komunity</h2>
        <ul className="text-sm text-neutral-700 space-y-2">
          <li>• Zákaz obtěžování, vyhrožování a šíření nenávisti.</li>
          <li>• Zákaz spamu a podvodů.</li>
          <li>• Zákaz nelegálního obsahu.</li>
        </ul>
      </section>

      <section className="rounded-xl border border-neutral-200/70 bg-white p-5 shadow-sm space-y-3">
        <h2 className="text-lg font-semibold text-neutral-900">Změny služby</h2>
        <p className="text-sm text-neutral-700">
          Službu můžeme průběžně upravovat, vylepšovat nebo ukončit. O důležitých změnách dáme vědět.
        </p>
      </section>

      <section className="rounded-xl border border-neutral-200/70 bg-white p-5 shadow-sm space-y-3">
        <h2 className="text-lg font-semibold text-neutral-900">FAQ</h2>
        <ul className="text-sm text-neutral-700 space-y-2">
          <li>• Co když mi někdo zneužije účet? Kontaktuj support co nejdřív.</li>
          <li>• Můžu svůj obsah smazat? Ano, u příspěvků a zpráv to půjde přes UI.</li>
          <li>• Jak se odhlásím ze služby? Kdykoliv v nastavení účtu.</li>
        </ul>
      </section>

      <section className="rounded-xl border border-neutral-200/70 bg-white p-5 shadow-sm space-y-2">
        <h2 className="text-lg font-semibold text-neutral-900">Kontakt</h2>
        <p className="text-sm text-neutral-700">Dotazy k podmínkám: support@nrw.app</p>
      </section>
    </main>
  );
}
