import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

function parseUserAgent(ua: string) {
  const lower = ua.toLowerCase();
  let device_type: string = "desktop";
  if (lower.includes("mobile")) device_type = "mobile";
  else if (lower.includes("tablet") || lower.includes("ipad"))
    device_type = "tablet";

  let os = "unknown";
  if (lower.includes("mac os x") || lower.includes("macintosh")) os = "macOS";
  else if (lower.includes("windows")) os = "Windows";
  else if (lower.includes("android")) os = "Android";
  else if (lower.includes("iphone") || lower.includes("ios")) os = "iOS";

  let browser = "unknown";
  if (lower.includes("chrome")) browser = "Chrome";
  else if (lower.includes("safari") && !lower.includes("chrome"))
    browser = "Safari";
  else if (lower.includes("firefox")) browser = "Firefox";
  else if (lower.includes("edg")) browser = "Edge";

  const device = lower.includes("macintosh")
    ? "Mac"
    : lower.includes("iphone")
    ? "iPhone"
    : lower.includes("ipad")
    ? "iPad"
    : lower.includes("android")
    ? "Android"
    : "Unknown";

  return { device_type, os, browser, device };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { user_id, path } = body;

    if (!path) {
      return NextResponse.json(
        { success: false, error: "Missing path" },
        { status: 400 },
      );
    }

    const ipHeader = req.headers.get("x-forwarded-for") ?? "";
    const ip = ipHeader.split(",")[0].trim() || "unknown";
    const ip_short =
      ip === "unknown" ? "unknown" : ip.split(".").slice(0, 2).join(".");

    const ua = req.headers.get("user-agent") || "unknown";
    const platformHeader = req.headers.get("sec-ch-ua-platform") || "";
    const platform = platformHeader.replace(/"/g, "") || ua;

    const { device_type, os, browser, device } = parseUserAgent(ua);

    const { error } = await supabaseAdmin.from("admin_logs").insert({
      user_id: user_id ?? null,
      path,
      ip,
      ip_short,
      user_agent: ua,
      platform,
      device_type,
      os,
      browser,
      device,
    });

    if (error) {
      console.error("admin_logs insert error", error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
