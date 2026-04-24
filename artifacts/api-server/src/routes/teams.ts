import { Router, type IRouter } from "express";
import { TEAMS, buildCrestUrl } from "../data/teams.js";
import { getTeamStanding, getTeamForm } from "../data/standings.js";
import { getTeamSquad } from "../data/players.js";
import { MATCHES } from "../data/matches.js";
import {
  ListTeamsResponse,
  GetTeamResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

function teamWithCrest(team: typeof TEAMS[number]) {
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

router.get("/teams", (_req, res) => {
  const data = ListTeamsResponse.parse(TEAMS.map(teamWithCrest));
  res.json(data);
});

router.get("/teams/:id", (req, res) => {
  const id = Number(req.params.id);
  const team = TEAMS.find((t) => t.id === id);
  if (!team) return res.status(404).json({ error: "Team not found" });
  const standing = getTeamStanding(id);
  const squad = getTeamSquad(id).map((p) => ({
    id: p.id,
    name: p.name,
    teamId: p.teamId,
    teamShortName: team.shortName,
    position: p.position,
    shirtNumber: p.shirtNumber,
    nationality: p.nationality,
    age: p.age,
    appearances: p.appearances,
    goals: p.goals,
    assists: p.assists,
    keyPasses: p.keyPasses,
    bigChancesCreated: p.bigChancesCreated,
    xG: p.xG,
    rating: p.rating,
  }));
  const upcoming = MATCHES
    .filter((m) => m.status === "upcoming" && (m.homeTeamId === id || m.awayTeamId === id))
    .slice(0, 5)
    .map((m) => ({
      id: m.id,
      gameweek: m.gameweek,
      kickoff: m.kickoff,
      status: m.status,
      minute: m.minute ?? null,
      homeTeam: teamWithCrest(TEAMS.find((t) => t.id === m.homeTeamId)!),
      awayTeam: teamWithCrest(TEAMS.find((t) => t.id === m.awayTeamId)!),
      homeScore: m.homeScore ?? null,
      awayScore: m.awayScore ?? null,
      venue: m.venue,
      referee: m.referee,
    }));
  const data = GetTeamResponse.parse({
    team: teamWithCrest(team),
    position: standing?.position ?? 0,
    points: standing?.points ?? 0,
    played: standing?.played ?? 0,
    wins: standing?.wins ?? 0,
    draws: standing?.draws ?? 0,
    losses: standing?.losses ?? 0,
    goalsFor: standing?.goalsFor ?? 0,
    goalsAgainst: standing?.goalsAgainst ?? 0,
    cleanSheets: standing?.cleanSheets ?? 0,
    form: getTeamForm(id),
    squad,
    upcomingMatches: upcoming,
  });
  return res.json(data);
});

export default router;
