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
  const targetPostId =
    targetType === "post" && typeof body.target_post_id === "string" ? body.target_post_id : null;
  const targetCommentId =
    targetType === "comment" && typeof body.target_comment_id === "string" ? body.target_comment_id : null;

  if (targetType === "post" && !targetPostId) {
    return NextResponse.json({ success: false, error: "Missing target_post_id" }, { status: 400 });
  }
  if (targetType === "comment" && !targetCommentId) {
    return NextResponse.json({ success: false, error: "Missing target_comment_id" }, { status: 400 });
  }

  if (targetType === "post") {
    const { data: post, error: postError } = await supabase
      .from("nreal_posts")
      .select("user_id")
      .eq("id", targetPostId)
      .maybeSingle<{ user_id: string | null }>();

    if (postError) {
      return NextResponse.json({ success: false, error: postError.message }, { status: 400 });
    }
    if (!post) {
      return NextResponse.json({ success: false, error: "Post not found" }, { status: 404 });
    }
    if (post.user_id && post.user_id === user.id) {
      return NextResponse.json({ success: false, error: "Cannot report own post" }, { status: 400 });
    }
  }

  if (targetType === "comment") {
    const { data: comment, error: commentError } = await supabase
      .from("nreal_comments")
      .select("user_id")
      .eq("id", targetCommentId)
      .maybeSingle<{ user_id: string | null }>();

    if (commentError) {
      return NextResponse.json({ success: false, error: commentError.message }, { status: 400 });
    }
    if (!comment) {
      return NextResponse.json({ success: false, error: "Comment not found" }, { status: 404 });
    }
    if (comment.user_id && comment.user_id === user.id) {
      return NextResponse.json({ success: false, error: "Cannot report own comment" }, { status: 400 });
    }
  }

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
