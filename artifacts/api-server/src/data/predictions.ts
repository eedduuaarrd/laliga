import { MATCHES, type SeedMatch, getH2HMatches } from "./matches.js";
import { getTeamSeed, getTeamFormScore, getTeamForm } from "./standings.js";
import { getTeamInjuries } from "./injuries.js";
import { PLAYERS } from "./players.js";

// Poisson PMF
function poissonPmf(k: number, lambda: number): number {
  if (k < 0) return 0;
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
}

export function poissonPredict(lambdaH: number, lambdaA: number, maxGoals = 7): PoissonResult {
  const matrix: PoissonResult["matrix"] = [];
  let homeWin = 0;
  let draw = 0;
  let awayWin = 0;
  for (let h = 0; h <= maxGoals; h++) {
    for (let a = 0; a <= maxGoals; a++) {
      const p = poissonPmf(h, lambdaH) * poissonPmf(a, lambdaA);
      matrix.push({ homeGoals: h, awayGoals: a, probability: +p.toFixed(5) });
      if (h > a) homeWin += p;
      else if (h === a) draw += p;
      else awayWin += p;
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
  };
}

export function computeAbsenceImpact(teamId: number): number {
  const injuries = getTeamInjuries(teamId);
  // Weighted impact, max ~0.35
  let impact = 0;
  for (const inj of injuries) {
    const p = PLAYERS.find((pl) => pl.id === inj.playerId);
    if (!p) continue;
    // Higher rating + more goals/assists = more impact
    const playerWeight = (p.rating - 6) * 0.05 + (p.goals + p.assists) * 0.005;
    impact += inj.impactScore * Math.max(0.05, playerWeight);
  }
  return Math.min(0.35, +impact.toFixed(3));
}

export function computeH2HBias(homeTeamId: number, awayTeamId: number): { homeWins: number; draws: number; awayWins: number; total: number; avgGoals: number } {
  const matches = getH2HMatches(homeTeamId, awayTeamId);
  let hw = 0, d = 0, aw = 0, totalGoals = 0;
  for (const m of matches) {
    const hScore = m.homeTeamId === homeTeamId ? (m.homeScore ?? 0) : (m.awayScore ?? 0);
    const aScore = m.homeTeamId === homeTeamId ? (m.awayScore ?? 0) : (m.homeScore ?? 0);
    if (hScore > aScore) hw++;
    else if (hScore === aScore) d++;
    else aw++;
    totalGoals += (m.homeScore ?? 0) + (m.awayScore ?? 0);
  }
  return {
    homeWins: hw,
    draws: d,
    awayWins: aw,
    total: matches.length,
    avgGoals: matches.length === 0 ? 0 : +(totalGoals / matches.length).toFixed(2),
  };
}

export function computeLambdas(match: SeedMatch): { lambdaH: number; lambdaA: number } {
  const home = getTeamSeed(match.homeTeamId);
  const away = getTeamSeed(match.awayTeamId);
  const homeForm = getTeamFormScore(match.homeTeamId);
  const awayForm = getTeamFormScore(match.awayTeamId);
  const homeAbsence = computeAbsenceImpact(match.homeTeamId);
  const awayAbsence = computeAbsenceImpact(match.awayTeamId);
  // H2H pull (slight, max ±5%)
  const h2h = computeH2HBias(match.homeTeamId, match.awayTeamId);
  const h2hPull = h2h.total > 0 ? (h2h.homeWins - h2h.awayWins) / Math.max(h2h.total, 1) * 0.05 : 0;
  const baseLambdaH = home.attackStrength * (1.4 / away.defenseStrength) * home.homeAdvantage;
  const baseLambdaA = away.attackStrength * (1.2 / home.defenseStrength);
  const lambdaH = +(baseLambdaH * homeForm * (1 - homeAbsence) * (1 + h2hPull)).toFixed(3);
  const lambdaA = +(baseLambdaA * awayForm * (1 - awayAbsence) * (1 - h2hPull)).toFixed(3);
  return { lambdaH: Math.max(0.2, lambdaH), lambdaA: Math.max(0.2, lambdaA) };
}

export interface BasicPrediction {
  matchId: number;
  kickoff: string;
  homeTeamId: number;
  awayTeamId: number;
  homeWinProb: number;
  drawProb: number;
  awayWinProb: number;
  expectedHomeGoals: number;
  expectedAwayGoals: number;
  confidence: number; // 0..1
  recommendation: string;
}

export function basicPredictionForMatch(match: SeedMatch): BasicPrediction {
  const { lambdaH, lambdaA } = computeLambdas(match);
  const r = poissonPredict(lambdaH, lambdaA);
  const top = Math.max(r.homeWin, r.draw, r.awayWin);
  const confidence = top; // 0..1
  let recommendation = "Draw lean";
  if (top === r.homeWin) recommendation = `Home win — ${getTeamSeed(match.homeTeamId).shortName}`;
  else if (top === r.awayWin) recommendation = `Away win — ${getTeamSeed(match.awayTeamId).shortName}`;
  return {
    matchId: match.id,
    kickoff: match.kickoff,
    homeTeamId: match.homeTeamId,
    awayTeamId: match.awayTeamId,
    homeWinProb: +r.homeWin.toFixed(4),
    drawProb: +r.draw.toFixed(4),
    awayWinProb: +r.awayWin.toFixed(4),
    expectedHomeGoals: +lambdaH.toFixed(2),
    expectedAwayGoals: +lambdaA.toFixed(2),
    confidence: +confidence.toFixed(4),
    recommendation,
  };
}

export function getUpcomingPredictions(): BasicPrediction[] {
  return MATCHES
    .filter((m) => m.status === "upcoming")
    .map((m) => basicPredictionForMatch(m))
    .sort((a, b) => b.confidence - a.confidence);
}

export function getMarketOdds(p: BasicPrediction) {
  // Synthesize "market" odds with a 5-7% overround relative to model probabilities
  const overround = 1.06;
  // Use slightly biased odds — sportsbooks usually shade favorites and overprice draws
  const noiseHome = 0.95 + ((p.matchId * 13) % 10) / 100;
  const noiseDraw = 0.90 + ((p.matchId * 7) % 12) / 100;
  const noiseAway = 0.95 + ((p.matchId * 17) % 10) / 100;
  const homeOdds = +(1 / (p.homeWinProb * noiseHome) * overround).toFixed(2);
  const drawOdds = +(1 / (p.drawProb * noiseDraw) * overround).toFixed(2);
  const awayOdds = +(1 / (p.awayWinProb * noiseAway) * overround).toFixed(2);
  // value = (modelProb * odds) - 1
  const valueHome = +((p.homeWinProb * homeOdds) - 1).toFixed(4);
  const valueDraw = +((p.drawProb * drawOdds) - 1).toFixed(4);
  const valueAway = +((p.awayWinProb * awayOdds) - 1).toFixed(4);
  let bestPick = "No edge";
  const max = Math.max(valueHome, valueDraw, valueAway);
  if (max > 0.02) {
    if (max === valueHome) bestPick = "Home";
    else if (max === valueDraw) bestPick = "Draw";
    else bestPick = "Away";
  }
  return { homeOdds, drawOdds, awayOdds, valueHome, valueDraw, valueAway, bestPick };
}
