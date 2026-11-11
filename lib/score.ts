// Pure helpers shared by server, client and the daily script.
export type Outcome = "H" | "D" | "A";

export const outcomeOf = (h: number, a: number): Outcome => (h > a ? "H" : h === a ? "D" : "A");

export type Pick = { h: number; a: number };

export function judge(pred: Pick | null | undefined, res: Pick | null | undefined) {
  if (!pred || !res) return { exact: null as boolean | null, result: null as boolean | null };
  return {
    exact: pred.h === res.h && pred.a === res.a,
    result: outcomeOf(pred.h, pred.a) === outcomeOf(res.h, res.a),
  };
}

export type Entry = {
  id: string;
  slug: string;
  comp: string;
  date: string; // kick-off ISO
  homeId: string;
  home: string;
  homeLogo?: string;
  awayId: string;
  away: string;
  awayLogo?: string;
  ai: {
    h: number;
    a: number;
    p: number; // probability of that exact score
    probs: { h: number; d: number; a: number };
    lambdaH: number;
    lambdaA: number;
    madeAt: string;
  };
  result?: { h: number; a: number; at: string };
};

export const label = (o: Outcome) => (o === "H" ? "Home win" : o === "A" ? "Away win" : "Draw");

export type UserPick = Pick & {
  id: string;
  slug: string;
  comp: string;
  date: string;
  home: string;
  homeLogo?: string;
  away: string;
  awayLogo?: string;
  savedAt: string;
};
