"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

export type SupportMessage = {
  id: string;
  thread_id: string;
  sender_type: string;
  sender_user_id?: string | null;
  content: string;
  created_at: string;
};

export function useRealtimeSupportMessages(threadId?: string | null) {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [messages, setMessages] = useState<SupportMessage[]>([]);

  useEffect(() => {
    if (!threadId) {
      setMessages([]);
      return;
    }

    const channel = supabase
      .channel(`support_messages:${threadId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "support_messages",
          filter: `thread_id=eq.${threadId}`,
        },
        (payload) => {
          const next = payload.new as SupportMessage;
          if (!next?.id) return;
          setMessages((prev) => {
            if (prev.some((msg) => msg.id === next.id)) return prev;
            return [...prev, next];
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [threadId, supabase]);

  return { messages, setMessages };
}
