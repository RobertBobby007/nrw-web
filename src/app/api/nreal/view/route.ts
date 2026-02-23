import { NextResponse } from "next/server";
import crypto from "crypto";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";

const VIEW_HASH_SALT = process.env.VIEW_HASH_SALT ?? "";

function getRequestIp(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = request.headers.get("x-real-ip");
  if (real) return real.trim();
  return null;
}

function hashIp(ip: string) {
  return crypto.createHash("sha256").update(`${ip}:${VIEW_HASH_SALT}`).digest("hex");
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let payload: { postId?: string } | null = null;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const postId = payload?.postId?.trim();
  if (!postId) {
    return NextResponse.json({ error: "missing_post_id" }, { status: 400 });
  }

  const ip = getRequestIp(request);
  const viewerId = user?.id ?? null;
  const ipHash = ip ? hashIp(ip) : null;

  if (!viewerId && !ipHash) {
    return NextResponse.json({ error: "missing_identity" }, { status: 400 });
  }

  const { error: insertError } = await supabaseAdmin.from("nreal_post_views").insert({
    post_id: postId,
    viewer_id: viewerId,
    ip_hash: ipHash,
  });

  if (insertError) {
    if (insertError.code === "23505") {
      return NextResponse.json({ status: "deduped" }, { status: 200 });
    }
    return NextResponse.json({ error: "insert_failed" }, { status: 400 });
  }

  const { data: postRow } = await supabaseAdmin
    .from("nreal_posts")
    .select("views_count")
    .eq("id", postId)
    .maybeSingle();

  const currentCount = typeof postRow?.views_count === "number" ? postRow.views_count : 0;
  await supabaseAdmin.from("nreal_posts").update({ views_count: currentCount + 1 }).eq("id", postId);

  return NextResponse.json({ status: "ok" }, { status: 200 });
}
