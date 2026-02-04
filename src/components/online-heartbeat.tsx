"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { ensureOnlinePresence } from "@/lib/presence/useUserPresence";
import { AUTH_SESSION_KEY, writeSessionCache } from "@/lib/session-cache";

export function OnlineHeartbeat() {
  const HEARTBEAT_ENABLED = false;
  if (!HEARTBEAT_ENABLED) {
    return null;
  }

  const supabase = getSupabaseBrowserClient();
  const pathname = usePathname();

  useEffect(() => {
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

        await fetch("/api/ping", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ user_id: userId, path: pathname }),
        });
      } catch (e) {
        // tiché selhání, nechceme shodit UI
        console.error("heartbeat failed", e);
      }

      if (!stopped) {
        // další ping za 30 sekund
        setTimeout(sendPing, 30_000);
      }
    }

    sendPing();

    return () => {
      stopped = true;
    };
  }, [supabase, pathname]);

  return null;
}
