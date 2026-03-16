"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useTranslations } from "@/components/i18n/LocaleProvider";

type ReportReason =
  | "spam"
  | "violence"
  | "nudity"
  | "hate"
  | "harassment"
  | "misinfo"
  | "other";

type ReportDialogProps = {
  open: boolean;
  targetType: "post" | "comment";
  targetId: string;
  onClose: () => void;
};

export function ReportDialog({ open, targetId, targetType, onClose }: ReportDialogProps) {
  const t = useTranslations();
  const [reason, setReason] = useState<ReportReason>("spam");
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setReason("spam");
      setDetails("");
      setError(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  useEffect(() => {
    if (!toastVisible) return;
    const t = setTimeout(() => setToastVisible(false), 2500);
    return () => clearTimeout(t);
  }, [toastVisible]);

  if (!open) return null;

  const handleSubmit = async () => {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        target_type: targetType,
        reason,
        details: details.trim() || null,
      };
      if (targetType === "post") payload.target_post_id = targetId;
      if (targetType === "comment") payload.target_comment_id = targetId;

      const res = await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || !json?.success) {
        if (json?.blocked) {
          setError(t("report.blockedError"));
        } else {
          setError(json?.error || t("report.submitError"));
        }
        return;
      }
      setToastVisible(true);
      onClose();
    } catch (err) {
      console.error("Report request failed", err);
      setError(t("report.submitError"));
    } finally {
      setSubmitting(false);
    }
  };

  const reasons: Array<{ value: ReportReason; label: string }> = [
    { value: "spam", label: t("report.reasons.spam") },
    { value: "violence", label: t("report.reasons.violence") },
    { value: "nudity", label: t("report.reasons.nudity") },
    { value: "hate", label: t("report.reasons.hate") },
    { value: "harassment", label: t("report.reasons.harassment") },
    { value: "misinfo", label: t("report.reasons.misinfo") },
    { value: "other", label: t("report.reasons.other") },
  ];

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={onClose}>
        <div
          className="w-full max-w-md rounded-2xl border border-white/20 bg-white/85 p-4 shadow-2xl backdrop-blur-md"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
        >
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-base font-semibold text-neutral-900">{t("report.title")}</h3>
              <p className="text-sm text-neutral-600">
                {targetType === "post" ? t("report.postQuestion") : t("report.commentQuestion")}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-2 text-neutral-500 transition hover:bg-neutral-100"
              aria-label={t("report.closeAria")}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-4 space-y-2">
            <label className="text-sm font-semibold text-neutral-800">{t("report.reasonLabel")}</label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value as ReportReason)}
              className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-neutral-400"
            >
              {reasons.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
            <label className="text-sm font-semibold text-neutral-800">{t("report.detailsLabel")}</label>
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder={t("report.detailsPlaceholder")}
              rows={3}
              className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-neutral-400"
            />
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
          </div>

          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full px-4 py-2 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-100"
            >
              {t("common.actions.close")}
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={handleSubmit}
              className="rounded-full bg-black px-4 py-2 text-sm font-semibold text-white transition hover:bg-neutral-900 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {t("common.actions.send")}
            </button>
          </div>
        </div>
      </div>
      {toastVisible ? (
        <div className="fixed bottom-4 right-4 z-50 rounded-full bg-black px-4 py-2 text-sm font-semibold text-white shadow-lg">
          {t("report.successToast")}
        </div>
      ) : null}
    </>
  );
}
