import {
  Router,
  type IRouter,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import { getBoard, buildSuggestions, getDataSourceLabel } from "../data/bet365.js";
import { isOddsApiConfigured } from "../lib/odds-api.js";

const router: IRouter = Router();
const wrap =
  (fn: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) =>
    fn(req, res).catch(next);

router.get(
  "/bet365/board",
  wrap(async (_req, res) => {
    const matches = await getBoard();
    res.json({
      source: getDataSourceLabel(),
      realBet365: isOddsApiConfigured(),
      matches,
    });
  }),
);

router.get(
  "/bet365/suggestions",
  wrap(async (_req, res) => {
    const data = await buildSuggestions();
    res.json({
      source: getDataSourceLabel(),
      realBet365: isOddsApiConfigured(),
      ...data,
    });
  }),
);

export default router;
