"use client";
import type { Pick } from "./score";

export type UserPick = Pick & {
  id: string;
  slug: string;
  comp: string;
  date: string;
  home: string;
  homeLogo?: string;
  away: string;
  awayLogo?: string;
  savedAt: string;
};

const KEY = "sma:picks:v1";

export function loadPicks(): Record<string, UserPick> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}");
  } catch {
    return {};
  }
}

export function savePick(p: UserPick) {
  try {
    const all = loadPicks();
    all[p.id] = p;
    localStorage.setItem(KEY, JSON.stringify(all));
    return true;
  } catch {
    return false;
  }
}

export function deletePick(id: string) {
  try {
    const all = loadPicks();
    delete all[id];
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    /* ignore */
  }
}

export function replaceAll(picks: Record<string, UserPick>) {
  try {
    localStorage.setItem(KEY, JSON.stringify(picks));
  } catch {
    /* ignore */
  }
}
