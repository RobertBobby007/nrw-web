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
} from "@/lib/love-access";

type MatchRow = {
  id: string;
  user_a: string;
  user_b: string;
  created_at: string;
  chat_id: string | null;
};

type ProfileLite = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
};

type CandidateLoveSettings = {
  user_id: string;
  photos: unknown;
  age?: number | null;
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
    return NextResponse.json({ error: "settings_fetch_failed", message: sourceError?.message }, { status: 400 });
  }

  if (!isLoveEnabled(viewerSettings)) {
    return NextResponse.json(
      { error: "love_not_enabled", message: "Finish nLove onboarding and enable your nLove profile first." },
      { status: 403 },
    );
  }

  const { data: matchRows, error: matchError } = await supabaseAdmin
    .from("nlove_matches")
    .select("id, user_a, user_b, created_at, chat_id")
    .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)
    .order("created_at", { ascending: false })
    .limit(40);

  if (matchError) {
    if (isMissingLoveSchema(matchError)) {
      return NextResponse.json(
        { error: "love_not_configured", message: "nLove tables have not been created yet." },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: "matches_fetch_failed", message: matchError.message }, { status: 400 });
  }

  const rows = ((matchRows ?? []) as MatchRow[]).filter((row) => row.user_a && row.user_b);
  const otherUserIds = Array.from(
    new Set(rows.map((row) => (row.user_a === user.id ? row.user_b : row.user_a)).filter(Boolean)),
  );

  if (!otherUserIds.length) {
    return NextResponse.json({ matches: [] }, { status: 200 });
  }

  const [{ data: profiles, error: profileError }, { data: loveSettings, error: loveSettingsError }, { data: locations, error: locationsError }] = await Promise.all([
    supabaseAdmin.from("profiles").select("id, username, display_name, avatar_url").in("id", otherUserIds).is("banned_at", null),
    supabaseAdmin.from("nlove_profiles").select("user_id, photos, age").in("user_id", otherUserIds),
    getLoveLocations(otherUserIds),
  ]);

  if (profileError || loveSettingsError || locationsError) {
    const sourceError = profileError ?? loveSettingsError ?? locationsError;
    if (isMissingLoveSchema(sourceError)) {
      return NextResponse.json(
        { error: "love_not_configured", message: "nLove tables have not been created yet." },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: "matches_related_fetch_failed", message: sourceError?.message }, { status: 400 });
  }

  const profilesById = new Map(((profiles ?? []) as ProfileLite[]).map((item) => [item.id, item]));
  const settingsRows = (loveSettings ?? []) as CandidateLoveSettings[];
  const photosById = new Map<string, string[]>();
  const ageById = new Map<string, number | null>();
  for (const item of settingsRows) {
    photosById.set(item.user_id, normalizePhotos(item.photos));
    ageById.set(item.user_id, typeof item.age === "number" ? item.age : null);
  }
  const locationsById = new Map((locations ?? []).map((item) => [item.user_id, item]));

  const matches = rows
    .map((row) => {
      const otherUserId = row.user_a === user.id ? row.user_b : row.user_a;
      const profile = profilesById.get(otherUserId);
      if (!profile) return null;
      const photos = photosById.get(otherUserId) ?? [];
      const otherLocation = locationsById.get(otherUserId);
      const hasViewerLocation = Boolean(viewerLocation && isLocationFresh(viewerLocation));
      const distanceKm = hasViewerLocation && otherLocation
        ? Math.round(computeDistanceKm(viewerLocation!, otherLocation!) * 10) / 10
        : null;

      return {
        id: row.id,
        createdAt: row.created_at,
        chatId: row.chat_id,
        distanceKm,
        user: {
          id: profile.id,
          username: profile.username,
          displayName: profile.display_name,
          age: ageById.get(otherUserId) ?? null,
          avatarUrl: photos[0] ?? profile.avatar_url,
          photos,
        },
      };
    })
    .filter(Boolean);

  return NextResponse.json({ matches }, { status: 200 });
}
