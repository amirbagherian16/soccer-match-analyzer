"use client";
import { useState } from "react";

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
                <td>{value && <span className="pill W">VALUE</span>}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {ready && <div className="note">Bookmaker margin (overround): {((over - 1) * 100).toFixed(1)}%</div>}
    </div>
  );
}

export default function OddsCompare({ outcomes, ou }: { outcomes: Row[]; ou: Row[] }) {
  const [vals, setVals] = useState<Record<string, string>>({});
  const set = (k: string, v: string) => setVals((s) => ({ ...s, [k]: v }));
  return (
    <>
      <Group title="Match result odds" rows={outcomes} vals={vals} set={set} />
      <Group title="Over / Under 2.5 goals odds" rows={ou} vals={vals} set={set} />
      <div className="note">Enter decimal odds from your bookmaker. “Edge” is model probability minus the bookmaker&apos;s margin-free probability; EV is expected profit per 1 unit staked if the model were right. The model is simple, so treat “VALUE” as a prompt to look closer, not a bet signal.</div>
    </>
  );
}
