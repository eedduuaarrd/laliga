import { type LiveMatch } from "./matches.js";
import { predictMatch, poissonPredict } from "./predictions.js";
import { type MatchStats } from "./lineups.js";
import { getEventSummary } from "../lib/espn.js";

export interface LiveOdds {
  bookmaker: string;
  asOf: string;
  homeMoneyline: number | null;
  drawMoneyline: number | null;
  awayMoneyline: number | null;
  spread: number | null;
  spreadDetails: string | null;
  overUnder: number | null;
  overOdds: number | null;
  underOdds: number | null;
  homeImpliedProb: number;
  drawImpliedProb: number;
  awayImpliedProb: number;
}

export interface LiveMarkets {
  asOfMinute: number | null;
  asOfHomeScore: number;
  asOfAwayScore: number;
  homeWinProb: number;
  drawProb: number;
  awayWinProb: number;
  expectedRemainingHomeGoals: number;
  expectedRemainingAwayGoals: number;
  nextGoalHome: number;
  nextGoalAway: number;
  nextGoalNone: number;
  over25Prob: number;
  under25Prob: number;
  over35Prob: number;
  bttsProb: number;
  cleanSheetHome: number;
  cleanSheetAway: number;
  over35CardsProb: number;
  over45CardsProb: number;
  over55CardsProb: number;
  expectedTotalCards: number;
  over85CornersProb: number;
  over95CornersProb: number;
  expectedTotalCorners: number;
  recommendation: string;
}

function poissonPmf(k: number, lambda: number): number {
  if (lambda <= 0) return k === 0 ? 1 : 0;
  let logP = -lambda + k * Math.log(lambda);
  for (let i = 2; i <= k; i++) logP -= Math.log(i);
  return Math.exp(logP);
}

function poissonOver(threshold: number, lambda: number): number {
  // P(X > threshold). Threshold is half-integer (e.g. 3.5).
  const need = Math.floor(threshold);
  let p = 0;
  for (let k = 0; k <= 30; k++) {
    if (k > need) p += poissonPmf(k, lambda);
  }
  return Math.min(1, +p.toFixed(4));
}

export async function computeLiveMarkets(match: LiveMatch, stats: MatchStats): Promise<LiveMarkets | null> {
  if (match.status !== "live") return null;

  const minute = match.minute ?? 1;
  // Account for typical added time at full-time
  const totalRegulation = 95;
  const remainingMinutes = Math.max(1, totalRegulation - minute);
  const fraction = remainingMinutes / 90;

  // Pre-match expected goals from our blended Poisson + market model
  const { prediction } = await predictMatch(match);
  const lambdaH = +(prediction.expectedHomeGoals * fraction).toFixed(3);
  const lambdaA = +(prediction.expectedAwayGoals * fraction).toFixed(3);

  const home = match.homeScore ?? 0;
  const away = match.awayScore ?? 0;

  // Residual outcome distribution combined with current score
  const residual = poissonPredict(lambdaH, lambdaA, 6);
  let homeWin = 0, draw = 0, awayWin = 0;
  let bttsAtFT = 0, csHome = 0, csAway = 0;
  let pOver25 = 0, pOver35 = 0;
  for (const cell of residual.matrix) {
    const ftHome = home + cell.homeGoals;
    const ftAway = away + cell.awayGoals;
    const p = cell.probability;
    if (ftHome > ftAway) homeWin += p;
    else if (ftHome === ftAway) draw += p;
    else awayWin += p;
    if (ftHome > 0 && ftAway > 0) bttsAtFT += p;
    if (ftAway === 0) csHome += p;
    if (ftHome === 0) csAway += p;
    if (ftHome + ftAway > 2) pOver25 += p;
    if (ftHome + ftAway > 3) pOver35 += p;
  }
  const t = homeWin + draw + awayWin;
  homeWin /= t; draw /= t; awayWin /= t;

  // Next-goal market
  const totalRate = lambdaH + lambdaA;
  const pNoMore = Math.exp(-totalRate);
  const pSomeGoal = 1 - pNoMore;
  const nextGoalHome = totalRate > 0 ? +(pSomeGoal * (lambdaH / totalRate)).toFixed(4) : 0;
  const nextGoalAway = totalRate > 0 ? +(pSomeGoal * (lambdaA / totalRate)).toFixed(4) : 0;

  // Cards: extrapolate from observed pace, with a slight upward bias for the
  // higher-tempo final third of the match.
  const cardsSoFar = stats.homeYellow + stats.awayYellow + stats.homeRed + stats.awayRed;
  const minutesElapsed = Math.max(1, minute);
  const cardsPerMin = cardsSoFar / minutesElapsed;
  const remainingCards = +(cardsPerMin * remainingMinutes * 1.1).toFixed(3);
  const expectedTotalCards = +(cardsSoFar + remainingCards).toFixed(2);
  const over35Cards = +(cardsSoFar > 3 ? 1 : poissonOver(3.5 - cardsSoFar, remainingCards)).toFixed(4);
  const over45Cards = +(cardsSoFar > 4 ? 1 : poissonOver(4.5 - cardsSoFar, remainingCards)).toFixed(4);
  const over55Cards = +(cardsSoFar > 5 ? 1 : poissonOver(5.5 - cardsSoFar, remainingCards)).toFixed(4);

  // Corners: same Poisson extrapolation
  const cornersSoFar = stats.homeCorners + stats.awayCorners;
  const cornersPerMin = cornersSoFar / minutesElapsed;
  const remainingCorners = +(cornersPerMin * remainingMinutes).toFixed(3);
  const expectedTotalCorners = +(cornersSoFar + remainingCorners).toFixed(2);
  const over85Corners = +(cornersSoFar > 8 ? 1 : poissonOver(8.5 - cornersSoFar, remainingCorners)).toFixed(4);
  const over95Corners = +(cornersSoFar > 9 ? 1 : poissonOver(9.5 - cornersSoFar, remainingCorners)).toFixed(4);

  // Recommendation: pick the highest-probability single market with a confident edge
  const candidates: { label: string; p: number }[] = [
    { label: `Victòria ${match.homeTeam.shortName}`, p: homeWin },
    { label: "Empat", p: draw },
    { label: `Victòria ${match.awayTeam.shortName}`, p: awayWin },
    { label: "Over 2.5 gols", p: pOver25 },
    { label: "Under 2.5 gols", p: 1 - pOver25 },
    { label: "Both Teams To Score", p: bttsAtFT },
    { label: `Pròxim gol: ${match.homeTeam.shortName}`, p: nextGoalHome },
    { label: `Pròxim gol: ${match.awayTeam.shortName}`, p: nextGoalAway },
  ];
  const top = candidates.reduce((a, b) => (b.p > a.p ? b : a));
  const recommendation = `${top.label} · ${(top.p * 100).toFixed(0)}%`;

  return {
    asOfMinute: minute,
    asOfHomeScore: home,
    asOfAwayScore: away,
    homeWinProb: +homeWin.toFixed(4),
    drawProb: +draw.toFixed(4),
    awayWinProb: +awayWin.toFixed(4),
    expectedRemainingHomeGoals: +lambdaH.toFixed(2),
    expectedRemainingAwayGoals: +lambdaA.toFixed(2),
    nextGoalHome,
    nextGoalAway,
    nextGoalNone: +pNoMore.toFixed(4),
    over25Prob: +pOver25.toFixed(4),
    under25Prob: +(1 - pOver25).toFixed(4),
    over35Prob: +pOver35.toFixed(4),
    bttsProb: +bttsAtFT.toFixed(4),
    cleanSheetHome: +csHome.toFixed(4),
    cleanSheetAway: +csAway.toFixed(4),
    over35CardsProb: over35Cards,
    over45CardsProb: over45Cards,
    over55CardsProb: over55Cards,
    expectedTotalCards,
    over85CornersProb: over85Corners,
    over95CornersProb: over95Corners,
    expectedTotalCorners,
    recommendation,
  };
}

function impliedProb(ml: number | null | undefined): number {
  if (ml == null) return 0;
  if (ml > 0) return 100 / (ml + 100);
  return -ml / (-ml + 100);
}

export async function getLiveOdds(match: LiveMatch): Promise<LiveOdds | null> {
  try {
    const sum = await getEventSummary(match.id);
    const odds = sum.pickcenter?.[0] ?? sum.odds?.[0];
    if (!odds || !odds.provider?.name) return null;
    const homeML = odds.homeTeamOdds?.moneyLine ?? null;
    const drawML = odds.drawOdds?.moneyLine ?? null;
    const awayML = odds.awayTeamOdds?.moneyLine ?? null;
    let homeImp = impliedProb(homeML);
    let drawImp = impliedProb(drawML);
    let awayImp = impliedProb(awayML);
    const total = homeImp + drawImp + awayImp;
    if (total > 0) {
      homeImp /= total;
      drawImp /= total;
      awayImp /= total;
    }
    return {
      bookmaker: odds.provider.name,
      asOf: new Date().toISOString(),
      homeMoneyline: homeML,
      drawMoneyline: drawML,
      awayMoneyline: awayML,
      spread: odds.spread ?? null,
      spreadDetails: odds.details ?? null,
      overUnder: odds.overUnder ?? null,
      overOdds: odds.overOdds ?? null,
      underOdds: odds.underOdds ?? null,
      homeImpliedProb: +homeImp.toFixed(4),
      drawImpliedProb: +drawImp.toFixed(4),
      awayImpliedProb: +awayImp.toFixed(4),
    };
  } catch {
    return null;
  }
}
