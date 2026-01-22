import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";

type DirectChatPayload = {
  targetUserId?: string;
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

  const body = (await request.json().catch(() => null)) as DirectChatPayload | null;
  const targetUserId = body?.targetUserId?.trim();

  if (!targetUserId || targetUserId === user.id) {
    return NextResponse.json({ error: "invalid_target_user" }, { status: 400 });
  }

  const { data: memberRows, error: memberError } = await supabaseAdmin
    .from("chat_members")
    .select("chat_id,user_id,chats!inner(type)")
    .in("user_id", [user.id, targetUserId])
    .eq("chats.type", "direct");

  if (memberError) {
    return NextResponse.json({ error: "chat_member_fetch_failed" }, { status: 400 });
  }

  const membershipByChatId = new Map<string, Set<string>>();
  (memberRows ?? []).forEach((row) => {
    if (!row.chat_id || !row.user_id) return;
    const set = membershipByChatId.get(row.chat_id) ?? new Set<string>();
    set.add(row.user_id);
    membershipByChatId.set(row.chat_id, set);
  });

  for (const [chatId, members] of membershipByChatId) {
    if (members.size === 2 && members.has(user.id) && members.has(targetUserId)) {
      return NextResponse.json({ chatId }, { status: 200 });
    }
  }

  const newChatId = randomUUID();
  const { error: newChatError } = await supabaseAdmin.from("chats").insert({
    id: newChatId,
    type: "direct",
  });

  if (newChatError) {
    return NextResponse.json(
      {
        error: "chat_create_failed",
        message: newChatError.message,
      },
      { status: 400 },
    );
  }

  const { error: membersError } = await supabaseAdmin.from("chat_members").insert([
    { chat_id: newChatId, user_id: user.id },
    { chat_id: newChatId, user_id: targetUserId },
  ]);

  if (membersError) {
    return NextResponse.json(
      {
        error: "chat_members_create_failed",
        message: membersError.message,
        code: membersError.code,
        details: membersError.details,
      },
      { status: 400 },
    );
  }

  return NextResponse.json({ chatId: newChatId }, { status: 200 });
}
