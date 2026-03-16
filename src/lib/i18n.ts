import csMessages from "@/messages/cs.json";
import enMessages from "@/messages/en.json";

export const locales = ["cs", "en"] as const;

export type Locale = (typeof locales)[number];
type TranslationValues = Record<string, string | number>;
type TranslationTree = {
  [key: string]: string | TranslationTree;
};

export const defaultLocale: Locale = "cs";
export const LOCALE_COOKIE_NAME = "nrw-locale";
export const LOCALE_STORAGE_KEY = "nrw.locale";
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

const messages: Record<Locale, TranslationTree> = {
  cs: csMessages as TranslationTree,
  en: enMessages as TranslationTree,
};

export function isLocale(value: string | null | undefined): value is Locale {
  return locales.includes(value as Locale);
}

export function resolveLocale(value: string | null | undefined): Locale {
  return isLocale(value) ? value : defaultLocale;
}

function readPath(tree: TranslationTree, path: string) {
  const segments = path.split(".");
  let current: string | TranslationTree | undefined = tree;

  for (const segment of segments) {
    if (!current || typeof current === "string") return null;
    current = current[segment];
  }

  return typeof current === "string" ? current : null;
}

function interpolate(message: string, values?: TranslationValues) {
  if (!values) return message;
  return message.replace(/\{(\w+)\}/g, (_, key: string) => {
    const value = values[key];
    return value === undefined ? `{${key}}` : String(value);
  });
}

export function translate(locale: Locale, key: string, values?: TranslationValues) {
  const message =
    readPath(messages[locale], key) ??
    readPath(messages[defaultLocale], key) ??
    key;

  return interpolate(message, values);
}
