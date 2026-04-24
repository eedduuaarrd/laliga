import { getStandings, type RawStandingsEntry, type RawStandingsGroup } from "../lib/espn.js";
import { teamFromRaw, type LiveTeam } from "./teams.js";
import { currentSeasonStartYear } from "../lib/season.js";

export interface LiveStandingRow {
  position: number;
  teamId: number;
  teamName: string;
  teamShortName: string;
  crestUrl: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  // Home/away splits (from ESPN home/away records when available)
  homeWins: number;
  homeDraws: number;
  homeLosses: number;
  homeGoalsFor: number;
  homeGoalsAgainst: number;
  awayWins: number;
  awayDraws: number;
  awayLosses: number;
  awayGoalsFor: number;
  awayGoalsAgainst: number;
  cleanSheets: number;
  xG: number;
  xGA: number;
  form: ("W" | "D" | "L")[];
}

function statValue(entry: RawStandingsEntry, names: string[]): number {
  for (const n of names) {
    const s = entry.stats.find(
      (st) => st.name === n || st.abbreviation === n || st.type === n,
    );
    if (s && typeof s.value === "number") return s.value;
  }
  return 0;
}
function statString(entry: RawStandingsEntry, names: string[]): string | undefined {
  for (const n of names) {
    const s = entry.stats.find(
      (st) => st.name === n || st.abbreviation === n || st.type === n,
    );
    if (s?.displayValue) return s.displayValue;
  }
  return undefined;
}

function flattenEntries(g: RawStandingsGroup): RawStandingsEntry[] {
  if (g.standings?.entries?.length) return g.standings.entries;
  if (g.children) {
    for (const c of g.children) {
      const e = flattenEntries(c);
      if (e.length) return e;
    }
  }
  return [];
}

function parseRecord(rec: string | undefined): { w: number; d: number; l: number } {
  // ESPN sometimes encodes home/away as "5-1-0" (W-L-D in some sports). For soccer
  // ESPN's stat names "homeWins" etc. are reliable, so we use stat values; this is fallback only.
  if (!rec) return { w: 0, d: 0, l: 0 };
  const m = rec.match(/^(\d+)-(\d+)-(\d+)$/);
  if (!m) return { w: 0, d: 0, l: 0 };
  return { w: Number(m[1]), d: Number(m[2]), l: Number(m[3]) };
}

function parseForm(form: string | undefined): ("W" | "D" | "L")[] {
  if (!form) return [];
  return form.split("").filter((c) => c === "W" || c === "D" || c === "L") as ("W" | "D" | "L")[];
}

function rowFromEntry(entry: RawStandingsEntry): LiveStandingRow {
  const team: LiveTeam = teamFromRaw(entry.team);
  const wins = statValue(entry, ["wins", "W"]);
  const draws = statValue(entry, ["ties", "draws", "D", "T"]);
  const losses = statValue(entry, ["losses", "L"]);
  const played = statValue(entry, ["gamesPlayed", "GP"]);
  const goalsFor = statValue(entry, ["pointsFor", "goalsFor", "GF"]);
  const goalsAgainst = statValue(entry, ["pointsAgainst", "goalsAgainst", "GA"]);
  const points = statValue(entry, ["points", "PTS"]);

  const homeWins = statValue(entry, ["homeWins"]);
  const homeDraws = statValue(entry, ["homeTies"]);
  const homeLosses = statValue(entry, ["homeLosses"]);
  const awayWins = statValue(entry, ["awayWins"]);
  const awayDraws = statValue(entry, ["awayTies"]);
  const awayLosses = statValue(entry, ["awayLosses"]);

  // Some splits aren't returned as stat values; derive partially.
  const homeGoalsFor = statValue(entry, ["homeGoalsFor"]);
  const homeGoalsAgainst = statValue(entry, ["homeGoalsAgainst"]);
  const awayGoalsFor = statValue(entry, ["awayGoalsFor"]);
  const awayGoalsAgainst = statValue(entry, ["awayGoalsAgainst"]);

  const splitsMissing = homeWins + homeDraws + homeLosses + awayWins + awayDraws + awayLosses === 0;
  let hw = homeWins, hd = homeDraws, hl = homeLosses, aw = awayWins, ad = awayDraws, al = awayLosses;
  if (splitsMissing) {
    const home = parseRecord(statString(entry, ["Home", "home"]));
    const away = parseRecord(statString(entry, ["Away", "away"]));
    hw = home.w; hd = home.d; hl = home.l;
    aw = away.w; ad = away.d; al = away.l;
  }

  return {
    position: 0, // filled in after sort
    teamId: team.id,
    teamName: team.name,
    teamShortName: team.shortName,
    crestUrl: team.crestUrl,
    played,
    wins,
    draws,
    losses,
    goalsFor,
    goalsAgainst,
    goalDifference: goalsFor - goalsAgainst,
    points,
    homeWins: hw,
    homeDraws: hd,
    homeLosses: hl,
    homeGoalsFor,
    homeGoalsAgainst,
    awayWins: aw,
    awayDraws: ad,
    awayLosses: al,
    awayGoalsFor,
    awayGoalsAgainst,
    cleanSheets: 0, // ESPN public standings doesn't expose this; left as 0
    xG: 0,
    xGA: 0,
    form: parseForm(statString(entry, ["recentResults", "form", "Streak"])),
  };
}

export async function getStandingsRows(): Promise<LiveStandingRow[]> {
  const data = await getStandings(currentSeasonStartYear());
  const entries = flattenEntries(data);
  const rows = entries.map(rowFromEntry);
  rows.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
    return b.goalsFor - a.goalsFor;
  });
  return rows.map((r, i) => ({ ...r, position: i + 1 }));
}

export async function getTeamStanding(teamId: number): Promise<LiveStandingRow | undefined> {
  const all = await getStandingsRows();
  return all.find((r) => r.teamId === teamId);
}

export async function getTeamFormScore(teamId: number): Promise<number> {
  const row = await getTeamStanding(teamId);
  if (!row || row.form.length === 0) return 1.0;
  const map: Record<string, number> = { W: 3, D: 1, L: 0 };
  const sum = row.form.reduce((a, r) => a + (map[r] ?? 0), 0);
  const max = row.form.length * 3;
  return +(0.6 + (sum / Math.max(1, max)) * 0.8).toFixed(3);
}

export async function getTeamForm(teamId: number): Promise<("W" | "D" | "L")[]> {
  const row = await getTeamStanding(teamId);
  return row?.form ?? [];
}

// Per-game offensive/defensive rate, used by the Poisson model.
export async function getTeamRates(teamId: number): Promise<{
  attackRate: number;
  defenseRate: number;
  homeAdvantage: number;
}> {
  const row = await getTeamStanding(teamId);
  if (!row || row.played === 0) {
    return { attackRate: 1.3, defenseRate: 1.3, homeAdvantage: 1.15 };
  }
  const gp = Math.max(1, row.played);
  return {
    attackRate: +(row.goalsFor / gp).toFixed(3),
    defenseRate: +(row.goalsAgainst / gp).toFixed(3),
    homeAdvantage: 1.15, // standard La Liga home factor (data source doesn't expose this)
  };
}
