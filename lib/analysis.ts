/* eslint-disable @typescript-eslint/no-explicit-any */
import { getRoster, getSummary, getTeamSchedule, getTeamXg, type Result, type TeamRef } from "./espn";
import { isFriendly } from "./leagues";

export type Form = { last5: Result[]; w: number; d: number; l: number };

/** Results are newest first. */
export function formOf(results: Result[], n = 5): Form {
  const last5 = results.slice(0, n);
  return {
    last5,
    w: last5.filter((r) => r.outcome === "W").length,
    d: last5.filter((r) => r.outcome === "D").length,
    l: last5.filter((r) => r.outcome === "L").length,
  };
}

export type PlayerAgg = {
  id: string;
  name: string;
  pos: "GK" | "DEF" | "MID" | "ATT" | "UNK";
  apps: number;
  goals: number;
  assists: number;
  shots: number;
  sot: number;
  saves: number;
  conceded: number;
  cleanSheets: number;
  yellow: number;
  red: number;
  score: number;
};

export type MatchXg = { id: string; xg: number; shots: number; sot: number };

export type TeamAnalysis = {
  team: TeamRef;
  comp: string; // slug or "all"
  played: number;
  formComp: Form;
  formAll: Form;
  goalsFor: number;
  goalsAgainst: number;
  cleanSheets: number;
  last10: Result[];
  /** Real ESPN xG per match id; missing when ESPN does not publish it. */
  xgByMatch: Record<string, number>;
  topScorer: PlayerAgg | null;
  best: Record<"ATT" | "MID" | "DEF" | "GK", PlayerAgg[]>;
  competitions: { slug: string; n: number }[];
  next: { opp: string; date: string; slug: string; home: boolean } | null;
};

const stat = (list: any[] | undefined, name: string): number => {
  const s = list?.find((x) => x.name === name);
  return s ? Number(s.displayValue ?? s.value) || 0 : 0;
};

function groupOf(abbr: string | undefined): PlayerAgg["pos"] {
  if (!abbr) return "UNK";
  const a = abbr.toUpperCase();
  if (a === "G" || a === "GK") return "GK";
  if (/^(CD|CB|LB|RB|WB|SW|D)/.test(a)) return "DEF";
  if (/^(CM|DM|AM|LM|RM|CAM|CDM|M)/.test(a)) return "MID";
  if (/^(F|ST|CF|LF|RF|LW|RW|S|W)/.test(a)) return "ATT";
  return "UNK";
}

function rate(p: PlayerAgg): number {
  switch (p.pos) {
    case "ATT":
      return p.goals * 4 + p.assists * 3 + p.sot * 0.5 + p.shots * 0.1;
    case "MID":
      return p.goals * 3.5 + p.assists * 3.5 + p.sot * 0.4 + p.shots * 0.1 + p.apps * 0.3;
    case "DEF":
      return (
        p.goals * 5 + p.assists * 3 + p.cleanSheets * 1.5 - p.conceded * 0.2 + p.apps * 0.3 - p.yellow * 0.3 - p.red * 2
      );
    case "GK":
      return p.cleanSheets * 3 + p.saves * 0.6 - p.conceded * 0.8 + p.apps * 0.2;
    default:
      return 0;
  }
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (i < items.length) {
        const idx = i++;
        out[idx] = await fn(items[idx]);
      }
    }),
  );
  return out;
}

const MAX_MATCHES = 40;

export async function analyzeTeam(teamId: string, comp: string): Promise<TeamAnalysis | null> {
  const sched = await getTeamSchedule(teamId);
  if (!sched) return null;

  const all = sched.results.filter((r) => !isFriendly(r.slug));
  const scoped = comp === "all" ? all : sched.results.filter((r) => r.slug === comp);
  const inScope = scoped.slice(0, MAX_MATCHES);

  const counts = new Map<string, number>();
  for (const r of all) counts.set(r.slug, (counts.get(r.slug) ?? 0) + 1);

  const goalsFor = scoped.reduce((s, r) => s + r.gf, 0);
  const goalsAgainst = scoped.reduce((s, r) => s + r.ga, 0);

  const fetched = await mapLimit(inScope, 6, async (r) => ({
    sum: await getSummary(r.slug, r.id),
    xg: await getTeamXg(r.slug, r.id, teamId),
  }));
  const summaries = fetched.map((f) => f.sum);
  const roster = await getRoster(inScope[0]?.slug ?? "all", teamId);

  const xgByMatch: Record<string, number> = {};
  const players = new Map<string, PlayerAgg>();

  summaries.forEach((sum, idx) => {
    if (!sum) return;
    const r = inScope[idx];
    const real = fetched[idx].xg;
    if (real != null) xgByMatch[r.id] = +real.toFixed(2);
    const ros = sum.rosters?.find((x: any) => String(x.team?.id) === teamId);
    for (const p of ros?.roster ?? []) {
      const id = String(p.athlete?.id);
      const st = p.stats as any[] | undefined;
      const apps = stat(st, "appearances");
      if (!apps) continue;
      const abbr = roster.get(id) ?? (p.position?.abbreviation !== "SUB" ? p.position?.abbreviation : undefined);
      let a = players.get(id);
      if (!a) {
        a = {
          id,
          name: p.athlete?.displayName ?? "Unknown",
          pos: groupOf(abbr),
          apps: 0, goals: 0, assists: 0, shots: 0, sot: 0, saves: 0,
          conceded: 0, cleanSheets: 0, yellow: 0, red: 0, score: 0,
        };
        players.set(id, a);
      }
      if (a.pos === "UNK") a.pos = groupOf(abbr);
      a.apps += apps;
      a.goals += stat(st, "totalGoals");
      a.assists += stat(st, "goalAssists");
      a.shots += stat(st, "totalShots");
      a.sot += stat(st, "shotsOnTarget");
      a.saves += stat(st, "saves");
      a.conceded += stat(st, "goalsConceded");
      a.yellow += stat(st, "yellowCards");
      a.red += stat(st, "redCards");
      if (p.starter && r.ga === 0) a.cleanSheets += 1;
    }
  });

  const list = [...players.values()].map((p) => ({ ...p, score: +rate(p).toFixed(1) }));
  const top = (pos: PlayerAgg["pos"]) =>
    list.filter((p) => p.pos === pos).sort((a, b) => b.score - a.score).slice(0, 3);
  const topScorer =
    [...list].filter((p) => p.goals > 0).sort((a, b) => b.goals - a.goals || b.assists - a.assists)[0] ?? null;

  const nextUp = sched.upcoming.find((u) => comp === "all" || u.slug === comp) ?? sched.upcoming[0] ?? null;

  return {
    team: sched.team,
    comp,
    played: scoped.length,
    formComp: formOf(scoped),
    formAll: formOf(all),
    goalsFor,
    goalsAgainst,
    cleanSheets: scoped.filter((r) => r.ga === 0).length,
    last10: scoped.slice(0, 10),
    xgByMatch,
    topScorer,
    best: { ATT: top("ATT"), MID: top("MID"), DEF: top("DEF"), GK: top("GK") },
    competitions: [...counts.entries()].map(([slug, n]) => ({ slug, n })).sort((a, b) => b.n - a.n),
    next: nextUp,
  };
}
