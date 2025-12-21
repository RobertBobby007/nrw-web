import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const baseColumns = [
    "id",
    "username",
    "display_name",
    "avatar_url",
    "bio",
    "banned_at",
    "ban_reason",
    "verified",
    "verification_label",
    "created_at",
    "updated_at",
  ];
  const optionalColumns = ["can_post_without_review"];

  let { data, error } = await supabase
    .from("profiles")
    .select([...baseColumns, ...optionalColumns].join(","))
    .eq("id", user.id)
    .maybeSingle();

  if (error?.code === "42703") {
    const retry = await supabase.from("profiles").select(baseColumns.join(",")).eq("id", user.id).maybeSingle();
    if (retry.error) {
      return NextResponse.json({ error: "profile_fetch_failed", message: retry.error.message }, { status: 400 });
    }
    data = retry.data;
    error = null;
  }

  if (error) {
    return NextResponse.json({ error: "profile_fetch_failed", message: error.message }, { status: 400 });
  }

  const normalized = (() => {
    if (!data || typeof data !== "object") {
      return data;
    }
    const dataRecord = data as Record<string, unknown>;
    const canPost = (dataRecord.can_post_without_review as boolean | null | undefined) ?? false;
    return { ...dataRecord, can_post_without_review: canPost };
  })();

  return NextResponse.json({ data: normalized }, { status: 200 });
}
