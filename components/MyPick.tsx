"use client";
import { useEffect, useState } from "react";
import { loadPicks, savePick, deletePick, subscribe, type UserPick } from "@/lib/picks-client";
import StorageNotice from "./StorageNotice";

type Match = Omit<UserPick, "h" | "a" | "savedAt">;

function Logo({ src, name }: { src?: string; name: string }) {
  return src ? <img src={src} alt={name} title={name} style={{ width: 34, height: 34, objectFit: "contain" }} /> : <span className="mut" title={name}>{name.slice(0, 3).toUpperCase()}</span>;
}

export default function MyPick({ match, aiPick }: { match: Match; aiPick: { h: number; a: number } }) {
  const [h, setH] = useState("");
  const [a, setA] = useState("");
  const [saved, setSaved] = useState<UserPick | null>(null);
  const [msg, setMsg] = useState("");
  const [enabled, setEnabled] = useState(true);
  const locked = Date.now() >= new Date(match.date).getTime();

  useEffect(() => {
    const apply = () =>
      loadPicks().then(({ status, picks }) => {
        setEnabled(status.configured);
        const pk = picks[match.id];
        if (pk) { setSaved(pk); setH(String(pk.h)); setA(String(pk.a)); }
      });
    apply();
    return subscribe(apply);
  }, [match.id]);

  const ok = /^\d{1,2}$/.test(h) && /^\d{1,2}$/.test(a);

  async function save() {
    if (!ok || locked || !enabled) return;
    setMsg("Saving…");
    const r = await savePick({ ...match, h: +h, a: +a });
    setMsg(r.ok ? "Saved to your account on the server." : r.error ?? "Could not save.");
  }

  const box = { width: 56, background: "#0e1116", color: "inherit", border: "1px solid var(--line)", borderRadius: 6, padding: "6px 8px", textAlign: "center" as const, fontSize: 16 };

  return (
    <div className="card">
      <StorageNotice />
      <h1 style={{ marginTop: 0 }}>Exact score picks</h1>
      <div className="kpis">
        <div className="kpi">
          <small>Model pick</small>
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 4 }}>
            <Logo src={match.homeLogo} name={match.home} />
            <b style={{ fontSize: 24 }}>{aiPick.h} - {aiPick.a}</b>
            <Logo src={match.awayLogo} name={match.away} />
          </div>
        </div>
        <div className="kpi">
          <small>Your pick {locked ? "(locked: kick-off passed)" : ""}</small>
          {locked && !saved ? <b>–</b> : (
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 4, flexWrap: "wrap" }}>
              <Logo src={match.homeLogo} name={match.home} />
              <input inputMode="numeric" aria-label={`${match.home} goals`} value={h} onChange={(e) => setH(e.target.value)} disabled={locked || !enabled} style={box} />
              <b>-</b>
              <input inputMode="numeric" aria-label={`${match.away} goals`} value={a} onChange={(e) => setA(e.target.value)} disabled={locked || !enabled} style={box} />
              <Logo src={match.awayLogo} name={match.away} />
              {!locked && <button className="tab on" onClick={save} disabled={!ok || !enabled} style={{ cursor: ok && enabled ? "pointer" : "not-allowed", opacity: ok && enabled ? 1 : 0.5 }}>{saved ? "Update" : "Submit"}</button>}
              {!locked && saved && <button className="tab" onClick={async () => { const r = await deletePick(match.id); if (r.ok) { setSaved(null); setH(""); setA(""); setMsg("Removed."); } else setMsg(r.error ?? "Could not remove."); }} style={{ cursor: "pointer" }}>Remove</button>}
            </div>
          )}
        </div>
      </div>
      <div className="note">
        {match.home} (home) first. {msg} Your picks are stored on the server, so they show up in any browser; see the <a className="ext" href="/predictions">Predictions tab</a> to compare them with the model and the final scores.
        The model pick is the likeliest scoreline given its most likely result (see the Prediction section), and the daily job locks it the day before kick-off.
      </div>
    </div>
  );
}
