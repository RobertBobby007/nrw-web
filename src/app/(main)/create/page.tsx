export default function CreatePage() {
  return (
    <main className="min-h-screen bg-white mx-auto max-w-4xl px-4 py-10 space-y-6">
      <header className="space-y-1">
        <p className="text-xs uppercase tracking-[0.2em] text-neutral-600">
          Nový obsah
        </p>
        <h1 className="text-3xl font-semibold text-neutral-900">
          Přidat příspěvek nebo video
        </h1>
        <p className="text-sm text-neutral-700">
          Sdílej text, fotky nebo videa. Brzy přibudou náhledy a plánování
          publikace.
        </p>
      </header>

      <div className="space-y-4 rounded-xl border border-neutral-200/70 bg-white p-6 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2 text-sm text-neutral-700">
            <span className="font-semibold text-neutral-900">Nadpis</span>
            <input
              type="text"
              className="w-full rounded-lg border border-neutral-200/70 px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-500 outline-none focus:border-neutral-400"
              placeholder="Krátký titulek příspěvku"
            />
          </label>
          <label className="space-y-2 text-sm text-neutral-700">
            <span className="font-semibold text-neutral-900">Typ obsahu</span>
            <select className="w-full rounded-lg border border-neutral-200/70 px-3 py-2 text-sm text-neutral-900 outline-none focus:border-neutral-400">
              <option>Text</option>
              <option>Foto</option>
              <option>Video</option>
            </select>
          </label>
        </div>

        <label className="space-y-2 text-sm text-neutral-700">
          <span className="font-semibold text-neutral-900">Obsah</span>
          <textarea
            rows={6}
            className="w-full resize-none rounded-lg border border-neutral-200/70 px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-500 outline-none focus:border-neutral-400"
            placeholder="Napiš, co chceš sdílet..."
          />
        </label>

        <div className="flex flex-wrap gap-3">
          <button className="rounded-lg border border-dashed border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 transition hover:border-neutral-500">
            Nahrát přílohu
          </button>
          <button className="rounded-lg border border-dashed border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 transition hover:border-neutral-500">
            Přidat video
          </button>
        </div>

        <div className="flex justify-end gap-3">
          <button className="rounded-lg px-4 py-2 text-sm font-medium text-neutral-600 transition hover:text-neutral-900">
            Uložit koncept
          </button>
          <button className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800">
            Publikovat
          </button>
        </div>
      </div>
    </main>
  );
}
