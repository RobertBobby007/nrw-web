"use client";

import { useEffect, useMemo } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { type ChatMessage, useRealtimeChatMessages } from "./useRealtimeChatMessages";

const MESSAGE_LIMIT = 50;

function mergeMessages(existing: ChatMessage[], incoming: ChatMessage[]) {
  if (incoming.length === 0) {
    return existing;
  }

  const map = new Map<string, ChatMessage>();
  existing.forEach((message) => {
    if (message?.id) {
      map.set(message.id, message);
    }
  });
  incoming.forEach((message) => {
    if (message?.id) {
      map.set(message.id, message);
    }
  });

  return Array.from(map.values()).sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );
}

export function useChatMessages(chatId?: string | null) {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const { messages, setMessages } = useRealtimeChatMessages(chatId);

  useEffect(() => {
    if (!chatId) {
      setMessages([]);
      return;
    }

    setMessages([]);
    let active = true;

    const fetchMessages = async () => {
      const { data, error } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("chat_id", chatId)
        .order("created_at", { ascending: true })
        .limit(MESSAGE_LIMIT);

      if (!active) {
        return;
      }

      if (error) {
        console.error("Failed to fetch chat messages", error);
        return;
      }

      const rows = (data ?? []) as ChatMessage[];
      setMessages((prev) => mergeMessages(prev, rows));
    };

    void fetchMessages();

    return () => {
      active = false;
    };
  }, [chatId, setMessages, supabase]);

  return { messages, setMessages };
}
