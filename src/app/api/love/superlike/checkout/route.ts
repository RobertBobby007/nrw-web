import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { findSuperlikePack, SUPERLIKE_PACKS } from "@/lib/superlikes";

type CheckoutPayload = {
  packId?: string;
};

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data: settings, error } = await supabaseAdmin
    .from("nlove_profiles")
    .select("superlike_credits")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "credits_fetch_failed", message: error.message }, { status: 400 });
  }

  return NextResponse.json(
    {
      packs: SUPERLIKE_PACKS,
      superlikeCredits: Number(settings?.superlike_credits ?? 0),
      stripeReady: Boolean(process.env.STRIPE_SECRET_KEY),
    },
    { status: 200 },
  );
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

  const body = (await request.json().catch(() => null)) as CheckoutPayload | null;
  const pack = findSuperlikePack(body?.packId ?? "");
  if (!pack) {
    return NextResponse.json({ error: "invalid_pack" }, { status: 400 });
  }

  const stripeReady = Boolean(process.env.STRIPE_SECRET_KEY);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const checkoutUrl = stripeReady && appUrl ? `${appUrl}/love?checkout=superlike&pack=${pack.id}` : null;

  const { data: created, error } = await supabaseAdmin
    .from("nlove_superlike_orders")
    .insert({
      user_id: user.id,
      pack_id: pack.id,
      credits: pack.credits,
      amount_cents: pack.amountCents,
      currency: pack.currency,
      status: "pending",
      payment_provider: "stripe",
      checkout_url: checkoutUrl,
    })
    .select("id, status, checkout_url")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "order_create_failed", message: error.message }, { status: 400 });
  }

  if (!stripeReady) {
    return NextResponse.json(
      {
        error: "stripe_not_connected",
        orderId: created?.id ?? null,
        message: "Stripe is not connected yet. The endpoint is ready, you only need to add Stripe keys and session creation.",
      },
      { status: 503 },
    );
  }

  return NextResponse.json(
    {
      orderId: created?.id ?? null,
      checkoutUrl: created?.checkout_url ?? null,
      status: created?.status ?? "pending",
    },
    { status: 200 },
  );
}
