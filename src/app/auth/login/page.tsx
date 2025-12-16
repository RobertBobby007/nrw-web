"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = getSupabaseBrowserClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    if (searchParams.get("banned")) {
      setAuthError("Tvůj účet byl zablokován. Pokud si myslíš, že jde o chybu, kontaktuj podporu.");
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setAuthError(error.message || "Přihlášení se nepovedlo.");
        return;
      }

      router.push("/");
    } finally {
      setAuthLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-4 border p-6 rounded-xl"
      >
        <h1 className="text-xl font-semibold">Přihlášení do NRW</h1>

        <div className="space-y-2">
          <label className="block text-sm">E-mail</label>
          <input
            type="email"
            className="w-full border rounded px-3 py-2 bg-transparent"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div className="space-y-2">
          <label className="block text-sm">Heslo</label>
          <input
            type="password"
            className="w-full border rounded px-3 py-2 bg-transparent"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        {authError && <p className="text-sm text-red-500">{authError}</p>}

        <button
          type="submit"
          disabled={authLoading}
          className="w-full rounded-md border px-3 py-2 text-sm font-medium"
        >
          {authLoading ? "Přihlašuji…" : "Přihlásit se"}
        </button>

        <p className="text-xs text-center text-neutral-500">
          Nemáš účet?{" "}
          <a href="/auth/register" className="underline">
            Registrovat se
          </a>
        </p>
      </form>
    </div>
  );
}
