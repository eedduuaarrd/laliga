import {
  getScoreboardRange,
  getEventSummary,
  type RawScoreboardEvent,
  type RawCompetitor,
} from "../lib/espn.js";
import { LEAGUES, getLeague, DEFAULT_LEAGUE, type League } from "../lib/leagues.js";
import { teamFromRaw, type LiveTeam } from "./teams.js";

export interface LiveMatch {
  id: number;
  gameweek: number;
  kickoff: string; // ISO
  status: "live" | "upcoming" | "finished";
  statusDetail: string;
  minute: number | null;
  homeTeamId: number;
  awayTeamId: number;
  homeTeam: LiveTeam;
  awayTeam: LiveTeam;
  homeScore: number | null;
  awayScore: number | null;
  venue: string;
  referee: string;
  // League this match belongs to (carried through every downstream call so
  // ESPN endpoints can be hit with the correct slug).
  leagueCode: string;
  league: League;
}

function inferStatus(ev: RawScoreboardEvent): { status: "live" | "upcoming" | "finished"; minute: number | null; detail: string } {
  const t = ev.status?.type ?? ev.competitions?.[0]?.status?.type;
  const detail = t?.shortDetail ?? t?.description ?? "";
  if (!t) return { status: "upcoming", minute: null, detail };
  if (t.completed) return { status: "finished", minute: 90, detail };
  if (t.state === "in") {
    const minute = ev.status?.period ? Math.max(1, Math.round((ev.status?.clock ?? 0) / 60)) : null;
    return { status: "live", minute, detail };
  }
  return { status: "upcoming", minute: null, detail };
}

function pick(c: RawCompetitor[] | undefined, side: "home" | "away"): RawCompetitor | undefined {
  return (c ?? []).find((x) => x.homeAway === side);
}

function eventToMatch(ev: RawScoreboardEvent, leagueCode: string): LiveMatch | null {
  const comp = ev.competitions?.[0];
  if (!comp) return null;
  const home = pick(comp.competitors, "home");
  const away = pick(comp.competitors, "away");
  if (!home || !away) return null;
  const { status, minute, detail } = inferStatus(ev);
  return {
    id: Number(ev.id),
    gameweek: ev.week?.number ?? 0,
    kickoff: ev.date,
    status,
    statusDetail: detail,
    minute,
    homeTeamId: Number(home.team.id),
    awayTeamId: Number(away.team.id),
    homeTeam: teamFromRaw(home.team),
    awayTeam: teamFromRaw(away.team),
    homeScore: home.score != null ? Number(home.score) : null,
    awayScore: away.score != null ? Number(away.score) : null,
    venue: comp.venue?.fullName ?? "",
    referee: "", // referees come from summary endpoint, not scoreboard
    leagueCode,
    league: getLeague(leagueCode),
  };
}

function daysBack(from: Date, days: number): Date {
  const d = new Date(from);
  d.setUTCDate(d.getUTCDate() - days);
  return d;
}
function daysAhead(from: Date, days: number): Date {
  const d = new Date(from);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

// Default rolling window: last 14 days through next 30 days. Most leagues
// run weekly, so this covers the next 4–5 fixtures plus the last full week.
const PAST_DAYS = 14;
const FUTURE_DAYS = 30;

export async function getAllMatches(now: Date = new Date()): Promise<LiveMatch[]> {
  const start = daysBack(now, PAST_DAYS);
  const end = daysAhead(now, FUTURE_DAYS);

  // Pull every league in parallel; tolerate per-league failures so one bad
  // endpoint doesn't blank out the whole board.
  const perLeague = await Promise.all(
    LEAGUES.map(async (lg) => {
      try {
        const range = await getScoreboardRange(start, end, lg.code);
        const out: LiveMatch[] = [];
        for (const ev of range.events ?? []) {
          const m = eventToMatch(ev, lg.code);
          if (m) out.push(m);
        }
        return out;
      } catch {
        return [] as LiveMatch[];
      }
    }),
  );

  // De-duplicate by event id (some UEFA events appear in both the
  // continental and domestic feeds).
  const byId = new Map<number, LiveMatch>();
  for (const list of perLeague) {
    for (const m of list) {
      const existing = byId.get(m.id);
      if (!existing) {
        byId.set(m.id, m);
        continue;
      }
      // Prefer the higher-tier league when conflicts arise.
      if (m.league.tier < existing.league.tier) byId.set(m.id, m);
    }
  }
  const out = Array.from(byId.values());
  out.sort((a, b) => a.kickoff.localeCompare(b.kickoff));
  return out;
}

export async function getMatchesByStatus(status?: "live" | "upcoming" | "finished" | "all"): Promise<LiveMatch[]> {
  const all = await getAllMatches();
  if (!status || status === "all") return all;
  return all.filter((m) => m.status === status);
}

export async function getMatchesByGameweek(gw: number): Promise<LiveMatch[]> {
  const all = await getAllMatches();
  return all.filter((m) => m.gameweek === gw);
}

export async function getMatchById(id: number): Promise<LiveMatch | undefined> {
  // Try the rolling window first.
  const all = await getAllMatches();
  const m = all.find((x) => x.id === id);
  if (m) return m;
  // Fall back to the summary endpoint, trying each league until we hit one
  // that returns a real payload.
  for (const lg of LEAGUES) {
    try {
      const sum = await getEventSummary(id, lg.code);
      const comp = sum.header?.competitions?.[0];
      if (!comp) continue;
      const home = pick(comp.competitors, "home");
      const away = pick(comp.competitors, "away");
      if (!home || !away) continue;
      const stType = comp.status?.type;
      const status: "live" | "upcoming" | "finished" =
        stType?.completed ? "finished" : stType?.state === "in" ? "live" : "upcoming";
      return {
        id,
        gameweek: 0,
        kickoff: comp.date,
        status,
        statusDetail: stType?.shortDetail ?? "",
        minute: stType?.state === "in" ? null : null,
        homeTeamId: Number(home.team.id),
        awayTeamId: Number(away.team.id),
        homeTeam: teamFromRaw(home.team),
        awayTeam: teamFromRaw(away.team),
        homeScore: home.score != null ? Number(home.score) : null,
        awayScore: away.score != null ? Number(away.score) : null,
        venue: comp.venue?.fullName ?? "",
        referee: sum.gameInfo?.officials?.find((o) => o.position?.name?.toLowerCase().includes("center"))?.fullName ?? "",
        leagueCode: lg.code,
        league: lg,
      };
    } catch {
      // try next league
    }
  }
  // Last-resort: use La Liga blind.
  try {
    const sum = await getEventSummary(id, DEFAULT_LEAGUE);
    const comp = sum.header?.competitions?.[0];
    if (!comp) return undefined;
    const home = pick(comp.competitors, "home");
    const away = pick(comp.competitors, "away");
    if (!home || !away) return undefined;
    const stType = comp.status?.type;
    const status: "live" | "upcoming" | "finished" =
      stType?.completed ? "finished" : stType?.state === "in" ? "live" : "upcoming";
    return {
      id,
      gameweek: 0,
      kickoff: comp.date,
      status,
      statusDetail: stType?.shortDetail ?? "",
      minute: null,
      homeTeamId: Number(home.team.id),
      awayTeamId: Number(away.team.id),
      homeTeam: teamFromRaw(home.team),
      awayTeam: teamFromRaw(away.team),
      homeScore: home.score != null ? Number(home.score) : null,
      awayScore: away.score != null ? Number(away.score) : null,
      venue: comp.venue?.fullName ?? "",
      referee: sum.gameInfo?.officials?.find((o) => o.position?.name?.toLowerCase().includes("center"))?.fullName ?? "",
      leagueCode: DEFAULT_LEAGUE,
      league: getLeague(DEFAULT_LEAGUE),
    };
  } catch {
    return undefined;
  }
}

export async function getH2HMatches(homeTeamId: number, awayTeamId: number): Promise<LiveMatch[]> {
  const window = await getAllMatches();
  return window.filter(
    (m) =>
      m.status === "finished" &&
      ((m.homeTeamId === homeTeamId && m.awayTeamId === awayTeamId) ||
       (m.homeTeamId === awayTeamId && m.awayTeamId === homeTeamId)),
  );
}

export async function getCurrentGameweek(): Promise<number> {
  const all = await getAllMatches();
  const now = Date.now();
  const today = all.filter((m) => Math.abs(new Date(m.kickoff).getTime() - now) < 24 * 3600 * 1000);
  if (today.length) return today[0]!.gameweek || 1;
  const next = all.find((m) => m.status === "upcoming");
  return next?.gameweek ?? 1;
}
