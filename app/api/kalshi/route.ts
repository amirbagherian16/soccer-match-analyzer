import { NextResponse } from "next/server";
import { findKalshiMatch } from "@/lib/kalshi";

export const maxDuration = 30;

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const slug = q.get("slug") ?? "";
  const home = q.get("home") ?? "";
  const away = q.get("away") ?? "";
  const date = q.get("date") ?? "";
  if (!/^[a-z0-9._]+$/i.test(slug) || !home || !away || home.length > 80 || away.length > 80 || Number.isNaN(Date.parse(date))) {
    return NextResponse.json({ error: "bad params" }, { status: 400 });
  }
  const r = await findKalshiMatch({ slug, home, away, date });
  return NextResponse.json(r, { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" } });
}
