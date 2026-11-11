import { predictMatch, type Probs } from "@/lib/predict";
import OddsCompare from "./OddsCompare";
import MyPick from "./MyPick";
import stored from "@/data/predictions.json";
import type { Entry } from "@/lib/score";

const pct = (x: number) => `${(x * 100).toFixed(0)}%`;

function Bar({ label, p, home, away }: { label: string; p: Probs; home: string; away: string }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div className="mut" style={{ fontSize: 13, marginBottom: 3 }}>{label}</div>
      <div className="stack">
        <div className="seg h" style={{ width: `${p.h * 100}%` }}>{pct(p.h)}</div>
        <div className="seg d" style={{ width: `${p.d * 100}%` }}>{pct(p.d)}</div>
        <div className="seg a" style={{ width: `${p.a * 100}%` }}>{pct(p.a)}</div>
      </div>
      <div className="stacklbl"><span>{home} win</span><span>Draw</span><span>{away} win</span></div>
    </div>
  );
}

export default async function PredictionPanel(props: { matchId: string; comp: string; homeLogo?: string; awayLogo?: string; slug: string; date: string; homeId: string; homeName: string; awayId: string; awayName: string; finished: boolean }) {
  const p = await predictMatch(props);
  if (!p) return <div className="card">Prediction unavailable (could not load team data).</div>;
  const { homeName: H, awayName: A } = props;
  const locked = (stored as unknown as Entry[]).find((e) => e.id === props.matchId);
  const aiPick = locked ? { h: locked.ai.h, a: locked.ai.a } : { h: p.pick.h, a: p.pick.a };

  return (
    <div className="card">
      <h1 style={{ marginTop: 0 }}>Prediction</h1>
      <div className="kpis">
        <div className="kpi"><small>Model exact-score pick{locked ? " (locked)" : " (live, not yet locked)"}</small><b>{aiPick.h} - {aiPick.a}</b></div>
      </div>
      {props.finished && <div className="note" style={{ marginBottom: 8 }}>Match already played: the model only uses results from before kick-off.</div>}
      <Bar label={p.elo ? "Blend (Poisson + Elo)" : "Poisson model"} p={p.blend} home={H} away={A} />
      {p.elo && (
        <div className="grid2">
          <Bar label="Poisson (recent goals)" p={p.poisson} home={H} away={A} />
          <Bar label={`Elo (${p.elo.teams}-team league)`} p={p.elo} home={H} away={A} />
        </div>
      )}

      <div className="kpis">
        <div className="kpi"><small>Expected goals {H}</small><b>{p.lambdaH.toFixed(2)}</b></div>
        <div className="kpi"><small>Expected goals {A}</small><b>{p.lambdaA.toFixed(2)}</b></div>
        <div className="kpi"><small>Over 2.5 goals</small><b>{pct(p.over25)}</b></div>
        <div className="kpi"><small>Both teams score</small><b>{pct(p.btts)}</b></div>
        {p.elo && <div className="kpi"><small>Elo rating</small><b>{Math.round(p.elo.ratingH)} v {Math.round(p.elo.ratingA)}</b></div>}
      </div>

      <h2>Most likely scores</h2>
      <div className="chips">
        {p.scores.map((s) => (
          <span key={`${s.h}-${s.a}`} className="chip">{s.h}-{s.a} · {(s.p * 100).toFixed(1)}%</span>
        ))}
      </div>
      <div className="note">
        Poisson uses each side&apos;s last {Math.max(p.sampleH, p.sampleA)} competitive matches ({p.sampleH} and {p.sampleA} found), shrunk toward the league-average 1.35 goals, with a small home advantage (none for national teams).
        {p.elo ? "" : " Elo needs a domestic league table, so it is only shown for league games."} Neither model knows about injuries, lineups, xG or opponent strength beyond goals, so it is a rough baseline.
      </div>

      <div style={{ marginTop: 14 }}>
        <OddsCompare
          outcomes={[
            { key: "h", label: `${H} win`, p: p.blend.h },
            { key: "d", label: "Draw", p: p.blend.d },
            { key: "a", label: `${A} win`, p: p.blend.a },
          ]}
          ou={[
            { key: "o", label: "Over 2.5", p: p.over25 },
            { key: "u", label: "Under 2.5", p: p.under25 },
          ]}
        />
      </div>
      <MyPick
        match={{ id: props.matchId, slug: props.slug, comp: props.comp, date: props.date, home: H, away: A, homeLogo: props.homeLogo, awayLogo: props.awayLogo }}
        aiPick={aiPick}
      />
      <div className="note">For analysis only. Bookmaker odds already price in a lot of information and no model guarantees a profit. Gamble responsibly, only if legal where you live and only with money you can afford to lose.</div>
    </div>
  );
}
