import { NextResponse } from "next/server";
import { predictMatch } from "@/lib/predict";

export const maxDuration = 60;

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const slug = q.get("slug") ?? "";
  const date = q.get("date") ?? "";
  const homeId = q.get("homeId") ?? "";
  const awayId = q.get("awayId") ?? "";
  if (!/^[a-z0-9._]+$/i.test(slug) || !/^\d+$/.test(homeId) || !/^\d+$/.test(awayId) || Number.isNaN(Date.parse(date))) {
    return NextResponse.json({ error: "bad params" }, { status: 400 });
  }
  const p = await predictMatch({ slug, date, homeId, awayId });
  if (!p) return NextResponse.json({ error: "unavailable" }, { status: 404 });
  return NextResponse.json(
    { h: p.pick.h, a: p.pick.a, probs: p.blend },
    { headers: { "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=3600" } },
  );
}
