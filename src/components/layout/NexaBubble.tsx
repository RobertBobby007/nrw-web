"use client";

import { Bot, Send, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";

const labels: { prefix: string; message: string; prompt: string }[] = [
  { prefix: "/real", message: "NEXA: trend scout pro nReal", prompt: "Zrekapituluj top 3 nReal momenty." },
  { prefix: "/news", message: "NEXA: shrne dnešní nNews", prompt: "Shrň dnešní NRW News do 2 vět." },
  { prefix: "/love", message: "NEXA: pomůže se superlike copy", prompt: "Navrhni superlike message." },
  { prefix: "/clips", message: "NEXA: tipne hudbu k nClips", prompt: "Vymysli hudbu a popisek pro klip." },
  { prefix: "/chat", message: "NEXA: navrhne odpověď v chatu", prompt: "Co odpovědět Natce na meetup?" },
  { prefix: "/id", message: "NEXA: doladí bio na nID", prompt: "Vylepši bio pro nrw.id." },
];

export function NexaBubble() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const context = useMemo(
    () => labels.find((item) => pathname.startsWith(item.prefix)),
    [pathname]
  );
  const label = context?.message ?? "NEXA AI: rychlá nápověda";
  const prompt = context?.prompt ?? "Zeptej se na cokoliv z NRW.";

  return (
    <div
      className="fixed bottom-[calc(env(safe-area-inset-bottom,0px)+78px)] right-[calc(env(safe-area-inset-right,0px)+12px)] z-50 md:bottom-6 md:right-6"
    >
      {isOpen ? (
        <div className="w-full max-w-[360px] rounded-2xl border border-neutral-200 bg-white shadow-xl shadow-neutral-900/8 sm:w-[320px]">
          <div className="flex items-center justify-between gap-2 rounded-t-2xl bg-neutral-900 px-4 py-3 text-white">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15">
                <Bot className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-neutral-300">NEXA AI</p>
                <p className="text-sm font-semibold">{label}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="rounded-full p-1 text-white/80 transition hover:bg-white/10 hover:text-white"
              aria-label="Zavřít NEXA AI"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-3 px-4 py-4 text-sm text-neutral-800">
            <div className="space-y-2">
              <div className="flex gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-900 text-white">
                  <Bot className="h-4 w-4" />
                </div>
                <div className="rounded-2xl bg-neutral-100 px-3 py-2">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-neutral-500">NEXA</p>
                  <p className="text-neutral-800">
                    {prompt}
                  </p>
                </div>
              </div>
              <div className="flex justify-end">
                <div className="rounded-2xl bg-neutral-900 px-3 py-2 text-white">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-neutral-300">Ty</p>
                  <p>OK, pojď na to.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 border-t border-neutral-200 px-4 py-3">
            <input
              type="text"
              placeholder="Napiš zprávu NEXA AI…"
              className="flex-1 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-800 placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none"
            />
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-lg bg-neutral-900 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-px hover:bg-neutral-800"
            >
              <Send className="h-4 w-4" />
              Poslat
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          aria-label={label}
          title={label}
          onClick={() => setIsOpen(true)}
          className="group relative inline-flex items-center gap-2 rounded-full bg-neutral-900 px-3 py-2 text-sm font-semibold text-white shadow-lg shadow-neutral-900/20 transition hover:-translate-y-px hover:bg-neutral-800"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15">
            <Bot className="h-4 w-4" />
          </div>
          <span className="hidden sm:inline">NEXA AI</span>
          <span className="absolute -right-1.5 -top-1.5 h-3 w-3 rounded-full border-2 border-white bg-emerald-400" />
          <span className="absolute -left-1 bottom-full mb-2 hidden whitespace-nowrap rounded-full bg-neutral-900 px-2 py-1 text-[11px] font-medium text-white shadow-sm sm:group-hover:flex">
            {label}
          </span>
        </button>
      )}
    </div>
  );
}
