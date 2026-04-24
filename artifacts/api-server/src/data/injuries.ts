import { getAllTeams } from "./teams.js";
import { getTeamSquad, type LivePlayer } from "./players.js";

export interface LiveInjury {
  id: number;
  playerId: number;
  playerName: string;
  teamId: number;
  teamName: string;
  teamShortName: string;
  position: LivePlayer["position"];
  type: "injury" | "suspension" | "doubtful";
  status: string;
  description: string;
  severity: "low" | "medium" | "high";
  expectedReturn: string | null;
  impactScore: number;
}

const HIGH_STATUSES = ["Out", "Out indefinitely", "Suspended"];
const MEDIUM_STATUSES = ["Doubtful", "Day-To-Day"];

function classify(status: string): { type: LiveInjury["type"]; severity: LiveInjury["severity"] } {
  const s = status.toLowerCase();
  if (s.includes("suspend")) return { type: "suspension", severity: "high" };
  if (s.includes("doubt") || s.includes("day")) return { type: "doubtful", severity: "medium" };
  if (HIGH_STATUSES.some((h) => s.includes(h.toLowerCase()))) return { type: "injury", severity: "high" };
  if (MEDIUM_STATUSES.some((m) => s.includes(m.toLowerCase()))) return { type: "injury", severity: "medium" };
  return { type: "injury", severity: "low" };
}

export async function getTeamInjuries(teamId: number): Promise<LiveInjury[]> {
  const squad = await getTeamSquad(teamId);
  const injured = squad.filter((p) => p.injured);
  const teams = await getAllTeams();
  const team = teams.find((t) => t.id === teamId);
  return injured.map((p, idx) => {
    const status = p.injuryStatus ?? "Injured";
    const { type, severity } = classify(status);
    const impactScore = severity === "high" ? 0.9 : severity === "medium" ? 0.5 : 0.2;
    return {
      id: Number(`${teamId}${idx}`),
      playerId: p.id,
      playerName: p.name,
      teamId,
      teamName: team?.name ?? "",
      teamShortName: team?.shortName ?? "",
      position: p.position,
      type,
      status,
      description: status,
      severity,
      expectedReturn: null,
      impactScore,
    };
  });
}

export async function getAllInjuries(): Promise<LiveInjury[]> {
  const teams = await getAllTeams();
  const lists = await Promise.all(teams.map((t) => getTeamInjuries(t.id).catch(() => [] as LiveInjury[])));
  return lists.flat();
}
