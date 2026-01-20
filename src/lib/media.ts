export const MAX_POST_MEDIA_IMAGES = 3;

export function parseMediaUrls(mediaUrl: string | null | undefined): string[] {
  if (!mediaUrl) return [];
  const trimmed = mediaUrl.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.filter((entry) => typeof entry === "string" && entry.trim().length > 0);
      }
    } catch {
      return [trimmed];
    }
  }
  return [trimmed];
}

export function serializeMediaUrls(urls: string[]): string | null {
  const cleaned = urls.map((url) => url.trim()).filter(Boolean);
  if (cleaned.length === 0) return null;
  if (cleaned.length === 1) return cleaned[0];
  return JSON.stringify(cleaned.slice(0, MAX_POST_MEDIA_IMAGES));
}
