import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { getMatchesByStatus } from "../data/matches.js";
import { getStandingsRows } from "../data/standings.js";
import { predictMatch, type MatchPrediction } from "../data/predictions.js";
import { getAllInjuries } from "../data/injuries.js";
import { type LiveTeam } from "../data/teams.js";
import { GetMorningBriefingResponse } from "@workspace/api-zod";

const router: IRouter = Router();
const wrap = (fn: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => fn(req, res).catch(next);

function shapeTeam(t: LiveTeam) {
  return {
    id: t.id,
    name: t.name,
    shortName: t.shortName,
    abbreviation: t.abbreviation,
    city: t.city,
    founded: t.founded,
    stadium: t.stadium,
    primaryColor: t.primaryColor,
    secondaryColor: t.secondaryColor,
    crestUrl: t.crestUrl,
    manager: t.manager,
    formation: t.formation,
  };
}

function shapePred(p: MatchPrediction, home: LiveTeam, away: LiveTeam) {
  return {
    matchId: p.matchId,
    kickoff: p.kickoff,
    homeTeam: shapeTeam(home),
    awayTeam: shapeTeam(away),
    homeWinProb: p.homeWinProb,
    drawProb: p.drawProb,
    awayWinProb: p.awayWinProb,
    expectedHomeGoals: p.expectedHomeGoals,
    expectedAwayGoals: p.expectedAwayGoals,
    bttsProb: p.bttsProb,
    over25Prob: p.over25Prob,
    under25Prob: p.under25Prob,
    cleanSheetHome: p.cleanSheetHome,
    cleanSheetAway: p.cleanSheetAway,
    confidence: p.confidence,
    recommendation: p.recommendation,
    source: p.source,
    bookmaker: p.bookmaker,
    oddsLastUpdate: p.oddsLastUpdate,
  };
}

router.get("/briefing", wrap(async (_req, res) => {
  const today = new Date().toISOString().split("T")[0]!;
  const [standings, upcoming, injuries] = await Promise.all([
    getStandingsRows(),
    getMatchesByStatus("upcoming"),
    getAllInjuries(),
  ]);
  const leader = standings[0];
  const second = standings[1];
  const gap = (leader?.points ?? 0) - (second?.points ?? 0);
  const headline = leader && second
    ? `${leader.teamName} hold ${gap}-point edge over ${second.teamName} ahead of crucial week`
    : "La Liga matchday preview";

  // Build predictions for the next ~8 matches.
  const head = upcoming.slice(0, 8);
  const built = await Promise.all(
    head.map((m) =>
      predictMatch(m)
        .then((r) => ({ m, p: r.prediction }))
        .catch(() => null),
    ),
  );
  const allPreds = built.filter((x): x is { m: typeof head[number]; p: MatchPrediction } => x != null);

  // Top picks by confidence
  const topPicks = [...allPreds]
    .sort((a, b) => b.p.confidence - a.p.confidence)
    .slice(0, 3)
    .map((x) => shapePred(x.p, x.m.homeTeam, x.m.awayTeam));

  // Upset watch: tightest 3-way splits
  const upsetWatch = [...allPreds]
    .sort((a, b) => {
      const sA = Math.max(a.p.homeWinProb, a.p.drawProb, a.p.awayWinProb) - Math.min(a.p.homeWinProb, a.p.drawProb, a.p.awayWinProb);
      const sB = Math.max(b.p.homeWinProb, b.p.drawProb, b.p.awayWinProb) - Math.min(b.p.homeWinProb, b.p.drawProb, b.p.awayWinProb);
      return sA - sB;
    })
    .slice(0, 3)
    .map((x) => shapePred(x.p, x.m.homeTeam, x.m.awayTeam));

  const keyAbsences = [...injuries].sort((a, b) => b.impactScore - a.impactScore).slice(0, 3);
  const summary = `Live La Liga snapshot from ESPN: ${allPreds.length} upcoming matches modelled with real bookmaker odds blended into our Poisson engine. ${topPicks.length} high-confidence picks and ${upsetWatch.length} potential upsets identified. Track key absences before kickoff.`;

  const topPick = topPicks[0];
  const topUpset = upsetWatch[0];
  const topAbs = keyAbsences[0];
  const keyStorylines = [
    leader && second ? {
      title: "Title race tightens",
      body: `${leader.teamName} sit on ${leader.points} points (GD ${leader.goalDifference >= 0 ? "+" : ""}${leader.goalDifference}), ${gap} clear of ${second.teamName}.`,
    } : { title: "Standings settling", body: "Live La Liga table loaded from ESPN." },
    topPick ? {
      title: "Model's strongest call",
      body: `${topPick.homeTeam.shortName} vs ${topPick.awayTeam.shortName}: ${topPick.recommendation} at ${(topPick.confidence * 100).toFixed(1)}% confidence (xG ${topPick.expectedHomeGoals.toFixed(2)}-${topPick.expectedAwayGoals.toFixed(2)})${topPick.bookmaker ? `, source ${topPick.bookmaker}` : ""}.`,
    } : { title: "Quiet board", body: "No upcoming fixtures in the rolling window." },
    topUpset ? {
      title: "Upset radar",
      body: `${topUpset.homeTeam.shortName} vs ${topUpset.awayTeam.shortName} is the tightest market: ${(topUpset.homeWinProb * 100).toFixed(0)}% / ${(topUpset.drawProb * 100).toFixed(0)}% / ${(topUpset.awayWinProb * 100).toFixed(0)}%.`,
    } : { title: "Predictable slate", body: "No high-variance matchups identified." },
    topAbs ? {
      title: "Key absence to track",
      body: `${topAbs.playerName} (${topAbs.teamShortName}) leads the impact list — status ${topAbs.status}.`,
    } : { title: "Squads near full strength", body: "No major absences flagged on ESPN rosters." },
  ];

  const data = GetMorningBriefingResponse.parse({
    date: today,
    headline,
    summary,
    topPicks,
    upsetWatch,
    keyStorylines,
  });
  res.json(data);
}));

export default router;
