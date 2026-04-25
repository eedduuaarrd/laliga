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
  markets: BoardMarket[];
  playerMarkets: BoardPlayerMarket[];
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

// ---------------------------------------------------------------------------
// Build a single match card with all the markets we can derive.
// ---------------------------------------------------------------------------
export async function buildBoardMatch(m: LiveMatch): Promise<BoardMatch> {
  const { prediction, poisson, summary } = await predictMatch(m);
  const live: LiveOddsSnapshot | null = await getLiveOddsForMatch(m.id).catch(() => null);

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
    markets,
    playerMarkets,
  };
}

export async function getBoard(): Promise<BoardMatch[]> {
  const all = await getMatchesByStatus("all");
  const now = Date.now();
  const window = all
    .filter((m) => {
      if (m.status === "live") return true;
      if (m.status !== "upcoming") return false;
      const t = new Date(m.kickoff).getTime();
      return t > now - 3600_000 && t < now + 10 * 24 * 3600_000;
    })
    .slice(0, 14);

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
}

export interface ComboBet {
  id: string;
  legs: {
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
}

function tierForProb(p: number): SimpleBet["riskTier"] {
  if (p >= 0.78) return "molt baix";
  if (p >= 0.62) return "baix";
  if (p >= 0.48) return "moderat";
  return "alt";
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

// Avoid trivial low-odds picks like Over 0.5 (odds ~1.05) where the unit win
// is negligible. Anything below 1.18 is filtered out of suggestions.
const MIN_ODDS_FOR_SUGGESTION = 1.18;

export async function buildSuggestions(): Promise<{ simples: SimpleBet[]; combos: ComboBet[] }> {
  const board = await getBoard();
  const simples: SimpleBet[] = [];

  for (const m of board) {
    const label = `${m.homeShort} vs ${m.awayShort}`;

    // Match-level markets
    for (const mk of m.markets) {
      if (!mk.odds || mk.odds < MIN_ODDS_FOR_SUGGESTION) continue;
      if (mk.modelProb < 0.40) continue;
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
      });
    }

    // Player markets (only the strongest pick per player to avoid noise)
    for (const pl of m.playerMarkets) {
      const best = [...pl.markets]
        .filter((mk) => mk.odds && mk.odds >= MIN_ODDS_FOR_SUGGESTION && mk.modelProb >= 0.30)
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
      });
    }
  }

  // Sort: lowest risk first; within tier, prefer real DraftKings then higher edge then higher prob.
  const tierOrder = { "molt baix": 0, baix: 1, moderat: 2, alt: 3 } as const;
  simples.sort((a, b) => {
    if (tierOrder[a.riskTier] !== tierOrder[b.riskTier])
      return tierOrder[a.riskTier] - tierOrder[b.riskTier];
    if (a.source !== b.source) return a.source === "live" ? -1 : 1;
    if (Math.abs(b.edge - a.edge) > 0.02) return b.edge - a.edge;
    return b.modelProb - a.modelProb;
  });

  // Combos: best pick per match (independence), pick top 8 candidates by prob.
  const bestPerMatch = new Map<number, SimpleBet>();
  for (const s of simples) {
    const cur = bestPerMatch.get(s.matchId);
    if (!cur || s.modelProb > cur.modelProb) bestPerMatch.set(s.matchId, s);
  }
  const candidates = [...bestPerMatch.values()]
    .filter((s) => s.modelProb >= 0.55)
    .sort((a, b) => b.modelProb - a.modelProb)
    .slice(0, 8);

  const combos: ComboBet[] = [];

  function makeCombo(legs: SimpleBet[], rationale: string): ComboBet {
    const combinedOdds = +legs.reduce((acc, l) => acc * l.odds, 1).toFixed(2);
    const combinedProb = +legs.reduce((acc, l) => acc * l.modelProb, 1).toFixed(4);
    return {
      id: `combo-${legs.length}-${legs.map((l) => l.id).join("-")}`,
      legs: legs.map((l) => ({
        matchLabel: l.matchLabel,
        market: l.market,
        selection: l.selection,
        odds: l.odds,
        modelProb: l.modelProb,
        source: l.source,
      })),
      combinedOdds,
      combinedProb,
      riskTier: tierForCombo(combinedProb),
      rationale,
    };
  }

  if (candidates.length >= 2) {
    const pairs: [SimpleBet, SimpleBet][] = [];
    for (let i = 0; i < candidates.length; i++) {
      for (let j = i + 1; j < candidates.length; j++) {
        pairs.push([candidates[i]!, candidates[j]!]);
      }
    }
    pairs.sort((a, b) => b[0].modelProb * b[1].modelProb - a[0].modelProb * a[1].modelProb);
    for (const [a, b] of pairs.slice(0, 4)) {
      combos.push(makeCombo([a, b],
        `Doble amb les dues seleccions individuals més fortes (${(a.modelProb * 100).toFixed(0)}% × ${(b.modelProb * 100).toFixed(0)}%).`,
      ));
    }
  }
  if (candidates.length >= 3) combos.push(makeCombo(candidates.slice(0, 3), "Triple amb les tres apostes més consistents segons el model."));
  if (candidates.length >= 4) combos.push(makeCombo(candidates.slice(0, 4), "Quàdruple agressiva: més risc però retorn molt més alt."));

  combos.sort((a, b) => b.combinedProb - a.combinedProb);

  return {
    simples: simples.slice(0, 40),
    combos,
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
