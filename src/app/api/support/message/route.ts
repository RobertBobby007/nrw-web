import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";

const AUTO_REPLY_TEXT =
  "Děkujeme za zprávu. Podpora se Vám ozve co nejdřív. Mezitím prosím popište problém co nejpodrobněji.";

type SupportMessagePayload = {
  threadId?: string;
  content?: string;
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

  const body = (await request.json().catch(() => null)) as SupportMessagePayload | null;
  const threadId = body?.threadId?.trim();
  const content = body?.content?.trim();

  if (!threadId || !content) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  const { data: thread, error: threadError } = await supabaseAdmin
    .from("support_threads")
    .select("id, user_id, status, auto_reply_sent")
    .eq("id", threadId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (threadError) {
    return NextResponse.json({ error: "thread_fetch_failed", message: threadError.message }, { status: 400 });
  }

  if (!thread) {
    return NextResponse.json({ error: "thread_not_found" }, { status: 404 });
  }

  if (thread.status === "closed") {
    return NextResponse.json({ error: "thread_closed" }, { status: 400 });
  }

  const { error: insertError } = await supabaseAdmin.from("support_messages").insert({
    thread_id: threadId,
    sender_type: "user",
    sender_user_id: user.id,
    content,
  });

  if (insertError) {
    return NextResponse.json({ error: "message_insert_failed", message: insertError.message }, { status: 400 });
  }

  if (thread.auto_reply_sent === false) {
    const { error: autoError } = await supabaseAdmin.from("support_messages").insert({
      thread_id: threadId,
      sender_type: "system",
      content: AUTO_REPLY_TEXT,
    });

    if (!autoError) {
      await supabaseAdmin
        .from("support_threads")
        .update({ auto_reply_sent: true })
        .eq("id", threadId)
        .eq("user_id", user.id);
    }
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
