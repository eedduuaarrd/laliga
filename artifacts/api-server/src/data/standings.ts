import { TEAMS, type SeedTeam, buildCrestUrl } from "./teams.js";

export interface StandingSeed {
  teamId: number;
  played: number;
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

// Hand-crafted realistic 2025-26 La Liga standings (12 matchdays played)
const RAW: StandingSeed[] = [
  { teamId: 2, played: 12, homeWins: 5, homeDraws: 1, homeLosses: 0, homeGoalsFor: 19, homeGoalsAgainst: 6, awayWins: 4, awayDraws: 1, awayLosses: 1, awayGoalsFor: 14, awayGoalsAgainst: 7, cleanSheets: 4, xG: 28.4, xGA: 11.2, form: ["W","W","D","W","W"] },
  { teamId: 1, played: 12, homeWins: 5, homeDraws: 0, homeLosses: 1, homeGoalsFor: 17, homeGoalsAgainst: 6, awayWins: 4, awayDraws: 1, awayLosses: 1, awayGoalsFor: 13, awayGoalsAgainst: 8, cleanSheets: 5, xG: 26.1, xGA: 12.4, form: ["W","W","W","L","W"] },
  { teamId: 3, played: 12, homeWins: 4, homeDraws: 2, homeLosses: 0, homeGoalsFor: 14, homeGoalsAgainst: 5, awayWins: 3, awayDraws: 2, awayLosses: 1, awayGoalsFor: 10, awayGoalsAgainst: 7, cleanSheets: 6, xG: 21.6, xGA: 10.1, form: ["W","D","W","W","D"] },
  { teamId: 6, played: 12, homeWins: 4, homeDraws: 1, homeLosses: 1, homeGoalsFor: 13, homeGoalsAgainst: 7, awayWins: 3, awayDraws: 1, awayLosses: 2, awayGoalsFor: 9, awayGoalsAgainst: 8, cleanSheets: 4, xG: 19.2, xGA: 13.0, form: ["W","W","L","W","D"] },
  { teamId: 4, played: 12, homeWins: 4, homeDraws: 2, homeLosses: 0, homeGoalsFor: 12, homeGoalsAgainst: 5, awayWins: 2, awayDraws: 2, awayLosses: 2, awayGoalsFor: 7, awayGoalsAgainst: 7, cleanSheets: 5, xG: 17.5, xGA: 11.4, form: ["D","W","W","D","W"] },
  { teamId: 5, played: 12, homeWins: 3, homeDraws: 2, homeLosses: 1, homeGoalsFor: 11, homeGoalsAgainst: 7, awayWins: 3, awayDraws: 1, awayLosses: 2, awayGoalsFor: 9, awayGoalsAgainst: 9, cleanSheets: 3, xG: 17.1, xGA: 14.6, form: ["W","D","W","L","W"] },
  { teamId: 10, played: 12, homeWins: 3, homeDraws: 1, homeLosses: 2, homeGoalsFor: 12, homeGoalsAgainst: 9, awayWins: 3, awayDraws: 1, awayLosses: 2, awayGoalsFor: 10, awayGoalsAgainst: 9, cleanSheets: 2, xG: 18.0, xGA: 15.4, form: ["W","L","W","W","D"] },
  { teamId: 7, played: 12, homeWins: 3, homeDraws: 2, homeLosses: 1, homeGoalsFor: 10, homeGoalsAgainst: 6, awayWins: 2, awayDraws: 3, awayLosses: 1, awayGoalsFor: 8, awayGoalsAgainst: 8, cleanSheets: 4, xG: 15.8, xGA: 13.1, form: ["D","W","W","D","D"] },
  { teamId: 12, played: 12, homeWins: 3, homeDraws: 2, homeLosses: 1, homeGoalsFor: 10, homeGoalsAgainst: 7, awayWins: 2, awayDraws: 2, awayLosses: 2, awayGoalsFor: 7, awayGoalsAgainst: 9, cleanSheets: 3, xG: 14.6, xGA: 14.8, form: ["W","D","L","W","W"] },
  { teamId: 13, played: 12, homeWins: 3, homeDraws: 2, homeLosses: 1, homeGoalsFor: 8, homeGoalsAgainst: 5, awayWins: 1, awayDraws: 4, awayLosses: 1, awayGoalsFor: 6, awayGoalsAgainst: 7, cleanSheets: 4, xG: 12.6, xGA: 13.2, form: ["D","W","D","D","W"] },
  { teamId: 11, played: 12, homeWins: 3, homeDraws: 1, homeLosses: 2, homeGoalsFor: 7, homeGoalsAgainst: 6, awayWins: 1, awayDraws: 4, awayLosses: 1, awayGoalsFor: 5, awayGoalsAgainst: 6, cleanSheets: 5, xG: 10.8, xGA: 12.0, form: ["L","D","W","D","D"] },
  { teamId: 8, played: 12, homeWins: 2, homeDraws: 3, homeLosses: 1, homeGoalsFor: 8, homeGoalsAgainst: 7, awayWins: 2, awayDraws: 1, awayLosses: 3, awayGoalsFor: 7, awayGoalsAgainst: 11, cleanSheets: 3, xG: 14.2, xGA: 17.0, form: ["L","D","W","D","L"] },
  { teamId: 17, played: 12, homeWins: 2, homeDraws: 2, homeLosses: 2, homeGoalsFor: 8, homeGoalsAgainst: 8, awayWins: 2, awayDraws: 2, awayLosses: 2, awayGoalsFor: 7, awayGoalsAgainst: 10, cleanSheets: 3, xG: 13.6, xGA: 17.1, form: ["W","L","D","W","L"] },
  { teamId: 9, played: 12, homeWins: 2, homeDraws: 2, homeLosses: 2, homeGoalsFor: 7, homeGoalsAgainst: 8, awayWins: 1, awayDraws: 3, awayLosses: 2, awayGoalsFor: 6, awayGoalsAgainst: 9, cleanSheets: 2, xG: 11.6, xGA: 16.0, form: ["D","D","L","W","L"] },
  { teamId: 15, played: 12, homeWins: 2, homeDraws: 2, homeLosses: 2, homeGoalsFor: 7, homeGoalsAgainst: 8, awayWins: 1, awayDraws: 3, awayLosses: 2, awayGoalsFor: 6, awayGoalsAgainst: 10, cleanSheets: 2, xG: 12.6, xGA: 16.5, form: ["L","W","D","L","D"] },
  { teamId: 16, played: 12, homeWins: 2, homeDraws: 2, homeLosses: 2, homeGoalsFor: 6, homeGoalsAgainst: 7, awayWins: 1, awayDraws: 2, awayLosses: 3, awayGoalsFor: 5, awayGoalsAgainst: 10, cleanSheets: 4, xG: 11.2, xGA: 16.4, form: ["D","L","W","L","D"] },
  { teamId: 14, played: 12, homeWins: 1, homeDraws: 3, homeLosses: 2, homeGoalsFor: 6, homeGoalsAgainst: 8, awayWins: 1, awayDraws: 2, awayLosses: 3, awayGoalsFor: 5, awayGoalsAgainst: 11, cleanSheets: 2, xG: 10.4, xGA: 17.8, form: ["L","D","L","D","W"] },
  { teamId: 18, played: 12, homeWins: 2, homeDraws: 1, homeLosses: 3, homeGoalsFor: 6, homeGoalsAgainst: 9, awayWins: 1, awayDraws: 2, awayLosses: 3, awayGoalsFor: 5, awayGoalsAgainst: 12, cleanSheets: 2, xG: 11.0, xGA: 19.2, form: ["L","L","D","W","L"] },
  { teamId: 19, played: 12, homeWins: 1, homeDraws: 3, homeLosses: 2, homeGoalsFor: 5, homeGoalsAgainst: 8, awayWins: 1, awayDraws: 2, awayLosses: 3, awayGoalsFor: 4, awayGoalsAgainst: 11, cleanSheets: 1, xG: 9.2, xGA: 18.6, form: ["D","L","D","L","D"] },
  { teamId: 20, played: 12, homeWins: 1, homeDraws: 2, homeLosses: 3, homeGoalsFor: 5, homeGoalsAgainst: 10, awayWins: 0, awayDraws: 2, awayLosses: 4, awayGoalsFor: 3, awayGoalsAgainst: 13, cleanSheets: 1, xG: 8.4, xGA: 21.5, form: ["L","L","D","L","L"] },
];

export function getStandingsRows() {
  const enriched = RAW.map((s) => {
    const team = TEAMS.find((t) => t.id === s.teamId)!;
    const wins = s.homeWins + s.awayWins;
    const draws = s.homeDraws + s.awayDraws;
    const losses = s.homeLosses + s.awayLosses;
    const goalsFor = s.homeGoalsFor + s.awayGoalsFor;
    const goalsAgainst = s.homeGoalsAgainst + s.awayGoalsAgainst;
    const points = wins * 3 + draws;
    return {
      teamId: s.teamId,
      teamName: team.name,
      teamShortName: team.shortName,
      crestUrl: buildCrestUrl(team),
      played: s.played,
      wins,
      draws,
      losses,
      goalsFor,
      goalsAgainst,
      goalDifference: goalsFor - goalsAgainst,
      points,
      homeWins: s.homeWins,
      homeDraws: s.homeDraws,
      homeLosses: s.homeLosses,
      homeGoalsFor: s.homeGoalsFor,
      homeGoalsAgainst: s.homeGoalsAgainst,
      awayWins: s.awayWins,
      awayDraws: s.awayDraws,
      awayLosses: s.awayLosses,
      awayGoalsFor: s.awayGoalsFor,
      awayGoalsAgainst: s.awayGoalsAgainst,
      cleanSheets: s.cleanSheets,
      xG: s.xG,
      xGA: s.xGA,
      form: s.form,
    };
  });
  enriched.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
    return b.goalsFor - a.goalsFor;
  });
  return enriched.map((row, i) => ({ position: i + 1, ...row }));
}

export function getTeamStanding(teamId: number) {
  const all = getStandingsRows();
  return all.find((r) => r.teamId === teamId);
}

export function getTeamFormScore(teamId: number): number {
  const seed = RAW.find((s) => s.teamId === teamId);
  if (!seed) return 1.0;
  const map: Record<string, number> = { W: 3, D: 1, L: 0 };
  const sum = seed.form.reduce((acc, r) => acc + map[r], 0);
  // Normalize 0..15 -> 0.6..1.4
  return +(0.6 + (sum / 15) * 0.8).toFixed(3);
}

export function getTeamForm(teamId: number): ("W"|"D"|"L")[] {
  const seed = RAW.find((s) => s.teamId === teamId);
  return seed?.form ?? ["D","D","D","D","D"];
}

export function getTeamSeed(teamId: number): SeedTeam {
  return TEAMS.find((t) => t.id === teamId)!;
}
