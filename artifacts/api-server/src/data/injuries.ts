import { getAllTeams, type LiveTeam } from "./teams.js";
import { getTeamSquad, type LivePlayer } from "./players.js";
import { getLeagueNews, type RawNewsArticle } from "../lib/espn.js";

export interface LiveInjury {
  id: number;
  playerId: number;
  playerName: string;
  teamId: number;
  teamName: string;
  teamShortName: string;
  teamCrestUrl: string;
  headshotUrl: string | null;
  shirtNumber: number | null;
  position: LivePlayer["position"];
  positionLabel: string;
  type: "injury" | "suspension" | "doubtful";
  status: string;
  description: string;
  injuryType: string | null;
  severity: "low" | "medium" | "high";
  expectedReturn: string | null;
  injuryDate: string | null;
  impactScore: number;
}

const HIGH_KEYWORDS = ["out", "indefinite", "season", "long-term", "ruled out", "tear", "torn", "fracture", "rupture", "surgery", "acl", "achilles"];
const MEDIUM_KEYWORDS = ["doubt", "day-to-day", "questionable", "probable", "fitness test", "race against time"];
const LOW_KEYWORDS = ["knock", "minor", "precaution"];

function classifyText(text: string): LiveInjury["severity"] {
  const t = text.toLowerCase();
  if (HIGH_KEYWORDS.some((k) => t.includes(k))) return "high";
  if (LOW_KEYWORDS.some((k) => t.includes(k))) return "low";
  if (MEDIUM_KEYWORDS.some((k) => t.includes(k))) return "medium";
  return "medium";
}

function classifyType(text: string): LiveInjury["type"] {
  const t = text.toLowerCase();
  if (t.includes("suspend") || t.includes("ban") || /red card/.test(t)) return "suspension";
  if (MEDIUM_KEYWORDS.some((k) => t.includes(k))) return "doubtful";
  return "injury";
}

const BODY_PARTS = [
  "hamstring", "knee", "ankle", "calf", "groin", "thigh", "foot",
  "hand", "wrist", "shoulder", "back", "head", "concussion",
  "muscle", "ligament", "ACL", "MCL", "meniscus", "achilles",
  "hip", "rib", "metatarsal", "abductor", "adductor",
];
function extractBodyPart(text: string): string | null {
  const t = text.toLowerCase();
  for (const p of BODY_PARTS) {
    if (t.includes(p.toLowerCase())) return p[0]!.toUpperCase() + p.slice(1).toLowerCase();
  }
  return null;
}

function impactFor(p: LivePlayer | null, severity: LiveInjury["severity"]): number {
  const posWeight = !p ? 0.7 :
    p.position === "FWD" ? 1.0 :
    p.position === "MID" ? 0.85 :
    p.position === "DEF" ? 0.75 :
    p.position === "GK" ? 0.7 : 0.6;
  const sevWeight = severity === "high" ? 1.0 : severity === "medium" ? 0.6 : 0.3;
  return +(posWeight * sevWeight).toFixed(2);
}

const INJURY_REGEX = /\b(injur|sidelin|out for|misses?|ruled out|knock|surgery|hamstring|knee|ankle|red card|suspended|ban\b|absen|sprain|fractur|torn|tear|rupture)/i;

interface NewsCandidate {
  athleteId: number;
  athleteName: string;
  teamId: number;
  article: RawNewsArticle;
}

function extractCandidates(articles: RawNewsArticle[], laLigaTeamIds: Set<number>): NewsCandidate[] {
  const out: NewsCandidate[] = [];
  for (const a of articles) {
    const text = `${a.headline} ${a.description ?? ""}`;
    if (!INJURY_REGEX.test(text)) continue;
    const cats = a.categories ?? [];
    const athleteCat = cats.find((c) => c.type === "athlete" && c.athlete?.id);
    if (!athleteCat?.athlete) continue;
    // Pick the first team category that's a real La Liga club (skip national teams like France)
    const teamCat = cats.find((c) => c.type === "team" && c.team?.id && laLigaTeamIds.has(c.team.id));
    if (!teamCat?.team) continue;
    out.push({
      athleteId: athleteCat.athlete.id,
      athleteName: athleteCat.athlete.description ?? `Player ${athleteCat.athlete.id}`,
      teamId: teamCat.team.id,
      article: a,
    });
  }
  return out;
}

interface RosterIndex {
  byId: Map<number, { player: LivePlayer; team: LiveTeam }>;
  byTeamId: Map<number, LiveTeam>;
}

async function buildRosterIndex(teams: LiveTeam[]): Promise<RosterIndex> {
  const byId = new Map<number, { player: LivePlayer; team: LiveTeam }>();
  const byTeamId = new Map<number, LiveTeam>();
  await Promise.all(teams.map(async (team) => {
    byTeamId.set(team.id, team);
    try {
      const squad = await getTeamSquad(team.id);
      for (const p of squad) byId.set(p.id, { player: p, team });
    } catch {
      /* ignore */
    }
  }));
  return { byId, byTeamId };
}

function describe(text: string): string {
  // Trim ellipsis suffixes and overly long descriptions
  const cleaned = text.replace(/\s+/g, " ").trim();
  return cleaned.length > 220 ? cleaned.slice(0, 217) + "…" : cleaned;
}

function reasonableTitle(article: RawNewsArticle): string {
  // Prefer headline if it's already self-contained, otherwise use description
  if (article.headline.length < 100) return article.headline;
  return article.description ?? article.headline;
}

export async function getAllInjuries(): Promise<LiveInjury[]> {
  const teams = await getAllTeams();
  const teamIds = new Set(teams.map((t) => t.id));

  // 1) Roster-derived injuries (currently empty for La Liga but leave the path in
  //    place so we automatically pick up any future ESPN updates).
  const rosterLists = await Promise.all(
    teams.map((t) => getRosterInjuries(t.id, t).catch(() => [] as LiveInjury[])),
  );
  const rosterFlat = rosterLists.flat();

  // 2) News-derived injuries — currently the only reliable source for La Liga.
  let newsInjuries: LiveInjury[] = [];
  try {
    const news = await getLeagueNews(50);
    const candidates = extractCandidates(news.articles ?? [], teamIds);
    const idx = await buildRosterIndex(teams);
    // Group all related articles per athlete so we can aggregate severity + body
    // part across the corpus, then pick the headline from the newest article.
    const sorted = candidates.sort((a, b) => (b.article.published || "").localeCompare(a.article.published || ""));
    const byAthlete = new Map<number, NewsCandidate[]>();
    for (const c of sorted) {
      const list = byAthlete.get(c.athleteId) ?? [];
      list.push(c);
      byAthlete.set(c.athleteId, list);
    }
    for (const [athleteId, group] of byAthlete) {
      const newest = group[0]!;
      const found = idx.byId.get(athleteId);
      const team = idx.byTeamId.get(newest.teamId);
      if (!team) continue;
      const allText = group
        .map((c) => `${c.article.headline} ${c.article.description ?? ""}`)
        .join(" \n ");
      const headlineText = `${newest.article.headline} ${newest.article.description ?? ""}`;
      // Pick the max severity across the corpus.
      const severities = group.map((c) =>
        classifyText(`${c.article.headline} ${c.article.description ?? ""}`),
      );
      const severity: LiveInjury["severity"] = severities.includes("high")
        ? "high"
        : severities.includes("medium")
          ? "medium"
          : "low";
      const type = classifyType(headlineText);
      const description = describe(reasonableTitle(newest.article));
      newsInjuries.push({
        id: Number(`9${team.id}${athleteId}`.slice(0, 12)),
        playerId: athleteId,
        playerName: found?.player.name ?? newest.athleteName,
        teamId: team.id,
        teamName: team.name,
        teamShortName: team.shortName,
        teamCrestUrl: team.crestUrl,
        headshotUrl: found?.player.headshotUrl ?? null,
        shirtNumber: found?.player.shirtNumber ?? null,
        position: found?.player.position ?? "MID",
        positionLabel: found?.player.positionLabel ?? "",
        type,
        status: severity === "high" ? "Out" : severity === "medium" ? "Doubtful" : "Day-to-day",
        description,
        injuryType: extractBodyPart(allText),
        severity,
        expectedReturn: null,
        injuryDate: newest.article.published ?? null,
        impactScore: impactFor(found?.player ?? null, severity),
      });
    }
  } catch {
    /* news failure should not break the page */
  }

  // De-duplicate: prefer roster entry over news entry for the same playerId.
  const byPlayer = new Map<number, LiveInjury>();
  for (const i of newsInjuries) byPlayer.set(i.playerId, i);
  for (const i of rosterFlat) byPlayer.set(i.playerId, i);
  return Array.from(byPlayer.values());
}

export async function getTeamInjuries(teamId: number): Promise<LiveInjury[]> {
  const all = await getAllInjuries();
  return all.filter((i) => i.teamId === teamId);
}

async function getRosterInjuries(teamId: number, team: LiveTeam): Promise<LiveInjury[]> {
  const squad = await getTeamSquad(teamId);
  const injured = squad.filter((p) => p.injured || p.injuryStatus);
  return injured.map((p, idx) => {
    const status = p.injuryStatus ?? "Out";
    const text = `${status} ${p.injuryType ?? ""} ${p.injuryDetail ?? ""}`;
    const severity = classifyText(text);
    const type = classifyType(text);
    return {
      id: Number(`${teamId}${idx}`),
      playerId: p.id,
      playerName: p.name,
      teamId,
      teamName: team.name,
      teamShortName: team.shortName,
      teamCrestUrl: team.crestUrl,
      headshotUrl: p.headshotUrl,
      shirtNumber: p.shirtNumber,
      position: p.position,
      positionLabel: p.positionLabel,
      type,
      status,
      description: p.injuryDetail || p.injuryType || status,
      injuryType: p.injuryType ?? extractBodyPart(text),
      severity,
      expectedReturn: p.expectedReturn,
      injuryDate: p.injuryDate,
      impactScore: impactFor(p, severity),
    };
  });
}
