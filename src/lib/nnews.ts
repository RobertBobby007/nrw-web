import type { SupabaseClient } from "@supabase/supabase-js";

type Row = Record<string, unknown>;
type Client = SupabaseClient;

const NNEWS_TABLES = ["nNews", "nnews", "n_news", "news", "news_items"];
const RSS_TABLE = "rss_sources";

export type NNewsFeedItem = {
  id: string;
  title: string;
  excerpt: string;
  meta: string;
  createdAt: string;
  url: string | null;
  imageUrl: string | null;
  sourceName: string | null;
};

type RssSource = { id: string | null; name: string; url: string };

function rec(v: unknown): Row | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Row) : null;
}

function str(row: Row, keys: string[]): string | null {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function bool(row: Row, keys: string[], fallback = true): boolean {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value !== 0;
    if (typeof value === "string") {
      const n = value.trim().toLowerCase();
      if (["1", "true", "active", "enabled"].includes(n)) return true;
      if (["0", "false", "inactive", "disabled"].includes(n)) return false;
    }
  }
  return fallback;
}

function iso(raw?: string | null): string {
  const d = raw ? new Date(raw) : new Date();
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

function clean(raw?: string | null): string {
  if (!raw) return "";
  return raw
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function tag(block: string, t: string): string | null {
  return block.match(new RegExp(`<${t}[^>]*>([\\s\\S]*?)</${t}>`, "i"))?.[1]?.trim() ?? null;
}

function attr(block: string, node: string, name: string): string | null {
  return block.match(new RegExp(`<${node}\\b[^>]*\\b${name}=["']([^"']+)["'][^>]*>`, "i"))?.[1] ?? null;
}

function firstImageFromHtml(raw?: string | null): string | null {
  if (!raw) return null;
  return raw.match(/<img[^>]+src=["']([^"']+)["'][^>]*>/i)?.[1] ?? null;
}

function mapRow(row: Row, i: number): NNewsFeedItem {
  const createdAt = iso(str(row, ["published_at", "created_at", "pub_date", "updated_at", "date"]));
  const sourceName = str(row, ["source_name", "source", "publisher", "author"]);
  const dateLabel = new Date(createdAt).toLocaleDateString("cs-CZ", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  return {
    id: str(row, ["id", "guid", "uuid", "slug"]) ?? `nnews-${i}`,
    title: str(row, ["title", "headline", "name"]) ?? "Bez názvu",
    excerpt: str(row, ["excerpt", "summary", "description", "content", "text"]) ?? "",
    meta: sourceName ? `${sourceName} · ${dateLabel}` : dateLabel,
    createdAt,
    url: str(row, ["url", "link", "permalink"]),
    imageUrl: str(row, ["image_url", "thumbnail_url", "image", "thumb", "cover_url", "media_url"]),
    sourceName,
  };
}

async function resolveTable(client: Client): Promise<string | null> {
  for (const table of NNEWS_TABLES) {
    const { error } = await client.from(table).select("*").limit(1);
    if (!error) return table;
  }
  return null;
}

async function loadSources(client: Client): Promise<RssSource[]> {
  const { data, error } = await client.from(RSS_TABLE).select("*");
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown[])
    .map(rec)
    .filter(Boolean)
    .map((row) => {
      const r = row as Row;
      return {
        id: str(r, ["id", "uuid"]),
        name: str(r, ["name", "title", "source_name"]) ?? str(r, ["url", "feed_url", "rss_url"]) ?? "RSS",
        url: str(r, ["url", "feed_url", "rss_url"]) ?? "",
        active: bool(r, ["is_active", "active", "enabled", "status"], true),
      };
    })
    .filter((s) => s.url && s.active)
    .map(({ id, name, url }) => ({ id, name, url }));
}

function parseFeed(xml: string) {
  const blocks = xml.match(/<item\b[\s\S]*?<\/item>/gi) ?? xml.match(/<entry\b[\s\S]*?<\/entry>/gi) ?? [];
  return blocks
    .map((block) => {
      const title = clean(tag(block, "title"));
      const description = tag(block, "description");
      const summary = tag(block, "summary");
      const content = tag(block, "content");
      const excerpt = clean(description ?? summary ?? content);
      const linkText = clean(tag(block, "link"));
      const linkHref = block.match(/<link[^>]+href=["']([^"']+)["'][^>]*>/i)?.[1] ?? null;
      const guid = clean(tag(block, "guid") ?? tag(block, "id"));
      const publishedAt = iso(tag(block, "pubDate") ?? tag(block, "published") ?? tag(block, "updated"));
      const imageUrl =
        attr(block, "enclosure", "url") ??
        attr(block, "media:content", "url") ??
        attr(block, "media:thumbnail", "url") ??
        firstImageFromHtml(content) ??
        firstImageFromHtml(description) ??
        null;
      if (!title && !excerpt) return null;
      return {
        title: title || "Bez názvu",
        excerpt,
        link: linkHref ?? (linkText || null),
        guid: guid || null,
        publishedAt,
        imageUrl,
      };
    })
    .filter(Boolean) as Array<{
      title: string;
      excerpt: string;
      link: string | null;
      guid: string | null;
      publishedAt: string;
      imageUrl: string | null;
    }>;
}

async function loadFromRss(client: Client, limit: number): Promise<NNewsFeedItem[]> {
  const sources = await loadSources(client);
  const maxSources = Math.min(sources.length, 10);
  const perSource = Math.max(1, Math.ceil(limit / Math.max(maxSources, 1)));
  const items: NNewsFeedItem[] = [];

  for (const source of sources.slice(0, maxSources)) {
    try {
      const res = await fetch(source.url, { cache: "no-store" });
      if (!res.ok) continue;
      const entries = parseFeed(await res.text()).slice(0, perSource);
      for (const entry of entries) {
        const dateLabel = new Date(entry.publishedAt).toLocaleDateString("cs-CZ", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        });
        items.push({
          id: `${source.id ?? source.name}:${entry.guid ?? entry.link ?? entry.title}`,
          title: entry.title,
          excerpt: entry.excerpt,
          meta: `${source.name} · ${dateLabel}`,
          createdAt: entry.publishedAt,
          url: entry.link,
          imageUrl: entry.imageUrl,
          sourceName: source.name,
        });
      }
    } catch {
      continue;
    }
  }

  return items.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)).slice(0, limit);
}

export async function loadNNewsFeed(client: Client, limit = 30): Promise<{
  items: NNewsFeedItem[];
  table: string | null;
  error: string | null;
}> {
  const table = await resolveTable(client);
  if (!table) {
    try {
      const items = await loadFromRss(client, limit);
      return { items, table: null, error: null };
    } catch (error) {
      return { items: [], table: null, error: error instanceof Error ? error.message : "nNews table not found" };
    }
  }

  const { data, error } = await client.from(table).select("*").limit(limit);
  if (error) return { items: [], table, error: error.message };
  const items = ((data ?? []) as unknown[])
    .map(rec)
    .filter(Boolean)
    .map((row, i) => mapRow(row as Row, i))
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  return { items, table, error: null };
}
