import { NextRequest, NextResponse } from "next/server";

function isPrivateHost(hostname: string) {
  const h = hostname.toLowerCase();
  if (h === "localhost" || h === "::1") return true;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(h)) {
    if (h.startsWith("10.")) return true;
    if (h.startsWith("127.")) return true;
    if (h.startsWith("192.168.")) return true;
    const second = Number(h.split(".")[1] ?? "0");
    if (h.startsWith("172.") && second >= 16 && second <= 31) return true;
  }
  return false;
}

function sanitizeHtml(html: string, baseUrl: string) {
  let sanitized = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, "")
    .replace(/<object[\s\S]*?<\/object>/gi, "")
    .replace(/<embed[\s\S]*?>/gi, "");

  if (/<head[\s>]/i.test(sanitized)) {
    sanitized = sanitized.replace(/<head(\s[^>]*)?>/i, (m) => `${m}<base href="${baseUrl}">`);
  } else {
    sanitized = `<head><base href="${baseUrl}"></head>${sanitized}`;
  }

  return sanitized;
}

function titleFromUrl(url: URL) {
  const last = url.pathname.split("/").filter(Boolean).pop() ?? url.hostname;
  return decodeURIComponent(last).replace(/[-_]+/g, " ").trim() || url.hostname;
}

function renderFallbackHtml(params: { title: string; url: string; message: string }) {
  const { title, url, message } = params;
  const escapedTitle = title.replace(/[<>&"]/g, "");
  const escapedMessage = message.replace(/[<>&"]/g, "");
  const escapedUrl = url.replace(/"/g, "&quot;");

  return `<!doctype html>
<html lang="cs">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapedTitle}</title>
    <style>
      body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f5f5f5; color: #171717; }
      .wrap { min-height: 100vh; display: grid; place-items: center; padding: 24px; }
      .card { width: min(720px, 100%); background: #fff; border: 1px solid #e5e5e5; border-radius: 14px; padding: 20px; box-shadow: 0 8px 24px rgba(0,0,0,.06); }
      .kicker { font-size: 11px; letter-spacing: .12em; text-transform: uppercase; color: #737373; font-weight: 700; }
      h1 { margin: 10px 0 8px; font-size: 20px; line-height: 1.25; }
      p { margin: 0 0 14px; color: #525252; }
      a { display: inline-block; background: #171717; color: #fff; text-decoration: none; border-radius: 10px; padding: 10px 14px; font-size: 13px; font-weight: 600; }
      .url { margin-top: 12px; font-size: 12px; color: #737373; word-break: break-all; }
    </style>
  </head>
  <body>
    <div class="wrap">
      <article class="card">
        <div class="kicker">Náhled článku</div>
        <h1>${escapedTitle}</h1>
        <p>${escapedMessage}</p>
        <a href="${escapedUrl}" target="_blank" rel="noopener noreferrer">Otevřít originál</a>
        <div class="url">${escapedUrl}</div>
      </article>
    </div>
  </body>
</html>`;
}

function renderReaderHtml(params: { title: string; url: string; body: string }) {
  const escapedTitle = params.title.replace(/[<>&"]/g, "");
  const escapedUrl = params.url.replace(/"/g, "&quot;");
  const escapedBody = params.body
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  return `<!doctype html>
<html lang="cs">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapedTitle}</title>
    <style>
      body { margin: 0; font-family: Georgia, "Times New Roman", serif; background: #fafafa; color: #171717; }
      .wrap { max-width: 860px; margin: 0 auto; padding: 28px 20px 40px; }
      .kicker { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-size: 11px; letter-spacing: .12em; text-transform: uppercase; color: #737373; font-weight: 700; }
      h1 { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 10px 0 14px; font-size: 28px; line-height: 1.2; }
      .top { margin-bottom: 18px; }
      .origin { display: inline-block; border: 1px solid #d4d4d4; border-radius: 10px; padding: 8px 12px; text-decoration: none; color: #171717; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-size: 13px; font-weight: 600; background: #fff; }
      article { background: #fff; border: 1px solid #e5e5e5; border-radius: 14px; padding: 18px; box-shadow: 0 8px 24px rgba(0,0,0,.05); }
      pre { margin: 0; white-space: pre-wrap; word-break: break-word; line-height: 1.7; font-size: 17px; }
    </style>
  </head>
  <body>
    <div class="wrap">
      <div class="top">
        <div class="kicker">Reader mód (fallback)</div>
        <h1>${escapedTitle}</h1>
        <a class="origin" href="${escapedUrl}" target="_blank" rel="noopener noreferrer">Otevřít originál</a>
      </div>
      <article><pre>${escapedBody}</pre></article>
    </div>
  </body>
</html>`;
}

async function fetchWithVariants(url: string) {
  const variants: RequestInit[] = [
    {
      redirect: "follow",
      cache: "no-store",
      headers: {
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "accept-language": "cs-CZ,cs;q=0.9,en-US;q=0.8,en;q=0.7",
      },
    },
    {
      redirect: "follow",
      cache: "no-store",
      headers: {
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "accept-language": "en-US,en;q=0.9",
        referer: new URL(url).origin,
      },
    },
  ];

  let lastResponse: Response | null = null;
  for (const init of variants) {
    try {
      const response = await fetch(url, init);
      if (response.ok) return response;
      lastResponse = response;
    } catch {
      continue;
    }
  }
  return lastResponse;
}

async function fetchReaderFallback(url: URL): Promise<string | null> {
  const stripped = url.toString().replace(/^https?:\/\//, "");
  const mirrorUrl = `https://r.jina.ai/http://${stripped}`;
  try {
    const response = await fetch(mirrorUrl, {
      cache: "no-store",
      headers: {
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        accept: "text/plain,text/markdown;q=0.9,*/*;q=0.8",
      },
    });
    if (!response.ok) return null;
    const text = (await response.text()).trim();
    if (!text || text.length < 80) return null;
    return text.slice(0, 120_000);
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("url");
  const requestedTitle = (req.nextUrl.searchParams.get("title") ?? "").trim();
  if (!raw) {
    return new NextResponse(
      renderFallbackHtml({
        title: "Náhled článku",
        url: "#",
        message: "Chybí URL článku.",
      }),
      { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } },
    );
  }

  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    return new NextResponse(
      renderFallbackHtml({
        title: "Náhled článku",
        url: "#",
        message: "URL článku není platná.",
      }),
      { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } },
    );
  }

  if (!["http:", "https:"].includes(target.protocol)) {
    return new NextResponse(
      renderFallbackHtml({
        title: "Náhled článku",
        url: target.toString(),
        message: "Tento typ odkazu není podporovaný.",
      }),
      { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } },
    );
  }
  if (isPrivateHost(target.hostname)) {
    return new NextResponse(
      renderFallbackHtml({
        title: "Náhled článku",
        url: target.toString(),
        message: "Tuto adresu nelze kvůli bezpečnosti načíst.",
      }),
      { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } },
    );
  }

  try {
    const response = await fetchWithVariants(target.toString());
    const displayTitle = requestedTitle || titleFromUrl(target);

    if (!response) {
      const readerText = await fetchReaderFallback(target);
      if (readerText) {
        return new NextResponse(
          renderReaderHtml({ title: displayTitle, url: target.toString(), body: readerText }),
          { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } },
        );
      }
      return new NextResponse(
        renderFallbackHtml({
          title: displayTitle,
          url: target.toString(),
          message: "Článek se nepodařilo načíst.",
        }),
        { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } },
      );
    }

    if (!response.ok) {
      const readerText = await fetchReaderFallback(target);
      if (readerText) {
        return new NextResponse(
          renderReaderHtml({ title: displayTitle, url: target.toString(), body: readerText }),
          { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } },
        );
      }
      return new NextResponse(
        renderFallbackHtml({
          title: displayTitle,
          url: target.toString(),
          message: `Server cílového webu vrátil ${response.status} a nepovolil náhled v aplikaci.`,
        }),
        { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } },
      );
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html")) {
      return NextResponse.redirect(target.toString(), 302);
    }

    const html = await response.text();
    const cleaned = sanitizeHtml(html, target.toString());

    return new NextResponse(cleaned, {
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    const displayTitle = requestedTitle || titleFromUrl(target);
    const readerText = await fetchReaderFallback(target);
    if (readerText) {
      return new NextResponse(
        renderReaderHtml({ title: displayTitle, url: target.toString(), body: readerText }),
        { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } },
      );
    }
    const message = error instanceof Error ? error.message : "Preview fetch failed";
    return new NextResponse(
      renderFallbackHtml({
        title: displayTitle,
        url: target.toString(),
        message,
      }),
      { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } },
    );
  }
}
