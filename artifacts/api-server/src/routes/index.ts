import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import teamsRouter from "./teams.js";
import standingsRouter from "./standings.js";
import matchesRouter from "./matches.js";
import predictionsRouter from "./predictions.js";
import playersRouter from "./players.js";
import injuriesRouter from "./injuries.js";
import h2hRouter from "./h2h.js";
import valueBetsRouter from "./value-bets.js";
import briefingRouter from "./briefing.js";
import dashboardRouter from "./dashboard.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(teamsRouter);
router.use(standingsRouter);
router.use(matchesRouter);
router.use(predictionsRouter);
router.use(playersRouter);
router.use(injuriesRouter);
router.use(h2hRouter);
router.use(valueBetsRouter);
router.use(briefingRouter);
router.use(dashboardRouter);

export default router;
