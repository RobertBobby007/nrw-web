"use client";

import { AlertTriangle, Info, Link2, Siren } from "lucide-react";
import { useFullscreenAnnouncement } from "@/hooks/useFullscreenAnnouncement";

type FullscreenAnnouncementProps = {
  userId?: string | null;
};

type SeverityKey = "info" | "warn" | "urgent";

const severityConfig: Record<
  SeverityKey,
  {
    label: string;
    icon: typeof Info;
    badge: string;
    iconWrap: string;
    topBar: string;
    action: string;
    linkButton: string;
  }
> = {
  info: {
    label: "Informace",
    icon: Info,
    badge: "bg-sky-100 text-sky-700 ring-1 ring-sky-200",
    iconWrap: "bg-sky-100 text-sky-600 ring-1 ring-sky-200",
    topBar: "bg-sky-500",
    action: "bg-sky-600 hover:bg-sky-700",
    linkButton: "border-sky-200 text-sky-700 hover:bg-sky-50",
  },
  warn: {
    label: "Upozornění",
    icon: AlertTriangle,
    badge: "bg-amber-100 text-amber-800 ring-1 ring-amber-200",
    iconWrap: "bg-amber-100 text-amber-700 ring-1 ring-amber-200",
    topBar: "bg-amber-500",
    action: "bg-amber-600 hover:bg-amber-700",
    linkButton: "border-amber-200 text-amber-800 hover:bg-amber-50",
  },
  urgent: {
    label: "Urgentní",
    icon: Siren,
    badge: "bg-rose-100 text-rose-700 ring-1 ring-rose-200",
    iconWrap: "bg-rose-100 text-rose-600 ring-1 ring-rose-200",
    topBar: "bg-rose-500",
    action: "bg-rose-600 hover:bg-rose-700",
    linkButton: "border-rose-200 text-rose-700 hover:bg-rose-50",
  },
};

function resolveSeverity(value?: string | null, color?: string | null): SeverityKey {
  const token = `${value ?? ""} ${color ?? ""}`.toLowerCase();
  if (
    token.includes("urgent") ||
    token.includes("critical") ||
    token.includes("danger") ||
    token.includes("red")
  ) {
    return "urgent";
  }
  if (
    token.includes("warn") ||
    token.includes("alert") ||
    token.includes("amber") ||
    token.includes("yellow") ||
    token.includes("orange")
  ) {
    return "warn";
  }
  return "info";
}

export function FullscreenAnnouncement({
  userId,
}: FullscreenAnnouncementProps) {
  const { announcement, dismiss } = useFullscreenAnnouncement(userId);

  if (!announcement) {
    return null;
  }

  const severity = resolveSeverity(announcement.severity, announcement.color);
  const config = severityConfig[severity];
  const SeverityIcon = config.icon;
  const rawUrl =
    (announcement.url ?? announcement.link_url ?? "").trim();
  const hasUrl = rawUrl.length > 0;
  const linkLabel = (announcement.link_label ?? "Otevřít odkaz").trim();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/70 px-4 py-6 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="fullscreen-announcement-title"
    >
      <div className="relative flex w-full max-w-2xl max-h-[85vh] flex-col overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-neutral-200">
        <div className={`h-1 w-full ${config.topBar}`} />
        <div className="flex items-start justify-between gap-4 border-b border-neutral-200/80 px-6 py-5">
          <div className="flex items-start gap-4">
            <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${config.iconWrap}`}>
              <SeverityIcon className="h-6 w-6" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${config.badge}`}>
                  {config.label}
                </span>
                <span className="text-xs uppercase tracking-[0.2em] text-neutral-400">
                  Oznámení
                </span>
              </div>
              <h2
                id="fullscreen-announcement-title"
                className="mt-2 text-2xl font-semibold text-neutral-900"
              >
                {announcement.title ?? "Oznámení"}
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={dismiss}
            className="rounded-full p-2 text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-700"
            aria-label="Zavřít"
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="text-sm leading-relaxed text-neutral-700 whitespace-pre-wrap">
            {announcement.body ?? ""}
          </div>
          {hasUrl ? (
            <div className="mt-6 rounded-2xl border border-neutral-200/80 bg-neutral-50/80 p-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <span className={`mt-0.5 flex h-9 w-9 items-center justify-center rounded-full ${config.badge}`}>
                    <Link2 className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-neutral-900">
                      Odkaz k oznámení
                    </p>
                    <p className="text-xs text-neutral-500 break-all">
                      {rawUrl}
                    </p>
                  </div>
                </div>
                <a
                  href={rawUrl}
                  target="_blank"
                  rel="noreferrer"
                  className={`inline-flex items-center justify-center rounded-full border px-4 py-2 text-sm font-semibold transition ${config.linkButton}`}
                >
                  {linkLabel || "Otevřít odkaz"}
                </a>
              </div>
            </div>
          ) : null}
        </div>
        <div className="flex justify-end border-t border-neutral-200/80 px-6 py-4">
          <button
            type="button"
            onClick={dismiss}
            className={`rounded-full px-4 py-2 text-sm font-semibold text-white transition ${config.action}`}
          >
            Zavřít
          </button>
        </div>
      </div>
    </div>
  );
}
