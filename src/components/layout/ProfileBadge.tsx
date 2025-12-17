"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

const HIDDEN_PREFIXES = ["/support", "/settings", "/id"];

export function ProfileBadge() {
  const pathname = usePathname();
  const isHidden = HIDDEN_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  const [open, setOpen] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [initials, setInitials] = useState<string>("NRW");
  const supabase = getSupabaseBrowserClient();

  const computeInitials = (value: string | null | undefined) => {
    const name = (value || "").trim();
    if (!name) return "NRW";
    const parts = name.split(/\s+/).filter(Boolean).slice(0, 2);
    const joined =
      parts
        .map((p) => p[0]?.toUpperCase?.() || "")
        .join("") || "NRW";
    return joined;
  };

  const fetchInitials = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    setIsAuthenticated(!!user);
    if (!user?.id) {
      setInitials("NRW");
      return;
    }
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name, username")
      .eq("id", user.id)
      .maybeSingle();

    const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
    const metaDisplayName = typeof meta.display_name === "string" ? meta.display_name : null;
    const metaUsername = typeof meta.username === "string" ? meta.username : null;
    const displayName = profile?.display_name ?? metaDisplayName ?? null;
    const username = profile?.username ?? metaUsername ?? "";
    const name = displayName || username || "Uživatel";
    setInitials(computeInitials(name));
  }, [supabase]);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    let active = true;
    fetchInitials();
    const { data: authSub } = supabase.auth.onAuthStateChange(() => {
      if (!active) return;
      fetchInitials();
    });
    return () => {
      active = false;
      authSub.subscription.unsubscribe();
    };
  }, [fetchInitials, supabase]);

  if (isHidden) return null;

  return (
    <div
      className="fixed right-3 top-3 z-40 hidden sm:block md:right-6 md:top-6"
      style={{
        top: "calc(env(safe-area-inset-top, 0px) + 12px)",
        right: "calc(env(safe-area-inset-right, 0px) + 12px)",
      }}
    >
      <div className="relative">
        <button
          type="button"
          aria-label="Tvůj profil"
          onClick={() => setOpen((prev) => !prev)}
          className="relative inline-flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-neutral-900 via-neutral-700 to-neutral-900 text-sm font-semibold text-white shadow-lg shadow-neutral-900/15 ring-2 ring-white transition hover:-translate-y-0.5 hover:shadow-xl hover:shadow-neutral-900/20 md:h-11 md:w-11"
        >
          <span>{initials}</span>
          <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-white bg-emerald-400" />
        </button>

        {open && (
          <div className="absolute right-0 mt-2 w-44 rounded-xl border border-neutral-200 bg-white shadow-lg shadow-neutral-900/10">
            {isAuthenticated ? (
              <>
                <Link
                  href="/id"
                  className="flex items-center justify-between px-3 py-2 text-sm font-semibold text-neutral-800 transition hover:bg-neutral-50"
                >
                  Zobrazit profil
                  <span className="text-[11px] font-medium text-neutral-500">nID</span>
                </Link>
                <Link
                  href="/auth/logout"
                  className="flex items-center justify-between px-3 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50"
                >
                  Odhlásit se
                  <span className="text-[11px] font-medium text-red-400">↗</span>
                </Link>
              </>
            ) : (
              <Link
                href="/auth/login"
                className="flex items-center justify-between px-3 py-2 text-sm font-semibold text-neutral-800 transition hover:bg-neutral-50"
              >
                Přihlásit se
                <span className="text-[11px] font-medium text-neutral-500">→</span>
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
