export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-white mx-auto max-w-4xl px-4 py-10 space-y-6">
      <header className="space-y-1">
        <p className="text-xs uppercase tracking-[0.2em] text-neutral-600">Právní informace</p>
        <h1 className="text-3xl font-semibold text-neutral-900">Ochrana soukromí</h1>
        <p className="text-sm text-neutral-700">
          Stručný přehled toho, jak nakládáme s osobními údaji v NRW. Detailní znění doplníme.
        </p>
      </header>

      <section className="rounded-xl border border-neutral-200/70 bg-white p-5 shadow-sm space-y-3">
        <h2 className="text-lg font-semibold text-neutral-900">Jaké údaje zpracováváme</h2>
        <ul className="text-sm text-neutral-700 space-y-2">
          <li>• Účetní údaje: e-mail, uživatelské jméno, identifikátor účtu.</li>
          <li>• Profilové údaje: jméno, bio, avatar a nastavení profilu.</li>
          <li>• Obsah: zprávy, příspěvky a nahraná média (podle toho, co sdílíš).</li>
          <li>• Komunikace se supportem: obsah zpráv a metadata podpory.</li>
          <li>• Technické údaje: zařízení, IP adresa, logy přístupů a bezpečnostní události.</li>
        </ul>
      </section>

      <section className="rounded-xl border border-neutral-200/70 bg-white p-5 shadow-sm space-y-3">
        <h2 className="text-lg font-semibold text-neutral-900">Proč údaje zpracováváme</h2>
        <ul className="text-sm text-neutral-700 space-y-2">
          <li>• Provoz služby, doručování zpráv a personalizaci obsahu.</li>
          <li>• Bezpečnost, prevence zneužití a moderace.</li>
          <li>• Analytika pro zlepšení aplikace (agregovaně).</li>
          <li>• Zákonné povinnosti a ochrana práv.</li>
        </ul>
      </section>

      <section className="rounded-xl border border-neutral-200/70 bg-white p-5 shadow-sm space-y-3">
        <h2 className="text-lg font-semibold text-neutral-900">Kdo má přístup k údajům</h2>
        <p className="text-sm text-neutral-700">
          Přístup mají pouze oprávněné osoby a dodavatelé, kteří jsou nezbytní pro provoz služby
          (např. hosting a infrastruktura). Se všemi partnery máme uzavřené smlouvy o ochraně údajů.
        </p>
      </section>

      <section className="rounded-xl border border-neutral-200/70 bg-white p-5 shadow-sm space-y-3">
        <h2 className="text-lg font-semibold text-neutral-900">Uchování údajů</h2>
        <p className="text-sm text-neutral-700">
          Údaje uchováváme po dobu nezbytnou k provozu služby nebo dle zákonných povinností. Pokud
          účet zrušíš, data postupně odstraníme nebo anonymizujeme.
        </p>
      </section>

      <section className="rounded-xl border border-neutral-200/70 bg-white p-5 shadow-sm space-y-3">
        <h2 className="text-lg font-semibold text-neutral-900">Vaše práva</h2>
        <ul className="text-sm text-neutral-700 space-y-2">
          <li>• Právo na přístup, opravu a výmaz.</li>
          <li>• Právo na omezení zpracování a přenositelnost.</li>
          <li>• Právo vznést námitku.</li>
        </ul>
      </section>

      <section className="rounded-xl border border-neutral-200/70 bg-white p-5 shadow-sm space-y-3">
        <h2 className="text-lg font-semibold text-neutral-900">FAQ</h2>
        <ul className="text-sm text-neutral-700 space-y-2">
          <li>• Jak získám kopii svých údajů? Napiš na support@nrw.app.</li>
          <li>• Jak smažu účet? Požádej support nebo v nastavení účtu.</li>
          <li>• Sdílíte data s třetími stranami? Jen s nutnými partnery pro provoz služby.</li>
        </ul>
      </section>

      <section className="rounded-xl border border-neutral-200/70 bg-white p-5 shadow-sm space-y-2">
        <h2 className="text-lg font-semibold text-neutral-900">Kontakt</h2>
        <p className="text-sm text-neutral-700">Dotazy k ochraně soukromí: support@nrw.app</p>
      </section>
    </main>
  );
}
