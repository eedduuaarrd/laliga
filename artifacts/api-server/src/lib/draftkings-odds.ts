// Real bookmaker odds for La Liga matches via ESPN's public summary endpoint.
// ESPN exposes a "pickcenter" array per match populated with the current
// DraftKings prices: 3-way moneyline (home / draw / away) and total over/under
// 2.5 with American odds.  Everything is keyless and free; we just need to
// reuse the existing `getEventSummary` helper (which is already TTL-cached).
//
// We deliberately keep this small: only markets where DraftKings publishes a
// real price are returned.  Any other market (BTTS, alternate O/U lines) stays
// model-driven and is labelled as such on the UI.

import {
  getEventSummary,
  americanToDecimalOdds,
  type RawOdds,
} from "./espn.js";
import { DEFAULT_LEAGUE } from "./leagues.js";

export interface LiveOddsSnapshot {
  /** Source bookmaker, always "DraftKings" today (ESPN's only soccer feed). */
  bookmaker: string;
  /** ISO timestamp of the snapshot (we use "now" because ESPN does not
   *  expose a per-line timestamp). */
  fetchedAt: string;
  // 1X2 (3-way moneyline) — decimal odds, 0 if not available.
  home: number;
  draw: number;
  away: number;
  // Over/Under 2.5 goals — decimal odds, 0 if not available.
  totalLine: number; // typically 2.5
  over: number;
  under: number;
}

function toDecimalOrZero(american: number | null | undefined): number {
  if (american == null || !Number.isFinite(american)) return 0;
  return americanToDecimalOdds(american);
}

function pickPrimaryOdds(summary: { pickcenter?: RawOdds[]; odds?: RawOdds[] } | null | undefined): RawOdds | null {
  const list = summary?.pickcenter ?? summary?.odds ?? [];
  if (!Array.isArray(list) || list.length === 0) return null;
  // Prefer DraftKings (provider id 100) when ESPN ever returns more than one.
  const dk = list.find((o) => (o as { provider?: { id?: string } }).provider?.id === "100");
  return dk ?? list[0]!;
}

/**
 * Fetch real DraftKings 1X2 + O/U 2.5 prices for a single match. Returns null
 * when ESPN has no pickcenter feed for the match yet (typically matches that
 * are still > 4-5 days away). The `league` parameter selects the ESPN slug so
 * the same helper works for La Liga, Premier League, Champions League, etc.
 */
export async function getLiveOddsForMatch(matchId: number, league: string = DEFAULT_LEAGUE): Promise<LiveOddsSnapshot | null> {
  let summary;
  try {
    summary = await getEventSummary(matchId, league);
  } catch {
    return null;
  }
  const raw = pickPrimaryOdds(summary as never);
  if (!raw) return null;

  const home = toDecimalOrZero(raw.homeTeamOdds?.moneyLine);
  const draw = toDecimalOrZero(raw.drawOdds?.moneyLine);
  const away = toDecimalOrZero(raw.awayTeamOdds?.moneyLine);
  const totalLine = typeof raw.overUnder === "number" ? raw.overUnder : 0;
  const over = toDecimalOrZero(raw.overOdds);
  const under = toDecimalOrZero(raw.underOdds);

  // We require AT LEAST a moneyline for the snapshot to be useful.
  if (home <= 1 && draw <= 1 && away <= 1) return null;

  const provider = (raw as { provider?: { name?: string } }).provider?.name ?? "DraftKings";
  return {
    bookmaker: provider,
    fetchedAt: new Date().toISOString(),
    home,
    draw,
    away,
    totalLine,
    over,
    under,
  };
}
