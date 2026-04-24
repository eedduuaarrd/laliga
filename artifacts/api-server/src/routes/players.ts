import { Router, type IRouter } from "express";
import { PLAYERS } from "../data/players.js";
import { TEAMS } from "../data/teams.js";
import {
  ListPlayersResponse,
  GetPlayerResponse,
  ListPlayersQueryParams,
  GetPlayerParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

function withTeam(p: typeof PLAYERS[number]) {
  const team = TEAMS.find((t) => t.id === p.teamId);
  return { ...p, teamShortName: team?.shortName ?? "" };
}

router.get("/players", (req, res) => {
  const parsed = ListPlayersQueryParams.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: "Invalid query" });
  const { teamId, position } = parsed.data;
  let filtered = PLAYERS;
  if (teamId != null) filtered = filtered.filter((p) => p.teamId === teamId);
  if (position) filtered = filtered.filter((p) => p.position === position);
  // Sort by rating desc by default
  filtered = [...filtered].sort((a, b) => b.rating - a.rating);
  // Top 200
  const limit = teamId == null && !position ? 200 : filtered.length;
  const data = ListPlayersResponse.parse(filtered.slice(0, limit).map(withTeam));
  return res.json(data);
});

router.get("/players/:id", (req, res) => {
  const parsed = GetPlayerParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) return res.status(400).json({ error: "Invalid id" });
  const p = PLAYERS.find((x) => x.id === parsed.data.id);
  if (!p) return res.status(404).json({ error: "Player not found" });
  // Build radar with metric/value/max
  const apps = Math.max(p.appearances, 1);
  const radar = [
    { metric: "Goals", value: p.goals, max: 15 },
    { metric: "Assists", value: p.assists, max: 12 },
    { metric: "Key Passes", value: p.keyPasses, max: 40 },
    { metric: "Big Chances", value: p.bigChancesCreated, max: 18 },
    { metric: "xG", value: p.xG, max: 12 },
    { metric: "Rating", value: p.rating, max: 10 },
  ];
  // Recent form: last 5 matches
  const recentForm = Array.from({ length: 5 }, (_, i) => {
    const idx = i + 1;
    const baseRating = p.rating;
    const r = ((p.id * 17 + idx * 31) % 100) / 100;
    return {
      matchLabel: `MD${13 - idx}`,
      rating: +Math.max(5.5, Math.min(9.5, baseRating + (r - 0.5) * 1.4)).toFixed(2),
      goals: i < Math.min(p.goals, 3) && r > 0.5 ? 1 : 0,
      assists: i < Math.min(p.assists, 3) && r > 0.6 ? 1 : 0,
    };
  }).reverse();
  void apps;
  const data = GetPlayerResponse.parse({
    player: withTeam(p),
    radar,
    recentForm,
  });
  return res.json(data);
});

export default router;
