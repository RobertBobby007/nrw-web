"use client";

/* eslint-disable @next/next/no-img-element */

import { Heart, Inbox, MapPin, MessageCircle, Sparkles, Star, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useTranslations } from "@/components/i18n/LocaleProvider";
import { getOrCreateDirectChat } from "@/lib/chat";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { requestAuth } from "@/lib/auth-required";
import { uploadLovePhoto } from "@/lib/love-media";
import { haversineKm } from "@/lib/love-location";

type LoveCard = {
  id: string;
  username: string | null;
  displayName: string | null;
  age?: number | null;
  priorityType?: "superlike" | null;
  avatarUrl: string | null;
  photos?: string[];
  bio: string | null;
  verified: boolean;
  distanceKm: number;
};

type LoveMatch = {
  id: string;
  createdAt: string;
  chatId?: string | null;
  distanceKm?: number | null;
  user: {
    id: string;
    username: string | null;
    displayName: string | null;
    age?: number | null;
    avatarUrl: string | null;
    photos?: string[];
  };
};

type SwipeAction = "pass" | "like" | "superlike";

type SwipeResult = {
  matched: boolean;
  match?: LoveMatch;
};

type MatchRealtimeRow = {
  id?: string;
  user_a?: string | null;
  user_b?: string | null;
  chat_id?: string | null;
};

type SwipeRealtimeRow = {
  swiper_id?: string | null;
  target_id?: string | null;
  action?: SwipeAction | null;
};

type UserScopedRealtimeRow = {
  user_id?: string | null;
};

type LoveSettings = {
  enabled: boolean;
  onboardingCompleted: boolean;
  locationSharingEnabled: boolean;
  locationRequiredAck: boolean;
  superlikeCredits: number;
  relationshipGoal: "long_term" | "long_term_open" | "short_term" | "new_friends" | "still_figuring_out" | null;
  genderIdentity: "woman" | "man" | "nonbinary" | null;
  lookingFor: Array<"woman" | "man" | "nonbinary" | "any">;
  ageMin: number;
  ageMax: number;
  maxDistanceKm: number;
  age: number | null;
  photos: string[];
};

type LoveProfile = {
  displayName: string;
  bio: string;
  avatarUrl: string;
};

type LocationStatus = {
  available: boolean;
  fresh: boolean;
  capturedAt: string | null;
  updatedAt: string | null;
  ttlMs: number;
};

const defaultSettings: LoveSettings = {
  enabled: false,
  onboardingCompleted: false,
  locationSharingEnabled: true,
  locationRequiredAck: false,
  superlikeCredits: 0,
  relationshipGoal: null,
  genderIdentity: null,
  lookingFor: ["any"],
  ageMin: 18,
  ageMax: 35,
  maxDistanceKm: 30,
  age: null,
  photos: [],
};

function labelForProfile(card: LoveCard, fallback = "NRW user") {
  return card.displayName?.trim() || card.username?.trim() || fallback;
}

function ageForProfile(card: LoveCard) {
  if (typeof card.age !== "number") return null;
  if (!Number.isFinite(card.age)) return null;
  const rounded = Math.floor(card.age);
  if (rounded < 18 || rounded > 99) return null;
  return rounded;
}

function initialForName(name: string) {
  return (name.trim().charAt(0) || "N").toUpperCase();
}

const AGE_OPTIONS = Array.from({ length: 82 }, (_, index) => 18 + index);
const DISTANCE_OPTIONS = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 500] as const;
const LOCATION_PROMPT_SESSION_KEY = "nlove_location_prompt_requested_v1";
const RELATIONSHIP_GOAL_OPTIONS: Array<{
  value: NonNullable<LoveSettings["relationshipGoal"]>;
  labelKey: string;
}> = [
  { value: "long_term", labelKey: "love.goals.longTerm" },
  { value: "long_term_open", labelKey: "love.goals.longTermOpen" },
  { value: "short_term", labelKey: "love.goals.shortTerm" },
  { value: "new_friends", labelKey: "love.goals.newFriends" },
  { value: "still_figuring_out", labelKey: "love.goals.stillFiguringOut" },
];

function normalizeDistancePreference(value: number) {
  if (value > 50) return 500;
  const nearest = DISTANCE_OPTIONS.filter((option) => option <= 50).reduce((acc, option) => {
    const accDiff = Math.abs(acc - value);
    const optionDiff = Math.abs(option - value);
    return optionDiff < accDiff ? option : acc;
  }, 30);
  return nearest;
}

export default function LovePage() {
  const t = useTranslations();
  const router = useRouter();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [cards, setCards] = useState<LoveCard[]>([]);
  const [matches, setMatches] = useState<LoveMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [swipeBusy, setSwipeBusy] = useState(false);
  const [busyMatchUserId, setBusyMatchUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [mobileMatchesOpen, setMobileMatchesOpen] = useState(false);

  const [accessReady, setAccessReady] = useState(false);
  const [setupLoaded, setSetupLoaded] = useState(false);
  const [settingsStep, setSettingsStep] = useState<1 | 2>(1);
  const [savingSetup, setSavingSetup] = useState(false);
  const [setupProfile, setSetupProfile] = useState<LoveProfile>({ displayName: "", bio: "", avatarUrl: "" });
  const [setupPhotos, setSetupPhotos] = useState<string[]>(["", "", "", ""]);
  const [setupPhotoFiles, setSetupPhotoFiles] = useState<Array<File | null>>([null, null, null, null]);
  const [setupPhotoPreviews, setSetupPhotoPreviews] = useState<string[]>(["", "", "", ""]);
  const [setupSettings, setSetupSettings] = useState<LoveSettings>(defaultSettings);
  const [locationStatus, setLocationStatus] = useState<LocationStatus>({
    available: false,
    fresh: false,
    capturedAt: null,
    updatedAt: null,
    ttlMs: 300000,
  });
  const [liveMatchBanner, setLiveMatchBanner] = useState<LoveMatch | null>(null);
  const [liveEventCount, setLiveEventCount] = useState(0);
  const lastSentLocation = useRef<{ lat: number; lng: number } | null>(null);
  const cardsRef = useRef<LoveCard[]>([]);
  const matchesRef = useRef<LoveMatch[]>([]);
  const knownMatchIdsRef = useRef<Set<string>>(new Set());
  const realtimeSyncBusy = useRef(false);
  const lastRecoverySyncAt = useRef(0);
  const lastProfileLocationSyncAt = useRef(0);
  const hasSubscribedOnce = useRef(false);
  const autoLocationPromptBlocked = useRef(false);
  const locationPromptRequested = useRef(false);
  const locationDeniedReported = useRef(false);
  const [editorOpen, setEditorOpen] = useState(false);

  const activeCard = cards[0] ?? null;
  const queue = cards.slice(1, 5);

  useEffect(() => {
    cardsRef.current = cards;
  }, [cards]);

  useEffect(() => {
    matchesRef.current = matches;
    knownMatchIdsRef.current = new Set(matches.map((item) => item.id));
  }, [matches]);

  useEffect(() => {
    if (!liveMatchBanner) return;
    const timeout = window.setTimeout(() => {
      setLiveMatchBanner((prev) => (prev?.id === liveMatchBanner.id ? null : prev));
    }, 8000);
    return () => {
      window.clearTimeout(timeout);
    };
  }, [liveMatchBanner]);

  useEffect(() => {
    if (!status) return;
    const timeout = window.setTimeout(() => {
      setStatus((prev) => (prev === status ? null : prev));
    }, 6000);
    return () => {
      window.clearTimeout(timeout);
    };
  }, [status]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    locationPromptRequested.current = window.sessionStorage.getItem(LOCATION_PROMPT_SESSION_KEY) === "1";
  }, [t]);

  const loadLoveData = useCallback(async () => {
    setLoading(true);
    setError(null);

    const [feedRes, matchesRes] = await Promise.all([
      fetch("/api/love/feed", { method: "GET" }),
      fetch("/api/love/matches", { method: "GET" }),
    ]);

    const feedPayload = (await feedRes.json().catch(() => null)) as
      | { cards?: LoveCard[]; error?: string; message?: string }
      | null;
    const matchesPayload = (await matchesRes.json().catch(() => null)) as
      | { matches?: LoveMatch[]; error?: string; message?: string }
      | null;

    if (feedRes.status === 401 || matchesRes.status === 401) {
      setError(t("love.errors.signInRequired"));
      setLoading(false);
      return;
    }

    const forbiddenError = feedPayload?.error ?? matchesPayload?.error;
    if (feedRes.status === 403 || matchesRes.status === 403) {
      if (forbiddenError === "love_not_enabled") {
        setAccessReady(false);
      } else if (forbiddenError === "location_required") {
        setError(feedPayload?.message ?? t("love.errors.locationRequired"));
        setLocationStatus((prev) => ({ ...prev, fresh: false }));
      }
      setLoading(false);
      return;
    }

    if (!feedRes.ok) {
      setError(feedPayload?.message ?? t("love.errors.feedLoad"));
      setLoading(false);
      return;
    }

    if (!matchesRes.ok) {
      setError(matchesPayload?.message ?? t("love.errors.matchesLoad"));
      setLoading(false);
      return;
    }

    setCards(feedPayload?.cards ?? []);
    setMatches(matchesPayload?.matches ?? []);
    setLoading(false);
  }, [t]);

  const loadSetup = useCallback(async () => {
    const response = await fetch("/api/love/settings", { method: "GET" });
    const payload = (await response.json().catch(() => null)) as
      | {
          error?: string;
          message?: string;
          ready?: boolean;
          settings?: Partial<LoveSettings>;
          locationStatus?: Partial<LocationStatus>;
          profile?: { displayName?: string | null; bio?: string | null; avatarUrl?: string | null };
        }
      | null;

    if (response.status === 401) {
      setError(t("love.errors.signInRequired"));
      setAccessReady(false);
      return;
    }

    if (!response.ok) {
      setError(payload?.message ?? t("love.errors.settingsLoad"));
      setAccessReady(false);
      return;
    }

    const nextSettings: LoveSettings = {
      enabled: Boolean(payload?.settings?.enabled),
      onboardingCompleted: Boolean(payload?.settings?.onboardingCompleted),
      locationSharingEnabled: payload?.settings?.locationSharingEnabled !== false,
      locationRequiredAck: Boolean(payload?.settings?.locationRequiredAck),
      superlikeCredits: Math.max(0, Number(payload?.settings?.superlikeCredits ?? 0)),
      relationshipGoal:
        payload?.settings?.relationshipGoal === "long_term" ||
        payload?.settings?.relationshipGoal === "long_term_open" ||
        payload?.settings?.relationshipGoal === "short_term" ||
        payload?.settings?.relationshipGoal === "new_friends" ||
        payload?.settings?.relationshipGoal === "still_figuring_out"
          ? payload.settings.relationshipGoal
          : null,
      genderIdentity:
        payload?.settings?.genderIdentity === "woman" ||
        payload?.settings?.genderIdentity === "man" ||
        payload?.settings?.genderIdentity === "nonbinary"
          ? payload.settings.genderIdentity
          : null,
      lookingFor: Array.isArray(payload?.settings?.lookingFor)
        ? (payload?.settings?.lookingFor as LoveSettings["lookingFor"])
        : ["any"],
      ageMin: Math.max(18, Number(payload?.settings?.ageMin ?? 18)),
      ageMax: Math.max(18, Number(payload?.settings?.ageMax ?? 35)),
      maxDistanceKm: normalizeDistancePreference(Math.max(1, Number(payload?.settings?.maxDistanceKm ?? 30))),
      age:
        typeof payload?.settings?.age === "number"
          ? Math.max(18, Math.min(99, Math.floor(payload.settings.age)))
          : null,
      photos: Array.isArray(payload?.settings?.photos)
        ? payload!.settings!.photos!.map((item) => String(item ?? "").trim()).filter(Boolean).slice(0, 4)
        : [],
    };

    const nextProfile = {
      displayName: payload?.profile?.displayName?.trim() ?? "",
      bio: payload?.profile?.bio?.trim() ?? "",
      avatarUrl: payload?.profile?.avatarUrl?.trim() ?? "",
    };

    setSetupSettings(nextSettings);
    setSetupProfile(nextProfile);

    const mergedPhotos = [
      nextSettings.photos[0] ?? nextProfile.avatarUrl ?? "",
      nextSettings.photos[1] ?? "",
      nextSettings.photos[2] ?? "",
      nextSettings.photos[3] ?? "",
    ];
    setSetupPhotos(mergedPhotos);

    const ready = Boolean(payload?.ready);
    setAccessReady(ready);
    setSettingsStep(ready ? 2 : nextSettings.onboardingCompleted ? 2 : 1);
    setLocationStatus({
      available: Boolean(payload?.locationStatus?.available),
      fresh: Boolean(payload?.locationStatus?.fresh),
      capturedAt: payload?.locationStatus?.capturedAt ?? null,
      updatedAt: payload?.locationStatus?.updatedAt ?? null,
      ttlMs: Number(payload?.locationStatus?.ttlMs ?? 300000),
    });
  }, [t]);

  const addLiveEvent = useCallback((count = 1) => {
    setLiveEventCount((prev) => prev + count);
  }, []);

  const upsertMatch = useCallback(
    (match: LoveMatch, options?: { showBanner?: boolean; countAsEvent?: boolean }) => {
      setMatches((prev) => {
        const existingIndex = prev.findIndex((item) => item.id === match.id || item.user.id === match.user.id);
        const next = [...prev];
        if (existingIndex >= 0) {
          next[existingIndex] = { ...next[existingIndex], ...match };
        } else {
          next.unshift(match);
        }
        next.sort((a, b) => {
          const aTime = Date.parse(a.createdAt || "");
          const bTime = Date.parse(b.createdAt || "");
          return (Number.isFinite(bTime) ? bTime : 0) - (Number.isFinite(aTime) ? aTime : 0);
        });
        return next.slice(0, 40);
      });

      if (options?.showBanner) {
        setLiveMatchBanner(match);
      }
      if (options?.countAsEvent) {
        addLiveEvent(1);
      }
    },
    [addLiveEvent],
  );

  const removeCardByUserId = useCallback((userId: string | null | undefined) => {
    if (!userId) return;
    setCards((prev) => prev.filter((card) => card.id !== userId));
  }, []);

  const loadCardsIncremental = useCallback(async () => {
    const feedRes = await fetch("/api/love/feed", { method: "GET" });
    const feedPayload = (await feedRes.json().catch(() => null)) as
      | { cards?: LoveCard[]; error?: string; message?: string }
      | null;

    if (feedRes.status === 401) {
      return;
    }

    if (feedRes.status === 403) {
      if (feedPayload?.error === "love_not_enabled") {
        setAccessReady(false);
      } else if (feedPayload?.error === "location_required") {
        setLocationStatus((prev) => ({ ...prev, fresh: false }));
      }
      return;
    }

    if (!feedRes.ok) return;

    const nextCards = feedPayload?.cards ?? [];
    setCards(nextCards);
  }, []);

  const loadMatchesIncremental = useCallback(
    async (options?: { withBannerForNew?: boolean; countNewAsEvents?: boolean }) => {
      const matchesRes = await fetch("/api/love/matches", { method: "GET" });
      const matchesPayload = (await matchesRes.json().catch(() => null)) as
        | { matches?: LoveMatch[]; error?: string; message?: string }
        | null;

      if (matchesRes.status === 401) return;

      if (matchesRes.status === 403) {
        if (matchesPayload?.error === "love_not_enabled") {
          setAccessReady(false);
        }
        return;
      }

      if (!matchesRes.ok) return;

      const next = matchesPayload?.matches ?? [];
      const existingIds = knownMatchIdsRef.current;
      const newMatches = next.filter((item) => !existingIds.has(item.id));

      if (newMatches.length && (options?.withBannerForNew || options?.countNewAsEvents)) {
        const firstNew = newMatches[0];
        if (options.withBannerForNew && firstNew) {
          setLiveMatchBanner(firstNew);
        }
        if (options.countNewAsEvents) {
          addLiveEvent(newMatches.length);
        }
      }

      setMatches(next);
    },
    [addLiveEvent],
  );

  const runRecoverySync = useCallback(async () => {
    if (realtimeSyncBusy.current) return;
    const now = Date.now();
    if (now - lastRecoverySyncAt.current < 3000) return;

    realtimeSyncBusy.current = true;
    lastRecoverySyncAt.current = now;
    try {
      await Promise.all([loadSetup(), loadCardsIncremental(), loadMatchesIncremental()]);
    } finally {
      realtimeSyncBusy.current = false;
    }
  }, [loadCardsIncremental, loadMatchesIncremental, loadSetup]);

  useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(({ data, error: authError }) => {
      if (!active) return;
      if (authError) {
        setCurrentUserId(null);
        return;
      }
      setCurrentUserId(data.user?.id ?? null);
    });

    return () => {
      active = false;
    };
  }, [supabase]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        await loadSetup();
      } finally {
        if (active) {
          setSetupLoaded(true);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [loadSetup]);

  useEffect(() => {
    if (!accessReady) {
      setLoading(false);
      return;
    }
    void loadLoveData();
  }, [accessReady, loadLoveData]);

  useEffect(() => {
    return () => {
      setupPhotoPreviews.forEach((url) => {
        if (url.startsWith("blob:")) URL.revokeObjectURL(url);
      });
    };
  }, [setupPhotoPreviews]);

  const sendLocationUpdate = useCallback(
    async (coords: GeolocationCoordinates) => {
      const lat = coords.latitude;
      const lng = coords.longitude;
      const prev = lastSentLocation.current;
      const movedEnough =
        !prev || haversineKm(prev.lat, prev.lng, lat, lng) * 1000 >= 100;
      if (!movedEnough && locationStatus.fresh) return;

      const response = await fetch("/api/love/location", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          latitude: lat,
          longitude: lng,
          accuracyM: coords.accuracy,
          capturedAt: new Date().toISOString(),
        }),
      });
      const payload = (await response.json().catch(() => null)) as
        | {
            error?: string;
            message?: string;
            location?: { capturedAt?: string; accuracyM?: number };
          }
        | null;

      if (!response.ok) {
        if (response.status === 401) return;
        if (response.status === 403) {
          setError(payload?.message ?? t("love.errors.browserLocation"));
          setLocationStatus((prevStatus) => ({ ...prevStatus, fresh: false }));
          return;
        }
        return;
      }

      lastSentLocation.current = { lat, lng };
      autoLocationPromptBlocked.current = false;
      locationDeniedReported.current = false;
      setError(null);
      setLocationStatus((prevStatus) => ({
        ...prevStatus,
        available: true,
        fresh: true,
        capturedAt: payload?.location?.capturedAt ?? new Date().toISOString(),
      }));
      setSetupSettings((prevSettings) => ({
        ...prevSettings,
        locationSharingEnabled: true,
        locationRequiredAck: false,
      }));
      void loadCardsIncremental();
      void loadMatchesIncremental();
    },
    [loadCardsIncremental, loadMatchesIncremental, locationStatus.fresh, t],
  );

  const reportDeniedLocation = useCallback(async () => {
    if (locationDeniedReported.current) return;
    locationDeniedReported.current = true;
    try {
      await fetch("/api/love/location", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ denied: true }),
      });
    } catch {
      // noop
    }
    setLocationStatus((prevStatus) => ({ ...prevStatus, fresh: false }));
  }, []);

  const requestAndSendLocation = useCallback(async (source: "auto" | "manual" = "auto") => {
    if (!navigator.geolocation) {
      return;
    }

    let permissionState: PermissionState | null = null;
    if (navigator.permissions?.query) {
      try {
        const permission = await navigator.permissions.query({ name: "geolocation" });
        permissionState = permission.state;
      } catch {
        permissionState = null;
      }
    }

    if (permissionState === "granted") {
      autoLocationPromptBlocked.current = false;
    }

    if (permissionState === "denied") {
      autoLocationPromptBlocked.current = true;
      await reportDeniedLocation();
      return;
    }

    if (source === "auto" && autoLocationPromptBlocked.current) {
      return;
    }

    if (source === "auto" && permissionState === "prompt" && locationPromptRequested.current) {
      return;
    }

    if (permissionState === "prompt") {
      locationPromptRequested.current = true;
      if (typeof window !== "undefined") {
        window.sessionStorage.setItem(LOCATION_PROMPT_SESSION_KEY, "1");
      }
    }

    await new Promise<void>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          void sendLocationUpdate(position.coords).finally(() => resolve());
        },
        (geoError) => {
          if (geoError.code === geoError.PERMISSION_DENIED) {
            if (source === "auto") {
              autoLocationPromptBlocked.current = true;
              locationPromptRequested.current = true;
              if (typeof window !== "undefined") {
                window.sessionStorage.setItem(LOCATION_PROMPT_SESSION_KEY, "1");
              }
            }
            void reportDeniedLocation().finally(() => resolve());
            return;
          }

          setLocationStatus((prevStatus) => ({
            ...prevStatus,
            available: permissionState === "granted" ? true : prevStatus.available,
            fresh: false,
          }));

          if (source === "manual") {
            setError(
              geoError.code === geoError.TIMEOUT
                ? t("love.errors.locationTimeout")
                : t("love.errors.locationRetry"),
            );
          }

          resolve();
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
      );
    });
  }, [reportDeniedLocation, sendLocationUpdate, t]);

  useEffect(() => {
    if (!accessReady) return;
    if (typeof window === "undefined") return;

    let stopped = false;
    const tick = () => {
      if (stopped) return;
      if (document.visibilityState !== "visible") return;
      void requestAndSendLocation("auto");
    };

    tick();
    const interval = window.setInterval(tick, 30000);
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        tick();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      stopped = true;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [accessReady, requestAndSendLocation]);

  useEffect(() => {
    if (!currentUserId) return;
    const channel = supabase.channel(`nlove:live:${currentUserId}`);
    let disposed = false;

    const handleMatchEvent = (payload: { eventType?: string; new?: unknown; old?: unknown }) => {
      const row = ((payload.new as MatchRealtimeRow | undefined) ?? (payload.old as MatchRealtimeRow | undefined)) ?? null;
      if (!row?.id) return;

      const otherUserId =
        row.user_a === currentUserId
          ? row.user_b ?? null
          : row.user_b === currentUserId
            ? row.user_a ?? null
            : null;

      removeCardByUserId(otherUserId);
      void loadMatchesIncremental({ withBannerForNew: payload.eventType === "INSERT", countNewAsEvents: true });
    };

    const handleSwipeEvent = (payload: { new?: unknown; old?: unknown }) => {
      const row = ((payload.new as SwipeRealtimeRow | undefined) ?? (payload.old as SwipeRealtimeRow | undefined)) ?? null;
      if (!row) return;

      const swiperId = row.swiper_id ?? null;
      const targetId = row.target_id ?? null;

      if (swiperId === currentUserId) {
        removeCardByUserId(targetId);
        return;
      }

      if (targetId === currentUserId) {
        removeCardByUserId(swiperId);
        addLiveEvent(1);
      }
    };

    const handleProfileOrLocationEvent = (payload: { new?: unknown; old?: unknown }) => {
      const row = ((payload.new as UserScopedRealtimeRow | undefined) ?? (payload.old as UserScopedRealtimeRow | undefined)) ?? null;
      const affectedUserId = row?.user_id ?? null;
      if (!affectedUserId) return;

      const isCurrent = affectedUserId === currentUserId;
      const impactsCard = cardsRef.current.some((card) => card.id === affectedUserId);
      const impactsMatch = matchesRef.current.some((match) => match.user.id === affectedUserId);
      if (!isCurrent && !impactsCard && !impactsMatch) return;
      const now = Date.now();
      if (now - lastProfileLocationSyncAt.current < 1000) return;
      lastProfileLocationSyncAt.current = now;

      void loadCardsIncremental();
      void loadMatchesIncremental();
      if (!isCurrent) {
        addLiveEvent(1);
      }
    };

    channel.on("postgres_changes", { event: "*", schema: "public", table: "nlove_matches", filter: `user_a=eq.${currentUserId}` }, handleMatchEvent);
    channel.on("postgres_changes", { event: "*", schema: "public", table: "nlove_matches", filter: `user_b=eq.${currentUserId}` }, handleMatchEvent);
    channel.on("postgres_changes", { event: "*", schema: "public", table: "nlove_swipes", filter: `swiper_id=eq.${currentUserId}` }, handleSwipeEvent);
    channel.on("postgres_changes", { event: "*", schema: "public", table: "nlove_swipes", filter: `target_id=eq.${currentUserId}` }, handleSwipeEvent);
    channel.on("postgres_changes", { event: "*", schema: "public", table: "nlove_profiles" }, handleProfileOrLocationEvent);
    channel.on("postgres_changes", { event: "*", schema: "public", table: "nlove_locations" }, handleProfileOrLocationEvent);

    channel.subscribe((status) => {
      if (disposed) return;
      if (status === "SUBSCRIBED") {
        if (hasSubscribedOnce.current) {
          void runRecoverySync();
        }
        hasSubscribedOnce.current = true;
      }
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        void runRecoverySync();
      }
    });

    return () => {
      disposed = true;
      supabase.removeChannel(channel);
    };
  }, [addLiveEvent, currentUserId, loadCardsIncremental, loadMatchesIncremental, removeCardByUserId, runRecoverySync, supabase]);

  useEffect(() => {
    if (!currentUserId) return;
    const interval = window.setInterval(() => {
      void runRecoverySync();
    }, 120000);
    return () => {
      window.clearInterval(interval);
    };
  }, [currentUserId, runRecoverySync]);

  const saveSetup = useCallback(
    async (finalize: boolean) => {
      if (!currentUserId) {
        requestAuth({ message: t("love.errors.onboardingAuth") });
        return;
      }

      setSavingSetup(true);
      setError(null);
      setStatus(null);

      let uploadedPhotoUrls: string[] = [];
      const filesToUpload = setupPhotoFiles.filter((file): file is File => Boolean(file));
      if (filesToUpload.length > 0) {
        const uploaded: string[] = [];
        for (const file of filesToUpload) {
          const url = await uploadLovePhoto(file);
          if (!url) {
            setError(t("love.errors.photoUpload"));
            setSavingSetup(false);
            return;
          }
          uploaded.push(url);
        }
        uploadedPhotoUrls = uploaded;
      }

      const photos = Array.from(
        new Set([...setupPhotos.map((item) => item.trim()).filter(Boolean), ...uploadedPhotoUrls]),
      ).slice(0, 4);
      const avatarUrl = setupProfile.avatarUrl.trim() || photos[0] || null;

      const response = await fetch("/api/love/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: setupProfile.displayName,
          bio: setupProfile.bio,
          avatarUrl,
          photos,
          genderIdentity: setupSettings.genderIdentity,
          relationshipGoal: setupSettings.relationshipGoal,
          lookingFor: setupSettings.lookingFor,
          ageMin: setupSettings.ageMin,
          ageMax: setupSettings.ageMax,
          maxDistanceKm: setupSettings.maxDistanceKm,
          age: setupSettings.age,
          locationSharingEnabled: true,
          locationRequiredAck: setupSettings.locationRequiredAck,
          onboardingCompleted: finalize,
          enabled: finalize ? setupSettings.enabled : false,
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | { error?: string; message?: string; ready?: boolean }
        | null;

      if (response.status === 401) {
        requestAuth({ message: t("love.errors.saveAuth") });
        setSavingSetup(false);
        return;
      }

      if (!response.ok) {
        setError(payload?.message ?? t("love.errors.saveFailed"));
        setSavingSetup(false);
        return;
      }

      if (!finalize) {
      setStatus(t("love.status.profileSaved"));
        setSettingsStep(2);
        setSetupPhotoFiles([null, null, null, null]);
        setSetupPhotoPreviews((prev) => {
          prev.forEach((url) => {
            if (url.startsWith("blob:")) URL.revokeObjectURL(url);
          });
          return ["", "", "", ""];
        });
        setSetupPhotos((prev) => {
          const next = [...prev];
          photos.forEach((url, idx) => {
            next[idx] = url;
          });
          return next;
        });
        setSavingSetup(false);
        return;
      }

      const ready = Boolean(payload?.ready);
      setAccessReady(ready);
      setStatus(ready ? t("love.status.active") : t("love.status.onboardingSaved"));
      setEditorOpen(false);
      setSetupPhotoFiles([null, null, null, null]);
      setSetupPhotoPreviews((prev) => {
        prev.forEach((url) => {
          if (url.startsWith("blob:")) URL.revokeObjectURL(url);
        });
        return ["", "", "", ""];
      });
      setSavingSetup(false);

      if (ready) {
        await loadLoveData();
      }
    },
    [currentUserId, loadLoveData, setupPhotoFiles, setupPhotos, setupProfile, setupSettings, t],
  );

  const handleSwipe = useCallback(
    async (action: SwipeAction) => {
      if (!currentUserId) {
        requestAuth({ message: t("love.errors.swipeAuth") });
        return;
      }
      if (!activeCard || swipeBusy) return;

      setSwipeBusy(true);
      setStatus(null);

      const response = await fetch("/api/love/swipe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId: activeCard.id, action }),
      });

      const payload = (await response.json().catch(() => null)) as
        | (SwipeResult & { error?: string; message?: string })
        | null;

      if (!response.ok) {
        if (response.status === 401) {
          requestAuth({ message: t("love.errors.actionAuth") });
          setSwipeBusy(false);
          return;
        }
        if (response.status === 403) {
          if (payload?.error === "love_not_enabled") {
            setAccessReady(false);
            await loadSetup();
          } else if (payload?.error === "location_required") {
            setError(payload?.message ?? t("love.errors.swipeLocation"));
            setLocationStatus((prevStatus) => ({ ...prevStatus, fresh: false }));
          }
          setSwipeBusy(false);
          return;
        }
        if (response.status === 402 && payload?.error === "superlike_payment_required") {
          setStatus(payload.message ?? t("love.errors.superlikeCredit"));
          setSwipeBusy(false);
          return;
        }
        setError(payload?.message ?? "Swipe se nepovedl.");
        setSwipeBusy(false);
        return;
      }

      setCards((prev) => prev.slice(1));

      if (payload?.matched && payload.match) {
        upsertMatch(payload.match);
        setLiveMatchBanner(payload.match);
        setStatus(
          t("love.status.match", {
            name: payload.match.user.displayName ?? payload.match.user.username ?? t("love.liveMatchFallback"),
          }),
        );
      }

      if (action === "superlike") {
        setSetupSettings((prev) => ({
          ...prev,
          superlikeCredits: Math.max(0, prev.superlikeCredits - 1),
        }));
      }

      setSwipeBusy(false);
    },
    [activeCard, currentUserId, loadSetup, swipeBusy, t, upsertMatch],
  );

  const openMatchChat = useCallback(
    async (match: LoveMatch) => {
      if (!currentUserId) {
        requestAuth({ message: t("love.errors.openChatAuth") });
        return;
      }

      setBusyMatchUserId(match.user.id);
      try {
        setLiveEventCount(0);
        setLiveMatchBanner(null);
        const chatId = match.chatId ?? (await getOrCreateDirectChat(match.user.id));
        router.push(`/chat?chatId=${encodeURIComponent(chatId)}`);
      } catch {
        setError(t("love.errors.openChatFailed"));
      } finally {
        setBusyMatchUserId(null);
      }
    },
    [currentUserId, router, t],
  );

  if (!setupLoaded) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-rose-50 via-white to-amber-50">
        <section className="mx-auto max-w-3xl px-4 py-10">
          <div className="rounded-2xl border border-neutral-200 bg-white p-6 text-sm text-neutral-600 shadow-sm">
            {t("love.loadingSetup")}
          </div>
        </section>
      </main>
    );
  }

  if (!accessReady || editorOpen) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-rose-50 via-white to-amber-50">
        <section className="mx-auto max-w-3xl px-4 py-10">
          <h1 className="text-3xl font-semibold tracking-tight text-neutral-900">{t("love.onboardingTitle")}</h1>
          <p className="mt-2 text-sm text-neutral-600">{t("love.onboardingDescription")}</p>

          {error ? <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
          {status ? (
            <div className="mt-4 flex items-start justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              <span>{status}</span>
              <button
                type="button"
                onClick={() => setStatus(null)}
                className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-emerald-800 bg-emerald-700 text-white transition hover:bg-emerald-800"
                aria-label={t("love.closeStatusAria")}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : null}

          <div className="mt-6 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
            <div className="mb-5 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500">
              <span className={settingsStep === 1 ? "text-rose-600" : ""}>{t("love.steps.profilePhotos")}</span>
              <span>•</span>
              <span className={settingsStep === 2 ? "text-rose-600" : ""}>{t("love.steps.preferences")}</span>
            </div>

            {settingsStep === 1 ? (
              <div className="space-y-4">
                <label className="block space-y-1">
                  <span className="text-sm font-semibold text-neutral-800">{t("love.form.name")}</span>
                  <input
                    value={setupProfile.displayName}
                    onChange={(e) => setSetupProfile((prev) => ({ ...prev, displayName: e.target.value }))}
                    className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-rose-300"
                    placeholder={t("love.form.namePlaceholder")}
                  />
                </label>

                <label className="block space-y-1">
                  <span className="text-sm font-semibold text-neutral-800">{t("love.form.age")}</span>
                  <select
                    value={setupSettings.age ?? ""}
                    onChange={(e) =>
                      setSetupSettings((prev) => ({
                        ...prev,
                        age: e.target.value ? Number(e.target.value) : null,
                      }))
                    }
                    className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-rose-300"
                  >
                    <option value="">{t("love.form.selectAge")}</option>
                    {AGE_OPTIONS.map((ageValue) => (
                      <option key={ageValue} value={ageValue}>
                        {ageValue}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block space-y-1">
                  <span className="text-sm font-semibold text-neutral-800">{t("love.form.bio")}</span>
                  <textarea
                    value={setupProfile.bio}
                    onChange={(e) => setSetupProfile((prev) => ({ ...prev, bio: e.target.value.slice(0, 220) }))}
                    className="min-h-24 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-rose-300"
                    placeholder={t("love.form.bioPlaceholder")}
                  />
                </label>

                <div className="space-y-2">
                  <p className="text-sm font-semibold text-neutral-800">{t("love.form.photoPreview")}</p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {[0, 1, 2, 3].map((idx) => {
                      const src = setupPhotoPreviews[idx] || setupPhotos[idx] || null;
                      return src ? (
                        <div key={idx} className="relative">
                          <img src={src} alt={t("love.form.photoAlt", { index: idx + 1 })} className="h-40 w-full rounded-xl object-cover" />
                          <button
                            type="button"
                            onClick={() => {
                              setSetupPhotos((prev) => prev.map((item, i) => (i === idx ? "" : item)));
                              setSetupPhotoFiles((prev) => prev.map((item, i) => (i === idx ? null : item)));
                              setSetupPhotoPreviews((prev) =>
                                prev.map((item, i) => {
                                  if (i !== idx) return item;
                                  if (item.startsWith("blob:")) URL.revokeObjectURL(item);
                                  return "";
                                }),
                              );
                            }}
                            className="absolute right-1 top-1 inline-flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white transition hover:bg-black/75"
                            aria-label={t("love.form.deletePhotoAria", { index: idx + 1 })}
                            title={t("love.form.deletePhotoTitle")}
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <label
                          key={idx}
                          htmlFor={`setup-photo-input-${idx}`}
                          className="flex h-40 w-full cursor-pointer items-center justify-center rounded-xl border border-dashed border-neutral-200 text-xs text-neutral-400 transition hover:border-neutral-300 hover:text-neutral-500"
                        >
                          <input
                            id={`setup-photo-input-${idx}`}
                            type="file"
                            accept="image/*"
                            className="sr-only"
                            onChange={(e) => {
                              const nextFile = e.target.files?.[0] ?? null;
                              if (!nextFile) return;

                              setSetupPhotoFiles((prev) =>
                                prev.map((item, fileIndex) => (fileIndex === idx ? nextFile : item)),
                              );

                              setSetupPhotoPreviews((prev) =>
                                prev.map((item, previewIndex) => {
                                  if (previewIndex !== idx) return item;
                                  if (item.startsWith("blob:")) URL.revokeObjectURL(item);
                                  return URL.createObjectURL(nextFile);
                                }),
                              );
                            }}
                          />
                          <span>{t("love.form.choosePhoto", { index: idx + 1 })}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => void saveSetup(false)}
                    disabled={savingSetup}
                    className="rounded-full bg-neutral-900 px-5 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800 disabled:opacity-50"
                  >
                    {savingSetup ? t("love.form.saving") : t("love.form.saveContinue")}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-semibold text-neutral-800">{t("love.form.identityTitle")}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {[
                      { id: "woman", label: t("love.gender.woman") },
                      { id: "man", label: t("love.gender.man") },
                      { id: "nonbinary", label: t("love.gender.nonbinary") },
                    ].map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setSetupSettings((prev) => ({ ...prev, genderIdentity: option.id as LoveSettings["genderIdentity"] }))}
                        className={`rounded-full border px-3 py-1 text-sm ${
                          setupSettings.genderIdentity === option.id
                            ? "border-rose-300 bg-rose-50 text-rose-700"
                            : "border-neutral-200 bg-white text-neutral-700"
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-sm font-semibold text-neutral-800">{t("love.form.lookingForTitle")}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {[
                      { id: "any", label: t("love.lookingFor.any") },
                      { id: "woman", label: t("love.lookingFor.women") },
                      { id: "man", label: t("love.lookingFor.men") },
                      { id: "nonbinary", label: t("love.lookingFor.nonbinary") },
                    ].map((option) => {
                      const active = setupSettings.lookingFor.includes(option.id as LoveSettings["lookingFor"][number]);
                      return (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => {
                            setSetupSettings((prev) => {
                              const id = option.id as LoveSettings["lookingFor"][number];
                              if (id === "any") {
                                return { ...prev, lookingFor: ["any"] };
                              }
                              const next = prev.lookingFor.filter((item) => item !== "any");
                              const toggled = next.includes(id) ? next.filter((item) => item !== id) : [...next, id];
                              return { ...prev, lookingFor: toggled.length ? toggled : ["any"] };
                            });
                          }}
                          className={`rounded-full border px-3 py-1 text-sm ${
                            active ? "border-rose-300 bg-rose-50 text-rose-700" : "border-neutral-200 bg-white text-neutral-700"
                          }`}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <p className="text-sm font-semibold text-neutral-800">{t("love.form.goalTitle")}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {RELATIONSHIP_GOAL_OPTIONS.map((option) => {
                      const active = setupSettings.relationshipGoal === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setSetupSettings((prev) => ({ ...prev, relationshipGoal: option.value }))}
                          className={`rounded-full border px-3 py-1 text-sm ${
                            active ? "border-rose-300 bg-rose-50 text-rose-700" : "border-neutral-200 bg-white text-neutral-700"
                          }`}
                        >
                          {t(option.labelKey)}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <label className="space-y-1">
                    <span className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500">{t("love.form.ageFrom")}</span>
                    <select
                      value={setupSettings.ageMin}
                      onChange={(e) =>
                        setSetupSettings((prev) => {
                          const nextAgeMin = Number(e.target.value || 18);
                          const nextAgeMax = Math.max(nextAgeMin, prev.ageMax);
                          return { ...prev, ageMin: nextAgeMin, ageMax: nextAgeMax };
                        })
                      }
                      className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-rose-300"
                    >
                      {AGE_OPTIONS.map((ageValue) => (
                        <option key={ageValue} value={ageValue}>
                          {ageValue}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500">{t("love.form.ageTo")}</span>
                    <select
                      value={setupSettings.ageMax}
                      onChange={(e) =>
                        setSetupSettings((prev) => {
                          const nextAgeMax = Number(e.target.value || 35);
                          const nextAgeMin = Math.min(prev.ageMin, nextAgeMax);
                          return { ...prev, ageMin: nextAgeMin, ageMax: nextAgeMax };
                        })
                      }
                      className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-rose-300"
                    >
                      {AGE_OPTIONS.map((ageValue) => (
                        <option key={ageValue} value={ageValue}>
                          {ageValue}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500">{t("love.form.maxKm")}</span>
                    <select
                      value={setupSettings.maxDistanceKm}
                      onChange={(e) => setSetupSettings((prev) => ({ ...prev, maxDistanceKm: Number(e.target.value || 30) }))}
                      className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-rose-300"
                    >
                      {DISTANCE_OPTIONS.map((distance) => (
                        <option key={distance} value={distance}>
                          {distance === 500 ? "50+ km" : `${distance} km`}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <label className="flex items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-800">
                  <span className="pr-3">{t("love.form.enableProfile")}</span>
                  <span className="relative inline-flex h-8 w-14 shrink-0">
                    <input
                      type="checkbox"
                      className="peer sr-only"
                      checked={setupSettings.enabled}
                      onChange={(e) => setSetupSettings((prev) => ({ ...prev, enabled: e.target.checked }))}
                    />
                    <span className="absolute inset-0 rounded-full border border-white/40 bg-slate-700 transition-colors peer-checked:border-white peer-checked:bg-white" />
                    <span className="absolute left-1 top-1 h-6 w-6 rounded-full bg-white shadow-sm transition-transform duration-200 peer-checked:translate-x-6 peer-checked:bg-neutral-900" />
                  </span>
                </label>

                <label className="flex items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-800">
                  <span className="pr-3">{t("love.form.enableLocation")}</span>
                  <span className="relative inline-flex h-8 w-14 shrink-0">
                    <input
                      type="checkbox"
                      className="peer sr-only"
                      checked={setupSettings.locationSharingEnabled}
                      onChange={(e) =>
                        setSetupSettings((prev) => ({
                          ...prev,
                          locationSharingEnabled: e.target.checked,
                          locationRequiredAck: !e.target.checked ? true : false,
                        }))
                      }
                    />
                    <span className="absolute inset-0 rounded-full border border-white/40 bg-slate-700 transition-colors peer-checked:border-white peer-checked:bg-white" />
                    <span className="absolute left-1 top-1 h-6 w-6 rounded-full bg-white shadow-sm transition-transform duration-200 peer-checked:translate-x-6 peer-checked:bg-neutral-900" />
                  </span>
                </label>

                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setSettingsStep(1)}
                    className="rounded-full border border-neutral-200 px-4 py-2 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50"
                  >
                    {t("common.actions.back")}
                  </button>
                  <button
                    type="button"
                    onClick={() => void saveSetup(true)}
                    disabled={savingSetup}
                    className="rounded-full bg-neutral-900 px-5 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800 disabled:opacity-50"
                  >
                    {savingSetup ? t("love.form.saving") : accessReady ? t("love.form.saveProfile") : t("love.form.finishOnboarding")}
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-[calc(100dvh-80px)] overflow-x-hidden overflow-y-auto overscroll-none bg-gradient-to-b from-rose-50 via-white to-amber-50 pb-[calc(env(safe-area-inset-bottom)+104px)] lg:h-screen lg:overflow-hidden lg:pb-0">
      <section className="mx-auto flex min-h-full max-w-6xl min-h-0 flex-col px-4 py-6 lg:h-full lg:px-8 lg:py-14 xl:px-10">
        <header className="flex flex-col gap-2">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-neutral-900">nLove</h1>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setEditorOpen(true);
                  setSettingsStep(1);
                }}
                className="max-w-[9.5rem] rounded-full border border-neutral-200 bg-white px-3 py-2 text-[11px] font-semibold leading-tight text-neutral-700 transition hover:bg-neutral-50 sm:max-w-none sm:px-4 sm:text-xs"
              >
                {t("love.editProfile")}
              </button>
              <button
                type="button"
                onClick={() => setMobileMatchesOpen(true)}
                className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-700 transition hover:bg-neutral-50 lg:hidden"
                aria-label={t("love.openMatchesAria")}
              >
                <Inbox className="h-5 w-5" />
                {liveEventCount > 0 ? (
                  <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-fuchsia-500 px-1 text-[10px] font-semibold text-white">
                    {liveEventCount > 9 ? "9+" : liveEventCount}
                  </span>
                ) : null}
              </button>
            </div>
          </div>
        </header>

        <div className="mt-6 grid flex-1 min-h-0 gap-6 lg:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-4 min-h-0 overflow-visible lg:overflow-y-auto lg:pr-2">
            {error ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {error}
                {error === t("love.errors.signInRequired") ? (
                  <span className="ml-1">
                    <Link href="/auth/login" className="font-semibold underline">
                      {t("common.actions.signIn")}
                    </Link>
                  </span>
                ) : null}
              </div>
            ) : null}

            {status ? (
              <div className="flex items-start justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                <span>{status}</span>
                <button
                type="button"
                onClick={() => setStatus(null)}
                className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-emerald-800 bg-emerald-700 text-white transition hover:bg-emerald-800"
                aria-label={t("love.closeStatusAria")}
              >
                <X className="h-3.5 w-3.5" />
              </button>
              </div>
            ) : null}
            {liveMatchBanner ? (
              <div className="rounded-2xl border border-fuchsia-200 bg-fuchsia-50 px-4 py-3 text-sm text-fuchsia-800">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    {t("love.liveMatchPrefix")}{" "}
                    <span className="font-semibold">
                      {liveMatchBanner.user.displayName ?? liveMatchBanner.user.username ?? t("love.liveMatchFallback")}
                    </span>
                    .
                  </div>
                  <button
                    type="button"
                    onClick={() => setLiveMatchBanner(null)}
                    className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/80 text-fuchsia-700 transition hover:bg-white"
                    aria-label={t("love.closeNoticeAria")}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-xs text-fuchsia-700/80">{t("love.liveMatchPrompt")}</span>
                  <button
                    type="button"
                    onClick={() => void openMatchChat(liveMatchBanner)}
                    className="rounded-full border border-fuchsia-300 bg-white px-3 py-1 text-xs font-semibold text-fuchsia-700 transition hover:bg-fuchsia-100"
                  >
                    {t("love.openChat")}
                  </button>
                </div>
              </div>
            ) : null}

            <CardStack loading={loading} activeCard={activeCard} queue={queue} />
            <SwipeControls
              onAction={handleSwipe}
              disabled={!activeCard || swipeBusy || loading || !locationStatus.fresh}
            />
          </div>

          <aside className="hidden space-y-3 lg:block lg:sticky lg:top-10 lg:h-full lg:min-h-0 lg:overflow-y-auto lg:pr-1">
            <Widget title={t("love.widgets.matches")} badgeCount={liveEventCount}>
              <MatchList matches={matches} busyUserId={busyMatchUserId} onOpenChat={openMatchChat} />
            </Widget>
            <Widget title={t("love.widgets.feedStatus")}>
              <FeedStatus remaining={cards.length} loading={loading} />
            </Widget>
            <Widget title={t("love.widgets.safeSwipe")}>
              <SafetyWidget />
            </Widget>
          </aside>
        </div>
      </section>
      {mobileMatchesOpen ? (
        <div className="fixed inset-0 z-50 bg-black/40 lg:hidden" onClick={() => setMobileMatchesOpen(false)}>
          <div
            className="absolute inset-x-0 bottom-0 max-h-[72vh] rounded-t-3xl border border-neutral-200 bg-white p-4 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-neutral-900">{t("love.widgets.matches")}</h3>
              <button
                type="button"
                onClick={() => setMobileMatchesOpen(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-neutral-200 text-neutral-700"
                aria-label={t("love.closeMatchesAria")}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="max-h-[58vh] overflow-y-auto">
              <MatchList matches={matches} busyUserId={busyMatchUserId} onOpenChat={openMatchChat} />
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function CardStack({
  loading,
  activeCard,
  queue,
}: {
  loading: boolean;
  activeCard: LoveCard | null;
  queue: LoveCard[];
}) {
  const t = useTranslations();
  if (loading) {
    return (
      <div className="relative mx-auto aspect-[3/4] w-full max-w-[430px] rounded-3xl border border-neutral-200 bg-white/70 p-3 text-sm text-neutral-500 shadow-[0_14px_50px_-24px_rgba(0,0,0,0.4)] ring-1 ring-neutral-200/80">
        <div className="flex h-full items-center justify-center rounded-2xl border border-neutral-100 bg-gradient-to-b from-white to-neutral-50">
          {t("love.loadingFeed")}
        </div>
      </div>
    );
  }

  const cards = activeCard ? [activeCard, ...queue] : [];

  return (
    <div className="relative mx-auto aspect-[3/4] w-full max-w-[430px] rounded-3xl bg-white/70 p-3 shadow-[0_14px_50px_-24px_rgba(0,0,0,0.4)] ring-1 ring-neutral-200/80">
      {!cards.length ? (
        <div className="flex h-full items-center justify-center px-6 text-center text-sm text-neutral-500">
          {t("love.emptyFeed")}
        </div>
      ) : null}

      {cards.map((card, idx) => {
        const scale = 1 - idx * 0.04;
        const translateY = idx * 10;
        const name = labelForProfile(card, t("love.userFallback"));
        const age = ageForProfile(card);
        const mainPhoto = card.photos?.find((photo) => Boolean(photo?.trim())) ?? card.avatarUrl ?? null;

        return (
          <article
            key={card.id}
            style={{
              zIndex: cards.length - idx,
              transform: `translateY(${translateY}px) scale(${scale})`,
              boxShadow: idx === 0 ? "0 18px 38px -22px rgba(0,0,0,0.35)" : undefined,
            }}
            className="absolute inset-3 rounded-2xl bg-gradient-to-br from-rose-300 via-red-200 to-amber-200 transition-transform duration-300"
            aria-label={t("love.profileAria", { name })}
          >
            {mainPhoto ? (
              <img
                src={mainPhoto}
                alt={name}
                className="absolute inset-0 h-full w-full rounded-2xl object-cover"
                loading="lazy"
              />
            ) : null}
            <div className="absolute inset-0 rounded-2xl bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.35),transparent_45%),radial-gradient(circle_at_75%_70%,rgba(255,255,255,0.25),transparent_45%)] mix-blend-screen" />
            <div className="relative flex h-full flex-col justify-between rounded-2xl border border-white/50 bg-gradient-to-b from-black/15 via-black/5 to-black/55 p-6 text-white shadow-inner">
              <div className="flex items-center justify-between">
                <div className="rounded-full bg-white/30 px-3 py-1 text-xs font-semibold backdrop-blur">
                  {card.verified ? t("love.verifiedBadge") : t("love.defaultBadge")}
                </div>
                <span className="rounded-full bg-black/30 px-3 py-1 text-[11px] font-semibold backdrop-blur">
                  {card.distanceKm} km
                </span>
              </div>
              {card.priorityType === "superlike" ? (
                <div className="mt-3 inline-flex w-fit items-center rounded-full bg-fuchsia-500/85 px-3 py-1 text-xs font-semibold text-white">
                  {t("love.priorityBadge")}
                </div>
              ) : null}

              <div className="space-y-3">
                <div>
                  <h2 className="text-3xl font-semibold leading-tight drop-shadow-sm">
                    {name}
                    {age ? `, ${age}` : ""}
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed text-white/90 drop-shadow-sm">
                    {card.bio?.trim() || t("love.noBio")}
                  </p>
                </div>

                <div className="flex items-center justify-between rounded-xl bg-white/15 px-3 py-3 text-sm backdrop-blur">
                  <div className="flex items-center gap-2 text-white">
                    <Sparkles className="h-4 w-4" />
                    <span>{t("love.possibleMatchNearby")}</span>
                  </div>
                  <div className="flex items-center gap-2 text-white/90">
                    <MapPin className="h-4 w-4" />
                    <span className="text-xs font-semibold">{card.distanceKm} km</span>
                  </div>
                </div>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function SwipeControls({
  onAction,
  disabled,
}: {
  onAction: (dir: SwipeAction) => void;
  disabled: boolean;
}) {
  const t = useTranslations();
  return (
    <div className="mt-4 flex justify-center lg:mt-0">
      <div className="flex items-start justify-center gap-4 rounded-[30px] border border-neutral-200 bg-white/92 px-5 py-4 shadow-[0_20px_45px_-28px_rgba(0,0,0,0.45)] backdrop-blur lg:w-full lg:justify-center lg:rounded-2xl lg:px-4 lg:py-3 lg:shadow-sm">
        <button
          onClick={() => onAction("pass")}
          disabled={disabled}
          className="group flex w-[86px] flex-col items-center gap-2 text-rose-500 transition disabled:cursor-not-allowed disabled:opacity-40"
          aria-label={t("love.dislikeAria")}
        >
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white ring-1 ring-rose-100 transition group-hover:-translate-y-[2px] group-hover:bg-rose-50 group-hover:ring-rose-200">
            <X className="h-7 w-7" />
          </span>
          <span className="text-[11px] font-semibold leading-none">{t("love.actions.pass")}</span>
        </button>
        <button
          onClick={() => onAction("superlike")}
          disabled={disabled}
          className="group flex w-[86px] flex-col items-center gap-2 text-sky-500 transition disabled:cursor-not-allowed disabled:opacity-40"
          aria-label={t("love.superlikeAria")}
        >
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white ring-1 ring-sky-100 transition group-hover:-translate-y-[2px] group-hover:bg-sky-50 group-hover:ring-sky-200">
            <Star className="h-7 w-7" />
          </span>
          <span className="text-[11px] font-semibold leading-none">{t("love.actions.superlike")}</span>
        </button>
        <button
          onClick={() => onAction("like")}
          disabled={disabled}
          className="group flex w-[86px] flex-col items-center gap-2 text-emerald-500 transition disabled:cursor-not-allowed disabled:opacity-40"
          aria-label={t("love.likeAria")}
        >
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white ring-1 ring-emerald-100 transition group-hover:-translate-y-[2px] group-hover:bg-emerald-50 group-hover:ring-emerald-200">
            <Heart className="h-7 w-7" />
          </span>
          <span className="text-[11px] font-semibold leading-none">{t("love.actions.like")}</span>
        </button>
      </div>
    </div>
  );
}

function Widget({ title, children, badgeCount = 0 }: { title: string; children: ReactNode; badgeCount?: number }) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white/90 p-4 shadow-sm backdrop-blur">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-neutral-900">{title}</h3>
          {badgeCount > 0 ? (
            <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-fuchsia-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">
              {badgeCount > 99 ? "99+" : badgeCount}
            </span>
          ) : null}
        </div>
        <span className="text-[11px] uppercase tracking-[0.14em] text-neutral-400">nLove</span>
      </div>
      {children}
    </div>
  );
}

function MatchList({
  matches,
  busyUserId,
  onOpenChat,
}: {
  matches: LoveMatch[];
  busyUserId: string | null;
  onOpenChat: (match: LoveMatch) => void;
}) {
  const t = useTranslations();
  return (
    <div className="space-y-2 text-sm text-neutral-700">
      {!matches.length ? <p className="text-xs text-neutral-500">{t("love.noMatch")}</p> : null}
      {matches.map((item) => {
        const name = item.user.displayName?.trim() || item.user.username?.trim() || t("love.userFallback");
        const age =
          typeof item.user.age === "number" && Number.isFinite(item.user.age) ? Math.floor(item.user.age) : null;
        const handle = item.user.username?.trim() ? `@${item.user.username.trim()}` : t("love.noUsername");
        const busy = busyUserId === item.user.id;
        const distance = typeof item.distanceKm === "number" ? `${item.distanceKm.toFixed(1)} km` : "—";

        return (
          <div
            key={item.id}
            className="flex items-center justify-between rounded-xl border border-neutral-100 bg-neutral-50 px-3 py-2"
          >
            <div className="flex min-w-0 items-center gap-3">
              {item.user.avatarUrl ? (
                <img src={item.user.avatarUrl} alt={name} className="h-10 w-10 rounded-full object-cover ring-2 ring-white" />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-100 text-xs font-semibold text-rose-700 ring-2 ring-white">
                  {initialForName(name)}
                </div>
              )}
              <div className="min-w-0">
                <div className="truncate font-semibold text-neutral-900">
                  {name}
                  {age ? `, ${age}` : ""}
                </div>
                <div className="truncate text-[11px] text-neutral-500">
                  {handle} · {distance}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onOpenChat(item)}
              disabled={busy}
              className="inline-flex items-center gap-1 rounded-full border border-neutral-200 px-3 py-1 text-xs font-semibold text-neutral-900 transition hover:bg-neutral-900 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              <MessageCircle className="h-3.5 w-3.5" />
              {busy ? t("love.loadingAction") : t("love.write")}
            </button>
          </div>
        );
      })}
    </div>
  );
}

function FeedStatus({ remaining, loading }: { remaining: number; loading: boolean }) {
  const t = useTranslations();
  if (loading) {
    return <p className="text-sm text-neutral-500">{t("love.loadingFeedStatus")}</p>;
  }
  return (
    <div className="space-y-2 text-sm text-neutral-700">
      <div className="flex items-center justify-between rounded-lg border border-neutral-100 bg-neutral-50 px-3 py-2">
        <span>{t("love.queueCards")}</span>
        <span className="text-xs font-semibold text-neutral-600">{remaining}</span>
      </div>
    </div>
  );
}

function SafetyWidget() {
  const t = useTranslations();
  const tips = [
    t("love.safety.tip1"),
    t("love.safety.tip2"),
    t("love.safety.tip3"),
  ];

  return (
    <div className="space-y-2 text-sm text-neutral-700">
      {tips.map((tip, idx) => (
        <div key={tip} className="flex items-center gap-2 rounded-lg border border-neutral-100 bg-neutral-50 px-3 py-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-rose-50 text-[11px] font-semibold text-rose-500">
            {idx + 1}
          </span>
          <span className="text-neutral-800">{tip}</span>
        </div>
      ))}
    </div>
  );
}
