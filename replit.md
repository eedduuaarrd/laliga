# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

## La Liga Edge (v0.3.1 — April 2026, keyless)

A focused, single-page La Liga betting board with REAL bookmaker odds + a probabilistic model. The whole UI is in Catalan with a matte-black aesthetic and a single amber/gold accent. **Zero API keys required.**

### What it does (single page)

1. Lists every La Liga match in the next 10 days (plus anything live now), each with **real DraftKings odds** for 1X2 and Over/Under 2.5 (pulled keyless from ESPN's public `pickcenter` feed) plus model-derived odds for the remaining markets (Over/Under 1.5/3.5, BTTS Yes/No). Each market is tagged `live` or `model` individually.
2. Suggests **simple bets**, ordered low-to-high risk (`molt baix → baix → moderat → alt`), filtered to selections with model probability ≥ 40%; live DraftKings selections are preferred within the same risk tier.
3. Suggests **combined bets** (2/3/4 legs) built from the strongest pick *per match* (so legs are independent), sorted by joint probability.

### Artifacts

- `artifacts/laliga-pro` — React + Vite frontend, single page (`/`), matte black palette, gold/amber primary, electric-green accent for positive edges. Per-market source dots (green = live DraftKings, amber = model).
- `artifacts/api-server` — Express + TypeScript backend, ESPN-driven model + ESPN pickcenter for real DraftKings prices. No third-party API key.

### Real-odds layer (keyless)

- `artifacts/api-server/src/lib/draftkings-odds.ts` — pulls `pickcenter` for any La Liga match via the existing TTL-cached `getEventSummary` helper, picks the DraftKings provider, converts American moneylines (home / draw / away) and Over/Under 2.5 into decimal odds. Returns `null` when ESPN has not yet published a market (typically matches > 4-5 days away).
- `artifacts/api-server/src/data/bet365.ts` — builds the board (one entry per match × 11 markets), tags each market `live` (real DraftKings price) or `model` (Poisson + 5% overround), computes `modelProb` / `impliedProb` / `edge`, and produces simple/combined bet suggestions sorted by risk tier.
- `artifacts/api-server/src/routes/bet365.ts` — `GET /api/bet365/board` and `GET /api/bet365/suggestions`. Both responses include `liveMatchCount`, `liveMarketCount`, and `totalMatchCount` so the UI can show whether quotes are real DraftKings, fully model, or a mix.

> File names still say `bet365` for compatibility but the product is now branded **"La Liga Edge"** because the only freely accessible real bookmaker for La Liga without a paid API key is DraftKings (via ESPN). Honest labelling: every real quote is tagged DraftKings; every model quote is tagged MODEL.

### Backend layout

### Live data source (v0.2.0 — April 2026 rewrite)

**All data is now LIVE from ESPN's public soccer APIs.** No in-memory seed, no fabricated stats.

- `artifacts/api-server/src/lib/espn.ts` — typed HTTPS client for ESPN's `site.api.espn.com/apis/site/v2/sports/soccer/esp.1/...` and `sports.core.api.espn.com/v2/.../seasons/{year}/teams/{id}/athletes` endpoints. No API key required.
- `artifacts/api-server/src/lib/cache.ts` — in-memory TTL cache (60s default; 5min for rosters; 24h for player career meta) to keep ESPN happy.
- `artifacts/api-server/src/data/`
  - `teams.ts` — fetches `teams` index + per-team `roster`. Manager comes from coaches array; founded/stadium nullable when ESPN doesn't expose them.
  - `players.ts` — derives season goals/assists/appearances from `/teams/{id}/athletes/{playerId}/statistics`. Headshot URL via athletes index. Shirt number/age nullable per ESPN.
  - `standings.ts` — `/standings` with current matchday gameweek extraction. Home/away splits left as 0 because soccer endpoints don't expose `homeWins` etc.
  - `matches.ts` — scoreboard + summary endpoints. Status mapped to `scheduled|live|finished`. Real kickoffs, scores, and venue.
  - `lineups.ts` — predicted XI by formation when ESPN doesn't supply official lineups; for live/finished matches reads real key events (goals, yellow/red, sub, VAR) from `summary.keyEvents` and real boxscore `statistics` matched to each team. Momentum derived from key events with exponential decay.
  - `injuries.ts` — ESPN's roster `injuries[]` is empty for La Liga, so the implementation **mines the `/news` feed** for injury/suspension keywords, links each story to its `athlete` + `team` categories, aggregates severity and body part across all related articles, and dedupes per player. Returns enriched records with headshot, shirt number, position label, body part, severity, time-since-notification, and an impact score (position weight × severity).
  - `live-markets.ts` — in-play markets computed from live state via Poisson on remaining time: 1X2, next goal, O/U 2.5/3.5, BTTS, clean sheet, cards O/U 3.5/4.5/5.5, corners O/U 8.5/9.5. `getLiveOdds()` parses real DraftKings moneylines, spread, and totals from `pickcenter`, with derived implied probabilities.
  - `predictions.ts` — **bookmaker-blended Poisson model**. Pulls `pickcenter` (DraftKings odds) when available, blends 70% market / 30% Poisson on team xG. Player props derived from real season per-game rates × predicted team xG. `Prediction.source` = `bookmaker` or `model`; `bookmaker` and `oddsLastUpdate` exposed to the UI.
- `artifacts/api-server/src/routes/` — One file per resource. Endpoints added in v0.2.0:
  - `GET /api/predictions/{matchId}/players` → anytime scorer / 2+ goals / anytime assist / G+A probabilities per player.
  - `GET /api/predictions/{matchId}/lineups` → probable XI + bench per side with formation and confidence.
  - `GET /api/matches/{id}` now returns `liveMarkets`, `liveOdds`, and `suspensions[]` (filtered injuries for the two clubs) for live or recent matches.
- All routes are mounted under `/api`.

### Frontend pages (post-v0.3.1 rewrite)

A single page only: `src/pages/board.tsx` mounted at `/`. The previous Dashboard / Briefing / Matches / Predictions / Standings / Teams / Players / Value Bets / Injuries pages have been removed; their backend routes still exist but are not surfaced.

The layout (`src/components/layout.tsx`) is a thin matte-black topbar with the brand "La Liga Edge", a live source label (`Quotes reals · DraftKings (via ESPN)` or fallback variants), and a `N/M live` badge showing how many matches have real bookmaker prices.

### Honesty rules (no fabricated data)

- `dashboard.modelAccuracy` returns zeros — no backtest yet, so we don't invent it.
- `dashboard.topScorer` / `topAssister` return `—` when ESPN's leader endpoints are empty for the league cache window.
- `referee` stats per match return zeros (not in ESPN public data).
- `match.events` and `match.momentum` return `[]` when ESPN doesn't supply them (typically pre-match).
- Match props (corners/cards/offsides) are modelled from xG and clearly labelled as modelled, not real bookmaker quotes.

### Notes

- "Today" is anchored to whatever ESPN considers the current matchday for `esp.1` (Spanish La Liga).
- Free tier: no third-party connectors. Direct HTTPS to ESPN's public APIs only.
- API Server boots on `PORT=8080`. Frontend Vite dev server on `PORT=22546` (mapped to external 3000 by `.replit`).
- Both `dev` scripts in `artifacts/{api-server,laliga-pro}/package.json` set `PORT` and `BASE_PATH` defaults so the workflows work out of the box.
