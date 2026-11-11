import { NextResponse } from "next/server";
import { getResult } from "@/lib/espn";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get("slug") ?? "";
  const id = searchParams.get("id") ?? "";
  if (!/^[a-z0-9._]+$/i.test(slug) || !/^\d+$/.test(id)) {
    return NextResponse.json({ error: "bad params" }, { status: 400 });
  }
  const r = await getResult(slug, id);
  return NextResponse.json(r ?? { completed: false, state: "unknown" });
}
