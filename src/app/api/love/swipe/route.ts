import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getLoveLocation, getLoveSettings, isLocationFresh, isLoveEnabled, isMissingLoveSchema } from "@/lib/love-access";

type SwipeAction = "pass" | "like" | "superlike";

type SwipePayload = {
  targetUserId?: string;
  action?: SwipeAction;
};

type ChatMemberRow = {
  chat_id: string;
  user_id: string;
};

function normalizePair(a: string, b: string) {
  return a < b ? { userA: a, userB: b } : { userA: b, userB: a };
}

async function getOrCreateDirectChat(userId: string, targetUserId: string) {
  const { data: rows, error: memberError } = await supabaseAdmin
    .from("chat_members")
    .select("chat_id,user_id,chats!inner(type)")
    .in("user_id", [userId, targetUserId])
    .eq("chats.type", "direct");

  if (memberError) {
    throw new Error(`chat_member_fetch_failed:${memberError.message}`);
  }

  const membershipByChatId = new Map<string, Set<string>>();
  ((rows ?? []) as ChatMemberRow[]).forEach((row) => {
    if (!row.chat_id || !row.user_id) return;
    const members = membershipByChatId.get(row.chat_id) ?? new Set<string>();
    members.add(row.user_id);
    membershipByChatId.set(row.chat_id, members);
  });

  for (const [chatId, members] of membershipByChatId) {
    if (members.size === 2 && members.has(userId) && members.has(targetUserId)) {
      return chatId;
    }
  }

  const chatId = randomUUID();
  const { error: chatError } = await supabaseAdmin.from("chats").insert({ id: chatId, type: "direct" });
  if (chatError) {
    throw new Error(`chat_create_failed:${chatError.message}`);
  }

  const { error: membersError } = await supabaseAdmin.from("chat_members").insert([
    { chat_id: chatId, user_id: userId },
    { chat_id: chatId, user_id: targetUserId },
  ]);

  if (membersError) {
    throw new Error(`chat_members_create_failed:${membersError.message}`);
  }

  return chatId;
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

  const [{ data: viewerSettings, error: viewerSettingsError }, { data: viewerLocation, error: viewerLocationError }] =
    await Promise.all([getLoveSettings(user.id), getLoveLocation(user.id)]);
  if (viewerSettingsError || viewerLocationError) {
    const sourceError = viewerSettingsError ?? viewerLocationError;
    if (isMissingLoveSchema(sourceError)) {
      return NextResponse.json(
        { error: "love_not_configured", message: "nLove tables have not been created yet." },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: "settings_fetch_failed", message: sourceError?.message }, { status: 400 });
  }

  if (!isLoveEnabled(viewerSettings)) {
    return NextResponse.json(
      { error: "love_not_enabled", message: "Finish nLove onboarding and enable your nLove profile first." },
      { status: 403 },
    );
  }
  if (!viewerLocation || !isLocationFresh(viewerLocation)) {
    return NextResponse.json(
      { error: "location_required", message: "Active location is required for swiping." },
      { status: 403 },
    );
  }

  const body = (await request.json().catch(() => null)) as SwipePayload | null;
  const targetUserId = body?.targetUserId?.trim() ?? "";
  const action = body?.action;

  if (!targetUserId || targetUserId === user.id) {
    return NextResponse.json({ error: "invalid_target_user" }, { status: 400 });
  }
  if (!action || !["pass", "like", "superlike"].includes(action)) {
    return NextResponse.json({ error: "invalid_action" }, { status: 400 });
  }

  const [
    { data: targetProfile, error: targetError },
    { data: targetLoveSettings, error: targetSettingsError },
    { data: targetLocation, error: targetLocationError },
    { data: existingSwipe, error: existingSwipeError },
  ] =
    await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("id, username, display_name, avatar_url, banned_at")
        .eq("id", targetUserId)
        .is("banned_at", null)
        .maybeSingle(),
      getLoveSettings(targetUserId),
      getLoveLocation(targetUserId),
      supabaseAdmin
        .from("nlove_swipes")
        .select("action")
        .eq("swiper_id", user.id)
        .eq("target_id", targetUserId)
        .maybeSingle(),
    ]);

  if (targetError) {
    return NextResponse.json({ error: "target_profile_fetch_failed", message: targetError.message }, { status: 400 });
  }
  if (!targetProfile) {
    return NextResponse.json({ error: "target_not_found" }, { status: 404 });
  }

  if (targetSettingsError || targetLocationError) {
    const sourceError = targetSettingsError ?? targetLocationError;
    if (isMissingLoveSchema(sourceError)) {
      return NextResponse.json(
        { error: "love_not_configured", message: "nLove tables have not been created yet." },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: "target_settings_fetch_failed", message: sourceError?.message }, { status: 400 });
  }

  if (existingSwipeError && existingSwipeError.code !== "PGRST116") {
    return NextResponse.json(
      { error: "existing_swipe_fetch_failed", message: existingSwipeError.message },
      { status: 400 },
    );
  }

  if (!isLoveEnabled(targetLoveSettings)) {
    return NextResponse.json({ error: "target_not_available" }, { status: 404 });
  }
  if (!targetLocation) {
    return NextResponse.json({ error: "target_not_available" }, { status: 404 });
  }

  if (action === "superlike") {
    const isAlreadySuperlike = (existingSwipe?.action ?? null) === "superlike";
    if (!isAlreadySuperlike) {
      const { error: consumeError, data: remainingCredits } = await supabaseAdmin.rpc("consume_superlike_credit", {
        p_user_id: user.id,
      });

      if (consumeError) {
        const message = consumeError.message ?? "superlike_credit_consume_failed";
        if (message.includes("INSUFFICIENT_SUPERLIKE_CREDITS")) {
          return NextResponse.json(
            {
              error: "superlike_payment_required",
              message: "You need to top up credits through Stripe to use Super Like.",
            },
            { status: 402 },
          );
        }
        return NextResponse.json({ error: "superlike_credit_consume_failed", message }, { status: 400 });
      }

      if (typeof remainingCredits === "number" && remainingCredits < 0) {
        return NextResponse.json({ error: "superlike_credit_negative_guard" }, { status: 400 });
      }
    }
  }

  const { error: swipeError } = await supabaseAdmin.from("nlove_swipes").upsert(
    {
      swiper_id: user.id,
      target_id: targetUserId,
      action,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "swiper_id,target_id" },
  );

  if (swipeError) {
    if (isMissingLoveSchema(swipeError)) {
      return NextResponse.json(
        { error: "love_not_configured", message: "nLove tables have not been created yet." },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: "swipe_store_failed", message: swipeError.message }, { status: 400 });
  }

  if (action === "pass") {
    return NextResponse.json({ matched: false }, { status: 200 });
  }

  const { data: reverseSwipe, error: reverseError } = await supabaseAdmin
    .from("nlove_swipes")
    .select("action")
    .eq("swiper_id", targetUserId)
    .eq("target_id", user.id)
    .in("action", ["like", "superlike"])
    .maybeSingle();

  if (reverseError) {
    if (isMissingLoveSchema(reverseError)) {
      return NextResponse.json(
        { error: "love_not_configured", message: "nLove tables have not been created yet." },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: "reverse_swipe_fetch_failed", message: reverseError.message }, { status: 400 });
  }

  const isMatch = Boolean(reverseSwipe);
  if (!isMatch) {
    return NextResponse.json({ matched: false }, { status: 200 });
  }

  const pair = normalizePair(user.id, targetUserId);

  const { data: existingMatch, error: existingMatchError } = await supabaseAdmin
    .from("nlove_matches")
    .select("id, chat_id")
    .eq("user_a", pair.userA)
    .eq("user_b", pair.userB)
    .maybeSingle();

  if (existingMatchError && existingMatchError.code !== "PGRST116") {
    return NextResponse.json(
      { error: "match_fetch_failed", message: existingMatchError.message },
      { status: 400 },
    );
  }

  let chatId = existingMatch?.chat_id ?? null;

  if (!chatId) {
    try {
      chatId = await getOrCreateDirectChat(user.id, targetUserId);
    } catch (error) {
      const message = error instanceof Error ? error.message : "chat_create_failed";
      return NextResponse.json({ error: "chat_create_failed", message }, { status: 400 });
    }
  }

  let matchId = existingMatch?.id ?? null;

  if (!matchId) {
    const { data: insertedMatch, error: insertMatchError } = await supabaseAdmin
      .from("nlove_matches")
      .insert({ user_a: pair.userA, user_b: pair.userB, chat_id: chatId })
      .select("id")
      .maybeSingle();

    if (insertMatchError) {
      if (isMissingLoveSchema(insertMatchError)) {
        return NextResponse.json(
          { error: "love_not_configured", message: "nLove tables have not been created yet." },
          { status: 503 },
        );
      }
      return NextResponse.json({ error: "match_create_failed", message: insertMatchError.message }, { status: 400 });
    }

    matchId = insertedMatch?.id ?? null;
  } else {
    await supabaseAdmin.from("nlove_matches").update({ chat_id: chatId }).eq("id", matchId);
  }

  return NextResponse.json(
    {
      matched: true,
      match: {
        id: matchId,
        chatId,
        user: {
          id: targetProfile.id,
          username: targetProfile.username,
          displayName: targetProfile.display_name,
          age: typeof targetLoveSettings?.age === "number" ? targetLoveSettings.age : null,
          avatarUrl: targetProfile.avatar_url,
        },
      },
    },
    { status: 200 },
  );
}
