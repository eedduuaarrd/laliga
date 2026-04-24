import { type SeedMatch } from "./matches.js";
import { PLAYERS, type SeedPlayer } from "./players.js";
import { getTeamSeed } from "./standings.js";
import { getTeamInjuries } from "./injuries.js";

export interface LineupData {
  formation: string;
  starting: SeedPlayer[];
  bench: SeedPlayer[];
}

export function buildLineup(teamId: number): LineupData {
  const team = getTeamSeed(teamId);
  const injured = new Set(getTeamInjuries(teamId).map((i) => i.playerId));
  const squad = PLAYERS.filter((p) => p.teamId === teamId && !injured.has(p.id));
  const formation = team.formation;
  // Parse formation like "4-3-3" -> defenders, mids, forwards
  const parts = formation.split("-").map(Number);
  let defenders = 4;
  let mids = 3;
  let fwds = 3;
  if (parts.length === 3) {
    [defenders = 4, mids = 3, fwds = 3] = parts as [number, number, number];
  } else if (parts.length === 4) {
    // 4-2-3-1 etc — collapse
    const [d, m1, m2, f] = parts as [number, number, number, number];
    defenders = d;
    mids = m1 + m2;
    fwds = f;
  }
  const goalkeepers = squad.filter((p) => p.position === "GK");
  const defs = squad.filter((p) => p.position === "DEF").sort((a, b) => b.rating - a.rating);
  const m = squad.filter((p) => p.position === "MID").sort((a, b) => b.rating - a.rating);
  const f = squad.filter((p) => p.position === "FWD").sort((a, b) => b.rating - a.rating);
  const starting: SeedPlayer[] = [];
  if (goalkeepers[0]) starting.push(goalkeepers[0]);
  starting.push(...defs.slice(0, defenders));
  starting.push(...m.slice(0, mids));
  starting.push(...f.slice(0, fwds));
  // Bench: 7 reserves
  const startingIds = new Set(starting.map((p) => p.id));
  const bench: SeedPlayer[] = [];
  if (goalkeepers[1]) bench.push(goalkeepers[1]);
  for (const p of [...defs, ...m, ...f]) {
    if (bench.length >= 7) break;
    if (!startingIds.has(p.id)) bench.push(p);
  }
  return { formation, starting, bench };
}

export function buildMatchStats(match: SeedMatch) {
  // For finished/live matches build realistic stats. For upcoming, return zeros.
  const home = getTeamSeed(match.homeTeamId);
  const away = getTeamSeed(match.awayTeamId);
  const r = (n: number) => {
    let s = (match.id * 1009 + n * 17) >>> 0;
    s = (s * 1664525 + 1013904223) >>> 0;
    return (s / 0xffffffff);
  };
  if (match.status === "upcoming") {
    return zeros();
  }
  const minutePct = (match.status === "live" && match.minute) ? Math.min(1, match.minute / 90) : 1;
  const possBase = 50 + Math.round((home.attackStrength - away.attackStrength) * 6);
  const homePoss = Math.max(35, Math.min(70, possBase + Math.round((r(1) - 0.5) * 10)));
  const awayPoss = 100 - homePoss;
  const homeShots = Math.round((10 + home.attackStrength * 5 + r(2) * 6) * minutePct);
  const awayShots = Math.round((8 + away.attackStrength * 5 + r(3) * 5) * minutePct);
  const homeOnT = Math.min(homeShots, Math.round(homeShots * (0.35 + r(4) * 0.2)));
  const awayOnT = Math.min(awayShots, Math.round(awayShots * (0.35 + r(5) * 0.2)));
  const homeBlocked = Math.min(homeShots - homeOnT, Math.round(homeShots * 0.2));
  const awayBlocked = Math.min(awayShots - awayOnT, Math.round(awayShots * 0.2));
  const homeOffT = Math.max(0, homeShots - homeOnT - homeBlocked);
  const awayOffT = Math.max(0, awayShots - awayOnT - awayBlocked);
  return {
    homePossession: homePoss,
    awayPossession: awayPoss,
    homeShots,
    awayShots,
    homeShotsOnTarget: homeOnT,
    awayShotsOnTarget: awayOnT,
    homeShotsOffTarget: homeOffT,
    awayShotsOffTarget: awayOffT,
    homeShotsBlocked: homeBlocked,
    awayShotsBlocked: awayBlocked,
    homeCorners: Math.round((4 + r(6) * 6) * minutePct),
    awayCorners: Math.round((3 + r(7) * 6) * minutePct),
    homeOffsides: Math.round((1 + r(8) * 4) * minutePct),
    awayOffsides: Math.round((1 + r(9) * 4) * minutePct),
    homeFouls: Math.round((8 + r(10) * 8) * minutePct),
    awayFouls: Math.round((9 + r(11) * 8) * minutePct),
    homeYellow: Math.round((1 + r(12) * 3) * minutePct),
    awayYellow: Math.round((1 + r(13) * 3) * minutePct),
    homeRed: r(14) > 0.92 ? 1 : 0,
    awayRed: r(15) > 0.94 ? 1 : 0,
    homeSaves: awayOnT - (match.awayScore ?? Math.round(awayOnT * 0.3)),
    awaySaves: Math.max(0, homeOnT - (match.homeScore ?? Math.round(homeOnT * 0.3))),
    homeXG: +(home.attackStrength * 1.2 + r(16) * 0.8).toFixed(2),
    awayXG: +(away.attackStrength * 1.0 + r(17) * 0.8).toFixed(2),
    homePassAccuracy: Math.round(75 + home.attackStrength * 5 + r(18) * 5),
    awayPassAccuracy: Math.round(75 + away.attackStrength * 5 + r(19) * 5),
  };
}

function zeros() {
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

export function buildMomentum(match: SeedMatch) {
  const r = (n: number) => {
    let s = (match.id * 7919 + n * 23) >>> 0;
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
  const home = getTeamSeed(match.homeTeamId);
  const away = getTeamSeed(match.awayTeamId);
  const totalMins = match.status === "live" ? (match.minute ?? 0) : 90;
  const out: { minute: number; homeIntensity: number; awayIntensity: number }[] = [];
  let h = 50;
  let a = 50;
  for (let min = 0; min <= totalMins; min += 5) {
    h += (r(min + 1) - 0.5) * 25 + (home.attackStrength - 1.3) * 3;
    a += (r(min + 2) - 0.5) * 25 + (away.attackStrength - 1.3) * 3;
    h = Math.max(5, Math.min(100, h));
    a = Math.max(5, Math.min(100, a));
    out.push({ minute: min, homeIntensity: +h.toFixed(1), awayIntensity: +a.toFixed(1) });
  }
  return out;
}

export function buildEvents(match: SeedMatch) {
  if (match.status === "upcoming") return [];
  const homeSquad = PLAYERS.filter((p) => p.teamId === match.homeTeamId).sort((a, b) => b.rating - a.rating);
  const awaySquad = PLAYERS.filter((p) => p.teamId === match.awayTeamId).sort((a, b) => b.rating - a.rating);
  const r = (n: number) => {
    let s = (match.id * 4001 + n * 11) >>> 0;
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
  const events: { minute: number; type: "goal"|"yellow"|"red"|"sub"|"var"; teamSide: "home"|"away"; playerName: string; detail?: string }[] = [];
  const totalMins = match.status === "live" ? (match.minute ?? 0) : 90;
  // Goals
  for (let g = 0; g < (match.homeScore ?? 0); g++) {
    const minute = Math.floor(r(g + 1) * totalMins) + 1;
    const scorer = homeSquad[g % Math.min(5, homeSquad.length)]!;
    events.push({ minute, type: "goal", teamSide: "home", playerName: scorer.name });
  }
  for (let g = 0; g < (match.awayScore ?? 0); g++) {
    const minute = Math.floor(r(g + 11) * totalMins) + 1;
    const scorer = awaySquad[g % Math.min(5, awaySquad.length)]!;
    events.push({ minute, type: "goal", teamSide: "away", playerName: scorer.name });
  }
  // Yellow cards
  const yellowCount = Math.floor(r(50) * 4) + 1;
  for (let i = 0; i < yellowCount; i++) {
    const side = r(60 + i) > 0.5 ? "home" : "away";
    const squad = side === "home" ? homeSquad : awaySquad;
    const player = squad[Math.floor(r(70 + i) * Math.min(11, squad.length))]!;
    events.push({ minute: Math.floor(r(80 + i) * totalMins) + 1, type: "yellow", teamSide: side, playerName: player.name });
  }
  // Subs (only if past minute 60 or finished)
  if (totalMins >= 60) {
    for (let i = 0; i < 2; i++) {
      const side = i === 0 ? "home" : "away";
      const squad = side === "home" ? homeSquad : awaySquad;
      events.push({ minute: 60 + Math.floor(r(100 + i) * 25), type: "sub", teamSide: side, playerName: squad[10 + i % 5]?.name ?? "Substitute" });
    }
  }
  events.sort((a, b) => a.minute - b.minute);
  return events;
}

export function getRefereeStats(name: string) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const r = (n: number) => {
    let s = (h + n * 13) >>> 0;
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
  return {
    name,
    matches: 12 + Math.floor(r(1) * 14),
    avgYellow: +(3.2 + r(2) * 1.6).toFixed(2),
    avgRed: +(0.10 + r(3) * 0.18).toFixed(2),
    avgFouls: +(20 + r(4) * 8).toFixed(1),
    penaltiesGiven: 1 + Math.floor(r(5) * 5),
  };
}
