"use client";

import { ExternalLink, X } from "lucide-react";
import { useTranslations } from "@/components/i18n/LocaleProvider";

type NewsPreviewModalProps = {
  open: boolean;
  url: string | null;
  title?: string | null;
  onClose: () => void;
};

export function NewsPreviewModal({ open, url, title, onClose }: NewsPreviewModalProps) {
  const t = useTranslations();
  if (!open || !url) return null;
  const previewSrc = `/api/news/preview?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title ?? "")}`;

  return (
    <div className="fixed inset-0 z-[120] bg-black/70 backdrop-blur-sm">
      <div className="flex h-full w-full flex-col bg-white">
        <div className="flex items-center justify-between gap-3 border-b border-neutral-200 px-4 py-3">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-500">{t("news.previewLabel")}</p>
            <p className="truncate text-sm font-semibold text-neutral-900">{title ?? t("news.articleFallback")}</p>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-lg border border-neutral-200 px-3 py-2 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
            >
              {t("common.actions.openOutside")}
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-1 rounded-lg bg-neutral-900 px-3 py-2 text-xs font-medium text-white hover:bg-neutral-800"
            >
              {t("common.actions.close")}
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <div className="relative h-full w-full">
          <iframe title={title ?? t("news.previewLabel")} src={previewSrc} className="h-full w-full border-0" />
        </div>
      </div>
    </div>
  );
}
