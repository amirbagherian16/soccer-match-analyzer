import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { allPicks, checkStoredPasscode, countPicks, delPick, getPick, hasStoredPasscode, needsPasscode, setPick, storeConfigured } from "@/lib/store";
import { getResult } from "@/lib/espn";
import type { UserPick } from "@/lib/score";

export const dynamic = "force-dynamic";
const noStore = { "Cache-Control": "no-store" };

async function authorized(req: Request): Promise<boolean> {
  const got = req.headers.get("x-passcode") ?? "";
  const want = process.env.PICKS_PASSCODE;
  if (want) {
    const a = Buffer.from(got);
    const b = Buffer.from(want);
    return a.length === b.length && timingSafeEqual(a, b);
  }
  try {
    return await checkStoredPasscode(got);
  } catch {
    return false;
  }
}

const str = (v: unknown, max: number) => (typeof v === "string" && v.length > 0 && v.length <= max ? v : null);
const goal = (v: unknown) => (Number.isInteger(v) && (v as number) >= 0 && (v as number) <= 30 ? (v as number) : null);
const logo = (v: unknown) => (typeof v === "string" && /^https:\/\/a\.espncdn\.com\//.test(v) && v.length < 300 ? v : undefined);

function clean(b: any): UserPick | null {
  const id = typeof b?.id === "string" && /^\d{3,12}$/.test(b.id) ? b.id : null;
  const slug = typeof b?.slug === "string" && /^[a-z0-9._]{2,60}$/i.test(b.slug) ? b.slug : null;
  const comp = str(b?.comp, 80);
  const home = str(b?.home, 80);
  const away = str(b?.away, 80);
  const date = typeof b?.date === "string" && !Number.isNaN(Date.parse(b.date)) ? b.date : null;
  const h = goal(b?.h);
  const a = goal(b?.a);
  if (!id || !slug || !comp || !home || !away || !date || h == null || a == null) return null;
  return { id, slug, comp, date, home, away, h, a, homeLogo: logo(b.homeLogo), awayLogo: logo(b.awayLogo), savedAt: new Date().toISOString() };
}

export async function GET() {
  if (!storeConfigured) return NextResponse.json({ configured: false, needsPasscode: false, picks: {} }, { headers: noStore });
  try {
    const needs = needsPasscode || (await hasStoredPasscode());
    return NextResponse.json({ configured: true, needsPasscode: needs, picks: await allPicks() }, { headers: noStore });
  } catch {
    return NextResponse.json({ configured: false, needsPasscode: false, picks: {}, error: "store unavailable" }, { headers: noStore });
  }
}

export async function POST(req: Request) {
  if (!storeConfigured) return NextResponse.json({ error: "Pick storage is not set up" }, { status: 503 });
  if (!(await authorized(req))) return NextResponse.json({ error: "Wrong or missing passcode" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const pick = clean(body?.pick);
  if (!pick) return NextResponse.json({ error: "Invalid pick" }, { status: 400 });

  const kickoff = Date.parse(pick.date);
  if (body?.import === true) {
    // Re-importing an older local pick: only if it was originally saved before kick-off.
    const was = typeof body.pick?.savedAt === "string" ? Date.parse(body.pick.savedAt) : NaN;
    if (Number.isNaN(was) || was > kickoff) return NextResponse.json({ error: "Import rejected: not saved before kick-off" }, { status: 400 });
    pick.savedAt = new Date(was).toISOString();
  } else {
    if (Date.now() >= kickoff) return NextResponse.json({ error: "Kick-off has passed" }, { status: 409 });
    const r = await getResult(pick.slug, pick.id);
    if (r && r.state !== "pre") return NextResponse.json({ error: "Match has started" }, { status: 409 });
  }
  try {
    if (!(await getPick(pick.id)) && (await countPicks()) >= 5000) return NextResponse.json({ error: "Storage full" }, { status: 507 });
    await setPick(pick);
  } catch {
    return NextResponse.json({ error: "Store error" }, { status: 502 });
  }
  return NextResponse.json({ ok: true, pick }, { headers: noStore });
}

export async function DELETE(req: Request) {
  if (!storeConfigured) return NextResponse.json({ error: "Pick storage is not set up" }, { status: 503 });
  if (!(await authorized(req))) return NextResponse.json({ error: "Wrong or missing passcode" }, { status: 401 });
  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!/^\d{3,12}$/.test(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  try {
    const cur = await getPick(id);
    if (cur && Date.now() >= Date.parse(cur.date)) return NextResponse.json({ error: "Kick-off has passed; picks are locked" }, { status: 409 });
    await delPick(id);
  } catch {
    return NextResponse.json({ error: "Store error" }, { status: 502 });
  }
  return NextResponse.json({ ok: true }, { headers: noStore });
}
