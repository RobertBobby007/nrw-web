import { NextResponse } from "next/server";

type AlertSeverity = "low" | "moderate" | "high";

type NormalizedAlert = {
  id: string;
  title: string;
  description: string | null;
  severity: AlertSeverity;
  validFrom: string | null;
  validTo: string | null;
};

type RegionAliases = Record<string, string[]>;

const METEOALARM_FEED_URL =
  process.env.METEOALARM_FEED_URL ??
  "https://feeds.meteoalarm.org/feeds/meteoalarm-legacy-rss-czechia";

const regionAliases: RegionAliases = {
  praha: ["praha", "hlavni mesto praha", "hlavní město praha", "hmp", "prg"],
  stredocesky: ["stredocesky", "středočeský", "central bohemian", "stc"],
  jiznicesky: ["jiznicesky", "jihočeský", "south bohemian", "jhc"],
  plzensky: ["plzensky", "plzeňský", "pilsen", "plk"],
  karlovarsky: ["karlovarsky", "karlovarský", "carlsbad", "kvk"],
  ustecky: ["ustecky", "ústecký", "usti", "ulk"],
  liberecky: ["liberecky", "liberecký", "lbk"],
  kralovehradecky: ["kralovehradecky", "královéhradecký", "hradecký", "hkk"],
  pardubicky: ["pardubicky", "pardubický", "pak"],
  vysocina: ["vysocina", "vysočina", "jhk"],
  jihomoravsky: ["jihomoravsky", "jihomoravský", "south moravian", "jmk"],
  olomoucky: ["olomoucky", "olomoucký", "olk"],
  zlinsky: ["zlinsky", "zlínský", "zlk"],
  moravskoslezsky: ["moravskoslezsky", "moravskoslezský", "msk"],
};

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function decodeHtml(value: string) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function stripTags(value: string) {
  return decodeHtml(value).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function detectCanonicalRegion(input: string | null) {
  if (!input) return null;
  const normalized = normalizeText(input);
  const key = Object.keys(regionAliases).find((region) =>
    regionAliases[region]?.some((alias) => normalized.includes(normalizeText(alias))),
  );
  return key ?? null;
}

function extractTag(block: string, tag: string) {
  const direct = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i").exec(block);
  if (direct?.[1]) return stripTags(direct[1]);

  const prefixed = new RegExp(`<[^:>]+:${tag}[^>]*>([\\s\\S]*?)<\\/[^:>]+:${tag}>`, "i").exec(block);
  if (prefixed?.[1]) return stripTags(prefixed[1]);

  return null;
}

function parseDate(raw: string | null) {
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function inferSeverity(sourceText: string): AlertSeverity {
  const text = normalizeText(sourceText);
  const numericLevel = text.match(/level\s*:?\s*(\d)/i)?.[1];
  if (numericLevel === "4" || numericLevel === "3") return "high";
  if (numericLevel === "2") return "moderate";
  if (numericLevel === "1") return "low";

  if (/(red|cervena|červená|high|extreme|very dangerous|dangerous)/.test(text)) return "high";
  if (/(orange|oranzova|oranžová|moderate|potentially dangerous|yellow)/.test(text)) return "moderate";
  return "low";
}

function parseFeedItems(xml: string): NormalizedAlert[] {
  const rssItems = xml.match(/<item\b[\s\S]*?<\/item>/gi) ?? [];
  const atomEntries = xml.match(/<entry\b[\s\S]*?<\/entry>/gi) ?? [];
  const items = rssItems.length ? rssItems : atomEntries;

  return items.map((block, idx) => {
    const title = extractTag(block, "title") ?? "Výstraha Meteoalarm";
    const description =
      extractTag(block, "description") ??
      extractTag(block, "summary") ??
      extractTag(block, "content") ??
      null;

    const id =
      extractTag(block, "guid") ??
      extractTag(block, "id") ??
      extractTag(block, "link") ??
      `${idx}`;

    const validFrom = parseDate(
      extractTag(block, "pubDate") ?? extractTag(block, "updated") ?? extractTag(block, "date"),
    );

    const validToRaw = description?.match(
      /(valid\s*(to|until)|platnost\s*do|plat[ií]\s*do)\s*[:\-]?\s*([^.;\n]+)/i,
    )?.[3];
    const validTo = parseDate(validToRaw ?? null);

    const sourceText = [title, description ?? ""].join(" ");

    return {
      id,
      title,
      description,
      severity: inferSeverity(sourceText),
      validFrom,
      validTo,
    };
  });
}

export async function GET(req: Request) {
  try {
    const requestUrl = new URL(req.url);
    const regionParam = requestUrl.searchParams.get("region");
    const debug = requestUrl.searchParams.get("debug") === "1";
    const region = detectCanonicalRegion(regionParam);
    const rawRegionFilter = normalizeText(regionParam ?? "");

    const response = await fetch(METEOALARM_FEED_URL, {
      next: { revalidate: 300 },
      headers: {
        Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.8",
        "User-Agent": "nrw-web-weather-widget/1.0",
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        {
          alerts: [],
          error: "source_unavailable",
          ...(debug ? { detail: `Meteoalarm status ${response.status} ${response.statusText}` } : {}),
        },
        { status: 200 },
      );
    }

    const xml = await response.text();
    const parsed = parseFeedItems(xml);

    const alerts = parsed
      .filter((alert) => {
        const haystack = normalizeText(`${alert.title} ${alert.description ?? ""}`);
        if (region) {
          return regionAliases[region]?.some((alias) => haystack.includes(normalizeText(alias))) ?? false;
        }
        if (rawRegionFilter) {
          return haystack.includes(rawRegionFilter);
        }
        return true;
      })
      .sort((a, b) => {
        const score = { high: 3, moderate: 2, low: 1 };
        const bySeverity = score[b.severity] - score[a.severity];
        if (bySeverity !== 0) return bySeverity;

        const aTime = a.validFrom ? new Date(a.validFrom).getTime() : 0;
        const bTime = b.validFrom ? new Date(b.validFrom).getTime() : 0;
        return bTime - aTime;
      })
      .filter((alert, index, list) => {
        const fingerprint = normalizeText(`${alert.title}|${alert.description ?? ""}`);
        return list.findIndex((item) => normalizeText(`${item.title}|${item.description ?? ""}`) === fingerprint) === index;
      })
      .slice(0, 1);

    return NextResponse.json({
      alerts,
      region: region ?? regionParam ?? null,
      ...(debug ? { source: METEOALARM_FEED_URL, parsedCount: parsed.length } : {}),
    });
  } catch (error) {
    console.error("meteoalarm alerts error", error);
    const detail = error instanceof Error ? error.message : "unknown";
    return NextResponse.json(
      {
        alerts: [],
        error: "unexpected_error",
        ...(new URL(req.url).searchParams.get("debug") === "1" ? { detail } : {}),
      },
      { status: 200 },
    );
  }
}
