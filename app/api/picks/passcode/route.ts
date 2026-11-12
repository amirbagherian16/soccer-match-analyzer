import { NextResponse } from "next/server";
import { claimPasscode, needsPasscode, storeConfigured } from "@/lib/store";

export const dynamic = "force-dynamic";

/** First-time setup: the first caller creates the passcode that protects writes. */
export async function POST(req: Request) {
  if (!storeConfigured) return NextResponse.json({ error: "Pick storage is not set up" }, { status: 503 });
  if (needsPasscode) return NextResponse.json({ error: "A passcode is already set" }, { status: 409 });
  const body = await req.json().catch(() => null);
  const pass = typeof body?.passcode === "string" ? body.passcode : "";
  if (pass.length < 4 || pass.length > 100) return NextResponse.json({ error: "Use 4 to 100 characters" }, { status: 400 });
  try {
    const ok = await claimPasscode(pass);
    return ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "A passcode is already set" }, { status: 409 });
  } catch {
    return NextResponse.json({ error: "Store error" }, { status: 502 });
  }
}
