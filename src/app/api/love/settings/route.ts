import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { containsBlockedContent, containsBlockedIdentityContent } from "@/lib/content-filter";
import { LOVE_LOCATION_TTL_MS } from "@/lib/love-location";
import {
  getLoveLocation,
  getLoveSettings,
  isLocationFresh,
  isMissingLoveSchema,
  normalizeLookingFor,
  normalizePhotos,
} from "@/lib/love-access";

type LoveSettingsPayload = {
  enabled?: boolean;
  onboardingCompleted?: boolean;
  locationSharingEnabled?: boolean;
  locationRequiredAck?: boolean;
  displayName?: string | null;
  bio?: string | null;
  avatarUrl?: string | null;
  photos?: string[];
  genderIdentity?: string | null;
  lookingFor?: string[];
  ageMin?: number;
  ageMax?: number;
  maxDistanceKm?: number;
  age?: number | null;
  relationshipGoal?: string | null;
};

const DEFAULT_SETTINGS = {
  enabled: false,
  onboardingCompleted: false,
  genderIdentity: null as string | null,
  lookingFor: [] as string[],
  ageMin: 18,
  ageMax: 99,
  maxDistanceKm: 30,
  locationSharingEnabled: true,
  locationRequiredAck: false,
  superlikeCredits: 0,
  age: null as number | null,
  relationshipGoal: null as string | null,
  photos: [] as string[],
};

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const [{ data: profile, error: profileError }, { data: settings, error: settingsError }, { data: location, error: locationError }] = await Promise.all([
    supabaseAdmin.from("profiles").select("id, username, display_name, avatar_url, bio").eq("id", user.id).maybeSingle(),
    getLoveSettings(user.id),
    getLoveLocation(user.id),
  ]);

  if (profileError) {
    return NextResponse.json({ error: "profile_fetch_failed", message: profileError.message }, { status: 400 });
  }
  if (!profile) {
    return NextResponse.json({ error: "profile_not_found" }, { status: 404 });
  }

  if (settingsError) {
    if (isMissingLoveSchema(settingsError)) {
      return NextResponse.json(
        { error: "love_not_configured", message: "nLove tables have not been created yet." },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: "settings_fetch_failed", message: settingsError.message }, { status: 400 });
  }
  if (locationError) {
    if (isMissingLoveSchema(locationError)) {
      return NextResponse.json(
        { error: "love_not_configured", message: "nLove tables have not been created yet." },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: "location_fetch_failed", message: locationError.message }, { status: 400 });
  }

  const normalized = settings
    ? {
        enabled: Boolean(settings.enabled),
        onboardingCompleted: Boolean(settings.onboarding_completed),
        genderIdentity: settings.gender_identity ?? null,
        lookingFor: normalizeLookingFor(settings.looking_for ?? []),
        ageMin: settings.age_min,
        ageMax: settings.age_max,
        maxDistanceKm: settings.max_distance_km,
        locationSharingEnabled: settings.location_sharing_enabled !== false,
        locationRequiredAck: Boolean(settings.location_required_ack),
        superlikeCredits: Number(settings.superlike_credits ?? 0),
        age: typeof settings.age === "number" ? settings.age : null,
        relationshipGoal:
          typeof settings.relationship_goal === "string" && settings.relationship_goal.trim()
            ? settings.relationship_goal
            : null,
        photos: normalizePhotos(settings.photos),
      }
    : DEFAULT_SETTINGS;

  return NextResponse.json(
    {
      profile: {
        id: profile.id,
        username: profile.username,
        displayName: profile.display_name,
        avatarUrl: profile.avatar_url,
        bio: profile.bio,
      },
      settings: normalized,
      ready: Boolean(normalized.enabled && normalized.onboardingCompleted),
      locationStatus: {
        available: Boolean(location),
        fresh: isLocationFresh(location),
        capturedAt: location?.captured_at ?? null,
        updatedAt: location?.updated_at ?? null,
        ttlMs: LOVE_LOCATION_TTL_MS,
      },
    },
    { status: 200 },
  );
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as LoveSettingsPayload | null;
  if (!body) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  const displayName = (body.displayName ?? "").trim();
  const bio = (body.bio ?? "").trim();
  const avatarUrl = (body.avatarUrl ?? "").trim() || null;

  if (displayName && containsBlockedIdentityContent(displayName).hit) {
    return NextResponse.json({ error: "invalid_display_name" }, { status: 400 });
  }
  if (bio && containsBlockedContent(bio).hit) {
    return NextResponse.json({ error: "invalid_bio" }, { status: 400 });
  }

  const photos = normalizePhotos(body.photos ?? []);
  const genderIdentity = (body.genderIdentity ?? "").trim().toLowerCase() || null;
  const allowedGender = new Set(["woman", "man", "nonbinary"]);
  if (genderIdentity && !allowedGender.has(genderIdentity)) {
    return NextResponse.json({ error: "invalid_gender_identity" }, { status: 400 });
  }

  const lookingFor = normalizeLookingFor(body.lookingFor ?? []);
  const ageMinRaw = typeof body.ageMin === "number" ? Math.floor(body.ageMin) : 18;
  const ageMaxRaw = typeof body.ageMax === "number" ? Math.floor(body.ageMax) : 99;
  const maxDistanceRaw = typeof body.maxDistanceKm === "number" ? Math.floor(body.maxDistanceKm) : 30;
  const ownAgeRaw = typeof body.age === "number" ? Math.floor(body.age) : null;

  const ageMin = Math.max(18, Math.min(99, ageMinRaw));
  const ageMax = Math.max(ageMin, Math.min(99, ageMaxRaw));
  const maxDistanceKm = Math.max(1, Math.min(500, maxDistanceRaw));
  const ownAge = typeof ownAgeRaw === "number" ? Math.max(18, Math.min(99, ownAgeRaw)) : null;
  const relationshipGoalRaw = (body.relationshipGoal ?? "").trim().toLowerCase();
  const allowedRelationshipGoals = new Set([
    "long_term",
    "long_term_open",
    "short_term",
    "new_friends",
    "still_figuring_out",
  ]);
  const relationshipGoal = relationshipGoalRaw && allowedRelationshipGoals.has(relationshipGoalRaw)
    ? relationshipGoalRaw
    : null;

  const onboardingCompleted = Boolean(body.onboardingCompleted);
  const enabledRequested = Boolean(body.enabled);
  const locationSharingEnabled = body.locationSharingEnabled !== false;
  const locationRequiredAck = Boolean(body.locationRequiredAck);
  const enabled = onboardingCompleted ? enabledRequested : false;

  const { error: profileUpdateError } = await supabaseAdmin
    .from("profiles")
    .update({
      display_name: displayName || null,
      bio: bio || null,
      avatar_url: avatarUrl,
    })
    .eq("id", user.id);

  if (profileUpdateError) {
    return NextResponse.json({ error: "profile_update_failed", message: profileUpdateError.message }, { status: 400 });
  }

  const { error: loveSettingsError } = await supabaseAdmin.from("nlove_profiles").upsert(
    {
      user_id: user.id,
      enabled,
      onboarding_completed: onboardingCompleted,
      gender_identity: genderIdentity,
      looking_for: lookingFor,
      age_min: ageMin,
      age_max: ageMax,
      max_distance_km: maxDistanceKm,
      location_sharing_enabled: locationSharingEnabled,
      location_required_ack: locationRequiredAck,
      age: ownAge,
      relationship_goal: relationshipGoal,
      photos,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (loveSettingsError) {
    if (isMissingLoveSchema(loveSettingsError)) {
      return NextResponse.json(
        { error: "love_not_configured", message: "nLove tables have not been created yet." },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: "settings_update_failed", message: loveSettingsError.message }, { status: 400 });
  }

  const { data: creditsRow } = await supabaseAdmin
    .from("nlove_profiles")
    .select("superlike_credits")
    .eq("user_id", user.id)
    .maybeSingle();

  return NextResponse.json(
    {
      settings: {
        enabled,
        onboardingCompleted,
        genderIdentity: genderIdentity,
        lookingFor,
        ageMin,
        ageMax,
        maxDistanceKm,
        locationSharingEnabled,
        locationRequiredAck,
        superlikeCredits: Number(creditsRow?.superlike_credits ?? 0),
        age: ownAge,
        relationshipGoal,
        photos,
      },
      ready: Boolean(enabled && onboardingCompleted),
    },
    { status: 200 },
  );
}
