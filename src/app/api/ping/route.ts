import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

function parseUserAgent(uaRaw: string | null) {
  const ua = uaRaw ?? "";
  const lower = ua.toLowerCase();

  let deviceType: string = "unknown";

  if (!ua) {
    deviceType = "unknown";
  } else if (/mobile|iphone|android.*mobile|windows phone/.test(lower)) {
    deviceType = "mobile";
  } else if (/ipad|tablet/.test(lower)) {
    deviceType = "tablet";
  } else if (/bot|crawl|spider|crawler/.test(lower)) {
    deviceType = "bot";
  } else {
    deviceType = "desktop";
  }

  return {
    deviceType,
  };
}

function parseOsBrowser(ua: string, deviceType?: string) {
  const os = /Android/i.test(ua)
    ? "Android"
    : /(iPhone|iPad)/i.test(ua)
    ? "iOS"
    : /Mac OS X/i.test(ua)
    ? "macOS"
    : /Windows NT/i.test(ua)
    ? "Windows"
    : "unknown";

  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /(OPR\/|Opera)/.test(ua)
    ? "Opera"
    : /Chrome\//.test(ua) && !/Edg\/|OPR\//.test(ua)
    ? "Chrome"
    : /Safari\//.test(ua) && !/Chrome\//.test(ua)
    ? "Safari"
    : "unknown";

  return { os, browser, device: deviceType ?? "unknown" };
}

async function safeUpsertOnlineUsers(payload: Record<string, unknown>) {
  const currentPayload = { ...payload };

  while (true) {
    const { error } = await supabaseAdmin
      .from("online_users")
      .upsert(currentPayload, { onConflict: "ip" });

    if (!error) return { error: null };

    const match = error.message.match(/column \"([^\"]+)\" does not exist/i);
    if (match) {
      const missingColumn = match[1];
      delete currentPayload[missingColumn];
      console.error(`online_users upsert missing column ${missingColumn}, retrying without it`);
      continue;
    }

    return { error };
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { user_id: userId, path } = body ?? {};

  // IP – preferuj x-forwarded-for, fallback na localhost
  const rawIpHeader =
    req.headers.get("x-forwarded-for") ??
    req.headers.get("x-real-ip") ??
    "unknown";

  let ip = rawIpHeader.split(",")[0].trim();
  if (!ip || ip === "unknown") {
    // lokální dev
    ip = "::1";
  }

  let ip_short: string;
  if (ip === "::1" || ip === "127.0.0.1") {
    ip_short = "localhost";
  } else if (ip.includes(".")) {
    // IPv4 – zkrať na první tři oktety
    const parts = ip.split(".");
    ip_short = parts.slice(0, 3).join(".") + ".x";
  } else {
    // IPv6 – vezmi první 4 bloky
    const parts = ip.split(":").filter(Boolean);
    ip_short = parts.slice(0, 4).join(":") + "::";
  }

  const userAgent = req.headers.get("user-agent");
  const { deviceType } = parseUserAgent(userAgent);
  const uaString = userAgent ?? "";
  const platformHeader = req.headers.get("sec-ch-ua-platform");

  const { os, browser, device } = parseOsBrowser(uaString, deviceType);
  const platform = platformHeader?.replace(/^"|"$/g, "") || os;

  const upsertPayload = {
    ip,
    user_id: userId ?? null,
    path,
    last_seen_at: new Date().toISOString(),
    user_agent: uaString || null,
    device_type: deviceType,
    os,
    browser,
    platform,
    device,
    ip_short,
  };

  const { error: upsertError } = await safeUpsertOnlineUsers(upsertPayload);

  if (upsertError) {
    console.error("online_users upsert error", upsertError);
    return NextResponse.json(
      { success: false, error: upsertError.message },
      { status: 500 }
    );
  }

  if (userId) {
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .update({ last_seen_at: new Date().toISOString() })
      .eq("id", userId);

    if (profileError) {
      console.error("profiles last_seen update error", profileError);
    }
  }

  return NextResponse.json({ success: true });
}

export async function GET() {
  const thirtySecondsAgo = new Date(Date.now() - 30_000).toISOString();

  const { count, error: countError } = await supabaseAdmin
    .from("online_users")
    .select("*", { head: true, count: "exact" })
    .gt("last_seen_at", thirtySecondsAgo);

  if (countError) {
    console.error("online_users count error", countError);
    return NextResponse.json(
      { success: false, error: countError.message },
      { status: 500 }
    );
  }

  const { data: recent, error: listError } = await supabaseAdmin
    .from("online_users")
    .select("*")
    .order("last_seen_at", { ascending: false })
    .limit(20);

  if (listError) {
    console.error("online_users list error", listError);
    return NextResponse.json(
      { success: false, error: listError.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    onlineCount: count ?? 0,
    recent: recent ?? [],
  });
}
