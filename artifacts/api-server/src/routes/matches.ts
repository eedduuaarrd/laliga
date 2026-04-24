import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { getMatchesByStatus, getMatchesByGameweek, getMatchById, type LiveMatch } from "../data/matches.js";
import {
  buildLineupFor,
  getMatchStats,
  getMatchMomentum,
  getMatchEvents,
  refereeStubFromName,
} from "../data/lineups.js";
import { type LiveTeam } from "../data/teams.js";
import {
  ListMatchesResponse,
  GetMatchResponse,
  ListMatchesQueryParams,
  GetMatchParams,
} from "@workspace/api-zod";

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

export function matchSummary(m: LiveMatch) {
  return {
    id: m.id,
    gameweek: m.gameweek,
    kickoff: m.kickoff,
    status: m.status,
    statusDetail: m.statusDetail,
    minute: m.minute,
    homeTeam: shapeTeam(m.homeTeam),
    awayTeam: shapeTeam(m.awayTeam),
    homeScore: m.homeScore,
    awayScore: m.awayScore,
    venue: m.venue,
    referee: m.referee,
  };
}

router.get("/matches", wrap(async (req, res) => {
  const parsed = ListMatchesQueryParams.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: "Invalid query" });
  const { status, gameweek } = parsed.data;
  let list = gameweek != null
    ? await getMatchesByGameweek(gameweek)
    : await getMatchesByStatus(status);
  if (gameweek != null && status && status !== "all") {
    list = list.filter((m) => m.status === status);
  }
  const data = ListMatchesResponse.parse(list.map(matchSummary));
  return res.json(data);
}));

router.get("/matches/:id", wrap(async (req, res) => {
  const parsed = GetMatchParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) return res.status(400).json({ error: "Invalid id" });
  const m = await getMatchById(parsed.data.id);
  if (!m) return res.status(404).json({ error: "Match not found" });
  const [stats, homeLineup, awayLineup, momentum, events] = await Promise.all([
    getMatchStats(m),
    buildLineupFor(m, "home"),
    buildLineupFor(m, "away"),
    getMatchMomentum(m),
    getMatchEvents(m),
  ]);
  const data = GetMatchResponse.parse({
    match: matchSummary(m),
    stats,
    homeLineup,
    awayLineup,
    momentum,
    events,
    refereeStats: refereeStubFromName(m.referee),
    dataSource: {
      provider: "ESPN",
      fetchedAt: new Date().toISOString(),
      cacheTtlSeconds: 30,
    },
  });
  return res.json(data);
}));

export default router;
