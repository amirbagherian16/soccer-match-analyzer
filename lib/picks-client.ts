"use client";
// Client wrapper for /api/picks. Picks live on the server, so every browser sees the same data.
import type { UserPick } from "./score";

export type { UserPick };
export type Status = { configured: boolean; needsPasscode: boolean };
type Snapshot = { status: Status; picks: Record<string, UserPick> };

const PASS_KEY = "sma:passcode"; // only the access passcode is kept in the browser, never your picks
const LEGACY_KEY = "sma:picks:v1"; // picks saved by an earlier version of the site

let snap: Snapshot | null = null;
let inflight: Promise<Snapshot> | null = null;
const listeners = new Set<() => void>();

const pass = () => {
  try { return localStorage.getItem(PASS_KEY) ?? ""; } catch { return ""; }
};
const setPass = (v: string) => {
  try { localStorage.setItem(PASS_KEY, v); } catch { /* ignore */ }
};

export function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}
const emit = () => listeners.forEach((f) => f());

export function loadPicks(force = false): Promise<Snapshot> {
  if (snap && !force) return Promise.resolve(snap);
  if (inflight && !force) return inflight;
  inflight = fetch("/api/picks", { cache: "no-store" })
    .then((r) => r.json())
    .then((j) => {
      snap = { status: { configured: !!j.configured, needsPasscode: !!j.needsPasscode }, picks: j.picks ?? {} };
      inflight = null;
      void migrateLegacy();
      return snap;
    })
    .catch(() => {
      inflight = null;
      return (snap = { status: { configured: false, needsPasscode: false }, picks: {} });
    });
  return inflight;
}

async function send(method: "POST" | "DELETE", url: string, body?: unknown, retried = false): Promise<{ ok: boolean; error?: string }> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const p = pass();
  if (p) headers["x-passcode"] = p;
  const res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
  if (res.status === 401 && !retried) {
    const entered = typeof window !== "undefined" ? window.prompt("Enter your picks passcode") : null;
    if (!entered) return { ok: false, error: "Passcode required" };
    setPass(entered);
    return send(method, url, body, true);
  }
  const j = await res.json().catch(() => ({}));
  return res.ok ? { ok: true } : { ok: false, error: j.error ?? `Error ${res.status}` };
}

/** First save ever: offer to create the passcode that protects your picks (stored hashed on the server). */
async function claimPasscodeIfNeeded() {
  if (!snap?.status.configured || snap.status.needsPasscode || pass()) return;
  try {
    if (sessionStorage.getItem("sma:askedpass")) return;
    sessionStorage.setItem("sma:askedpass", "1");
  } catch { /* ignore */ }
  const entered = window.prompt("First time here: choose a passcode (4+ characters) to protect your picks. You will enter it once in each browser.");
  if (!entered) return;
  const res = await fetch("/api/picks/passcode", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ passcode: entered }) });
  if (res.ok) {
    setPass(entered);
    snap.status.needsPasscode = true;
  } else {
    const j = await res.json().catch(() => ({}));
    window.alert(j.error ?? "Could not set the passcode");
  }
}

export async function savePick(p: Omit<UserPick, "savedAt"> & { savedAt?: string }, opts: { import?: boolean } = {}) {
  await claimPasscodeIfNeeded();
  const r = await send("POST", "/api/picks", { pick: p, import: opts.import === true });
  if (r.ok && snap) {
    snap.picks[p.id] = { ...p, savedAt: p.savedAt ?? new Date().toISOString() };
    emit();
  }
  return r;
}

export async function deletePick(id: string) {
  await claimPasscodeIfNeeded();
  const r = await send("DELETE", `/api/picks?id=${encodeURIComponent(id)}`);
  if (r.ok && snap) {
    delete snap.picks[id];
    emit();
  }
  return r;
}

/** One-time move of picks an older version saved in this browser up to the server, then clear them. */
async function migrateLegacy() {
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw || !snap?.status.configured) return;
    if (snap.status.needsPasscode && !pass()) return; // do not interrupt with a prompt
    const old = JSON.parse(raw) as Record<string, UserPick>;
    let ok = true;
    for (const p of Object.values(old)) {
      if (snap.picks[p.id]) continue;
      const r = await send("POST", "/api/picks", { pick: p, import: true });
      if (!r.ok && r.error !== "Import rejected: not saved before kick-off") ok = false;
      else if (r.ok) snap.picks[p.id] = p;
    }
    if (ok) localStorage.removeItem(LEGACY_KEY);
    emit();
  } catch { /* ignore */ }
}
