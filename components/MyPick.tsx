"use client";
import { useEffect, useState } from "react";
import { loadPicks, savePick, deletePick, type UserPick } from "@/lib/local";

type Match = Omit<UserPick, "h" | "a" | "savedAt">;

export default function MyPick({ match, aiPick }: { match: Match; aiPick: { h: number; a: number } }) {
  const [h, setH] = useState("");
  const [a, setA] = useState("");
  const [saved, setSaved] = useState<UserPick | null>(null);
  const [msg, setMsg] = useState("");
  const locked = Date.now() >= new Date(match.date).getTime();

  useEffect(() => {
    const p = loadPicks()[match.id];
    if (p) {
      setSaved(p);
      setH(String(p.h));
      setA(String(p.a));
    }
  }, [match.id]);

  const ok = /^\d{1,2}$/.test(h) && /^\d{1,2}$/.test(a);

  function save() {
    if (!ok || locked) return;
    const p: UserPick = { ...match, h: +h, a: +a, savedAt: new Date().toISOString() };
    if (savePick(p)) {
      setSaved(p);
      setMsg("Saved on this device.");
    } else setMsg("Could not save (browser storage blocked).");
  }

  const box = { width: 56, background: "#0e1116", color: "inherit", border: "1px solid var(--line)", borderRadius: 6, padding: "6px 8px", textAlign: "center" as const, fontSize: 16 };

  return (
    <div className="card">
      <h1 style={{ marginTop: 0 }}>Exact score picks</h1>
      <div className="kpis">
        <div className="kpi"><small>Model pick</small><b>{aiPick.h} - {aiPick.a}</b></div>
        <div className="kpi">
          <small>Your pick {locked ? "(locked: kick-off passed)" : ""}</small>
          {locked && !saved ? <b>–</b> : (
            <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 4 }}>
              <input inputMode="numeric" aria-label={`${match.home} goals`} value={h} onChange={(e) => setH(e.target.value)} disabled={locked} style={box} />
              <b>-</b>
              <input inputMode="numeric" aria-label={`${match.away} goals`} value={a} onChange={(e) => setA(e.target.value)} disabled={locked} style={box} />
              {!locked && <button className="tab on" onClick={save} disabled={!ok} style={{ cursor: ok ? "pointer" : "not-allowed", opacity: ok ? 1 : 0.5 }}>{saved ? "Update" : "Submit"}</button>}
              {!locked && saved && <button className="tab" onClick={() => { deletePick(match.id); setSaved(null); setH(""); setA(""); setMsg("Removed."); }} style={{ cursor: "pointer" }}>Remove</button>}
            </div>
          )}
        </div>
      </div>
      <div className="note">
        {match.home} (home) first. {msg} Your picks are saved in this browser only; see the <a className="ext" href="/predictions">Predictions tab</a> to compare them with the model and the final scores.
        The model pick is the likeliest scoreline given its most likely result (see the Prediction section), and the daily job locks it the day before kick-off.
      </div>
    </div>
  );
}
