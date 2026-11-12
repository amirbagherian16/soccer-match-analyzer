// Read-only client for Kalshi's public market-data API (no key needed for reads).
// Prices are probabilities in dollars (0.66 = 66%). Docs: https://docs.kalshi.com
const BASE = "https://api.elections.kalshi.com/trade-api/v2";

/** ESPN league slug -> Kalshi series prefix (KX<prefix>GAME / TOTAL / BTTS). */
export const KALSHI_PREFIX: Record<string, string> = {
  "eng.1": "EPL", "esp.1": "LALIGA", "ita.1": "SERIEA", "ger.1": "BUNDESLIGA", "fra.1": "LIGUE1",
  "ned.1": "EREDIVISIE", "por.1": "LIGAPORTUGAL", "tur.1": "SUPERLIG",
  "uefa.champions": "UCL", "uefa.europa": "UEL", "uefa.europa.conf": "UECL",
  "eng.fa": "FACUP", "eng.league_cup": "EFLCUP", "esp.copa_del_rey": "COPADELREY", "ger.dfb_pokal": "DFBPOKAL",
  "ita.coppa_italia": "COPPAITALIA", "fra.coupe_de_france": "COUPEDEFRANCE",
  "uefa.nations": "UEFANL", "fifa.friendly": "INTLFRIENDLY", "fifa.world": "WC",
};

/* eslint-disable @typescript-eslint/no-explicit-any */
async function kget(path: string, revalidate: number): Promise<any | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(`${BASE}${path}`, { next: { revalidate } });
      if (res.ok) return await res.json();
      if (res.status === 404) return null; // no such event (yet)
      // 429 (rate limit) or 5xx: wait briefly and try once more
    } catch {
      /* network hiccup: retry */
    }
    await new Promise((r) => setTimeout(r, 700));
  }
  return null;
}

const STOP = new Set(["fc", "afc", "cf", "cd", "ud", "sc", "ac", "as", "ss", "sv", "fk", "the", "club", "de", "of", "and", "calcio"]);
const tokens = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " ")
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter((t) => t && !STOP.has(t));

/** Same team if one token set contains the other ("Navalcarnero" vs "CD Artistico Navalcarnero"). */
function sameTeam(a: string, b: string): boolean {
  const A = tokens(a), B = tokens(b);
  if (!A.length || !B.length) return false;
  const sub = (x: string[], y: string[]) => x.every((t) => y.includes(t));
  return sub(A, B) || sub(B, A);
}

const dollars = (v: any): number | null => {
  const n = typeof v === "string" ? parseFloat(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? n : null;
};

export type Quote = {
  label: string;
  bid: number | null;
  ask: number | null;
  last: number | null;
  mid: number | null; // probability estimate
  liquid: boolean; // tight enough spread to trust the midpoint
  odds: number | null; // decimal odds if you buy YES at the ask (before fees)
};

function quote(label: string, m: any, maxSpread: number): Quote {
  const bid = dollars(m.yes_bid_dollars);
  const ask = dollars(m.yes_ask_dollars);
  const last = dollars(m.last_price_dollars);
  const both = bid != null && ask != null && ask >= bid;
  const spread = both ? ask! - bid! : null;
  const mid = both ? (bid! + ask!) / 2 : last;
  return {
    label, bid, ask, last, mid,
    liquid: spread != null && spread <= maxSpread && (bid ?? 0) > 0,
    odds: ask && ask > 0 && ask < 1 ? +(1 / ask).toFixed(2) : null,
  };
}

export type KalshiMatch = {
  found: boolean;
  eventTicker?: string;
  result?: { home: Quote; draw: Quote; away: Quote; probs: { h: number; d: number; a: number }; overround: number };
  over25?: (Quote & { underOdds: number | null }) | null;
  btts?: Quote | null;
  note?: string;
};

export async function findKalshiMatch(args: { slug: string; home: string; away: string; date: string }): Promise<KalshiMatch> {
  const prefix = KALSHI_PREFIX[args.slug];
  if (!prefix) return { found: false, note: "No Kalshi market series for this competition." };
  const series = `KX${prefix}GAME`;
  const d = await kget(`/events?series_ticker=${series}&status=open&with_nested_markets=true&limit=200`, 60);
  if (!d) return { found: false, note: "Kalshi data unavailable right now." };

  const kick = Date.parse(args.date);
  for (const e of d.events ?? []) {
    const ms: any[] = e.markets ?? [];
    const team = ms.filter((m) => !/^tie/i.test(m.yes_sub_title ?? ""));
    const tie = ms.find((m) => /^tie/i.test(m.yes_sub_title ?? ""));
    if (team.length !== 2 || !tie) continue;
    const exp = Date.parse(team[0].expected_expiration_time ?? "");
    if (!Number.isNaN(exp) && Math.abs(exp - kick) > 36 * 3600_000) continue;

    const mHome = team.find((m) => sameTeam(m.yes_sub_title, args.home));
    const mAway = team.find((m) => sameTeam(m.yes_sub_title, args.away));
    if (!mHome || !mAway || mHome === mAway) continue;

    const home = quote(mHome.yes_sub_title, mHome, 0.08);
    const away = quote(mAway.yes_sub_title, mAway, 0.08);
    const draw = quote("Draw", tie, 0.08);
    const raw = [home.mid, draw.mid, away.mid];
    if (raw.some((x) => x == null)) continue;
    const sum = (raw as number[]).reduce((a, b) => a + b, 0);

    const out: KalshiMatch = {
      found: true,
      eventTicker: e.event_ticker,
      result: { home, draw, away, probs: { h: home.mid! / sum, d: draw.mid! / sum, a: away.mid! / sum }, overround: sum },
      over25: null,
      btts: null,
    };

    // Related markets share the event suffix: KXEPLGAME-26NOV21MCIFUL -> KXEPLTOTAL-26NOV21MCIFUL
    const suffix = String(e.event_ticker).slice(series.length);
    const [tot, bt] = await Promise.all([
      kget(`/events/KX${prefix}TOTAL${suffix}?with_nested_markets=true`, 60),
      kget(`/events/KX${prefix}BTTS${suffix}?with_nested_markets=true`, 60),
    ]);
    const totMarkets: any[] = (tot?.markets?.length ? tot.markets : tot?.event?.markets) ?? [];
    const o25 = totMarkets.find((m) => m.floor_strike === 2.5);
    if (o25) {
      const q = quote("Over 2.5 goals", o25, 0.1);
      const bid = q.bid;
      out.over25 = { ...q, underOdds: bid != null && bid > 0 && bid < 1 ? +(1 / (1 - bid)).toFixed(2) : null };
    }
    const bm: any[] = (bt?.markets?.length ? bt.markets : bt?.event?.markets) ?? [];
    if (bm[0]) out.btts = quote("Both teams to score", bm[0], 0.1);
    return out;
  }
  return { found: false, note: "No open Kalshi market for this match yet (they usually appear a few days before kick-off)." };
}
