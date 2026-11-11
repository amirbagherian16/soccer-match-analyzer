import Link from "next/link";
import { COMPS } from "@/lib/leagues";
import { getScoreboard, type Fixture } from "@/lib/espn";

export const revalidate = 60;

const ymd = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, "");
const shift = (s: string, days: number) => {
  const d = new Date(Date.UTC(+s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8)));
  d.setUTCDate(d.getUTCDate() + days);
  return ymd(d);
};
const pretty = (s: string) => `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;

function Row({ f }: { f: Fixture }) {
  const time = new Date(f.date).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
  return (
    <Link href={`/match/${f.slug}/${f.id}`} className="row">
      <span className={f.state === "in" ? "live" : "mut"}>{f.state === "pre" ? `${time} UTC` : f.statusText}</span>
      <span className="team r">{f.home.name}{f.home.logo && <img src={f.home.logo} alt="" />}</span>
      <span className="score">{f.state === "pre" ? "vs" : `${f.home.score}-${f.away.score}`}</span>
      <span className="team">{f.away.logo && <img src={f.away.logo} alt="" />}{f.away.name}</span>
    </Link>
  );
}

export default async function Home({ searchParams }: { searchParams: { date?: string; type?: string } }) {
  const date = /^\d{8}$/.test(searchParams.date ?? "") ? searchParams.date! : ymd(new Date());
  const type = searchParams.type === "national" ? "national" : "club";
  const comps = COMPS.filter((c) => c.kind === type);
  const days = await Promise.all(comps.map((c) => getScoreboard(c.slug, date)));
  const groups = comps.map((c, i) => ({ c, games: days[i] })).filter((g) => g.games.length);
  const q = (d: string, t = type) => `/?date=${d}&type=${t}`;

  return (
    <>
      <h1>Matches · {pretty(date)}</h1>
      <div className="tabs">
        <Link className={`tab ${type === "club" ? "on" : ""}`} href={q(date, "club")}>Clubs</Link>
        <Link className={`tab ${type === "national" ? "on" : ""}`} href={q(date, "national")}>National teams</Link>
        <span style={{ flex: 1 }} />
        <Link className="tab" href={q(shift(date, -1))}>← Prev</Link>
        <Link className="tab" href={q(ymd(new Date()))}>Today</Link>
        <Link className="tab" href={q(shift(date, 1))}>Next →</Link>
      </div>
      {groups.length === 0 && <div className="card mut">No {type} matches on this date. Try another day.</div>}
      {groups.map(({ c, games }) => (
        <section className="card" key={c.slug}>
          <h2>{c.name}</h2>
          {games.map((g) => <Row key={g.id} f={g} />)}
        </section>
      ))}
    </>
  );
}
