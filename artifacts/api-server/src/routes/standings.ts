import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { getStandingsRows } from "../data/standings.js";
import { GetStandingsResponse } from "@workspace/api-zod";

const router: IRouter = Router();
const wrap = (fn: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => fn(req, res).catch(next);

router.get("/standings", wrap(async (_req, res) => {
  const rows = await getStandingsRows();
  const data = GetStandingsResponse.parse(rows);
  res.json(data);
}));

export default router;
