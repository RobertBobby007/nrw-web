"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { subscribeToTable } from "@/lib/realtime";

type AnnouncementRow = {
  id: string;
  created_at: string;
  title: string | null;
  body: string | null;
  severity?: string | null;
  url?: string | null;
  link_url?: string | null;
  link_label?: string | null;
  color?: string | null;
};

export function useFullscreenAnnouncement(userId?: string | null) {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [announcement, setAnnouncement] = useState<AnnouncementRow | null>(null);
  const mountedRef = useRef(false);
  const fetchingRef = useRef(false);
  const dismissedIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  const fetchAnnouncement = useCallback(async () => {
    if (!userId || fetchingRef.current) {
      return;
    }

    fetchingRef.current = true;
    const nowIso = new Date().toISOString();

    try {
      const { data: readRows, error: readError } = await supabase
        .from("announcement_reads")
        .select("announcement_id")
        .eq("user_id", userId);

      if (readError) {
        console.error("Failed to fetch announcement reads", readError);
        if (mountedRef.current) {
          setAnnouncement(null);
        }
        return;
      }

      const readIds = (readRows ?? [])
        .map((row) => row.announcement_id)
        .filter((id): id is string => Boolean(id));

      const excludedIds = new Set<string>([
        ...readIds,
        ...dismissedIdsRef.current,
      ]);

      let query = supabase
        .from("announcements")
        .select("*")
        .eq("is_active", true)
        .eq("is_fullscreen", true)
        .or(`starts_at.is.null,starts_at.lte.${nowIso}`)
        .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
        .or(`audience.eq.all,and(audience.eq.user,target_user_id.eq.${userId})`)
        .order("created_at", { ascending: false })
        .limit(1);

      if (excludedIds.size > 0) {
        const quotedIds = Array.from(excludedIds)
          .map((id) => `"${id}"`)
          .join(",");
        query = query.not("id", "in", `(${quotedIds})`);
      }

      const { data: rows, error } = await query;

      if (error) {
        console.error("Failed to fetch fullscreen announcements", error);
        if (mountedRef.current) {
          setAnnouncement(null);
        }
        return;
      }

      const next = rows?.[0] ?? null;

      if (mountedRef.current) {
        setAnnouncement((prev) => {
          if (!next) {
            return null;
          }
          if (prev?.id === next.id) {
            return prev;
          }
          return next;
        });
      }
    } finally {
      fetchingRef.current = false;
    }
  }, [supabase, userId]);

  useEffect(() => {
    if (!userId) {
      setAnnouncement(null);
      return;
    }

    dismissedIdsRef.current = new Set();
    setAnnouncement(null);
    void fetchAnnouncement();
  }, [fetchAnnouncement, userId]);

  useEffect(() => {
    if (!userId) {
      return;
    }

    const unsubscribe = subscribeToTable("announcements", (payload) => {
      if (payload?.eventType !== "INSERT" && payload?.eventType !== "UPDATE") {
        return;
      }
      void fetchAnnouncement();
    });

    return () => {
      unsubscribe();
    };
  }, [fetchAnnouncement, userId]);

  const dismiss = useCallback(async () => {
    if (!userId || !announcement) {
      return;
    }

    const announcementId = announcement.id;
    dismissedIdsRef.current.add(announcementId);
    setAnnouncement(null);

    const { error } = await supabase.from("announcement_reads").upsert(
      { user_id: userId, announcement_id: announcementId },
      { onConflict: "user_id,announcement_id", ignoreDuplicates: true }
    );

    if (error) {
      console.error("Failed to dismiss announcement", error);
      return;
    }

    void fetchAnnouncement();
  }, [announcement, fetchAnnouncement, supabase, userId]);

  return { announcement, dismiss };
}
