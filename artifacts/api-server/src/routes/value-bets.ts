import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { getMatchesByStatus } from "../data/matches.js";
import { predictMatch, buildMarket } from "../data/predictions.js";
import { ListValueBetsResponse } from "@workspace/api-zod";

const router: IRouter = Router();
const wrap = (fn: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => fn(req, res).catch(next);

router.get("/value-bets", wrap(async (_req, res) => {
  const upcoming = await getMatchesByStatus("upcoming");
  const head = upcoming.slice(0, 12);
  const bets: {
    matchId: number;
    matchLabel: string;
    kickoff: string;
    market: string;
    modelProb: number;
    marketOdds: number;
    impliedProb: number;
    edge: number;
    confidence: "low" | "medium" | "high";
    bookmaker: string | null;
  }[] = [];

  for (const m of head) {
    try {
      const built = await predictMatch(m);
      const market = buildMarket(built.prediction, built.oddsRaw);
      const label = `${m.homeTeam.shortName} vs ${m.awayTeam.shortName}`;
      const candidates = [
        { side: `${m.homeTeam.shortName} win`, modelProb: built.prediction.homeWinProb, oddsValue: market.homeOdds, value: market.valueHome },
        { side: "Draw", modelProb: built.prediction.drawProb, oddsValue: market.drawOdds, value: market.valueDraw },
        { side: `${m.awayTeam.shortName} win`, modelProb: built.prediction.awayWinProb, oddsValue: market.awayOdds, value: market.valueAway },
      ];
      for (const c of candidates) {
        if (c.value > 0.04 && c.oddsValue > 1) {
          let confidence: "low" | "medium" | "high" = "low";
          if (c.value > 0.18) confidence = "high";
          else if (c.value > 0.10) confidence = "medium";
          bets.push({
            matchId: m.id,
            matchLabel: label,
            kickoff: m.kickoff,
            market: c.side,
            modelProb: c.modelProb,
            marketOdds: c.oddsValue,
            impliedProb: +(1 / c.oddsValue).toFixed(4),
            edge: +c.value.toFixed(4),
            confidence,
            bookmaker: market.bookmaker,
          });
        }
      }
    } catch {
      // skip this match if upstream fetch fails
    }
  }
  bets.sort((a, b) => b.edge - a.edge);
  const data = ListValueBetsResponse.parse(bets.slice(0, 25));
  res.json(data);
}));

export default router;
