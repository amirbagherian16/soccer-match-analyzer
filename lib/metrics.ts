import { outcomeOf, type Outcome } from "./score";

export type Sample = {
  pred: { h: number; a: number };
  actual: { h: number; a: number };
  probs?: { h: number; d: number; a: number }; // model only
};

export const CLASSES: Outcome[] = ["H", "D", "A"];

export type ClassStat = { cls: Outcome; support: number; predicted: number; precision: number | null; recall: number | null; f1: number | null };

export type Metrics = {
  n: number;
  exact: number; // share 0..1
  result: number; // W/D/L accuracy
  maeHome: number;
  maeAway: number;
  maeTotal: number;
  maeDiff: number;
  confusion: Record<Outcome, Record<Outcome, number>>; // [actual][predicted]
  classes: ClassStat[];
  macroF1: number;
  weightedF1: number;
  kappa: number | null;
  baselineHome: number; // accuracy of always predicting a home win
  baselineMajority: number; // accuracy of always predicting the most common actual result
  over25: { tp: number; fp: number; fn: number; tn: number; precision: number | null; recall: number | null; f1: number | null; accuracy: number };
  brier: number | null; // multi-class Brier (0 best, 0.667 = uniform guess)
  logLoss: number | null; // (0 best, 1.099 = uniform guess)
};

const div = (a: number, b: number) => (b === 0 ? null : a / b);
const f1of = (p: number | null, r: number | null) => (p == null || r == null || p + r === 0 ? (p == null && r == null ? null : 0) : (2 * p * r) / (p + r));

export function computeMetrics(samples: Sample[]): Metrics | null {
  const n = samples.length;
  if (!n) return null;

  const confusion = Object.fromEntries(CLASSES.map((a) => [a, Object.fromEntries(CLASSES.map((p) => [p, 0]))])) as Metrics["confusion"];
  let exact = 0, result = 0, eh = 0, ea = 0, et = 0, ed = 0;
  let tp = 0, fp = 0, fn = 0, tn = 0;
  let brier = 0, ll = 0, withProbs = 0;

  for (const s of samples) {
    const po = outcomeOf(s.pred.h, s.pred.a);
    const ao = outcomeOf(s.actual.h, s.actual.a);
    confusion[ao][po]++;
    if (s.pred.h === s.actual.h && s.pred.a === s.actual.a) exact++;
    if (po === ao) result++;
    eh += Math.abs(s.pred.h - s.actual.h);
    ea += Math.abs(s.pred.a - s.actual.a);
    et += Math.abs(s.pred.h + s.pred.a - (s.actual.h + s.actual.a));
    ed += Math.abs(s.pred.h - s.pred.a - (s.actual.h - s.actual.a));

    const pOver = s.pred.h + s.pred.a >= 3;
    const aOver = s.actual.h + s.actual.a >= 3;
    if (pOver && aOver) tp++; else if (pOver && !aOver) fp++; else if (!pOver && aOver) fn++; else tn++;

    if (s.probs) {
      withProbs++;
      const y = { H: ao === "H" ? 1 : 0, D: ao === "D" ? 1 : 0, A: ao === "A" ? 1 : 0 };
      const p = { H: s.probs.h, D: s.probs.d, A: s.probs.a };
      brier += CLASSES.reduce((acc, c) => acc + (p[c] - y[c]) ** 2, 0);
      ll += -Math.log(Math.max(p[ao], 1e-15));
    }
  }

  const classes: ClassStat[] = CLASSES.map((c) => {
    const tpc = confusion[c][c];
    const support = CLASSES.reduce((a, p) => a + confusion[c][p], 0);
    const predicted = CLASSES.reduce((a, t) => a + confusion[t][c], 0);
    const precision = div(tpc, predicted);
    const recall = div(tpc, support);
    return { cls: c, support, predicted, precision, recall, f1: f1of(precision, recall) };
  });
  const macroF1 = classes.reduce((a, c) => a + (c.f1 ?? 0), 0) / classes.length;
  const weightedF1 = classes.reduce((a, c) => a + (c.f1 ?? 0) * c.support, 0) / n;

  // Cohen's kappa: agreement beyond chance
  const po = result / n;
  const pe = CLASSES.reduce((a, c) => a + (classes.find((x) => x.cls === c)!.support / n) * (classes.find((x) => x.cls === c)!.predicted / n), 0);
  const kappa = pe === 1 ? null : (po - pe) / (1 - pe);

  const oP = div(tp, tp + fp);
  const oR = div(tp, tp + fn);
  const actualCounts = classes.map((c) => c.support);

  return {
    n,
    exact: exact / n,
    result: result / n,
    maeHome: eh / n,
    maeAway: ea / n,
    maeTotal: et / n,
    maeDiff: ed / n,
    confusion,
    classes,
    macroF1,
    weightedF1,
    kappa,
    baselineHome: classes[0].support / n,
    baselineMajority: Math.max(...actualCounts) / n,
    over25: { tp, fp, fn, tn, precision: oP, recall: oR, f1: f1of(oP, oR), accuracy: (tp + tn) / n },
    brier: withProbs === n ? brier / n : null,
    logLoss: withProbs === n ? ll / n : null,
  };
}
