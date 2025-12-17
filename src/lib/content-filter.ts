import { BLOCKED_TERMS } from "./blocked-terms";

const normalizeText = (text: string) =>
  text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");

export function containsBlockedContent(text: string): { hit: boolean; reason?: string } {
  const normalized = normalizeText(text);
  for (const term of BLOCKED_TERMS) {
    if (term.pattern.test(normalized)) {
      return { hit: true, reason: term.reason };
    }
  }
  return { hit: false };
}
