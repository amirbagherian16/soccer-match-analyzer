"use client";
import { useEffect, useState } from "react";
import type { KalshiMatch, Quote } from "@/lib/kalshi";

type Row = { key: string; label: string; p: number };

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

function Group({ title, rows, vals, set }: { title: string; rows: Row[]; vals: Record<string, string>; set: (k: string, v: string) => void }) {
  const odds = rows.map((r) => parseFloat(vals[r.key] ?? ""));
  const ready = odds.every((o) => o > 1);
  const raw = ready ? odds.map((o) => 1 / o) : [];
  const over = raw.reduce((a, b) => a + b, 0);
  return (
    <div style={{ marginBottom: 12 }}>
      <h2>{title}</h2>
      <table>
        <thead>
          <tr><th>Outcome</th><th>Odds</th><th>Bookmaker (no margin)</th><th>Model</th><th>Edge</th><th>EV / 1 unit</th><th /></tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const fair = ready ? raw[i] / over : null;
            const edge = fair != null ? r.p - fair : null;
            const ev = ready ? r.p * odds[i] - 1 : null;
            const value = ev != null && ev > 0 && edge! > 0;
            const huge = edge != null && Math.abs(edge) >= 0.15; // model and market disagree wildly: usually the model is missing something
            return (
              <tr key={r.key}>
                <td>{r.label}</td>
                <td>
                  <input
                    inputMode="decimal"
                    placeholder="e.g. 2.10"
                    value={vals[r.key] ?? ""}
                    onChange={(e) => set(r.key, e.target.value)}
                    style={{ width: 84, background: "#0e1116", color: "inherit", border: "1px solid var(--line)", borderRadius: 6, padding: "4px 6px" }}
                  />
                </td>
                <td>{fair != null ? pct(fair) : "–"}</td>
                <td>{pct(r.p)}</td>
                <td>{edge != null ? `${edge > 0 ? "+" : ""}${(edge * 100).toFixed(1)} pts` : "–"}</td>
                <td>{ev != null ? `${ev > 0 ? "+" : ""}${ev.toFixed(2)}` : "–"}</td>
                <td>{huge ? <span className="pill D" title="The model and the market disagree by 15+ points. That usually means the model is missing something (opponent strength, injuries), not that you have found an edge.">CHECK</span> : value && <span className="pill W">VALUE</span>}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {ready && <div className="note">Bookmaker margin (overround): {((over - 1) * 100).toFixed(1)}%</div>}
    </div>
  );
}

type Match = { slug: string; home: string; away: string; date: string };

function KalshiCard({ match, outcomes, onFill }: { match: Match; outcomes: Row[]; onFill: (v: Record<string, string>) => void }) {
  const [k, setK] = useState<KalshiMatch | null | "loading">("loading");
  useEffect(() => {
    let dead = false;
    const q = new URLSearchParams({ slug: match.slug, home: match.home, away: match.away, date: match.date });
    fetch(`/api/kalshi?${q}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (!dead) setK(j); })
      .catch(() => { if (!dead) setK(null); });
    return () => { dead = true; };
  }, [match.slug, match.home, match.away, match.date]);

  if (k === "loading") return <div className="note">Checking Kalshi…</div>;
  if (!k) return <div className="note">Kalshi prices are unavailable right now.</div>;
  if (!k.found || !k.result) return <div className="note"><b>Kalshi:</b> {k.note ?? "no market found."}</div>;

  const km: KalshiMatch = k;
  const r = k.result;
  const model = Object.fromEntries(outcomes.map((o) => [o.key, o.p]));
  const rows: { key: string; q: Quote; p: number }[] = [
    { key: "h", q: r.home, p: r.probs.h },
    { key: "d", q: r.draw, p: r.probs.d },
    { key: "a", q: r.away, p: r.probs.a },
  ];
  const extra: Quote[] = [k.over25, k.btts].filter((x): x is NonNullable<typeof x> => !!x && x.liquid);
  const thin = [k.over25, k.btts].some((x) => x && !x.liquid);

  function fill() {
    const v: Record<string, string> = {};
    for (const x of rows) if (x.q.odds) v[x.key] = String(x.q.odds);
    if (km.over25?.liquid && km.over25.odds && km.over25.underOdds) {
      v.o = String(km.over25.odds);
      v.u = String(km.over25.underOdds);
    }
    onFill(v);
  }

  return (
    <div style={{ marginBottom: 14 }}>
      <h2>Kalshi market prices</h2>
      <table>
        <thead><tr><th>Outcome</th><th>Kalshi chance</th><th>Bid / ask</th><th>Buy odds (1 / ask)</th><th>My model</th><th>Model − Kalshi</th></tr></thead>
        <tbody>
          {rows.map((x) => (
            <tr key={x.key}>
              <td>{x.key === "d" ? "Draw" : x.q.label}</td>
              <td><b>{pct(x.p)}</b></td>
              <td className="mut">{x.q.bid != null ? x.q.bid.toFixed(2) : "–"} / {x.q.ask != null ? x.q.ask.toFixed(2) : "–"}{!x.q.liquid && " (thin)"}</td>
              <td>{x.q.odds ?? "–"}</td>
              <td>{pct(model[x.key])}</td>
              <td style={{ color: model[x.key] - x.p > 0.05 ? "var(--w)" : model[x.key] - x.p < -0.05 ? "var(--l)" : undefined }}>
                {model[x.key] - x.p > 0 ? "+" : ""}{((model[x.key] - x.p) * 100).toFixed(1)} pts
              </td>
            </tr>
          ))}
          {extra.map((q) => (
            <tr key={q.label}>
              <td>{q.label}</td><td><b>{pct(q.mid ?? 0)}</b></td>
              <td className="mut">{q.bid?.toFixed(2)} / {q.ask?.toFixed(2)}</td><td>{q.odds ?? "–"}</td><td className="mut">–</td><td className="mut">–</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8, flexWrap: "wrap" }}>
        <button className="tab on" onClick={fill} style={{ cursor: "pointer" }}>Fill the odds boxes below with Kalshi prices</button>
        <span className="note" style={{ margin: 0 }}>Market {k.eventTicker}</span>
      </div>
      <div className="note">
        Kalshi is a prediction market: a price of 0.66 means a 66% chance, and buying YES pays 1 if it happens, so the buy odds are 1 / ask. The chance shown is the bid/ask midpoint rescaled so the three results add to 100%.
        Edge and EV below are before Kalshi&apos;s trading fees.{thin ? " Over/Under and both-teams-to-score markets with wide bid/ask gaps are hidden because their prices are unreliable." : ""}
        This site only reads public prices; whether you can trade on Kalshi depends on where you live.
      </div>
    </div>
  );
}

export default function OddsCompare({ outcomes, ou, match }: { outcomes: Row[]; ou: Row[]; match?: Match }) {
  const [vals, setVals] = useState<Record<string, string>>({});
  const set = (k: string, v: string) => setVals((s) => ({ ...s, [k]: v }));
  return (
    <>
      {match && <KalshiCard match={match} outcomes={outcomes} onFill={(v) => setVals((s) => ({ ...s, ...v }))} />}
      <Group title="Match result odds" rows={outcomes} vals={vals} set={set} />
      <Group title="Over / Under 2.5 goals odds" rows={ou} vals={vals} set={set} />
      <div className="note">Enter decimal odds from your bookmaker or fill them from Kalshi. “Edge” is model probability minus the margin-free market probability; EV is expected profit per 1 unit staked if the model were right. The model is simple, so treat “VALUE” as a prompt to look closer, not a bet signal. “CHECK” means the model and the market differ by 15+ points, which usually means the model is missing something.</div>
    </>
  );
}
