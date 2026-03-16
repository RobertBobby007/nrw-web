/* eslint-disable @next/next/no-img-element */
"use client";

import {
  Bell,
  Heart,
  BriefcaseBusiness,
  Check,
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
  Moon,
  Sun,
  ToggleLeft,
  ToggleRight,
  LogOut,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ComponentType, type ReactNode } from "react";
import Link from "next/link";
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";
import { useTranslations } from "@/components/i18n/LocaleProvider";
import {
  fetchCurrentProfile,
  updateCurrentProfile,
  uploadAvatar,
  deleteAvatarByUrl,
  type Profile,
} from "@/lib/profiles";
import { containsBlockedContent, containsBlockedIdentityContent } from "@/lib/content-filter";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { getStoredTheme, setThemePreference, type ThemePreference } from "@/lib/theme";
import { uploadLovePhoto } from "@/lib/love-media";
import {
  DEFAULT_SETTINGS_PREFERENCES,
  getStoredSettingsPreferences,
  storeSettingsPreferences,
  type AppSettingsPreferences,
  type SubscriptionPlan,
  type VerificationRequestStatus,
  type VisibilityOption,
} from "@/lib/settings-preferences";

type SectionKey =
  | "profile"
  | "love"
  | "appearance"
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

const BIO_LIMIT = 150;
const LOVE_AGE_OPTIONS = Array.from({ length: 82 }, (_, index) => 18 + index);
const LOVE_DISTANCE_OPTIONS = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 500] as const;
const LOVE_RELATIONSHIP_GOAL_OPTIONS = [
  { value: "long_term", label: "Vážný vztah" },
  { value: "long_term_open", label: "Dlouhodobě, otevřeně" },
  { value: "short_term", label: "Krátkodobě" },
  { value: "new_friends", label: "Nové přátele" },
  { value: "still_figuring_out", label: "Ještě nevím" },
] as const;

function normalizeLoveDistancePreference(value: number) {
  if (value > 50) return 500;
  const nearest = LOVE_DISTANCE_OPTIONS.filter((option) => option <= 50).reduce((acc, option) => {
    const accDiff = Math.abs(acc - value);
    const optionDiff = Math.abs(option - value);
    return optionDiff < accDiff ? option : acc;
  }, 30);
  return nearest;
}

export default function SettingsPage() {
  const t = useTranslations();
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
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [settingsPreferences, setSettingsPreferences] = useState<AppSettingsPreferences>(DEFAULT_SETTINGS_PREFERENCES);
  const [settingsPreferencesReady, setSettingsPreferencesReady] = useState(false);
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
  const [themePreference, setThemePreferenceState] = useState<ThemePreference>("system");
  const navSections = useMemo<NavSection[]>(
    () => [
      {
        title: t("settings.nav.usage"),
        items: [
          { key: "profile", label: t("settings.nav.profile"), icon: User },
          { key: "love", label: t("settings.nav.love"), icon: Heart },
          { key: "appearance", label: t("settings.nav.appearance"), icon: Moon },
          { key: "notifications", label: t("settings.nav.notifications"), icon: Bell },
          { key: "pro", label: t("settings.nav.pro"), icon: BriefcaseBusiness },
          { key: "creator", label: t("settings.nav.creator"), icon: Shield },
        ],
      },
      {
        title: t("settings.nav.audience"),
        items: [
          { key: "privacy", label: t("settings.nav.privacy"), icon: Lock },
          { key: "closeFriends", label: t("settings.nav.closeFriends"), icon: Users },
          { key: "blocked", label: t("settings.nav.blocked"), icon: EyeOff },
          { key: "story", label: t("settings.nav.story"), icon: Map },
        ],
      },
      {
        title: t("settings.nav.communication"),
        items: [
          { key: "messages", label: t("settings.nav.messages"), icon: MessageSquare },
          { key: "tags", label: t("settings.nav.tags"), icon: Tag },
          { key: "comments", label: t("settings.nav.comments"), icon: MessageCircle },
        ],
      },
      {
        title: t("settings.nav.securitySection"),
        items: [
          { key: "security", label: t("settings.nav.security"), icon: ShieldCheck },
          { key: "verification", label: t("settings.nav.verification"), icon: BadgeCheck },
          { key: "subscription", label: t("settings.nav.subscription"), icon: Crown },
        ],
      },
    ],
    [t],
  );

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
    return t("settings.title");
  }, [activeSection, navSections, t]);
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
      const resolvedUserId = user?.id ?? profileData?.id ?? null;
      const storedPreferences = getStoredSettingsPreferences(resolvedUserId);
      setCurrentUserId(resolvedUserId);
      setSettingsPreferences(storedPreferences);
      setSettingsPreferencesReady(true);
      setProfile(profileData);
      setDisplayName(profileData?.display_name ?? metaDisplayName ?? "");
      setUsername(profileData?.username ?? metaUsername ?? "");
      setBio(profileData?.bio ?? "");
      setAvatarPreview(profileData?.avatar_url ?? null);
      setWeb(storedPreferences.profile.web);
    };
    load();
    return () => {
      mounted = false;
    };
  }, [supabase]);

  useEffect(() => {
    setThemePreferenceState(getStoredTheme());
  }, []);

  useEffect(() => {
    if (!settingsPreferencesReady) return;
    storeSettingsPreferences(currentUserId, settingsPreferences);
  }, [currentUserId, settingsPreferences, settingsPreferencesReady]);

  useEffect(() => {
    if (!settingsPreferencesReady) return;
    setSettingsPreferences((current) => {
      if (current.profile.web === web) return current;
      return {
        ...current,
        profile: {
          ...current.profile,
          web,
        },
      };
    });
  }, [settingsPreferencesReady, web]);

  const handleThemeChange = (value: ThemePreference) => {
    setThemePreferenceState(value);
    setThemePreference(value);
  };

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
    if (savingProfile) return;

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

    let avatarUrl = profile?.avatar_url ?? null;
    const previousAvatar = profile?.avatar_url ?? null;

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
      setProfileError(t("settings.profile.saveError"));
      setSavingProfile(false);
      return;
    }

    if (previousAvatar && avatarUrl && previousAvatar !== avatarUrl) {
      await deleteAvatarByUrl(previousAvatar);
    }

    setProfile(updated);
    setSettingsPreferences((current) => ({
      ...current,
      profile: {
        ...current.profile,
        web,
      },
    }));
    setProfileMessage(t("settings.profile.saved"));
    setSavingProfile(false);
  };

  const isActive = (key: SectionKey) => activeSection === key;

  return (
    <main className="min-h-screen bg-neutral-50">
      <div className="mx-auto max-w-6xl px-4 py-6 md:py-10 lg:py-12">
        <div className="hidden items-start justify-between gap-4 md:flex">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-neutral-600">{t("settings.title")}</p>
            <h1 className="text-3xl font-semibold text-neutral-900">{t("settings.editProfile")}</h1>
            <p className="text-sm text-neutral-700">
              {t("settings.description")}
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
                {t("common.actions.back")}
              </button>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-neutral-600">{t("settings.title")}</p>
                <h1 className="text-2xl font-semibold text-neutral-900">
                  {activeSectionLabel}
                </h1>
              </div>
            </div>
          ) : (
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-neutral-600">{t("settings.title")}</p>
              <h1 className="text-2xl font-semibold text-neutral-900">{t("settings.title")}</h1>
              <p className="text-sm text-neutral-700">
                {t("settings.mobileDescription")}
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
                  <span className="flex-1 text-left">{t("settings.support")}</span>
                </Link>
                <Link
                  href="/auth/logout"
                  className="mt-2 flex w-full items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm text-red-600 transition hover:bg-red-50"
                >
                  <LogOut className="h-5 w-5" />
                  <span className="flex-1 text-left">{t("common.actions.signOut")}</span>
                </Link>
                <div className="ml-11 mt-2 space-y-1 text-xs text-neutral-500">
                  <Link href="/privacy" className="block transition-colors hover:text-neutral-900">
                    {t("settings.privacy")}
                  </Link>
                  <Link href="/terms" className="block transition-colors hover:text-neutral-900">
                    {t("settings.terms")}
                  </Link>
                </div>
              </div>
            </div>
          </aside>

          <section className={`space-y-6 ${showMobileSection ? "block" : "hidden"} md:block`}>
            <div className="rounded-2xl border border-neutral-200/70 bg-white p-5 shadow-sm">
              <div className="mb-3">
                <p className="text-xs uppercase tracking-[0.18em] text-neutral-500">{t("common.language")}</p>
                <h2 className="mt-1 text-lg font-semibold text-neutral-900">{t("settings.appearance.languageTitle")}</h2>
                <p className="mt-1 text-sm text-neutral-600">{t("settings.appearance.languageDescription")}</p>
              </div>
              <LanguageSwitcher />
            </div>
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
              themePreference,
              settingsPreferences,
              setSettingsPreferences,
              onThemeChange: handleThemeChange,
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
              t,
            })}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
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
    t,
    profile,
    sanitizeVerificationLabel,
    themePreference,
    settingsPreferences,
    setSettingsPreferences,
    onThemeChange,
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
    themePreference: ThemePreference;
    settingsPreferences: AppSettingsPreferences;
    setSettingsPreferences: React.Dispatch<React.SetStateAction<AppSettingsPreferences>>;
    onThemeChange: (value: ThemePreference) => void;
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
    t: (key: string, values?: Record<string, string | number>) => string;
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
                      onError={() => setProfileError(t("settings.profile.avatarLoadError"))}
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-neutral-200 to-neutral-100 text-lg font-semibold text-neutral-700">
                      {initials}
                    </div>
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
                    <span>@{username || t("settings.profile.yourNameHandle")}</span>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold ${
                        (profile?.verified ?? false)
                          ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                          : "bg-neutral-100 text-neutral-700 ring-1 ring-neutral-200"
                      }`}
                    >
                      <BadgeCheck className="h-3.5 w-3.5" />
                      {(profile?.verified ?? false)
                        ? sanitizeVerificationLabel(profile?.verification_label) || t("settings.profile.verifiedProfile")
                        : t("settings.profile.unverified")}
                    </span>
                  </div>
                  <div className="text-xs text-neutral-600">
                    {displayName || t("settings.profile.nameFallback")}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={onAvatarPick}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-px hover:bg-neutral-800"
              >
                <span>{t("common.actions.changePhoto")}</span>
              </button>
            </div>

            <Field label={t("settings.profile.usernameLabel")}>
              <div className="flex items-center gap-2 rounded-xl border border-neutral-200/70 bg-neutral-50 px-3 py-2">
                <span className="text-neutral-500">@</span>
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value.replace(/^@+/, ""))}
                  className="w-full bg-transparent text-sm text-neutral-900 placeholder:text-neutral-500 outline-none"
                  placeholder={t("settings.profile.yourNameHandle")}
                />
              </div>
            </Field>

            <Field label={t("settings.profile.nameLabel")}>
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full rounded-xl border border-neutral-200/70 bg-neutral-50 px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-500 outline-none focus:border-neutral-400"
                placeholder={t("settings.profile.namePlaceholder")}
              />
            </Field>

            <Field label={t("settings.profile.webLabel")} description={t("settings.profile.webDescription")}>
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
              label={t("settings.profile.bioLabel")}
              description={t("settings.profile.bioDescription")}
              count={`${bioCount} / ${BIO_LIMIT}`}
            >
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value.slice(0, BIO_LIMIT))}
                rows={3}
                className="w-full resize-none rounded-xl border border-neutral-200/70 bg-neutral-50 px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-500 outline-none focus:border-neutral-400"
                placeholder={t("settings.profile.bioPlaceholder")}
              />
            </Field>

            <ToggleRow
              label={t("settings.profile.suggestionsToggle")}
              checked={settingsPreferences.profile.showAccountSuggestions}
              onChange={() =>
                setSettingsPreferences((current) => ({
                  ...current,
                  profile: {
                    ...current.profile,
                    showAccountSuggestions: !current.profile.showAccountSuggestions,
                  },
                }))
              }
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
                {t("common.actions.cancel")}
              </button>
              <button
                type="button"
                disabled={savingProfile}
                onClick={onSaveProfile}
                className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-px hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-80"
              >
                {savingProfile ? t("common.actions.saving") : t("common.actions.saveChanges")}
              </button>
            </div>
          </div>

          {showCropper && cropImageUrl && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
              <div className="w-full max-w-3xl rounded-2xl border border-neutral-200 bg-white p-4 shadow-xl">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-semibold text-neutral-900">{t("common.actions.changePhoto")}</h3>
                    <p className="text-sm text-neutral-600">{t("common.actions.saveCrop")}</p>
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
                        {t("common.actions.saveCrop")}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      );
    case "appearance":
      return (
        <div className="space-y-4 rounded-2xl border border-neutral-200/70 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-100 text-neutral-700">
              <Moon className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-semibold text-neutral-900">{t("settings.appearance.title")}</div>
              <p className="text-xs text-neutral-500">{t("settings.appearance.description")}</p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {([
              {
                value: "system",
                title: t("settings.appearance.system"),
                description: t("settings.appearance.systemDescription"),
                icon: Sun,
              },
              {
                value: "light",
                title: t("settings.appearance.light"),
                description: t("settings.appearance.lightDescription"),
                icon: Sun,
              },
              {
                value: "dark",
                title: t("settings.appearance.dark"),
                description: t("settings.appearance.darkDescription"),
                icon: Moon,
              },
            ] as const).map((option) => {
              const active = themePreference === option.value;
              const Icon = option.icon;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => onThemeChange(option.value)}
                  className={`flex flex-col gap-2 rounded-2xl border px-4 py-4 text-left transition ${
                    active
                      ? "border-neutral-900 bg-neutral-900 text-white shadow-sm"
                      : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300 hover:bg-neutral-50"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`flex h-9 w-9 items-center justify-center rounded-full ${
                        active ? "bg-white/15 text-white" : "bg-neutral-100 text-neutral-600"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <div>
                      <div className={`text-sm font-semibold ${active ? "text-white" : "text-neutral-900"}`}>
                        {option.title}
                      </div>
                      <div className={`text-xs ${active ? "text-white/70" : "text-neutral-500"}`}>
                        {option.description}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
          <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
            <div className="mb-3">
              <div className="text-sm font-semibold text-neutral-900">{t("settings.appearance.languageTitle")}</div>
              <p className="text-xs text-neutral-500">{t("settings.appearance.languageDescription")}</p>
            </div>
            <LanguageSwitcher />
          </div>
        </div>
      );
    case "love":
      return <LoveSettingsSection />;
    case "notifications":
      return (
        <NotificationsSection
          preferences={settingsPreferences}
          setPreferences={setSettingsPreferences}
        />
      );
    case "pro":
      return <ProSection preferences={settingsPreferences} setPreferences={setSettingsPreferences} />;
    case "creator":
      return <CreatorSection preferences={settingsPreferences} setPreferences={setSettingsPreferences} />;
    case "privacy":
      return <PrivacySection preferences={settingsPreferences} setPreferences={setSettingsPreferences} />;
    case "closeFriends":
      return <CloseFriendsSection preferences={settingsPreferences} setPreferences={setSettingsPreferences} />;
    case "blocked":
      return <BlockedSection preferences={settingsPreferences} setPreferences={setSettingsPreferences} />;
    case "story":
      return <StorySection preferences={settingsPreferences} setPreferences={setSettingsPreferences} />;
    case "messages":
      return <MessagesSection preferences={settingsPreferences} setPreferences={setSettingsPreferences} />;
    case "tags":
      return <TagsSection preferences={settingsPreferences} setPreferences={setSettingsPreferences} />;
    case "comments":
      return <CommentsSection preferences={settingsPreferences} setPreferences={setSettingsPreferences} />;
    case "security":
      return <SecuritySection preferences={settingsPreferences} setPreferences={setSettingsPreferences} />;
    case "verification":
      return (
        <VerificationSection
          profile={profile}
          sanitizeVerificationLabel={sanitizeVerificationLabel}
          preferences={settingsPreferences}
          setPreferences={setSettingsPreferences}
        />
      );
    case "subscription":
      return <SubscriptionSection preferences={settingsPreferences} setPreferences={setSettingsPreferences} />;
    default:
      return (
        <div className="rounded-2xl border border-neutral-200/70 bg-white p-6 text-sm text-neutral-700 shadow-sm">
          Tato sekce bude doplněna později. Vyber jinou položku vlevo.
        </div>
      );
  }
}

function LoveSettingsSection() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [photos, setPhotos] = useState<string[]>(["", "", "", ""]);
  const [photoFiles, setPhotoFiles] = useState<Array<File | null>>([null, null, null, null]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>(["", "", "", ""]);
  const [enabled, setEnabled] = useState(false);
  const [locationSharingEnabled, setLocationSharingEnabled] = useState(true);
  const [genderIdentity, setGenderIdentity] = useState<"woman" | "man" | "nonbinary" | null>(null);
  const [lookingFor, setLookingFor] = useState<Array<"woman" | "man" | "nonbinary" | "any">>(["any"]);
  const [relationshipGoal, setRelationshipGoal] = useState<
    "long_term" | "long_term_open" | "short_term" | "new_friends" | "still_figuring_out" | null
  >(null);
  const [age, setAge] = useState<number | null>(null);
  const [ageMin, setAgeMin] = useState(18);
  const [ageMax, setAgeMax] = useState(35);
  const [maxDistanceKm, setMaxDistanceKm] = useState(30);
  const [locating, setLocating] = useState(false);
  const [locationStatus, setLocationStatus] = useState<{ fresh: boolean; capturedAt: string | null }>({
    fresh: false,
    capturedAt: null,
  });

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      const response = await fetch("/api/love/settings", { method: "GET" });
      const payload = (await response.json().catch(() => null)) as
        | {
            message?: string;
            profile?: { displayName?: string | null; bio?: string | null };
            settings?: {
              enabled?: boolean;
              locationSharingEnabled?: boolean;
              genderIdentity?: "woman" | "man" | "nonbinary" | null;
              lookingFor?: Array<"woman" | "man" | "nonbinary" | "any">;
              relationshipGoal?: "long_term" | "long_term_open" | "short_term" | "new_friends" | "still_figuring_out" | null;
              age?: number | null;
              ageMin?: number;
              ageMax?: number;
              maxDistanceKm?: number;
              photos?: string[];
            };
            locationStatus?: { fresh?: boolean; capturedAt?: string | null };
          }
        | null;

      if (!active) return;
      if (!response.ok) {
        setError(payload?.message ?? "nLove nastavení nejde načíst.");
        setLoading(false);
        return;
      }

      setDisplayName(payload?.profile?.displayName?.trim() ?? "");
      setBio(payload?.profile?.bio?.trim() ?? "");
      const nextPhotos = Array.isArray(payload?.settings?.photos)
        ? payload!.settings!.photos!.map((item) => String(item ?? "").trim()).filter(Boolean).slice(0, 4)
        : [];
      setPhotos([nextPhotos[0] ?? "", nextPhotos[1] ?? "", nextPhotos[2] ?? "", nextPhotos[3] ?? ""]);
      setEnabled(Boolean(payload?.settings?.enabled));
      setLocationSharingEnabled(payload?.settings?.locationSharingEnabled !== false);
      setGenderIdentity(payload?.settings?.genderIdentity ?? null);
      setLookingFor(Array.isArray(payload?.settings?.lookingFor) ? payload!.settings!.lookingFor! : ["any"]);
      setRelationshipGoal(
        payload?.settings?.relationshipGoal === "long_term" ||
          payload?.settings?.relationshipGoal === "long_term_open" ||
          payload?.settings?.relationshipGoal === "short_term" ||
          payload?.settings?.relationshipGoal === "new_friends" ||
          payload?.settings?.relationshipGoal === "still_figuring_out"
          ? payload.settings.relationshipGoal
          : null,
      );
      setAge(
        typeof payload?.settings?.age === "number"
          ? Math.max(18, Math.min(99, Math.floor(payload.settings.age)))
          : null,
      );
      setAgeMin(Math.max(18, Number(payload?.settings?.ageMin ?? 18)));
      setAgeMax(Math.max(18, Number(payload?.settings?.ageMax ?? 35)));
      setMaxDistanceKm(normalizeLoveDistancePreference(Math.max(1, Number(payload?.settings?.maxDistanceKm ?? 30))));
      setLocationStatus({
        fresh: Boolean(payload?.locationStatus?.fresh),
        capturedAt: payload?.locationStatus?.capturedAt ?? null,
      });
      setLoading(false);
    };
    void load();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    return () => {
      photoPreviews.forEach((url) => {
        if (url.startsWith("blob:")) URL.revokeObjectURL(url);
      });
    };
  }, [photoPreviews]);

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);
    setMessage(null);

    const uploaded: string[] = [];
    for (const file of photoFiles) {
      if (!file) continue;
      const url = await uploadLovePhoto(file);
      if (!url) {
        setError("Nepodařilo se nahrát nLove fotku.");
        setSaving(false);
        return;
      }
      uploaded.push(url);
    }

    const mergedPhotos = Array.from(new Set([...photos.filter(Boolean), ...uploaded])).slice(0, 4);
    const response = await fetch("/api/love/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        displayName,
        bio,
        avatarUrl: mergedPhotos[0] ?? null,
        photos: mergedPhotos,
        genderIdentity,
        lookingFor,
        relationshipGoal,
        age,
        ageMin,
        ageMax,
        maxDistanceKm,
        enabled,
        onboardingCompleted: true,
        locationSharingEnabled,
      }),
    });
    const payload = (await response.json().catch(() => null)) as { message?: string } | null;
    if (!response.ok) {
      setError(payload?.message ?? "Uložení nLove nastavení selhalo.");
      setSaving(false);
      return;
    }

    setPhotos([mergedPhotos[0] ?? "", mergedPhotos[1] ?? "", mergedPhotos[2] ?? "", mergedPhotos[3] ?? ""]);
    setPhotoFiles([null, null, null, null]);
    setPhotoPreviews((prev) => {
      prev.forEach((url) => {
        if (url.startsWith("blob:")) URL.revokeObjectURL(url);
      });
      return ["", "", "", ""];
    });
    setMessage("nLove profil uložen.");
    setSaving(false);
  };

  const refreshLocation = async () => {
    if (!navigator.geolocation) {
      setError("Geolokace není v tomto zařízení dostupná.");
      return;
    }
    setLocating(true);
    setError(null);
    await new Promise<void>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const response = await fetch("/api/love/location", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracyM: position.coords.accuracy,
              capturedAt: new Date().toISOString(),
            }),
          });
          const payload = (await response.json().catch(() => null)) as { message?: string; location?: { capturedAt?: string } } | null;
          if (!response.ok) {
            setError(payload?.message ?? "Aktuální polohu se nepodařilo uložit pro nLove.");
            resolve();
            return;
          }
          setLocationSharingEnabled(true);
          setLocationStatus({ fresh: true, capturedAt: new Date().toISOString() });
          setError(null);
          resolve();
        },
        async (geoError) => {
          if (geoError.code === geoError.PERMISSION_DENIED) {
            await fetch("/api/love/location", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ denied: true }),
            });
            setLocationStatus((prev) => ({ ...prev, fresh: false }));
            setError("Poloha byla zamítnutá. Pro swipe ji musíš povolit v prohlížeči.");
            resolve();
            return;
          }

          setLocationStatus((prev) => ({ ...prev, fresh: false }));
          setError(
            geoError.code === geoError.TIMEOUT
              ? "Aktuální polohu se nepodařilo načíst včas. Zkus to znovu."
              : "Aktuální polohu se teď nepodařilo získat. Zkus to znovu.",
          );
          resolve();
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
      );
    });
    setLocating(false);
  };

  if (loading) {
    return <div className="rounded-2xl border border-neutral-200/70 bg-white p-6 text-sm text-neutral-600 shadow-sm">Načítám nLove nastavení…</div>;
  }

  return (
    <div className="space-y-4 rounded-2xl border border-neutral-200/70 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold text-neutral-900">nLove profil</div>
          <p className="text-xs text-neutral-600">Uprav fotky a preference. Poloha se po povolení v prohlížeči bere automaticky.</p>
        </div>
        <span className="rounded-full bg-neutral-100 px-3 py-1 text-[11px] font-semibold text-neutral-700">
          {locationStatus.fresh ? "Poloha aktivní" : "Poloha chybí"}
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          className="rounded-xl border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-neutral-400"
          placeholder="Zobrazované jméno"
        />
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value.slice(0, 220))}
          className="rounded-xl border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-neutral-400 sm:col-span-2"
          placeholder="Bio"
          rows={3}
        />
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[0, 1, 2, 3].map((idx) => {
          const src = photoPreviews[idx] || photos[idx] || null;
          return src ? (
            <div key={idx} className="relative">
              <img src={src} alt={`nLove ${idx + 1}`} className="h-40 w-full rounded-xl object-cover" />
              <button
                type="button"
                onClick={() => {
                  setPhotos((prev) => prev.map((item, i) => (i === idx ? "" : item)));
                  setPhotoFiles((prev) => prev.map((item, i) => (i === idx ? null : item)));
                  setPhotoPreviews((prev) =>
                    prev.map((item, i) => {
                      if (i !== idx) return item;
                      if (item.startsWith("blob:")) URL.revokeObjectURL(item);
                      return "";
                    }),
                  );
                }}
                className="absolute right-1 top-1 inline-flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <label
              key={idx}
              htmlFor={`settings-love-photo-input-${idx}`}
              className="flex h-40 cursor-pointer items-center justify-center rounded-xl border border-dashed border-neutral-200 text-xs text-neutral-400 transition hover:border-neutral-300 hover:text-neutral-500"
            >
              <input
                id={`settings-love-photo-input-${idx}`}
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(e) => {
                  const nextFile = e.target.files?.[0] ?? null;
                  if (!nextFile) return;

                  setPhotoFiles((prev) => prev.map((item, fileIndex) => (fileIndex === idx ? nextFile : item)));
                  setPhotoPreviews((prev) =>
                    prev.map((item, previewIndex) => {
                      if (previewIndex !== idx) return item;
                      if (item.startsWith("blob:")) URL.revokeObjectURL(item);
                      return URL.createObjectURL(nextFile);
                    }),
                  );
                }}
              />
              <span>Klikni pro výběr fotky {idx + 1}</span>
            </label>
          );
        })}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <select
          value={age ?? ""}
          onChange={(e) => setAge(e.target.value ? Number(e.target.value) : null)}
          className="rounded-xl border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-neutral-400"
        >
          <option value="">Věk</option>
          {LOVE_AGE_OPTIONS.map((ageValue) => (
            <option key={ageValue} value={ageValue}>
              {ageValue}
            </option>
          ))}
        </select>
        <select
          value={ageMin}
          onChange={(e) => {
            const nextAgeMin = Number(e.target.value || 18);
            const nextAgeMax = Math.max(nextAgeMin, ageMax);
            setAgeMin(nextAgeMin);
            setAgeMax(nextAgeMax);
          }}
          className="rounded-xl border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-neutral-400"
        >
          {LOVE_AGE_OPTIONS.map((ageValue) => (
            <option key={ageValue} value={ageValue}>
              Věk od {ageValue}
            </option>
          ))}
        </select>
        <select
          value={ageMax}
          onChange={(e) => {
            const nextAgeMax = Number(e.target.value || 35);
            const nextAgeMin = Math.min(ageMin, nextAgeMax);
            setAgeMin(nextAgeMin);
            setAgeMax(nextAgeMax);
          }}
          className="rounded-xl border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-neutral-400"
        >
          {LOVE_AGE_OPTIONS.map((ageValue) => (
            <option key={ageValue} value={ageValue}>
              Věk do {ageValue}
            </option>
          ))}
        </select>
      </div>
      <select
        value={maxDistanceKm}
        onChange={(e) => setMaxDistanceKm(Number(e.target.value || 30))}
        className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-neutral-400"
      >
        {LOVE_DISTANCE_OPTIONS.map((distance) => (
          <option key={distance} value={distance}>
            {distance === 500 ? "Max vzdálenost: 50+ km" : `Max vzdálenost: ${distance} km`}
          </option>
        ))}
      </select>

      <div className="flex flex-wrap gap-2">
        {[
          { id: "woman", label: "Žena" },
          { id: "man", label: "Muž" },
          { id: "nonbinary", label: "Non-binary" },
        ].map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => setGenderIdentity(option.id as "woman" | "man" | "nonbinary")}
            className={`rounded-full border px-3 py-1 text-sm ${
              genderIdentity === option.id
                ? "border-neutral-900 bg-neutral-900 text-white"
                : "border-neutral-200 bg-white text-neutral-700"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {[
          { id: "any", label: "Kdokoliv" },
          { id: "woman", label: "Ženy" },
          { id: "man", label: "Muži" },
          { id: "nonbinary", label: "Non-binary" },
        ].map((option) => {
          const active = lookingFor.includes(option.id as (typeof lookingFor)[number]);
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => {
                const id = option.id as (typeof lookingFor)[number];
                if (id === "any") {
                  setLookingFor(["any"]);
                  return;
                }
                setLookingFor((prev) => {
                  const clean = prev.filter((item) => item !== "any");
                  const toggled = clean.includes(id) ? clean.filter((item) => item !== id) : [...clean, id];
                  return toggled.length ? toggled : ["any"];
                });
              }}
              className={`rounded-full border px-3 py-1 text-sm ${
                active ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-200 bg-white text-neutral-700"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2">
        {LOVE_RELATIONSHIP_GOAL_OPTIONS.map((option) => {
          const active = relationshipGoal === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => setRelationshipGoal(option.value)}
              className={`rounded-full border px-3 py-1 text-sm ${
                active ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-200 bg-white text-neutral-700"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      <label className="flex items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-800">
        <span className="pr-3">Povolit nLove profil</span>
        <span className="relative inline-flex h-8 w-14 shrink-0">
          <input type="checkbox" className="peer sr-only" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          <span className="absolute inset-0 rounded-full border border-white/40 bg-slate-700 transition-colors peer-checked:border-white peer-checked:bg-white" />
          <span className="absolute left-1 top-1 h-6 w-6 rounded-full bg-white shadow-sm transition-transform duration-200 peer-checked:translate-x-6 peer-checked:bg-neutral-900" />
        </span>
      </label>
      <label className="flex items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-800">
        <span className="pr-3">Sdílení polohy se po povolení v prohlížeči zapíná automaticky</span>
        <span className="relative inline-flex h-8 w-14 shrink-0">
          <input
            type="checkbox"
            className="peer sr-only"
            checked={locationSharingEnabled}
            onChange={(e) => setLocationSharingEnabled(e.target.checked)}
          />
          <span className="absolute inset-0 rounded-full border border-white/40 bg-slate-700 transition-colors peer-checked:border-white peer-checked:bg-white" />
          <span className="absolute left-1 top-1 h-6 w-6 rounded-full bg-white shadow-sm transition-transform duration-200 peer-checked:translate-x-6 peer-checked:bg-neutral-900" />
        </span>
      </label>

      {locationStatus.capturedAt ? (
        <div className="text-xs text-neutral-500">
          Poslední poloha: {new Date(locationStatus.capturedAt).toLocaleString("cs-CZ")}
        </div>
      ) : null}
      <button
        type="button"
        onClick={() => void refreshLocation()}
        disabled={locating}
        className="rounded-lg border border-neutral-200 px-3 py-2 text-xs font-semibold text-neutral-800 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {locating ? "Obnovuji polohu…" : "Obnovit polohu pro nLove"}
      </button>

      {error ? <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
      {message ? <div className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</div> : null}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-px hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-80"
        >
          {saving ? "Ukládám…" : "Uložit nLove profil"}
        </button>
      </div>
    </div>
  );
}

type PreferencesSectionProps = {
  preferences: AppSettingsPreferences;
  setPreferences: React.Dispatch<React.SetStateAction<AppSettingsPreferences>>;
};

function NotificationsSection({ preferences, setPreferences }: PreferencesSectionProps) {
  const enabledCount = Object.values(preferences.notifications).filter(Boolean).length;

  return (
    <div className="space-y-4">
      <SettingsIntro
        title="Upozornění"
        description="Zapni si jen ty typy notifikací, které chceš opravdu dostávat."
        badge={`${enabledCount}/4 aktivní`}
      />
      <div className="rounded-2xl border border-neutral-200/70 bg-white p-6 shadow-sm">
        <LocalOnlyNote />
        <div className="mt-4 space-y-3">
          <Toggle
            checked={preferences.notifications.likes}
            onChange={() =>
              setPreferences((current) => ({
                ...current,
                notifications: { ...current.notifications, likes: !current.notifications.likes },
              }))
            }
            label="Lajky a reakce"
          />
          <Toggle
            checked={preferences.notifications.comments}
            onChange={() =>
              setPreferences((current) => ({
                ...current,
                notifications: { ...current.notifications, comments: !current.notifications.comments },
              }))
            }
            label="Komentáře a odpovědi"
          />
          <Toggle
            checked={preferences.notifications.messages}
            onChange={() =>
              setPreferences((current) => ({
                ...current,
                notifications: { ...current.notifications, messages: !current.notifications.messages },
              }))
            }
            label="Zprávy a žádosti"
          />
          <Toggle
            checked={preferences.notifications.marketing}
            onChange={() =>
              setPreferences((current) => ({
                ...current,
                notifications: { ...current.notifications, marketing: !current.notifications.marketing },
              }))
            }
            label="Novinky a produktové tipy"
          />
        </div>
      </div>
    </div>
  );
}

function ProSection({ preferences, setPreferences }: PreferencesSectionProps) {
  const isEnabled = preferences.pro.businessProfile || preferences.pro.showContactButton || preferences.pro.leadInbox;

  return (
    <div className="space-y-4">
      <SettingsIntro
        title="Pro účet a značky"
        description="Nastav si business režim, kontaktní CTA a jednoduchý lead inbox."
        badge={isEnabled ? "Pro režim aktivní" : "Osobní režim"}
      />
      <div className="rounded-2xl border border-neutral-200/70 bg-white p-6 shadow-sm">
        <LocalOnlyNote />
        <div className="mt-4 space-y-3">
          <Toggle
            checked={preferences.pro.businessProfile}
            onChange={() =>
              setPreferences((current) => ({
                ...current,
                pro: { ...current.pro, businessProfile: !current.pro.businessProfile },
              }))
            }
            label="Přepnout účet do business režimu"
          />
          <Toggle
            checked={preferences.pro.showContactButton}
            onChange={() =>
              setPreferences((current) => ({
                ...current,
                pro: { ...current.pro, showContactButton: !current.pro.showContactButton },
              }))
            }
            label="Zobrazit tlačítko kontaktu"
          />
          <Toggle
            checked={preferences.pro.leadInbox}
            onChange={() =>
              setPreferences((current) => ({
                ...current,
                pro: { ...current.pro, leadInbox: !current.pro.leadInbox },
              }))
            }
            label="Filtrovat nové leady do samostatné schránky"
          />
        </div>
        <div className="mt-4 rounded-xl border border-dashed border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-700">
          {isEnabled
            ? "Business prvky jsou připravené. Jakmile doplníme backend, můžeme je přímo napojit na profil a inbox."
            : "Účet zůstává v osobním režimu bez business prvků."}
        </div>
      </div>
    </div>
  );
}

function CreatorSection({ preferences, setPreferences }: PreferencesSectionProps) {
  const creatorMode = preferences.creator.creatorMode;

  return (
    <div className="space-y-4">
      <SettingsIntro
        title="Nástroje tvůrců"
        description="Režim pro autory, spolupráce a souhrny výkonu obsahu."
        badge={creatorMode ? "Creator mode" : "Vypnuto"}
      />
      <div className="rounded-2xl border border-neutral-200/70 bg-white p-6 shadow-sm">
        <LocalOnlyNote />
        <div className="mt-4 space-y-3">
          <Toggle
            checked={creatorMode}
            onChange={() =>
              setPreferences((current) => ({
                ...current,
                creator: { ...current.creator, creatorMode: !current.creator.creatorMode },
              }))
            }
            label="Zapnout tvůrčí režim"
          />
          <Toggle
            checked={preferences.creator.brandedContent}
            onChange={() =>
              setPreferences((current) => ({
                ...current,
                creator: { ...current.creator, brandedContent: !current.creator.brandedContent },
              }))
            }
            label="Povolit branded content štítky"
          />
          <Toggle
            checked={preferences.creator.analyticsDigest}
            onChange={() =>
              setPreferences((current) => ({
                ...current,
                creator: { ...current.creator, analyticsDigest: !current.creator.analyticsDigest },
              }))
            }
            label="Denní digest výkonu příspěvků"
          />
        </div>
      </div>
    </div>
  );
}

function PrivacySection({ preferences, setPreferences }: PreferencesSectionProps) {
  const privacy = preferences.privacy;

  return (
    <div className="space-y-4">
      <SettingsIntro
        title="Soukromí účtu"
        description="Nastav viditelnost účtu a to, jak snadno tě ostatní najdou."
        badge={privacy.privateAccount ? "Soukromý účet" : "Veřejný účet"}
      />
      <div className="rounded-2xl border border-neutral-200/70 bg-white p-6 shadow-sm">
        <LocalOnlyNote />
        <div className="mt-4 space-y-3">
          <Toggle
            checked={privacy.privateAccount}
            onChange={() =>
              setPreferences((current) => ({
                ...current,
                privacy: { ...current.privacy, privateAccount: !current.privacy.privateAccount },
              }))
            }
            label="Soukromý účet"
          />
          <Toggle
            checked={privacy.activityStatus}
            onChange={() =>
              setPreferences((current) => ({
                ...current,
                privacy: { ...current.privacy, activityStatus: !current.privacy.activityStatus },
              }))
            }
            label="Zobrazovat aktivitu a naposledy online"
          />
          <Toggle
            checked={privacy.searchableByEmail}
            onChange={() =>
              setPreferences((current) => ({
                ...current,
                privacy: { ...current.privacy, searchableByEmail: !current.privacy.searchableByEmail },
              }))
            }
            label="Dohledat účet přes e-mail"
          />
          <Toggle
            checked={privacy.searchableByPhone}
            onChange={() =>
              setPreferences((current) => ({
                ...current,
                privacy: { ...current.privacy, searchableByPhone: !current.privacy.searchableByPhone },
              }))
            }
            label="Dohledat účet přes telefon"
          />
        </div>
      </div>
    </div>
  );
}

function CloseFriendsSection({ preferences, setPreferences }: PreferencesSectionProps) {
  return (
    <UsernameListSection
      title="Blízcí přátelé"
      description="Spravuj seznam lidí, pro které můžeš připravovat užší obsah."
      emptyText="Zatím tu nikoho nemáš."
      values={preferences.closeFriends.members}
      onChange={(members) =>
        setPreferences((current) => ({
          ...current,
          closeFriends: { members },
        }))
      }
      accent="emerald"
      actionLabel="Přidat přítele"
    />
  );
}

function BlockedSection({ preferences, setPreferences }: PreferencesSectionProps) {
  return (
    <UsernameListSection
      title="Blokovaní"
      description="Lidé na tomto seznamu tě neuvidí ani ti nenapíšou."
      emptyText="Nemáš žádné blokované účty."
      values={preferences.blocked.members}
      onChange={(members) =>
        setPreferences((current) => ({
          ...current,
          blocked: { members },
        }))
      }
      accent="red"
      actionLabel="Blokovat účet"
    />
  );
}

function StorySection({ preferences, setPreferences }: PreferencesSectionProps) {
  const story = preferences.story;

  return (
    <div className="space-y-4">
      <SettingsIntro
        title="Příběh a lokalita"
        description="Urči, kdo může na stories reagovat a zda chceš přidávat lokaci."
        badge={story.showLocation ? "Lokace zapnutá" : "Lokace skrytá"}
      />
      <div className="rounded-2xl border border-neutral-200/70 bg-white p-6 shadow-sm">
        <LocalOnlyNote />
        <div className="mt-4 space-y-3">
          <Toggle
            checked={story.allowReplies}
            onChange={() =>
              setPreferences((current) => ({
                ...current,
                story: { ...current.story, allowReplies: !current.story.allowReplies },
              }))
            }
            label="Povolit odpovědi na příběh"
          />
          <Toggle
            checked={story.allowReshare}
            onChange={() =>
              setPreferences((current) => ({
                ...current,
                story: { ...current.story, allowReshare: !current.story.allowReshare },
              }))
            }
            label="Povolit sdílení tvého příběhu"
          />
          <Toggle
            checked={story.showLocation}
            onChange={() =>
              setPreferences((current) => ({
                ...current,
                story: { ...current.story, showLocation: !current.story.showLocation },
              }))
            }
            label="Zobrazovat lokaci ve stories"
          />
        </div>
      </div>
    </div>
  );
}

function MessagesSection({ preferences, setPreferences }: PreferencesSectionProps) {
  const messages = preferences.messages;

  return (
    <div className="space-y-4">
      <SettingsIntro
        title="Zprávy a žádosti"
        description="Nastav, kdo tě může oslovit a jestli chceš potvrzení o přečtení."
        badge={messages.onlyFollowing ? "Pouze sledovaní" : "Žádosti povoleny"}
      />
      <div className="rounded-2xl border border-neutral-200/70 bg-white p-6 shadow-sm">
        <LocalOnlyNote />
        <div className="mt-4 space-y-3">
          <Toggle
            checked={messages.allowRequests}
            onChange={() =>
              setPreferences((current) => ({
                ...current,
                messages: { ...current.messages, allowRequests: !current.messages.allowRequests },
              }))
            }
            label="Povolit žádosti od nových lidí"
          />
          <Toggle
            checked={messages.onlyFollowing}
            onChange={() =>
              setPreferences((current) => ({
                ...current,
                messages: { ...current.messages, onlyFollowing: !current.messages.onlyFollowing },
              }))
            }
            label="Přijímat přímé zprávy jen od sledovaných"
          />
          <Toggle
            checked={messages.readReceipts}
            onChange={() =>
              setPreferences((current) => ({
                ...current,
                messages: { ...current.messages, readReceipts: !current.messages.readReceipts },
              }))
            }
            label="Zobrazovat potvrzení o přečtení"
          />
        </div>
      </div>
    </div>
  );
}

function TagsSection({ preferences, setPreferences }: PreferencesSectionProps) {
  return (
    <div className="space-y-4">
      <SettingsIntro
        title="Označení a zmínky"
        description="Vyber, kdo tě může tagovat v příspěvcích a zmiňovat v textu."
        badge="Ukládá se automaticky"
      />
      <div className="rounded-2xl border border-neutral-200/70 bg-white p-6 shadow-sm">
        <LocalOnlyNote />
        <div className="mt-4 space-y-5">
          <ChoiceField
            label="Kdo tě může označit v příspěvku"
            value={preferences.tags.tagsFrom}
            onChange={(value) =>
              setPreferences((current) => ({
                ...current,
                tags: { ...current.tags, tagsFrom: value as VisibilityOption },
              }))
            }
            options={VISIBILITY_OPTIONS}
          />
          <ChoiceField
            label="Kdo tě může zmínit"
            value={preferences.tags.mentionsFrom}
            onChange={(value) =>
              setPreferences((current) => ({
                ...current,
                tags: { ...current.tags, mentionsFrom: value as VisibilityOption },
              }))
            }
            options={VISIBILITY_OPTIONS}
          />
        </div>
      </div>
    </div>
  );
}

function CommentsSection({ preferences, setPreferences }: PreferencesSectionProps) {
  return (
    <div className="space-y-4">
      <SettingsIntro
        title="Komentáře"
        description="Nastav, kdo může komentovat a jak přísně má fungovat filtr."
        badge={preferences.comments.hideOffensive ? "Filtr aktivní" : "Filtr vypnutý"}
      />
      <div className="rounded-2xl border border-neutral-200/70 bg-white p-6 shadow-sm">
        <LocalOnlyNote />
        <div className="mt-4 space-y-5">
          <ChoiceField
            label="Kdo může komentovat"
            value={preferences.comments.commentsFrom}
            onChange={(value) =>
              setPreferences((current) => ({
                ...current,
                comments: { ...current.comments, commentsFrom: value as VisibilityOption },
              }))
            }
            options={VISIBILITY_OPTIONS}
          />
          <div className="space-y-3">
            <Toggle
              checked={preferences.comments.hideOffensive}
              onChange={() =>
                setPreferences((current) => ({
                  ...current,
                  comments: { ...current.comments, hideOffensive: !current.comments.hideOffensive },
                }))
              }
              label="Automaticky skrývat urážlivé komentáře"
            />
            <Toggle
              checked={preferences.comments.manualApproval}
              onChange={() =>
                setPreferences((current) => ({
                  ...current,
                  comments: { ...current.comments, manualApproval: !current.comments.manualApproval },
                }))
              }
              label="Ruční schvalování komentářů"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function SecuritySection({ preferences, setPreferences }: PreferencesSectionProps) {
  const enabledCount = Object.values(preferences.security).filter(Boolean).length;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-neutral-200/70 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-neutral-900">Rychlá ochrana</div>
            <p className="text-xs text-neutral-600">
              Přehled nejdůležitějších bezpečnostních štítů pro přihlášení a upozornění.
            </p>
          </div>
          <span className="rounded-full bg-neutral-900 px-3 py-1 text-[11px] font-semibold text-white">
            {enabledCount}/3 aktivní
          </span>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <ShieldCard
            icon={Lock}
            title="Dvoufázové ověření"
            note={preferences.security.twoFactor ? "Dodatečné ověření je zapnuté." : "Dodatečné ověření je vypnuté."}
          />
          <ShieldCard
            icon={Bell}
            title="Výstrahy při novém zařízení"
            note={
              preferences.security.newDeviceAlerts
                ? "Na nová přihlášení budeš upozorněn."
                : "Nová zařízení se teď nehlásí."
            }
          />
          <ShieldCard
            icon={ShieldCheck}
            title="Schvalování přihlášení"
            note={
              preferences.security.loginApprovals
                ? "Citlivé pokusy budeš schvalovat ručně."
                : "Přihlášení probíhá bez dalšího schválení."
            }
          />
          <ShieldCard
            icon={Tag}
            title="Stav zabezpečení"
            note={enabledCount >= 2 ? "Účet je dobře chráněný." : "Doporučujeme zapnout více ochran."}
          />
        </div>
      </div>

      <div className="rounded-2xl border border-neutral-200/70 bg-white p-6 shadow-sm">
        <LocalOnlyNote />
        <div className="mt-4 space-y-3">
          <Toggle
            checked={preferences.security.twoFactor}
            onChange={() =>
              setPreferences((current) => ({
                ...current,
                security: { ...current.security, twoFactor: !current.security.twoFactor },
              }))
            }
            label="Dvoufázové ověření"
          />
          <Toggle
            checked={preferences.security.newDeviceAlerts}
            onChange={() =>
              setPreferences((current) => ({
                ...current,
                security: { ...current.security, newDeviceAlerts: !current.security.newDeviceAlerts },
              }))
            }
            label="Výstrahy při novém zařízení"
          />
          <Toggle
            checked={preferences.security.loginApprovals}
            onChange={() =>
              setPreferences((current) => ({
                ...current,
                security: { ...current.security, loginApprovals: !current.security.loginApprovals },
              }))
            }
            label="Schvalování přihlášení"
          />
        </div>
      </div>
    </div>
  );
}

function VerificationSection({
  profile,
  sanitizeVerificationLabel,
  preferences,
  setPreferences,
}: {
  profile: Profile | null;
  sanitizeVerificationLabel: (value: string | null | undefined) => string | null;
} & PreferencesSectionProps) {
  const serverVerified = Boolean(profile?.verified);
  const status: VerificationRequestStatus = serverVerified ? "verified" : preferences.verification.status;
  const publicLabel =
    sanitizeVerificationLabel(profile?.verification_label) ?? preferences.verification.publicLabel;

  return (
    <div className="space-y-4">
      <SettingsIntro
        title="Ověření účtu"
        description="Připrav si štítek pro veřejný profil a odešli žádost o ověření."
        badge={
          status === "verified" ? "Ověřeno" : status === "pending" ? "Žádost čeká" : "Nepodáno"
        }
      />
      <div className="rounded-2xl border border-neutral-200/70 bg-white p-6 shadow-sm">
        {!serverVerified ? <LocalOnlyNote /> : null}
        <div className="mt-4 space-y-3">
          <InfoRow icon={User} title="Identita" text="nID · základní" />
          <InfoRow
            icon={ShieldCheck}
            title="Stav"
            text={
              status === "verified"
                ? "Ověřený účet"
                : status === "pending"
                  ? "Žádost čeká na zpracování"
                  : "Žádost ještě nebyla odeslaná"
            }
          />
          <Field label="Veřejný štítek">
            <input
              value={publicLabel}
              disabled={serverVerified}
              onChange={(e) =>
                setPreferences((current) => ({
                  ...current,
                  verification: {
                    ...current.verification,
                    publicLabel: e.target.value.slice(0, 40),
                  },
                }))
              }
              className="w-full rounded-xl border border-neutral-200/70 bg-neutral-50 px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-500 outline-none focus:border-neutral-400 disabled:cursor-not-allowed disabled:opacity-70"
              placeholder="NRW Verified"
            />
          </Field>
          {preferences.verification.requestedAt ? (
            <div className="text-xs text-neutral-500">
              Žádost odeslána {new Date(preferences.verification.requestedAt).toLocaleString("cs-CZ")}
            </div>
          ) : null}
          {serverVerified ? (
            <div className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              Tento účet už má aktivní ověření přímo z profilu.
            </div>
          ) : (
            <button
              type="button"
              onClick={() =>
                setPreferences((current) => ({
                  ...current,
                  verification:
                    current.verification.status === "pending"
                      ? {
                          ...current.verification,
                          status: "not_requested",
                          requestedAt: null,
                        }
                      : {
                          ...current.verification,
                          status: "pending",
                          requestedAt: new Date().toISOString(),
                        },
                }))
              }
              className="w-full rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-px hover:bg-neutral-800"
            >
              {status === "pending" ? "Zrušit žádost" : "Požádat o ověření"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function SubscriptionSection({ preferences, setPreferences }: PreferencesSectionProps) {
  const [showBillingManager, setShowBillingManager] = useState(false);
  const plan = preferences.subscription.currentPlan;
  const billingActive = preferences.subscription.billingActive;

  return (
    <div className="space-y-4">
      <SettingsIntro
        title="Předplatné NRW+"
        description="Vyber si plán a spravuj, jestli je předplatné aktivní."
        badge={billingActive ? "Aktivní předplatné" : "Bez předplatného"}
      />
      <div className="rounded-2xl border border-neutral-200/70 bg-white p-6 shadow-sm">
        <LocalOnlyNote />
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <PlanCard
            title="Starter"
            price="0 Kč"
            perks={["Základní ochrana", "Notifikace", "Komunita"]}
            selected={plan === "starter"}
            onSelect={() =>
              setPreferences((current) => ({
                ...current,
                subscription: {
                  ...current.subscription,
                  currentPlan: "starter",
                  billingActive: false,
                },
              }))
            }
            buttonLabel={plan === "starter" ? "Vybráno" : "Vybrat"}
          />
          <PlanCard
            highlight
            title="NRW+"
            price="169 Kč/měs"
            perks={["Prioritní podpora", "Detailní analýzy", "Ověření profilu"]}
            selected={plan === "nrw_plus"}
            onSelect={() =>
              setPreferences((current) => ({
                ...current,
                subscription: {
                  ...current.subscription,
                  currentPlan: "nrw_plus",
                },
              }))
            }
            buttonLabel={plan === "nrw_plus" ? "Vybráno" : "Vybrat"}
          />
          <PlanCard
            title="NRW Pro"
            price="389 Kč/měs"
            perks={["Týmové role", "API přístup", "Brand kit & štítky"]}
            selected={plan === "nrw_pro"}
            onSelect={() =>
              setPreferences((current) => ({
                ...current,
                subscription: {
                  ...current.subscription,
                  currentPlan: "nrw_pro",
                },
              }))
            }
            buttonLabel={plan === "nrw_pro" ? "Vybráno" : "Vybrat"}
          />
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() =>
              setPreferences((current) => ({
                ...current,
                subscription: {
                  ...current.subscription,
                  billingActive: current.subscription.currentPlan !== "starter",
                },
              }))
            }
            className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-px hover:bg-neutral-800"
          >
            {plan === "starter"
              ? "Starter je aktivní"
              : billingActive
                ? `Aktivní ${getPlanLabel(plan)}`
                : `Aktivovat ${getPlanLabel(plan)}`}
          </button>
          <button
            type="button"
            onClick={() => setShowBillingManager((current) => !current)}
            className="flex items-center gap-2 rounded-lg border border-neutral-200/70 px-4 py-2 text-sm font-medium text-neutral-700 transition hover:border-neutral-300 hover:bg-neutral-50"
          >
            <CreditCard className="h-4 w-4" />
            Spravovat platby
          </button>
        </div>
        {showBillingManager ? (
          <div className="mt-4 rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-700">
            <div className="font-semibold text-neutral-900">Billing panel</div>
            <div className="mt-1">
              Aktuální plán: <span className="font-medium">{getPlanLabel(plan)}</span>
            </div>
            <div className="mt-1">
              Stav:{" "}
              <span className={`font-medium ${billingActive ? "text-emerald-700" : "text-neutral-600"}`}>
                {billingActive ? "aktivní" : "neaktivní"}
              </span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() =>
                  setPreferences((current) => ({
                    ...current,
                    subscription: {
                      ...current.subscription,
                      billingActive: !current.subscription.billingActive,
                    },
                  }))
                }
                className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm font-semibold text-neutral-900 transition hover:bg-neutral-100"
              >
                {billingActive ? "Pozastavit obnovu" : "Obnovit platby"}
              </button>
              <button
                type="button"
                onClick={() =>
                  setPreferences((current) => ({
                    ...current,
                    subscription: {
                      currentPlan: "starter",
                      billingActive: false,
                    },
                  }))
                }
                className="rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50"
              >
                Zrušit předplatné
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function SettingsIntro({
  title,
  description,
  badge,
}: {
  title: string;
  description: string;
  badge?: string;
}) {
  return (
    <div className="rounded-2xl border border-neutral-200/70 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-neutral-900">{title}</div>
          <p className="text-xs text-neutral-600">{description}</p>
        </div>
        {badge ? (
          <span className="rounded-full bg-neutral-100 px-3 py-1 text-[11px] font-semibold text-neutral-700">
            {badge}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function LocalOnlyNote() {
  return (
    <div className="rounded-lg border border-dashed border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-600">
      Tato část se teď ukládá lokálně v tomto prohlížeči, aby byla plně použitelná i bez nové databázové vrstvy.
    </div>
  );
}

const VISIBILITY_OPTIONS = [
  { value: "everyone", label: "Kdokoliv" },
  { value: "following", label: "Jen sledovaní" },
  { value: "nobody", label: "Nikdo" },
] satisfies Array<{ value: VisibilityOption; label: string }>;

function ChoiceField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <div className="space-y-2">
      <div className="text-sm font-semibold text-neutral-900">{label}</div>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const active = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium transition ${
                active
                  ? "border-neutral-900 bg-neutral-900 text-white"
                  : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300 hover:bg-neutral-50"
              }`}
            >
              {active ? <Check className="h-4 w-4" /> : null}
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function UsernameListSection({
  title,
  description,
  emptyText,
  values,
  onChange,
  actionLabel,
  accent,
}: {
  title: string;
  description: string;
  emptyText: string;
  values: string[];
  onChange: (values: string[]) => void;
  actionLabel: string;
  accent: "emerald" | "red";
}) {
  const [draft, setDraft] = useState("");
  const toneClasses =
    accent === "emerald"
      ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
      : "bg-red-50 text-red-700 ring-red-200";

  const handleAdd = () => {
    const normalized = draft.trim().replace(/^@+/, "");
    if (!normalized) return;
    onChange(Array.from(new Set([...values, normalized])));
    setDraft("");
  };

  return (
    <div className="space-y-4">
      <SettingsIntro title={title} description={description} badge={`${values.length} účtů`} />
      <div className="rounded-2xl border border-neutral-200/70 bg-white p-6 shadow-sm">
        <LocalOnlyNote />
        <div className="mt-4 flex gap-3">
          <div className="flex flex-1 items-center gap-2 rounded-xl border border-neutral-200/70 bg-neutral-50 px-3 py-2">
            <span className="text-neutral-500">@</span>
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value.replace(/^@+/, ""))}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAdd();
                }
              }}
              className="w-full bg-transparent text-sm text-neutral-900 placeholder:text-neutral-500 outline-none"
              placeholder="uzivatelske_jmeno"
            />
          </div>
          <button
            type="button"
            onClick={handleAdd}
            className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800"
          >
            {actionLabel}
          </button>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {values.length ? (
            values.map((value) => (
              <span
                key={value}
                className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium ring-1 ${toneClasses}`}
              >
                @{value}
                <button
                  type="button"
                  onClick={() => onChange(values.filter((item) => item !== value))}
                  className="rounded-full p-0.5 transition hover:bg-black/5"
                  aria-label={`Odebrat ${value}`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            ))
          ) : (
            <div className="text-sm text-neutral-500">{emptyText}</div>
          )}
        </div>
      </div>
    </div>
  );
}

function getPlanLabel(plan: SubscriptionPlan) {
  if (plan === "nrw_plus") return "NRW+";
  if (plan === "nrw_pro") return "NRW Pro";
  return "Starter";
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
  selected,
  onSelect,
  buttonLabel = "Vybrat",
}: {
  title: string;
  price: string;
  perks: string[];
  highlight?: boolean;
  selected?: boolean;
  onSelect?: () => void;
  buttonLabel?: string;
}) {
  return (
    <div
      className={`flex h-full flex-col gap-3 rounded-xl border border-neutral-200/70 p-4 shadow-sm transition ${
        highlight
          ? "border-neutral-900 bg-neutral-900 text-white"
          : selected
            ? "border-neutral-900 bg-neutral-50"
            : "bg-white"
      }`}
    >
      <div className="flex items-start justify-between">
        <div>
          <div className={`text-sm font-semibold ${highlight ? "text-white" : "text-neutral-900"}`}>
            {title}
          </div>
          <div className={`text-xs ${highlight ? "text-white/70" : "text-neutral-600"}`}>{price}</div>
        </div>
        {highlight ? (
          <span className="rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold text-white">
            Doporučeno
          </span>
        ) : selected ? (
          <span className="rounded-full bg-neutral-900 px-3 py-1 text-[11px] font-semibold text-white">
            Aktivní
          </span>
        ) : null}
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
        type="button"
        onClick={onSelect}
        className={`mt-auto rounded-lg px-3 py-2 text-sm font-semibold transition ${
          highlight
            ? "bg-white text-neutral-900 hover:-translate-y-px"
            : selected
              ? "border border-neutral-900 bg-neutral-900 text-white hover:-translate-y-px"
              : "border border-neutral-200 bg-white text-neutral-900 hover:border-neutral-300 hover:-translate-y-px"
        }`}
      >
        {buttonLabel}
      </button>
    </div>
  );
}
