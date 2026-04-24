import { Router, type IRouter } from "express";
import { MATCHES, getH2HMatches } from "../data/matches.js";
import { TEAMS } from "../data/teams.js";
import { computeH2HBias } from "../data/predictions.js";
import { GetH2HResponse, GetH2HQueryParams } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/h2h", (req, res) => {
  const parsed = GetH2HQueryParams.safeParse({
    homeTeamId: Number(req.query.homeTeamId),
    awayTeamId: Number(req.query.awayTeamId),
  });
  if (!parsed.success) return res.status(400).json({ error: "Invalid query" });
  const { homeTeamId, awayTeamId } = parsed.data;
  const home = TEAMS.find((t) => t.id === homeTeamId);
  const away = TEAMS.find((t) => t.id === awayTeamId);
  if (!home || !away) return res.status(404).json({ error: "Team not found" });
  const bias = computeH2HBias(homeTeamId, awayTeamId);
  const matches = getH2HMatches(homeTeamId, awayTeamId).slice(0, 10).map((m) => ({
    date: m.kickoff.split("T")[0]!,
    competition: "La Liga",
    homeTeam: TEAMS.find((t) => t.id === m.homeTeamId)!.name,
    awayTeam: TEAMS.find((t) => t.id === m.awayTeamId)!.name,
    homeScore: m.homeScore ?? 0,
    awayScore: m.awayScore ?? 0,
  }));
  void MATCHES;
  const data = GetH2HResponse.parse({
    homeTeamId,
    awayTeamId,
    totalMatches: bias.total,
    homeWins: bias.homeWins,
    draws: bias.draws,
    awayWins: bias.awayWins,
    avgGoals: bias.avgGoals,
    recentMeetings: matches,
  });
  return res.json(data);
});

export default router;
