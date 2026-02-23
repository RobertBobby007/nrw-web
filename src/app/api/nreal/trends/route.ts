import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

type TrendRow = {
  token: string;
  count: number;
  hour: string;
};

export async function GET() {
  const now = new Date();
  const since = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString();
  const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabaseAdmin
    .from("nreal_token_hourly_counts")
    .select("token,count,hour")
    .gte("hour", since);

  if (error || !data) {
    return NextResponse.json({ error: "fetch_failed" }, { status: 500 });
  }

  const recentMap: Record<string, number> = {};
  const prevMap: Record<string, number> = {};

  (data as TrendRow[]).forEach((row) => {
    const bucket = row.hour >= cutoff ? recentMap : prevMap;
    bucket[row.token] = (bucket[row.token] ?? 0) + (row.count ?? 0);
  });

  const items = Object.entries(recentMap)
    .map(([token, recentCount]) => {
      const prevCount = prevMap[token] ?? 0;
      const growthPercent = prevCount === 0 ? null : Math.round(((recentCount - prevCount) / prevCount) * 100);
      return {
        token,
        recentCount,
        prevCount,
        growthPercent,
      };
    })
    .filter((item) => item.recentCount > 0)
    .sort((a, b) => b.recentCount - a.recentCount)
    .slice(0, 5);

  return NextResponse.json({ items }, { status: 200 });
}
