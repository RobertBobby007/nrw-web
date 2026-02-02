"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { type ChatMessage, useRealtimeChatMessages } from "./useRealtimeChatMessages";

const MESSAGE_LIMIT = 50;
const CHAT_MESSAGES_CACHE_TTL_MS = 60000;
const chatMessagesCache = new Map<string, { messages: ChatMessage[]; fetchedAt: number }>();

function pickLatestTimestamp(a?: string | null, b?: string | null) {
  if (!a) return b ?? null;
  if (!b) return a ?? null;
  const aTime = new Date(a).getTime();
  const bTime = new Date(b).getTime();
  if (Number.isNaN(aTime)) return b ?? null;
  if (Number.isNaN(bTime)) return a ?? null;
  return bTime > aTime ? b : a;
}

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
      const prev = map.get(message.id);
      if (prev) {
        const readBy = Array.from(new Set([...(prev.read_by ?? []), ...(message.read_by ?? [])]));
        map.set(message.id, {
          ...prev,
          ...message,
          read_by: readBy,
          read_at: pickLatestTimestamp(prev.read_at, message.read_at),
        });
      } else {
        map.set(message.id, message);
      }
    }
  });

  return Array.from(map.values())
    .map((message) => ({
      ...message,
      read_by: Array.from(new Set(message.read_by ?? [])),
      read_at: message.read_at ?? null,
    }))
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
}

export function useChatMessages(chatId?: string | null, currentUserId?: string | null) {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const { messages, setMessages } = useRealtimeChatMessages(chatId);
  const [loading, setLoading] = useState(false);
  const hasLoadedRef = useRef(false);
  const readSentRef = useRef<Set<string>>(new Set());
  const readReceiptsDisabledRef = useRef(false);

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
          .select("message_id, user_id, read_at")
          .in("message_id", messageIds);
        if (!readsError) {
          const readMap = new Map<string, Set<string>>();
          const readAtMap = new Map<string, string>();
          (reads ?? []).forEach((row) => {
            const messageId = (row as { message_id?: string | null }).message_id;
            const userId = (row as { user_id?: string | null }).user_id;
            const readAt = (row as { read_at?: string | null }).read_at ?? null;
            if (!messageId || !userId) return;
            const set = readMap.get(messageId) ?? new Set<string>();
            set.add(userId);
            readMap.set(messageId, set);
            if (readAt) {
              const existing = readAtMap.get(messageId);
              readAtMap.set(messageId, pickLatestTimestamp(existing, readAt) ?? readAt);
            }
          });
          merged = merged.map((message) => ({
            ...message,
            read_by: Array.from(readMap.get(message.id) ?? new Set(message.read_by ?? [])),
            read_at: readAtMap.get(message.id) ?? message.read_at ?? null,
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
          const row = payload.new as {
            message_id?: string | null;
            user_id?: string | null;
            read_at?: string | null;
          };
          const messageId = row?.message_id ?? null;
          const userId = row?.user_id ?? null;
          const readAt = row?.read_at ?? null;
          if (!messageId || !userId) return;
          setMessages((prev) =>
            prev.map((message) => {
              if (message.id !== messageId) return message;
              const nextReadAt = pickLatestTimestamp(message.read_at, readAt);
              if (message.read_by?.includes(userId)) {
                return nextReadAt ? { ...message, read_at: nextReadAt } : message;
              }
              return {
                ...message,
                read_by: [...(message.read_by ?? []), userId],
                read_at: nextReadAt,
              };
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
    if (readReceiptsDisabledRef.current) return;
    const unread = messages.filter((message) => {
      const senderId = message.sender_id ?? message.user_id ?? null;
      if (!senderId || senderId === currentUserId) return false;
      if (message.read_by?.includes(currentUserId)) return false;
      if (readSentRef.current.has(message.id)) return false;
      return true;
    });
    if (unread.length === 0) return;
    const payload = unread.map((message) => ({
      message_id: message.id,
      user_id: currentUserId,
      read_at: new Date().toISOString(),
    }));
    const unreadIds = unread.map((message) => message.id);

    const markSent = () => {
      unreadIds.forEach((id) => readSentRef.current.add(id));
    };
    const unmarkSent = () => {
      unreadIds.forEach((id) => readSentRef.current.delete(id));
    };

    void (async () => {
        const { error } = await supabase
          .from("chat_message_reads")
          .upsert(payload, { onConflict: "message_id,user_id" });

        if (error) {
          const code = (error as { code?: string }).code ?? "";
          if (code === "42P10") {
            const { error: insertError } = await supabase.from("chat_message_reads").insert(payload);
            if (insertError) {
              const insertCode = (insertError as { code?: string }).code ?? "";
              if (insertCode !== "23505") {
                readReceiptsDisabledRef.current = true;
                unmarkSent();
                return;
              }
            }
            markSent();
            return;
          }

          if (code === "23505") {
            markSent();
            return;
          }

          readReceiptsDisabledRef.current = true;
          unmarkSent();
          return;
        }

        markSent();
    })();
  }, [chatId, currentUserId, messages, supabase]);

  return { messages, setMessages, loading };
}
