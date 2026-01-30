"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

type TypingPayload = {
  userId?: string | null;
  typing?: boolean;
};

export function useTypingIndicator(chatId?: string | null, userId?: string | null) {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [isReady, setIsReady] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (!chatId || !userId) {
      setTypingUsers([]);
      return;
    }

    const channel = supabase
      .channel(`chat:typing:${chatId}`)
      .on("broadcast", { event: "typing" }, (event) => {
        const raw = (event as { payload?: TypingPayload })?.payload ?? (event as TypingPayload);
        const senderId = raw?.userId ?? null;
        const typing = Boolean(raw?.typing);
        if (!senderId || senderId === userId) return;

        setTypingUsers((prev) => {
          const exists = prev.includes(senderId);
          if (typing) {
            return exists ? prev : [...prev, senderId];
          }
          return exists ? prev.filter((id) => id !== senderId) : prev;
        });
      })
      .subscribe((status) => {
        setIsReady(status === "SUBSCRIBED");
      });

    channelRef.current = channel;

    return () => {
      setIsReady(false);
      channelRef.current = null;
      supabase.removeChannel(channel);
    };
  }, [chatId, supabase, userId]);

  const sendTyping = useCallback(
    async (typing: boolean) => {
      if (!channelRef.current || !userId || !isReady) return;
      await channelRef.current.send({
        type: "broadcast",
        event: "typing",
        payload: { userId, typing },
      });
    },
    [isReady, userId],
  );

  const clearTypingUsers = useCallback(() => {
    setTypingUsers([]);
  }, []);

  return { typingUsers, sendTyping, clearTypingUsers, isReady };
}
