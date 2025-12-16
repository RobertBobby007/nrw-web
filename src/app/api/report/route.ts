import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body.target_type !== "string" || typeof body.reason !== "string") {
    return NextResponse.json({ success: false, error: "Invalid payload" }, { status: 400 });
  }

  const targetType = body.target_type === "comment" ? "comment" : "post";
  const reason = body.reason;
  const details = typeof body.details === "string" && body.details.trim() ? body.details.trim() : null;
  const targetPostId = targetType === "post" ? body.target_post_id : null;
  const targetCommentId = targetType === "comment" ? body.target_comment_id : null;

  const { error: insertError } = await supabase.from("nreal_reports").insert({
    reporter_user_id: user.id,
    target_type: targetType,
    target_post_id: targetPostId ?? null,
    target_comment_id: targetCommentId ?? null,
    reason,
    details,
  });

  if (insertError) {
    return NextResponse.json({ success: false, error: insertError.message }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
