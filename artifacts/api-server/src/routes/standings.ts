import { Router, type IRouter } from "express";
import { getStandingsRows } from "../data/standings.js";
import { GetStandingsResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/standings", (_req, res) => {
  const data = GetStandingsResponse.parse(getStandingsRows());
  res.json(data);
});

export default router;
