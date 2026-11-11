"use client";
import { useEffect, useState } from "react";
import { deletePick, loadPicks, savePick } from "@/lib/local";

type Props = {
  slug: string; id: string; date: string; comp: string; state: "pre" | "in" | "post";
  homeId: string; awayId: string; home: string; away: string; homeLogo?: string; awayLogo?: string;
  locked?: { h: number; a: number };
};

const box = { width: 34, background: "#0e1116", color: "inherit", border: "1px solid var(--line)", borderRadius: 6, padding: "3px 2px", textAlign: "center" as const, fontSize: 14 };

export default function RowPicks(p: Props) {
  const [ai, setAi] = useState<{ h: number; a: number } | null>(p.locked ?? null);
  const [loading, setLoading] = useState(!p.locked && p.state === "pre");
  const [h, setH] = useState("");
  const [a, setA] = useState("");
  const [saved, setSaved] = useState(false);
  const [started, setStarted] = useState(p.state !== "pre");

  useEffect(() => {
    setStarted(p.state !== "pre" || Date.now() >= new Date(p.date).getTime());
    const mine = loadPicks()[p.id];
    if (mine) {
      setH(String(mine.h));
      setA(String(mine.a));
      setSaved(true);
    }
  }, [p.id, p.date, p.state]);

  // Matches without a locked pick get a live model estimate (upcoming games only).
  useEffect(() => {
    if (p.locked || p.state !== "pre") return;
    let dead = false;
    fetch(`/api/pick?slug=${encodeURIComponent(p.slug)}&date=${encodeURIComponent(p.date)}&homeId=${p.homeId}&awayId=${p.awayId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (!dead && j) setAi({ h: j.h, a: j.a }); })
      .catch(() => {})
      .finally(() => { if (!dead) setLoading(false); });
    return () => { dead = true; };
  }, [p.locked, p.slug, p.date, p.homeId, p.awayId, p.state]);

  function commit(nh: string, na: string) {
    if (/^\d{1,2}$/.test(nh) && /^\d{1,2}$/.test(na)) {
      savePick({ id: p.id, slug: p.slug, comp: p.comp, date: p.date, home: p.home, homeLogo: p.homeLogo, away: p.away, awayLogo: p.awayLogo, h: +nh, a: +na, savedAt: new Date().toISOString() });
      setSaved(true);
    } else if (nh === "" && na === "") {
      deletePick(p.id);
      setSaved(false);
    } else setSaved(false);
  }

  const minePlain = saved && h !== "" && a !== "" ? `${h}-${a}` : "–";

  return (
    <>
      <span className="pickcell" title={p.locked ? "Model pick, locked the day before kick-off" : "Live model estimate (it locks the day before kick-off)"}>
        <small className="mut pl">Model</small>
        <b>{ai ? `${ai.h}-${ai.a}` : loading ? "…" : "–"}</b>
        {ai && !p.locked && <small className="mut">live</small>}
        {p.locked && <small title="Locked">🔒</small>}
      </span>
      <span className="pickcell">
        <small className="mut pl">You</small>
        {started ? (
          <b>{minePlain}</b>
        ) : (
          <>
            <input inputMode="numeric" aria-label={`${p.home} goals`} placeholder="–" value={h} style={box}
              onChange={(e) => { setH(e.target.value); setSaved(false); }} onBlur={() => commit(h, a)} />
            <span>-</span>
            <input inputMode="numeric" aria-label={`${p.away} goals`} placeholder="–" value={a} style={box}
              onChange={(e) => { setA(e.target.value); setSaved(false); }} onBlur={() => commit(h, a)} />
            <small style={{ color: "var(--w)", width: 12 }}>{saved ? "✓" : ""}</small>
          </>
        )}
      </span>
    </>
  );
}
