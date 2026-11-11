"use client";
import { useMemo, useState } from "react";
import { CLASSES, computeMetrics, type Metrics, type Sample } from "@/lib/metrics";
import { label, type Outcome } from "@/lib/score";

export type MetricRow = {
  id: string;
  ai?: { h: number; a: number; probs?: { h: number; d: number; a: number } };
  me?: { h: number; a: number };
  result?: { h: number; a: number };
};

const pct = (x: number | null | undefined) => (x == null ? "–" : `${(x * 100).toFixed(1)}%`);
const dec = (x: number | null | undefined, d = 2) => (x == null ? "–" : x.toFixed(d));
const short: Record<Outcome, string> = { H: "Home win", D: "Draw", A: "Away win" };

function Card({ l, v, sub }: { l: string; v: string; sub?: string }) {
  return <div className="kpi"><small>{l}</small><b>{v}</b>{sub && <small>{sub}</small>}</div>;
}

export default function MetricsPanel({ rows }: { rows: MetricRow[] }) {
  const [who, setWho] = useState<"ai" | "me">("ai");
  const [both, setBoth] = useState(false);

  const m: Metrics | null = useMemo(() => {
    const samples: Sample[] = [];
    for (const r of rows) {
      if (!r.result) continue;
      if (both && !(r.ai && r.me)) continue;
      const pred = who === "ai" ? r.ai : r.me;
      if (!pred) continue;
      samples.push({ pred: { h: pred.h, a: pred.a }, actual: r.result, probs: who === "ai" ? r.ai?.probs : undefined });
    }
    return computeMetrics(samples);
  }, [rows, who, both]);

  return (
    <div className="card">
      <h2>Accuracy &amp; classification metrics</h2>
      <div className="chips">
        <button className={`chip ${who === "ai" ? "on" : ""}`} onClick={() => setWho("ai")} style={{ cursor: "pointer" }}>Model</button>
        <button className={`chip ${who === "me" ? "on" : ""}`} onClick={() => setWho("me")} style={{ cursor: "pointer" }}>You</button>
        <button className={`chip ${both ? "on" : ""}`} onClick={() => setBoth(!both)} style={{ cursor: "pointer" }} title="Only matches that both you and the model picked, for a fair head-to-head">Same matches only</button>
      </div>

      {!m ? (
        <div className="mut">No finished matches with a {who === "ai" ? "model" : "your"} pick yet. Metrics fill in automatically as results arrive.</div>
      ) : (
        <>
          {m.n < 30 && <div className="note" style={{ marginBottom: 8 }}>Only {m.n} finished match{m.n === 1 ? "" : "es"} so far: treat these numbers as noisy until you have 30+.</div>}
          <div className="kpis">
            <Card l="Matches scored" v={String(m.n)} />
            <Card l="Exact score hit rate" v={pct(m.exact)} />
            <Card l="Result accuracy (W/D/L)" v={pct(m.result)} sub={`always-home baseline ${pct(m.baselineHome)}`} />
            <Card l="Macro F1" v={dec(m.macroF1)} sub={`weighted ${dec(m.weightedF1)}`} />
            <Card l="Cohen's kappa" v={dec(m.kappa)} sub="0 = chance, 1 = perfect" />
            <Card l="Goals error (MAE)" v={dec(m.maeTotal)} sub={`home ${dec(m.maeHome)} · away ${dec(m.maeAway)}`} />
            <Card l="Goal-difference error" v={dec(m.maeDiff)} />
            {m.brier != null && <Card l="Brier score" v={dec(m.brier, 3)} sub="lower is better; guessing 1/3 each = 0.667" />}
            {m.logLoss != null && <Card l="Log loss" v={dec(m.logLoss, 3)} sub="lower is better; guessing 1/3 each = 1.099" />}
          </div>

          <h2 style={{ marginTop: 12 }}>Confusion matrix (rows = actual, columns = predicted)</h2>
          <table>
            <thead><tr><th>Actual ↓ / Predicted →</th>{CLASSES.map((c) => <th key={c}>{short[c]}</th>)}</tr></thead>
            <tbody>
              {CLASSES.map((a) => (
                <tr key={a}>
                  <td>{short[a]}</td>
                  {CLASSES.map((p) => (
                    <td key={p} style={a === p ? { color: "var(--w)", fontWeight: 700 } : undefined}>{m.confusion[a][p]}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>

          <h2 style={{ marginTop: 12 }}>Per-class precision / recall / F1</h2>
          <table>
            <thead><tr><th>Class</th><th>Actual (support)</th><th>Predicted</th><th>Precision</th><th>Recall</th><th>F1</th></tr></thead>
            <tbody>
              {m.classes.map((c) => (
                <tr key={c.cls}><td>{label(c.cls)}</td><td>{c.support}</td><td>{c.predicted}</td><td>{pct(c.precision)}</td><td>{pct(c.recall)}</td><td>{dec(c.f1)}</td></tr>
              ))}
            </tbody>
          </table>

          <h2 style={{ marginTop: 12 }}>Over 2.5 goals (from the predicted score)</h2>
          <div className="kpis">
            <Card l="Accuracy" v={pct(m.over25.accuracy)} />
            <Card l="Precision" v={pct(m.over25.precision)} />
            <Card l="Recall" v={pct(m.over25.recall)} />
            <Card l="F1" v={dec(m.over25.f1)} sub={`TP ${m.over25.tp} · FP ${m.over25.fp} · FN ${m.over25.fn} · TN ${m.over25.tn}`} />
          </div>
          <div className="note">
            Precision = of the results predicted for a class, how many were right. Recall = of the actual results in a class, how many were caught. F1 combines both. Metrics update on their own as final scores arrive, using the final score including extra time.
          </div>
        </>
      )}
    </div>
  );
}
