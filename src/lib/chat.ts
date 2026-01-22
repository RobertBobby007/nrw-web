"use client";

import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

export async function getOrCreateDirectChat(targetUserId: string): Promise<string> {
  const response = await fetch("/api/chat/direct", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ targetUserId }),
  });

  const payload = (await response.json().catch(() => null)) as
    | { chatId?: string; error?: string; message?: string }
    | null;

  if (!response.ok || !payload?.chatId) throw new Error(payload?.message ?? "Failed to open chat");

  return payload.chatId;
}

export async function sendMessage(chatId: string, content: string) {
  const trimmed = content.trim();
  if (!trimmed) {
    return;
  }

  const supabase = getSupabaseBrowserClient();
  const { data, error: authError } = await supabase.auth.getUser();

  if (authError) {
    throw new Error(authError.message ?? "Auth failed");
  }

  const user = data?.user;
  if (!user) {
    throw new Error("Not authenticated");
  }

  const insertPayload = {
    chat_id: chatId,
    sender_id: user.id,
    content: trimmed,
  };

  const { error } = await supabase.from("chat_messages").insert(insertPayload);

  if (error) {
    const missingSender = error.code === "PGRST204" && error.message?.includes("sender_id");
    if (missingSender) {
      const { error: retryError } = await supabase.from("chat_messages").insert({
        chat_id: chatId,
        user_id: user.id,
        content: trimmed,
      });
      if (!retryError) {
        return;
      }
      const retryMessage = retryError.message ?? "Failed to send message";
      const retryCode = retryError.code ? ` (${retryError.code})` : "";
      throw new Error(`${retryMessage}${retryCode}`);
    }

    const message = error.message ?? "Failed to send message";
    const code = error.code ? ` (${error.code})` : "";
    throw new Error(`${message}${code}`);
  }
}
