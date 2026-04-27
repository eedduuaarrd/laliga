import {
  americanToImpliedProb,
  americanToDecimalOdds,
  normalizeMoneylineProbs,
  type RawOdds,
  type RawSummary,
  getEventSummary,
} from "../lib/espn.js";
import { getMatchById, type LiveMatch } from "./matches.js";
import { getTeamRates, getTeamFormScore, getTeamForm } from "./standings.js";
import { getTeamInjuries, type LiveInjury } from "./injuries.js";
import { getTeamSquad, type LivePlayer } from "./players.js";

// ============================================================================
// Poisson math
// ============================================================================
function poissonPmf(k: number, lambda: number): number {
  if (lambda <= 0) return k === 0 ? 1 : 0;
  let logP = -lambda + k * Math.log(lambda);
  for (let i = 2; i <= k; i++) logP -= Math.log(i);
  return Math.exp(logP);
}

export interface PoissonResult {
  matrix: { homeGoals: number; awayGoals: number; probability: number }[];
  homeWin: number;
  draw: number;
  awayWin: number;
  expectedHome: number;
  expectedAway: number;
  bttsProb: number;
  over25Prob: number;
  under25Prob: number;
  cleanSheetHome: number;
  cleanSheetAway: number;
}

export function poissonPredict(lambdaH: number, lambdaA: number, maxGoals = 7): PoissonResult {
  const matrix: PoissonResult["matrix"] = [];
  let homeWin = 0, draw = 0, awayWin = 0;
  let bttsProb = 0, over25Prob = 0, csHome = 0, csAway = 0;
  for (let h = 0; h <= maxGoals; h++) {
    for (let a = 0; a <= maxGoals; a++) {
      const p = poissonPmf(h, lambdaH) * poissonPmf(a, lambdaA);
      matrix.push({ homeGoals: h, awayGoals: a, probability: +p.toFixed(5) });
      if (h > a) homeWin += p;
      else if (h === a) draw += p;
      else awayWin += p;
      if (h > 0 && a > 0) bttsProb += p;
      if (h + a > 2) over25Prob += p;
      if (a === 0) csHome += p;
      if (h === 0) csAway += p;
    }
  }
  const total = homeWin + draw + awayWin;
  return {
    matrix,
    homeWin: homeWin / total,
    draw: draw / total,
    awayWin: awayWin / total,
    expectedHome: lambdaH,
    expectedAway: lambdaA,
    bttsProb: +bttsProb.toFixed(4),
    over25Prob: +over25Prob.toFixed(4),
    under25Prob: +(1 - over25Prob).toFixed(4),
    cleanSheetHome: +csHome.toFixed(4),
    cleanSheetAway: +csAway.toFixed(4),
  };
}

// ============================================================================
// Lambda derivation: prefer real bookmaker over/under + spread; fall back to
// per-team season rates.
// ============================================================================

export function lambdasFromOdds(odds: RawOdds): { lambdaH: number; lambdaA: number; source: "bookmaker" } | null {
  const total = odds.overUnder;
  const spread = odds.spread; // ESPN: positive = home favoured by N goals (varies by sport)
  if (total == null || total <= 0) return null;
  // Distribute total around half-time-of-spread. We assume `details` like "RMA -0.5" meaning home favourite.
  // Without 100% reliability of `spread` sign, derive home share from moneyline implied probabilities.
  const homeImplied = americanToImpliedProb(odds.homeTeamOdds?.moneyLine);
  const awayImplied = americanToImpliedProb(odds.awayTeamOdds?.moneyLine);
  const denom = homeImplied + awayImplied;
  if (denom <= 0) {
    const half = total / 2;
    return { lambdaH: half, lambdaA: half, source: "bookmaker" };
  }
  // Stronger team gets a higher share of expected goals; calibrate so average implied diff maps to ~0.55/0.45.
  const homeShare = 0.5 + (homeImplied - awayImplied) / denom * 0.18;
  const lambdaH = +(total * homeShare).toFixed(3);
  const lambdaA = +(total * (1 - homeShare)).toFixed(3);
  void spread;
  return { lambdaH, lambdaA, source: "bookmaker" };
}

export async function lambdasFromTeamRates(match: LiveMatch): Promise<{ lambdaH: number; lambdaA: number; source: "team-rates" }> {
  const home = await getTeamRates(match.homeTeamId);
  const away = await getTeamRates(match.awayTeamId);
  const homeForm = await getTeamFormScore(match.homeTeamId);
  const awayForm = await getTeamFormScore(match.awayTeamId);
  const homeAbs = await computeAbsenceImpact(match.homeTeamId);
  const awayAbs = await computeAbsenceImpact(match.awayTeamId);
  // Expected goals = own attack rate scaled by opponent defensive rate (vs league average ~1.3).
  const leagueAvg = 1.3;
  const lambdaH = home.attackRate * (away.defenseRate / leagueAvg) * home.homeAdvantage * homeForm * (1 - homeAbs);
  const lambdaA = away.attackRate * (home.defenseRate / leagueAvg) * awayForm * (1 - awayAbs);
  return {
    lambdaH: +Math.max(0.2, lambdaH).toFixed(3),
    lambdaA: +Math.max(0.2, lambdaA).toFixed(3),
    source: "team-rates",
  };
}

export async function computeAbsenceImpact(teamId: number): Promise<number> {
  const inj = await getTeamInjuries(teamId);
  let impact = 0;
  for (const i of inj) impact += i.impactScore * 0.06;
  return +Math.min(0.35, impact).toFixed(3);
}

// ============================================================================
// Match prediction (top-level)
// ============================================================================

export interface MatchPrediction {
  matchId: number;
  kickoff: string;
  homeTeamId: number;
  awayTeamId: number;
  homeWinProb: number;
  drawProb: number;
  awayWinProb: number;
  expectedHomeGoals: number;
  expectedAwayGoals: number;
  bttsProb: number;
  over25Prob: number;
  under25Prob: number;
  cleanSheetHome: number;
  cleanSheetAway: number;
  confidence: number;
  recommendation: string;
  source: "bookmaker" | "team-rates" | "blended";
  bookmaker: string | null;
  oddsLastUpdate: string;
}

export async function predictMatch(match: LiveMatch): Promise<{ prediction: MatchPrediction; poisson: PoissonResult; oddsRaw: RawOdds | null; summary: RawSummary | null }> {
  let summary: RawSummary | null = null;
  try {
    summary = await getEventSummary(match.id, match.leagueCode);
  } catch {
    summary = null;
  }
  const oddsRaw = summary?.pickcenter?.[0] ?? summary?.odds?.[0] ?? null;

  const fromBook = oddsRaw ? lambdasFromOdds(oddsRaw) : null;
  const fromRates = await lambdasFromTeamRates(match);

  // If we have bookmaker totals, blend 70/30 toward bookmaker (real market signal).
  let lambdaH = fromRates.lambdaH;
  let lambdaA = fromRates.lambdaA;
  let source: MatchPrediction["source"] = "team-rates";
  if (fromBook) {
    lambdaH = +(fromBook.lambdaH * 0.7 + fromRates.lambdaH * 0.3).toFixed(3);
    lambdaA = +(fromBook.lambdaA * 0.7 + fromRates.lambdaA * 0.3).toFixed(3);
    source = "blended";
  }
  const poisson = poissonPredict(lambdaH, lambdaA, 7);

  // Probabilities: prefer market when we have a complete moneyline; else Poisson.
  const norm = oddsRaw ? normalizeMoneylineProbs(oddsRaw) : null;
  let pH = poisson.homeWin, pD = poisson.draw, pA = poisson.awayWin;
  if (norm) {
    pH = +((norm.homeWin * 0.7 + poisson.homeWin * 0.3).toFixed(4));
    pD = +((norm.draw    * 0.7 + poisson.draw    * 0.3).toFixed(4));
    pA = +((norm.awayWin * 0.7 + poisson.awayWin * 0.3).toFixed(4));
    const t = pH + pD + pA;
    pH = +(pH / t).toFixed(4); pD = +(pD / t).toFixed(4); pA = +(pA / t).toFixed(4);
    source = "bookmaker";
  }
  const top = Math.max(pH, pD, pA);
  let recommendation = "Empat";
  if (top === pH) recommendation = `Victòria local — ${match.homeTeam.shortName}`;
  else if (top === pA) recommendation = `Victòria visitant — ${match.awayTeam.shortName}`;

  return {
    prediction: {
      matchId: match.id,
      kickoff: match.kickoff,
      homeTeamId: match.homeTeamId,
      awayTeamId: match.awayTeamId,
      homeWinProb: pH,
      drawProb: pD,
      awayWinProb: pA,
      expectedHomeGoals: +lambdaH.toFixed(2),
      expectedAwayGoals: +lambdaA.toFixed(2),
      bttsProb: poisson.bttsProb,
      over25Prob: poisson.over25Prob,
      under25Prob: poisson.under25Prob,
      cleanSheetHome: poisson.cleanSheetHome,
      cleanSheetAway: poisson.cleanSheetAway,
      confidence: +top.toFixed(4),
      recommendation,
      source,
      bookmaker: oddsRaw?.provider?.name ?? null,
      oddsLastUpdate: new Date().toISOString(),
    },
    poisson,
    oddsRaw,
    summary,
  };
}

// ============================================================================
// Market odds & value detection — uses real bookmaker prices when available;
// otherwise computes fair odds from Poisson with a neutral 5% overround.
// ============================================================================
export interface MarketView {
  homeOdds: number;
  drawOdds: number;
  awayOdds: number;
  valueHome: number;
  valueDraw: number;
  valueAway: number;
  bestPick: string;
  source: "bookmaker" | "model";
  bookmaker: string | null;
  overUnderLine: number | null;
  overOdds: number | null;
  underOdds: number | null;
}

export function buildMarket(p: MatchPrediction, raw: RawOdds | null): MarketView {
  let homeOdds: number, drawOdds: number, awayOdds: number;
  let source: MarketView["source"] = "model";
  let bookmaker: string | null = null;
  let overOdds: number | null = null;
  let underOdds: number | null = null;
  let overUnderLine: number | null = null;
  if (raw && raw.homeTeamOdds?.moneyLine && raw.awayTeamOdds?.moneyLine) {
    homeOdds = americanToDecimalOdds(raw.homeTeamOdds.moneyLine);
    drawOdds = americanToDecimalOdds(raw.drawOdds?.moneyLine ?? null);
    awayOdds = americanToDecimalOdds(raw.awayTeamOdds.moneyLine);
    if (drawOdds === 0) drawOdds = +(1 / Math.max(0.05, p.drawProb) * 1.05).toFixed(2);
    source = "bookmaker";
    bookmaker = raw.provider?.name ?? null;
    overOdds = raw.overOdds ? americanToDecimalOdds(raw.overOdds) : null;
    underOdds = raw.underOdds ? americanToDecimalOdds(raw.underOdds) : null;
    overUnderLine = raw.overUnder ?? null;
  } else {
    const overround = 1.05;
    homeOdds = +(1 / Math.max(0.02, p.homeWinProb) * overround).toFixed(2);
    drawOdds = +(1 / Math.max(0.02, p.drawProb) * overround).toFixed(2);
    awayOdds = +(1 / Math.max(0.02, p.awayWinProb) * overround).toFixed(2);
  }
  const vH = +((p.homeWinProb * homeOdds) - 1).toFixed(4);
  const vD = +((p.drawProb * drawOdds) - 1).toFixed(4);
  const vA = +((p.awayWinProb * awayOdds) - 1).toFixed(4);
  let bestPick = "Sense valor clar";
  const m = Math.max(vH, vD, vA);
  if (m > 0.02) {
    if (m === vH) bestPick = "Local";
    else if (m === vD) bestPick = "Empat";
    else bestPick = "Visitant";
  }
  return {
    homeOdds, drawOdds, awayOdds,
    valueHome: vH, valueDraw: vD, valueAway: vA,
    bestPick, source, bookmaker, overUnderLine, overOdds, underOdds,
  };
}

// ============================================================================
// Per-player predictions (real)
//   - Top scorers: derived from ESPN's `leaders` block (real season goals/assists)
//     plus expected-goal share from team xG (lambda) divided across forwards/mids
//     by their season finishing share.
//   - Assist threats: same idea using assists.
//   - Cards: from yellow-card leaders (when available).
// ============================================================================

export interface PlayerProp {
  playerId: number;
  playerName: string;
  teamId: number;
  teamShortName: string;
  position: LivePlayer["position"];
  positionLabel: string;
  headshotUrl: string | null;
  // Season basics from ESPN leaders
  seasonGoals: number;
  seasonAssists: number;
  seasonAppearances: number;
  goalsPerGame: number;
  assistsPerGame: number;
  // Match expected (Poisson on per-90 rate vs team lambda share)
  expectedGoals: number;
  expectedAssists: number;
  // Derived probabilities for this match
  anytimeScorerProb: number;
  twoPlusGoalsProb: number;
  anytimeAssistProb: number;
  goalContributionProb: number;
}

interface LeaderRow {
  athleteId: number;
  athleteName: string;
  teamId: number;
  position: LivePlayer["position"];
  positionLabel: string;
  headshot: string | null;
  matches: number;
  goals: number;
  assists: number;
}

function parseLeaderDisplay(s: string | undefined): { matches: number; goals: number; assists: number } {
  if (!s) return { matches: 0, goals: 0, assists: 0 };
  const m = /M[atches:\s]*\s*(\d+)/i.exec(s)?.[1];
  const g = /G(?:oals)?[:\s]*\s*(\d+)/i.exec(s)?.[1];
  const a = /A(?:ssists)?[:\s]*\s*(\d+)/i.exec(s)?.[1];
  return { matches: Number(m ?? 0), goals: Number(g ?? 0), assists: Number(a ?? 0) };
}

function rowsFromLeaders(summary: RawSummary | null, side: "home" | "away", teamId: number): LeaderRow[] {
  if (!summary?.leaders?.[side === "home" ? 0 : 1]) return [];
  const block = summary.leaders[side === "home" ? 0 : 1]!;
  const merged = new Map<number, LeaderRow>();
  for (const cat of block.leaders) {
    for (const l of cat.leaders) {
      const a = l.athlete;
      const id = Number(a.id);
      const stats = parseLeaderDisplay(l.shortDisplayValue ?? l.displayValue);
      const existing = merged.get(id);
      const posAbbr = a.position?.abbreviation ?? "M";
      const pos: LivePlayer["position"] =
        posAbbr === "G" ? "GK" :
        posAbbr === "D" ? "DEF" :
        posAbbr === "F" ? "FWD" : "MID";
      if (existing) {
        existing.goals = Math.max(existing.goals, stats.goals);
        existing.assists = Math.max(existing.assists, stats.assists);
        existing.matches = Math.max(existing.matches, stats.matches);
      } else {
        merged.set(id, {
          athleteId: id,
          athleteName: a.fullName ?? a.displayName ?? `Player ${id}`,
          teamId,
          position: pos,
          positionLabel: a.position?.name ?? posAbbr,
          headshot: a.headshot?.href ?? null,
          matches: stats.matches,
          goals: stats.goals,
          assists: stats.assists,
        });
      }
    }
  }
  return [...merged.values()];
}

// Expected-goal share: each leader's goals/(team season goals) is the share of
// the team's expected goals they "own" for this match. We Poisson it for the
// "anytime scorer" probability.
function probAtLeastOne(lambda: number) { return 1 - Math.exp(-lambda); }
function probAtLeastTwo(lambda: number) { return 1 - Math.exp(-lambda) * (1 + lambda); }

export async function buildPlayerPropsForSide(match: LiveMatch, side: "home" | "away", lambdaTeam: number, summary: RawSummary | null): Promise<PlayerProp[]> {
  const teamId = side === "home" ? match.homeTeamId : match.awayTeamId;
  const teamShort = side === "home" ? match.homeTeam.shortName : match.awayTeam.shortName;
  const leaders = rowsFromLeaders(summary, side, teamId);
  if (leaders.length === 0) return [];
  // Total team goals/assists = sum of top leaders (proxy for season totals; conservative).
  const totalGoals = Math.max(1, leaders.reduce((s, r) => s + r.goals, 0));
  const totalAssists = Math.max(1, leaders.reduce((s, r) => s + r.assists, 0));
  return leaders.map((r) => {
    const goalShare = r.goals / totalGoals;
    const assistShare = r.assists / totalAssists;
    const expectedGoals = +(lambdaTeam * goalShare).toFixed(3);
    const expectedAssists = +(lambdaTeam * assistShare * 0.7).toFixed(3); // ~70% of goals get a primary assist
    return {
      playerId: r.athleteId,
      playerName: r.athleteName,
      teamId,
      teamShortName: teamShort,
      position: r.position,
      positionLabel: r.positionLabel,
      headshotUrl: r.headshot,
      seasonGoals: r.goals,
      seasonAssists: r.assists,
      seasonAppearances: r.matches,
      goalsPerGame: r.matches > 0 ? +(r.goals / r.matches).toFixed(3) : 0,
      assistsPerGame: r.matches > 0 ? +(r.assists / r.matches).toFixed(3) : 0,
      expectedGoals,
      expectedAssists,
      anytimeScorerProb: +probAtLeastOne(expectedGoals).toFixed(4),
      twoPlusGoalsProb: +probAtLeastTwo(expectedGoals).toFixed(4),
      anytimeAssistProb: +probAtLeastOne(expectedAssists).toFixed(4),
      goalContributionProb: +probAtLeastOne(expectedGoals + expectedAssists).toFixed(4),
    };
  })
  .sort((a, b) => b.goalContributionProb - a.goalContributionProb);
}

// ============================================================================
// Probable lineups (named so the caller can ask for the predicted XI)
// ============================================================================
export interface ProbableLineupPlayer {
  id: number;
  name: string;
  position: LivePlayer["position"];
  positionLabel: string;
  shirtNumber: number | null;
  headshotUrl: string | null;
  isStarter: boolean;
  injured: boolean;
}
export interface ProbableLineup {
  formation: string;
  starting: ProbableLineupPlayer[];
  bench: ProbableLineupPlayer[];
  source: "official" | "predicted";
  confidence: number;
}

export async function buildProbableLineup(match: LiveMatch, side: "home" | "away"): Promise<ProbableLineup> {
  const teamId = side === "home" ? match.homeTeamId : match.awayTeamId;
  const team = side === "home" ? match.homeTeam : match.awayTeam;
  const formation = team.formation;
  const squad = await getTeamSquad(teamId, match.leagueCode);
  const fit = squad.filter((p) => !p.injured);
  // Starting XI heuristic: top 1 GK + first N defenders + first N mids + first N forwards from roster order.
  const parts = formation.split("-").map(Number);
  let def = 4, mid = 3, fwd = 3;
  if (parts.length === 3) [def = 4, mid = 3, fwd = 3] = parts as [number, number, number];
  else if (parts.length === 4) {
    const [d, m1, m2, w] = parts as [number, number, number, number];
    def = d; mid = m1 + m2; fwd = w;
  }
  const map = (p: LivePlayer, isStarter: boolean): ProbableLineupPlayer => ({
    id: p.id,
    name: p.name,
    position: p.position,
    positionLabel: p.positionLabel,
    shirtNumber: p.shirtNumber,
    headshotUrl: p.headshotUrl,
    isStarter,
    injured: p.injured,
  });
  const gks = fit.filter((p) => p.position === "GK");
  const defs = fit.filter((p) => p.position === "DEF");
  const mids = fit.filter((p) => p.position === "MID");
  const fwds = fit.filter((p) => p.position === "FWD");
  const starting = [
    ...(gks[0] ? [gks[0]] : []),
    ...defs.slice(0, def),
    ...mids.slice(0, mid),
    ...fwds.slice(0, fwd),
  ];
  const startingIds = new Set(starting.map((p) => p.id));
  const bench = fit.filter((p) => !startingIds.has(p.id)).slice(0, 9);
  // Confidence = ratio of XI we could actually assemble (some teams' rosters
  // mis-classify positions, leaving holes).
  const confidence = +(starting.length / 11).toFixed(2);
  return {
    formation,
    starting: starting.map((p) => map(p, true)),
    bench: bench.map((p) => map(p, false)),
    source: "predicted",
    confidence,
  };
}

// ============================================================================
// Season-pace props (corners, cards, offsides, fouls)
//   These rates are not in ESPN's public soccer endpoints, so we derive a best
//   honest estimate from match expected goals + a league-wide constant. The
//   surface clearly labels them as "model", not real bookmaker.
// ============================================================================
export interface MatchProps {
  totalGoals: { line: number; expected: number; overProb: number; underProb: number };
  totalCorners: { line: number; expected: number };
  totalCards: { line: number; expected: number };
  totalOffsides: { line: number; expected: number };
  totalFouls: { line: number; expected: number };
  bothTeamsToScore: { yesProb: number; noProb: number };
  exactScore: { label: string; probability: number }[];
}

export function buildMatchProps(poisson: PoissonResult, marketLine: number | null): MatchProps {
  const totalLambda = poisson.expectedHome + poisson.expectedAway;
  const line = marketLine ?? 2.5;
  // For totalGoals overProb we need "P(goals > line)" — the Poisson gives that for line in {.5, 1.5, 2.5, ...}
  const intLine = Math.floor(line);
  let pOver = 0;
  for (const cell of poisson.matrix) {
    if (cell.homeGoals + cell.awayGoals > intLine) pOver += cell.probability;
  }
  // League average corner kicks per match in La Liga ≈ 9.3 (5-year mean). We
  // scale linearly with totalGoals (more attacking = more corners).
  const expCorners = +(totalLambda * 3.4).toFixed(1);
  const expCards = +(3.5 + totalLambda * 0.6).toFixed(1); // 4-6 yellow per match typical
  const expOffsides = +(3.0 + totalLambda * 0.4).toFixed(1);
  const expFouls = +(20 + totalLambda * 1.2).toFixed(1);
  // Top 5 scorelines
  const sorted = [...poisson.matrix].sort((a, b) => b.probability - a.probability).slice(0, 5);
  return {
    totalGoals: {
      line,
      expected: +totalLambda.toFixed(2),
      overProb: +pOver.toFixed(4),
      underProb: +(1 - pOver).toFixed(4),
    },
    totalCorners: { line: 9.5, expected: expCorners },
    totalCards:   { line: 4.5, expected: expCards },
    totalOffsides:{ line: 3.5, expected: expOffsides },
    totalFouls:   { line: 22.5, expected: expFouls },
    bothTeamsToScore: { yesProb: poisson.bttsProb, noProb: +(1 - poisson.bttsProb).toFixed(4) },
    exactScore: sorted.map((s) => ({ label: `${s.homeGoals}-${s.awayGoals}`, probability: +s.probability.toFixed(4) })),
  };
}

// ============================================================================
// Convenience: get-or-load list of predictions for upcoming matches
// ============================================================================
export async function getUpcomingPredictions(): Promise<MatchPrediction[]> {
  const { getMatchesByStatus } = await import("./matches.js");
  const matches = await getMatchesByStatus("upcoming");
  // Keep latency bounded — top 12 chronologically.
  const head = matches.slice(0, 12);
  const results = await Promise.all(head.map((m) => predictMatch(m).then((r) => r.prediction).catch(() => null)));
  return results.filter((r): r is MatchPrediction => r != null).sort((a, b) => a.kickoff.localeCompare(b.kickoff));
}

// Retained for compatibility — used by the value-bets route.
export function getMarketOdds(p: MatchPrediction, raw: RawOdds | null = null): MarketView {
  return buildMarket(p, raw);
}

// Public h2h helper (uses cached scoreboard window only)
export async function computeH2H(homeTeamId: number, awayTeamId: number) {
  const { getH2HMatches } = await import("./matches.js");
  const list = await getH2HMatches(homeTeamId, awayTeamId);
  let hw = 0, d = 0, aw = 0, totalGoals = 0;
  for (const m of list) {
    const hScore = m.homeTeamId === homeTeamId ? (m.homeScore ?? 0) : (m.awayScore ?? 0);
    const aScore = m.homeTeamId === homeTeamId ? (m.awayScore ?? 0) : (m.homeScore ?? 0);
    if (hScore > aScore) hw++;
    else if (hScore === aScore) d++;
    else aw++;
    totalGoals += (m.homeScore ?? 0) + (m.awayScore ?? 0);
  }
  return {
    matches: list,
    homeWins: hw,
    draws: d,
    awayWins: aw,
    total: list.length,
    avgGoals: list.length === 0 ? 0 : +(totalGoals / list.length).toFixed(2),
  };
}

export async function getLast5(teamId: number): Promise<("W"|"D"|"L")[]> {
  return getTeamForm(teamId);
}

export async function getMissingPlayers(teamId: number): Promise<LiveInjury[]> {
  return getTeamInjuries(teamId);
}

// Used by predictions detail route
export async function loadFullPrediction(matchId: number) {
  const match = await getMatchById(matchId);
  if (!match) return null;
  const built = await predictMatch(match);
  const market = buildMarket(built.prediction, built.oddsRaw);
  const props = buildMatchProps(built.poisson, market.overUnderLine);
  const homeProps = await buildPlayerPropsForSide(match, "home", built.poisson.expectedHome, built.summary);
  const awayProps = await buildPlayerPropsForSide(match, "away", built.poisson.expectedAway, built.summary);
  const homeLineup = await buildProbableLineup(match, "home");
  const awayLineup = await buildProbableLineup(match, "away");
  const h2h = await computeH2H(match.homeTeamId, match.awayTeamId);
  const homeForm = await getTeamForm(match.homeTeamId);
  const awayForm = await getTeamForm(match.awayTeamId);
  const homeFormScore = await getTeamFormScore(match.homeTeamId);
  const awayFormScore = await getTeamFormScore(match.awayTeamId);
  const homeMissing = await getTeamInjuries(match.homeTeamId);
  const awayMissing = await getTeamInjuries(match.awayTeamId);
  return {
    match,
    poisson: built.poisson,
    prediction: built.prediction,
    market,
    props,
    playerProps: { home: homeProps, away: awayProps },
    probableLineup: { home: homeLineup, away: awayLineup },
    h2h,
    form: {
      home: { score: homeFormScore, last5: homeForm },
      away: { score: awayFormScore, last5: awayForm },
    },
    missing: { home: homeMissing, away: awayMissing },
  };
}
