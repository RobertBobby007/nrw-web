"use client";

import { useLocale, useTranslations } from "@/components/i18n/LocaleProvider";
import { locales, type Locale } from "@/lib/i18n";

export function LanguageSwitcher({ className = "" }: { className?: string }) {
  const { locale, setLocale } = useLocale();
  const t = useTranslations();

  return (
    <div className={className}>
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-neutral-500">
        {t("common.language")}
      </p>
      <div
        className="inline-flex rounded-full border border-neutral-200 bg-white p-1 shadow-sm"
        role="group"
        aria-label={t("common.language")}
      >
        {locales.map((option) => {
          const active = locale === option;
          return (
            <button
              key={option}
              type="button"
              onClick={() => setLocale(option as Locale)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                active
                  ? "bg-neutral-900 text-white"
                  : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
              }`}
            >
              {t(`common.localeName.${option}`)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
