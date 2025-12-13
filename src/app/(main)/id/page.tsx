/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck, Bookmark, Camera, Heart, MessageCircle, MoreHorizontal, Share2, X } from "lucide-react";
import {
  fetchCurrentProfile,
  type Profile,
  updateCurrentProfile,
  uploadAvatar,
  deleteAvatarByUrl,
} from "@/lib/profiles";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import type { NrealPost } from "@/types/nreal";

const media = [
  { id: "m1", label: "Golden hour crew", gradient: "from-amber-300 via-orange-200 to-rose-200" },
  { id: "m2", label: "NRW meetup", gradient: "from-indigo-300 via-blue-200 to-cyan-200" },
  { id: "m3", label: "Studio moment", gradient: "from-slate-800 via-slate-700 to-slate-900" },
  { id: "m4", label: "City run", gradient: "from-emerald-200 via-teal-200 to-cyan-200" },
  { id: "m5", label: "Afterparty", gradient: "from-rose-200 via-fuchsia-200 to-purple-200" },
  { id: "m6", label: "nReal live", gradient: "from-amber-200 via-yellow-200 to-lime-200" },
];

const tweets = [
  {
    id: "t1",
    text: "NRW 0.3.0 drop: nové nLove swipy, rooms a cross-post na profil. Let’s go.",
    meta: "2 h",
    stats: { replies: 24, likes: 210, reposts: 32 },
  },
  {
    id: "t2",
    text: "Dnes na Letný s crew. Přinesu filmovej foťák, kdo chce portrait?",
    meta: "včera",
    stats: { replies: 8, likes: 112, reposts: 9 },
  },
  {
    id: "t3",
    text: "RT @nrw: nReal Talks #12 je venku. Přineste si názory, chceme je slyšet.",
    meta: "2 dny",
    stats: { replies: 5, likes: 76, reposts: 18 },
  },
];

export default function IdPage() {
  const router = useRouter();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [bioInput, setBioInput] = useState("");
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarCroppedFile, setAvatarCroppedFile] = useState<File | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [showCropper, setShowCropper] = useState(false);
  const [cropImageUrl, setCropImageUrl] = useState<string | null>(null);
  const [cropZoom, setCropZoom] = useState(1);
  const [cropOffsetX, setCropOffsetX] = useState(0);
  const [cropOffsetY, setCropOffsetY] = useState(0);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const [imageSize, setImageSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const offsetStart = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const [cropSize, setCropSize] = useState(600);
  const previewRef = useRef<HTMLDivElement | null>(null);
  const [posts, setPosts] = useState<NrealPost[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [showVerificationInfo, setShowVerificationInfo] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadProfile() {
      setLoading(true);
      const p = await fetchCurrentProfile();
      if (isMounted) {
        setProfile(p);
        setLoading(false);
      }
    }

    loadProfile();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!profile) return;
    setBioInput(profile.bio ?? "");
    setAvatarPreview(profile.avatar_url ?? null);
  }, [profile]);

  const displayName = profile?.display_name ?? "Ty";
  const username = profile?.username ? `@${profile.username}` : "@ty";
  const bio = profile?.bio ?? "Ještě sis nenastavil bio.";
  const bioText = loading ? "Načítám profil…" : bio;
  const canEdit = Boolean(profile);
  const isVerified = profile?.verified ?? false;
  const sanitizeVerificationLabel = (value: string | null | undefined) => {
    const trimmed = (value ?? "").trim();
    if (!trimmed) return null;
    const lower = trimmed.toLowerCase();
    if (lower === "null" || lower === "undefined") return null;
    return trimmed;
  };
  const verificationLabel = sanitizeVerificationLabel(profile?.verification_label) ?? "Ověřený profil";

  useEffect(() => {
    if (!supabase || !profile?.id) return;

    setPostsLoading(true);

    (async () => {
      const { data, error } = await supabase
        .from("nreal_posts")
        .select(
          "id, user_id, content, created_at, profiles(username, display_name, avatar_url, verified, verification_label)",
        )
        .order("created_at", { ascending: false });

      if (!error && data) {
        setPosts(data as unknown as NrealPost[]);
      }

      setPostsLoading(false);
    })();
  }, [profile?.id, supabase]);

  const offsetBounds = useMemo(() => {
    const size = cropSize;
    const { w, h } = imageSize;
    if (!w || !h) return { maxX: 200, maxY: 200 };
    const baseScale = size / Math.max(w, h);
    const drawW = w * baseScale * cropZoom;
    const drawH = h * baseScale * cropZoom;
    const maxX = Math.max(0, (drawW - size) / 2);
    const maxY = Math.max(0, (drawH - size) / 2);
    return { maxX, maxY };
  }, [cropSize, imageSize, cropZoom]);

  const clampOffset = (value: number, axis: "x" | "y") => {
    const bounds = axis === "x" ? offsetBounds.maxX : offsetBounds.maxY;
    return Math.min(Math.max(value, -bounds), bounds);
  };

  const handleAvatarChange = (file?: File | null) => {
    setProfileMessage(null);
    setProfileError(null);
    if (!file) {
      setAvatarFile(null);
      setAvatarCroppedFile(null);
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    setAvatarFile(file);
    setAvatarCroppedFile(null);
    setAvatarPreview(objectUrl);
    setCropImageUrl(objectUrl);
    setCropZoom(1);
    setCropOffsetX(0);
    setCropOffsetY(0);
    setImageSize({ w: 0, h: 0 });
    setShowCropper(true);
  };

  const handleSaveProfile = async () => {
    if (!canEdit || savingProfile) return;
    setProfileError(null);
    setProfileMessage(null);
    setSavingProfile(true);

    const previousAvatar = profile?.avatar_url ?? null;
    let avatarUrl = profile?.avatar_url ?? null;

    if (avatarCroppedFile || avatarFile) {
      const fileToUpload = avatarCroppedFile ?? avatarFile;
      const uploaded = fileToUpload ? await uploadAvatar(fileToUpload) : null;
      if (uploaded) {
        avatarUrl = uploaded;
      } else {
        setProfileError("Nepodařilo se nahrát fotku.");
        setSavingProfile(false);
        return;
      }
    }

    const nextBio = bioInput.trim();

    const updated = await updateCurrentProfile({
      bio: nextBio || null,
      avatarUrl,
      displayName: profile?.display_name ?? null,
      username: profile?.username ?? null,
    });

    if (!updated) {
      setProfileError("Profil se nepodařilo uložit.");
      setSavingProfile(false);
      return;
    }

    if (previousAvatar && avatarUrl && previousAvatar !== avatarUrl) {
      await deleteAvatarByUrl(previousAvatar);
    }

    setProfile({
      ...updated,
      bio: nextBio || null,
      avatar_url: avatarUrl,
    });

    setProfileMessage("Profil uložen.");
    setSavingProfile(false);
    setIsEditingProfile(false);
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-neutral-50 to-white pb-24">
      <section className="mx-auto w-full max-w-4xl px-4 py-8 space-y-6 sm:space-y-8 lg:max-w-6xl lg:py-12">
        <header className="flex flex-col gap-4 rounded-3xl border border-neutral-200 bg-white/90 p-4 shadow-sm backdrop-blur sm:flex-row sm:flex-wrap sm:items-start sm:justify-between sm:p-6">
          <div className="flex flex-wrap items-center gap-4 sm:gap-6">
            <label className="group relative h-16 w-16 cursor-pointer rounded-full bg-gradient-to-br from-rose-400 via-amber-300 to-orange-300 ring-4 ring-white transition hover:scale-[1.02] sm:h-20 sm:w-20">
              {avatarPreview ? (
                <img
                  src={avatarPreview}
                  alt="Avatar"
                  className="absolute inset-0 h-full w-full rounded-full object-cover"
                  onError={() => setAvatarPreview(null)}
                />
              ) : (
                <>
                  <span className="absolute inset-1 rounded-full bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.45),transparent_45%),radial-gradient(circle_at_70%_70%,rgba(255,255,255,0.3),transparent_45%)]" />
                  <span className="absolute inset-0 flex items-center justify-center text-xl font-semibold text-white">
                    NRW
                  </span>
                </>
              )}
              {isEditingProfile && (
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                  onChange={(e) => handleAvatarChange(e.target.files?.[0] ?? null)}
                />
              )}
              {isEditingProfile && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 rounded-full bg-black/55 text-white opacity-0 transition group-hover:opacity-100">
                  <Camera className="h-5 w-5" />
                  <span className="text-[11px] font-semibold tracking-[0.14em] uppercase">Změnit</span>
                </div>
              )}
            </label>
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2 text-xl font-semibold text-neutral-900">
                <span>{displayName}</span>
                <div
                  className="relative inline-flex"
                  onMouseEnter={() => setShowVerificationInfo(true)}
                  onMouseLeave={() => setShowVerificationInfo(false)}
                  onFocus={() => setShowVerificationInfo(true)}
                  onBlur={() => setShowVerificationInfo(false)}
                >
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold ${
                      isVerified
                        ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                        : "bg-neutral-100 text-neutral-700 ring-1 ring-neutral-200"
                    }`}
                    tabIndex={0}
                    aria-label={isVerified ? "Ověřený profil" : "Neověřený profil"}
                  >
                    <BadgeCheck className="h-4 w-4" />
                    {isVerified ? verificationLabel : "Neověřeno"}
                  </span>
                  {isVerified && showVerificationInfo && (
                    <div className="absolute left-0 top-full z-20 mt-2 w-64 rounded-xl border border-neutral-200 bg-white p-3 text-[13px] text-neutral-700 shadow-lg">
                      <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-neutral-900">
                        <BadgeCheck className="h-4 w-4 text-emerald-600" />
                        Ověřený profil
                      </div>
                      <p>
                        Identita potvrzená v nID. Dostáváš prioritní ochranu a důvěryhodný štítek u obsahu.
                      </p>
                    </div>
                  )}
                </div>
              </div>
              <p className="text-sm text-neutral-600">{username}</p>
              <div className="flex flex-wrap items-center gap-3 text-xs font-semibold text-neutral-700">
                <span>1 024 sledujících</span>
                <span>·</span>
                <span>689 sleduje</span>
                <span>·</span>
                <span>42 momentů</span>
              </div>
              <p className="text-sm text-neutral-700">{bioText}</p>
            </div>
          </div>
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            <button
              onClick={() => router.push("/settings")}
              className="flex-1 rounded-full border border-neutral-200 px-4 py-2 text-sm font-semibold text-neutral-900 transition hover:bg-neutral-100 sm:flex-none"
            >
              Upravit profil
            </button>
            <button className="rounded-full bg-neutral-900 px-4 py-2 text-sm font-semibold text-white transition hover:-translate-y-[1px]">
              Sdílet profil
            </button>
          </div>
        </header>

        {isEditingProfile && (
          <section className="rounded-2xl border border-neutral-200 bg-white/90 p-5 shadow-sm backdrop-blur">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-neutral-900">Upravit profil</h2>
                <p className="text-sm text-neutral-600">Bio a fotka profilu</p>
              </div>
              <div className="text-xs text-neutral-500">{profile?.username ? `@${profile.username}` : ""}</div>
            </div>

            <div className="space-y-3">
              <label className="block space-y-2 text-sm text-neutral-700">
                <span className="font-semibold text-neutral-900">Bio</span>
                <textarea
                  rows={3}
                  value={bioInput}
                  onChange={(e) => setBioInput(e.target.value)}
                  className="w-full resize-none rounded-lg border border-neutral-200 px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-500 outline-none focus:border-neutral-400"
                  placeholder="Napiš něco o sobě..."
                />
              </label>

              <div className="flex items-center gap-3 text-sm text-neutral-700">
                <div className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold text-neutral-700">
                  Fotka profilu
                </div>
                <span className="text-xs text-neutral-500">Klikni na avatar nahoře pro změnu</span>
              </div>

              {profileError && (
                <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{profileError}</div>
              )}
              {profileMessage && (
                <div className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{profileMessage}</div>
              )}

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsEditingProfile(false)}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-neutral-700 transition hover:text-neutral-900"
                >
                  Zavřít
                </button>
                <button
                  type="button"
                  disabled={savingProfile}
                  onClick={handleSaveProfile}
                  className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-80"
                >
                  {savingProfile ? "Ukládám…" : "Uložit profil"}
                </button>
              </div>
            </div>
          </section>
        )}

        {showCropper && cropImageUrl && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
            <div className="w-full max-w-3xl rounded-2xl border border-neutral-200 bg-white p-4 shadow-xl">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-semibold text-neutral-900">Upravit fotku</h3>
                  <p className="text-sm text-neutral-600">Přibliž, posuň, ulož ořez.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCropper(false)}
                  className="rounded-full p-2 text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-900"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="grid gap-4 lg:grid-cols-[1fr_260px]">
                <div
                  ref={previewRef}
                  className="relative mx-auto aspect-square w-full max-w-2xl overflow-hidden rounded-full border border-neutral-200 bg-neutral-950 touch-none"
                  onPointerDown={(e) => {
                    e.preventDefault();
                    panStart.current = { x: e.clientX, y: e.clientY };
                    offsetStart.current = { x: cropOffsetX, y: cropOffsetY };
                    setIsPanning(true);
                  }}
                  onPointerMove={(e) => {
                    if (!isPanning) return;
                    e.preventDefault();
                    const dx = e.clientX - panStart.current.x;
                    const dy = e.clientY - panStart.current.y;
                    setCropOffsetX(clampOffset(offsetStart.current.x + dx, "x"));
                    setCropOffsetY(clampOffset(offsetStart.current.y + dy, "y"));
                  }}
                  onPointerUp={() => setIsPanning(false)}
                  onPointerLeave={() => setIsPanning(false)}
                >
                  <img
                    ref={imageRef}
                    src={cropImageUrl}
                    alt="Crop preview"
                    className="absolute inset-0 h-full w-full object-contain"
                    style={{
                      transform: `translate(${cropOffsetX}px, ${cropOffsetY}px) scale(${cropZoom})`,
                      transformOrigin: "center",
                    }}
                    onLoad={(e) => {
                    const img = e.currentTarget;
                    const naturalW = img.naturalWidth || img.width;
                    const naturalH = img.naturalHeight || img.height;
                    setImageSize({ w: naturalW, h: naturalH });
                    const containerSize = previewRef.current?.clientWidth ?? 600;
                    setCropSize(containerSize);
                    setCropOffsetX((prev) => clampOffset(prev, "x"));
                    setCropOffsetY((prev) => clampOffset(prev, "y"));
                    }}
                  />
                  <div className="pointer-events-none absolute inset-0 rounded-full border border-white/40">
                    <div className="absolute inset-0 grid grid-cols-3 grid-rows-3">
                      {Array.from({ length: 9 }).map((_, idx) => (
                        <span key={idx} className="border border-white/15" />
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="block space-y-1 text-sm">
                    <span className="font-semibold text-neutral-900">Zoom</span>
                    <input
                      type="range"
                      min={1}
                      max={3}
                      step={0.01}
                      value={cropZoom}
                      onChange={(e) => {
                        const next = Number(e.target.value);
                        setCropZoom(next);
                        setCropOffsetX((prev) => clampOffset(prev, "x"));
                        setCropOffsetY((prev) => clampOffset(prev, "y"));
                      }}
                      className="w-full"
                    />
                  </label>

                  <p className="text-xs text-neutral-500">Fotku můžeš chytit a posunout myší/prstem.</p>

                  <div className="flex items-center gap-3 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setCropZoom(1);
                        setCropOffsetX(0);
                        setCropOffsetY(0);
                      }}
                      className="rounded-lg border border-neutral-200 px-3 py-2 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-100"
                    >
                      Reset
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        if (!imageRef.current) return;
                        const img = imageRef.current;
                        const canvas = document.createElement("canvas");
                        const size = cropSize || 600;
                        canvas.width = size;
                        canvas.height = size;
                        const ctx = canvas.getContext("2d");
                        if (!ctx) return;

                        const naturalW = img.naturalWidth || img.width;
                        const naturalH = img.naturalHeight || img.height;
                        const baseScale = size / Math.max(naturalW, naturalH);
                        const scale = baseScale * cropZoom;
                        const drawW = naturalW * scale;
                        const drawH = naturalH * scale;
                        const drawX = (size - drawW) / 2 + cropOffsetX;
                        const drawY = (size - drawH) / 2 + cropOffsetY;

                        ctx.clearRect(0, 0, size, size);
                        ctx.save();
                        ctx.beginPath();
                        ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
                        ctx.closePath();
                        ctx.clip();
                        ctx.drawImage(img, drawX, drawY, drawW, drawH);
                        ctx.restore();

                        canvas.toBlob((blob) => {
                          if (!blob) return;
                          const file = new File([blob], "avatar-crop.png", { type: "image/png" });
                          setAvatarCroppedFile(file);
                          const objectUrl = URL.createObjectURL(file);
                          setAvatarPreview(objectUrl);
                          setShowCropper(false);
                        }, "image/png");
                      }}
                      className="rounded-lg bg-neutral-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800"
                    >
                      Uložit ořez
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-6">
            <ProfileStories />
            <ProfileTabs />
            <InstagramGrid />
            <TwitterFeed
              displayName={displayName}
              posts={posts}
              loading={postsLoading}
              sanitizeVerificationLabel={sanitizeVerificationLabel}
            />
          </div>

          <aside className="space-y-3 lg:sticky lg:top-10 lg:max-h-[calc(100vh-120px)] lg:overflow-y-auto lg:pr-1">
            <Widget title="Highlighy">
              <Highlights />
            </Widget>
            <Widget title="Trending témata">
              <TwitterHighlights />
            </Widget>
            <Widget title="Společné zájmy">
              <Interests />
            </Widget>
            <Widget title="Linky">
              <Links />
            </Widget>
          </aside>
        </div>
      </section>
    </main>
  );
}

function ProfileStories() {
  const stories = [
    { id: "s1", label: "Crew", color: "from-rose-400 via-orange-300 to-amber-200" },
    { id: "s2", label: "Events", color: "from-indigo-400 via-blue-300 to-cyan-200" },
    { id: "s3", label: "nLove", color: "from-fuchsia-400 via-pink-300 to-rose-200" },
    { id: "s4", label: "Rooms", color: "from-emerald-400 via-teal-300 to-cyan-200" },
  ];
  return (
    <div className="flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
      {stories.map((story) => (
        <div
          key={story.id}
          className="flex w-28 shrink-0 flex-col items-center gap-2 rounded-xl border border-neutral-200 bg-white p-3 shadow-sm"
        >
          <div className={`h-16 w-16 rounded-full bg-gradient-to-br ${story.color} ring-2 ring-white shadow`} />
          <span className="text-xs font-semibold text-neutral-800">{story.label}</span>
        </div>
      ))}
      <button className="flex w-28 shrink-0 flex-col items-center gap-2 rounded-xl border border-dashed border-neutral-300 bg-neutral-50 p-3 text-xs font-semibold text-neutral-600 transition hover:border-neutral-400 hover:text-neutral-900">
        + Highlight
      </button>
    </div>
  );
}

function ProfileTabs() {
  const tabs = [
    { id: "posts", label: "Příspěvky" },
    { id: "reels", label: "Klipy" },
    { id: "tags", label: "Označení" },
    { id: "threads", label: "Vlákna" },
  ];
  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1 text-sm font-semibold text-neutral-700 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
      {tabs.map((tab, idx) => {
        const isActive = idx === 0;
        return (
          <button
            key={tab.id}
            className={`rounded-full border px-4 py-2 transition ${
              isActive
                ? "border-neutral-900 bg-neutral-900 text-white"
                : "border-neutral-200 bg-white hover:border-neutral-300"
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

function InstagramGrid() {
  return (
    <div className="rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold text-neutral-900">Foto grid</h2>
        <button className="rounded-full px-3 py-1 text-xs font-semibold text-neutral-600 transition hover:bg-neutral-100">
          Archiv
        </button>
      </div>

      <div className="grid grid-cols-3 gap-1 overflow-hidden rounded-2xl border border-neutral-100 sm:gap-2">
        {media.map((item) => (
          <div
            key={item.id}
            className="group relative aspect-square overflow-hidden bg-neutral-100"
          >
            <div className={`absolute inset-0 bg-gradient-to-br ${item.gradient}`} />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.28),transparent_42%),radial-gradient(circle_at_80%_70%,rgba(255,255,255,0.22),transparent_38%)] mix-blend-screen" />
            <div className="absolute inset-0 bg-black/0 transition group-hover:bg-black/10" />
          </div>
        ))}
      </div>
    </div>
  );
}

function TwitterFeed({
  displayName,
  posts,
  loading,
  sanitizeVerificationLabel,
}: {
  displayName: string;
  posts: NrealPost[];
  loading: boolean;
  sanitizeVerificationLabel: (value: string | null | undefined) => string | null;
}) {
  const [showAll, setShowAll] = useState(false);

  const formatTimeLabel = (createdAt?: string | null) => {
    if (!createdAt) return "neznámý čas";
    const date = new Date(createdAt);
    if (Number.isNaN(date.getTime())) return "neznámý čas";
    const diffMs = Date.now() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffH = Math.floor(diffMin / 60);
    if (diffMin < 1) return "před chvílí";
    if (diffMin < 60) return `před ${diffMin} min`;
    if (diffH < 24) return `před ${diffH} h`;
    return date.toLocaleDateString("cs-CZ", { day: "numeric", month: "short" });
  };

  const hasPosts = posts.length > 0;
  const visiblePosts = showAll ? posts : posts.slice(0, 3);

  return (
    <div className="rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-neutral-900">Krátké posty</h2>
        {hasPosts ? (
          <button
            className="rounded-full px-3 py-1 text-xs font-semibold text-neutral-600 transition hover:bg-neutral-100"
            onClick={() => setShowAll((prev) => !prev)}
          >
            {showAll ? "Skrýt" : "Zobrazit všechno"}
          </button>
        ) : null}
      </div>
      <div className="divide-y divide-neutral-100">
        {loading ? (
          <div className="py-3 text-sm text-neutral-600">Načítám příspěvky…</div>
        ) : hasPosts ? (
          visiblePosts.map((post) => {
            const profile = post.profiles[0];
            const name = profile?.display_name || profile?.username || displayName;
            const username = profile?.username ? `@${profile.username}` : null;
            const badge = profile?.verified
              ? sanitizeVerificationLabel(profile.verification_label) || "Ověřený profil"
              : null;
            return (
              <article key={post.id} className="space-y-2 py-3">
                <div className="flex items-center justify-between text-xs text-neutral-500">
                  <div className="flex items-center gap-2">
                    {profile?.avatar_url ? (
                      <img
                        src={profile.avatar_url}
                        alt={name}
                        className="h-8 w-8 rounded-full object-cover ring-1 ring-neutral-200"
                        onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")}
                      />
                    ) : (
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-900 text-white text-xs font-semibold">
                        NRW
                      </span>
                    )}
                    <div className="flex items-center gap-2 text-neutral-800 font-semibold">
                      <span>{name}</span>
                      {badge ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-200">
                          <BadgeCheck className="h-3.5 w-3.5" />
                          {badge}
                        </span>
                      ) : null}
                    </div>
                    <span>·</span>
                    <span>{formatTimeLabel(post.created_at)}</span>
                  </div>
                  <MoreHorizontal className="h-4 w-4 text-neutral-400" />
                </div>
                <p className="text-sm leading-relaxed text-neutral-900">{post.content}</p>
                <div className="flex items-center gap-4 text-xs font-semibold text-neutral-600">
                  <button className="flex items-center gap-1 transition hover:text-neutral-900">
                    <MessageCircle className="h-4 w-4" />
                    0
                  </button>
                  <button className="flex items-center gap-1 transition hover:text-neutral-900">
                    <Share2 className="h-4 w-4" />
                    0
                  </button>
                  <button className="flex items-center gap-1 transition hover:text-rose-500">
                    <Heart className="h-4 w-4" />
                    0
                  </button>
                  <button className="ml-auto flex items-center gap-1 rounded-full border border-neutral-200 px-3 py-1 text-[11px] font-semibold transition hover:border-neutral-300">
                    <Bookmark className="h-4 w-4" />
                    Uložit
                  </button>
                </div>
                {username ? <div className="text-[11px] text-neutral-500">{username}</div> : null}
              </article>
            );
          })
        ) : (
          tweets.map((tweet) => (
            <article key={tweet.id} className="space-y-2 py-3">
              <div className="flex items-center justify-between text-xs text-neutral-500">
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-900 text-white text-xs font-semibold">
                    NRW
                  </span>
                  <div className="text-neutral-800 font-semibold">{displayName}</div>
                  <span>·</span>
                  <span>{tweet.meta}</span>
                </div>
                <MoreHorizontal className="h-4 w-4 text-neutral-400" />
              </div>
              <p className="text-sm leading-relaxed text-neutral-900">{tweet.text}</p>
              <div className="flex items-center gap-4 text-xs font-semibold text-neutral-600">
                <button className="flex items-center gap-1 transition hover:text-neutral-900">
                  <MessageCircle className="h-4 w-4" />
                  {tweet.stats.replies}
                </button>
                <button className="flex items-center gap-1 transition hover:text-neutral-900">
                  <Share2 className="h-4 w-4" />
                  {tweet.stats.reposts}
                </button>
                <button className="flex items-center gap-1 transition hover:text-rose-500">
                  <Heart className="h-4 w-4" />
                  {tweet.stats.likes}
                </button>
                <button className="ml-auto flex items-center gap-1 rounded-full border border-neutral-200 px-3 py-1 text-[11px] font-semibold transition hover:border-neutral-300">
                  <Bookmark className="h-4 w-4" />
                  Uložit
                </button>
              </div>
            </article>
          ))
        )}
      </div>
    </div>
  );
}

function Widget({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white/90 p-4 shadow-sm backdrop-blur">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-neutral-900">{title}</h3>
        <span className="text-[11px] uppercase tracking-[0.14em] text-neutral-400">ID</span>
      </div>
      {children}
    </div>
  );
}

function Highlights() {
  const list = [
    { id: "h1", title: "Letná run", meta: "12k zhlédnutí" },
    { id: "h2", title: "NRW meetup #4", meta: "9.2k zhlédnutí" },
    { id: "h3", title: "Studio live", meta: "7.4k zhlédnutí" },
  ];
  return (
    <div className="space-y-2 text-sm text-neutral-700">
      {list.map((item) => (
        <div
          key={item.id}
          className="flex items-center justify-between rounded-lg border border-neutral-100 bg-neutral-50 px-3 py-2"
        >
          <div>
            <div className="font-semibold text-neutral-900">{item.title}</div>
            <div className="text-[11px] text-neutral-500">{item.meta}</div>
          </div>
          <button className="rounded-full px-3 py-1 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-900 hover:text-white">
            Přehrát
          </button>
        </div>
      ))}
    </div>
  );
}

function TwitterHighlights() {
  const topics = [
    { id: "th1", tag: "#nrw", stat: "trending" },
    { id: "th2", tag: "#nReal", stat: "1.2k tweetů" },
    { id: "th3", tag: "#rooms", stat: "620 tweetů" },
  ];
  return (
    <div className="space-y-2 text-sm text-neutral-700">
      {topics.map((topic) => (
        <div
          key={topic.id}
          className="flex items-center justify-between rounded-lg border border-neutral-100 bg-gradient-to-r from-slate-50 to-white px-3 py-2"
        >
          <div>
            <div className="font-semibold text-neutral-900">{topic.tag}</div>
            <div className="text-[11px] text-neutral-500">{topic.stat}</div>
          </div>
          <button className="rounded-full border border-neutral-200 px-3 py-1 text-xs font-semibold text-neutral-900 transition hover:bg-neutral-900 hover:text-white">
            Sledovat
          </button>
        </div>
      ))}
    </div>
  );
}

function Interests() {
  const interests = ["Foto", "Koncerty", "Produkce", "AI", "nLove", "Meetups"];
  return (
    <div className="flex flex-wrap gap-2 text-xs font-semibold text-neutral-700">
      {interests.map((interest) => (
        <span key={interest} className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1">
          {interest}
        </span>
      ))}
    </div>
  );
}

function Links() {
  const links = [
    { id: "ln1", label: "nReal Talks #12", url: "nrw.link/talks12" },
    { id: "ln2", label: "nLove beta room", url: "nrw.link/love" },
    { id: "ln3", label: "NRW Discord", url: "nrw.link/discord" },
  ];
  return (
    <div className="space-y-2 text-sm text-neutral-700">
      {links.map((link) => (
        <div
          key={link.id}
          className="flex items-center justify-between rounded-lg border border-neutral-100 bg-neutral-50 px-3 py-2"
        >
          <div>
            <div className="font-semibold text-neutral-900">{link.label}</div>
            <div className="text-[11px] text-neutral-500">{link.url}</div>
          </div>
          <button className="rounded-full px-3 py-1 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-900 hover:text-white">
            Otevřít
          </button>
        </div>
      ))}
    </div>
  );
}
