import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { encodeGeohash, isValidCoordinate, roundCoord } from "@/lib/love-location";
import { getLoveSettings, isLoveEnabled, isMissingLoveSchema } from "@/lib/love-access";

type LocationPayload = {
  latitude?: number;
  longitude?: number;
  accuracyM?: number;
  capturedAt?: string;
  denied?: boolean;
};

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data: settings, error: settingsError } = await getLoveSettings(user.id);
  if (settingsError) {
    if (isMissingLoveSchema(settingsError)) {
      return NextResponse.json(
        { error: "love_not_configured", message: "nLove tables have not been created yet." },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: "settings_fetch_failed", message: settingsError.message }, { status: 400 });
  }

  if (!isLoveEnabled(settings)) {
    return NextResponse.json({ error: "love_not_enabled" }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as LocationPayload | null;
  if (!body) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  if (body.denied) {
    const { error: deniedUpdateError } = await supabaseAdmin
      .from("nlove_profiles")
      .update({ location_required_ack: true })
      .eq("user_id", user.id);

    if (deniedUpdateError) {
      return NextResponse.json(
        { error: "location_flag_update_failed", message: deniedUpdateError.message },
        { status: 400 },
      );
    }

    return NextResponse.json({ ok: true, denied: true }, { status: 200 });
  }

  const latitude = Number(body.latitude);
  const longitude = Number(body.longitude);
  if (!isValidCoordinate(latitude, longitude)) {
    return NextResponse.json({ error: "invalid_coordinates" }, { status: 400 });
  }

  const latApprox = roundCoord(latitude, 3);
  const lngApprox = roundCoord(longitude, 3);
  const geohash = encodeGeohash(latApprox, lngApprox, 6);
  const capturedAt = (() => {
    const parsed = body.capturedAt ? Date.parse(body.capturedAt) : Number.NaN;
    return Number.isFinite(parsed) ? new Date(parsed).toISOString() : new Date().toISOString();
  })();
  const accuracyM = typeof body.accuracyM === "number" && Number.isFinite(body.accuracyM) ? body.accuracyM : null;

  const [{ error: locationError }, { error: profileUpdateError }] = await Promise.all([
    supabaseAdmin.from("nlove_locations").upsert(
      {
        user_id: user.id,
        geohash,
        lat_approx: latApprox,
        lng_approx: lngApprox,
        accuracy_m: accuracyM,
        captured_at: capturedAt,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    ),
    supabaseAdmin
      .from("nlove_profiles")
      .update({ location_required_ack: false, location_sharing_enabled: true })
      .eq("user_id", user.id),
  ]);

  if (locationError) {
    if (isMissingLoveSchema(locationError)) {
      return NextResponse.json(
        { error: "love_not_configured", message: "nLove tables have not been created yet." },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: "location_upsert_failed", message: locationError.message }, { status: 400 });
  }

  if (profileUpdateError) {
    return NextResponse.json(
      { error: "location_ack_update_failed", message: profileUpdateError.message },
      { status: 400 },
    );
  }

  return NextResponse.json(
    {
      ok: true,
      location: {
        geohash,
        latApprox,
        lngApprox,
        accuracyM,
        capturedAt,
      },
    },
    { status: 200 },
  );
}
