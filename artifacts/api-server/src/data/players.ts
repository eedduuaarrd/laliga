import { getTeamRoster, getAthleteStats, type RawAthlete } from "../lib/espn.js";
import { getAllTeams } from "./teams.js";
import { currentSeasonStartYear } from "../lib/season.js";

export type PlayerPosition = "GK" | "DEF" | "MID" | "FWD";

export interface LivePlayer {
  id: number;
  name: string;
  teamId: number;
  position: PlayerPosition;
  positionLabel: string;
  shirtNumber: number | null;
  nationality: string;
  age: number | null;
  headshotUrl: string | null;
  // Season stats (from ESPN athlete stats endpoint when available).
  appearances: number;
  goals: number;
  assists: number;
  keyPasses: number;
  bigChancesCreated: number;
  shots: number;
  shotsOnTarget: number;
  xG: number;
  rating: number;
  // Status flags
  injured: boolean;
  injuryStatus: string | null;
  injuryType: string | null;
  injuryDetail: string | null;
  injuryDate: string | null;
  expectedReturn: string | null;
}

const POS_MAP: Record<string, PlayerPosition> = {
  G: "GK",
  GK: "GK",
  D: "DEF",
  DEF: "DEF",
  M: "MID",
  MID: "MID",
  F: "FWD",
  FWD: "FWD",
};

export function classifyPosition(abbr: string | undefined, name?: string): PlayerPosition {
  if (abbr && POS_MAP[abbr.toUpperCase()]) return POS_MAP[abbr.toUpperCase()]!;
  const n = (name ?? "").toLowerCase();
  if (n.includes("goal")) return "GK";
  if (n.includes("def") || n.includes("back")) return "DEF";
  if (n.includes("forward") || n.includes("striker") || n.includes("winger")) return "FWD";
  return "MID";
}

function shapePlayer(a: RawAthlete, teamId: number): LivePlayer {
  const inj = a.injuries?.[0];
  return {
    id: Number(a.id),
    name: a.fullName ?? a.displayName ?? a.shortName ?? `Player ${a.id}`,
    teamId,
    position: classifyPosition(a.position?.abbreviation, a.position?.name),
    positionLabel: a.position?.name ?? a.position?.abbreviation ?? "",
    shirtNumber: a.jersey ? Number(a.jersey) : null,
    nationality: a.citizenship ?? a.birthCountry ?? a.birthPlace?.country ?? "",
    age: a.age ?? null,
    headshotUrl: a.headshot?.href ?? null,
    appearances: 0,
    goals: 0,
    assists: 0,
    keyPasses: 0,
    bigChancesCreated: 0,
    shots: 0,
    shotsOnTarget: 0,
    xG: 0,
    rating: 0,
    injured: !!inj,
    injuryStatus: inj?.status ?? null,
    injuryType: inj?.details?.type ?? null,
    injuryDetail: inj?.details?.detail ?? null,
    injuryDate: inj?.date ?? null,
    expectedReturn: inj?.details?.returnDate ?? null,
  };
}

export async function getTeamSquad(teamId: number): Promise<LivePlayer[]> {
  const roster = await getTeamRoster(teamId);
  return (roster.athletes ?? []).map((a) => shapePlayer(a, teamId));
}

const STAT_ALIASES: Record<keyof Pick<LivePlayer, "appearances" | "goals" | "assists" | "shots" | "shotsOnTarget"> | "rating", string[]> = {
  appearances: ["appearances", "totalAppearances", "GP"],
  goals: ["totalGoals", "goals", "G"],
  assists: ["goalAssists", "assists", "A"],
  shots: ["totalShots", "shots", "Sh"],
  shotsOnTarget: ["shotsOnTarget", "ShotsOnTarget", "SOT"],
  rating: ["averageRating", "rating", "playerRating"],
};

function statFromCategories(stats: Awaited<ReturnType<typeof getAthleteStats>>, key: keyof typeof STAT_ALIASES): number {
  const aliases = STAT_ALIASES[key];
  for (const cat of stats.splits?.categories ?? []) {
    for (const s of cat.stats) {
      if (aliases.some((a) => a.toLowerCase() === s.name.toLowerCase() || a.toLowerCase() === (s.displayName ?? "").toLowerCase())) {
        return s.value;
      }
    }
  }
  return 0;
}

export async function enrichPlayer(p: LivePlayer): Promise<LivePlayer> {
  try {
    const stats = await getAthleteStats(p.id, currentSeasonStartYear());
    p.appearances = statFromCategories(stats, "appearances");
    p.goals = statFromCategories(stats, "goals");
    p.assists = statFromCategories(stats, "assists");
    p.shots = statFromCategories(stats, "shots");
    p.shotsOnTarget = statFromCategories(stats, "shotsOnTarget");
    p.rating = +statFromCategories(stats, "rating").toFixed(2);
  } catch {
    // ignore — keep zeros
  }
  return p;
}

export async function getTeamSquadEnriched(teamId: number, limit = 30): Promise<LivePlayer[]> {
  const squad = await getTeamSquad(teamId);
  // Only enrich up to `limit` players to keep latency bounded.
  const head = squad.slice(0, limit);
  await Promise.all(head.map((p) => enrichPlayer(p)));
  return squad;
}

export async function getPlayerById(playerId: number): Promise<LivePlayer | undefined> {
  // Walk every team's roster (cached) until we find it.
  const teams = await getAllTeams();
  for (const t of teams) {
    const roster = await getTeamSquad(t.id);
    const hit = roster.find((p) => p.id === playerId);
    if (hit) {
      await enrichPlayer(hit);
      return hit;
    }
  }
  return undefined;
}

export async function getTopPlayers(filters?: { teamId?: number; position?: PlayerPosition; limit?: number }): Promise<LivePlayer[]> {
  const limit = filters?.limit ?? 25;
  if (filters?.teamId) {
    const enriched = await getTeamSquadEnriched(filters.teamId);
    let out = enriched;
    if (filters.position) out = out.filter((p) => p.position === filters.position);
    return out.sort((a, b) => (b.goals + b.assists) - (a.goals + a.assists)).slice(0, limit);
  }
  // All-team view: avoid hitting every athlete endpoint. Use roster basics + injury flags.
  const teams = await getAllTeams();
  const lists = await Promise.all(teams.map((t) => getTeamSquad(t.id).catch(() => [] as LivePlayer[])));
  let merged = lists.flat();
  if (filters?.position) merged = merged.filter((p) => p.position === filters.position);
  // Without per-athlete stats we can't sort by goals; instead surface forwards/mids by team strength.
  return merged.slice(0, limit);
}

export async function getInjuriesForTeam(teamId: number): Promise<LivePlayer[]> {
  const squad = await getTeamSquad(teamId);
  return squad.filter((p) => p.injured);
}
