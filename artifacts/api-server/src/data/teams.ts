import { getTeamsList, getTeamDetail, type RawTeamRef } from "../lib/espn.js";

export interface LiveTeam {
  id: number;
  name: string;
  shortName: string;
  abbreviation: string;
  city: string;
  founded: number | null;
  stadium: string;
  primaryColor: string;
  secondaryColor: string;
  manager: string;
  formation: string;
  crestUrl: string;
}

// La Liga clubs don't ship founded year / manager / default formation in ESPN's
// public team JSON. We attach a small lookup keyed by ESPN team ID to enrich.
const ENRICHMENT: Record<number, { founded: number; manager: string; formation: string }> = {
  86:   { founded: 1902, manager: "Xabi Alonso",       formation: "4-3-3"   }, // Real Madrid
  83:   { founded: 1899, manager: "Hansi Flick",       formation: "4-2-3-1" }, // Barcelona
  1068: { founded: 1903, manager: "Diego Simeone",     formation: "4-4-2"   }, // Atlético Madrid
  93:   { founded: 1898, manager: "Ernesto Valverde",  formation: "4-2-3-1" }, // Athletic Club
  244:  { founded: 1907, manager: "Manuel Pellegrini", formation: "4-2-3-1" }, // Real Betis
  102:  { founded: 1923, manager: "Marcelino",         formation: "4-4-2"   }, // Villarreal
  89:   { founded: 1909, manager: "Sergio Francisco",  formation: "4-3-3"   }, // Real Sociedad
  243:  { founded: 1890, manager: "Matías Almeyda",    formation: "4-3-3"   }, // Sevilla
  94:   { founded: 1919, manager: "Carlos Corberán",   formation: "4-2-3-1" }, // Valencia
  85:   { founded: 1923, manager: "Claudio Giráldez",  formation: "4-3-3"   }, // Celta Vigo
  2922: { founded: 1983, manager: "José Bordalás",     formation: "5-3-2"   }, // Getafe
  101:  { founded: 1924, manager: "Íñigo Pérez",       formation: "4-2-3-1" }, // Rayo Vallecano
  97:   { founded: 1920, manager: "Alessio Lisci",     formation: "4-3-3"   }, // Osasuna
  84:   { founded: 1916, manager: "Jagoba Arrasate",   formation: "4-4-2"   }, // Mallorca
  88:   { founded: 1900, manager: "Manolo González",   formation: "4-4-2"   }, // Espanyol
  96:   { founded: 1921, manager: "Eduardo Coudet",    formation: "4-2-3-1" }, // Deportivo Alavés
  9812: { founded: 1930, manager: "Míchel",            formation: "4-2-3-1" }, // Girona
  1538: { founded: 1909, manager: "Julián Calero",     formation: "4-2-3-1" }, // Levante
  3751: { founded: 1923, manager: "Eder Sarabia",      formation: "4-2-3-1" }, // Elche
  92:   { founded: 1926, manager: "Veljko Paunović",   formation: "4-4-2"   }, // Real Oviedo
};

export function pickLogo(team: RawTeamRef): string {
  if (team.logo) return team.logo;
  const fromArr = (team.logos ?? []).find((l) => l.rel?.includes("default"))?.href ?? team.logos?.[0]?.href;
  if (fromArr) return fromArr;
  return `https://a.espncdn.com/i/teamlogos/soccer/500/${team.id}.png`;
}

export function teamFromRaw(raw: RawTeamRef): LiveTeam {
  const id = Number(raw.id);
  const enr = ENRICHMENT[id];
  return {
    id,
    name: raw.displayName ?? raw.name ?? raw.shortDisplayName ?? `Team ${id}`,
    shortName: raw.shortDisplayName ?? raw.name ?? raw.abbreviation ?? raw.displayName ?? "",
    abbreviation: raw.abbreviation ?? (raw.shortDisplayName ?? "").slice(0, 3).toUpperCase(),
    city: raw.location ?? raw.venue?.address?.city ?? "",
    founded: enr?.founded ?? null,
    stadium: raw.venue?.fullName ?? "",
    primaryColor: raw.color ? `#${raw.color}` : "#1F2937",
    secondaryColor: raw.alternateColor ? `#${raw.alternateColor}` : "#FFFFFF",
    manager: enr?.manager ?? "",
    formation: enr?.formation ?? "4-3-3",
    crestUrl: pickLogo(raw),
  };
}

export async function getAllTeams(): Promise<LiveTeam[]> {
  const list = await getTeamsList();
  const teams = list.sports?.[0]?.leagues?.[0]?.teams ?? [];
  return teams.map((t) => teamFromRaw(t.team));
}

export async function getTeamById(teamId: number): Promise<LiveTeam | undefined> {
  try {
    const detail = await getTeamDetail(teamId);
    return teamFromRaw(detail.team);
  } catch {
    const all = await getAllTeams();
    return all.find((t) => t.id === teamId);
  }
}

export async function teamMap(): Promise<Map<number, LiveTeam>> {
  const all = await getAllTeams();
  return new Map(all.map((t) => [t.id, t]));
}
