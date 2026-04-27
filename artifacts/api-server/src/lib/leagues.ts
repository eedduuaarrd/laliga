// Central registry of supported soccer leagues. Each entry maps to an ESPN
// soccer slug (used as the second path segment of every ESPN endpoint).
//
// Keep this list curated and explicit. Adding a league is as simple as adding
// a row here — `getAllMatches` automatically loops over LEAGUES so the board,
// suggestions, and filters all light up immediately.

export interface League {
  code: string; // ESPN slug, e.g. "esp.1"
  name: string; // full official name in Catalan/English
  shortName: string; // chip label
  country: string; // Catalan country name
  flag: string; // emoji shown on chips/badges
  color: string; // accent colour for badge backgrounds
  tier: 1 | 2 | 3; // 1 = top domestic, 2 = continental, 3 = secondary
}

export const LEAGUES: League[] = [
  { code: "esp.1",            name: "La Liga",            shortName: "LaLiga",     country: "Espanya",         flag: "ES", color: "#ee2737", tier: 1 },
  { code: "eng.1",            name: "Premier League",     shortName: "Premier",    country: "Anglaterra",      flag: "EN", color: "#3d195b", tier: 1 },
  { code: "ita.1",            name: "Serie A",            shortName: "Serie A",    country: "Itàlia",          flag: "IT", color: "#008fd7", tier: 1 },
  { code: "ger.1",            name: "Bundesliga",         shortName: "Bundesliga", country: "Alemanya",        flag: "DE", color: "#d20515", tier: 1 },
  { code: "fra.1",            name: "Ligue 1",            shortName: "Ligue 1",    country: "França",          flag: "FR", color: "#091c3e", tier: 1 },
  { code: "por.1",            name: "Primeira Liga",      shortName: "Primeira",   country: "Portugal",        flag: "PT", color: "#006600", tier: 1 },
  { code: "ned.1",            name: "Eredivisie",         shortName: "Eredivisie", country: "Països Baixos",   flag: "NL", color: "#fa6b22", tier: 1 },
  { code: "uefa.champions",   name: "Champions League",   shortName: "Champions",  country: "UEFA",            flag: "EU", color: "#0a3068", tier: 2 },
  { code: "uefa.europa",      name: "Europa League",      shortName: "Europa",     country: "UEFA",            flag: "EU", color: "#ff6900", tier: 2 },
  { code: "uefa.europa.conf", name: "Conference League",  shortName: "Conference", country: "UEFA",            flag: "EU", color: "#01795a", tier: 2 },
  { code: "esp.2",            name: "La Liga 2",          shortName: "LaLiga 2",   country: "Espanya",         flag: "ES", color: "#ee2737", tier: 3 },
  { code: "eng.2",            name: "Championship",       shortName: "Champ.",     country: "Anglaterra",      flag: "EN", color: "#1d3557", tier: 3 },
];

export const DEFAULT_LEAGUE = "esp.1";

const BY_CODE = new Map(LEAGUES.map((l) => [l.code, l]));

export function getLeague(code: string | undefined | null): League {
  if (!code) return BY_CODE.get(DEFAULT_LEAGUE)!;
  return BY_CODE.get(code) ?? BY_CODE.get(DEFAULT_LEAGUE)!;
}

export function isKnownLeague(code: string): boolean {
  return BY_CODE.has(code);
}
