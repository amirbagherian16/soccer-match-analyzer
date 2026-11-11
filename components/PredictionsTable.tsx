"use client";
import { useEffect, useMemo, useState } from "react";
import { judge, label, outcomeOf, type Entry } from "@/lib/score";
import { loadPicks, savePick, subscribe, type UserPick } from "@/lib/picks-client";
import StorageNotice from "./StorageNotice";
import MetricsPanel, { type MetricRow } from "./MetricsPanel";
import { chicagoLabel } from "@/lib/time";

type Row = {
  id: string; slug: string; comp: string; date: string;
  home: string; away: string; homeLogo?: string; awayLogo?: string;
  ai?: { h: number; a: number; probs?: { h: number; d: number; a: number } };
  me?: { h: number; a: number };
  result?: { h: number; a: number };
};

const tick = (v: boolean | null) => (v == null ? <span className="mut">–</span> : v ? <span style={{ color: "var(--w)", fontWeight: 700 }}>✔</span> : <span style={{ color: "var(--l)", fontWeight: 700 }}>✘</span>);
const sc = (p?: { h: number; a: number }) => (p ? `${p.h}-${p.a}` : "–");
const wdl = (p?: { h: number; a: number }) => (p ? outcomeOf(p.h, p.a) === "H" ? "H" : outcomeOf(p.h, p.a) === "A" ? "A" : "D" : "");

function pct(n: number, d: number) {
  return d ? `${((n / d) * 100).toFixed(0)}%` : "–";
}

export default function PredictionsTable({ entries }: { entries: Entry[] }) {
  const [mine, setMine] = useState<Record<string, UserPick>>({});
  const [fetched, setFetched] = useState<Record<string, { h: number; a: number }>>({});
  const [f, setF] = useState({ comp: "", status: "", q: "", who: "", ok: "" });

  useEffect(() => {
    const apply = () => loadPicks().then((x) => setMine({ ...x.picks }));
    apply();
    return subscribe(apply);
  }, []);

  const rows: Row[] = useMemo(() => {
    const map = new Map<string, Row>();
    for (const e of entries) {
      map.set(e.id, { id: e.id, slug: e.slug, comp: e.comp, date: e.date, home: e.home, away: e.away, homeLogo: e.homeLogo, awayLogo: e.awayLogo, ai: { h: e.ai.h, a: e.ai.a, probs: e.ai.probs }, result: e.result });
    }
    for (const p of Object.values(mine)) {
      const r = map.get(p.id) ?? { id: p.id, slug: p.slug, comp: p.comp, date: p.date, home: p.home, away: p.away, homeLogo: p.homeLogo, awayLogo: p.awayLogo };
      r.me = { h: p.h, a: p.a };
      map.set(p.id, r);
    }
    return [...map.values()].map((r) => ({ ...r, result: r.result ?? fetched[r.id] })).sort((a, b) => b.date.localeCompare(a.date));
  }, [entries, mine, fetched]);

  // Finished matches without a stored result: ask the server for the final score.
  useEffect(() => {
    const need = rows.filter((r) => !r.result && new Date(r.date).getTime() < Date.now() - 150 * 60_000).slice(0, 40);
    need.forEach(async (r) => {
      try {
        const res = await fetch(`/api/result?slug=${encodeURIComponent(r.slug)}&id=${r.id}`);
        const j = await res.json();
        if (j.completed) setFetched((s) => ({ ...s, [r.id]: { h: j.h, a: j.a } }));
      } catch {
        /* ignore */
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries, mine]);

  const comps = useMemo(() => [...new Set(rows.map((r) => r.comp))].sort(), [rows]);

  const view = rows.filter((r) => {
    const done = !!r.result;
    if (f.comp && r.comp !== f.comp) return false;
    if (f.status === "upcoming" && done) return false;
    if (f.status === "finished" && !done) return false;
    if (f.q && !`${r.home} ${r.away}`.toLowerCase().includes(f.q.toLowerCase())) return false;
    if (f.who === "model" && !r.ai) return false;
    if (f.who === "me" && !r.me) return false;
    if (f.who === "both" && !(r.ai && r.me)) return false;
    if (f.ok) {
      const [who, kind, want] = f.ok.split(":");
      const j = judge(who === "ai" ? r.ai : r.me, r.result);
      const v = kind === "exact" ? j.exact : j.result;
      if (v == null || String(v) !== want) return false;
    }
    return true;
  });

  const stat = (who: "ai" | "me") => {
    const fin = rows.filter((r) => r.result && r[who]);
    const ex = fin.filter((r) => judge(r[who], r.result).exact).length;
    const re = fin.filter((r) => judge(r[who], r.result).result).length;
    return { n: fin.length, ex, re };
  };
  const sa = stat("ai");
  const sm = stat("me");

  function exportJson() {
    const blob = new Blob([JSON.stringify(mine, null, 1)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "my-picks.json";
    a.click();
  }
  async function importJson(file: File) {
    try {
      const p = JSON.parse(await file.text()) as Record<string, UserPick>;
      let ok = 0, bad = 0;
      for (const pk of Object.values(p)) {
        const r = await savePick(pk, { import: true });
        if (r.ok) ok++; else bad++;
      }
      alert(`Imported ${ok} picks${bad ? `, ${bad} rejected (they must have been saved before kick-off)` : ""}.`);
      await loadPicks(true).then((x) => setMine({ ...x.picks }));
    } catch {
      alert("That file is not a valid picks export.");
    }
  }

  const sel = { background: "#0e1116", color: "inherit", border: "1px solid var(--line)", borderRadius: 8, padding: "6px 8px" } as const;

  return (
    <>
      <StorageNotice />
      <MetricsPanel rows={rows as MetricRow[]} />
      <div className="kpis">
        <div className="kpi"><small>Model · exact score</small><b>{pct(sa.ex, sa.n)}</b><small>{sa.ex} of {sa.n} finished</small></div>
        <div className="kpi"><small>Model · result (W/D/L)</small><b>{pct(sa.re, sa.n)}</b><small>{sa.re} of {sa.n} finished</small></div>
        <div className="kpi"><small>You · exact score</small><b>{pct(sm.ex, sm.n)}</b><small>{sm.ex} of {sm.n} finished</small></div>
        <div className="kpi"><small>You · result (W/D/L)</small><b>{pct(sm.re, sm.n)}</b><small>{sm.re} of {sm.n} finished</small></div>
      </div>

      <div className="chips" style={{ alignItems: "center" }}>
        <input placeholder="Search team…" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} style={{ ...sel, minWidth: 160 }} />
        <select value={f.comp} onChange={(e) => setF({ ...f, comp: e.target.value })} style={sel}>
          <option value="">All competitions</option>
          {comps.map((c) => <option key={c}>{c}</option>)}
        </select>
        <select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })} style={sel}>
          <option value="">Upcoming + finished</option>
          <option value="upcoming">Upcoming</option>
          <option value="finished">Finished</option>
        </select>
        <select value={f.who} onChange={(e) => setF({ ...f, who: e.target.value })} style={sel}>
          <option value="">Anyone&apos;s picks</option>
          <option value="model">Has model pick</option>
          <option value="me">Has my pick</option>
          <option value="both">Both picked</option>
        </select>
        <select value={f.ok} onChange={(e) => setF({ ...f, ok: e.target.value })} style={sel}>
          <option value="">Any outcome</option>
          <option value="ai:exact:true">Model exact ✔</option>
          <option value="ai:exact:false">Model exact ✘</option>
          <option value="ai:result:true">Model result ✔</option>
          <option value="ai:result:false">Model result ✘</option>
          <option value="me:exact:true">My exact ✔</option>
          <option value="me:exact:false">My exact ✘</option>
          <option value="me:result:true">My result ✔</option>
          <option value="me:result:false">My result ✘</option>
        </select>
        <span style={{ flex: 1 }} />
        <button className="tab" onClick={exportJson} style={{ cursor: "pointer" }}>Export my picks</button>
        <label className="tab" style={{ cursor: "pointer" }}>Import<input type="file" accept="application/json" hidden onChange={(e) => e.target.files?.[0] && importJson(e.target.files[0])} /></label>
      </div>

      <div className="card" style={{ overflowX: "auto" }}>
        <table>
          <thead>
            <tr>
              <th>Kick-off (US Central)</th><th>Competition</th><th>Match</th>
              <th>Model</th><th>You</th><th>Actual</th>
              <th title="Model exact score">M score</th><th title="Model result">M W/D/L</th>
              <th title="Your exact score">Y score</th><th title="Your result">Y W/D/L</th>
            </tr>
          </thead>
          <tbody>
            {view.map((r) => {
              const jm = judge(r.ai, r.result);
              const jy = judge(r.me, r.result);
              return (
                <tr key={r.id}>
                  <td className="mut">{chicagoLabel(r.date)}</td>
                  <td className="mut">{r.comp}</td>
                  <td><a href={`/match/${r.slug}/${r.id}`}>{r.home} v {r.away}</a></td>
                  <td>{sc(r.ai)} <span className="mut">{wdl(r.ai)}</span></td>
                  <td>{sc(r.me)} <span className="mut">{wdl(r.me)}</span></td>
                  <td><b>{sc(r.result)}</b> <span className="mut">{wdl(r.result)}</span></td>
                  <td>{r.ai ? tick(jm.exact) : <span className="mut">–</span>}</td>
                  <td>{r.ai ? tick(jm.result) : <span className="mut">–</span>}</td>
                  <td>{r.me ? tick(jy.exact) : <span className="mut">–</span>}</td>
                  <td>{r.me ? tick(jy.result) : <span className="mut">–</span>}</td>
                </tr>
              );
            })}
            {view.length === 0 && <tr><td colSpan={10} className="mut">No rows match these filters yet.</td></tr>}
          </tbody>
        </table>
        <div className="note">
          H = home win, D = draw, A = away win. Scores are judged on the final score (including extra time, excluding penalty shoot-outs). “–” means no pick or the match isn&apos;t finished.
          Model picks come from the daily job; your picks are stored on the server and show in any browser. Export/Import is only for backups.
        </div>
      </div>
      <span hidden>{label("H")}</span>
    </>
  );
}
