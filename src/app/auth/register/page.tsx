"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

export default function RegisterPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const formData = new FormData(e.currentTarget);
    const name = formData.get("name");
    const email = formData.get("email");
    const password = formData.get("password");

    if (
      typeof name !== "string" ||
      typeof email !== "string" ||
      typeof password !== "string"
    ) {
      setError("Vyplň prosím všechna pole.");
      setIsSubmitting(false);
      return;
    }

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        const message =
          (payload && typeof payload.message === "string"
            ? payload.message
            : null) || "Registrace se nezdařila. Zkus to prosím znovu.";
        setError(message);
        return;
      }

      window.location.href = "/";
    } catch (err) {
      setError("Došlo k chybě připojení. Zkus to prosím znovu.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-white flex items-center justify-center">
      <div className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
        <div className="mb-6 space-y-1 text-center">
          <p className="text-xs uppercase tracking-[0.2em] text-neutral-700">
            NRW · nRegSi
          </p>
          <h1 className="text-xl font-semibold tracking-tight text-neutral-900">
            Vytvořit NRW účet
          </h1>
          <p className="text-xs text-neutral-700">
            Získej přístup k nChat, nLove, nReal i nNews s jedním účtem.
          </p>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-1">
            <label className="text-xs font-medium text-neutral-700">
              Jméno / přezdívka
            </label>
            <input
              type="text"
              name="name"
              required
              className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-black focus:ring-1 focus:ring-black/10"
              placeholder="např. Bobby"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-neutral-700">
              E-mail
            </label>
            <input
              type="email"
              name="email"
              required
              className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-black focus:ring-1 focus:ring-black/10"
              placeholder="např. bobby@example.com"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-neutral-700">
              Heslo
            </label>
            <input
              type="password"
              name="password"
              required
              className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-black focus:ring-1 focus:ring-black/10"
              placeholder="Min. 8 znaků"
            />
          </div>

          {error ? (
            <div className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-lg bg-black px-3 py-2 text-sm font-medium text-white hover:bg-black/90 transition disabled:cursor-not-allowed disabled:opacity-80"
          >
            {isSubmitting ? "Zakládáme účet…" : "Vytvořit účet"}
          </button>
        </form>

        <div className="mt-4 flex items-center justify-between text-xs text-neutral-700">
          <span>Už účet máš?</span>
          <Link href="/auth/login" className="hover:text-black transition">
            Přejít na přihlášení
          </Link>
        </div>
      </div>
    </main>
  );
}
