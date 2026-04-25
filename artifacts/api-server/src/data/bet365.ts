// Betting board: combines REAL DraftKings odds (pulled keyless from ESPN's
// public pickcenter feed) with the underlying Poisson model. For each match we
// expose one card per market with the bookmaker price (when real) or the model
// price (clearly labelled), plus the model probability and the implied edge.
// Then we generate ordered simple-bet and combo-bet recommendations.

import { getMatchesByStatus, type LiveMatch } from "./matches.js";
import { predictMatch } from "./predictions.js";
import { getLiveOddsForMatch, type LiveOddsSnapshot } from "../lib/draftkings-odds.js";

export type MarketSource = "live" | "model";

export interface BoardMarket {
  key: string;
  group: string; // "1X2" | "Gols" | "BTTS"
  selection: string; // human label (Catalan)
  odds: number | null;
  modelProb: number;
  impliedProb: number | null;
  edge: number | null; // model_prob * odds - 1
  source: MarketSource;
}

export interface BoardMatch {
  matchId: number;
  status: "live" | "upcoming";
  kickoff: string;
  minute: number | null;
  homeShort: string;
  awayShort: string;
  homeName: string;
  awayName: string;
  homeCrest: string;
  awayCrest: string;
  homeScore: number | null;
  awayScore: number | null;
  /** "live" when at least one real bookmaker market is available, else "model". */
  source: MarketSource;
  bookmaker: string | null;
  oddsLastUpdate: string | null;
  topPick: { selection: string; modelProb: number; odds: number | null } | null;
  markets: BoardMarket[];
}

const MODEL_OVERROUND = 1.05;
function modelOdds(p: number): number {
  if (p <= 0.001) return 999;
  return +((MODEL_OVERROUND / p)).toFixed(2);
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

function buildMarketRow(
  key: string,
  group: string,
  selection: string,
  liveOdd: number | null | undefined,
  modelProb: number,
): BoardMarket {
  const p = clamp01(modelProb);
  const realOdd = liveOdd && liveOdd > 1.001 ? liveOdd : null;
  const odds = realOdd ?? modelOdds(p);
  const impliedProb = odds > 0 ? +(1 / odds).toFixed(4) : null;
  const edge = +(p * odds - 1).toFixed(4);
  return {
    key,
    group,
    selection,
    odds: +odds.toFixed(2),
    modelProb: +p.toFixed(4),
    impliedProb,
    edge,
    source: realOdd ? "live" : "model",
  };
}

function probOver(matrix: { homeGoals: number; awayGoals: number; probability: number }[], threshold: number): number {
  let p = 0;
  for (const cell of matrix) {
    if (cell.homeGoals + cell.awayGoals > threshold) p += cell.probability;
  }
  return clamp01(p);
}

export async function buildBoardMatch(m: LiveMatch): Promise<BoardMatch> {
  const { prediction, poisson } = await predictMatch(m);
  const live: LiveOddsSnapshot | null = await getLiveOddsForMatch(m.id).catch(() => null);

  const probHome = prediction.homeWinProb;
  const probDraw = prediction.drawProb;
  const probAway = prediction.awayWinProb;
  const probOver15 = probOver(poisson.matrix, 1);
  const probOver25 = prediction.over25Prob;
  const probOver35 = probOver(poisson.matrix, 3);
  const probBttsYes = prediction.bttsProb;

  // Real DK markets: 1X2 + Over/Under 2.5 (when totalLine matches 2.5).
  const liveOver25 = live && live.totalLine === 2.5 ? live.over : null;
  const liveUnder25 = live && live.totalLine === 2.5 ? live.under : null;

  const markets: BoardMarket[] = [
    buildMarketRow("1x2-home", "1X2", `${m.homeTeam.shortName} guanya`, live?.home, probHome),
    buildMarketRow("1x2-draw", "1X2", "Empat", live?.draw, probDraw),
    buildMarketRow("1x2-away", "1X2", `${m.awayTeam.shortName} guanya`, live?.away, probAway),
    buildMarketRow("ou-15-over", "Gols", "Over 1.5", null, probOver15),
    buildMarketRow("ou-15-under", "Gols", "Under 1.5", null, 1 - probOver15),
    buildMarketRow("ou-25-over", "Gols", "Over 2.5", liveOver25, probOver25),
    buildMarketRow("ou-25-under", "Gols", "Under 2.5", liveUnder25, 1 - probOver25),
    buildMarketRow("ou-35-over", "Gols", "Over 3.5", null, probOver35),
    buildMarketRow("ou-35-under", "Gols", "Under 3.5", null, 1 - probOver35),
    buildMarketRow("btts-yes", "BTTS", "Sí", null, probBttsYes),
    buildMarketRow("btts-no", "BTTS", "No", null, 1 - probBttsYes),
  ];

  const hasAnyLive = markets.some((mk) => mk.source === "live");
  const matchSource: MarketSource = hasAnyLive ? "live" : "model";

  // Top pick = highest model probability across all markets, restricted to
  // markets where the price is realistic (modelProb >= 0.45) and odds exist.
  const candidates = markets.filter((mk) => mk.odds && mk.modelProb >= 0.45);
  candidates.sort((a, b) => b.modelProb - a.modelProb);
  const top = candidates[0]
    ? { selection: candidates[0].selection, modelProb: candidates[0].modelProb, odds: candidates[0].odds }
    : null;

  return {
    matchId: m.id,
    status: m.status === "live" ? "live" : "upcoming",
    kickoff: m.kickoff,
    minute: m.minute,
    homeShort: m.homeTeam.shortName,
    awayShort: m.awayTeam.shortName,
    homeName: m.homeTeam.name,
    awayName: m.awayTeam.name,
    homeCrest: m.homeTeam.crestUrl,
    awayCrest: m.awayTeam.crestUrl,
    homeScore: m.homeScore,
    awayScore: m.awayScore,
    source: matchSource,
    bookmaker: live?.bookmaker ?? null,
    oddsLastUpdate: live?.fetchedAt ?? prediction.oddsLastUpdate,
    topPick: top,
    markets,
  };
}

export async function getBoard(): Promise<BoardMatch[]> {
  const all = await getMatchesByStatus("all");
  const now = Date.now();
  const window = all
    .filter((m) => {
      if (m.status === "live") return true;
      if (m.status !== "upcoming") return false;
      const t = new Date(m.kickoff).getTime();
      return t > now - 3600_000 && t < now + 10 * 24 * 3600_000;
    })
    .slice(0, 14);

  const results = await Promise.all(
    window.map((m) => buildBoardMatch(m).catch(() => null)),
  );
  const out = results.filter((r): r is BoardMatch => r !== null);
  // Live first, then upcoming chronologically
  out.sort((a, b) => {
    if (a.status !== b.status) return a.status === "live" ? -1 : 1;
    return a.kickoff.localeCompare(b.kickoff);
  });
  return out;
}

// ============================================================================
// Bet suggestion engine
// ============================================================================

export interface SimpleBet {
  id: string;
  matchId: number;
  matchLabel: string;
  kickoff: string;
  status: "live" | "upcoming";
  market: string;
  selection: string;
  odds: number;
  modelProb: number;
  impliedProb: number;
  edge: number;
  source: MarketSource;
  riskTier: "molt baix" | "baix" | "moderat" | "alt";
  rationale: string;
}

export interface ComboBet {
  id: string;
  legs: {
    matchLabel: string;
    market: string;
    selection: string;
    odds: number;
    modelProb: number;
    source: MarketSource;
  }[];
  combinedOdds: number;
  combinedProb: number;
  riskTier: "baix" | "moderat" | "alt" | "molt alt";
  rationale: string;
}

function tierForProb(p: number): SimpleBet["riskTier"] {
  if (p >= 0.78) return "molt baix";
  if (p >= 0.62) return "baix";
  if (p >= 0.48) return "moderat";
  return "alt";
}

function tierForCombo(p: number): ComboBet["riskTier"] {
  if (p >= 0.55) return "baix";
  if (p >= 0.32) return "moderat";
  if (p >= 0.16) return "alt";
  return "molt alt";
}

function rationaleFor(modelProb: number, edge: number, source: MarketSource): string {
  const src = source === "live" ? "DraftKings" : "el model";
  if (modelProb >= 0.78) {
    return "Probabilitat molt alta segons el model: poques sorpreses esperades.";
  }
  if (modelProb >= 0.62) {
    return "Model favorable amb base estadística sòlida.";
  }
  if (edge > 0.10) {
    return `Edge de +${(edge * 100).toFixed(1)}%: ${src} sembla infravalorar aquesta opció.`;
  }
  if (modelProb >= 0.48) {
    return "Probabilitat moderada amb risc raonable i bona quota.";
  }
  return "Aposta més arriscada però amb valor esperat positiu.";
}

export async function buildSuggestions(): Promise<{ simples: SimpleBet[]; combos: ComboBet[] }> {
  const board = await getBoard();
  const simples: SimpleBet[] = [];

  for (const m of board) {
    const label = `${m.homeShort} vs ${m.awayShort}`;
    for (const mk of m.markets) {
      if (!mk.odds || mk.odds < 1.05) continue;
      // Realistic only: model probability >= 40%
      if (mk.modelProb < 0.40) continue;
      const edge = mk.edge ?? 0;
      // Drop heavy negative-edge markets (book overpricing the model heavily)
      if (edge < -0.08) continue;
      simples.push({
        id: `${m.matchId}-${mk.key}`,
        matchId: m.matchId,
        matchLabel: label,
        kickoff: m.kickoff,
        status: m.status,
        market: mk.group,
        selection: mk.selection,
        odds: mk.odds,
        modelProb: mk.modelProb,
        impliedProb: mk.impliedProb ?? 0,
        edge,
        source: mk.source,
        riskTier: tierForProb(mk.modelProb),
        rationale: rationaleFor(mk.modelProb, edge, mk.source),
      });
    }
  }

  // Sort: lowest risk first; within tier, prefer real DraftKings then higher edge then higher prob.
  const tierOrder = { "molt baix": 0, baix: 1, moderat: 2, alt: 3 } as const;
  simples.sort((a, b) => {
    if (tierOrder[a.riskTier] !== tierOrder[b.riskTier])
      return tierOrder[a.riskTier] - tierOrder[b.riskTier];
    if (a.source !== b.source) return a.source === "live" ? -1 : 1;
    if (Math.abs(b.edge - a.edge) > 0.02) return b.edge - a.edge;
    return b.modelProb - a.modelProb;
  });

  // Build combos from the strongest pick per match (avoid combining two
  // selections from the same fixture, which would not be independent).
  const bestPerMatch = new Map<number, SimpleBet>();
  for (const s of simples) {
    const cur = bestPerMatch.get(s.matchId);
    if (!cur || s.modelProb > cur.modelProb) bestPerMatch.set(s.matchId, s);
  }
  const candidates = [...bestPerMatch.values()]
    .filter((s) => s.modelProb >= 0.55)
    .sort((a, b) => b.modelProb - a.modelProb)
    .slice(0, 8);

  const combos: ComboBet[] = [];

  function makeCombo(legs: SimpleBet[], rationale: string): ComboBet {
    const combinedOdds = +legs.reduce((acc, l) => acc * l.odds, 1).toFixed(2);
    const combinedProb = +legs.reduce((acc, l) => acc * l.modelProb, 1).toFixed(4);
    return {
      id: `combo-${legs.length}-${legs.map((l) => l.id).join("-")}`,
      legs: legs.map((l) => ({
        matchLabel: l.matchLabel,
        market: l.market,
        selection: l.selection,
        odds: l.odds,
        modelProb: l.modelProb,
        source: l.source,
      })),
      combinedOdds,
      combinedProb,
      riskTier: tierForCombo(combinedProb),
      rationale,
    };
  }

  // Two-leg combos: enumerate pairs, keep the 4 with the highest joint probability.
  if (candidates.length >= 2) {
    const pairs: [SimpleBet, SimpleBet][] = [];
    for (let i = 0; i < candidates.length; i++) {
      for (let j = i + 1; j < candidates.length; j++) {
        pairs.push([candidates[i]!, candidates[j]!]);
      }
    }
    pairs.sort((a, b) => b[0].modelProb * b[1].modelProb - a[0].modelProb * a[1].modelProb);
    for (const [a, b] of pairs.slice(0, 4)) {
      combos.push(
        makeCombo(
          [a, b],
          `Doble amb les dues seleccions individuals més fortes (${(a.modelProb * 100).toFixed(0)}% × ${(b.modelProb * 100).toFixed(0)}%).`,
        ),
      );
    }
  }
  if (candidates.length >= 3) {
    const top3 = candidates.slice(0, 3);
    combos.push(makeCombo(top3, "Triple amb les tres apostes més consistents segons el model."));
  }
  if (candidates.length >= 4) {
    const top4 = candidates.slice(0, 4);
    combos.push(makeCombo(top4, "Quàdruple agressiva: més risc però retorn molt més alt."));
  }

  // Sort combos low-risk → high-risk (highest combined probability first).
  combos.sort((a, b) => b.combinedProb - a.combinedProb);

  return {
    simples: simples.slice(0, 30),
    combos,
  };
}

export interface BoardMeta {
  bookmakerLabel: string;
  liveMatchCount: number;
  liveMarketCount: number;
  totalMatchCount: number;
}

export function describeBoard(board: BoardMatch[]): BoardMeta {
  let liveMatchCount = 0;
  let liveMarketCount = 0;
  for (const m of board) {
    if (m.source === "live") liveMatchCount++;
    for (const mk of m.markets) if (mk.source === "live") liveMarketCount++;
  }
  let bookmakerLabel: string;
  if (liveMarketCount === 0) {
    bookmakerLabel = "Mode model · sense quotes en directe";
  } else if (liveMatchCount === board.length) {
    bookmakerLabel = "Quotes reals · DraftKings (via ESPN)";
  } else {
    bookmakerLabel = `Quotes reals (${liveMatchCount}/${board.length}) · DraftKings + model`;
  }
  return {
    bookmakerLabel,
    liveMatchCount,
    liveMarketCount,
    totalMatchCount: board.length,
  };
}
