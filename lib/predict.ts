import { getLeagueTeamIds, getTeamSchedule, type Result } from "./espn";
import { isFriendly, isDomesticLeague, isNational } from "./leagues";

export type Probs = { h: number; d: number; a: number };

export type Prediction = {
  lambdaH: number;
  lambdaA: number;
  poisson: Probs;
  elo: (Probs & { ratingH: number; ratingA: number; teams: number }) | null;
  blend: Probs;
  over25: number;
  under25: number;
  btts: number;
  scores: { h: number; a: number; p: number }[];
  sampleH: number;
  sampleA: number;
  pick: ScorePick;
};

export type ScorePick = { h: number; a: number; p: number; outcome: "H" | "D" | "A" };

const PRIOR_GOALS = 1.35; // typical goals per team per game
const PRIOR_WEIGHT = 4; // pseudo-matches pulling small samples toward the prior
const RECENT = 15;

function pmf(l: number, max: number): number[] {
  const out = [Math.exp(-l)];
  for (let k = 1; k <= max; k++) out.push((out[k - 1] * l) / k);
  return out;
}

function rates(results: Result[]) {
  const n = results.length;
  const gf = results.reduce((s, r) => s + r.gf, 0);
  const ga = results.reduce((s, r) => s + r.ga, 0);
  return {
    n,
    scored: (gf + PRIOR_GOALS * PRIOR_WEIGHT) / (n + PRIOR_WEIGHT),
    conceded: (ga + PRIOR_GOALS * PRIOR_WEIGHT) / (n + PRIOR_WEIGHT),
  };
}

/** Results strictly before `before` (ISO), friendlies excluded, newest first, capped. */
function history(results: Result[], before: string): Result[] {
  return results
    .filter((r) => r.date < before && !isFriendly(r.slug))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, RECENT);
}

export function poissonModel(lambdaH: number, lambdaA: number) {
  const MAX = 10;
  const ph = pmf(lambdaH, MAX);
  const pa = pmf(lambdaA, MAX);
  let h = 0, d = 0, a = 0, over = 0, btts = 0;
  const scores: { h: number; a: number; p: number }[] = [];
  for (let i = 0; i <= MAX; i++) {
    for (let j = 0; j <= MAX; j++) {
      const p = ph[i] * pa[j];
      if (i > j) h += p; else if (i === j) d += p; else a += p;
      if (i + j >= 3) over += p;
      if (i > 0 && j > 0) btts += p;
      scores.push({ h: i, a: j, p });
    }
  }
  const tot = h + d + a; // renormalise the truncated grid
  scores.sort((x, y) => y.p - x.p);
  return {
    probs: { h: h / tot, d: d / tot, a: a / tot },
    over25: over / tot,
    btts: btts / tot,
    scores: scores.slice(0, 5).map((s) => ({ ...s, p: s.p / tot })),
  };
}

/* ---------- Elo (domestic leagues only) ---------- */
const ELO_START = 1500;
const ELO_K = 24;
const ELO_HOME = 65;

const expected = (diff: number) => 1 / (1 + Math.pow(10, -diff / 400));

/** Convert an Elo expected score into win/draw/loss. Draws are likelier between close teams. */
export function eloToProbs(e: number): Probs {
  const d = Math.max(0.12, 0.3 - Math.abs(e - 0.5) * 0.5);
  return { h: e - d / 2, d, a: 1 - e - d / 2 };
}

async function leagueElo(slug: string, before: string, homeId: string, awayId: string) {
  const ids = await getLeagueTeamIds(slug);
  if (!ids.includes(homeId) || !ids.includes(awayId)) return null;
  const scheds = await Promise.all(ids.map((id) => getTeamSchedule(id)));
  const games = new Map<string, { date: string; h: string; a: string; gh: number; ga: number }>();
  scheds.forEach((s, i) => {
    if (!s) return;
    for (const r of s.results) {
      if (r.slug !== slug || r.date >= before || games.has(r.id)) continue;
      const me = ids[i];
      games.set(r.id, r.home
        ? { date: r.date, h: me, a: r.oppId, gh: r.gf, ga: r.ga }
        : { date: r.date, h: r.oppId, a: me, gh: r.ga, ga: r.gf });
    }
  });
  const rating = new Map<string, number>(ids.map((id) => [id, ELO_START]));
  const ordered = [...games.values()].sort((x, y) => x.date.localeCompare(y.date));
  for (const g of ordered) {
    const rh = rating.get(g.h) ?? ELO_START;
    const ra = rating.get(g.a) ?? ELO_START;
    const e = expected(rh + ELO_HOME - ra);
    const s = g.gh > g.ga ? 1 : g.gh === g.ga ? 0.5 : 0;
    const gd = Math.abs(g.gh - g.ga);
    const mult = gd <= 1 ? 1 : gd === 2 ? 1.5 : (11 + gd) / 8; // bigger wins move ratings more
    const delta = ELO_K * mult * (s - e);
    rating.set(g.h, rh + delta);
    rating.set(g.a, ra - delta);
  }
  const ratingH = rating.get(homeId) ?? ELO_START;
  const ratingA = rating.get(awayId) ?? ELO_START;
  return { ratingH, ratingA, teams: ids.length, probs: eloToProbs(expected(ratingH + ELO_HOME - ratingA)) };
}

/**
 * Exact-score pick: take the most likely RESULT from the blended probabilities, then choose the
 * most likely scoreline (Poisson grid) among scorelines that produce that result.
 * This avoids always answering 1-1 / 1-0 just because those single cells are individually common.
 */
export function pickScore(lambdaH: number, lambdaA: number, blend: Probs): ScorePick {
  const outcome: "H" | "D" | "A" =
    blend.h >= blend.d && blend.h >= blend.a ? "H" : blend.a >= blend.d ? "A" : "D";
  const MAX = 8;
  const ph = pmf(lambdaH, MAX);
  const pa = pmf(lambdaA, MAX);
  let best: ScorePick = { h: 1, a: 1, p: -1, outcome };
  for (let i = 0; i <= MAX; i++) {
    for (let j = 0; j <= MAX; j++) {
      const o = i > j ? "H" : i === j ? "D" : "A";
      if (o !== outcome) continue;
      const p = ph[i] * pa[j];
      if (p > best.p) best = { h: i, a: j, p, outcome };
    }
  }
  return best;
}

export async function predictMatch(args: {
  slug: string;
  date: string; // ISO match date; only earlier results are used
  homeId: string;
  awayId: string;
}): Promise<Prediction | null> {
  const [sh, sa] = await Promise.all([getTeamSchedule(args.homeId), getTeamSchedule(args.awayId)]);
  if (!sh || !sa) return null;
  const hh = history(sh.results, args.date);
  const ha = history(sa.results, args.date);
  const rh = rates(hh);
  const ra = rates(ha);

  const neutral = isNational(args.slug);
  const lambdaH = ((rh.scored + ra.conceded) / 2) * (neutral ? 1 : 1.1);
  const lambdaA = ((ra.scored + rh.conceded) / 2) * (neutral ? 1 : 0.92);
  const pm = poissonModel(lambdaH, lambdaA);

  let elo: Prediction["elo"] = null;
  if (isDomesticLeague(args.slug)) {
    const e = await leagueElo(args.slug, args.date, args.homeId, args.awayId);
    if (e) elo = { ...e.probs, ratingH: e.ratingH, ratingA: e.ratingA, teams: e.teams };
  }
  const blend: Probs = elo
    ? { h: (pm.probs.h + elo.h) / 2, d: (pm.probs.d + elo.d) / 2, a: (pm.probs.a + elo.a) / 2 }
    : pm.probs;

  return {
    lambdaH,
    lambdaA,
    poisson: pm.probs,
    elo,
    blend,
    over25: pm.over25,
    under25: 1 - pm.over25,
    btts: pm.btts,
    scores: pm.scores,
    sampleH: rh.n,
    sampleA: ra.n,
    pick: pickScore(lambdaH, lambdaA, blend),
  };
}
