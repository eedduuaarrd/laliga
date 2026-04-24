import { TEAMS } from "./teams.js";

export interface SeedPlayer {
  id: number;
  name: string;
  teamId: number;
  position: "GK" | "DEF" | "MID" | "FWD";
  shirtNumber: number;
  nationality: string;
  age: number;
  appearances: number;
  goals: number;
  assists: number;
  keyPasses: number;
  bigChancesCreated: number;
  xG: number;
  rating: number;
}

interface PlayerRow {
  name: string;
  position: SeedPlayer["position"];
  shirtNumber: number;
  nationality: string;
  age: number;
}

const SQUADS: Record<number, PlayerRow[]> = {
  1: [ // Real Madrid
    { name: "Thibaut Courtois", position: "GK", shirtNumber: 1, nationality: "Belgium", age: 33 },
    { name: "Andriy Lunin", position: "GK", shirtNumber: 13, nationality: "Ukraine", age: 26 },
    { name: "Dani Carvajal", position: "DEF", shirtNumber: 2, nationality: "Spain", age: 33 },
    { name: "Antonio Rüdiger", position: "DEF", shirtNumber: 22, nationality: "Germany", age: 32 },
    { name: "David Alaba", position: "DEF", shirtNumber: 4, nationality: "Austria", age: 33 },
    { name: "Eder Militão", position: "DEF", shirtNumber: 3, nationality: "Brazil", age: 27 },
    { name: "Ferland Mendy", position: "DEF", shirtNumber: 23, nationality: "France", age: 30 },
    { name: "Trent Alexander-Arnold", position: "DEF", shirtNumber: 12, nationality: "England", age: 27 },
    { name: "Aurélien Tchouaméni", position: "MID", shirtNumber: 14, nationality: "France", age: 26 },
    { name: "Jude Bellingham", position: "MID", shirtNumber: 5, nationality: "England", age: 22 },
    { name: "Federico Valverde", position: "MID", shirtNumber: 8, nationality: "Uruguay", age: 27 },
    { name: "Eduardo Camavinga", position: "MID", shirtNumber: 6, nationality: "France", age: 23 },
    { name: "Arda Güler", position: "MID", shirtNumber: 15, nationality: "Turkey", age: 21 },
    { name: "Vinícius Júnior", position: "FWD", shirtNumber: 7, nationality: "Brazil", age: 25 },
    { name: "Kylian Mbappé", position: "FWD", shirtNumber: 9, nationality: "France", age: 27 },
    { name: "Rodrygo", position: "FWD", shirtNumber: 11, nationality: "Brazil", age: 25 },
    { name: "Endrick", position: "FWD", shirtNumber: 16, nationality: "Brazil", age: 19 },
  ],
  2: [ // Barcelona
    { name: "Marc-André ter Stegen", position: "GK", shirtNumber: 1, nationality: "Germany", age: 33 },
    { name: "Wojciech Szczęsny", position: "GK", shirtNumber: 25, nationality: "Poland", age: 35 },
    { name: "Jules Koundé", position: "DEF", shirtNumber: 23, nationality: "France", age: 27 },
    { name: "Ronald Araújo", position: "DEF", shirtNumber: 4, nationality: "Uruguay", age: 26 },
    { name: "Pau Cubarsí", position: "DEF", shirtNumber: 5, nationality: "Spain", age: 18 },
    { name: "Iñigo Martínez", position: "DEF", shirtNumber: 6, nationality: "Spain", age: 34 },
    { name: "Alejandro Balde", position: "DEF", shirtNumber: 3, nationality: "Spain", age: 22 },
    { name: "Frenkie de Jong", position: "MID", shirtNumber: 21, nationality: "Netherlands", age: 28 },
    { name: "Pedri", position: "MID", shirtNumber: 8, nationality: "Spain", age: 23 },
    { name: "Gavi", position: "MID", shirtNumber: 6, nationality: "Spain", age: 21 },
    { name: "Dani Olmo", position: "MID", shirtNumber: 20, nationality: "Spain", age: 27 },
    { name: "Marc Casadó", position: "MID", shirtNumber: 17, nationality: "Spain", age: 22 },
    { name: "Lamine Yamal", position: "FWD", shirtNumber: 19, nationality: "Spain", age: 18 },
    { name: "Robert Lewandowski", position: "FWD", shirtNumber: 9, nationality: "Poland", age: 37 },
    { name: "Raphinha", position: "FWD", shirtNumber: 11, nationality: "Brazil", age: 28 },
    { name: "Ferran Torres", position: "FWD", shirtNumber: 7, nationality: "Spain", age: 25 },
  ],
  3: [ // Atlético
    { name: "Jan Oblak", position: "GK", shirtNumber: 13, nationality: "Slovenia", age: 32 },
    { name: "Juan Musso", position: "GK", shirtNumber: 1, nationality: "Argentina", age: 31 },
    { name: "José Giménez", position: "DEF", shirtNumber: 2, nationality: "Uruguay", age: 30 },
    { name: "César Azpilicueta", position: "DEF", shirtNumber: 24, nationality: "Spain", age: 36 },
    { name: "Robin Le Normand", position: "DEF", shirtNumber: 22, nationality: "Spain", age: 29 },
    { name: "Reinildo Mandava", position: "DEF", shirtNumber: 23, nationality: "Mozambique", age: 31 },
    { name: "Nahuel Molina", position: "DEF", shirtNumber: 16, nationality: "Argentina", age: 27 },
    { name: "Koke", position: "MID", shirtNumber: 6, nationality: "Spain", age: 33 },
    { name: "Pablo Barrios", position: "MID", shirtNumber: 8, nationality: "Spain", age: 22 },
    { name: "Rodrigo De Paul", position: "MID", shirtNumber: 5, nationality: "Argentina", age: 31 },
    { name: "Conor Gallagher", position: "MID", shirtNumber: 4, nationality: "England", age: 25 },
    { name: "Antoine Griezmann", position: "FWD", shirtNumber: 7, nationality: "France", age: 34 },
    { name: "Julián Álvarez", position: "FWD", shirtNumber: 19, nationality: "Argentina", age: 25 },
    { name: "Alexander Sørloth", position: "FWD", shirtNumber: 9, nationality: "Norway", age: 30 },
    { name: "Giuliano Simeone", position: "FWD", shirtNumber: 14, nationality: "Argentina", age: 22 },
  ],
};

const COMMON_NAMES = ["García","Rodríguez","Martínez","López","González","Pérez","Sánchez","Romero","Jiménez","Ruiz","Hernández","Díaz","Moreno","Álvarez","Muñoz","Gómez","Navarro","Torres","Domínguez","Vázquez","Ramos","Gil","Serrano","Blanco","Suárez","Molina","Castro","Ortega","Rubio","Sanz","Iglesias","Medina","Cortés","Garrido","Núñez","Cabrera","Vega","Fuentes","Carrasco","Calvo","Reyes","Soto","Aguilar","Soler","Mora"];
const COMMON_FIRSTS = ["Sergio","Carlos","Pablo","Marco","Iván","Rubén","Adrián","Mario","Álex","Hugo","Diego","Marc","Pol","Aitor","Iker","Jon","Mikel","Asier","Unai","Joan","Bryan","Leandro","Borja","Óscar","Nacho","Raúl","David","Javier","Daniel"];
const NATIONS = ["Spain","Argentina","Brazil","France","Portugal","Morocco","Croatia","Uruguay","Colombia","Mexico","Senegal","Netherlands","Germany","England","Italy","Belgium","Norway","Sweden","Denmark","Serbia"];

function genericSquad(seed: number): PlayerRow[] {
  const positions: SeedPlayer["position"][] = ["GK","GK","DEF","DEF","DEF","DEF","DEF","DEF","DEF","MID","MID","MID","MID","MID","MID","FWD","FWD","FWD","FWD"];
  return positions.map((pos, i) => {
    const k = (seed * 31 + i * 17) % COMMON_NAMES.length;
    const j = (seed * 13 + i * 7) % COMMON_FIRSTS.length;
    return {
      name: `${COMMON_FIRSTS[j]} ${COMMON_NAMES[k]}`,
      position: pos,
      shirtNumber: i + 1,
      nationality: NATIONS[(seed + i) % NATIONS.length] ?? "Spain",
      age: 19 + ((seed * 5 + i * 3) % 17),
    };
  });
}

function rng(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

export const PLAYERS: SeedPlayer[] = (() => {
  const out: SeedPlayer[] = [];
  let nextId = 1;
  for (const team of TEAMS) {
    const squad = SQUADS[team.id] ?? genericSquad(team.id);
    const r = rng(team.id * 1000 + 7);
    for (const row of squad) {
      const apps = 6 + Math.floor(r() * 6);
      let goals = 0;
      let assists = 0;
      let keyPasses = 0;
      let bigChances = 0;
      let xG = 0;
      const att = team.attackStrength;
      if (row.position === "FWD") {
        goals = Math.floor(r() * (att * 5 + 1));
        assists = Math.floor(r() * (att * 3));
        keyPasses = Math.floor(r() * 14) + 6;
        bigChances = Math.floor(r() * 10) + 3;
        xG = +(goals * (0.85 + r() * 0.4)).toFixed(2);
      } else if (row.position === "MID") {
        goals = Math.floor(r() * (att * 2));
        assists = Math.floor(r() * (att * 3 + 1));
        keyPasses = Math.floor(r() * 18) + 8;
        bigChances = Math.floor(r() * 7) + 1;
        xG = +(goals * (0.85 + r() * 0.4)).toFixed(2);
      } else if (row.position === "DEF") {
        goals = Math.floor(r() * 2);
        assists = Math.floor(r() * 2);
        keyPasses = Math.floor(r() * 5);
        bigChances = Math.floor(r() * 3);
        xG = +(goals * (0.7 + r() * 0.3)).toFixed(2);
      } else {
        goals = 0;
        assists = 0;
        keyPasses = 0;
        bigChances = 0;
        xG = 0;
      }
      const rating = +(6.4 + r() * 1.8 + (att - 1) * 0.2).toFixed(2);
      out.push({
        id: nextId++,
        name: row.name,
        teamId: team.id,
        position: row.position,
        shirtNumber: row.shirtNumber,
        nationality: row.nationality,
        age: row.age,
        appearances: apps,
        goals,
        assists,
        keyPasses,
        bigChancesCreated: bigChances,
        xG,
        rating,
      });
    }
  }
  // Sprinkle Mbappé/Lewandowski/Yamal with strong stats explicitly
  const overrides: Record<string, Partial<SeedPlayer>> = {
    "Kylian Mbappé": { goals: 11, assists: 4, keyPasses: 22, bigChancesCreated: 14, xG: 9.8, rating: 8.42 },
    "Vinícius Júnior": { goals: 6, assists: 5, keyPasses: 28, bigChancesCreated: 12, xG: 5.6, rating: 8.05 },
    "Jude Bellingham": { goals: 5, assists: 6, keyPasses: 31, bigChancesCreated: 10, xG: 4.9, rating: 8.18 },
    "Robert Lewandowski": { goals: 12, assists: 2, keyPasses: 14, bigChancesCreated: 9, xG: 10.2, rating: 8.31 },
    "Lamine Yamal": { goals: 8, assists: 9, keyPasses: 38, bigChancesCreated: 17, xG: 6.1, rating: 8.55 },
    "Raphinha": { goals: 7, assists: 6, keyPasses: 26, bigChancesCreated: 11, xG: 5.4, rating: 7.92 },
    "Pedri": { goals: 3, assists: 5, keyPasses: 34, bigChancesCreated: 8, xG: 2.4, rating: 8.10 },
    "Julián Álvarez": { goals: 9, assists: 3, keyPasses: 19, bigChancesCreated: 11, xG: 8.1, rating: 8.04 },
    "Antoine Griezmann": { goals: 5, assists: 4, keyPasses: 24, bigChancesCreated: 9, xG: 4.6, rating: 7.78 },
  };
  for (const p of out) {
    const o = overrides[p.name];
    if (o) Object.assign(p, o);
  }
  return out;
})();

export function getTeamSquad(teamId: number): SeedPlayer[] {
  return PLAYERS.filter((p) => p.teamId === teamId);
}
