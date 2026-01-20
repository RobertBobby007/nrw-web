/* eslint-disable @next/next/no-img-element */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { MAX_POST_MEDIA_IMAGES, serializeMediaUrls } from "@/lib/media";
import { containsBlockedContent } from "@/lib/content-filter";
import { requestAuth } from "@/lib/auth-required";

export default function CreatePage() {
  const router = useRouter();
  const supabase = getSupabaseBrowserClient();

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [contentType, setContentType] = useState("Text");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [mediaPreviews, setMediaPreviews] = useState<string[]>([]);
  const [mediaType, setMediaType] = useState<"image" | "video" | null>(null);

  const resetMedia = () => {
    mediaPreviews.forEach((url) => URL.revokeObjectURL(url));
    setMediaFiles([]);
    setMediaPreviews([]);
    setMediaType(null);
  };

  const handleFileChange = (fileList?: FileList | null) => {
    setError(null);
    const files = fileList ? Array.from(fileList) : [];
    if (files.length === 0) {
      resetMedia();
      return;
    }
    const containsVideo = files.some((file) => file.type.startsWith("video"));
    const hasExistingMedia = mediaFiles.length > 0;
    if (containsVideo) {
      if (files.length > 1 || hasExistingMedia) {
        setError("Video nelze kombinovat s fotkami a jde nahrát jen jedno.");
        return;
      }
      const file = files.find((f) => f.type.startsWith("video")) ?? files[0];
      resetMedia();
      setMediaFiles([file]);
      setMediaPreviews([URL.createObjectURL(file)]);
      setMediaType("video");
      return;
    }

    const nextFiles = [...(mediaType === "image" ? mediaFiles : []), ...files].slice(0, MAX_POST_MEDIA_IMAGES);
    if (nextFiles.length < (mediaFiles.length + files.length)) {
      setError(`Maximálně ${MAX_POST_MEDIA_IMAGES} fotky.`);
    }
    resetMedia();
    setMediaFiles(nextFiles);
    setMediaPreviews(nextFiles.map((file) => URL.createObjectURL(file)));
    setMediaType("image");
  };

  const uploadMedia = async (files: File[], userId: string) => {
    const uploaded: string[] = [];
    for (const [index, file] of files.entries()) {
      const ext = file.name.split(".").pop() || "bin";
      const path = `${userId}/${Date.now()}-${index}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("nreal_media").upload(path, file, {
        upsert: true,
        cacheControl: "3600",
      });
      if (uploadError) {
        setError("Nahrání souboru selhalo.");
        return null;
      }
      const { data } = supabase.storage.from("nreal_media").getPublicUrl(path);
      if (data.publicUrl) uploaded.push(data.publicUrl);
    }
    return uploaded;
  };

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError(null);

    const content = `${title ? `${title}\n\n` : ""}${body}`.trim() || null;
    if (!content && mediaFiles.length === 0) {
      setError("Přidej text nebo soubor.");
      return;
    }
    if (content) {
      const { hit } = containsBlockedContent(content);
      if (hit) {
        setError("Uprav text – obsahuje zakázané výrazy, které mohou být urážlivé. Pokud si myslíš, že jde o omyl, kontaktuj podporu.");
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
      requestAuth();
      setLoading(false);
      return;
    }

    const mediaUrls = mediaFiles.length > 0 ? await uploadMedia(mediaFiles, user.id) : null;
    if (mediaFiles.length > 0 && !mediaUrls) {
      setLoading(false);
      return;
    }
    const mediaUrl = mediaUrls ? serializeMediaUrls(mediaUrls) : null;
    if (mediaFiles.length > 0 && !mediaUrl) {
        setLoading(false);
        return;
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
              multiple
              onChange={(e) => handleFileChange(e.target.files)}
            />
            {mediaPreviews.length > 0 ? "Přidat další" : "Nahrát fotku/video"}
          </label>
          {mediaPreviews.length > 0 && (
            <button
              type="button"
              onClick={resetMedia}
              className="rounded-lg border border-neutral-200 px-3 py-1 text-sm font-medium text-neutral-600 transition hover:border-neutral-400"
            >
              Odebrat
            </button>
          )}
        </div>

        {mediaPreviews.length > 0 && (
          <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-700">
            <div className="mb-2 font-semibold">Náhled</div>
            {mediaType === "video" ? (
              <video src={mediaPreviews[0]} controls className="w-full max-h-[320px] rounded-lg" />
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {mediaPreviews.map((preview, index) => (
                  <div key={preview} className="relative overflow-hidden rounded-lg border border-neutral-200 bg-white">
                    <img src={preview} alt={`Náhled ${index + 1}`} className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => {
                        const nextFiles = mediaFiles.filter((_, i) => i !== index);
                        const nextPreviews = mediaPreviews.filter((_, i) => i !== index);
                        mediaPreviews.forEach((url, i) => {
                          if (i === index) URL.revokeObjectURL(url);
                        });
                        setMediaFiles(nextFiles);
                        setMediaPreviews(nextPreviews);
                        if (nextFiles.length === 0) setMediaType(null);
                      }}
                      className="absolute right-2 top-2 rounded-full bg-white/90 px-2 py-1 text-[11px] font-semibold text-neutral-700 shadow-sm"
                    >
                      Odebrat
                    </button>
                  </div>
                ))}
              </div>
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
