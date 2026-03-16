import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  computeDistanceKm,
  getLoveLocation,
  getLoveLocations,
  getLoveSettings,
  isLocationFresh,
  isLoveEnabled,
  isMissingLoveSchema,
  normalizePhotos,
  preferenceAllows,
  type LoveSettingsRow,
} from "@/lib/love-access";

type LoveProfileRow = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  banned_at: string | null;
  verified?: boolean | null;
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

  const [{ data: viewerSettings, error: viewerSettingsError }, { data: viewerLocation, error: viewerLocationError }] =
    await Promise.all([getLoveSettings(user.id), getLoveLocation(user.id)]);

  if (viewerSettingsError || viewerLocationError) {
    const sourceError = viewerSettingsError ?? viewerLocationError;
    if (isMissingLoveSchema(sourceError)) {
      return NextResponse.json(
        { error: "love_not_configured", message: "nLove tables have not been created yet." },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: "viewer_fetch_failed", message: sourceError?.message }, { status: 400 });
  }

  if (!isLoveEnabled(viewerSettings)) {
    return NextResponse.json(
      {
        error: "love_not_enabled",
        message: "Finish nLove onboarding and enable your profile first.",
      },
      { status: 403 },
    );
  }

  if (!viewerLocation || !isLocationFresh(viewerLocation)) {
    return NextResponse.json(
      {
        error: "location_required",
        message: "A fresh location for nLove swipe could not be obtained. Try refreshing it.",
      },
      { status: 403 },
    );
  }

  const { data: swipes, error: swipesError } = await supabaseAdmin
    .from("nlove_swipes")
    .select("target_id")
    .eq("swiper_id", user.id)
    .limit(500);

  if (swipesError) {
    if (isMissingLoveSchema(swipesError)) {
      return NextResponse.json(
        { error: "love_not_configured", message: "nLove tables have not been created yet." },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: "swipes_fetch_failed", message: swipesError.message }, { status: 400 });
  }

  const seen = new Set((swipes ?? []).map((row) => row.target_id).filter(Boolean));

  const { data: candidateSettingsRows, error: candidateSettingsError } = await supabaseAdmin
    .from("nlove_profiles")
    .select(
      "user_id, enabled, onboarding_completed, location_sharing_enabled, location_required_ack, age, gender_identity, looking_for, age_min, age_max, max_distance_km, photos",
    )
    .eq("enabled", true)
    .eq("onboarding_completed", true)
    .neq("user_id", user.id)
    .limit(400);

  if (candidateSettingsError) {
    if (isMissingLoveSchema(candidateSettingsError)) {
      return NextResponse.json(
        { error: "love_not_configured", message: "nLove tables have not been created yet." },
        { status: 503 },
      );
    }
    return NextResponse.json(
      { error: "candidate_settings_fetch_failed", message: candidateSettingsError.message },
      { status: 400 },
    );
  }

  const candidateSettings = ((candidateSettingsRows ?? []) as LoveSettingsRow[]).filter((row) => !seen.has(row.user_id));
  const candidateIds = candidateSettings.map((row) => row.user_id);

  if (!candidateIds.length) {
    return NextResponse.json({ cards: [] }, { status: 200 });
  }

  const [{ data: profiles, error: profilesError }, { data: locations, error: locationsError }] = await Promise.all([
    supabaseAdmin
      .from("profiles")
      .select("id, username, display_name, avatar_url, bio, banned_at, verified")
      .in("id", candidateIds)
      .is("banned_at", null)
      .limit(300),
    getLoveLocations(candidateIds),
  ]);

  const { data: superlikeRows } = await supabaseAdmin
    .from("nlove_swipes")
    .select("swiper_id")
    .eq("target_id", user.id)
    .eq("action", "superlike")
    .in("swiper_id", candidateIds);

  if (profilesError || locationsError) {
    const sourceError = profilesError ?? locationsError;
    return NextResponse.json({ error: "candidate_fetch_failed", message: sourceError?.message }, { status: 400 });
  }

  const profilesById = new Map(((profiles ?? []) as LoveProfileRow[]).map((item) => [item.id, item]));
  const locationsById = new Map((locations ?? []).map((item) => [item.user_id, item]));
  const prioritySuperlikeIds = new Set((superlikeRows ?? []).map((row) => row.swiper_id).filter(Boolean));

  const cards = candidateSettings
    .map((candidate) => {
      const profile = profilesById.get(candidate.user_id);
      const location = locationsById.get(candidate.user_id);
      if (!profile || !location || !isLocationFresh(location)) return null;

      const viewerToCandidate = preferenceAllows(viewerSettings?.looking_for ?? [], candidate.gender_identity);
      const candidateToViewer = preferenceAllows(candidate.looking_for ?? [], viewerSettings?.gender_identity ?? null);
      if (!viewerToCandidate || !candidateToViewer) return null;

      const distanceKmRaw = computeDistanceKm(viewerLocation, location);
      const distanceKm = Math.round(distanceKmRaw * 10) / 10;

      if (distanceKm > (viewerSettings?.max_distance_km ?? 30)) return null;
      if (distanceKm > (candidate.max_distance_km ?? 30)) return null;

      const photoUrls = normalizePhotos(candidate.photos);
      const primaryPhoto = photoUrls[0] ?? profile.avatar_url ?? null;

      return {
        id: profile.id,
        username: profile.username,
        displayName: profile.display_name,
        age: typeof candidate.age === "number" ? candidate.age : null,
        priorityType: prioritySuperlikeIds.has(profile.id) ? "superlike" : null,
        avatarUrl: primaryPhoto,
        photos: photoUrls,
        bio: profile.bio,
        verified: Boolean(profile.verified),
        distanceKm,
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .sort((a, b) => {
      const aPriority = a.priorityType === "superlike" ? 1 : 0;
      const bPriority = b.priorityType === "superlike" ? 1 : 0;
      if (aPriority !== bPriority) return bPriority - aPriority;
      return a.distanceKm - b.distanceKm;
    })
    .slice(0, 40);

  return NextResponse.json({ cards }, { status: 200 });
}
