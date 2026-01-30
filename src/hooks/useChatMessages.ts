"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { type ChatMessage, useRealtimeChatMessages } from "./useRealtimeChatMessages";

const MESSAGE_LIMIT = 50;
const CHAT_MESSAGES_CACHE_TTL_MS = 60000;
const chatMessagesCache = new Map<string, { messages: ChatMessage[]; fetchedAt: number }>();

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

  return Array.from(map.values())
    .map((message) => ({
      ...message,
      read_by: Array.from(new Set(message.read_by ?? [])),
    }))
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
}

export function useChatMessages(chatId?: string | null, currentUserId?: string | null) {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const { messages, setMessages } = useRealtimeChatMessages(chatId);
  const [loading, setLoading] = useState(false);
  const hasLoadedRef = useRef(false);
  const readSentRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    hasLoadedRef.current = false;
    readSentRef.current = new Set();
  }, [chatId]);

  useEffect(() => {
    if (!chatId) {
      setMessages([]);
      setLoading(false);
      return;
    }

    const cached = chatMessagesCache.get(chatId);
    if (cached && Date.now() - cached.fetchedAt < CHAT_MESSAGES_CACHE_TTL_MS) {
      setMessages(cached.messages);
      setLoading(false);
      hasLoadedRef.current = true;
      return;
    }

    setMessages([]);
    setLoading(true);
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
        setLoading(false);
        return;
      }

      const rows = ((data ?? []) as ChatMessage[]).map((row) => ({
        ...row,
        read_by: Array.isArray(row.read_by) ? row.read_by : [],
      }));
      let merged = mergeMessages([], rows);

      const messageIds = merged.map((message) => message.id).filter(Boolean);
      if (messageIds.length > 0) {
        const { data: reads, error: readsError } = await supabase
          .from("chat_message_reads")
          .select("message_id, user_id")
          .in("message_id", messageIds);
        if (!readsError) {
          const readMap = new Map<string, Set<string>>();
          (reads ?? []).forEach((row) => {
            const messageId = (row as { message_id?: string | null }).message_id;
            const userId = (row as { user_id?: string | null }).user_id;
            if (!messageId || !userId) return;
            const set = readMap.get(messageId) ?? new Set<string>();
            set.add(userId);
            readMap.set(messageId, set);
          });
          merged = merged.map((message) => ({
            ...message,
            read_by: Array.from(readMap.get(message.id) ?? new Set(message.read_by ?? [])),
          }));
        }
      }

      setMessages(merged);
      chatMessagesCache.set(chatId, { messages: merged, fetchedAt: Date.now() });
      setLoading(false);
      hasLoadedRef.current = true;
    };

    void fetchMessages();

    return () => {
      active = false;
    };
  }, [chatId, setMessages, supabase]);

  useEffect(() => {
    if (!chatId || !hasLoadedRef.current) {
      return;
    }
    chatMessagesCache.set(chatId, { messages, fetchedAt: Date.now() });
  }, [chatId, messages]);

  useEffect(() => {
    if (!chatId || !currentUserId) return;
    const channel = supabase
      .channel(`chat_message_reads:${chatId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_message_reads" },
        (payload) => {
          const row = payload.new as { message_id?: string | null; user_id?: string | null };
          const messageId = row?.message_id ?? null;
          const userId = row?.user_id ?? null;
          if (!messageId || !userId) return;
          setMessages((prev) =>
            prev.map((message) => {
              if (message.id !== messageId) return message;
              if (message.read_by?.includes(userId)) return message;
              return { ...message, read_by: [...(message.read_by ?? []), userId] };
            }),
          );
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [chatId, currentUserId, setMessages, supabase]);

  useEffect(() => {
    if (!chatId || !currentUserId) return;
    const unread = messages.filter((message) => {
      const senderId = message.sender_id ?? message.user_id ?? null;
      if (!senderId || senderId === currentUserId) return false;
      if (message.read_by?.includes(currentUserId)) return false;
      if (readSentRef.current.has(message.id)) return false;
      return true;
    });
    if (unread.length === 0) return;
    unread.forEach((message) => readSentRef.current.add(message.id));
    void supabase
      .from("chat_message_reads")
      .upsert(
        unread.map((message) => ({
          message_id: message.id,
          user_id: currentUserId,
        })),
        { onConflict: "message_id,user_id" },
      )
      .then(({ error }) => {
        if (error) {
          console.error("chat_message_reads upsert failed", error);
        }
      });
  }, [chatId, currentUserId, messages, supabase]);

  return { messages, setMessages, loading };
}
