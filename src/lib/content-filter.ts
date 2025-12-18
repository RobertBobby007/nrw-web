import { BLOCKED_TERMS, type BlockedTerm } from "./blocked-terms";

const normalizeBase = (text: string) =>
  text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "");

const applyLeetspeak = (text: string) =>
  text.replace(/[0-9@$€!|]/g, (ch) => {
    switch (ch) {
      case "0":
        return "o";
      case "1":
        return "i";
      case "3":
        return "e";
      case "4":
        return "a";
      case "5":
        return "s";
      case "7":
        return "t";
      case "8":
        return "b";
      case "9":
        return "g";
      case "@":
        return "a";
      case "$":
        return "s";
      case "€":
        return "e";
      case "!":
        return "i";
      case "|":
        return "i";
      default:
        return ch;
    }
  });

const collapseWhitespace = (text: string) => text.replace(/\s+/g, " ").trim();

const toLettersAndSpaces = (text: string) => collapseWhitespace(text.replace(/[^\p{L}]+/gu, " "));

const stripFormatCharacters = (text: string) => text.replace(/\p{Cf}/gu, "");

const toLettersOnly = (text: string) => text.replace(/[^\p{L}]+/gu, "");

function normalizeVariants(text: string): string[] {
  const base = stripFormatCharacters(normalizeBase(text));
  const leet = applyLeetspeak(base);

  const variants = new Set<string>([
    base,
    collapseWhitespace(base),
    toLettersAndSpaces(base),
    toLettersOnly(base),
    leet,
    collapseWhitespace(leet),
    toLettersAndSpaces(leet),
    toLettersOnly(leet),
  ]);

  return [...variants].filter(Boolean);
}

function containsBlocked(text: string, terms: BlockedTerm[]): { hit: boolean; reason?: string } {
  const variants = normalizeVariants(text);
  for (const term of terms) {
    for (const normalized of variants) {
      if (term.pattern.test(normalized)) {
        return { hit: true, reason: term.reason };
      }
    }
  }
  return { hit: false };
}

export function containsBlockedContent(text: string): { hit: boolean; reason?: string } {
  return containsBlocked(text, BLOCKED_TERMS);
}

export function containsBlockedIdentityContent(text: string): { hit: boolean; reason?: string } {
  return containsBlocked(text, BLOCKED_TERMS);
}

export function safeIdentityLabel(
  value: string | null | undefined,
  fallback: string,
): string {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return fallback;
  return containsBlockedIdentityContent(trimmed).hit ? fallback : trimmed;
}
