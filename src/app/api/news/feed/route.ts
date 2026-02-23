import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { loadNNewsFeed } from "@/lib/nnews";

export async function GET(req: NextRequest) {
  const raw = Number(req.nextUrl.searchParams.get("limit"));
  const limit = Number.isFinite(raw) ? Math.min(Math.max(Math.trunc(raw), 1), 100) : 30;

  const result = await loadNNewsFeed(supabaseAdmin, limit);
  if (result.error) {
    return NextResponse.json({ success: false, error: result.error, items: [] }, { status: 500 });
  }

  return NextResponse.json({ success: true, table: result.table, items: result.items });
}
