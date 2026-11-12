// Server-only: user picks in a Redis database over the Upstash REST API (free tier).
// Vercel: Project > Storage > Create > Upstash (Redis) adds these env vars automatically.
import type { UserPick } from "./score";

const URL_ = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
const KEY = "sma:picks";

export const storeConfigured = Boolean(URL_ && TOKEN);
export const needsPasscode = Boolean(process.env.PICKS_PASSCODE);

async function cmd(args: (string | number)[]): Promise<any> {
  const res = await fetch(URL_!, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(args),
    cache: "no-store",
  });
  const j = await res.json();
  if (!res.ok || j.error) throw new Error(j.error ?? `store error ${res.status}`);
  return j.result;
}

export async function allPicks(): Promise<Record<string, UserPick>> {
  const r = await cmd(["HGETALL", KEY]);
  const out: Record<string, UserPick> = {};
  const pairs: [string, string][] = Array.isArray(r)
    ? Array.from({ length: Math.floor(r.length / 2) }, (_, i) => [r[2 * i], r[2 * i + 1]] as [string, string])
    : Object.entries(r ?? {});
  for (const [k, v] of pairs) {
    try {
      out[k] = typeof v === "string" ? JSON.parse(v) : (v as unknown as UserPick);
    } catch {
      /* skip corrupt */
    }
  }
  return out;
}

export async function getPick(id: string): Promise<UserPick | null> {
  const v = await cmd(["HGET", KEY, id]);
  if (!v) return null;
  try {
    return typeof v === "string" ? JSON.parse(v) : v;
  } catch {
    return null;
  }
}

export async function countPicks(): Promise<number> {
  return Number(await cmd(["HLEN", KEY]));
}

export const setPick = (p: UserPick) => cmd(["HSET", KEY, p.id, JSON.stringify(p)]);
export const delPick = (id: string) => cmd(["HDEL", KEY, id]);

// ----- passcode set from the website itself (no Vercel setting needed) -----
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
const PASS_KEY = "sma:pass";

export async function hasStoredPasscode(): Promise<boolean> {
  return Boolean(await cmd(["GET", PASS_KEY]));
}

/** Claim the passcode if none exists yet (atomic). Returns false when one is already set. */
export async function claimPasscode(passcode: string): Promise<boolean> {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(passcode, salt, 32).toString("hex");
  const r = await cmd(["SET", PASS_KEY, `${salt}:${hash}`, "NX"]);
  return r === "OK";
}

export async function checkStoredPasscode(passcode: string): Promise<boolean> {
  const v = await cmd(["GET", PASS_KEY]);
  if (!v || typeof v !== "string") return true; // nothing claimed yet: open until the first passcode is created
  const [salt, hash] = v.split(":");
  const got = scryptSync(passcode, salt, 32);
  const want = Buffer.from(hash, "hex");
  return got.length === want.length && timingSafeEqual(got, want);
}
