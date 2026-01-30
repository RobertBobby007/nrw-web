"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

type PresenceListener = (ids: Set<string>) => void;

type PresenceStore = {
  channel: ReturnType<ReturnType<typeof getSupabaseBrowserClient>["channel"]> | null;
  onlineIds: Set<string>;
  listeners: Set<PresenceListener>;
  trackedUserId: string | null;
};

const presenceStore: PresenceStore = {
  channel: null,
  onlineIds: new Set(),
  listeners: new Set(),
  trackedUserId: null,
};

function notifyListeners() {
  presenceStore.listeners.forEach((listener) => listener(presenceStore.onlineIds));
}

function ensureChannel(userId: string | null) {
  if (!userId) return;
  if (presenceStore.channel && presenceStore.trackedUserId === userId) return;

  const supabase = getSupabaseBrowserClient();

  if (presenceStore.channel) {
    supabase.removeChannel(presenceStore.channel);
    presenceStore.channel = null;
    presenceStore.onlineIds = new Set();
    notifyListeners();
  }

  const channel = supabase.channel("presence:online", {
    config: { presence: { key: userId } },
  });

  channel.on("presence", { event: "sync" }, () => {
    const state = channel.presenceState();
    const next = new Set<string>(Object.keys(state));
    presenceStore.onlineIds = next;
    notifyListeners();
  });

  channel.subscribe((status) => {
    if (status === "SUBSCRIBED") {
      void channel.track({ online: true, last_seen: new Date().toISOString() });
    }
  });

  presenceStore.channel = channel;
  presenceStore.trackedUserId = userId;
}

export function ensureOnlinePresence(userId: string | null) {
  ensureChannel(userId);
}

export function useUserPresence(targetUserId?: string | null) {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [onlineIds, setOnlineIds] = useState<Set<string>>(() => new Set());
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!active) return;
      setCurrentUserId(data.user?.id ?? null);
    });
    return () => {
      active = false;
    };
  }, [supabase]);

  useEffect(() => {
    ensureChannel(currentUserId);
  }, [currentUserId]);

  useEffect(() => {
    const listener: PresenceListener = (ids) => {
      setOnlineIds(new Set(ids));
    };
    presenceStore.listeners.add(listener);
    setOnlineIds(new Set(presenceStore.onlineIds));
    return () => {
      presenceStore.listeners.delete(listener);
    };
  }, []);

  const isOnline = Boolean(targetUserId && onlineIds.has(targetUserId));

  return { isOnline };
}

export function useOnlineUsers() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [onlineIds, setOnlineIds] = useState<Set<string>>(() => new Set());
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!active) return;
      setCurrentUserId(data.user?.id ?? null);
    });
    return () => {
      active = false;
    };
  }, [supabase]);

  useEffect(() => {
    ensureChannel(currentUserId);
  }, [currentUserId]);

  useEffect(() => {
    const listener: PresenceListener = (ids) => {
      setOnlineIds(new Set(ids));
    };
    presenceStore.listeners.add(listener);
    setOnlineIds(new Set(presenceStore.onlineIds));
    return () => {
      presenceStore.listeners.delete(listener);
    };
  }, []);

  return { onlineIds };
}
