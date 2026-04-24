import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { getAllInjuries } from "../data/injuries.js";
import { ListInjuriesResponse } from "@workspace/api-zod";

const router: IRouter = Router();
const wrap = (fn: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => fn(req, res).catch(next);

router.get("/injuries", wrap(async (_req, res) => {
  const list = await getAllInjuries();
  list.sort((a, b) => b.impactScore - a.impactScore);
  const data = ListInjuriesResponse.parse(list);
  res.json(data);
}));

export default router;
