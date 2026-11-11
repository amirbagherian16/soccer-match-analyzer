// Thin client for ESPN's public (keyless) soccer endpoints.
const BASE = "https://site.api.espn.com/apis/site/v2/sports/soccer";

/* eslint-disable @typescript-eslint/no-explicit-any */
// Short in-process memo so one render (or the daily script) never refetches the same URL.
const memo = new Map<string, { t: number; p: Promise<any | null> }>();

async function getJson(url: string, revalidate: number): Promise<any | null> {
  const ttl = Math.min(revalidate * 1000, 120_000);
  const hit = memo.get(url);
  if (hit && Date.now() - hit.t < ttl) return hit.p;
  const p = (async () => {
    try {
      const res = await fetch(url, { next: { revalidate } });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  })();
  memo.set(url, { t: Date.now(), p });
  return p;
}

const num = (v: any): number => {
  if (v == null) return 0;
  if (typeof v === "object") return Number(v.displayValue ?? v.value ?? 0) || 0;
  return Number(v) || 0;
};

export type TeamRef = { id: string; name: string; logo?: string };

export type Fixture = {
  id: string;
  slug: string;
  date: string;
  state: "pre" | "in" | "post";
  statusText: string;
  home: TeamRef & { score: number };
  away: TeamRef & { score: number };
};

export async function getScoreboard(slug: string, yyyymmdd: string): Promise<Fixture[]> {
  const d = await getJson(`${BASE}/${slug}/scoreboard?dates=${yyyymmdd}`, 60);
  if (!d?.events) return [];
  return d.events.map((e: any): Fixture => {
    const c = e.competitions[0];
    const side = (ha: string) => {
      const t = c.competitors.find((x: any) => x.homeAway === ha);
      return {
        id: String(t.team.id),
        name: t.team.displayName,
        logo: t.team.logo,
        score: num(t.score),
      };
    };
    return {
      id: String(e.id),
      slug,
      date: e.date,
      state: e.status.type.state,
      statusText: e.status.type.shortDetail ?? e.status.type.description,
      home: side("home"),
      away: side("away"),
    };
  });
}

export type Result = {
  id: string;
  slug: string;
  date: string;
  home: boolean;
  oppId: string;
  opp: string;
  oppLogo?: string;
  gf: number;
  ga: number;
  outcome: "W" | "D" | "L";
};

export type TeamSchedule = {
  team: TeamRef;
  results: Result[]; // completed, newest first
  upcoming: { id: string; slug: string; date: string; opp: string; home: boolean }[];
};

const slugFromRef = (c: any): string => {
  const ref: string | undefined = c?.score?.$ref ?? c?.record?.$ref;
  const m = ref?.match(/leagues\/([^/]+)\//);
  return m ? m[1] : "unknown";
};

/** All competitions for one team (club or national) in the current season. */
export async function getTeamSchedule(teamId: string): Promise<TeamSchedule | null> {
  const d = await getJson(`${BASE}/all/teams/${teamId}/schedule`, 600);
  if (!d?.team) return null;
  const team: TeamRef = {
    id: String(d.team.id),
    name: d.team.displayName,
    logo: d.team.logo ?? d.team.logos?.[0]?.href,
  };
  const results: Result[] = [];
  const upcoming: TeamSchedule["upcoming"] = [];
  for (const e of d.events ?? []) {
    const c = e.competitions?.[0];
    if (!c) continue;
    const me = c.competitors.find((x: any) => String(x.team?.id ?? x.id) === team.id);
    const opp = c.competitors.find((x: any) => x !== me);
    if (!me || !opp) continue;
    const slug = slugFromRef(me);
    if (c.status?.type?.completed) {
      const gf = num(me.score);
      const ga = num(opp.score);
      results.push({
        id: String(e.id),
        slug,
        date: e.date,
        home: me.homeAway === "home",
        oppId: String(opp.team?.id ?? opp.id),
        opp: opp.team?.displayName ?? "Opponent",
        oppLogo: opp.team?.logo ?? opp.team?.logos?.[0]?.href,
        gf,
        ga,
        outcome: gf > ga ? "W" : gf < ga ? "L" : "D",
      });
    } else {
      upcoming.push({
        id: String(e.id),
        slug,
        date: e.date,
        opp: opp.team?.displayName ?? "Opponent",
        home: me.homeAway === "home",
      });
    }
  }
  results.sort((a, b) => b.date.localeCompare(a.date));
  upcoming.sort((a, b) => a.date.localeCompare(b.date));
  return { team, results, upcoming };
}

export async function getSummary(slug: string, eventId: string): Promise<any | null> {
  // Finished matches never change, so cache them for a long time.
  return getJson(`${BASE}/${slug}/summary?event=${eventId}`, 3600);
}

export async function getRoster(slug: string, teamId: string): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  for (const s of [slug, "all"]) {
    const d = await getJson(`${BASE}/${s}/teams/${teamId}/roster`, 3600);
    for (const a of d?.athletes ?? []) {
      if (a.position?.abbreviation) out.set(String(a.id), a.position.abbreviation);
    }
    if (out.size) break;
  }
  return out;
}

/** Real expected goals for one team in one match (null when ESPN has none). */
export async function getTeamXg(slug: string, eventId: string, teamId: string): Promise<number | null> {
  const d = await getJson(
    `https://sports.core.api.espn.com/v2/sports/soccer/leagues/${slug}/events/${eventId}/competitions/${eventId}/competitors/${teamId}/statistics`,
    86400,
  );
  for (const cat of d?.splits?.categories ?? []) {
    for (const st of cat.stats ?? []) {
      if (st.name === "expectedGoals" && typeof st.value === "number") return st.value;
    }
  }
  return null;
}

/** Team ids of a domestic league (used to build league Elo ratings). */
export async function getLeagueTeamIds(slug: string): Promise<string[]> {
  const d = await getJson(`${BASE}/${slug}/teams`, 3600);
  const teams = d?.sports?.[0]?.leagues?.[0]?.teams ?? [];
  return teams.map((t: any) => String(t.team.id));
}

/** Final score of a match (home/away), fresh enough to resolve predictions. */
export async function getResult(
  slug: string,
  eventId: string,
): Promise<{ completed: boolean; state: string; h: number; a: number } | null> {
  const d = await getJson(`${BASE}/${slug}/summary?event=${eventId}`, 120);
  const c = d?.header?.competitions?.[0];
  if (!c) return null;
  const home = c.competitors?.find((x: any) => x.homeAway === "home");
  const away = c.competitors?.find((x: any) => x.homeAway === "away");
  if (!home || !away) return null;
  return {
    completed: c.status?.type?.completed === true,
    state: c.status?.type?.state ?? "pre",
    h: num(home.score),
    a: num(away.score),
  };
}
