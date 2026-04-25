import {
  Router,
  type IRouter,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import { getBoard, buildSuggestions, describeBoard } from "../data/bet365.js";

const router: IRouter = Router();
const wrap =
  (fn: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) =>
    fn(req, res).catch(next);

router.get(
  "/bet365/board",
  wrap(async (_req, res) => {
    const matches = await getBoard();
    const meta = describeBoard(matches);
    res.json({
      source: meta.bookmakerLabel,
      liveMatchCount: meta.liveMatchCount,
      liveMarketCount: meta.liveMarketCount,
      totalMatchCount: meta.totalMatchCount,
      matches,
    });
  }),
);

router.get(
  "/bet365/suggestions",
  wrap(async (_req, res) => {
    const matches = await getBoard();
    const meta = describeBoard(matches);
    const data = await buildSuggestions();
    res.json({
      source: meta.bookmakerLabel,
      liveMatchCount: meta.liveMatchCount,
      liveMarketCount: meta.liveMarketCount,
      totalMatchCount: meta.totalMatchCount,
      ...data,
    });
  }),
);

export default router;
