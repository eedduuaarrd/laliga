import { Router, type IRouter } from "express";
import { MATCHES } from "../data/matches.js";
import { TEAMS } from "../data/teams.js";
import { getStandingsRows } from "../data/standings.js";
import { PLAYERS } from "../data/players.js";
import { GetDashboardSummaryResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/dashboard/summary", (_req, res) => {
  const standings = getStandingsRows();
  const leader = standings[0]!;
  const liveCount = MATCHES.filter((m) => m.status === "live").length;
  const todayStr = new Date().toISOString().split("T")[0]!;
  const todaysCount = MATCHES.filter((m) => m.kickoff.startsWith(todayStr)).length;

  const topScorerP = [...PLAYERS].sort((a, b) => b.goals - a.goals)[0]!;
  const topScorerTeam = TEAMS.find((t) => t.id === topScorerP.teamId)!;
  const topAssisterP = [...PLAYERS].sort((a, b) => b.assists - a.assists)[0]!;
  const topAssisterTeam = TEAMS.find((t) => t.id === topAssisterP.teamId)!;

  // Simulated model accuracy
  const totalPredictions = 120;
  const correctPredictions = 67;
  const accuracyPct = +((correctPredictions / totalPredictions) * 100).toFixed(1);
  const roi = 12.4;

  const weeklyAccuracy = Array.from({ length: 12 }, (_, i) => {
    const gw = i + 1;
    const seed = (gw * 17 + 11) % 25;
    const acc = 48 + seed; // 48..72%
    return { gameweek: gw, accuracyPct: +acc.toFixed(1) };
  });

  const data = GetDashboardSummaryResponse.parse({
    currentGameweek: 13,
    liveMatches: liveCount,
    todaysMatches: todaysCount,
    topScorer: {
      playerName: topScorerP.name,
      teamShortName: topScorerTeam.shortName,
      goals: topScorerP.goals,
    },
    topAssister: {
      playerName: topAssisterP.name,
      teamShortName: topAssisterTeam.shortName,
      assists: topAssisterP.assists,
    },
    leader: {
      teamShortName: leader.teamShortName,
      points: leader.points,
    },
    modelAccuracy: {
      totalPredictions,
      correctPredictions,
      accuracyPct,
      roi,
    },
    weeklyAccuracy,
  });
  res.json(data);
});

export default router;
