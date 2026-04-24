import { Router, type IRouter } from "express";
import { TEAMS } from "../data/teams.js";
import { getUpcomingPredictions, getMarketOdds } from "../data/predictions.js";
import { ListValueBetsResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/value-bets", (_req, res) => {
  const preds = getUpcomingPredictions();
  const bets: { matchId: number; matchLabel: string; kickoff: string; market: string; modelProb: number; marketOdds: number; impliedProb: number; edge: number; confidence: "low"|"medium"|"high" }[] = [];
  for (const p of preds) {
    const home = TEAMS.find((t) => t.id === p.homeTeamId)!;
    const away = TEAMS.find((t) => t.id === p.awayTeamId)!;
    const label = `${home.shortName} vs ${away.shortName}`;
    const odds = getMarketOdds(p);
    const candidates: { side: string; modelProb: number; oddsValue: number; value: number }[] = [
      { side: `${home.shortName} win`, modelProb: p.homeWinProb, oddsValue: odds.homeOdds, value: odds.valueHome },
      { side: "Draw", modelProb: p.drawProb, oddsValue: odds.drawOdds, value: odds.valueDraw },
      { side: `${away.shortName} win`, modelProb: p.awayWinProb, oddsValue: odds.awayOdds, value: odds.valueAway },
    ];
    for (const c of candidates) {
      if (c.value > 0.04) {
        let confidence: "low" | "medium" | "high" = "low";
        if (c.value > 0.18) confidence = "high";
        else if (c.value > 0.10) confidence = "medium";
        bets.push({
          matchId: p.matchId,
          matchLabel: label,
          kickoff: p.kickoff,
          market: c.side,
          modelProb: c.modelProb,
          marketOdds: c.oddsValue,
          impliedProb: +(1 / c.oddsValue).toFixed(4),
          edge: +c.value.toFixed(4),
          confidence,
        });
      }
    }
  }
  bets.sort((a, b) => b.edge - a.edge);
  const data = ListValueBetsResponse.parse(bets.slice(0, 25));
  res.json(data);
});

export default router;
