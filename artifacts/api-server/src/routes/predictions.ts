import { Router, type IRouter } from "express";
import { MATCHES } from "../data/matches.js";
import { TEAMS, buildCrestUrl } from "../data/teams.js";
import {
  basicPredictionForMatch,
  getUpcomingPredictions,
  computeLambdas,
  poissonPredict,
  computeAbsenceImpact,
  computeH2HBias,
  getMarketOdds,
} from "../data/predictions.js";
import { getTeamForm, getTeamFormScore, getTeamSeed } from "../data/standings.js";
import { getTeamInjuries } from "../data/injuries.js";
import { PLAYERS } from "../data/players.js";
import {
  ListPredictionsResponse,
  GetPredictionResponse,
  GetPredictionParams,
} from "@workspace/api-zod";

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

function basicToResponse(p: ReturnType<typeof basicPredictionForMatch>) {
  return {
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
  };
}

router.get("/predictions", (_req, res) => {
  const data = ListPredictionsResponse.parse(getUpcomingPredictions().map(basicToResponse));
  res.json(data);
});

router.get("/predictions/:matchId", (req, res) => {
  const parsed = GetPredictionParams.safeParse({ matchId: Number(req.params.matchId) });
  if (!parsed.success) return res.status(400).json({ error: "Invalid matchId" });
  const matchId = parsed.data.matchId;
  const m = MATCHES.find((x) => x.id === matchId);
  if (!m) return res.status(404).json({ error: "Match not found" });

  const basic = basicPredictionForMatch(m);
  const { lambdaH, lambdaA } = computeLambdas(m);
  const result = poissonPredict(lambdaH, lambdaA, 7);

  // Top 5 scorelines
  const sortedMatrix = [...result.matrix].sort((a, b) => b.probability - a.probability);
  const topScorelines = sortedMatrix.slice(0, 5).map((s) => ({
    label: `${s.homeGoals}-${s.awayGoals}`,
    probability: +s.probability.toFixed(4),
  }));

  // Score matrix limited to 8x8 (0..7) for the heatmap
  const scoreMatrix = result.matrix.map((s) => ({
    homeGoals: s.homeGoals,
    awayGoals: s.awayGoals,
    probability: +s.probability.toFixed(5),
  }));

  // Form factor
  const homeShort = getTeamSeed(m.homeTeamId).shortName;
  const awayShort = getTeamSeed(m.awayTeamId).shortName;

  // Absence impact
  const homeImpact = computeAbsenceImpact(m.homeTeamId);
  const awayImpact = computeAbsenceImpact(m.awayTeamId);
  const homeMissing = getTeamInjuries(m.homeTeamId).map((i) => {
    const p = PLAYERS.find((pl) => pl.id === i.playerId)!;
    return {
      id: i.id,
      playerId: i.playerId,
      playerName: p.name,
      teamId: p.teamId,
      teamShortName: homeShort,
      type: i.type,
      description: i.description,
      severity: i.severity,
      expectedReturn: i.expectedReturn,
      impactScore: i.impactScore,
    };
  });
  const awayMissing = getTeamInjuries(m.awayTeamId).map((i) => {
    const p = PLAYERS.find((pl) => pl.id === i.playerId)!;
    return {
      id: i.id,
      playerId: i.playerId,
      playerName: p.name,
      teamId: p.teamId,
      teamShortName: awayShort,
      type: i.type,
      description: i.description,
      severity: i.severity,
      expectedReturn: i.expectedReturn,
      impactScore: i.impactScore,
    };
  });

  // H2H summary with recent meetings
  const h2hBias = computeH2HBias(m.homeTeamId, m.awayTeamId);
  const homeName = getTeamSeed(m.homeTeamId).name;
  const awayName = getTeamSeed(m.awayTeamId).name;
  const recentMeetings = MATCHES
    .filter((x) => x.status === "finished" && (
      (x.homeTeamId === m.homeTeamId && x.awayTeamId === m.awayTeamId) ||
      (x.homeTeamId === m.awayTeamId && x.awayTeamId === m.homeTeamId)
    ))
    .slice(0, 5)
    .map((x) => ({
      date: x.kickoff.split("T")[0]!,
      competition: "La Liga",
      homeTeam: getTeamSeed(x.homeTeamId).name,
      awayTeam: getTeamSeed(x.awayTeamId).name,
      homeScore: x.homeScore ?? 0,
      awayScore: x.awayScore ?? 0,
    }));

  // Market odds + value
  const odds = getMarketOdds(basic);

  const data = GetPredictionResponse.parse({
    base: basicToResponse(basic),
    scoreMatrix,
    topScorelines,
    formFactor: {
      homeFormScore: getTeamFormScore(m.homeTeamId),
      awayFormScore: getTeamFormScore(m.awayTeamId),
      homeLast5: getTeamForm(m.homeTeamId),
      awayLast5: getTeamForm(m.awayTeamId),
    },
    h2h: {
      homeTeamId: m.homeTeamId,
      awayTeamId: m.awayTeamId,
      totalMatches: h2hBias.total,
      homeWins: h2hBias.homeWins,
      draws: h2hBias.draws,
      awayWins: h2hBias.awayWins,
      avgGoals: h2hBias.avgGoals,
      recentMeetings,
    },
    absenceImpact: {
      homeImpact,
      awayImpact,
      homeMissing,
      awayMissing,
    },
    marketOdds: odds,
  });
  void homeName; void awayName;
  return res.json(data);
});

export default router;
