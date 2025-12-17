import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { containsBlockedContent } from "@/lib/content-filter";

type CreatePostPayload = {
  content?: string | null;
  media_url?: string | null;
  media_type?: "image" | "video" | null;
};

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
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

  if (content) {
    const { hit } = containsBlockedContent(content);
    if (hit) {
      return NextResponse.json({ error: "blocked_content" }, { status: 400 });
    }
  }

  const { data, error } = await supabase
    .from("nreal_posts")
    .insert({
      content: content || null,
      user_id: user.id,
      media_url: mediaUrl,
      media_type: mediaType,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: "insert_failed", message: error.message }, { status: 400 });
  }

  return NextResponse.json({ data }, { status: 201 });
}
