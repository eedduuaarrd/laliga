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

## La Liga Pro Analytics

A comprehensive real-time La Liga analytics and prediction platform built on this monorepo.

### Artifacts

- `artifacts/laliga-pro` — React + Vite frontend (deep navy / lime-green dark theme).
- `artifacts/api-server` — Express + TypeScript backend, OpenAPI-driven, no DB (in-memory seed data for the 2025-26 La Liga season).

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

### Frontend pages

Dashboard, Morning Briefing, Matches (list + detail), Predictions (list + detail with Poisson heatmap, BTTS / Over 2.5 / Clean Sheets, probable lineups, player props), Standings, Teams (grid + detail), Players (list + radar/recent-form detail), Value Bets, Injuries.

The frontend layout shows a persistent **"Live Market Data · ESPN public APIs"** badge in the topbar. Predictions detail surfaces the data source (`Bookmaker · DraftKings` vs `Model · Poisson`) and the time the odds were last refreshed.

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
