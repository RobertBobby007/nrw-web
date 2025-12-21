"use client";

import { useEffect, useMemo, useRef } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

export function BanWatcher() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const handledRef = useRef(false);

  useEffect(() => {
    let active = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const handleBan = async (banReason: string | null) => {
      if (handledRef.current) return;
      handledRef.current = true;
      if (banReason) {
        try {
          sessionStorage.setItem("ban_reason", banReason);
        } catch {
          // ignore storage failures
        }
      }
      try {
        await supabase.auth.signOut();
      } finally {
        window.location.href = "/auth/banned";
      }
    };

    const start = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!active || !user) return;

      channel = supabase
        .channel(`profile-ban:${user.id}`)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "profiles",
            filter: `id=eq.${user.id}`,
          },
          (payload) => {
            const bannedAt = payload?.new?.banned_at as string | null | undefined;
            if (!bannedAt) return;
            const banReason =
              typeof payload?.new?.ban_reason === "string" ? (payload.new.ban_reason as string) : null;
            void handleBan(banReason);
          },
        )
        .subscribe();
    };

    void start();

    return () => {
      active = false;
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [supabase]);

  return null;
}
