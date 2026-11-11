# Soccer Match Analyzer

Dynamic Next.js site that lists club and national-team matches and, for each match/club, shows form and stats.

**Data:** ESPN's public endpoints. No API key or database is needed.

## What it shows (per club, per tournament or all tournaments)
- Current streak, unbeaten and winless runs
- Goals scored and conceded, last 10 matches
- Per-match xG for the last 10 matches (ESPN xG; shown as n/a where ESPN has none)
- Clean sheets, matches with 4+ goals scored, top scorer
- Best attackers, midfielders, defenders and goalkeepers (rating derived from ESPN match stats)

## Coverage
Top 8 leagues (England, Spain, Italy, Germany, France, Netherlands, Portugal, Turkey), Champions/Europa/Conference League, FA Cup, EFL Cup, Copa del Rey, DFB-Pokal, Coppa Italia, Coupe de France, plus World Cup, qualifiers, Euros, Nations League, Copa America and international friendlies. Edit `lib/leagues.ts` to add more.

## Run
```bash
npm install
npm run dev   # http://localhost:3000
```

For analysis only. ESPN data is unofficial and may change; check the terms of use before commercial use. Please gamble responsibly.

## Predictions tracker
- Each match page shows the model's exact-score pick (most likely result from the Poisson/Elo blend, then the likeliest scoreline for that result) and lets you submit your own score before kick-off.
- `.github/workflows/predictions.yml` runs every 6 hours: it locks picks for tomorrow's matches and records final scores, committing `data/predictions.json`.
- The **Predictions** tab filters by competition, status, team and who picked, and marks exact-score and W/D/L hits for the model and for you.
- Your picks are stored on the server (Upstash Redis), so they appear in any browser. Export/Import is only for backups.
- The tab also reports accuracy, goal error, a confusion matrix, per-class precision/recall/F1, macro F1, kappa, over-2.5 classification and (for the model) Brier score and log loss. They recompute as final scores arrive.
- Run the job manually: `npx tsx scripts/update.ts [YYYYMMDD]`.

## Pick storage setup (one time, free)
1. Vercel dashboard > your project > **Storage** > **Create Database** > **Upstash** (Redis) > free plan > connect it to the project. This adds `KV_REST_API_URL` and `KV_REST_API_TOKEN` automatically.
2. Project > **Settings > Environment Variables**: add `PICKS_PASSCODE` (any secret). Without it, anyone who finds the site could add picks.
3. **Redeploy**. The first time you save a pick in a browser it asks for the passcode and remembers it there.

Picks are locked at kick-off (the server rejects late edits and deletes).
