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

function readBoxStat(stats: { name: string; displayValue?: string; label?: string }[] | undefined, names: string[]): number {
  if (!stats) return 0;
  for (const n of names) {
    const s = stats.find((x) => x.name === n);
    if (s?.displayValue) {
      const cleaned = s.displayValue.replace("%", "").trim();
      const num = Number(cleaned);
      if (!Number.isNaN(num)) return num;
    }
  }
  return 0;
}

export async function getMatchStats(match: LiveMatch): Promise<MatchStats> {
  if (match.status === "upcoming") return emptyStats();
  try {
    const sum = await getEventSummary(match.id);
    // ESPN puts soccer team stats in boxscore.teams[].statistics — the order
    // matches scoreboard order but is not guaranteed to be home/away, so
    // match by team.id explicitly.
    const teams = sum.boxscore?.teams ?? [];
    const homeTeam = teams.find((t) => Number(t.team?.id) === match.homeTeamId);
    const awayTeam = teams.find((t) => Number(t.team?.id) === match.awayTeamId);
    const homeS = homeTeam?.statistics;
    const awayS = awayTeam?.statistics;
    // Pass completion: ESPN ships passPct as a fraction (0–1), occasionally as %.
    const passPct = (s: typeof homeS): number => {
      const raw = readBoxStat(s, ["passPct"]);
      return raw > 0 && raw <= 1.5 ? +(raw * 100).toFixed(1) : raw;
    };
    return {
      homePossession: readBoxStat(homeS, ["possessionPct"]),
      awayPossession: readBoxStat(awayS, ["possessionPct"]),
      homeShots: readBoxStat(homeS, ["totalShots"]),
      awayShots: readBoxStat(awayS, ["totalShots"]),
      homeShotsOnTarget: readBoxStat(homeS, ["shotsOnTarget"]),
      awayShotsOnTarget: readBoxStat(awayS, ["shotsOnTarget"]),
      homeShotsOffTarget: Math.max(0, readBoxStat(homeS, ["totalShots"]) - readBoxStat(homeS, ["shotsOnTarget"]) - readBoxStat(homeS, ["blockedShots"])),
      awayShotsOffTarget: Math.max(0, readBoxStat(awayS, ["totalShots"]) - readBoxStat(awayS, ["shotsOnTarget"]) - readBoxStat(awayS, ["blockedShots"])),
      homeShotsBlocked: readBoxStat(homeS, ["blockedShots"]),
      awayShotsBlocked: readBoxStat(awayS, ["blockedShots"]),
      homeCorners: readBoxStat(homeS, ["wonCorners"]),
      awayCorners: readBoxStat(awayS, ["wonCorners"]),
      homeOffsides: readBoxStat(homeS, ["offsides"]),
      awayOffsides: readBoxStat(awayS, ["offsides"]),
      homeFouls: readBoxStat(homeS, ["foulsCommitted"]),
      awayFouls: readBoxStat(awayS, ["foulsCommitted"]),
      homeYellow: readBoxStat(homeS, ["yellowCards"]),
      awayYellow: readBoxStat(awayS, ["yellowCards"]),
      homeRed: readBoxStat(homeS, ["redCards"]),
      awayRed: readBoxStat(awayS, ["redCards"]),
      homeSaves: readBoxStat(homeS, ["saves"]),
      awaySaves: readBoxStat(awayS, ["saves"]),
      homeXG: 0,
      awayXG: 0,
      homePassAccuracy: passPct(homeS),
      awayPassAccuracy: passPct(awayS),
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

// Derive a coarse momentum curve from real key events: each event contributes
// a pulse of intensity to its team, decaying over a 10-minute window.
export async function getMatchMomentum(match: LiveMatch): Promise<MomentumPoint[]> {
  if (match.status === "upcoming") return [];
  const events = await getMatchEvents(match);
  if (events.length === 0) return [];
  const horizon = match.status === "live" && match.minute ? Math.min(95, match.minute + 1) : 95;
  const out: MomentumPoint[] = [];
  for (let m = 0; m <= horizon; m += 5) {
    let home = 0, away = 0;
    for (const e of events) {
      const dt = m - e.minute;
      if (dt < 0) continue;
      const decay = Math.exp(-dt / 10);
      const weight = e.type === "goal" ? 4 : e.type === "red" ? 3 : e.type === "yellow" ? 1.5 : 1;
      if (e.teamSide === "home") home += weight * decay;
      else away += weight * decay;
    }
    out.push({ minute: m, homeIntensity: +home.toFixed(2), awayIntensity: +away.toFixed(2) });
  }
  return out;
}

// ============================================================================
// Match events (goals / cards / subs) — parsed from ESPN's `keyEvents` array.
// ============================================================================
export interface MatchEvent {
  minute: number;
  type: "goal" | "yellow" | "red" | "sub" | "var";
  teamSide: "home" | "away";
  playerName: string;
  detail?: string;
}

function classifyEventType(rawType: string | undefined, scoringPlay: boolean | undefined): MatchEvent["type"] | null {
  const t = (rawType ?? "").toLowerCase();
  if (scoringPlay || t.includes("goal") || t === "penalty-goal" || t === "own-goal") {
    if (t.includes("save") || t.includes("attempt") || t.includes("miss")) return null;
    return "goal";
  }
  if (t.includes("red")) return "red";
  if (t.includes("yellow")) return "yellow";
  if (t.includes("substitution")) return "sub";
  if (t.includes("var")) return "var";
  return null;
}

export async function getMatchEvents(match: LiveMatch): Promise<MatchEvent[]> {
  if (match.status === "upcoming") return [];
  try {
    const sum = await getEventSummary(match.id);
    const raw = sum.keyEvents ?? [];
    const out: MatchEvent[] = [];
    for (const e of raw) {
      const kind = classifyEventType(e.type?.type, e.scoringPlay);
      if (!kind) continue;
      const teamId = e.team?.id ? Number(e.team.id) : null;
      const teamSide: "home" | "away" =
        teamId === match.homeTeamId ? "home" :
        teamId === match.awayTeamId ? "away" : "home";
      const playerName =
        e.participants?.[0]?.athlete?.displayName?.trim() ||
        e.athletesInvolved?.[0]?.displayName?.trim() ||
        "";
      // Minute: prefer displayValue ("39'", "45+2'"), else compute from clock.value (seconds)
      let minute = 0;
      const dv = e.clock?.displayValue;
      if (dv) {
        const m = dv.match(/(\d+)/);
        if (m) minute = Number(m[1]);
      } else if (typeof e.clock?.value === "number") {
        minute = Math.round(e.clock.value / 60);
      }
      // Adjust minute by period (2nd half: + 0, ESPN already counts continuously)
      out.push({
        minute,
        type: kind,
        teamSide,
        playerName: playerName || "—",
        detail: e.text || e.shortText || undefined,
      });
    }
    out.sort((a, b) => a.minute - b.minute);
    return out;
  } catch {
    return [];
  }
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
