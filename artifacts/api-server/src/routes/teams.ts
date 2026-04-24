import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { getAllTeams, getTeamById, type LiveTeam } from "../data/teams.js";
import { getTeamStanding, getTeamForm } from "../data/standings.js";
import { getTeamSquadEnriched } from "../data/players.js";
import { getMatchesByStatus } from "../data/matches.js";
import {
  ListTeamsResponse,
  GetTeamResponse,
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

router.get("/teams", wrap(async (_req, res) => {
  const teams = await getAllTeams();
  const data = ListTeamsResponse.parse(teams.map(shapeTeam));
  res.json(data);
}));

router.get("/teams/:id", wrap(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });
  const team = await getTeamById(id);
  if (!team) return res.status(404).json({ error: "Team not found" });
  const [standing, form, squad, allUpcoming] = await Promise.all([
    getTeamStanding(id),
    getTeamForm(id),
    getTeamSquadEnriched(id, 30),
    getMatchesByStatus("upcoming"),
  ]);
  const upcoming = allUpcoming
    .filter((m) => m.homeTeamId === id || m.awayTeamId === id)
    .slice(0, 5)
    .map((m) => ({
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
    }));
  const data = GetTeamResponse.parse({
    team: shapeTeam(team),
    position: standing?.position ?? 0,
    points: standing?.points ?? 0,
    played: standing?.played ?? 0,
    wins: standing?.wins ?? 0,
    draws: standing?.draws ?? 0,
    losses: standing?.losses ?? 0,
    goalsFor: standing?.goalsFor ?? 0,
    goalsAgainst: standing?.goalsAgainst ?? 0,
    cleanSheets: standing?.cleanSheets ?? 0,
    form,
    squad: squad.map((p) => ({
      id: p.id,
      name: p.name,
      teamId: p.teamId,
      teamShortName: team.shortName,
      position: p.position,
      positionLabel: p.positionLabel,
      shirtNumber: p.shirtNumber,
      nationality: p.nationality,
      age: p.age,
      headshotUrl: p.headshotUrl,
      appearances: p.appearances,
      goals: p.goals,
      assists: p.assists,
      keyPasses: p.keyPasses,
      bigChancesCreated: p.bigChancesCreated,
      shots: p.shots,
      shotsOnTarget: p.shotsOnTarget,
      xG: p.xG,
      rating: p.rating,
      injured: p.injured,
      injuryStatus: p.injuryStatus,
    })),
    upcomingMatches: upcoming,
    dataSource: {
      provider: "ESPN",
      fetchedAt: new Date().toISOString(),
      cacheTtlSeconds: 21600,
    },
  });
  return res.json(data);
}));

export default router;
