// Thin wrapper for The Odds API (https://the-odds-api.com).
// Filters strictly to bet365 because that is the bookmaker the product is
// branded around. When THE_ODDS_API_KEY is not set, every helper returns
// `null` / empty so the rest of the system can fall back to the model layer
// without crashing.

import { logger } from "./logger.js";

const BASE = "https://api.the-odds-api.com/v4";
const SPORT = "soccer_spain_la_liga";
const REGIONS = "eu,uk";
const MARKETS = "h2h,totals,btts";
const BOOKMAKER = "bet365";

interface OddsApiOutcome {
  name: string;
  price: number;
  point?: number;
}

interface OddsApiMarket {
  key: string;
  outcomes: OddsApiOutcome[];
}

interface OddsApiBookmaker {
  key: string;
  title: string;
  last_update: string;
  markets: OddsApiMarket[];
}

interface OddsApiEvent {
  id: string;
  sport_key: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers: OddsApiBookmaker[];
}

let cache: { events: OddsApiEvent[]; ts: number } | null = null;
const CACHE_MS = 60_000;

export function isOddsApiConfigured(): boolean {
  return Boolean(process.env["THE_ODDS_API_KEY"]);
}

export async function fetchBet365Events(): Promise<OddsApiEvent[]> {
  const key = process.env["THE_ODDS_API_KEY"];
  if (!key) return [];
  if (cache && Date.now() - cache.ts < CACHE_MS) return cache.events;

  const url = `${BASE}/sports/${SPORT}/odds?apiKey=${encodeURIComponent(
    key,
  )}&regions=${REGIONS}&markets=${MARKETS}&oddsFormat=decimal&bookmakers=${BOOKMAKER}`;
  try {
    const resp = await fetch(url);
    if (!resp.ok) {
      logger.warn({ status: resp.status }, "the-odds-api request failed");
      return cache?.events ?? [];
    }
    const data = (await resp.json()) as OddsApiEvent[];
    cache = { events: data, ts: Date.now() };
    return data;
  } catch (err) {
    logger.warn({ err }, "the-odds-api fetch error");
    return cache?.events ?? [];
  }
}

export interface Bet365Odds {
  home: number | null;
  draw: number | null;
  away: number | null;
  over15: number | null;
  under15: number | null;
  over25: number | null;
  under25: number | null;
  over35: number | null;
  under35: number | null;
  bttsYes: number | null;
  bttsNo: number | null;
  lastUpdate: string | null;
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function nameMatches(a: string, b: string): boolean {
  const na = normalize(a);
  const nb = normalize(b);
  if (!na || !nb) return false;
  return na === nb || na.includes(nb) || nb.includes(na);
}

export async function getBet365OddsForMatch(
  homeName: string,
  awayName: string,
): Promise<Bet365Odds | null> {
  const events = await fetchBet365Events();
  if (events.length === 0) return null;
  const match = events.find(
    (e) =>
      nameMatches(e.home_team, homeName) && nameMatches(e.away_team, awayName),
  );
  if (!match) return null;
  const bm = match.bookmakers.find((b) => b.key === BOOKMAKER);
  if (!bm) return null;

  const out: Bet365Odds = {
    home: null,
    draw: null,
    away: null,
    over15: null,
    under15: null,
    over25: null,
    under25: null,
    over35: null,
    under35: null,
    bttsYes: null,
    bttsNo: null,
    lastUpdate: bm.last_update,
  };

  for (const m of bm.markets) {
    if (m.key === "h2h") {
      for (const o of m.outcomes) {
        const n = normalize(o.name);
        if (n === "draw") out.draw = o.price;
        else if (nameMatches(o.name, match.home_team)) out.home = o.price;
        else if (nameMatches(o.name, match.away_team)) out.away = o.price;
      }
    } else if (m.key === "totals") {
      for (const o of m.outcomes) {
        const isOver = o.name.toLowerCase() === "over";
        if (o.point === 1.5) {
          if (isOver) out.over15 = o.price;
          else out.under15 = o.price;
        } else if (o.point === 2.5) {
          if (isOver) out.over25 = o.price;
          else out.under25 = o.price;
        } else if (o.point === 3.5) {
          if (isOver) out.over35 = o.price;
          else out.under35 = o.price;
        }
      }
    } else if (m.key === "btts") {
      for (const o of m.outcomes) {
        if (o.name.toLowerCase() === "yes") out.bttsYes = o.price;
        else out.bttsNo = o.price;
      }
    }
  }
  return out;
}
