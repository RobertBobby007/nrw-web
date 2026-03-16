"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { ensureOnlinePresence } from "@/lib/presence/useUserPresence";
import { AUTH_SESSION_KEY, writeSessionCache } from "@/lib/session-cache";

export function OnlineHeartbeat() {
  const HEARTBEAT_ENABLED = process.env.NEXT_PUBLIC_HEARTBEAT_ENABLED === "1";
  const supabase = getSupabaseBrowserClient();
  const pathname = usePathname();

  useEffect(() => {
    if (!HEARTBEAT_ENABLED) return;

    let stopped = false;
    let userId: string | null = null;
    let userFetched = false;

    async function ensureUser() {
      if (userFetched) return;
      userFetched = true;
      try {
        const { data } = await supabase.auth.getUser();
        userId = data.user?.id ?? null;
        writeSessionCache(AUTH_SESSION_KEY, userId, userId ?? null);
        ensureOnlinePresence(userId);
      } catch (e) {
        console.error("heartbeat getUser failed", e);
      }
    }

    async function sendPing() {
      try {
        await ensureUser();
        if (!userId) return;

        await fetch("/api/ping", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ user_id: userId, path: pathname }),
        });
      } catch (e) {
        // Silent failure so background presence does not break the UI.
        console.error("heartbeat failed", e);
      }

      if (!stopped) {
        // Schedule the next ping after 30 seconds.
        setTimeout(sendPing, 30_000);
      }
    }

    sendPing();

    return () => {
      stopped = true;
    };
  }, [HEARTBEAT_ENABLED, supabase, pathname]);

  return null;
}
