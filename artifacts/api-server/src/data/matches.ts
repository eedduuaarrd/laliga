import { TEAMS } from "./teams.js";
import { getTeamSeed } from "./standings.js";

export interface SeedMatch {
  id: number;
  gameweek: number;
  kickoff: string; // ISO
  status: "live" | "upcoming" | "finished";
  minute?: number;
  homeTeamId: number;
  awayTeamId: number;
  homeScore?: number;
  awayScore?: number;
  venue: string;
  referee: string;
}

const REFEREES = [
  "Jesús Gil Manzano",
  "José Luis Munuera Montero",
  "César Soto Grado",
  "Mateo Busquets Ferrer",
  "Ricardo de Burgos Bengoetxea",
  "Juan Martínez Munuera",
  "Guillermo Cuadra Fernández",
  "Pablo González Fuertes",
  "Alejandro Hernández Hernández",
  "Javier Alberola Rojas",
];

// Build a deterministic schedule. We have 12 finished matchdays, 1 live matchday, and several upcoming.
// Today is April 24, 2026. Use a current-feeling timeline.
const TODAY = new Date("2026-04-24T12:00:00Z");

function isoOffset(daysFromToday: number, hour: number, minute = 0): string {
  const d = new Date(TODAY);
  d.setUTCDate(d.getUTCDate() + daysFromToday);
  d.setUTCHours(hour, minute, 0, 0);
  return d.toISOString();
}

function r(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

interface Pairing { home: number; away: number; }

// Curated finished gameweek pairings (12 played) — keep balanced so each team plays each gameweek once.
// We use a circle method to produce a 12-round schedule; team[0..19].
function generateRoundRobin(): Pairing[][] {
  const ids = TEAMS.map((t) => t.id);
  const n = ids.length; // 20
  const rotating = ids.slice(1);
  const rounds: Pairing[][] = [];
  for (let round = 0; round < n - 1; round++) {
    const round_pairs: Pairing[] = [];
    const arr = [ids[0]!, ...rotating];
    for (let i = 0; i < n / 2; i++) {
      const home = arr[i]!;
      const away = arr[n - 1 - i]!;
      // alternate venue
      if ((round + i) % 2 === 0) round_pairs.push({ home, away });
      else round_pairs.push({ home: away, away: home });
    }
    rounds.push(round_pairs);
    // rotate
    rotating.unshift(rotating.pop()!);
  }
  return rounds;
}

function determineScore(homeId: number, awayId: number, seed: number): { home: number; away: number } {
  const h = getTeamSeed(homeId);
  const a = getTeamSeed(awayId);
  const rng = r(seed);
  const lambdaH = h.attackStrength * (1.4 / a.defenseStrength) * h.homeAdvantage;
  const lambdaA = a.attackStrength * (1.2 / h.defenseStrength);
  // poisson sampler via inverse transform
  const samplePoisson = (lambda: number) => {
    const L = Math.exp(-lambda);
    let k = 0;
    let p = 1;
    do {
      k++;
      p *= rng();
    } while (p > L);
    return k - 1;
  };
  return { home: Math.min(samplePoisson(lambdaH), 6), away: Math.min(samplePoisson(lambdaA), 6) };
}

const ROUNDS = generateRoundRobin();

export const MATCHES: SeedMatch[] = (() => {
  const out: SeedMatch[] = [];
  let id = 1;
  // Finished: gameweeks 1..12 (~12 weeks ago to ~3 days ago)
  for (let gw = 1; gw <= 12; gw++) {
    const round = ROUNDS[(gw - 1) % ROUNDS.length]!;
    const daysAgo = (12 - gw) * 7 + 3;
    round.forEach((p, idx) => {
      const score = determineScore(p.home, p.away, gw * 1000 + idx + 17);
      out.push({
        id: id++,
        gameweek: gw,
        kickoff: isoOffset(-daysAgo, 19 + (idx % 3), idx % 2 === 0 ? 0 : 30),
        status: "finished",
        homeTeamId: p.home,
        awayTeamId: p.away,
        homeScore: score.home,
        awayScore: score.away,
        venue: getTeamSeed(p.home).stadium,
        referee: REFEREES[(gw + idx) % REFEREES.length]!,
      });
    });
  }

  // Live: gameweek 13 — 5 matches today, 2 of them in progress
  const round13 = ROUNDS[12 % ROUNDS.length]!;
  round13.forEach((p, idx) => {
    let status: SeedMatch["status"] = "upcoming";
    let kickoff = isoOffset(0, 18 + (idx % 4), idx % 2 === 0 ? 0 : 30);
    let minute: number | undefined;
    let homeScore: number | undefined;
    let awayScore: number | undefined;
    if (idx === 0) {
      // first match: live, 67th minute
      status = "live";
      kickoff = isoOffset(0, 11, 0);
      minute = 67;
      const sc = determineScore(p.home, p.away, 13000 + idx + 99);
      homeScore = sc.home;
      awayScore = sc.away;
    } else if (idx === 1) {
      // second match: live, 32nd minute
      status = "live";
      kickoff = isoOffset(0, 11, 30);
      minute = 32;
      const sc = determineScore(p.home, p.away, 13100 + idx + 11);
      homeScore = Math.max(0, sc.home - 1);
      awayScore = Math.max(0, sc.away - 1);
    } else if (idx <= 4) {
      // upcoming today
      kickoff = isoOffset(0, 16 + idx * 2, 0);
    }
    out.push({
      id: id++,
      gameweek: 13,
      kickoff,
      status,
      minute,
      homeTeamId: p.home,
      awayTeamId: p.away,
      homeScore,
      awayScore,
      venue: getTeamSeed(p.home).stadium,
      referee: REFEREES[(13 + idx) % REFEREES.length]!,
    });
  });

  // Upcoming gameweeks 14..16
  for (let gw = 14; gw <= 16; gw++) {
    const round = ROUNDS[(gw - 1) % ROUNDS.length]!;
    const daysFromNow = (gw - 13) * 7;
    round.forEach((p, idx) => {
      out.push({
        id: id++,
        gameweek: gw,
        kickoff: isoOffset(daysFromNow + Math.floor(idx / 4), 18 + (idx % 4), idx % 2 === 0 ? 0 : 30),
        status: "upcoming",
        homeTeamId: p.home,
        awayTeamId: p.away,
        venue: getTeamSeed(p.home).stadium,
        referee: REFEREES[(gw + idx) % REFEREES.length]!,
      });
    });
  }
  return out;
})();

export function getCurrentGameweek(): number {
  return 13;
}

export function getMatchById(id: number): SeedMatch | undefined {
  return MATCHES.find((m) => m.id === id);
}

export function getH2HMatches(homeTeamId: number, awayTeamId: number): SeedMatch[] {
  return MATCHES.filter((m) => m.status === "finished" && (
    (m.homeTeamId === homeTeamId && m.awayTeamId === awayTeamId) ||
    (m.homeTeamId === awayTeamId && m.awayTeamId === homeTeamId)
  ));
}
