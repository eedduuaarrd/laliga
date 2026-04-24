import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { getTeamById } from "../data/teams.js";
import { computeH2H } from "../data/predictions.js";
import { GetH2HResponse, GetH2HQueryParams } from "@workspace/api-zod";

const router: IRouter = Router();
const wrap = (fn: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => fn(req, res).catch(next);

router.get("/h2h", wrap(async (req, res) => {
  const parsed = GetH2HQueryParams.safeParse({
    homeTeamId: Number(req.query.homeTeamId),
    awayTeamId: Number(req.query.awayTeamId),
  });
  if (!parsed.success) return res.status(400).json({ error: "Invalid query" });
  const { homeTeamId, awayTeamId } = parsed.data;
  const [home, away] = await Promise.all([getTeamById(homeTeamId), getTeamById(awayTeamId)]);
  if (!home || !away) return res.status(404).json({ error: "Team not found" });
  const h2h = await computeH2H(homeTeamId, awayTeamId);
  const data = GetH2HResponse.parse({
    homeTeamId,
    awayTeamId,
    totalMatches: h2h.total,
    homeWins: h2h.homeWins,
    draws: h2h.draws,
    awayWins: h2h.awayWins,
    avgGoals: h2h.avgGoals,
    recentMeetings: h2h.matches.slice(0, 10).map((m) => ({
      date: m.kickoff.split("T")[0]!,
      competition: "La Liga",
      homeTeam: m.homeTeam.name,
      awayTeam: m.awayTeam.name,
      homeScore: m.homeScore ?? 0,
      awayScore: m.awayScore ?? 0,
    })),
  });
  return res.json(data);
}));

export default router;
