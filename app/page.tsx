import Link from "next/link";
import { COMPS } from "@/lib/leagues";
import { getScoreboard, type Fixture } from "@/lib/espn";
import { chicago } from "@/lib/time";
import RowPicks from "@/components/RowPicks";
import StorageNotice from "@/components/StorageNotice";
import stored from "@/data/predictions.json";
import type { Entry } from "@/lib/score";

export const revalidate = 60;
export const maxDuration = 60;

const ymd = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, "");
const shift = (s: string, days: number) => {
  const d = new Date(Date.UTC(+s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8)));
  d.setUTCDate(d.getUTCDate() + days);
  return ymd(d);
};
const pretty = (s: string) => `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;

const lockedById = new Map((stored as unknown as Entry[]).map((e) => [e.id, e]));

function Row({ f, comp }: { f: Fixture; comp: string }) {
  const c = chicago(f.date);
  const href = `/match/${f.slug}/${f.id}`;
  const lk = lockedById.get(f.id);
  return (
    <div className="row">
      <Link href={href} className={`tcell ${f.state === "in" ? "live" : "mut"}`}>
        {c.time}<small>{c.tz}</small>
      </Link>
      <Link href={href} className="team r">{f.home.name}{f.home.logo && <img src={f.home.logo} alt="" />}</Link>
      <Link href={href} className="score">
        {f.state === "pre" ? "vs" : `${f.home.score}-${f.away.score}`}
        {f.state !== "pre" && <small className={f.state === "in" ? "live" : "mut"}>{f.statusText}</small>}
      </Link>
      <Link href={href} className="team">{f.away.logo && <img src={f.away.logo} alt="" />}{f.away.name}</Link>
      <RowPicks
        slug={f.slug} id={f.id} date={f.date} comp={comp} state={f.state}
        homeId={f.home.id} awayId={f.away.id} home={f.home.name} away={f.away.name}
        homeLogo={f.home.logo} awayLogo={f.away.logo}
        locked={lk ? { h: lk.ai.h, a: lk.ai.a } : undefined}
      />
    </div>
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
      <div className="note" style={{ marginBottom: 10 }}>Times are US Central. Enter your own score in the “Your pick” boxes before kick-off (saved to your account on the server). The model pick is locked the day before; later matches show a live estimate.</div>
      <StorageNotice />
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
          <div className="row head"><span>Kick-off</span><span className="r">Home</span><span>Score</span><span>Away</span><span>Model pick</span><span>Your pick</span></div>
          {games.map((g) => <Row key={g.id} f={g} comp={c.name} />)}
        </section>
      ))}
    </>
  );
}
