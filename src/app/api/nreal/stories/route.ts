import { NextResponse } from "next/server";
import { containsBlockedContent } from "@/lib/content-filter";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import type { NrealProfile, NrealStory } from "@/types/nreal";

type StoryPayload = {
  media_url?: string | null;
  media_type?: "image" | "video" | null;
  caption?: string | null;
};

type StoryRow = Omit<NrealStory, "profiles" | "viewsCount"> & {
  views_count?: number | null;
  profiles?: NrealProfile | NrealProfile[] | null;
  is_deleted?: boolean | null;
};

const MAX_STORY_CAPTION_CHARS = 160;
const STORY_TTL_MS = 24 * 60 * 60 * 1000;
const STORY_SELECT = `
  id,
  user_id,
  media_url,
  media_type,
  caption,
  created_at,
  expires_at,
  views_count,
  is_deleted,
  profiles (
    username,
    display_name,
    avatar_url,
    verified,
    verification_label
  )
`;

function normalizeStory(row: StoryRow): NrealStory {
  const profiles = Array.isArray(row.profiles) ? row.profiles : row.profiles ? [row.profiles] : [];
  return {
    id: row.id,
    user_id: row.user_id,
    media_url: row.media_url,
    media_type: row.media_type,
    caption: row.caption ?? null,
    created_at: row.created_at,
    expires_at: row.expires_at,
    viewsCount: row.views_count ?? 0,
    profiles,
  };
}

export async function GET() {
  const nowIso = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from("nreal_stories")
    .select(STORY_SELECT)
    .eq("is_deleted", false)
    .gt("expires_at", nowIso)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: "fetch_failed", message: error.message }, { status: 400 });
  }

  const stories = ((data as StoryRow[] | null) ?? [])
    .filter((story) => !story.is_deleted)
    .filter((story) => Date.parse(story.expires_at) > Date.now())
    .map(normalizeStory);

  return NextResponse.json({ data: stories }, { status: 200 });
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("banned_at")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    return NextResponse.json({ error: "profile_fetch_failed", message: profileError.message }, { status: 400 });
  }

  if (profile?.banned_at) {
    return NextResponse.json({ message: "User is banned" }, { status: 403 });
  }

  let payload: StoryPayload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const mediaUrl = typeof payload.media_url === "string" ? payload.media_url.trim() : "";
  const mediaType = payload.media_type === "image" || payload.media_type === "video" ? payload.media_type : null;
  const caption = typeof payload.caption === "string" ? payload.caption.trim() : "";

  if (!mediaUrl || !mediaType) {
    return NextResponse.json({ error: "missing_media" }, { status: 400 });
  }

  if (caption.length > MAX_STORY_CAPTION_CHARS) {
    return NextResponse.json(
      { error: "caption_too_long", max: MAX_STORY_CAPTION_CHARS },
      { status: 400 },
    );
  }

  if (caption) {
    const { hit } = containsBlockedContent(caption);
    if (hit) {
      return NextResponse.json({ error: "blocked_content" }, { status: 400 });
    }
  }

  const expiresAt = new Date(Date.now() + STORY_TTL_MS).toISOString();
  const { data, error } = await supabaseAdmin
    .from("nreal_stories")
    .insert({
      user_id: user.id,
      media_url: mediaUrl,
      media_type: mediaType,
      caption: caption || null,
      expires_at: expiresAt,
    })
    .select(STORY_SELECT)
    .single();

  if (error) {
    return NextResponse.json({ error: "insert_failed", message: error.message }, { status: 400 });
  }

  return NextResponse.json({ data: normalizeStory(data as StoryRow) }, { status: 201 });
}
