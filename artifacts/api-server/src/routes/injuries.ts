import { Router, type IRouter } from "express";
import { INJURIES } from "../data/injuries.js";
import { PLAYERS } from "../data/players.js";
import { TEAMS } from "../data/teams.js";
import { ListInjuriesResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/injuries", (_req, res) => {
  const enriched = INJURIES.map((i) => {
    const p = PLAYERS.find((pl) => pl.id === i.playerId)!;
    const team = TEAMS.find((t) => t.id === p.teamId)!;
    return {
      id: i.id,
      playerId: i.playerId,
      playerName: p.name,
      teamId: p.teamId,
      teamShortName: team.shortName,
      type: i.type,
      description: i.description,
      severity: i.severity,
      expectedReturn: i.expectedReturn,
      impactScore: i.impactScore,
    };
  });
  enriched.sort((a, b) => b.impactScore - a.impactScore);
  const data = ListInjuriesResponse.parse(enriched);
  res.json(data);
});

export default router;
