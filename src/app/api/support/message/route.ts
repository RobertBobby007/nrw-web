import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";

const AUTO_REPLY_TEXT =
  "Thanks for your message. Support will get back to you as soon as possible. In the meantime, please describe the issue in as much detail as you can.";

type SupportMessagePayload = {
  threadId?: string;
  content?: string;
  device?: {
    userAgent?: string | null;
    platform?: string | null;
    language?: string | null;
    timezone?: string | null;
    viewportWidth?: number | null;
    viewportHeight?: number | null;
    screenWidth?: number | null;
    screenHeight?: number | null;
    pixelRatio?: number | null;
  } | null;
};

type DeviceMeta = {
  userAgent: string | null;
  deviceType: "mobile" | "tablet" | "desktop" | "bot" | "unknown";
  os: string;
  browser: string;
  platform: string | null;
  language: string | null;
  timezone: string | null;
  viewportWidth: number | null;
  viewportHeight: number | null;
  screenWidth: number | null;
  screenHeight: number | null;
  pixelRatio: number | null;
};

function parseUserAgentDeviceType(uaRaw: string | null): DeviceMeta["deviceType"] {
  const ua = uaRaw ?? "";
  const lower = ua.toLowerCase();
  if (!ua) return "unknown";
  if (/mobile|iphone|android.*mobile|windows phone/.test(lower)) return "mobile";
  if (/ipad|tablet/.test(lower)) return "tablet";
  if (/bot|crawl|spider|crawler/.test(lower)) return "bot";
  return "desktop";
}

function parseOsBrowser(ua: string) {
  const os = /Android/i.test(ua)
    ? "Android"
    : /(iPhone|iPad)/i.test(ua)
    ? "iOS"
    : /Mac OS X/i.test(ua)
    ? "macOS"
    : /Windows NT/i.test(ua)
    ? "Windows"
    : /Linux/i.test(ua)
    ? "Linux"
    : "unknown";

  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /(OPR\/|Opera)/.test(ua)
    ? "Opera"
    : /Chrome\//.test(ua) && !/Edg\/|OPR\//.test(ua)
    ? "Chrome"
    : /Safari\//.test(ua) && !/Chrome\//.test(ua)
    ? "Safari"
    : /Firefox\//.test(ua)
    ? "Firefox"
    : "unknown";

  return { os, browser };
}

function toSafeNumber(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value;
}

function buildDeviceMeta(request: Request, payloadDevice: SupportMessagePayload["device"]): DeviceMeta {
  const headerUa = request.headers.get("user-agent");
  const userAgent = (payloadDevice?.userAgent ?? headerUa ?? "").trim() || null;
  const deviceType = parseUserAgentDeviceType(userAgent);
  const parsed = parseOsBrowser(userAgent ?? "");
  const platformHeader = request.headers.get("sec-ch-ua-platform")?.replace(/^"|"$/g, "") ?? null;
  const payloadPlatform = payloadDevice?.platform?.trim() || null;

  return {
    userAgent,
    deviceType,
    os: parsed.os,
    browser: parsed.browser,
    platform: payloadPlatform ?? platformHeader ?? null,
    language: payloadDevice?.language?.trim() || null,
    timezone: payloadDevice?.timezone?.trim() || null,
    viewportWidth: toSafeNumber(payloadDevice?.viewportWidth),
    viewportHeight: toSafeNumber(payloadDevice?.viewportHeight),
    screenWidth: toSafeNumber(payloadDevice?.screenWidth),
    screenHeight: toSafeNumber(payloadDevice?.screenHeight),
    pixelRatio: toSafeNumber(payloadDevice?.pixelRatio),
  };
}

async function insertSupportUserMessage(payload: {
  threadId: string;
  userId: string;
  content: string;
  deviceMeta: DeviceMeta;
}) {
  const row: Record<string, unknown> = {
    thread_id: payload.threadId,
    sender_type: "user",
    sender_user_id: payload.userId,
    content: payload.content,
    device_meta: payload.deviceMeta,
  };

  while (true) {
    const { error } = await supabaseAdmin.from("support_messages").insert(row);
    if (!error) return null;

    const match = error.message.match(/column \"([^\"]+)\" does not exist/i);
    if (match?.[1] === "device_meta") {
      delete row.device_meta;
      continue;
    }

    return error;
  }
}

async function createOpenSupportThread(userId: string) {
  const { data: created, error } = await supabaseAdmin
    .from("support_threads")
    .insert({ user_id: userId, status: "open" })
    .select("id, user_id, status, auto_reply_sent")
    .single();

  if (error || !created) return { thread: null, error };
  return { thread: created, error: null };
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as SupportMessagePayload | null;
  const threadId = body?.threadId?.trim();
  const content = body?.content?.trim();

  if (!threadId || !content) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  const { data: thread, error: threadError } = await supabaseAdmin
    .from("support_threads")
    .select("id, user_id, status, auto_reply_sent")
    .eq("id", threadId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (threadError) {
    return NextResponse.json({ error: "thread_fetch_failed", message: threadError.message }, { status: 400 });
  }

  if (!thread) {
    return NextResponse.json({ error: "thread_not_found" }, { status: 404 });
  }

  let activeThread = thread;
  if (activeThread.status === "closed") {
    const created = await createOpenSupportThread(user.id);
    if (created.error || !created.thread) {
      return NextResponse.json({ error: "thread_create_failed", message: created.error?.message }, { status: 400 });
    }
    activeThread = created.thread;
  }

  const deviceMeta = buildDeviceMeta(request, body?.device ?? null);
  const insertError = await insertSupportUserMessage({
    threadId: activeThread.id,
    userId: user.id,
    content,
    deviceMeta,
  });

  if (insertError) {
    return NextResponse.json({ error: "message_insert_failed", message: insertError.message }, { status: 400 });
  }

  if (activeThread.auto_reply_sent !== true) {
    const { error: autoError } = await supabaseAdmin.from("support_messages").insert({
      thread_id: activeThread.id,
      sender_type: "system",
      content: AUTO_REPLY_TEXT,
    });

    if (!autoError) {
      await supabaseAdmin
        .from("support_threads")
        .update({ auto_reply_sent: true })
        .eq("id", activeThread.id)
        .eq("user_id", user.id);
    }
  }

  return NextResponse.json({ ok: true, threadId: activeThread.id, status: activeThread.status ?? "open" }, { status: 200 });
}
