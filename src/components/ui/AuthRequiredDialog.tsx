"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { AuthRequiredDetail } from "@/lib/auth-required";

const DEFAULT_MESSAGE = "Pro tuto akci se musíš přihlásit.";

export function AuthRequiredDialog() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState(DEFAULT_MESSAGE);

  useEffect(() => {
    const handler = (event: Event) => {
      const custom = event as CustomEvent<AuthRequiredDetail>;
      const nextMessage = custom.detail?.message?.trim();
      setMessage(nextMessage || DEFAULT_MESSAGE);
      setOpen(true);
    };

    window.addEventListener("nrw:auth_required", handler);
    return () => {
      window.removeEventListener("nrw:auth_required", handler);
    };
  }, []);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/60 px-4 py-6 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-required-title"
    >
      <div className="w-full max-w-sm rounded-2xl border border-neutral-200 bg-white p-5 shadow-xl">
        <div className="space-y-2">
          <h2 id="auth-required-title" className="text-lg font-semibold text-neutral-900">
            Přihlásit se
          </h2>
          <p className="text-sm text-neutral-600">{message}</p>
        </div>
        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-full px-4 py-2 text-sm font-semibold text-neutral-600 transition hover:text-neutral-900"
          >
            Zavřít
          </button>
          <Link
            href="/auth/login"
            className="rounded-full bg-neutral-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800"
          >
            Přihlásit se
          </Link>
        </div>
      </div>
    </div>
  );
}
