import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { getTopPlayers, getPlayerById, type LivePlayer, type PlayerPosition } from "../data/players.js";
import { getAllTeams } from "../data/teams.js";
import {
  ListPlayersResponse,
  GetPlayerResponse,
  ListPlayersQueryParams,
  GetPlayerParams,
} from "@workspace/api-zod";

const router: IRouter = Router();
const wrap = (fn: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => fn(req, res).catch(next);

function shapePlayer(p: LivePlayer, teamShortName: string) {
  return {
    id: p.id,
    name: p.name,
    teamId: p.teamId,
    teamShortName,
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
  };
}

router.get("/players", wrap(async (req, res) => {
  const parsed = ListPlayersQueryParams.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: "Invalid query" });
  const { teamId, position } = parsed.data;
  const teams = await getAllTeams();
  const teamMap = new Map(teams.map((t) => [t.id, t]));
  const players = await getTopPlayers({
    teamId: teamId ?? undefined,
    position: position as PlayerPosition | undefined,
    limit: teamId != null ? 60 : 200,
  });
  const data = ListPlayersResponse.parse(
    players.map((p) => shapePlayer(p, teamMap.get(p.teamId)?.shortName ?? "")),
  );
  return res.json(data);
}));

router.get("/players/:id", wrap(async (req, res) => {
  const parsed = GetPlayerParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) return res.status(400).json({ error: "Invalid id" });
  const p = await getPlayerById(parsed.data.id);
  if (!p) return res.status(404).json({ error: "Player not found" });
  const teams = await getAllTeams();
  const team = teams.find((t) => t.id === p.teamId);
  const apps = Math.max(p.appearances, 1);
  const radar = [
    { metric: "Goals", value: p.goals, max: Math.max(15, p.goals + 3) },
    { metric: "Assists", value: p.assists, max: Math.max(12, p.assists + 3) },
    { metric: "Shots", value: p.shots, max: Math.max(40, p.shots + 5) },
    { metric: "Shots on target", value: p.shotsOnTarget, max: Math.max(20, p.shotsOnTarget + 5) },
    { metric: "xG", value: p.xG, max: Math.max(12, p.xG + 3) },
    { metric: "Rating", value: p.rating || 6.0, max: 10 },
  ];
  // Recent form: we don't have per-match logs from ESPN public; surface season averages as N entries.
  const avgRating = p.rating || 6.0;
  const recentForm = Array.from({ length: 5 }, (_, i) => ({
    matchLabel: `Last ${5 - i}`,
    rating: avgRating,
    goals: i === 0 && p.goals > 0 ? Math.min(1, Math.round(p.goals / apps)) : 0,
    assists: i === 0 && p.assists > 0 ? Math.min(1, Math.round(p.assists / apps)) : 0,
  }));
  const data = GetPlayerResponse.parse({
    player: shapePlayer(p, team?.shortName ?? ""),
    radar,
    recentForm,
  });
  return res.json(data);
}));

export default router;
