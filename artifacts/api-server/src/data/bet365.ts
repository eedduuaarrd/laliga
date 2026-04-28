// Betting board: combines REAL DraftKings odds (pulled keyless from ESPN's
// public pickcenter feed) with the underlying Poisson model. For each match we
// expose dozens of market rows (1X2, double chance, totals, BTTS, exact score,
// clean sheet, win-to-nil, half-time, corners, cards, offsides, fouls, red
// card, penalty) plus per-player markets (anytime scorer, 2+ goals, anytime
// assist). Each row is tagged `live` (real DraftKings) or `model` (Poisson),
// and we generate ordered simple-bet and combo-bet recommendations from the
// whole catalogue.

import { getMatchesByStatus, type LiveMatch } from "./matches.js";
import { predictMatch, buildPlayerPropsForSide } from "./predictions.js";
import { getLiveOddsForMatch, type LiveOddsSnapshot } from "../lib/draftkings-odds.js";

export type MarketSource = "live" | "model";

export interface BoardMarket {
  key: string;
  group: string;
  selection: string;
  odds: number | null;
  modelProb: number;
  impliedProb: number | null;
  edge: number | null;
  source: MarketSource;
}

export interface BoardPlayerMarket {
  playerId: number;
  playerName: string;
  team: "home" | "away";
  teamShort: string;
  position: string;
  positionLabel: string;
  headshot: string | null;
  seasonGoals: number;
  seasonAssists: number;
  markets: BoardMarket[];
}

export interface BoardMatchLeague {
  code: string;
  name: string;
  shortName: string;
  country: string;
  flag: string;
  color: string;
  tier: number;
}

/**
 * A single recommended pick for a match. Surfaces the key metrics together so
 * the UI can render a self-contained card without re-deriving anything.
 */
export interface MatchPick {
  key: string;
  group: string;
  selection: string;
  odds: number;
  modelProb: number;
  edge: number;
  source: MarketSource;
  /** prob × odds. 1.0 = fair, > 1.0 = positive expected value vs the price. */
  valueScore: number;
  /** Recommended Kelly fraction of bankroll (0..0.05, capped at 5%). */
  kellyFraction: number;
  /** Composite confidence score 0..1 (real DK + edge + sample size). */
  confidence: number;
}

/**
 * Three strategic picks per match, balancing safety vs odds:
 *   safe  — highest model prob (≥ 60%) with odds that aren't trivially low.
 *   value — best probability × odds combination (the "sweet spot").
 *   bold  — high-odds pick (≥ 2.00) with the best supporting probability.
 */
export interface MatchBestPicks {
  safe: MatchPick | null;
  value: MatchPick | null;
  bold: MatchPick | null;
}

export interface BoardMatch {
  matchId: number;
  status: "live" | "upcoming";
  kickoff: string;
  minute: number | null;
  homeShort: string;
  awayShort: string;
  homeName: string;
  awayName: string;
  homeCrest: string;
  awayCrest: string;
  homeScore: number | null;
  awayScore: number | null;
  /** "live" when at least one real bookmaker market is available, else "model". */
  source: MarketSource;
  bookmaker: string | null;
  oddsLastUpdate: string | null;
  topPick: { selection: string; modelProb: number; odds: number | null } | null;
  bestPicks: MatchBestPicks;
  markets: BoardMarket[];
  playerMarkets: BoardPlayerMarket[];
  league: BoardMatchLeague;
}

// ---------------------------------------------------------------------------
// Pricing helpers
// ---------------------------------------------------------------------------
const MODEL_OVERROUND = 1.05;
function modelOdds(p: number): number {
  if (p <= 0.001) return 999;
  return +((MODEL_OVERROUND / p)).toFixed(2);
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

function buildMarketRow(
  key: string,
  group: string,
  selection: string,
  liveOdd: number | null | undefined,
  modelProb: number,
): BoardMarket {
  const p = clamp01(modelProb);
  const realOdd = liveOdd && liveOdd > 1.001 ? liveOdd : null;
  const odds = realOdd ?? modelOdds(p);
  const impliedProb = odds > 0 ? +(1 / odds).toFixed(4) : null;
  const edge = +(p * odds - 1).toFixed(4);
  return {
    key,
    group,
    selection,
    odds: +odds.toFixed(2),
    modelProb: +p.toFixed(4),
    impliedProb,
    edge,
    source: realOdd ? "live" : "model",
  };
}

// ---------------------------------------------------------------------------
// Poisson helpers (local — predictions.ts already gives us the matrix; these
// are for new markets that need PMF/CDF on per-side or per-stat lambdas).
// ---------------------------------------------------------------------------
function poissonPmf(k: number, lambda: number): number {
  if (k < 0) return 0;
  const lam = Math.max(1e-9, lambda);
  let logP = -lam + k * Math.log(lam);
  for (let i = 1; i <= k; i++) logP -= Math.log(i);
  return Math.exp(logP);
}

/** P(X > line) where line is a half-integer (0.5, 1.5, ...). */
function poissonOverHalfLine(line: number, lambda: number): number {
  const N = Math.floor(line);
  let cum = 0;
  for (let i = 0; i <= N; i++) cum += poissonPmf(i, lambda);
  return clamp01(1 - cum);
}

/** Convolve two Poisson distributions to get 1X2 probabilities. */
function pois1x2(lambdaH: number, lambdaA: number): { pH: number; pD: number; pA: number } {
  const N = 7;
  let pH = 0, pD = 0, pA = 0;
  for (let i = 0; i <= N; i++) {
    const piH = poissonPmf(i, lambdaH);
    for (let j = 0; j <= N; j++) {
      const cell = piH * poissonPmf(j, lambdaA);
      if (i > j) pH += cell;
      else if (i === j) pD += cell;
      else pA += cell;
    }
  }
  const t = pH + pD + pA || 1;
  return { pH: pH / t, pD: pD / t, pA: pA / t };
}

function probOver(matrix: { homeGoals: number; awayGoals: number; probability: number }[], threshold: number): number {
  let p = 0;
  for (const cell of matrix) {
    if (cell.homeGoals + cell.awayGoals > threshold) p += cell.probability;
  }
  return clamp01(p);
}

/** P(home wins AND away does not score) */
function probWinToNilHome(matrix: { homeGoals: number; awayGoals: number; probability: number }[]): number {
  let p = 0;
  for (const c of matrix) if (c.homeGoals > c.awayGoals && c.awayGoals === 0) p += c.probability;
  return clamp01(p);
}
function probWinToNilAway(matrix: { homeGoals: number; awayGoals: number; probability: number }[]): number {
  let p = 0;
  for (const c of matrix) if (c.awayGoals > c.homeGoals && c.homeGoals === 0) p += c.probability;
  return clamp01(p);
}

// La Liga static priors (model only, derived from public season averages).
const PRIOR_PENALTY_AWARDED = 0.27;   // ~27% of LL matches see at least one penalty
const PRIOR_RED_CARD       = 0.13;   // ~13% of LL matches see a red card

/**
 * Kelly Criterion: optimal fraction of bankroll to bet on a single outcome
 * given the model probability `p` and decimal `odds`. Returns 0 when there's
 * no edge. We always cap at `cap` (default 5% / "quarter Kelly") to stay
 * survivable even if the model overshoots.
 */
export function kellyFraction(p: number, odds: number, cap = 0.05): number {
  if (!isFinite(p) || !isFinite(odds) || p <= 0 || odds <= 1.001) return 0;
  const b = odds - 1;
  const q = 1 - p;
  const f = (b * p - q) / b;
  if (f <= 0) return 0;
  // Quarter-Kelly to dampen variance; capped at `cap` of bankroll.
  return +Math.min(cap, f * 0.25).toFixed(4);
}

/**
 * Confidence (0..1) for a single market pick. Combines:
 *   - market provenance (real DraftKings line is more trustworthy than model)
 *   - edge magnitude (bigger edge = more conviction)
 *   - probability sanity (extreme values get slightly penalised)
 */
export function confidenceScore(mk: { source: MarketSource; modelProb: number; edge: number | null }): number {
  const liveBoost = mk.source === "live" ? 0.30 : 0.0;
  const edge = mk.edge ?? 0;
  const edgeBoost = Math.max(0, Math.min(0.35, edge * 2.5)); // edge of +14% gives full 0.35
  // Sweet-spot bonus: probabilities near 0.45-0.78 are the most "decidable".
  const p = mk.modelProb;
  const sweet = p >= 0.40 && p <= 0.85 ? 0.20 : p >= 0.30 ? 0.10 : 0.0;
  // Base 0.15 so we never report 0.
  return +Math.min(1, 0.15 + liveBoost + edgeBoost + sweet).toFixed(3);
}

/**
 * Pick the strategic "best picks" for a match: a safe one (max prob with a
 * decent price), a value one (best probability × odds sweet spot), and a bold
 * one (high odds with the best supporting probability).
 */
function toMatchPick(mk: BoardMarket): MatchPick {
  const odds = mk.odds ?? 1;
  const p = mk.modelProb;
  return {
    key: mk.key,
    group: mk.group,
    selection: mk.selection,
    odds,
    modelProb: p,
    edge: mk.edge ?? 0,
    source: mk.source,
    valueScore: +(p * odds).toFixed(4),
    kellyFraction: kellyFraction(p, odds),
    confidence: confidenceScore(mk),
  };
}

function pickBestForMatch(universe: BoardMarket[]): MatchBestPicks {
  if (universe.length === 0) return { safe: null, value: null, bold: null };

  // SAFE: highest probability among picks priced ≥ 1.40 (avoid trivial Over 0.5).
  // Falls back to ≥ 1.20 if nothing matches the stricter threshold.
  const safeStrong = universe.filter((m) => (m.odds ?? 0) >= 1.40 && m.modelProb >= 0.55);
  const safePool = safeStrong.length > 0
    ? safeStrong
    : universe.filter((m) => (m.odds ?? 0) >= 1.20);
  const safeMk = [...safePool]
    .sort((a, b) => b.modelProb - a.modelProb)[0];

  // VALUE: best probability × odds with prob ≥ 0.45 — the sweet spot the
  // user explicitly asked for: safe but with the highest possible odds.
  const valuePool = universe.filter((m) => (m.odds ?? 0) >= 1.50 && m.modelProb >= 0.45);
  const valueMk = [...valuePool]
    .sort((a, b) => (b.modelProb * (b.odds ?? 1)) - (a.modelProb * (a.odds ?? 1)))[0];

  // BOLD: high odds (≥ 2.00) with the highest supporting probability.
  const boldPool = universe.filter((m) => (m.odds ?? 0) >= 2.00 && m.modelProb >= 0.28);
  const boldMk = [...boldPool]
    .sort((a, b) => (b.modelProb * (b.odds ?? 1)) - (a.modelProb * (a.odds ?? 1)))[0];

  // Avoid showing the same selection in two slots — promote the next best one.
  const seen = new Set<string>();
  const out: MatchBestPicks = { safe: null, value: null, bold: null };

  if (safeMk) {
    out.safe = toMatchPick(safeMk);
    seen.add(safeMk.key);
  }
  if (valueMk && !seen.has(valueMk.key)) {
    out.value = toMatchPick(valueMk);
    seen.add(valueMk.key);
  } else {
    const fallback = [...valuePool].filter((m) => !seen.has(m.key))
      .sort((a, b) => (b.modelProb * (b.odds ?? 1)) - (a.modelProb * (a.odds ?? 1)))[0];
    if (fallback) {
      out.value = toMatchPick(fallback);
      seen.add(fallback.key);
    }
  }
  if (boldMk && !seen.has(boldMk.key)) {
    out.bold = toMatchPick(boldMk);
  } else {
    const fallback = [...boldPool].filter((m) => !seen.has(m.key))
      .sort((a, b) => (b.modelProb * (b.odds ?? 1)) - (a.modelProb * (a.odds ?? 1)))[0];
    if (fallback) out.bold = toMatchPick(fallback);
  }

  return out;
}

// ---------------------------------------------------------------------------
// Build a single match card with all the markets we can derive.
// ---------------------------------------------------------------------------
export async function buildBoardMatch(m: LiveMatch): Promise<BoardMatch> {
  const { prediction, poisson, summary } = await predictMatch(m);
  const live: LiveOddsSnapshot | null = await getLiveOddsForMatch(m.id, m.leagueCode).catch(() => null);

  const lambdaH = prediction.expectedHomeGoals;
  const lambdaA = prediction.expectedAwayGoals;
  const totalLambda = lambdaH + lambdaA;

  // ---- Match result
  const probHome = prediction.homeWinProb;
  const probDraw = prediction.drawProb;
  const probAway = prediction.awayWinProb;

  // ---- Goals totals
  const probOver05 = probOver(poisson.matrix, 0);
  const probOver15 = probOver(poisson.matrix, 1);
  const probOver25 = prediction.over25Prob;
  const probOver35 = probOver(poisson.matrix, 3);
  const probOver45 = probOver(poisson.matrix, 4);
  const probBttsYes = prediction.bttsProb;

  // ---- Half-time (≈45% of total goals fall in H1)
  const ht = pois1x2(lambdaH * 0.45, lambdaA * 0.45);
  // Both halves with goal: P(H1>0) AND P(H2>0)  (independent halves)
  const probH1Goal = poissonOverHalfLine(0.5, totalLambda * 0.45);
  const probH2Goal = poissonOverHalfLine(0.5, totalLambda * 0.55);
  const probBothHalvesGoal = clamp01(probH1Goal * probH2Goal);

  // ---- Clean sheets / win to nil
  const probCSHome = prediction.cleanSheetHome; // away does not score
  const probCSAway = prediction.cleanSheetAway; // home does not score
  const probWtnHome = probWinToNilHome(poisson.matrix);
  const probWtnAway = probWinToNilAway(poisson.matrix);

  // ---- Corners (model). LL avg ≈ 9.3, lightly modulated by total xG.
  const expCorners = +(2.5 + totalLambda * 2.6).toFixed(2);   // ~9-11 typical
  const probCornersOver85  = poissonOverHalfLine(8.5,  expCorners);
  const probCornersOver95  = poissonOverHalfLine(9.5,  expCorners);
  const probCornersOver105 = poissonOverHalfLine(10.5, expCorners);

  // ---- Cards (model). LL yellow+red avg ≈ 5/match.
  const expCards = +(3.5 + totalLambda * 0.6).toFixed(2);    // ~5-6 typical
  const probCardsOver35 = poissonOverHalfLine(3.5, expCards);
  const probCardsOver45 = poissonOverHalfLine(4.5, expCards);
  const probCardsOver55 = poissonOverHalfLine(5.5, expCards);

  // ---- Offsides (model). LL avg ≈ 4.2/match.
  const expOffsides = +(3.0 + totalLambda * 0.4).toFixed(2);
  const probOffsidesOver35 = poissonOverHalfLine(3.5, expOffsides);
  const probOffsidesOver45 = poissonOverHalfLine(4.5, expOffsides);

  // ---- Fouls (model). LL avg ≈ 23/match.
  const expFouls = +(20 + totalLambda * 1.2).toFixed(2);
  const probFoulsOver225 = poissonOverHalfLine(22.5, expFouls);
  const probFoulsOver255 = poissonOverHalfLine(25.5, expFouls);

  // ---- Red card / penalty (static priors — model only)
  const probRed = PRIOR_RED_CARD;
  const probPen = PRIOR_PENALTY_AWARDED;

  // ---- Top scorelines from Poisson matrix
  const topScores = [...poisson.matrix]
    .sort((a, b) => b.probability - a.probability)
    .slice(0, 5);

  // Real DK markets so far: 1X2 + Over/Under 2.5 (when totalLine matches 2.5).
  const liveOver25 = live && live.totalLine === 2.5 ? live.over : null;
  const liveUnder25 = live && live.totalLine === 2.5 ? live.under : null;

  const homeName = m.homeTeam.shortName;
  const awayName = m.awayTeam.shortName;

  const markets: BoardMarket[] = [
    // 1X2 (real DK when available)
    buildMarketRow("1x2-home", "1X2", `${homeName} guanya`, live?.home, probHome),
    buildMarketRow("1x2-draw", "1X2", "Empat", live?.draw, probDraw),
    buildMarketRow("1x2-away", "1X2", `${awayName} guanya`, live?.away, probAway),

    // Doble oportunitat (model)
    buildMarketRow("dc-1x", "Doble oportunitat", `${homeName} o empat`, null, probHome + probDraw),
    buildMarketRow("dc-12", "Doble oportunitat", "Sense empat (1 o 2)", null, probHome + probAway),
    buildMarketRow("dc-x2", "Doble oportunitat", `Empat o ${awayName}`, null, probDraw + probAway),

    // Gols (mix: 2.5 is real DK, rest model)
    buildMarketRow("ou-05-over",  "Gols",  "Over 0.5",  null, probOver05),
    buildMarketRow("ou-05-under", "Gols",  "Under 0.5", null, 1 - probOver05),
    buildMarketRow("ou-15-over",  "Gols",  "Over 1.5",  null, probOver15),
    buildMarketRow("ou-15-under", "Gols",  "Under 1.5", null, 1 - probOver15),
    buildMarketRow("ou-25-over",  "Gols",  "Over 2.5",  liveOver25, probOver25),
    buildMarketRow("ou-25-under", "Gols",  "Under 2.5", liveUnder25, 1 - probOver25),
    buildMarketRow("ou-35-over",  "Gols",  "Over 3.5",  null, probOver35),
    buildMarketRow("ou-35-under", "Gols",  "Under 3.5", null, 1 - probOver35),
    buildMarketRow("ou-45-over",  "Gols",  "Over 4.5",  null, probOver45),
    buildMarketRow("ou-45-under", "Gols",  "Under 4.5", null, 1 - probOver45),

    // BTTS
    buildMarketRow("btts-yes", "BTTS (Ambdós marquen)", "Sí", null, probBttsYes),
    buildMarketRow("btts-no",  "BTTS (Ambdós marquen)", "No", null, 1 - probBttsYes),

    // Half-time
    buildMarketRow("ht-home",  "Resultat al descans", `${homeName} al descans`, null, ht.pH),
    buildMarketRow("ht-draw",  "Resultat al descans", "Empat al descans",       null, ht.pD),
    buildMarketRow("ht-away",  "Resultat al descans", `${awayName} al descans`, null, ht.pA),
    buildMarketRow("bh-yes",   "Gol a cada part",     "Sí",                     null, probBothHalvesGoal),
    buildMarketRow("bh-no",    "Gol a cada part",     "No",                     null, 1 - probBothHalvesGoal),

    // Clean sheet / win to nil
    buildMarketRow("cs-home",  "Porteria a zero", `${homeName} sense encaixar`, null, probCSHome),
    buildMarketRow("cs-away",  "Porteria a zero", `${awayName} sense encaixar`, null, probCSAway),
    buildMarketRow("wtn-home", "Guanyar sense encaixar", `${homeName}`,         null, probWtnHome),
    buildMarketRow("wtn-away", "Guanyar sense encaixar", `${awayName}`,         null, probWtnAway),

    // Exact scores (top 5 Poisson)
    ...topScores.map((s, i) =>
      buildMarketRow(`exact-${i}-${s.homeGoals}-${s.awayGoals}`, "Resultat exacte", `${s.homeGoals}-${s.awayGoals}`, null, s.probability),
    ),

    // Còrners
    buildMarketRow("corn-85-over",  "Còrners", "Over 8.5",  null, probCornersOver85),
    buildMarketRow("corn-85-under", "Còrners", "Under 8.5", null, 1 - probCornersOver85),
    buildMarketRow("corn-95-over",  "Còrners", "Over 9.5",  null, probCornersOver95),
    buildMarketRow("corn-95-under", "Còrners", "Under 9.5", null, 1 - probCornersOver95),
    buildMarketRow("corn-105-over", "Còrners", "Over 10.5", null, probCornersOver105),
    buildMarketRow("corn-105-under","Còrners", "Under 10.5",null, 1 - probCornersOver105),

    // Targetes
    buildMarketRow("card-35-over",  "Targetes", "Over 3.5",  null, probCardsOver35),
    buildMarketRow("card-35-under", "Targetes", "Under 3.5", null, 1 - probCardsOver35),
    buildMarketRow("card-45-over",  "Targetes", "Over 4.5",  null, probCardsOver45),
    buildMarketRow("card-45-under", "Targetes", "Under 4.5", null, 1 - probCardsOver45),
    buildMarketRow("card-55-over",  "Targetes", "Over 5.5",  null, probCardsOver55),
    buildMarketRow("card-55-under", "Targetes", "Under 5.5", null, 1 - probCardsOver55),

    // Fores de joc
    buildMarketRow("ofs-35-over",  "Fores de joc", "Over 3.5",  null, probOffsidesOver35),
    buildMarketRow("ofs-35-under", "Fores de joc", "Under 3.5", null, 1 - probOffsidesOver35),
    buildMarketRow("ofs-45-over",  "Fores de joc", "Over 4.5",  null, probOffsidesOver45),
    buildMarketRow("ofs-45-under", "Fores de joc", "Under 4.5", null, 1 - probOffsidesOver45),

    // Faltes
    buildMarketRow("foul-225-over",  "Faltes", "Over 22.5",  null, probFoulsOver225),
    buildMarketRow("foul-225-under", "Faltes", "Under 22.5", null, 1 - probFoulsOver225),
    buildMarketRow("foul-255-over",  "Faltes", "Over 25.5",  null, probFoulsOver255),
    buildMarketRow("foul-255-under", "Faltes", "Under 25.5", null, 1 - probFoulsOver255),

    // Esdeveniments puntuals
    buildMarketRow("red-yes", "Targeta vermella", "Sí", null, probRed),
    buildMarketRow("red-no",  "Targeta vermella", "No", null, 1 - probRed),
    buildMarketRow("pen-yes", "Penal al partit",  "Sí", null, probPen),
    buildMarketRow("pen-no",  "Penal al partit",  "No", null, 1 - probPen),
  ];

  // ---- Player markets (model only, derived from ESPN season leaders + xG share)
  let playerMarkets: BoardPlayerMarket[] = [];
  try {
    const homeProps = await buildPlayerPropsForSide(m, "home", lambdaH, summary);
    const awayProps = await buildPlayerPropsForSide(m, "away", lambdaA, summary);

    const toMarket = (
      side: "home" | "away",
      teamShort: string,
      pp: typeof homeProps[number],
    ): BoardPlayerMarket => {
      const id = pp.playerId;
      return {
        playerId: id,
        playerName: pp.playerName,
        team: side,
        teamShort,
        position: pp.position,
        positionLabel: pp.positionLabel,
        headshot: pp.headshotUrl,
        seasonGoals: pp.seasonGoals,
        seasonAssists: pp.seasonAssists,
        markets: [
          buildMarketRow(`p-${id}-scorer`,    "Golejadors", `${pp.playerName} marca`,             null, pp.anytimeScorerProb),
          buildMarketRow(`p-${id}-2plus`,     "Golejadors", `${pp.playerName} marca 2 o més`,    null, pp.twoPlusGoalsProb),
          buildMarketRow(`p-${id}-assist`,    "Assistents", `${pp.playerName} dóna assistència`, null, pp.anytimeAssistProb),
          buildMarketRow(`p-${id}-ga`,        "Gol o assistència", `${pp.playerName} G+A`,       null, pp.goalContributionProb),
        ],
      };
    };

    // Keep only players with at least a 6% goal-contribution probability —
    // anything lower is noise (defenders/keepers with 0 season output).
    const usefulHome = homeProps.filter((p) => p.goalContributionProb >= 0.06).slice(0, 4);
    const usefulAway = awayProps.filter((p) => p.goalContributionProb >= 0.06).slice(0, 4);

    playerMarkets = [
      ...usefulHome.map((p) => toMarket("home", homeName, p)),
      ...usefulAway.map((p) => toMarket("away", awayName, p)),
    ];
  } catch {
    playerMarkets = [];
  }

  const hasAnyLive = markets.some((mk) => mk.source === "live");
  const matchSource: MarketSource = hasAnyLive ? "live" : "model";

  // Top pick = highest model probability across realistic markets (prob >= 0.45,
  // odds >= 1.20 to filter trivial Over 0.5 / 1X picks where the price is too thin).
  const candidates = markets.filter((mk) => mk.odds && mk.odds >= 1.20 && mk.modelProb >= 0.45);
  candidates.sort((a, b) => b.modelProb - a.modelProb);
  const top = candidates[0]
    ? { selection: candidates[0].selection, modelProb: candidates[0].modelProb, odds: candidates[0].odds }
    : null;

  // ---- Best picks per match (safe / value / bold)
  // Build the universe: match-level markets + best player market per player.
  const playerBest: BoardMarket[] = [];
  for (const pl of playerMarkets) {
    const bestForPlayer = [...pl.markets]
      .filter((mk) => mk.odds && mk.odds >= 1.20)
      .sort((a, b) => (b.modelProb * (b.odds ?? 1)) - (a.modelProb * (a.odds ?? 1)))[0];
    if (bestForPlayer) playerBest.push(bestForPlayer);
  }
  const universe = [...markets, ...playerBest].filter((mk) => mk.odds && mk.odds >= 1.18);

  const bestPicks = pickBestForMatch(universe);

  return {
    matchId: m.id,
    status: m.status === "live" ? "live" : "upcoming",
    kickoff: m.kickoff,
    minute: m.minute,
    homeShort: homeName,
    awayShort: awayName,
    homeName: m.homeTeam.name,
    awayName: m.awayTeam.name,
    homeCrest: m.homeTeam.crestUrl,
    awayCrest: m.awayTeam.crestUrl,
    homeScore: m.homeScore,
    awayScore: m.awayScore,
    source: matchSource,
    bookmaker: live?.bookmaker ?? null,
    oddsLastUpdate: live?.fetchedAt ?? prediction.oddsLastUpdate,
    topPick: top,
    bestPicks,
    markets,
    playerMarkets,
    league: {
      code: m.league.code,
      name: m.league.name,
      shortName: m.league.shortName,
      country: m.league.country,
      flag: m.league.flag,
      color: m.league.color,
      tier: m.league.tier,
    },
  };
}

// Cap matches per board pull. Each match triggers two ESPN summary calls; with
// 12 leagues we'd otherwise be looking at hundreds of network round-trips.
const MAX_BOARD_MATCHES = 36;
const MAX_PER_LEAGUE = 6;

export async function getBoard(): Promise<BoardMatch[]> {
  const all = await getMatchesByStatus("all");
  const now = Date.now();

  // Live first, then upcoming within the next 10 days; never finished.
  const candidates = all.filter((m) => {
    if (m.status === "live") return true;
    if (m.status !== "upcoming") return false;
    const t = new Date(m.kickoff).getTime();
    return t > now - 3600_000 && t < now + 10 * 24 * 3600_000;
  });

  // Bound how many matches per league we keep, prioritising tier-1 then
  // chronological order. This guarantees league diversity even when one
  // competition has dozens of fixtures in window (e.g. cup weekend).
  candidates.sort((a, b) => {
    if (a.status !== b.status) return a.status === "live" ? -1 : 1;
    if (a.league.tier !== b.league.tier) return a.league.tier - b.league.tier;
    return a.kickoff.localeCompare(b.kickoff);
  });
  const perLeagueCount = new Map<string, number>();
  const window: typeof candidates = [];
  for (const m of candidates) {
    const used = perLeagueCount.get(m.leagueCode) ?? 0;
    if (used >= MAX_PER_LEAGUE) continue;
    perLeagueCount.set(m.leagueCode, used + 1);
    window.push(m);
    if (window.length >= MAX_BOARD_MATCHES) break;
  }

  const results = await Promise.all(
    window.map((m) => buildBoardMatch(m).catch(() => null)),
  );
  const out = results.filter((r): r is BoardMatch => r !== null);
  out.sort((a, b) => {
    if (a.status !== b.status) return a.status === "live" ? -1 : 1;
    return a.kickoff.localeCompare(b.kickoff);
  });
  return out;
}

// ============================================================================
// Bet suggestion engine
// ============================================================================

export interface SimpleBet {
  id: string;
  matchId: number;
  matchLabel: string;
  kickoff: string;
  status: "live" | "upcoming";
  market: string;
  selection: string;
  odds: number;
  modelProb: number;
  impliedProb: number;
  edge: number;
  source: MarketSource;
  riskTier: "molt baix" | "baix" | "moderat" | "alt";
  rationale: string;
  /** Quarter-Kelly fraction (0..0.05). Multiply by bankroll for stake €. */
  kellyFraction: number;
  /** Composite confidence 0..1. */
  confidence: number;
  /** prob × odds (>1.0 = +EV vs the price). The user-facing "value" metric. */
  valueScore: number;
  /**
   * Quality tier that combines safety AND odds:
   *   "joia"  — prob ≥ 65% AND odds ≥ 1.80 (very rare unicorn picks)
   *   "valor" — prob ≥ 55% AND odds ≥ 1.55 (sweet spot: safe + good odds)
   *   "segur" — prob ≥ 65% (high probability, lower odds)
   *   "edge"  — positive edge ≥ +5% (model says undervalued)
   *   "estandard" — everything else that passes the floor
   */
  qualityTier: "joia" | "valor" | "segur" | "edge" | "estandard";
}

export interface ComboBet {
  id: string;
  legs: {
    matchId: number;
    matchLabel: string;
    market: string;
    selection: string;
    odds: number;
    modelProb: number;
    source: MarketSource;
  }[];
  combinedOdds: number;
  combinedProb: number;
  riskTier: "baix" | "moderat" | "alt" | "molt alt";
  rationale: string;
  /** Combined edge (combinedProb × combinedOdds − 1). */
  combinedEdge: number;
}

function tierForProb(p: number): SimpleBet["riskTier"] {
  if (p >= 0.78) return "molt baix";
  if (p >= 0.62) return "baix";
  if (p >= 0.48) return "moderat";
  return "alt";
}

/**
 * Quality tier — combines probability and odds to express what kind of pick
 * this is. The user explicitly asked for "very probable picks with the highest
 * possible odds", so "joia" (>=65% prob AND >=1.80 odds) is the headline tier.
 */
function qualityTierFor(prob: number, odds: number, edge: number): SimpleBet["qualityTier"] {
  if (prob >= 0.65 && odds >= 1.80) return "joia";
  if (prob >= 0.55 && odds >= 1.55) return "valor";
  if (prob >= 0.65) return "segur";
  if (edge >= 0.05) return "edge";
  return "estandard";
}

function tierForCombo(p: number): ComboBet["riskTier"] {
  if (p >= 0.55) return "baix";
  if (p >= 0.32) return "moderat";
  if (p >= 0.16) return "alt";
  return "molt alt";
}

function rationaleFor(modelProb: number, edge: number, source: MarketSource): string {
  const src = source === "live" ? "DraftKings" : "el model";
  if (modelProb >= 0.78) return "Probabilitat molt alta segons el model: poques sorpreses esperades.";
  if (modelProb >= 0.62) return "Model favorable amb base estadística sòlida.";
  if (edge > 0.10)       return `Edge de +${(edge * 100).toFixed(1)}%: ${src} sembla infravalorar aquesta opció.`;
  if (modelProb >= 0.48) return "Probabilitat moderada amb risc raonable i bona quota.";
  return "Aposta més arriscada però amb valor esperat positiu.";
}

// Avoid trivial low-odds picks. We tightened the floors to satisfy the user's
// explicit request for "very probable picks with the highest possible odds":
//   - odds ≥ 1.30 (no more 1.05 Over 0.5 noise)
//   - prob ≥ 45% (anything lower isn't actually "molt probable")
const MIN_ODDS_FOR_SUGGESTION = 1.30;
const MIN_PROB_FOR_SUGGESTION = 0.45;

/**
 * Composite score used to rank simples. The user wants picks that are
 * **simultaneously safe and high-odds**, so the dominant term is prob × odds
 * (expected value per unit stake). We add small bonuses for real DK lines
 * (more trustworthy than model) and a moderate edge bonus.
 */
function valueScoreFor(prob: number, odds: number, edge: number, source: MarketSource): number {
  const ve = prob * odds;                                      // base EV (>1 = +EV)
  const liveBonus = source === "live" ? 0.04 : 0;              // trust real DK lines
  const edgeBonus = Math.max(0, Math.min(0.20, edge * 1.5));   // cap edge influence
  // Sweet-spot bonus: encourage picks in the 1.55-2.50 odds band — that's
  // where "safe + high odds" actually lives.
  const oddsBand = odds >= 1.55 && odds <= 2.50 ? 0.03 : 0;
  return +(ve + liveBonus + edgeBonus + oddsBand).toFixed(4);
}

export async function buildSuggestions(): Promise<{ simples: SimpleBet[]; combos: ComboBet[]; safeCombos: ComboBet[] }> {
  const board = await getBoard();
  const simples: SimpleBet[] = [];

  for (const m of board) {
    const label = `${m.homeShort} vs ${m.awayShort}`;

    // Match-level markets
    for (const mk of m.markets) {
      if (!mk.odds || mk.odds < MIN_ODDS_FOR_SUGGESTION) continue;
      if (mk.modelProb < MIN_PROB_FOR_SUGGESTION) continue;
      const edge = mk.edge ?? 0;
      if (edge < -0.10) continue;
      simples.push({
        id: `${m.matchId}-${mk.key}`,
        matchId: m.matchId,
        matchLabel: label,
        kickoff: m.kickoff,
        status: m.status,
        market: mk.group,
        selection: mk.selection,
        odds: mk.odds,
        modelProb: mk.modelProb,
        impliedProb: mk.impliedProb ?? 0,
        edge,
        source: mk.source,
        riskTier: tierForProb(mk.modelProb),
        rationale: rationaleFor(mk.modelProb, edge, mk.source),
        kellyFraction: kellyFraction(mk.modelProb, mk.odds),
        confidence: confidenceScore(mk),
        valueScore: valueScoreFor(mk.modelProb, mk.odds, edge, mk.source),
        qualityTier: qualityTierFor(mk.modelProb, mk.odds, edge),
      });
    }

    // Player markets (only the strongest pick per player to avoid noise).
    // For player props we keep prob ≥ 0.32 (forwards rarely score >50% solo)
    // but raise the odds floor to 1.55 since these are inherently higher odds.
    for (const pl of m.playerMarkets) {
      const best = [...pl.markets]
        .filter((mk) => mk.odds && mk.odds >= 1.55 && mk.modelProb >= 0.32)
        .sort((a, b) => b.modelProb * (b.odds ?? 1) - a.modelProb * (a.odds ?? 1))[0];
      if (!best) continue;
      simples.push({
        id: `${m.matchId}-${best.key}`,
        matchId: m.matchId,
        matchLabel: label,
        kickoff: m.kickoff,
        status: m.status,
        market: best.group,
        selection: best.selection,
        odds: best.odds!,
        modelProb: best.modelProb,
        impliedProb: best.impliedProb ?? 0,
        edge: best.edge ?? 0,
        source: best.source,
        riskTier: tierForProb(best.modelProb),
        rationale: `${pl.teamShort} · ${pl.positionLabel} · ${pl.seasonGoals}G ${pl.seasonAssists}A aquesta temporada.`,
        kellyFraction: kellyFraction(best.modelProb, best.odds!),
        confidence: confidenceScore(best),
        valueScore: valueScoreFor(best.modelProb, best.odds!, best.edge ?? 0, best.source),
        qualityTier: qualityTierFor(best.modelProb, best.odds!, best.edge ?? 0),
      });
    }
  }

  // Default sort: VALUE first (the user's explicit ask = high prob × high odds).
  // Ties resolved by quality tier and then by raw probability.
  const qualityOrder = { joia: 0, valor: 1, segur: 2, edge: 3, estandard: 4 } as const;
  simples.sort((a, b) => {
    if (Math.abs(b.valueScore - a.valueScore) > 0.005) return b.valueScore - a.valueScore;
    if (qualityOrder[a.qualityTier] !== qualityOrder[b.qualityTier])
      return qualityOrder[a.qualityTier] - qualityOrder[b.qualityTier];
    if (a.source !== b.source) return a.source === "live" ? -1 : 1;
    return b.modelProb - a.modelProb;
  });

  // De-duplicate near-identical picks per match (e.g. don't surface both
  // "Doble oportunitat 1X" and "Doble oportunitat X2" — keep only the best one
  // per match in the headline list, but allow up to 2 different markets).
  const perMatchCount = new Map<number, number>();
  const dedup: SimpleBet[] = [];
  for (const s of simples) {
    const c = perMatchCount.get(s.matchId) ?? 0;
    if (c >= 2) continue;
    perMatchCount.set(s.matchId, c + 1);
    dedup.push(s);
  }
  // Replace
  simples.length = 0;
  simples.push(...dedup);

  // ---- Combos -------------------------------------------------------------
  // We want safe combinations with the maximum possible total odds. The
  // construction strategy:
  //   1) Per match, keep the single highest-probability pick (so combos use
  //      independent matches).
  //   2) Build three layers, each picking legs that maximise their joint EV
  //      (prob × odds) within a safety floor:
  //        - SEGURA   (2 legs):  combined prob ≥ 50%, max combined odds
  //        - VALOR    (3 legs):  combined prob ≥ 25%, max combined odds
  //        - ATREVIDA (4 legs):  combined prob ≥ 10%, max combined odds
  //   3) Always include a "max odds safe" combo (highest combined odds among
  //      legs with individual prob ≥ 55%) to satisfy the user's explicit
  //      "safe + max odds" goal.
  const bestPerMatch = new Map<number, SimpleBet>();
  for (const s of simples) {
    const cur = bestPerMatch.get(s.matchId);
    // Use value (prob * odds) instead of raw prob so we don't always pick the
    // trivially safe Over 0.5 leg from each match.
    const score = (x: SimpleBet) => x.modelProb * x.odds;
    if (!cur || score(s) > score(cur)) bestPerMatch.set(s.matchId, s);
  }
  // Universe for combos: per-match best picks with prob ≥ 55% AND odds ≥ 1.50
  // — combos must compound real value, not 1.10 trivial picks. The user
  // explicitly asked for "very probable picks with the highest possible odds".
  const universe = [...bestPerMatch.values()]
    .filter((s) => s.modelProb >= 0.55 && s.odds >= 1.50);

  const combos: ComboBet[] = [];

  function makeCombo(legs: SimpleBet[], rationale: string): ComboBet {
    const combinedOdds = +legs.reduce((acc, l) => acc * l.odds, 1).toFixed(2);
    const combinedProb = +legs.reduce((acc, l) => acc * l.modelProb, 1).toFixed(4);
    const combinedEdge = +(combinedProb * combinedOdds - 1).toFixed(4);
    return {
      id: `combo-${legs.length}-${legs.map((l) => l.id).join("-")}`,
      legs: legs.map((l) => ({
        matchId: l.matchId,
        matchLabel: l.matchLabel,
        market: l.market,
        selection: l.selection,
        odds: l.odds,
        modelProb: l.modelProb,
        source: l.source,
      })),
      combinedOdds,
      combinedProb,
      combinedEdge,
      riskTier: tierForCombo(combinedProb),
      rationale,
    };
  }

  // For each target leg-count, search for the combination of N legs that
  // maximises combined odds while satisfying the prob floor. We use a greedy
  // pre-filter (top 12 by value score) to keep the search bounded, then a
  // brute-force over subsets of that pool.
  function bestCombo(legCount: number, probFloor: number): SimpleBet[] | null {
    if (universe.length < legCount) return null;
    const pool = [...universe]
      .sort((a, b) => (b.modelProb * b.odds) - (a.modelProb * a.odds))
      .slice(0, 12);
    const indices: number[][] = [];
    const cur: number[] = [];
    function recurse(start: number) {
      if (cur.length === legCount) { indices.push([...cur]); return; }
      for (let i = start; i <= pool.length - (legCount - cur.length); i++) {
        cur.push(i);
        recurse(i + 1);
        cur.pop();
      }
    }
    recurse(0);
    let best: { legs: SimpleBet[]; odds: number; prob: number } | null = null;
    for (const idx of indices) {
      const legs = idx.map((i) => pool[i]!);
      const prob = legs.reduce((a, l) => a * l.modelProb, 1);
      if (prob < probFloor) continue;
      const odds = legs.reduce((a, l) => a * l.odds, 1);
      if (!best || odds > best.odds) best = { legs, odds, prob };
    }
    return best ? best.legs : null;
  }

  const c2safe = bestCombo(2, 0.50);
  if (c2safe) combos.push(makeCombo(c2safe,
    "Doble segura amb la millor quota possible: dues seleccions amb >50% de probabilitat conjunta."));

  const c3val = bestCombo(3, 0.25);
  if (c3val) combos.push(makeCombo(c3val,
    "Triple de valor: tres cames amb la quota total més alta mantenint >25% de probabilitat conjunta."));

  const c4bold = bestCombo(4, 0.10);
  if (c4bold) combos.push(makeCombo(c4bold,
    "Quàdruple atrevida: màxim retorn possible amb la quota més alta i probabilitat conjunta encara raonable."));

  // "Max safe" combo: combination of 3 legs each with individual prob ≥ 0.62
  const safeUniverse = universe.filter((s) => s.modelProb >= 0.62);
  if (safeUniverse.length >= 3) {
    const pool = [...safeUniverse]
      .sort((a, b) => (b.modelProb * b.odds) - (a.modelProb * a.odds))
      .slice(0, 8);
    const indices: number[][] = [];
    const cur: number[] = [];
    function recurse(start: number) {
      if (cur.length === 3) { indices.push([...cur]); return; }
      for (let i = start; i <= pool.length - (3 - cur.length); i++) {
        cur.push(i); recurse(i + 1); cur.pop();
      }
    }
    recurse(0);
    let bestSafe: { legs: SimpleBet[]; odds: number } | null = null;
    for (const idx of indices) {
      const legs = idx.map((i) => pool[i]!);
      const odds = legs.reduce((a, l) => a * l.odds, 1);
      if (!bestSafe || odds > bestSafe.odds) bestSafe = { legs, odds };
    }
    if (bestSafe) {
      const sig = bestSafe.legs.map((l) => l.id).sort().join("|");
      const dup = combos.find((c) => c.legs.length === 3 && c.legs.map((l) => `${l.matchLabel}-${l.selection}`).sort().join("|").length > 0
        && c.id.includes(bestSafe!.legs.map((l) => l.id).join("-").slice(0, 20)));
      if (!dup) {
        combos.push(makeCombo(bestSafe.legs,
          `Triple "tot segur": tres cames amb >62% de probabilitat individual i la quota total més alta possible (${bestSafe.odds.toFixed(2)}).`));
      }
      void sig;
    }
  }

  // Sort: highest joint probability first (safer combos before riskier ones).
  combos.sort((a, b) => b.combinedProb - a.combinedProb);

  // ────────────────────────────────────────────────────────────────────────
  // SAFE COMBOS ("Duo Segura") — combos engineered for the user's explicit
  // goal: maximise winnings with **minimal risk of loss**. Each leg must be
  // individually very probable (≥65%) AND have non-trivial odds (≥1.40), and
  // the joint probability of the whole combo must still beat 50%. Result:
  // a "safer than a single 1.50 bet" combo with multiplier 1.80x-2.50x.
  // ────────────────────────────────────────────────────────────────────────
  const safeCombos: ComboBet[] = [];
  const safePoolBase = [...bestPerMatch.values()]
    .filter((s) => s.modelProb >= 0.65 && s.odds >= 1.40)
    .sort((a, b) => (b.modelProb * b.odds) - (a.modelProb * a.odds))
    .slice(0, 14);

  // 2-leg "Duo Segura": each leg ≥65% prob, joint prob ≥45%, max odds.
  // Each subsequent combo uses fresh matches (no repeated matchId across the
  // 3 combos) so the user gets genuinely diversified options, not 3 copies
  // of the same anchor leg paired with interchangeable seconds.
  if (safePoolBase.length >= 2) {
    const usedMatchIds = new Set<number>();
    for (let attempt = 0; attempt < 3 && safeCombos.length < 3; attempt++) {
      let best: { legs: SimpleBet[]; odds: number; prob: number } | null = null;
      for (let i = 0; i < safePoolBase.length; i++) {
        for (let j = i + 1; j < safePoolBase.length; j++) {
          const a = safePoolBase[i]!, b = safePoolBase[j]!;
          if (a.matchId === b.matchId) continue;
          if (usedMatchIds.has(a.matchId) || usedMatchIds.has(b.matchId)) continue;
          const prob = a.modelProb * b.modelProb;
          if (prob < 0.45) continue;
          const odds = a.odds * b.odds;
          if (odds < 1.80) continue;
          if (!best || odds > best.odds) best = { legs: [a, b], odds, prob };
        }
      }
      if (!best) break;
      for (const l of best.legs) usedMatchIds.add(l.matchId);
      const winPct = (best.prob * 100).toFixed(0);
      const oddsPct = best.odds.toFixed(2);
      safeCombos.push(makeCombo(best.legs,
        `Duo Segura: dues seleccions amb >65% individual, ${winPct}% conjunta, multiplicador ×${oddsPct}.`));
    }
  }

  // 3-leg "Triple Segura": every leg ≥70% prob, joint ≥40%.
  const triplePool = [...bestPerMatch.values()]
    .filter((s) => s.modelProb >= 0.70 && s.odds >= 1.30)
    .sort((a, b) => (b.modelProb * b.odds) - (a.modelProb * a.odds))
    .slice(0, 10);
  if (triplePool.length >= 3) {
    const indices: number[][] = [];
    const cur: number[] = [];
    function recurse3(start: number) {
      if (cur.length === 3) { indices.push([...cur]); return; }
      for (let i = start; i <= triplePool.length - (3 - cur.length); i++) {
        cur.push(i); recurse3(i + 1); cur.pop();
      }
    }
    recurse3(0);
    let best: { legs: SimpleBet[]; odds: number; prob: number } | null = null;
    for (const idx of indices) {
      const legs = idx.map((i) => triplePool[i]!);
      const matchIds = new Set(legs.map((l) => l.matchId));
      if (matchIds.size < 3) continue;
      const prob = legs.reduce((a, l) => a * l.modelProb, 1);
      if (prob < 0.40) continue;
      const odds = legs.reduce((a, l) => a * l.odds, 1);
      if (odds < 2.20) continue;
      if (!best || odds > best.odds) best = { legs, odds, prob };
    }
    if (best) {
      safeCombos.push(makeCombo(best.legs,
        `Triple Segura: tres seleccions amb >70% individual, ${(best.prob * 100).toFixed(0)}% conjunta, multiplicador ×${best.odds.toFixed(2)}.`));
    }
  }

  return {
    simples: simples.slice(0, 60),
    combos,
    safeCombos,
  };
}

export interface BoardMeta {
  bookmakerLabel: string;
  liveMatchCount: number;
  liveMarketCount: number;
  totalMatchCount: number;
}

export function describeBoard(board: BoardMatch[]): BoardMeta {
  let liveMatchCount = 0;
  let liveMarketCount = 0;
  for (const m of board) {
    if (m.source === "live") liveMatchCount++;
    for (const mk of m.markets) if (mk.source === "live") liveMarketCount++;
  }
  let bookmakerLabel: string;
  if (liveMarketCount === 0) {
    bookmakerLabel = "Mode model · sense quotes en directe";
  } else if (liveMatchCount === board.length) {
    bookmakerLabel = "Quotes reals · DraftKings (via ESPN)";
  } else {
    bookmakerLabel = `Quotes reals (${liveMatchCount}/${board.length}) · DraftKings + model`;
  }
  return {
    bookmakerLabel,
    liveMatchCount,
    liveMarketCount,
    totalMatchCount: board.length,
  };
}
