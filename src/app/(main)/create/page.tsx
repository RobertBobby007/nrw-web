/* eslint-disable @next/next/no-img-element */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { containsBlockedContent } from "@/lib/content-filter";

export default function CreatePage() {
  const router = useRouter();
  const supabase = getSupabaseBrowserClient();

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [contentType, setContentType] = useState("Text");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<"image" | "video" | null>(null);

  const handleFileChange = (file?: File | null) => {
    setError(null);
    if (!file) {
      setMediaFile(null);
      setMediaPreview(null);
      setMediaType(null);
      return;
    }
    const type = file.type.startsWith("video") ? "video" : "image";
    setMediaFile(file);
    setMediaPreview(URL.createObjectURL(file));
    setMediaType(type);
  };

  const uploadMedia = async (file: File, userId: string) => {
    const ext = file.name.split(".").pop() || "bin";
    const path = `${userId}/${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage.from("nreal_media").upload(path, file, {
      upsert: true,
      cacheControl: "3600",
    });
    if (uploadError) {
      setError("Nahrání souboru selhalo.");
      return null;
    }
    const { data } = supabase.storage.from("nreal_media").getPublicUrl(path);
    return data.publicUrl ?? null;
  };

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const content = `${title ? `${title}\n\n` : ""}${body}`.trim() || null;
    if (!content && !mediaFile) {
      setError("Přidej text nebo soubor.");
      return;
    }
    if (content) {
      const { hit } = containsBlockedContent(content);
      if (hit) {
        setError("Uprav text – obsahuje zakázané výrazy.");
        return;
      }
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

    let mediaUrl: string | null = null;
    if (mediaFile) {
      mediaUrl = await uploadMedia(mediaFile, user.id);
      if (!mediaUrl) {
        setLoading(false);
        return;
      }
    }

    const response = await fetch("/api/nreal/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content,
        media_url: mediaUrl,
        media_type: mediaType,
      }),
    });
    const payload = await response.json().catch(() => null);

    setLoading(false);

    if (!response.ok) {
      if (payload?.error === "blocked_content") {
        setError("Uprav text – obsahuje zakázané výrazy.");
      } else if (payload?.error === "unauthorized") {
        setError("Musíš být přihlášený, abys publikoval.");
      } else {
        setError(payload?.message ?? "Publikace selhala.");
      }
      return;
    }

    router.push("/real");
  };

  return (
    <div className="min-h-screen bg-white mx-auto max-w-4xl px-4 py-10 space-y-6">
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
          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 transition hover:border-neutral-500">
            <input
              type="file"
              accept="image/*,video/*"
              className="hidden"
              onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
            />
            {mediaPreview ? "Změnit soubor" : "Nahrát fotku/video"}
          </label>
          {mediaPreview && (
            <button
              type="button"
              onClick={() => handleFileChange(null)}
              className="rounded-lg border border-neutral-200 px-3 py-1 text-sm font-medium text-neutral-600 transition hover:border-neutral-400"
            >
              Odebrat
            </button>
          )}
        </div>

        {mediaPreview && (
          <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-700">
            <div className="mb-2 font-semibold">Náhled</div>
            {mediaType === "video" ? (
              <video src={mediaPreview} controls className="w-full max-h-[320px] rounded-lg" />
            ) : (
              <img src={mediaPreview} alt="Náhled" className="w-full max-h-[320px] rounded-lg object-cover" />
            )}
          </div>
        )}

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
    </div>
  );
}
