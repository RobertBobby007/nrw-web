import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data: memberRows, error: memberError } = await supabaseAdmin
    .from("chat_members")
    .select("chat_id")
    .eq("user_id", user.id);

  if (memberError) {
    return NextResponse.json({ error: "chat_member_fetch_failed" }, { status: 400 });
  }

  const chatIds = (memberRows ?? []).map((row) => row.chat_id).filter(Boolean);
  if (chatIds.length === 0) {
    return NextResponse.json({ chats: [] }, { status: 200 });
  }

  const { data: chatRows, error: chatsError } = await supabaseAdmin
    .from("chats")
    .select("id, type, created_at")
    .eq("type", "direct")
    .in("id", chatIds)
    .order("created_at", { ascending: false });

  if (chatsError) {
    return NextResponse.json({ error: "chat_fetch_failed" }, { status: 400 });
  }

  const directChatIds = (chatRows ?? []).map((chat) => chat.id).filter(Boolean);
  if (directChatIds.length === 0) {
    return NextResponse.json({ chats: [] }, { status: 200 });
  }

  const { data: otherMembers, error: otherError } = await supabaseAdmin
    .from("chat_members")
    .select("chat_id, user_id")
    .in("chat_id", directChatIds)
    .neq("user_id", user.id);

  if (otherError) {
    return NextResponse.json({ error: "chat_member_fetch_failed" }, { status: 400 });
  }

  const otherIds = Array.from(new Set((otherMembers ?? []).map((row) => row.user_id).filter(Boolean))) as string[];
  const profilesById = new Map<string, { id: string; username: string | null; display_name: string | null; avatar_url: string | null }>();

  if (otherIds.length > 0) {
    const { data: profiles, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("id, username, display_name, avatar_url, last_seen")
      .in("id", otherIds);

    if (profileError) {
      return NextResponse.json({ error: "profile_fetch_failed" }, { status: 400 });
    }

    (profiles ?? []).forEach((profile) => {
      if (profile?.id) {
        profilesById.set(profile.id, profile);
      }
    });
  }

  const othersByChatId = new Map<
    string,
    { id: string; username: string | null; display_name: string | null; avatar_url: string | null }
  >();
  (otherMembers ?? []).forEach((row) => {
    if (!row.chat_id || !row.user_id) return;
    const profile = profilesById.get(row.user_id);
    if (profile) {
      othersByChatId.set(row.chat_id, profile);
    }
  });

  const { data: messageRows, error: messageError } = await supabaseAdmin
    .from("chat_messages")
    .select("chat_id, created_at")
    .in("chat_id", directChatIds)
    .order("created_at", { ascending: false });

  if (messageError) {
    return NextResponse.json({ error: "chat_message_fetch_failed" }, { status: 400 });
  }

  const lastMessageByChatId = new Map<string, string>();
  (messageRows ?? []).forEach((row) => {
    if (!row.chat_id || !row.created_at) return;
    if (!lastMessageByChatId.has(row.chat_id)) {
      lastMessageByChatId.set(row.chat_id, row.created_at);
    }
  });

  const chats = (chatRows ?? []).map((chat) => ({
    id: chat.id,
    other: othersByChatId.get(chat.id) ?? null,
    lastMessageAt: lastMessageByChatId.get(chat.id) ?? chat.created_at ?? null,
  }));

  return NextResponse.json({ chats }, { status: 200 });
}
