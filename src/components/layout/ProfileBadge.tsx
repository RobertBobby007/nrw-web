"use client";

import { usePathname } from "next/navigation";

const HIDDEN_PREFIXES = ["/support", "/settings", "/id"];

export function ProfileBadge() {
  const pathname = usePathname();
  const isHidden = HIDDEN_PREFIXES.some((prefix) => pathname.startsWith(prefix));

  if (isHidden) return null;

  return (
    <div className="fixed right-4 top-4 z-50 md:right-6 md:top-6">
      <button
        type="button"
        aria-label="Tvůj profil"
        className="relative inline-flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-neutral-900 via-neutral-700 to-neutral-900 text-sm font-semibold text-white shadow-lg shadow-neutral-900/15 ring-2 ring-white transition hover:-translate-y-0.5 hover:shadow-xl hover:shadow-neutral-900/20"
      >
        <span>RK</span>
        <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-white bg-emerald-400" />
      </button>
    </div>
  );
}
