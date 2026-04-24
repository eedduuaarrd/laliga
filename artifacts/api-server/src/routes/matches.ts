import { Router, type IRouter } from "express";
import { MATCHES, type SeedMatch } from "../data/matches.js";
import { TEAMS, buildCrestUrl } from "../data/teams.js";
import { buildLineup, buildMatchStats, buildMomentum, buildEvents, getRefereeStats } from "../data/lineups.js";
import {
  ListMatchesResponse,
  GetMatchResponse,
  ListMatchesQueryParams,
  GetMatchParams,
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

export function matchSummary(m: SeedMatch) {
  return {
    id: m.id,
    gameweek: m.gameweek,
    kickoff: m.kickoff,
    status: m.status,
    minute: m.minute ?? null,
    homeTeam: teamWithCrest(m.homeTeamId),
    awayTeam: teamWithCrest(m.awayTeamId),
    homeScore: m.homeScore ?? null,
    awayScore: m.awayScore ?? null,
    venue: m.venue,
    referee: m.referee,
  };
}

router.get("/matches", (req, res) => {
  const parsed = ListMatchesQueryParams.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: "Invalid query" });
  const { status, gameweek } = parsed.data;
  let filtered = MATCHES;
  if (status && status !== "all") filtered = filtered.filter((m) => m.status === status);
  if (gameweek != null) filtered = filtered.filter((m) => m.gameweek === gameweek);
  filtered = [...filtered].sort((a, b) => a.kickoff.localeCompare(b.kickoff));
  const data = ListMatchesResponse.parse(filtered.map(matchSummary));
  return res.json(data);
});

router.get("/matches/:id", (req, res) => {
  const parsed = GetMatchParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) return res.status(400).json({ error: "Invalid id" });
  const m = MATCHES.find((x) => x.id === parsed.data.id);
  if (!m) return res.status(404).json({ error: "Match not found" });
  const homeLineup = buildLineup(m.homeTeamId);
  const awayLineup = buildLineup(m.awayTeamId);
  const homeShort = TEAMS.find((t) => t.id === m.homeTeamId)!.shortName;
  const awayShort = TEAMS.find((t) => t.id === m.awayTeamId)!.shortName;
  const data = GetMatchResponse.parse({
    match: matchSummary(m),
    stats: buildMatchStats(m),
    homeLineup: {
      formation: homeLineup.formation,
      starting: homeLineup.starting.map((p) => ({ ...p, teamShortName: homeShort })),
      bench: homeLineup.bench.map((p) => ({ ...p, teamShortName: homeShort })),
    },
    awayLineup: {
      formation: awayLineup.formation,
      starting: awayLineup.starting.map((p) => ({ ...p, teamShortName: awayShort })),
      bench: awayLineup.bench.map((p) => ({ ...p, teamShortName: awayShort })),
    },
    momentum: buildMomentum(m),
    events: buildEvents(m),
    refereeStats: getRefereeStats(m.referee),
  });
  return res.json(data);
});

export default router;
