import { getEventSummary, type RawAthlete } from "../lib/espn.js";
import { getTeamSquad, classifyPosition, type LivePlayer, type PlayerPosition } from "./players.js";
import { type LiveMatch } from "./matches.js";
import { teamFromRaw } from "./teams.js";

export interface LineupPlayer {
  id: number;
  name: string;
  position: PlayerPosition;
  positionLabel: string;
  shirtNumber: number | null;
  isStarter: boolean;
  headshotUrl: string | null;
  injured: boolean;
}

export interface LineupData {
  formation: string;
  starting: LineupPlayer[];
  bench: LineupPlayer[];
  source: "official" | "predicted";
}

const FORMATION_DEFAULT = "4-3-3";

function parseFormation(f: string): { def: number; mid: number; fwd: number } {
  const parts = f.split("-").map(Number);
  if (parts.length === 3) {
    const [d = 4, m = 3, w = 3] = parts as [number, number, number];
    return { def: d, mid: m, fwd: w };
  }
  if (parts.length === 4) {
    const [d, m1, m2, w] = parts as [number, number, number, number];
    return { def: d, mid: m1 + m2, fwd: w };
  }
  return { def: 4, mid: 3, fwd: 3 };
}

function toLineupPlayer(p: LivePlayer, isStarter: boolean): LineupPlayer {
  return {
    id: p.id,
    name: p.name,
    position: p.position,
    positionLabel: p.positionLabel,
    shirtNumber: p.shirtNumber,
    isStarter,
    headshotUrl: p.headshotUrl,
    injured: p.injured,
  };
}

function buildPredicted(squad: LivePlayer[], formation: string): LineupData {
  const fit = parseFormation(formation);
  const fitPlayers = squad.filter((p) => !p.injured);
  const gks = fitPlayers.filter((p) => p.position === "GK");
  const defs = fitPlayers.filter((p) => p.position === "DEF");
  const mids = fitPlayers.filter((p) => p.position === "MID");
  const fwds = fitPlayers.filter((p) => p.position === "FWD");
  const starting: LivePlayer[] = [];
  if (gks[0]) starting.push(gks[0]);
  starting.push(...defs.slice(0, fit.def));
  starting.push(...mids.slice(0, fit.mid));
  starting.push(...fwds.slice(0, fit.fwd));
  const startingIds = new Set(starting.map((p) => p.id));
  const bench: LivePlayer[] = [];
  for (const p of [gks[1], ...defs, ...mids, ...fwds]) {
    if (!p || startingIds.has(p.id)) continue;
    bench.push(p);
    if (bench.length >= 9) break;
  }
  return {
    formation,
    starting: starting.map((p) => toLineupPlayer(p, true)),
    bench: bench.map((p) => toLineupPlayer(p, false)),
    source: "predicted",
  };
}

function buildFromRoster(roster: { athlete: RawAthlete; starter?: boolean; position?: { abbreviation: string } }[], teamId: number, formation: string): LineupData {
  const players: LineupPlayer[] = roster.map((r) => ({
    id: Number(r.athlete.id),
    name: r.athlete.fullName ?? r.athlete.displayName ?? `Player ${r.athlete.id}`,
    position: classifyPosition(r.position?.abbreviation ?? r.athlete.position?.abbreviation, r.athlete.position?.name),
    positionLabel: r.athlete.position?.name ?? r.position?.abbreviation ?? "",
    shirtNumber: r.athlete.jersey ? Number(r.athlete.jersey) : null,
    isStarter: !!r.starter,
    headshotUrl: r.athlete.headshot?.href ?? null,
    injured: !!r.athlete.injuries?.length,
  }));
  void teamId;
  const starting = players.filter((p) => p.isStarter);
  const bench = players.filter((p) => !p.isStarter);
  return {
    formation,
    starting,
    bench,
    source: "official",
  };
}

export async function buildLineupFor(match: LiveMatch, side: "home" | "away"): Promise<LineupData> {
  const teamId = side === "home" ? match.homeTeamId : match.awayTeamId;
  const team = side === "home" ? match.homeTeam : match.awayTeam;
  const formation = team.formation || FORMATION_DEFAULT;
  // Try official lineup from summary endpoint (only available shortly before & after kickoff)
  try {
    const sum = await getEventSummary(match.id);
    const r = (sum.rosters ?? []).find((x) => x.homeAway === side);
    if (r?.roster?.length) {
      return buildFromRoster(r.roster, teamId, r.formation || formation);
    }
  } catch {
    // fall through to predicted
  }
  // Predicted: use cached squad
  const squad = await getTeamSquad(teamId);
  return buildPredicted(squad, formation);
}

// ============================================================================
// Match stats — for live or finished matches we read what ESPN provides via the
// summary endpoint (limited; ESPN public API has no boxscore for soccer). For
// upcoming matches we return zeros.
// ============================================================================

export interface MatchStats {
  homePossession: number;
  awayPossession: number;
  homeShots: number;
  awayShots: number;
  homeShotsOnTarget: number;
  awayShotsOnTarget: number;
  homeShotsOffTarget: number;
  awayShotsOffTarget: number;
  homeShotsBlocked: number;
  awayShotsBlocked: number;
  homeCorners: number;
  awayCorners: number;
  homeOffsides: number;
  awayOffsides: number;
  homeFouls: number;
  awayFouls: number;
  homeYellow: number;
  awayYellow: number;
  homeRed: number;
  awayRed: number;
  homeSaves: number;
  awaySaves: number;
  homeXG: number;
  awayXG: number;
  homePassAccuracy: number;
  awayPassAccuracy: number;
}

function emptyStats(): MatchStats {
  return {
    homePossession: 50, awayPossession: 50,
    homeShots: 0, awayShots: 0,
    homeShotsOnTarget: 0, awayShotsOnTarget: 0,
    homeShotsOffTarget: 0, awayShotsOffTarget: 0,
    homeShotsBlocked: 0, awayShotsBlocked: 0,
    homeCorners: 0, awayCorners: 0,
    homeOffsides: 0, awayOffsides: 0,
    homeFouls: 0, awayFouls: 0,
    homeYellow: 0, awayYellow: 0,
    homeRed: 0, awayRed: 0,
    homeSaves: 0, awaySaves: 0,
    homeXG: 0, awayXG: 0,
    homePassAccuracy: 0, awayPassAccuracy: 0,
  };
}

function readStat(comp: { statistics?: { name: string; abbreviation?: string; displayValue?: string; value?: number }[] } | undefined, names: string[]): number {
  for (const n of names) {
    const s = comp?.statistics?.find((x) => x.name === n || x.abbreviation === n);
    if (s) {
      if (typeof s.value === "number") return s.value;
      if (s.displayValue) {
        const cleaned = s.displayValue.replace("%", "");
        const num = Number(cleaned);
        if (!Number.isNaN(num)) return num;
      }
    }
  }
  return 0;
}

export async function getMatchStats(match: LiveMatch): Promise<MatchStats> {
  if (match.status === "upcoming") return emptyStats();
  try {
    const sum = await getEventSummary(match.id);
    const home = sum.header?.competitions?.[0]?.competitors?.find((c) => c.homeAway === "home");
    const away = sum.header?.competitions?.[0]?.competitors?.find((c) => c.homeAway === "away");
    return {
      homePossession: readStat(home, ["possessionPct", "possession"]),
      awayPossession: readStat(away, ["possessionPct", "possession"]),
      homeShots: readStat(home, ["totalShots", "shots"]),
      awayShots: readStat(away, ["totalShots", "shots"]),
      homeShotsOnTarget: readStat(home, ["shotsOnTarget"]),
      awayShotsOnTarget: readStat(away, ["shotsOnTarget"]),
      homeShotsOffTarget: readStat(home, ["shotsOffTarget"]),
      awayShotsOffTarget: readStat(away, ["shotsOffTarget"]),
      homeShotsBlocked: readStat(home, ["blockedShots"]),
      awayShotsBlocked: readStat(away, ["blockedShots"]),
      homeCorners: readStat(home, ["wonCorners", "corners"]),
      awayCorners: readStat(away, ["wonCorners", "corners"]),
      homeOffsides: readStat(home, ["offsides"]),
      awayOffsides: readStat(away, ["offsides"]),
      homeFouls: readStat(home, ["foulsCommitted", "fouls"]),
      awayFouls: readStat(away, ["foulsCommitted", "fouls"]),
      homeYellow: readStat(home, ["yellowCards"]),
      awayYellow: readStat(away, ["yellowCards"]),
      homeRed: readStat(home, ["redCards"]),
      awayRed: readStat(away, ["redCards"]),
      homeSaves: readStat(home, ["saves"]),
      awaySaves: readStat(away, ["saves"]),
      homeXG: 0,
      awayXG: 0,
      homePassAccuracy: readStat(home, ["accuratePasses", "passPctAccurate"]),
      awayPassAccuracy: readStat(away, ["accuratePasses", "passPctAccurate"]),
    };
  } catch {
    return emptyStats();
  }
}

// ============================================================================
// Momentum — derived from key events in the summary if available; otherwise
// returns an empty curve. We never invent fake intensity data.
// ============================================================================
export interface MomentumPoint { minute: number; homeIntensity: number; awayIntensity: number; }

export async function getMatchMomentum(match: LiveMatch): Promise<MomentumPoint[]> {
  if (match.status === "upcoming") return [];
  // Without boxscore data from ESPN soccer, we leave momentum empty rather than
  // synthesising fake data — predictions and stats remain real.
  return [];
}

// ============================================================================
// Match events (goals / cards / subs) — from the summary news/keyEvents, when
// available. For now we surface goals as inferred from H2H and ESPN summary.
// ============================================================================
export interface MatchEvent {
  minute: number;
  type: "goal" | "yellow" | "red" | "sub" | "var";
  teamSide: "home" | "away";
  playerName: string;
  detail?: string;
}

export async function getMatchEvents(match: LiveMatch): Promise<MatchEvent[]> {
  if (match.status === "upcoming") return [];
  // ESPN's soccer summary doesn't expose `keyEvents`; we leave this empty
  // rather than fabricate scorers. The frontend shows the goal counts only.
  void match;
  return [];
}

export interface RefereeStats {
  name: string;
  matches: number;
  avgYellow: number;
  avgRed: number;
  avgFouls: number;
  penaltiesGiven: number;
}

export function refereeStubFromName(name: string): RefereeStats {
  // ESPN doesn't ship per-referee aggregates publicly. We return zeros instead
  // of fabricating; the route still surfaces the referee name when known.
  return { name, matches: 0, avgYellow: 0, avgRed: 0, avgFouls: 0, penaltiesGiven: 0 };
}

// Re-export for compatibility (used by helpers/teams)
export function teamFromRawForLineup(t: Parameters<typeof teamFromRaw>[0]) {
  return teamFromRaw(t);
}
