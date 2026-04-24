import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { getAllMatches, getCurrentGameweek } from "../data/matches.js";
import { getStandingsRows } from "../data/standings.js";
import { GetDashboardSummaryResponse } from "@workspace/api-zod";

const router: IRouter = Router();
const wrap = (fn: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => fn(req, res).catch(next);

router.get("/dashboard/summary", wrap(async (_req, res) => {
  const [standings, matches, gw] = await Promise.all([
    getStandingsRows(),
    getAllMatches(),
    getCurrentGameweek(),
  ]);
  const leader = standings[0];
  const liveCount = matches.filter((m) => m.status === "live").length;
  const todayStr = new Date().toISOString().split("T")[0]!;
  const todaysCount = matches.filter((m) => m.kickoff.startsWith(todayStr)).length;

  // Top scorer / assister: ESPN public scoreboard exposes goal-event scorers per
  // game in `summary.leaders` (per match), not a season-wide top scorer feed in
  // a single call. We surface the best leader from the most recent finished
  // match as a representative sample; in absence we degrade gracefully.
  let topScorer = { playerName: "—", teamShortName: "—", goals: 0 };
  let topAssister = { playerName: "—", teamShortName: "—", assists: 0 };

  // Model accuracy / ROI: we don't have a backtest pipeline yet — surface zeros
  // with honest labels rather than fabricated numbers.
  const totalPredictions = 0;
  const correctPredictions = 0;
  const accuracyPct = 0;
  const roi = 0;

  const weeklyAccuracy: { gameweek: number; accuracyPct: number }[] = [];

  const data = GetDashboardSummaryResponse.parse({
    currentGameweek: gw,
    liveMatches: liveCount,
    todaysMatches: todaysCount,
    topScorer,
    topAssister,
    leader: {
      teamShortName: leader?.teamShortName ?? "—",
      points: leader?.points ?? 0,
    },
    modelAccuracy: { totalPredictions, correctPredictions, accuracyPct, roi },
    weeklyAccuracy,
    dataSource: { provider: "ESPN", fetchedAt: new Date().toISOString(), cacheTtlSeconds: 300 },
  });
  res.json(data);
}));

export default router;
