export default function SearchPage() {
  return (
    <main className="min-h-screen bg-white mx-auto max-w-4xl px-4 py-10 space-y-6">
      <header className="space-y-1">
        <p className="text-xs uppercase tracking-[0.2em] text-neutral-600">
          Vyhledávání
        </p>
        <h1 className="text-3xl font-semibold text-neutral-900">Hledat obsah</h1>
        <p className="text-sm text-neutral-700">
          Prohledej příspěvky, videa a navržené tipy. Taky tu najdeš doporučené
          příspěvky nebo zprávy podle aktivity.
        </p>
      </header>

      <div className="space-y-4 rounded-xl border border-neutral-200/70 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3 rounded-lg border border-neutral-200/70 px-4 py-3">
          <input
            type="search"
            className="w-full bg-transparent text-sm text-neutral-900 placeholder:text-neutral-500 outline-none"
            placeholder="Hledat příspěvky, videa nebo uživatele..."
          />
        </div>
        <div className="text-sm text-neutral-600">
          Vyhledávání je zatím statické. Doporučené výsledky a navržené zprávy se tu
          objeví později.
        </div>
      </div>
    </main>
  );
}
