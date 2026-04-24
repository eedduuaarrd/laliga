import { PLAYERS } from "./players.js";
import { TEAMS } from "./teams.js";

export interface SeedInjury {
  id: number;
  playerId: number;
  type: "injury" | "suspension";
  description: string;
  severity: "minor" | "moderate" | "major";
  expectedReturn: string;
  impactScore: number; // 0-1
}

const TARGETS: Array<{ name: string; type: SeedInjury["type"]; description: string; severity: SeedInjury["severity"]; expectedReturn: string; impactScore: number }> = [
  { name: "Dani Carvajal", type: "injury", description: "ACL recovery", severity: "major", expectedReturn: "May 2026", impactScore: 0.62 },
  { name: "Antonio Rüdiger", type: "injury", description: "Knee meniscus", severity: "moderate", expectedReturn: "1-2 weeks", impactScore: 0.55 },
  { name: "Eder Militão", type: "injury", description: "Hamstring strain", severity: "minor", expectedReturn: "10 days", impactScore: 0.40 },
  { name: "Jules Koundé", type: "suspension", description: "Yellow card accumulation", severity: "minor", expectedReturn: "1 match", impactScore: 0.45 },
  { name: "Pedri", type: "injury", description: "Quad strain", severity: "moderate", expectedReturn: "2-3 weeks", impactScore: 0.70 },
  { name: "Frenkie de Jong", type: "injury", description: "Ankle ligament", severity: "moderate", expectedReturn: "3 weeks", impactScore: 0.58 },
  { name: "José Giménez", type: "injury", description: "Calf injury", severity: "minor", expectedReturn: "1 week", impactScore: 0.42 },
  { name: "Reinildo Mandava", type: "suspension", description: "Direct red card", severity: "minor", expectedReturn: "2 matches", impactScore: 0.38 },
  { name: "Antoine Griezmann", type: "injury", description: "Knock from training", severity: "minor", expectedReturn: "Doubtful", impactScore: 0.50 },
];

export const INJURIES: SeedInjury[] = (() => {
  const out: SeedInjury[] = [];
  let id = 1;
  for (const t of TARGETS) {
    const player = PLAYERS.find((p) => p.name === t.name);
    if (!player) continue;
    out.push({
      id: id++,
      playerId: player.id,
      type: t.type,
      description: t.description,
      severity: t.severity,
      expectedReturn: t.expectedReturn,
      impactScore: t.impactScore,
    });
  }
  // Add ~12 generic injuries spread across other teams
  const genericDescriptions = [
    { description: "Hamstring strain", severity: "minor" as const, expectedReturn: "1 week", impactScore: 0.30 },
    { description: "Ankle sprain", severity: "moderate" as const, expectedReturn: "2 weeks", impactScore: 0.42 },
    { description: "Muscle fatigue", severity: "minor" as const, expectedReturn: "5 days", impactScore: 0.20 },
    { description: "Concussion protocol", severity: "moderate" as const, expectedReturn: "Pending tests", impactScore: 0.35 },
    { description: "Yellow card accumulation", severity: "minor" as const, expectedReturn: "1 match", impactScore: 0.28 },
    { description: "Knee sprain", severity: "moderate" as const, expectedReturn: "3 weeks", impactScore: 0.40 },
    { description: "Groin strain", severity: "minor" as const, expectedReturn: "10 days", impactScore: 0.30 },
    { description: "Direct red card", severity: "minor" as const, expectedReturn: "2 matches", impactScore: 0.32 },
    { description: "Lower back issue", severity: "minor" as const, expectedReturn: "Doubtful", impactScore: 0.25 },
    { description: "Foot fracture", severity: "major" as const, expectedReturn: "2 months", impactScore: 0.55 },
    { description: "Shoulder dislocation", severity: "moderate" as const, expectedReturn: "4 weeks", impactScore: 0.38 },
    { description: "Thigh contusion", severity: "minor" as const, expectedReturn: "1 week", impactScore: 0.22 },
  ];
  const otherTeamIds = TEAMS.filter((t) => ![1, 2, 3].includes(t.id)).map((t) => t.id);
  let cursor = 0;
  for (const teamId of otherTeamIds.slice(0, 12)) {
    const squad = PLAYERS.filter((p) => p.teamId === teamId);
    if (squad.length === 0) continue;
    const player = squad[(teamId * 3) % squad.length]!;
    const desc = genericDescriptions[cursor++ % genericDescriptions.length]!;
    const isSusp = desc.description.toLowerCase().includes("card");
    out.push({
      id: id++,
      playerId: player.id,
      type: isSusp ? "suspension" : "injury",
      description: desc.description,
      severity: desc.severity,
      expectedReturn: desc.expectedReturn,
      impactScore: desc.impactScore,
    });
  }
  return out;
})();

export function getTeamInjuries(teamId: number): SeedInjury[] {
  return INJURIES.filter((i) => {
    const p = PLAYERS.find((pl) => pl.id === i.playerId);
    return p?.teamId === teamId;
  });
}
