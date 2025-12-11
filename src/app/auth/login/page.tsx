"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

export default function LoginPage() {
  const router = useRouter();
  const supabase = getSupabaseBrowserClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    if (data?.user) {
      try {
        await fetch("/api/admin/log", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            user_id: data.user.id,
            path: "/auth/login",
          }),
        });
      } catch (err) {
        console.error("Failed to log admin event", err);
      }
    }

    router.push("/");
  }

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

        {error && <p className="text-sm text-red-500">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md border px-3 py-2 text-sm font-medium"
        >
          {loading ? "Přihlašuji…" : "Přihlásit se"}
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
