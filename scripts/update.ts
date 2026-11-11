/**
 * Daily job (GitHub Action): lock the model's exact-score pick for tomorrow's matches,
 * and fill in final scores for earlier entries. Writes data/predictions.json.
 *
 *   npx tsx scripts/update.ts            # tomorrow (UTC)
 *   npx tsx scripts/update.ts 20261112   # a specific day
 */
import fs from "node:fs";
import path from "node:path";
import { COMPS, compName } from "../lib/leagues";
import { getResult, getScoreboard } from "../lib/espn";
import { predictMatch } from "../lib/predict";
import type { Entry } from "../lib/score";

const FILE = process.env.DATA_FILE ?? path.join(process.cwd(), "data", "predictions.json");
const ymd = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, "");

async function main() {
  const entries: Entry[] = JSON.parse(fs.readFileSync(FILE, "utf8"));
  const byId = new Map(entries.map((e) => [e.id, e]));

  // 1) Resolve finished matches
  let resolved = 0;
  for (const e of entries) {
    if (e.result || new Date(e.date).getTime() > Date.now() - 150 * 60_000) continue;
    const r = await getResult(e.slug, e.id);
    if (r?.completed) {
      e.result = { h: r.h, a: r.a, at: new Date().toISOString() };
      resolved++;
    }
  }

  // 2) Lock predictions for the target day
  const target = process.argv[2] ?? ymd(new Date(Date.now() + 24 * 3600_000));
  let added = 0;
  for (const c of COMPS) {
    const fixtures = await getScoreboard(c.slug, target);
    for (const f of fixtures) {
      if (f.state !== "pre" || byId.has(f.id)) continue;
      const p = await predictMatch({ slug: f.slug, date: f.date, homeId: f.home.id, awayId: f.away.id });
      if (!p) continue;
      const entry: Entry = {
        id: f.id,
        slug: f.slug,
        comp: compName(f.slug),
        date: f.date,
        homeId: f.home.id,
        home: f.home.name,
        homeLogo: f.home.logo,
        awayId: f.away.id,
        away: f.away.name,
        awayLogo: f.away.logo,
        ai: {
          h: p.pick.h,
          a: p.pick.a,
          p: +p.pick.p.toFixed(4),
          probs: { h: +p.blend.h.toFixed(4), d: +p.blend.d.toFixed(4), a: +p.blend.a.toFixed(4) },
          lambdaH: +p.lambdaH.toFixed(3),
          lambdaA: +p.lambdaA.toFixed(3),
          madeAt: new Date().toISOString(),
        },
      };
      entries.push(entry);
      byId.set(entry.id, entry);
      added++;
    }
  }

  entries.sort((a, b) => b.date.localeCompare(a.date));
  fs.writeFileSync(FILE, JSON.stringify(entries, null, 1) + "\n");
  console.log(`target ${target}: +${added} predictions, ${resolved} resolved, ${entries.length} total`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
