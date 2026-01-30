import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";

type ReportPayload = {
  messageId?: string;
  chatId?: string;
  reportedUserId?: string;
  reason?: string;
  details?: string;
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

  const body = (await request.json().catch(() => null)) as ReportPayload | null;
  const messageId = body?.messageId?.trim();
  const chatId = body?.chatId?.trim();
  const reportedUserId = body?.reportedUserId?.trim();
  const reason = body?.reason?.trim();
  const details = body?.details?.trim() || null;

  if (!messageId || !chatId || !reportedUserId || !reason) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  const { error } = await supabaseAdmin.from("chat_message_reports").insert({
    reporter_user_id: user.id,
    reported_message_id: messageId,
    reported_user_id: reportedUserId,
    chat_id: chatId,
    reason,
    details,
  });

  if (error) {
    return NextResponse.json({ error: "report_create_failed", message: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
