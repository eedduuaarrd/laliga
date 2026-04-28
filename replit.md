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

## Futbol Edge (v0.7.1 — April 2026, value-first proposals + podium UI)

### v0.7.1 changelog (current)

- **Backend** (`bet365.ts`): tightened the proposal floors to honour the user's "very probable AND maximum odds" goal — `MIN_PROB_FOR_SUGGESTION = 0.45`, `MIN_ODDS_FOR_SUGGESTION = 1.30` (player props at ≥1.55), eliminating noise like 1.05 Over 0.5 picks. Added a `valueScore = prob × odds + small bonuses (DK live, edge, sweet-spot 1.55-2.50 odds band)` field on every `SimpleBet` and a `qualityTier` enum (`joia | valor | segur | edge | estandard`) — "joia" = ≥65% prob AND ≥1.80 odds (the unicorn pick), "valor" = ≥55% prob AND ≥1.55 odds (sweet spot). Simples are now **sorted by `valueScore` first** (replaces the previous risk-tier-first sort) and de-duplicated to max 2 picks per match. Combos tightened: every leg must be ≥55% prob AND ≥1.50 odds.
- **Frontend** (`board.tsx`):
  - **Podium top-picks**: the "Top apostes del dia" section now renders a 3-column podium for the top 3 picks (ranks #1-#3) followed by an optional secondary 6-pick grid (#4-#9). Diversity cap of 2 per `market::selection` signature stops the same "Under 10.5 Còrners" pick from filling all 9 slots.
  - **Quality badges** (`QualityBadge`): new component with Catalan labels (`Joia / Valor / Segura / Edge + / Estàndard`), each with its own colour — fuchsia for joia, amber for valor, emerald for segura, cyan for edge. Surfaced on the Aposta del dia hero, every Hero pick card, and as the "Tipus" column in the simples table (replacing the previous `Risc` column there; `RiskPill` is still used inside match cards).
  - **VE column + sort picker**: the simples table now shows the value-expected metric (×prob × quota) instead of raw edge %, and a new `SortPicker` lets the user re-order by `Valor (default) / Probabilitat / Quota / Edge`.
  - Hero picks selection lowered to no minimum prob/odds (relies on tightened backend floors) and uses the backend `valueScore` directly.
- **Vite proxy fix** (carry-over from v0.7.0 setup): `/api` requests proxied to `http://localhost:8080` so the frontend talks to the API server in dev.

### v0.7.0 changelog

- **Backend** (`predictions.ts`): added `extractH2HSignal()` from ESPN summary `headToHeadGames` (last 6); `predictMatch()` now blends 65% book + 25% rates + 10% H2H when ≥3 H2H games exist (or 70/30 rates/H2H without book). Player props denominator changed from /1.0 to /0.70 (more realistic season fraction); `SHARE_CAP=0.42` so no single striker monopolises team xG.
- **Backend** (`bet365.ts`): added `kellyFraction(p,odds,cap=0.05)` (¼-Kelly capped at 5%) and `confidenceScore()` (model agreement with book + edge bonus + sweet-spot bonus + DK-live boost). Both attached to every `MatchPick`, `SimpleBet`, and `ComboBet.legs[].matchId` for combo independence enforcement.
- **Frontend** (`board.tsx`):
  - **Bet slip**: floating bottom-right panel (`BetSlipPanel`) with localStorage persistence (`futbol-edge-slip`). `useBetSlip()` enforces combo independence (replaces existing leg from same match). Shows combined odds/prob/EV ratio + custom stake input + projected payout. "+ Afegir al butlletí" buttons on every market chip, hero card, simple bet row, and best-pick card. "Carrega aquesta combinada" one-click loader on each combo card.
  - **Aposta del dia hero**: full-width banner at the top selecting the single highest-composite-score simple bet (modelProb × odds + edge weight + confidence weight + DK-live boost). Shows quota / probability / Kelly stake / projected profit prominently.
  - **Kelly stake suggestion**: every hero card, best-pick card, and simple bet row now displays the recommended ¼-Kelly stake (€) and projected profit at that stake.
  - **Confidence indicator** (`ConfidenceBar`): compact bar showing model confidence with colour tier (high/mid/low) on every pick card and the Aposta del dia hero.
  - **1X2 probability bar** (`ProbabilityBar`): visual home/draw/away breakdown rendered between teams and best-picks bar inside each `MatchCard`.
  - Hero pick scoring now includes `confidence × 0.05` so high-confidence value picks rise above mediocre ones with the same EV.

## Futbol Edge (v0.6.0 — April 2026, keyless, multi-league, per-match best picks)

A focused, single-page **multi-league football betting board** with REAL bookmaker odds + a probabilistic model. The whole UI is in Catalan with a matte-black aesthetic and a single amber/gold accent. **Zero API keys required.**

### What it does (single page)

1. Lists upcoming/live matches across **12 competitions**: La Liga, Premier League, Serie A, Bundesliga, Ligue 1, Primeira Liga, Eredivisie, Champions League, Europa League, Conference League, La Liga 2, Championship. The board caps at **36 matches** total with **max 6 per league** to keep latency bounded; tier-1 leagues take priority within the next 10-day window. Each match exposes **~56 markets** in 15 groups + per-player markets (anytime scorer / 2+ goals / anytime assist / G+A) for the top 4 contributors per side (filtered to a goal-contribution probability ≥ 6%).
2. **Real DraftKings odds** (live/upcoming, pulled keyless from ESPN's public `pickcenter` feed) cover 1X2 and Over/Under 2.5; everything else is **model-derived** (Poisson-based) and clearly labelled. Market groups: 1X2, Doble oportunitat (1X / 12 / X2), Gols (O/U 0.5/1.5/2.5/3.5/4.5), BTTS, Resultat al descans (HT 1X2), Gol a cada part, Porteria a zero, Guanyar sense encaixar, Resultat exacte (top 5), Còrners (O/U 8.5/9.5/10.5), Targetes (O/U 3.5/4.5/5.5), Fores de joc (O/U 3.5/4.5), Faltes (O/U 22.5/25.5), Targeta vermella (Sí/No), Penal al partit (Sí/No), Golejadors, Assistents, Gol+Assistència.
3. **Per-match best picks (NEW v0.6)**: every match card surfaces three strategic recommendations side-by-side — `Segura` (highest probability ≥ 60% with non-trivial odds), `Valor` (best probability × odds sweet spot, the user-requested "safe + max odds" goal), and `Atrevida` (high odds ≥ 2.00 with the best supporting probability). Computed in `pickBestForMatch()` from the union of match-level + best-per-player markets, with deduping so no two slots show the same selection.
4. Suggests **simple bets** (top 60), ordered low-to-high risk (`molt baix → baix → moderat → alt`), filtered to selections with model probability ≥ 40% and odds ≥ 1.18 (no trivial Over 0.5 picks). Live DraftKings selections are preferred within the same risk tier. Per-player markets contribute one selection per player (the highest-EV one).
5. Suggests **combined bets** (NEW v0.6 algorithm): for each leg-count (2/3/4), brute-forces the combination that maximises **combined odds** while respecting a probability floor (50% / 25% / 10%). Built from per-match best picks (independent legs) ranked by EV (prob × odds) instead of raw probability, plus a "tot segur" 3-leg combo where every leg has individual prob ≥ 62%.
6. **League filter chips** + colour-coded league badges on every match card, hero pick and simple-bet row let users narrow down to a single competition with one click. Hero picks are tier-weighted so flagship leagues surface first when ties occur.

### Artifacts

- `artifacts/laliga-pro` — React + Vite frontend (now branded **"Futbol Edge"**, FE badge), single page (`/`), matte black palette, gold/amber primary, electric-green accent for positive edges. Per-market source dots (green = live DraftKings, amber = model). League filter chips + per-card league badges.
- `artifacts/api-server` — Express + TypeScript backend, ESPN-driven model + ESPN pickcenter for real DraftKings prices, fan-out across 12 leagues in parallel with per-league error tolerance. No third-party API key.

### Real-odds layer (keyless)

- `artifacts/api-server/src/lib/leagues.ts` — registry of the 12 supported competitions (`esp.1`, `eng.1`, `ita.1`, `ger.1`, `fra.1`, `por.1`, `ned.1`, `uefa.champions`, `uefa.europa`, `uefa.europa.conf`, `esp.2`, `eng.2`) with code/name/shortName/country/flag (ISO-2)/colour/tier metadata. Tier 1 = top-5 + UEFA top, tier 2 = lower divisions.
- `artifacts/api-server/src/lib/espn.ts` — every helper (`getScoreboard`, `getScoreboardRange`, `getEventSummary`, `getLeagueNews`, `getStandings`, `getTeamsList`, `getTeamRoster`, `getTeamDetail`, `getAthleteStats`) takes an optional `league` slug parameter (defaults to `esp.1`). All cache keys include the league so multiple competitions cohabit the same TTL cache.
- `artifacts/api-server/src/lib/draftkings-odds.ts` — pulls `pickcenter` for any match via the existing TTL-cached `getEventSummary` helper, picks the DraftKings provider, converts American moneylines (home / draw / away) and Over/Under 2.5 into decimal odds. Returns `null` when ESPN has not yet published a market (typically matches > 4-5 days away).
- `artifacts/api-server/src/data/matches.ts` — `getAllMatches()` fans out across all 12 leagues in parallel, dedupes by event id (preferring lower-tier when the same fixture appears twice — e.g. UCL vs domestic), and tags every `LiveMatch` with `leagueCode` + a `league` object.
- `artifacts/api-server/src/data/bet365.ts` — builds the board (one `BoardMatch` entry per fixture, with ~56 `markets` rows + a `playerMarkets` array of `BoardPlayerMarket` + a `league` field), tags each market `live` or `model` (Poisson + 5% overround), computes `modelProb` / `impliedProb` / `edge`, and produces simple/combined bet suggestions sorted by risk tier. Local Poisson PMF helpers compute corners/cards/offsides/fouls/HT lines from team xG; player markets reuse `buildPlayerPropsForSide` from `predictions.ts` (ESPN season leaders × team xG share). Static priors used for red card (~13%) and penalty (~27%) markets — model-tagged. Board capped at 36 fixtures with max 6 per league.
- `artifacts/api-server/src/routes/bet365.ts` — `GET /api/bet365/board` and `GET /api/bet365/suggestions`. Both responses include `liveMatchCount`, `liveMarketCount`, and `totalMatchCount` so the UI can show whether quotes are real DraftKings, fully model, or a mix.

> File names still say `bet365` for compatibility but the product is now branded **"Futbol Edge"** (rebranded from "La Liga Edge" in v0.5.0 when multi-league was added). The only freely accessible real bookmaker without a paid API key is DraftKings (via ESPN). Honest labelling: every real quote is tagged DraftKings; every model quote is tagged MODEL.

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

The layout (`src/components/layout.tsx`) is a thin matte-black topbar with the brand **"Futbol Edge"** (FE badge), a `N lligues · quotes en directe · model probabilístic` subtitle, a bankroll input (presets 10/50/100/500€, persisted to localStorage `futbol-edge-bankroll`), a live source label and a `N/M live` badge.

The board renders: hero metrics (live / upcoming / simples / combos), a "Apostes destacades" section with the top 6 hero picks, a sticky filter bar (risk chips, search, source toggle, edge-only toggle, **league chips with colour dots**), a "Quotes per partit" grid with each match card (header carries a `LeagueBadge` colour-tag), an ordered "Apostes simples" table (each row tagged with its league badge), and a "Combinades" section.

### Honesty rules (no fabricated data)

- `dashboard.modelAccuracy` returns zeros — no backtest yet, so we don't invent it.
- `dashboard.topScorer` / `topAssister` return `—` when ESPN's leader endpoints are empty for the league cache window.
- `referee` stats per match return zeros (not in ESPN public data).
- `match.events` and `match.momentum` return `[]` when ESPN doesn't supply them (typically pre-match).
- Match props (corners/cards/offsides) are modelled from xG and clearly labelled as modelled, not real bookmaker quotes.

### Notes

- "Today" is anchored to whatever ESPN considers the current matchday for each league slug.
- Free tier: no third-party connectors. Direct HTTPS to ESPN's public APIs only.
- Standings/players/injuries/teams modules are still La-Liga-only; they're only consumed by deprecated routes (briefing/dashboard/teams) not surfaced in the Futbol Edge frontend, so they don't block multi-league. The frontend's bet365 path uses `predictions.ts` + `matches.ts` + `bet365.ts`, all multi-league.
- API Server boots on `PORT=8080`. Frontend Vite dev server on `PORT=22546` (mapped to external 3000 by `.replit`).
- Both `dev` scripts in `artifacts/{api-server,laliga-pro}/package.json` set `PORT` and `BASE_PATH` defaults so the workflows work out of the box.
