"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

export type ChatMessage = {
  id: string;
  chat_id: string;
  sender_id?: string | null;
  user_id?: string | null;
  content: string;
  created_at: string;
  read_by: string[];
};

export function useRealtimeChatMessages(chatId?: string | null) {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  useEffect(() => {
    if (!chatId) {
      setMessages([]);
      return;
    }

    const channel = supabase
      .channel(`chat_messages:${chatId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `chat_id=eq.${chatId}`,
        },
        (payload) => {
          const next = payload.new as ChatMessage;
          if (!next?.id) {
            return;
          }

          setMessages((prev) => {
            if (prev.some((message) => message.id === next.id)) {
              return prev;
            }
            return [...prev, { ...next, read_by: [] }];
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [chatId, supabase]);

  return { messages, setMessages };
}
