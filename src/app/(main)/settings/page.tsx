/* eslint-disable @next/next/no-img-element */
"use client";

import {
  Bell,
  BriefcaseBusiness,
  EyeOff,
  Globe2,
  ChevronLeft,
  LifeBuoy,
  Lock,
  Map,
  MessageCircle,
  MessageSquare,
  Shield,
  Tag,
  User,
  Users,
  ShieldCheck,
  BadgeCheck,
  Crown,
  CreditCard,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ComponentType, type ReactNode } from "react";
import Link from "next/link";
import {
  fetchCurrentProfile,
  updateCurrentProfile,
  uploadAvatar,
  deleteAvatarByUrl,
  type Profile,
} from "@/lib/profiles";
import { containsBlockedContent, containsBlockedIdentityContent } from "@/lib/content-filter";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

type SectionKey =
  | "profile"
  | "notifications"
  | "pro"
  | "creator"
  | "privacy"
  | "closeFriends"
  | "blocked"
  | "story"
  | "messages"
  | "tags"
  | "comments"
  | "security"
  | "verification"
  | "subscription";

type NavSection = {
  title: string;
  items: { key: SectionKey; label: string; icon: ComponentType<{ className?: string }> }[];
};

const navSections: NavSection[] = [
  {
    title: "Jak používáš NRW",
    items: [
      { key: "profile", label: "Upravit profil", icon: User },
      { key: "notifications", label: "Upozornění", icon: Bell },
      { key: "pro", label: "Pro účet a značky", icon: BriefcaseBusiness },
      { key: "creator", label: "Nástroje tvůrců", icon: Shield },
    ],
  },
  {
    title: "Kdo vidí tvůj obsah",
    items: [
      { key: "privacy", label: "Soukromí účtu", icon: Lock },
      { key: "closeFriends", label: "Blízcí přátelé", icon: Users },
      { key: "blocked", label: "Blokovaní", icon: EyeOff },
      { key: "story", label: "Příběh a lokalita", icon: Map },
    ],
  },
  {
    title: "Jak s tebou mluví ostatní",
    items: [
      { key: "messages", label: "Zprávy a žádosti", icon: MessageSquare },
      { key: "tags", label: "Označení a zmínky", icon: Tag },
      { key: "comments", label: "Komentáře", icon: MessageCircle },
    ],
  },
  {
    title: "Zabezpečení a účet",
    items: [
      { key: "security", label: "Bezpečnost", icon: ShieldCheck },
      { key: "verification", label: "Ověření účtu", icon: BadgeCheck },
      { key: "subscription", label: "Předplatné NRW+", icon: Crown },
    ],
  },
];

const BIO_LIMIT = 150;

export default function SettingsPage() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarCroppedFile, setAvatarCroppedFile] = useState<File | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [web, setWeb] = useState("");
  const [bio, setBio] = useState("🖥️ ajťák & herec 🤘\nPoslouchej: @arvickopodcast");
  const [activeSection, setActiveSection] = useState<SectionKey>("profile");
  const [showMobileSection, setShowMobileSection] = useState(false);
  const [showCropper, setShowCropper] = useState(false);
  const [cropImageUrl, setCropImageUrl] = useState<string | null>(null);
  const [cropZoom, setCropZoom] = useState(1);
  const [cropOffsetX, setCropOffsetX] = useState(0);
  const [cropOffsetY, setCropOffsetY] = useState(0);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const previewRef = useRef<HTMLDivElement | null>(null);
  const [cropSize, setCropSize] = useState(600);
  const [imageSize, setImageSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const offsetStart = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const sanitizeVerificationLabel = (value: string | null | undefined) => {
    const trimmed = (value ?? "").trim();
    if (!trimmed) return null;
    const lower = trimmed.toLowerCase();
    if (lower === "null" || lower === "undefined") return null;
    return trimmed;
  };

  const bioCount = useMemo(() => bio.length, [bio]);
  const initials = displayName?.[0]?.toUpperCase?.() || username?.[0]?.toUpperCase?.() || "N";
  const activeSectionLabel = useMemo(() => {
    for (const section of navSections) {
      const match = section.items.find((item) => item.key === activeSection);
      if (match) return match.label;
    }
    return "Nastavení";
  }, [activeSection]);
  const offsetBounds = useMemo(() => {
    const size = cropSize || 600;
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

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const [{ data: userData }, profileData] = await Promise.all([
        supabase.auth.getUser(),
        fetchCurrentProfile(),
      ]);
      if (!mounted) return;
      const user = userData?.user ?? null;
      const meta = (user?.user_metadata ?? {}) as Record<string, unknown>;
      const metaDisplayName = typeof meta.display_name === "string" ? meta.display_name : "";
      const metaUsername = typeof meta.username === "string" ? meta.username : "";
      setProfile(profileData);
      setDisplayName(profileData?.display_name ?? metaDisplayName ?? "");
      setUsername(profileData?.username ?? metaUsername ?? "");
      setBio(profileData?.bio ?? "");
      setAvatarPreview(profileData?.avatar_url ?? null);
    };
    load();
    return () => {
      mounted = false;
    };
  }, [supabase]);

  const handleAvatarChange = (file?: File | null) => {
    setProfileMessage(null);
    setProfileError(null);
    if (!file) {
      setAvatarFile(null);
      setAvatarCroppedFile(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setAvatarFile(file);
    setAvatarCroppedFile(null);
    setAvatarPreview(url);
    setCropImageUrl(url);
    setCropZoom(1);
    setCropOffsetX(0);
    setCropOffsetY(0);
    setImageSize({ w: 0, h: 0 });
    setShowCropper(true);
  };

  const handleSaveProfile = async () => {
    if (!profile || savingProfile) return;

    const normalizedUsername = username.trim().replace(/^@+/, "");
    const normalizedDisplayName = displayName.trim();
    const normalizedBio = bio.trim();

    if (normalizedUsername && containsBlockedIdentityContent(normalizedUsername).hit) {
      setProfileError("Uživatelské jméno obsahuje nevhodný text.");
      return;
    }
    if (normalizedDisplayName && containsBlockedIdentityContent(normalizedDisplayName).hit) {
      setProfileError("Jméno obsahuje nevhodný text.");
      return;
    }
    if (normalizedBio && containsBlockedContent(normalizedBio).hit) {
      setProfileError("Bio obsahuje nevhodný text.");
      return;
    }

    setProfileError(null);
    setProfileMessage(null);
    setSavingProfile(true);

    let avatarUrl = profile.avatar_url ?? null;
    const previousAvatar = profile.avatar_url ?? null;

    if (avatarCroppedFile || avatarFile) {
      const fileToUpload = avatarCroppedFile ?? avatarFile;
      const uploaded = fileToUpload ? await uploadAvatar(fileToUpload) : null;
      if (!uploaded) {
        setProfileError("Nepodařilo se nahrát fotku.");
        setSavingProfile(false);
        return;
      }
      avatarUrl = uploaded;
    }

    const updated = await updateCurrentProfile({
      bio: normalizedBio || null,
      displayName: normalizedDisplayName || null,
      username: normalizedUsername || null,
      avatarUrl,
    });

    if (!updated) {
      setProfileError("Uložení se nepovedlo.");
      setSavingProfile(false);
      return;
    }

    if (previousAvatar && avatarUrl && previousAvatar !== avatarUrl) {
      await deleteAvatarByUrl(previousAvatar);
    }

    setProfile(updated);
    setProfileMessage("Profil uložen.");
    setSavingProfile(false);
  };

  const isActive = (key: SectionKey) => activeSection === key;

  return (
    <main className="min-h-screen bg-neutral-50">
      <div className="mx-auto max-w-6xl px-4 py-6 md:py-10 lg:py-12">
        <div className="hidden items-start justify-between gap-4 md:flex">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-neutral-600">Nastavení</p>
            <h1 className="text-3xl font-semibold text-neutral-900">Upravit profil</h1>
            <p className="text-sm text-neutral-700">
              Přepínej sekce vlevo a uprav svůj NRW účet. Vše zatím staticky, ale navržené
              pro snadné napojení na backend.
            </p>
          </div>
        </div>
        <div className="md:hidden">
          {showMobileSection ? (
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => setShowMobileSection(false)}
                className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold text-neutral-700 shadow-sm"
              >
                <ChevronLeft className="h-4 w-4" />
                Zpět
              </button>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-neutral-600">Nastavení</p>
                <h1 className="text-2xl font-semibold text-neutral-900">
                  {activeSectionLabel}
                </h1>
              </div>
            </div>
          ) : (
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-neutral-600">Nastavení</p>
              <h1 className="text-2xl font-semibold text-neutral-900">Nastavení</h1>
              <p className="text-sm text-neutral-700">
                Přepínej sekce a uprav svůj NRW účet. Vše zatím staticky, ale navržené
                pro snadné napojení na backend.
              </p>
            </div>
          )}
        </div>

        <div className="mt-6 grid gap-8 md:mt-8 lg:grid-cols-[280px_1fr]">
          <aside className={`space-y-4 ${showMobileSection ? "hidden" : "block"} md:block`}>
            <div className="rounded-2xl border border-neutral-200/70 bg-white p-4 shadow-sm">
              {navSections.map((section) => (
                <div key={section.title} className="space-y-2">
                  <div className="px-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">
                    {section.title}
                  </div>
                  <div className="space-y-1">
                    {section.items.map((item) => {
                      const Icon = item.icon;
                      const active = isActive(item.key);
                      return (
                        <button
                          key={item.label}
                          onClick={() => {
                            setActiveSection(item.key);
                            setShowMobileSection(true);
                          }}
                          className={`flex w-full items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm transition ${
                            active
                              ? "bg-neutral-900 text-white shadow-sm"
                              : "text-neutral-700 hover:bg-neutral-100"
                          }`}
                        >
                          <Icon className="h-5 w-5" />
                          <span className="flex-1 text-left">{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
              <div className="mt-4 border-t border-neutral-200/70 pt-3 md:hidden">
                <Link
                  href="/support"
                  className="flex w-full items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm text-neutral-700 transition hover:bg-neutral-100"
                >
                  <LifeBuoy className="h-5 w-5" />
                  <span className="flex-1 text-left">Podpora</span>
                </Link>
              </div>
            </div>
          </aside>

          <section className={`space-y-6 ${showMobileSection ? "block" : "hidden"} md:block`}>
            {renderSection(activeSection, {
              bio,
              bioCount,
              setBio,
              web,
              setWeb,
              displayName,
              setDisplayName,
              username,
              setUsername,
              avatarPreview,
              setAvatarPreview,
              initials,
              profile,
              sanitizeVerificationLabel,
              onAvatarPick: () => fileInputRef.current?.click(),
              onSaveProfile: handleSaveProfile,
              savingProfile,
              profileMessage,
              profileError,
              setProfileError,
              setProfileMessage,
              cropImageUrl,
              showCropper,
              setShowCropper,
              imageRef,
              previewRef,
              cropZoom,
              setCropZoom,
              cropOffsetX,
              cropOffsetY,
              setCropOffsetX,
              setCropOffsetY,
              clampOffset,
              setImageSize,
              setCropSize,
              cropSize,
              setAvatarCroppedFile,
              isPanning,
              setIsPanning,
              panStart,
              offsetStart,
            })}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => handleAvatarChange(e.target.files?.[0] ?? null)}
            />
          </section>
        </div>
      </div>
    </main>
  );
}

function renderSection(
  key: SectionKey,
  {
    bio,
    bioCount,
    setBio,
    web,
    setWeb,
    displayName,
    setDisplayName,
    username,
    setUsername,
    avatarPreview,
    initials,
    onAvatarPick,
    onSaveProfile,
    savingProfile,
    profileMessage,
    profileError,
    setProfileError,
    setProfileMessage,
    setAvatarPreview,
    cropImageUrl,
    showCropper,
    setShowCropper,
    imageRef,
    previewRef,
    cropZoom,
    setCropZoom,
    cropOffsetX,
    cropOffsetY,
    setCropOffsetX,
    setCropOffsetY,
    clampOffset,
    setImageSize,
    setCropSize,
    cropSize,
    setAvatarCroppedFile,
    isPanning,
    setIsPanning,
    panStart,
    offsetStart,
    profile,
    sanitizeVerificationLabel,
  }: {
    bio: string;
    bioCount: number;
    setBio: (val: string) => void;
    web: string;
    setWeb: (val: string) => void;
    displayName: string;
    setDisplayName: (val: string) => void;
    username: string;
    setUsername: (val: string) => void;
    avatarPreview: string | null;
    initials: string;
    profile: Profile | null;
    sanitizeVerificationLabel: (value: string | null | undefined) => string | null;
    onAvatarPick: () => void;
    onSaveProfile: () => void;
    savingProfile: boolean;
    profileMessage: string | null;
    profileError: string | null;
    setProfileError: (val: string | null) => void;
    setProfileMessage: (val: string | null) => void;
    setAvatarPreview: (val: string | null) => void;
    cropImageUrl: string | null;
    showCropper: boolean;
    setShowCropper: (val: boolean) => void;
    imageRef: React.RefObject<HTMLImageElement | null>;
    previewRef: React.RefObject<HTMLDivElement | null>;
    cropZoom: number;
    setCropZoom: (val: number) => void;
    cropOffsetX: number;
    cropOffsetY: number;
    setCropOffsetX: React.Dispatch<React.SetStateAction<number>>;
    setCropOffsetY: React.Dispatch<React.SetStateAction<number>>;
    clampOffset: (val: number, axis: "x" | "y") => number;
    setImageSize: (val: { w: number; h: number }) => void;
    setCropSize: (val: number) => void;
    cropSize: number;
    setAvatarCroppedFile: (file: File | null) => void;
    isPanning: boolean;
    setIsPanning: (val: boolean) => void;
    panStart: React.MutableRefObject<{ x: number; y: number }>;
    offsetStart: React.MutableRefObject<{ x: number; y: number }>;
  }
) {
  switch (key) {
    case "profile":
      return (
        <>
          <div className="space-y-4 rounded-2xl border border-neutral-200/70 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="relative h-16 w-16 overflow-hidden rounded-full ring-2 ring-neutral-200">
                  {avatarPreview ? (
                    <img
                      src={avatarPreview}
                      alt="Avatar"
                      className="h-full w-full object-cover"
                      onError={() => setProfileError("Nepodařilo se načíst fotku")}
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-neutral-200 to-neutral-100 text-lg font-semibold text-neutral-700">
                      {initials}
                    </div>
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
                    <span>@{username || "tvoje_jmeno"}</span>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold ${
                        (profile?.verified ?? false)
                          ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                          : "bg-neutral-100 text-neutral-700 ring-1 ring-neutral-200"
                      }`}
                    >
                      <BadgeCheck className="h-3.5 w-3.5" />
                      {(profile?.verified ?? false)
                        ? sanitizeVerificationLabel(profile?.verification_label) || "Ověřený profil"
                        : "Neověřeno"}
                    </span>
                  </div>
                  <div className="text-xs text-neutral-600">
                    {displayName || "Jméno"}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={onAvatarPick}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-px hover:bg-neutral-800"
              >
                <span>Změnit fotku</span>
              </button>
            </div>

            <Field label="Uživatelské jméno">
              <div className="flex items-center gap-2 rounded-xl border border-neutral-200/70 bg-neutral-50 px-3 py-2">
                <span className="text-neutral-500">@</span>
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value.replace(/^@+/, ""))}
                  className="w-full bg-transparent text-sm text-neutral-900 placeholder:text-neutral-500 outline-none"
                  placeholder="tvoje_jmeno"
                />
              </div>
            </Field>

            <Field label="Jméno">
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full rounded-xl border border-neutral-200/70 bg-neutral-50 px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-500 outline-none focus:border-neutral-400"
                placeholder="Tvoje celé jméno"
              />
            </Field>

            <Field label="Web" description="Úprava odkazů je zatím mock, můžeš si uložit text.">
              <div className="flex items-center gap-2 rounded-xl border border-neutral-200/70 bg-neutral-50 px-3 py-2">
                <Globe2 className="h-4 w-4 text-neutral-500" />
                <input
                  value={web}
                  onChange={(e) => setWeb(e.target.value)}
                  className="w-full bg-transparent text-sm text-neutral-900 placeholder:text-neutral-500 outline-none"
                  placeholder="https://nrw.app/..."
                />
              </div>
            </Field>

            <Field
              label="Životopis"
              description="Krátký popis profilu. Náhled se propíše do NRW a nID."
              count={`${bioCount} / ${BIO_LIMIT}`}
            >
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value.slice(0, BIO_LIMIT))}
                rows={3}
                className="w-full resize-none rounded-xl border border-neutral-200/70 bg-neutral-50 px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-500 outline-none focus:border-neutral-400"
                placeholder="Řekni, kdo jsi…"
              />
            </Field>

            <ToggleRow
              label="Zobrazovat návrhy účtů na profilech"
              checked={true}
              onChange={() => {}}
            />

            {profileError && (
              <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{profileError}</div>
            )}
            {profileMessage && (
              <div className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                {profileMessage}
              </div>
            )}

            <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => {
                  setProfileError(null);
                  setProfileMessage(null);
                }}
                className="rounded-lg px-4 py-2 text-sm font-medium text-neutral-600 transition hover:text-neutral-900"
              >
                Zrušit
              </button>
              <button
                type="button"
                disabled={savingProfile}
                onClick={onSaveProfile}
                className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-px hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-80"
              >
                {savingProfile ? "Ukládám…" : "Uložit změny"}
              </button>
            </div>
          </div>

          {showCropper && cropImageUrl && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
              <div className="w-full max-w-3xl rounded-2xl border border-neutral-200 bg-white p-4 shadow-xl">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-semibold text-neutral-900">Upravit fotku</h3>
                    <p className="text-sm text-neutral-600">Přibliž, posuň a ulož ořez.</p>
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
                        onClick={() => {
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
        </>
      );
    case "security":
      return (
        <>
          <div className="rounded-2xl border border-neutral-200/70 bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-neutral-900">Rychlá ochrana</div>
                <p className="text-xs text-neutral-600">
                  Štíty jsou zatím mock, připravené k propojení s API.
                </p>
              </div>
              <span className="rounded-full bg-neutral-100 px-3 py-1 text-[11px] font-semibold text-neutral-700">
                NRW shield
              </span>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <ShieldCard
                icon={Lock}
                title="Dvoufázové ověření"
                note="Přihlášení ověříme kódem nebo push."
              />
              <ShieldCard
                icon={Globe2}
                title="Viditelnost profilu"
                note="Načteme z nID a synchronizujeme s feedem."
              />
              <ShieldCard
                icon={Bell}
                title="Upozornění"
                note="Nastavení notifikací na /notifications/preferences."
              />
              <ShieldCard
                icon={Tag}
                title="Označení a zmínky"
                note="Upravíme, kdo tě může tagovat."
              />
            </div>
          </div>

          <div className="rounded-2xl border border-neutral-200/70 bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-sm font-semibold text-neutral-900">Bezpečnost</div>
                <p className="text-xs text-neutral-600">
                  Přepni klíčové ochrany. Stavy jsou zatím mock.
                </p>
              </div>
              <span className="rounded-full bg-neutral-900 px-3 py-1 text-[11px] font-semibold text-white">
                Safe
              </span>
            </div>
            <div className="mt-4 space-y-3">
              <Toggle
                checked
                onChange={() => {}}
                label="Dvoufázové ověření (zapnuto)"
              />
              <Toggle
                checked
                onChange={() => {}}
                label="Výstrahy při novém zařízení"
              />
              <Toggle
                checked
                onChange={() => {}}
                label="Schvalování přihlášení"
              />
              <div className="rounded-lg border border-dashed border-neutral-200 px-3 py-2 text-xs text-neutral-600">
                Napojíme na `/auth/security` a zobrazíme poslední pokusy.
              </div>
            </div>
          </div>
        </>
      );
    case "verification":
      return (
        <div className="rounded-2xl border border-neutral-200/70 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-sm font-semibold text-neutral-900">Ověření účtu</div>
              <p className="text-xs text-neutral-600">
                Připravujeme propojení s nID pro ověřené profily.
              </p>
            </div>
            <BadgeCheck className="h-5 w-5 text-neutral-800" />
          </div>
          <div className="mt-4 space-y-3">
            <InfoRow icon={User} title="Identita" text="nID · základní" />
            <InfoRow icon={ShieldCheck} title="Stav" text="Čeká na upgrade" />
            <InfoRow icon={Tag} title="Veřejný štítek" text="NRW Verified (soon)" />
            <button className="w-full rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-px hover:bg-neutral-800">
              Požádat o ověření
            </button>
          </div>
        </div>
      );
    case "subscription":
      return (
        <div className="rounded-2xl border border-neutral-200/70 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-neutral-900">Předplatné NRW+</div>
              <p className="text-xs text-neutral-600">
                Více analytik, rychlejší podpora a brzký přístup k experimentům.
              </p>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full bg-neutral-900 px-3 py-1 text-[11px] font-semibold text-white">
              <Sparkles className="h-3.5 w-3.5" />
              Beta
            </span>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <PlanCard
              title="Starter"
              price="0 Kč"
              perks={["Základní ochrana", "Notifikace", "Komunita"]}
            />
            <PlanCard
              highlight
              title="NRW+"
              price="169 Kč/měs"
              perks={["Prioritní podpora", "Detailní analýzy", "Ověření profilu"]}
            />
            <PlanCard
              title="NRW Pro"
              price="389 Kč/měs"
              perks={["Týmové role", "API přístup", "Brand kit & štítky"]}
            />
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <button className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-px hover:bg-neutral-800">
              Aktivovat NRW+
            </button>
            <button className="flex items-center gap-2 rounded-lg border border-neutral-200/70 px-4 py-2 text-sm font-medium text-neutral-700 transition hover:border-neutral-300 hover:bg-neutral-50">
              <CreditCard className="h-4 w-4" />
              Spravovat platby
            </button>
          </div>
        </div>
      );
    default:
      return (
        <div className="rounded-2xl border border-neutral-200/70 bg-white p-6 text-sm text-neutral-700 shadow-sm">
          Tato sekce bude doplněna později. Vyber jinou položku vlevo.
        </div>
      );
  }
}

function Field({
  label,
  description,
  count,
  children,
}: {
  label: string;
  description?: string;
  count?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm font-semibold text-neutral-900">
        <div className="flex items-center gap-2">
          <span>{label}</span>
        </div>
        {count ? <span className="text-xs font-medium text-neutral-500">{count}</span> : null}
      </div>
      {children}
      {description ? <p className="text-xs text-neutral-600">{description}</p> : null}
    </div>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: () => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={onChange}
      className="flex w-full items-center justify-between gap-3 rounded-lg border border-neutral-200/70 px-4 py-2.5 transition hover:border-neutral-300 hover:bg-neutral-50"
      aria-pressed={checked}
    >
      <span className="text-sm font-medium text-neutral-900">{label}</span>
      <span
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
          checked ? "bg-neutral-900" : "bg-neutral-200"
        }`}
      >
        <span
          className={`absolute left-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </span>
    </button>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      className="flex w-full items-center justify-between rounded-xl border border-neutral-200/70 bg-neutral-50 px-4 py-3 text-sm font-semibold text-neutral-900 transition hover:border-neutral-300"
      aria-pressed={checked}
    >
      <span>{label}</span>
      {checked ? (
        <ToggleRight className="h-5 w-5 text-neutral-900" />
      ) : (
        <ToggleLeft className="h-5 w-5 text-neutral-400" />
      )}
    </button>
  );
}

function ShieldCard({
  icon: Icon,
  title,
  note,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  note: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-neutral-200/70 bg-neutral-50 px-4 py-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-neutral-800 shadow-sm ring-1 ring-neutral-200">
        <Icon className="h-5 w-5" />
      </div>
      <div className="space-y-1">
        <div className="text-sm font-semibold text-neutral-900">{title}</div>
        <div className="text-xs text-neutral-600">{note}</div>
      </div>
    </div>
  );
}

function InfoRow({
  icon: Icon,
  title,
  text,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  text: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-neutral-200/70 px-3 py-2">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-neutral-50 text-neutral-800 ring-1 ring-neutral-200">
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1">
        <div className="text-sm font-semibold text-neutral-900">{title}</div>
        <div className="text-[11px] text-neutral-600">{text}</div>
      </div>
    </div>
  );
}

function PlanCard({
  title,
  price,
  perks,
  highlight,
}: {
  title: string;
  price: string;
  perks: string[];
  highlight?: boolean;
}) {
  return (
    <div
      className={`flex h-full flex-col gap-3 rounded-xl border border-neutral-200/70 p-4 shadow-sm transition ${
        highlight ? "border-neutral-900 bg-neutral-900 text-white" : "bg-white"
      }`}
    >
      <div className="flex items-start justify-between">
        <div>
          <div className={`text-sm font-semibold ${highlight ? "text-white" : "text-neutral-900"}`}>
            {title}
          </div>
          <div className={`text-xs ${highlight ? "text-white/70" : "text-neutral-600"}`}>{price}</div>
        </div>
        {highlight && (
          <span className="rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold text-white">
            Doporučeno
          </span>
        )}
      </div>
      <ul className={`space-y-2 text-xs ${highlight ? "text-white/80" : "text-neutral-700"}`}>
        {perks.map((perk) => (
          <li key={perk} className="flex items-center gap-2">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-current" />
            {perk}
          </li>
        ))}
      </ul>
      <button
        className={`mt-auto rounded-lg px-3 py-2 text-sm font-semibold transition ${
          highlight
            ? "bg-white text-neutral-900 hover:-translate-y-px"
            : "border border-neutral-200 bg-white text-neutral-900 hover:border-neutral-300 hover:-translate-y-px"
        }`}
      >
        Vybrat
      </button>
    </div>
  );
}
