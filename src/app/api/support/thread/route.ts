import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";

async function createOpenSupportThread(userId: string) {
  const { data: created, error: createError } = await supabaseAdmin
    .from("support_threads")
    .insert({ user_id: userId, status: "open" })
    .select("id, status")
    .single();

  if (createError || !created) {
    return { thread: null, error: createError };
  }

  return { thread: { id: created.id, status: created.status ?? "open" }, error: null };
}

const SUPPORT_THREAD_CLOSED_MESSAGE = "The conversation was closed by an administrator";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data: openThreads, error } = await supabaseAdmin
    .from("support_threads")
    .select("id, status, created_at")
    .eq("user_id", user.id)
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(1);

  if (error) {
    return NextResponse.json({ error: "thread_fetch_failed", message: error.message }, { status: 400 });
  }

  const openThread = openThreads?.[0];
  if (openThread?.id) {
    return NextResponse.json({ thread: { id: openThread.id, status: openThread.status ?? "open" } }, { status: 200 });
  }

  const { data: latestThreads, error: latestError } = await supabaseAdmin
    .from("support_threads")
    .select("id, status, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1);

  if (latestError) {
    return NextResponse.json({ error: "thread_fetch_failed", message: latestError.message }, { status: 400 });
  }

  const latest = latestThreads?.[0];
  if (latest?.id) {
    if ((latest.status ?? "closed") === "closed") {
      const { data: existingSystem } = await supabaseAdmin
        .from("support_messages")
        .select("id")
        .eq("thread_id", latest.id)
        .eq("sender_type", "system")
        .eq("content", SUPPORT_THREAD_CLOSED_MESSAGE)
        .limit(1);

      if (!existingSystem?.length) {
        await supabaseAdmin.from("support_messages").insert({
          thread_id: latest.id,
          sender_type: "system",
          content: SUPPORT_THREAD_CLOSED_MESSAGE,
        });
      }

      const created = await createOpenSupportThread(user.id);
      if (created.error || !created.thread) {
        return NextResponse.json({ error: "thread_create_failed", message: created.error?.message }, { status: 400 });
      }

      return NextResponse.json({ thread: created.thread }, { status: 200 });
    }

    return NextResponse.json({ thread: { id: latest.id, status: latest.status ?? "closed" } }, { status: 200 });
  }

  const created = await createOpenSupportThread(user.id);
  if (created.error || !created.thread) {
    return NextResponse.json({ error: "thread_create_failed", message: created.error?.message }, { status: 400 });
  }

  return NextResponse.json({ thread: created.thread }, { status: 200 });
}
