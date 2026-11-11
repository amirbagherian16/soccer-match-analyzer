import Link from "next/link";
import { analyzeTeam, type PlayerAgg } from "@/lib/analysis";
import { compName } from "@/lib/leagues";

const fmt = (n: number) => n.toFixed(2);

function Kpi({ l, v }: { l: string; v: string | number }) {
  return <div className="kpi"><small>{l}</small><b>{v}</b></div>;
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
        <Kpi l={`Streak · ${comp === "all" ? "all" : "this tournament"}`} v={a.streakComp.label} />
        <Kpi l="Streak · all tournaments" v={a.streakAll.label} />
        <Kpi l="Unbeaten run (scope)" v={a.streakComp.unbeaten} />
        <Kpi l="Winless run (scope)" v={a.streakComp.winless} />
        <Kpi l="Goals scored" v={a.goalsFor} />
        <Kpi l="Goals conceded" v={a.goalsAgainst} />
        <Kpi l="Clean sheets" v={a.cleanSheets} />
        <Kpi l="Matches 4+ goals scored" v={a.over3} />
        <Kpi l="xG avg (est.)" v={a.xg ? fmt(a.xg.avg) : "–"} />
        <Kpi l="xG min / max (est.)" v={a.xg ? `${fmt(a.xg.min)} / ${fmt(a.xg.max)}` : "–"} />
        <Kpi l="Top scorer" v={a.topScorer ? `${a.topScorer.name.split(" ").slice(-1)[0]} (${a.topScorer.goals})` : "–"} />
      </div>

      <h2>Last 10 matches</h2>
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
              <td className="mut">{a.xgByMatch[r.id] != null ? fmt(a.xgByMatch[r.id]) : "–"}</td>
            </tr>
          ))}
          {a.last10.length === 0 && <tr><td colSpan={6} className="mut">No completed matches in this tournament yet.</td></tr>}
        </tbody>
      </table>
      <div className="note">xG is an estimate computed from shots and shots on target — ESPN does not publish true xG. Player ratings are derived from ESPN match stats (goals, assists, shots, saves, clean sheets, cards) over the selected tournament.</div>

      <Best title="Best attackers" list={a.best.ATT} kind="ATT" />
      <Best title="Best midfielders" list={a.best.MID} kind="MID" />
      <Best title="Best defenders" list={a.best.DEF} kind="DEF" />
      <Best title="Best goalkeepers" list={a.best.GK} kind="GK" />

      {a.next && <div className="note" style={{ marginTop: 12 }}>Next: {a.next.home ? "vs" : "@"} {a.next.opp} · {a.next.date.slice(0, 10)} · {compName(a.next.slug)}</div>}
    </div>
  );
}
