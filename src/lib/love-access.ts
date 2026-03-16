import { supabaseAdmin } from "@/lib/supabase-admin";
import { LOVE_LOCATION_TTL_MS, haversineKm, isFreshIsoTimestamp } from "@/lib/love-location";

export type LoveSettingsRow = {
  user_id: string;
  enabled: boolean;
  onboarding_completed: boolean;
  location_sharing_enabled?: boolean | null;
  location_required_ack?: boolean | null;
  superlike_credits?: number | null;
  age?: number | null;
  relationship_goal?: string | null;
  gender_identity: string | null;
  looking_for: string[] | null;
  age_min: number;
  age_max: number;
  max_distance_km: number;
  photos: unknown;
};

export type LoveLocationRow = {
  user_id: string;
  geohash: string;
  lat_approx: number;
  lng_approx: number;
  accuracy_m: number | null;
  captured_at: string;
  updated_at: string;
};

export function isMissingLoveSchema(error: { code?: string | null; message?: string | null } | null | undefined) {
  if (!error) return false;
  if (error.code === "42P01") return true;
  const msg = (error.message ?? "").toLowerCase();
  return msg.includes("nlove_");
}

export function normalizePhotos(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((item) => item.length > 0)
    .slice(0, 6);
}

export function normalizeLookingFor(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const allowed = new Set(["woman", "man", "nonbinary", "any"]);
  const values = input
    .map((item) => (typeof item === "string" ? item.trim().toLowerCase() : ""))
    .filter((item) => allowed.has(item));
  return Array.from(new Set(values));
}

export async function getLoveSettings(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("nlove_profiles")
    .select(
      "user_id, enabled, onboarding_completed, location_sharing_enabled, location_required_ack, superlike_credits, age, relationship_goal, gender_identity, looking_for, age_min, age_max, max_distance_km, photos",
    )
    .eq("user_id", userId)
    .maybeSingle<LoveSettingsRow>();

  return { data, error };
}

export function isLoveEnabled(settings: LoveSettingsRow | null | undefined) {
  return Boolean(settings?.enabled && settings?.onboarding_completed);
}

export function preferenceAllows(lookingFor: string[] | null | undefined, candidateGender: string | null | undefined) {
  const normalized = normalizeLookingFor(lookingFor ?? []);
  if (!normalized.length) return true;
  if (normalized.includes("any")) return true;
  if (!candidateGender) return false;
  return normalized.includes(candidateGender.trim().toLowerCase());
}

export async function getLoveLocation(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("nlove_locations")
    .select("user_id, geohash, lat_approx, lng_approx, accuracy_m, captured_at, updated_at")
    .eq("user_id", userId)
    .maybeSingle<LoveLocationRow>();

  return { data, error };
}

export async function getLoveLocations(userIds: string[]) {
  if (!userIds.length) return { data: [] as LoveLocationRow[], error: null };
  const { data, error } = await supabaseAdmin
    .from("nlove_locations")
    .select("user_id, geohash, lat_approx, lng_approx, accuracy_m, captured_at, updated_at")
    .in("user_id", userIds);

  return { data: (data ?? []) as LoveLocationRow[], error };
}

export function isLocationFresh(location: LoveLocationRow | null | undefined, ttlMs = LOVE_LOCATION_TTL_MS) {
  return isFreshIsoTimestamp(location?.captured_at, ttlMs);
}

export function computeDistanceKm(a: LoveLocationRow, b: LoveLocationRow) {
  return haversineKm(a.lat_approx, a.lng_approx, b.lat_approx, b.lng_approx);
}
