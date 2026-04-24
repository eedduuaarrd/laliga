import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { getMatchesByStatus, getMatchById } from "../data/matches.js";
import { getTeamById, type LiveTeam } from "../data/teams.js";
import {
  predictMatch,
  loadFullPrediction,
  buildPlayerPropsForSide,
  buildProbableLineup,
  type MatchPrediction,
} from "../data/predictions.js";
import {
  ListPredictionsResponse,
  GetPredictionResponse,
  GetPlayerPropsResponse,
  GetProbableLineupsResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();
const wrap = (fn: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => fn(req, res).catch(next);

function shapeTeam(t: LiveTeam) {
  return {
    id: t.id,
    name: t.name,
    shortName: t.shortName,
    abbreviation: t.abbreviation,
    city: t.city,
    founded: t.founded,
    stadium: t.stadium,
    primaryColor: t.primaryColor,
    secondaryColor: t.secondaryColor,
    crestUrl: t.crestUrl,
    manager: t.manager,
    formation: t.formation,
  };
}

function shapePrediction(p: MatchPrediction, home: LiveTeam, away: LiveTeam) {
  return {
    matchId: p.matchId,
    kickoff: p.kickoff,
    homeTeam: shapeTeam(home),
    awayTeam: shapeTeam(away),
    homeWinProb: p.homeWinProb,
    drawProb: p.drawProb,
    awayWinProb: p.awayWinProb,
    expectedHomeGoals: p.expectedHomeGoals,
    expectedAwayGoals: p.expectedAwayGoals,
    bttsProb: p.bttsProb,
    over25Prob: p.over25Prob,
    under25Prob: p.under25Prob,
    cleanSheetHome: p.cleanSheetHome,
    cleanSheetAway: p.cleanSheetAway,
    confidence: p.confidence,
    recommendation: p.recommendation,
    source: p.source,
    bookmaker: p.bookmaker,
    oddsLastUpdate: p.oddsLastUpdate,
  };
}

router.get("/predictions", wrap(async (_req, res) => {
  const upcoming = await getMatchesByStatus("upcoming");
  const head = upcoming.slice(0, 12);
  const out = (await Promise.all(
    head.map(async (m) => {
      try {
        const built = await predictMatch(m);
        return shapePrediction(built.prediction, m.homeTeam, m.awayTeam);
      } catch {
        return null;
      }
    }),
  )).filter((x): x is NonNullable<typeof x> => x != null);
  const data = ListPredictionsResponse.parse(out);
  res.json(data);
}));

router.get("/predictions/:matchId", wrap(async (req, res) => {
  const matchId = Number(req.params.matchId);
  if (!Number.isFinite(matchId)) return res.status(400).json({ error: "Invalid matchId" });
  const full = await loadFullPrediction(matchId);
  if (!full) return res.status(404).json({ error: "Match not found" });
  const m = full.match;
  const data = GetPredictionResponse.parse({
    base: shapePrediction(full.prediction, m.homeTeam, m.awayTeam),
    scoreMatrix: full.poisson.matrix,
    topScorelines: full.props.exactScore,
    formFactor: {
      homeFormScore: full.form.home.score,
      awayFormScore: full.form.away.score,
      homeLast5: full.form.home.last5,
      awayLast5: full.form.away.last5,
    },
    h2h: {
      homeTeamId: m.homeTeamId,
      awayTeamId: m.awayTeamId,
      totalMatches: full.h2h.total,
      homeWins: full.h2h.homeWins,
      draws: full.h2h.draws,
      awayWins: full.h2h.awayWins,
      avgGoals: full.h2h.avgGoals,
      recentMeetings: full.h2h.matches.slice(0, 5).map((mh) => ({
        date: mh.kickoff.split("T")[0]!,
        competition: "La Liga",
        homeTeam: mh.homeTeam.name,
        awayTeam: mh.awayTeam.name,
        homeScore: mh.homeScore ?? 0,
        awayScore: mh.awayScore ?? 0,
      })),
    },
    absenceImpact: {
      homeImpact: full.missing.home.reduce((s, i) => s + i.impactScore, 0),
      awayImpact: full.missing.away.reduce((s, i) => s + i.impactScore, 0),
      homeMissing: full.missing.home,
      awayMissing: full.missing.away,
    },
    marketOdds: full.market,
    props: full.props,
    playerProps: {
      matchId,
      home: full.playerProps.home,
      away: full.playerProps.away,
      dataSource: { provider: "ESPN", fetchedAt: new Date().toISOString(), cacheTtlSeconds: 60 },
    },
    probableLineups: {
      matchId,
      home: full.probableLineup.home,
      away: full.probableLineup.away,
      dataSource: { provider: "ESPN", fetchedAt: new Date().toISOString(), cacheTtlSeconds: 600 },
    },
    dataSource: { provider: "ESPN", fetchedAt: new Date().toISOString(), cacheTtlSeconds: 60 },
  });
  return res.json(data);
}));

router.get("/predictions/:matchId/players", wrap(async (req, res) => {
  const matchId = Number(req.params.matchId);
  if (!Number.isFinite(matchId)) return res.status(400).json({ error: "Invalid matchId" });
  const m = await getMatchById(matchId);
  if (!m) return res.status(404).json({ error: "Match not found" });
  const built = await predictMatch(m);
  const home = await buildPlayerPropsForSide(m, "home", built.poisson.expectedHome, built.summary);
  const away = await buildPlayerPropsForSide(m, "away", built.poisson.expectedAway, built.summary);
  const data = GetPlayerPropsResponse.parse({
    matchId,
    home,
    away,
    dataSource: { provider: "ESPN", fetchedAt: new Date().toISOString(), cacheTtlSeconds: 60 },
  });
  return res.json(data);
}));

router.get("/predictions/:matchId/lineups", wrap(async (req, res) => {
  const matchId = Number(req.params.matchId);
  if (!Number.isFinite(matchId)) return res.status(400).json({ error: "Invalid matchId" });
  const m = await getMatchById(matchId);
  if (!m) return res.status(404).json({ error: "Match not found" });
  const [home, away] = await Promise.all([
    buildProbableLineup(m, "home"),
    buildProbableLineup(m, "away"),
  ]);
  void getTeamById; // keep import lazy-safe
  const data = GetProbableLineupsResponse.parse({
    matchId,
    home,
    away,
    dataSource: { provider: "ESPN", fetchedAt: new Date().toISOString(), cacheTtlSeconds: 600 },
  });
  return res.json(data);
}));

export default router;
