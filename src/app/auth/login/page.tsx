"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = getSupabaseBrowserClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
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
      const { error } = await supabase.auth.signInWithPassword({
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

  const handleGoogleSignIn = async () => {
    setAuthError(null);
    setGoogleLoading(true);

    const redirectTo = `${window.location.origin}/`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });

    if (error) {
      setAuthError(error.message || "Přihlášení přes Google se nepovedlo.");
      setGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-4 border p-6 rounded-xl"
      >
        <h1 className="text-xl font-semibold">Přihlášení do NRW</h1>

        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={googleLoading || authLoading}
          className="w-full rounded-md border px-3 py-2 text-sm font-medium"
        >
          {googleLoading ? "Přesměrovávám na Google…" : "Pokračovat přes Google"}
        </button>

        <div className="relative">
          <div className="h-px w-full bg-neutral-200" />
          <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white px-2 text-xs text-neutral-500">
            nebo e-mailem
          </span>
        </div>

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
          disabled={authLoading || googleLoading}
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

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageContent />
    </Suspense>
  );
}
