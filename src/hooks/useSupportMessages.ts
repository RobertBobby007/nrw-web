"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { type SupportMessage, useRealtimeSupportMessages } from "./useRealtimeSupportMessages";

const MESSAGE_LIMIT = 50;

export function useSupportMessages(threadId?: string | null) {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const { messages, setMessages } = useRealtimeSupportMessages(threadId);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!threadId) {
      setMessages([]);
      setLoading(false);
      return;
    }

    setMessages([]);
    setLoading(true);
    let active = true;

    const fetchMessages = async () => {
      const { data, error } = await supabase
        .from("support_messages")
        .select("*")
        .eq("thread_id", threadId)
        .order("created_at", { ascending: true })
        .limit(MESSAGE_LIMIT);

      if (!active) return;

      if (error) {
        console.error("Failed to fetch support messages", error);
        setLoading(false);
        return;
      }

      setMessages((data ?? []) as SupportMessage[]);
      setLoading(false);
    };

    void fetchMessages();

    return () => {
      active = false;
    };
  }, [threadId, setMessages, supabase]);

  return { messages, loading };
}
