import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { containsBlockedContent } from "@/lib/content-filter";

type CreatePostPayload = {
  content?: string | null;
  media_url?: string | null;
  media_type?: "image" | "video" | null;
};

const MAX_POST_CHARS = 3000;

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("banned_at, can_post_without_review")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError?.code === "42703") {
    const retry = await supabase.from("profiles").select("banned_at").eq("id", user.id).maybeSingle();
    if (retry.error) {
      console.error("Failed to fetch profile in create post", retry.error);
    } else {
      profile = retry.data;
      profileError = null;
    }
  } else if (profileError) {
    console.error("Failed to fetch profile in create post", profileError);
  }

  if (profile?.banned_at) {
    return NextResponse.json({ message: "User is banned" }, { status: 403 });
  }

  let payload: CreatePostPayload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const rawContent = typeof payload?.content === "string" ? payload.content : "";
  const content = rawContent.trim();
  const mediaUrl = typeof payload?.media_url === "string" ? payload.media_url : null;
  const mediaType =
    mediaUrl && (payload?.media_type === "image" || payload?.media_type === "video")
      ? payload.media_type
      : null;

  if (!content && !mediaUrl) {
    return NextResponse.json({ error: "missing_content" }, { status: 400 });
  }

  if (content.length > MAX_POST_CHARS) {
    return NextResponse.json(
      { error: "content_too_long", max: MAX_POST_CHARS },
      { status: 400 },
    );
  }

  if (content) {
    const { hit } = containsBlockedContent(content);
    if (hit) {
      return NextResponse.json({ error: "blocked_content" }, { status: 400 });
    }
  }

  const status = (profile as { can_post_without_review?: boolean | null } | null)?.can_post_without_review
    ? "approved"
    : "pending";

  const { data, error } = await supabase
    .from("nreal_posts")
    .insert({
      content: content || null,
      user_id: user.id,
      media_url: mediaUrl,
      media_type: mediaType,
      status,
    })
    .select(
      `
        id,
        user_id,
        content,
        created_at,
        status,
        media_url,
        media_type,
        is_deleted,
        profiles (
          username,
          display_name,
          avatar_url,
          verified,
          verification_label
        )
      `,
    )
    .single();

  if (error) {
    return NextResponse.json({ error: "insert_failed", message: error.message }, { status: 400 });
  }

  return NextResponse.json({ data }, { status: 201 });
}
