"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  open,
  title,
  message,
  confirmText = "OK",
  cancelText = "Zrušit",
  danger,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (open) {
      cancelRef.current?.focus();
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onCancel();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={onCancel}>
      <div
        className="w-full max-w-md rounded-2xl border border-white/20 bg-white/80 p-4 shadow-2xl backdrop-blur-md"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-start gap-3">
          <div className={`text-xl ${danger ? "text-red-600" : ""}`}>{danger ? "⚠️" : "ℹ️"}</div>
          <div className="flex-1">
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-base font-semibold text-neutral-900">{title}</h3>
              <button
                type="button"
                onClick={onCancel}
                className="rounded-full p-1 text-neutral-500 transition hover:bg-neutral-100"
                aria-label="Zavřít"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {message ? <p className="mt-2 text-sm text-neutral-700">{message}</p> : null}
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            ref={cancelRef}
            onClick={onCancel}
            className="rounded-full px-4 py-2 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-100 focus:outline-none focus:ring-2 focus:ring-neutral-300"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`rounded-full px-4 py-2 text-sm font-semibold text-white transition focus:outline-none focus:ring-2 ${
              danger
                ? "bg-red-600 hover:bg-red-700 focus:ring-red-200"
                : "bg-black hover:bg-neutral-900 focus:ring-neutral-200"
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
