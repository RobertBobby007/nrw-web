"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

export default function CreatePage() {
  const router = useRouter();
  const supabase = getSupabaseBrowserClient();

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [contentType, setContentType] = useState("Text");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const content = `${title ? `${title}\n\n` : ""}${body}`.trim();
    if (!content) {
      setError("Napiš prosím obsah příspěvku.");
      return;
    }

    setLoading(true);
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setError("Musíš být přihlášený, abys publikoval.");
      setLoading(false);
      return;
    }

    const { error: insertError } = await supabase
      .from("nreal_posts")
      .insert({ content, user_id: user.id });

    setLoading(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    router.push("/real");
  };

  return (
    <main className="min-h-screen bg-white mx-auto max-w-4xl px-4 py-10 space-y-6">
      <div className="flex items-start justify-between gap-4">
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

        <div className="flex flex-col items-end gap-2 text-xs">
          <span className="rounded-full border border-neutral-200 px-3 py-1 font-semibold uppercase tracking-wide text-neutral-600">
            Dev
          </span>
          <div className="flex gap-2">
            <a
              href="/auth/login"
              className="rounded-lg border border-neutral-200 px-3 py-1 font-medium text-neutral-700 transition hover:border-neutral-400 hover:text-neutral-900"
            >
              Login
            </a>
            <a
              href="/auth/register"
              className="rounded-lg border border-neutral-200 px-3 py-1 font-medium text-neutral-700 transition hover:border-neutral-400 hover:text-neutral-900"
            >
              Registrace
            </a>
          </div>
        </div>
      </div>

      <form
        onSubmit={handlePublish}
        className="space-y-4 rounded-xl border border-neutral-200/70 bg-white p-6 shadow-sm"
      >
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2 text-sm text-neutral-700">
            <span className="font-semibold text-neutral-900">Nadpis</span>
            <input
              type="text"
              className="w-full rounded-lg border border-neutral-200/70 px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-500 outline-none focus:border-neutral-400"
              placeholder="Krátký titulek příspěvku"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          <label className="space-y-2 text-sm text-neutral-700">
            <span className="font-semibold text-neutral-900">Typ obsahu</span>
            <select
              className="w-full rounded-lg border border-neutral-200/70 px-3 py-2 text-sm text-neutral-900 outline-none focus:border-neutral-400"
              value={contentType}
              onChange={(e) => setContentType(e.target.value)}
            >
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
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
        </label>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            className="rounded-lg border border-dashed border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 transition hover:border-neutral-500"
          >
            Nahrát přílohu
          </button>
          <button
            type="button"
            className="rounded-lg border border-dashed border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 transition hover:border-neutral-500"
          >
            Přidat video
          </button>
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-3">
          <button
            type="button"
            className="rounded-lg px-4 py-2 text-sm font-medium text-neutral-600 transition hover:text-neutral-900"
          >
            Uložit koncept
          </button>
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-80"
          >
            {loading ? "Publikuji…" : "Publikovat"}
          </button>
        </div>
      </form>
    </main>
  );
}
