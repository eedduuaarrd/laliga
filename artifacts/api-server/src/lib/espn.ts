import { cached } from "./cache.js";
import { logger } from "./logger.js";
import { DEFAULT_LEAGUE } from "./leagues.js";

const SITE_BASE = (lg: string) => `https://site.api.espn.com/apis/site/v2/sports/soccer/${lg}`;
const WEB_BASE = (lg: string) => `https://site.web.api.espn.com/apis/v2/sports/soccer/${lg}`;
const COMMON_BASE = (lg: string) => `https://site.web.api.espn.com/apis/common/v3/sports/soccer/${lg}`;

const HEADERS: Record<string, string> = {
  Accept: "application/json",
  "User-Agent":
    "Mozilla/5.0 (compatible; FutbolEdgeAnalytics/1.0; +https://replit.com)",
};

async function fetchJson<T>(url: string): Promise<T> {
  const resp = await fetch(url, { headers: HEADERS });
  if (!resp.ok) {
    const txt = await resp.text().catch(() => "");
    throw new Error(`ESPN ${resp.status} ${resp.statusText} for ${url} :: ${txt.slice(0, 200)}`);
  }
  return (await resp.json()) as T;
}

// ============================================================================
// Date helpers — ESPN expects YYYYMMDD strings (UTC)
// ============================================================================
export function ymd(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

export function dateRangeStr(start: Date, end: Date): string {
  return `${ymd(start)}-${ymd(end)}`;
}

// ============================================================================
// Raw response shapes (what we read from ESPN)
// ============================================================================
export interface RawTeamRef {
  id: string;
  uid?: string;
  abbreviation?: string;
  displayName: string;
  shortDisplayName?: string;
  name?: string;
  location?: string;
  color?: string;
  alternateColor?: string;
  logo?: string;
  logos?: { href: string; rel?: string[] }[];
  venue?: { fullName?: string; address?: { city?: string; country?: string } };
}

export interface RawCompetitor {
  id: string;
  homeAway: "home" | "away";
  team: RawTeamRef;
  score?: string;
  winner?: boolean;
  records?: { name: string; summary: string; type?: string }[];
  statistics?: { name: string; abbreviation?: string; displayValue?: string; value?: number }[];
  form?: string;
  curatedRank?: { current: number };
}

export interface RawScoreboardEvent {
  id: string;
  uid?: string;
  date: string; // ISO
  name?: string;
  shortName?: string;
  status?: {
    clock?: number;
    displayClock?: string;
    period?: number;
    type?: { id: string; name: string; state: string; completed: boolean; description: string; detail: string; shortDetail: string };
  };
  competitions?: {
    id: string;
    date: string;
    venue?: { fullName?: string; address?: { city?: string; country?: string } };
    competitors: RawCompetitor[];
    notes?: { type: string; headline: string }[];
    status?: RawScoreboardEvent["status"];
    odds?: RawOdds[];
  }[];
  season?: { year: number; type?: number };
  week?: { number: number };
}

export interface RawOdds {
  provider?: { id: string; name: string };
  details?: string;
  overUnder?: number;
  spread?: number;
  homeTeamOdds?: { favorite?: boolean; underdog?: boolean; moneyLine?: number; spreadOdds?: number; team?: RawTeamRef };
  awayTeamOdds?: { favorite?: boolean; underdog?: boolean; moneyLine?: number; spreadOdds?: number; team?: RawTeamRef };
  drawOdds?: { moneyLine?: number };
  overOdds?: number;
  underOdds?: number;
}

export interface RawScoreboard {
  leagues?: { id: string; name: string; season?: { year: number; type?: { name?: string } } }[];
  events: RawScoreboardEvent[];
  day?: { date: string };
}

export interface RawAthlete {
  id: string;
  fullName?: string;
  displayName?: string;
  shortName?: string;
  firstName?: string;
  lastName?: string;
  jersey?: string;
  age?: number;
  position?: { name?: string; abbreviation?: string };
  headshot?: { href?: string; alt?: string };
  citizenship?: string;
  birthPlace?: { country?: string };
  birthCountry?: string;
  flag?: { href?: string };
  status?: { id?: string; name?: string; type?: string };
  injuries?: { status: string; date: string; details?: { type?: string; detail?: string; returnDate?: string } }[];
  links?: { rel?: string[]; href: string }[];
}

export interface RawRosterResponse {
  team: RawTeamRef;
  athletes: RawAthlete[];
  coach?: { id?: string; firstName?: string; lastName?: string }[];
}

export interface RawStandingsEntry {
  team: RawTeamRef;
  stats: { name?: string; abbreviation?: string; displayName?: string; type?: string; value?: number; displayValue?: string }[];
}
export interface RawStandingsGroup {
  uid?: string;
  name?: string;
  abbreviation?: string;
  standings?: { entries: RawStandingsEntry[] };
  children?: RawStandingsGroup[];
}
export interface RawStandingsResponse extends RawStandingsGroup {
  season?: { year: number };
  seasons?: { year: number; displayName?: string }[];
}

export interface RawLeader {
  name?: string;
  shortDisplayName?: string;
  displayName?: string;
  leaders: {
    displayValue?: string;
    shortDisplayValue?: string;
    value?: number;
    athlete: RawAthlete & { team?: RawTeamRef };
  }[];
}
export interface RawLeadersBlock {
  team: RawTeamRef;
  leaders: RawLeader[];
}

export interface RawKeyEvent {
  id: string;
  type?: { id?: string; text?: string; type?: string };
  text?: string;
  shortText?: string;
  period?: { number: number };
  clock?: { value?: number; displayValue?: string };
  scoringPlay?: boolean;
  team?: { id: string; displayName?: string };
  participants?: { athlete?: { id?: string; displayName?: string } }[];
  athletesInvolved?: { id?: string; displayName?: string }[];
  wallclock?: string;
}

export interface RawBoxscoreTeam {
  team: RawTeamRef;
  statistics?: { name: string; displayValue?: string; label?: string }[];
}

export interface RawSummary {
  rosters?: { homeAway: "home" | "away"; team: RawTeamRef; roster?: { athlete: RawAthlete; starter?: boolean; subbedIn?: boolean; position?: { abbreviation: string } }[]; formation?: string }[];
  leaders?: RawLeadersBlock[];
  pickcenter?: RawOdds[];
  odds?: RawOdds[];
  hasOdds?: boolean;
  keyEvents?: RawKeyEvent[];
  boxscore?: { teams?: RawBoxscoreTeam[] };
  headToHeadGames?: { team: RawTeamRef; events?: { id: string; date: string; name?: string; shortName?: string; competitors?: { homeAway: string; team: RawTeamRef; score?: string; winner?: boolean }[] }[] }[];
  header?: {
    competitions?: {
      id: string;
      date: string;
      status?: RawScoreboardEvent["status"];
      competitors?: RawCompetitor[];
      odds?: RawOdds[];
      venue?: { fullName?: string };
    }[];
    league?: { id: string; name: string };
  };
  standings?: { groups?: RawStandingsGroup[] };
  gameInfo?: { venue?: { fullName?: string; address?: { city?: string; country?: string } }; attendance?: number; officials?: { fullName: string; position?: { name?: string }; order?: number }[] };
  news?: { articles?: { headline: string; description?: string; published: string; links?: { web?: { href: string } } }[] };
  format?: { regulation?: { periods: number; clock: number } };
  meta?: Record<string, unknown>;
}

export interface RawTeamDetail {
  team: RawTeamRef & { record?: { items?: { stats: { name: string; value: number }[] }[] }; nextEvent?: RawScoreboardEvent[]; standingSummary?: string };
}

export interface RawAthleteStats {
  athlete?: RawAthlete & { team?: RawTeamRef; jersey?: string };
  splits?: {
    categories?: { name: string; displayName?: string; stats: { name: string; displayName?: string; value: number; displayValue?: string }[] }[];
  };
  seasons?: { year: number; displayName?: string }[];
}

// ============================================================================
// Public client API — every function accepts an optional `league` parameter
// (defaulting to La Liga) so callers that haven't been migrated still work.
// ============================================================================

export async function getScoreboard(date?: Date, league: string = DEFAULT_LEAGUE): Promise<RawScoreboard> {
  const dateParam = date ? `?dates=${ymd(date)}` : "";
  const url = `${SITE_BASE(league)}/scoreboard${dateParam}`;
  const isLiveQuery = !date || Math.abs(date.getTime() - Date.now()) < 36 * 3600 * 1000;
  return cached(`scoreboard:${league}:${dateParam || "now"}`, isLiveQuery ? 30 : 300, () => fetchJson<RawScoreboard>(url));
}

export async function getScoreboardRange(start: Date, end: Date, league: string = DEFAULT_LEAGUE): Promise<RawScoreboard> {
  const range = dateRangeStr(start, end);
  const url = `${SITE_BASE(league)}/scoreboard?dates=${range}`;
  return cached(`scoreboard:range:${league}:${range}`, 60, () => fetchJson<RawScoreboard>(url));
}

export async function getEventSummary(eventId: string | number, league: string = DEFAULT_LEAGUE): Promise<RawSummary> {
  const url = `${SITE_BASE(league)}/summary?event=${eventId}`;
  return cached(`summary:${league}:${eventId}`, 30, () => fetchJson<RawSummary>(url));
}

export interface RawNewsArticle {
  id: number;
  headline: string;
  description?: string;
  published: string;
  lastModified?: string;
  images?: { url?: string; type?: string; caption?: string }[];
  categories?: {
    type?: string;
    description?: string;
    athlete?: { id: number; description?: string };
    team?: { id: number; description?: string };
  }[];
  links?: { web?: { href: string } };
}
export interface RawNewsResponse {
  articles?: RawNewsArticle[];
}
export async function getLeagueNews(limit = 50, league: string = DEFAULT_LEAGUE): Promise<RawNewsResponse> {
  const url = `${SITE_BASE(league)}/news?limit=${limit}`;
  return cached(`news:${league}:${limit}`, 300, () => fetchJson<RawNewsResponse>(url));
}

export async function getStandings(season?: number, league: string = DEFAULT_LEAGUE): Promise<RawStandingsResponse> {
  const seasonParam = season ? `?season=${season}` : "";
  const url = `${WEB_BASE(league)}/standings${seasonParam}`;
  return cached(`standings:${league}:${seasonParam || "current"}`, 600, () => fetchJson<RawStandingsResponse>(url));
}

export interface RawTeamsList {
  sports: {
    leagues: {
      season?: { year: number };
      teams: { team: RawTeamRef & { record?: { items?: unknown[] } } }[];
    }[];
  }[];
}
export async function getTeamsList(league: string = DEFAULT_LEAGUE): Promise<RawTeamsList> {
  const url = `${SITE_BASE(league)}/teams`;
  return cached(`teams:list:${league}`, 24 * 3600, () => fetchJson<RawTeamsList>(url));
}

export async function getTeamRoster(teamId: string | number, league: string = DEFAULT_LEAGUE): Promise<RawRosterResponse> {
  const url = `${SITE_BASE(league)}/teams/${teamId}/roster`;
  return cached(`roster:${league}:${teamId}`, 12 * 3600, () => fetchJson<RawRosterResponse>(url));
}

export async function getTeamDetail(teamId: string | number, league: string = DEFAULT_LEAGUE): Promise<RawTeamDetail> {
  const url = `${SITE_BASE(league)}/teams/${teamId}`;
  return cached(`team:${league}:${teamId}`, 6 * 3600, () => fetchJson<RawTeamDetail>(url));
}

export async function getAthleteStats(athleteId: string | number, season?: number, league: string = DEFAULT_LEAGUE): Promise<RawAthleteStats> {
  const seasonParam = season ? `?season=${season}` : "";
  const url = `${COMMON_BASE(league)}/athletes/${athleteId}/stats${seasonParam}`;
  return cached(`athlete:${league}:${athleteId}:${seasonParam || "current"}`, 12 * 3600, () => fetchJson<RawAthleteStats>(url));
}

// ============================================================================
// Convenience helpers
// ============================================================================

export function americanToImpliedProb(american: number | null | undefined): number {
  if (american == null || !Number.isFinite(american)) return 0;
  if (american < 0) {
    return -american / (-american + 100);
  }
  return 100 / (american + 100);
}

export function americanToDecimalOdds(american: number | null | undefined): number {
  if (american == null || !Number.isFinite(american)) return 0;
  if (american < 0) return +(100 / -american + 1).toFixed(2);
  return +(american / 100 + 1).toFixed(2);
}

export interface NormalizedProbs {
  homeWin: number;
  draw: number;
  awayWin: number;
  source: string;
  overround: number;
}

export function normalizeMoneylineProbs(odds: RawOdds | undefined): NormalizedProbs | null {
  if (!odds) return null;
  const homeML = odds.homeTeamOdds?.moneyLine;
  const awayML = odds.awayTeamOdds?.moneyLine;
  const drawML = odds.drawOdds?.moneyLine;
  if (homeML == null || awayML == null) return null;
  const pH = americanToImpliedProb(homeML);
  const pA = americanToImpliedProb(awayML);
  const pD = drawML != null ? americanToImpliedProb(drawML) : Math.max(0, 1 - pH - pA);
  const total = pH + pA + pD;
  if (total <= 0) return null;
  return {
    homeWin: pH / total,
    draw: pD / total,
    awayWin: pA / total,
    source: odds.provider?.name ?? "bookmaker",
    overround: +(total - 1).toFixed(4),
  };
}

let warned = false;
export function warnOnce(msg: string) {
  if (warned) return;
  warned = true;
  logger.warn({ msg }, "ESPN client warning");
}
