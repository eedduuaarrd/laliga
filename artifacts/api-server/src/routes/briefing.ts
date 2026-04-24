import { Router, type IRouter } from "express";
import { TEAMS, buildCrestUrl } from "../data/teams.js";
import { getStandingsRows, getTeamSeed } from "../data/standings.js";
import { getUpcomingPredictions } from "../data/predictions.js";
import { INJURIES } from "../data/injuries.js";
import { PLAYERS } from "../data/players.js";
import { GetMorningBriefingResponse } from "@workspace/api-zod";

const router: IRouter = Router();

function teamWithCrest(teamId: number) {
  const team = TEAMS.find((t) => t.id === teamId)!;
  return {
    id: team.id,
    name: team.name,
    shortName: team.shortName,
    city: team.city,
    founded: team.founded,
    stadium: team.stadium,
    primaryColor: team.primaryColor,
    secondaryColor: team.secondaryColor,
    crestUrl: buildCrestUrl(team),
    manager: team.manager,
    formation: team.formation,
  };
}

router.get("/briefing", (_req, res) => {
  const today = new Date().toISOString().split("T")[0]!;
  const standings = getStandingsRows();
  const leader = standings[0]!;
  const second = standings[1]!;
  const gap = leader.points - second.points;
  const headline = `${leader.teamName} hold ${gap}-point edge over ${second.teamName} ahead of crucial week`;

  const allPreds = getUpcomingPredictions();
  // Top picks: 3 highest-confidence predictions
  const topPicks = allPreds.slice(0, 3).map((p) => ({
    matchId: p.matchId,
    kickoff: p.kickoff,
    homeTeam: teamWithCrest(p.homeTeamId),
    awayTeam: teamWithCrest(p.awayTeamId),
    homeWinProb: p.homeWinProb,
    drawProb: p.drawProb,
    awayWinProb: p.awayWinProb,
    expectedHomeGoals: p.expectedHomeGoals,
    expectedAwayGoals: p.expectedAwayGoals,
    confidence: p.confidence,
    recommendation: p.recommendation,
  }));

  // Upset watch: predictions where draw or away has surprisingly high probability vs implied favorites
  // We'll surface 3 matches with the smallest spread between top and second outcome
  const sortedBySpread = [...allPreds].sort((a, b) => {
    const spreadA = Math.max(a.homeWinProb, a.drawProb, a.awayWinProb) - Math.min(a.homeWinProb, a.drawProb, a.awayWinProb);
    const spreadB = Math.max(b.homeWinProb, b.drawProb, b.awayWinProb) - Math.min(b.homeWinProb, b.drawProb, b.awayWinProb);
    return spreadA - spreadB;
  });
  const upsetWatch = sortedBySpread.slice(0, 3).map((p) => ({
    matchId: p.matchId,
    kickoff: p.kickoff,
    homeTeam: teamWithCrest(p.homeTeamId),
    awayTeam: teamWithCrest(p.awayTeamId),
    homeWinProb: p.homeWinProb,
    drawProb: p.drawProb,
    awayWinProb: p.awayWinProb,
    expectedHomeGoals: p.expectedHomeGoals,
    expectedAwayGoals: p.expectedAwayGoals,
    confidence: p.confidence,
    recommendation: p.recommendation,
  }));

  // Key absences: top 3 by impact
  const keyAbsences = [...INJURIES]
    .sort((a, b) => b.impactScore - a.impactScore)
    .slice(0, 3);

  const summary = `Matchday 13 is underway in La Liga with title implications across the table. ${leader.teamName} look to extend their advantage while ${second.teamName} stalk in second. The model has flagged ${topPicks.length} high-confidence picks and ${upsetWatch.length} matches where an upset is statistically plausible. Several heavyweight absences could swing momentum — track every injury report before the whistle.`;

  const topPick = topPicks[0];
  const topAbsence = keyAbsences[0];
  const topAbsencePlayer = topAbsence ? PLAYERS.find((p) => p.id === topAbsence.playerId) : undefined;
  const topAbsenceTeam = topAbsencePlayer ? TEAMS.find((t) => t.id === topAbsencePlayer.teamId) : undefined;
  const topUpset = upsetWatch[0];

  const keyStorylines = [
    {
      title: "Title race tightens",
      body: `${leader.teamName} sit on ${leader.points} points with a goal difference of ${leader.goalDifference >= 0 ? "+" : ""}${leader.goalDifference}, just ${gap} clear of ${second.teamName}. Every dropped point now reverberates across the chase.`,
    },
    topPick ? {
      title: "Model's strongest call",
      body: `${getTeamSeed(topPick.homeTeam.id).shortName} vs ${getTeamSeed(topPick.awayTeam.id).shortName} is the cleanest read on the slate. Recommendation: ${topPick.recommendation} at ${(topPick.confidence * 100).toFixed(1)}% confidence, with expected goals of ${topPick.expectedHomeGoals.toFixed(2)}-${topPick.expectedAwayGoals.toFixed(2)}.`,
    } : { title: "Quiet board", body: "No standout fixtures from the model this week." },
    topUpset ? {
      title: "Upset radar",
      body: `${getTeamSeed(topUpset.homeTeam.id).shortName} vs ${getTeamSeed(topUpset.awayTeam.id).shortName} grades as the most unpredictable fixture this week — three-way market split with no probability separating from the pack.`,
    } : { title: "Predictable slate", body: "No high-variance matchups identified." },
    topAbsence && topAbsencePlayer && topAbsenceTeam ? {
      title: "Key absence to track",
      body: `${topAbsencePlayer.name} (${topAbsenceTeam.shortName}) is the highest-impact name on the injury list with a model impact score of ${topAbsence.impactScore.toFixed(2)} — return ${topAbsence.expectedReturn}.`,
    } : { title: "Squads near full strength", body: "No major absences reported." },
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
});

export default router;
