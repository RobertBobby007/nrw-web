"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

export default function BannedPage() {
  const router = useRouter();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [banReason, setBanReason] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      let storedReason: string | null = null;

      try {
        storedReason = sessionStorage.getItem("ban_reason");
        sessionStorage.removeItem("ban_reason");
      } catch {
        // ignore storage failures
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!active) return;

      setHasSession(Boolean(user));

      let reason = storedReason;
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("ban_reason,banned_at")
          .eq("id", user.id)
          .maybeSingle<{ ban_reason?: string | null; banned_at?: string | null }>();
        if (profile?.ban_reason) {
          reason = profile.ban_reason;
        }
      }

      if (!active) return;
      setBanReason(reason);
      setLoading(false);

      if (user) {
        const { error: signOutError } = await supabase.auth.signOut();
        if (!active) return;
        if (signOutError) {
          setError(signOutError.message);
          return;
        }
        setHasSession(false);
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, [supabase]);

  const handleLogout = async () => {
    setError(null);
    const { error } = await supabase.auth.signOut();
    if (error) {
      setError(error.message);
      return;
    }
    setHasSession(false);
  };

  return (
    <div className="min-h-screen bg-white text-neutral-900 flex items-center justify-center px-4">
      <div className="w-full max-w-lg space-y-5 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold">Tento účet byl zabanován</h1>
          <p className="text-sm text-neutral-600">
            Přístup do aplikace je zablokován. Pokud si myslíš, že jde o chybu, kontaktuj podporu.
          </p>
        </div>

        {loading ? (
          <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-600">
            Načítám detail banu…
          </div>
        ) : banReason ? (
          <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-700">
            <span className="font-semibold">Důvod banu:</span> {banReason}
          </div>
        ) : null}

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
          {hasSession ? (
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-full border border-neutral-200 bg-white px-5 py-2 text-sm font-semibold text-neutral-900 transition hover:bg-neutral-50"
            >
              Odhlásit se
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => router.push("/auth/login")}
            className="rounded-full bg-neutral-900 px-5 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800"
          >
            Zpět na přihlášení
          </button>
        </div>
      </div>
    </div>
  );
}
