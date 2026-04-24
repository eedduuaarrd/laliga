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

- `artifacts/api-server/src/data/`
  - `teams.ts` — 20 La Liga teams with attack/defense/home-advantage strengths and crest URLs.
  - `players.ts` — Full Real Madrid, Barcelona, Atlético squads + generic squads for the rest of the league.
  - `standings.ts` — Hand-tuned 2025-26 standings after 12 matchdays with form arrays and home/away splits.
  - `matches.ts` — Round-robin schedule, finished GW1-12, live GW13 (2 in-play), upcoming GW14-16.
  - `lineups.ts` — Lineup builder by formation, match stats, momentum series, events, referee stats.
  - `injuries.ts` — Injuries and suspensions with severity and impact scores.
  - `predictions.ts` — Poisson prediction engine with form, absence, and H2H factors plus market-odds value calc.
- `artifacts/api-server/src/routes/` — One file per resource (teams, standings, matches, predictions, players, injuries, h2h, value-bets, briefing, dashboard); each route validates its response with the generated Zod schema from `@workspace/api-zod`.
- All routes are mounted under `/api`.

### Frontend pages

Dashboard, Morning Briefing, Matches (list + detail), Predictions (list + detail with Poisson heatmap), Standings, Teams (grid + detail), Players (list + radar/recent-form detail), Value Bets, Injuries.

### Notes

- "Today" is anchored to April 24, 2026 in the seed data.
- Free tier: no live API integrations; in-memory data is intentional.
