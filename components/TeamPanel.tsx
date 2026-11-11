import Link from "next/link";
import { analyzeTeam, type Form, type PlayerAgg } from "@/lib/analysis";
import type { Result } from "@/lib/espn";
import { compName } from "@/lib/leagues";

const fmt = (n: number) => n.toFixed(2);

function Kpi({ l, v }: { l: string; v: string | number }) {
  return <div className="kpi"><small>{l}</small><b>{v}</b></div>;
}

function FormBox({ label, f }: { label: string; f: Form }) {
  return (
    <div className="kpi">
      <small>{label}</small>
      <div className="formrow">
        {f.last5.length === 0 && <span className="mut">–</span>}
        {[...f.last5].reverse().map((r) => <span key={r.id} className={`pill ${r.outcome}`} title={`${r.opp} ${r.gf}-${r.ga}`}>{r.outcome}</span>)}
      </div>
      <small>{f.w}W {f.d}D {f.l}L</small>
    </div>
  );
}

function GoalBars({ results }: { results: Result[] }) {
  const list = [...results].reverse(); // oldest -> newest
  const max = Math.max(4, ...list.map((r) => r.gf));
  return (
    <>
      <div className="bars">
        {list.map((r) => (
          <div key={r.id} className="barcol" title={`${r.date.slice(0, 10)} ${r.home ? "vs" : "@"} ${r.opp}: ${r.gf}-${r.ga}`}>
            <span className="barval">{r.gf}</span>
            <div className={`bar ${r.gf >= 3 ? "hot" : ""}`} style={{ height: `${Math.max((r.gf / max) * 100, 3)}%` }} />
            <span className="barlbl">{r.opp.slice(0, 3).toUpperCase()}</span>
          </div>
        ))}
      </div>
      <div className="note"><span className="dot hot" /> 3 or more goals scored <span className="dot" style={{ marginLeft: 10 }} /> fewer than 3 · oldest → newest</div>
    </>
  );
}

function Best({ title, list, kind }: { title: string; list: PlayerAgg[]; kind: "ATT" | "MID" | "DEF" | "GK" }) {
  return (
    <>
      <h2 style={{ marginTop: 14 }}>{title}</h2>
      {list.length === 0 ? <div className="mut">No data</div> : (
        <table>
          <thead><tr><th>Player</th><th>Apps</th>{kind === "GK" ? <><th>Saves</th><th>CS</th><th>GA</th></> : <><th>G</th><th>A</th>{kind === "DEF" && <th>CS</th>}</>}<th>Rating</th></tr></thead>
          <tbody>
            {list.map((p) => (
              <tr key={p.id}>
                <td>{p.name}</td><td>{p.apps}</td>
                {kind === "GK" ? <><td>{p.saves}</td><td>{p.cleanSheets}</td><td>{p.conceded}</td></> : <><td>{p.goals}</td><td>{p.assists}</td>{kind === "DEF" && <td>{p.cleanSheets}</td>}</>}
                <td><b>{p.score}</b></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}

export default async function TeamPanel({ teamId, comp, basePath }: { teamId: string; comp: string; basePath: string }) {
  const a = await analyzeTeam(teamId, comp);
  if (!a) return <div className="card">Could not load team data right now.</div>;
  const sep = basePath.includes("?") ? "&" : "?";
  const scopeName = comp === "all" ? "All tournaments" : compName(comp);

  return (
    <div className="card">
      <div className="teamhead">
        {a.team.logo && <img src={a.team.logo} alt="" />}
        <div>
          <h1 style={{ margin: 0 }}><Link href={`/team/${a.team.id}?comp=${comp}`}>{a.team.name}</Link></h1>
          <span className="mut">{scopeName} · {a.played} matches played (friendlies excluded from “all”)</span>
        </div>
      </div>

      <div className="chips">
        <Link className={`chip ${comp === "all" ? "on" : ""}`} href={`${basePath}${sep}comp=all`}>All</Link>
        {a.competitions.map((c) => (
          <Link key={c.slug} className={`chip ${comp === c.slug ? "on" : ""}`} href={`${basePath}${sep}comp=${c.slug}`}>
            {compName(c.slug)} ({c.n})
          </Link>
        ))}
      </div>

      <div className="kpis">
        <FormBox label={comp === "all" ? "Last 5 · all tournaments" : "Last 5 · this tournament"} f={a.formComp} />
        {comp !== "all" && <FormBox label="Last 5 · all tournaments" f={a.formAll} />}
        <Kpi l="Goals scored" v={a.goalsFor} />
        <Kpi l="Goals conceded" v={a.goalsAgainst} />
        <Kpi l="Clean sheets" v={a.cleanSheets} />
        <Kpi l="xG average" v={a.xg ? fmt(a.xg.avg) : "–"} />
        <Kpi l="xG min / max" v={a.xg ? `${fmt(a.xg.min)} / ${fmt(a.xg.max)}` : "–"} />
        <Kpi l="Top scorer" v={a.topScorer ? `${a.topScorer.name.split(" ").slice(-1)[0]} (${a.topScorer.goals})` : "–"} />
      </div>

      <h2>Goals scored · last 10 matches</h2>
      <GoalBars results={a.last10} />

      <h2 style={{ marginTop: 16 }}>Last 10 matches</h2>
      <table>
        <thead><tr><th></th><th>Date</th><th>Opponent</th><th>Score</th><th>Comp</th><th>xG</th></tr></thead>
        <tbody>
          {a.last10.map((r) => (
            <tr key={r.id}>
              <td><span className={`pill ${r.outcome}`}>{r.outcome}</span></td>
              <td className="mut">{r.date.slice(0, 10)}</td>
              <td>{r.home ? "vs" : "@"} {r.opp}</td>
              <td>{r.gf}-{r.ga}</td>
              <td className="mut">{compName(r.slug)}</td>
              <td className="mut">{a.xgByMatch[r.id] ? <>{fmt(a.xgByMatch[r.id].v)}{a.xgByMatch[r.id].est && <span title="Estimated from shots (no real xG published)"> ~</span>}</> : "–"}</td>
            </tr>
          ))}
          {a.last10.length === 0 && <tr><td colSpan={6} className="mut">No completed matches in this tournament yet.</td></tr>}
        </tbody>
      </table>
      <div className="note">xG is ESPN&apos;s match xG where published{a.xg ? ` (${a.xg.real} of ${a.xg.matches} matches in scope)` : ""}; a “~” marks matches without published xG, estimated from shots and shots on target. Player ratings are derived from ESPN match stats (goals, assists, shots, saves, clean sheets, cards).</div>

      <Best title="Best attackers" list={a.best.ATT} kind="ATT" />
      <Best title="Best midfielders" list={a.best.MID} kind="MID" />
      <Best title="Best defenders" list={a.best.DEF} kind="DEF" />
      <Best title="Best goalkeepers" list={a.best.GK} kind="GK" />

      {a.next && <div className="note" style={{ marginTop: 12 }}>Next: {a.next.home ? "vs" : "@"} {a.next.opp} · {a.next.date.slice(0, 10)} · {compName(a.next.slug)}</div>}
    </div>
  );
}
