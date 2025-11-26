export default function NotificationsPage() {
  return (
    <main className="min-h-screen bg-white mx-auto max-w-4xl px-4 py-10 space-y-4">
      <header className="space-y-1">
        <p className="text-xs uppercase tracking-[0.2em] text-neutral-600">
          Centrum upozornění
        </p>
        <h1 className="text-3xl font-semibold text-neutral-900">Oznámení</h1>
        <p className="text-sm text-neutral-700">
          Tady uvidíš nové zprávy, zmínky, pozvánky a všechny další notifikace.
        </p>
      </header>

      <div className="rounded-xl border border-neutral-200/70 bg-white p-6 shadow-sm">
        <p className="text-sm text-neutral-600">
          Zatím žádné notifikace. Jakmile se něco stane, objeví se to tady.
        </p>
      </div>
    </main>
  );
}
