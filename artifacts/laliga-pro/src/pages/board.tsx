import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, formatDistanceToNow } from "date-fns";
import { ca } from "date-fns/locale";
import {
  TrendingUp,
  Layers,
  Sparkles,
  Clock,
  Flame,
  ShieldCheck,
  Gauge,
  ChevronRight,
  Search,
  Filter,
  Wallet,
  Trophy,
  Users,
  Target,
  Square,
  Zap,
  Star,
  Eye,
  EyeOff,
  Lock,
  Scale,
  Rocket,
  Plus,
  Check,
  X,
  Trash2,
  Crown,
  Calculator,
} from "lucide-react";
import { Layout } from "@/components/layout";
import { Skeleton } from "@/components/ui/skeleton";

// ---------------------------------------------------------------------------
// Types — match the bet365 routes on the backend
// ---------------------------------------------------------------------------
type MarketSource = "live" | "model";

interface Market {
  key: string;
  group: string;
  selection: string;
  odds: number | null;
  modelProb: number;
  impliedProb: number | null;
  edge: number | null;
  source: MarketSource;
}
interface PlayerMarket {
  playerId: number;
  playerName: string;
  team: "home" | "away";
  teamShort: string;
  position: string;
  positionLabel: string;
  headshot: string | null;
  seasonGoals: number;
  seasonAssists: number;
  markets: Market[];
}
interface League {
  code: string;
  name: string;
  shortName: string;
  country: string;
  flag: string;
  color: string;
  tier: number;
}
interface MatchPick {
  key: string;
  group: string;
  selection: string;
  odds: number;
  modelProb: number;
  edge: number;
  source: MarketSource;
  valueScore: number;
  kellyFraction: number;
  confidence: number;
}
interface MatchBestPicks {
  safe: MatchPick | null;
  value: MatchPick | null;
  bold: MatchPick | null;
}
interface BoardMatch {
  matchId: number;
  status: "live" | "upcoming";
  kickoff: string;
  minute: number | null;
  homeShort: string;
  awayShort: string;
  homeName: string;
  awayName: string;
  homeCrest: string;
  awayCrest: string;
  homeScore: number | null;
  awayScore: number | null;
  source: MarketSource;
  bookmaker: string | null;
  oddsLastUpdate: string | null;
  topPick: { selection: string; modelProb: number; odds: number | null } | null;
  bestPicks: MatchBestPicks;
  markets: Market[];
  playerMarkets: PlayerMarket[];
  league: League;
}
interface BoardResponse {
  source: string;
  liveMatchCount: number;
  liveMarketCount: number;
  totalMatchCount: number;
  matches: BoardMatch[];
}

type QualityTier = "joia" | "valor" | "segur" | "edge" | "estandard";

interface SimpleBet {
  id: string;
  matchId: number;
  matchLabel: string;
  kickoff: string;
  status: "live" | "upcoming";
  market: string;
  selection: string;
  odds: number;
  modelProb: number;
  impliedProb: number;
  edge: number;
  source: MarketSource;
  riskTier: "molt baix" | "baix" | "moderat" | "alt";
  rationale: string;
  kellyFraction: number;
  confidence: number;
  valueScore: number;
  qualityTier: QualityTier;
}
interface ComboBet {
  id: string;
  legs: {
    matchId: number;
    matchLabel: string;
    market: string;
    selection: string;
    odds: number;
    modelProb: number;
    source: MarketSource;
  }[];
  combinedOdds: number;
  combinedProb: number;
  riskTier: "baix" | "moderat" | "alt" | "molt alt";
  rationale: string;
  combinedEdge: number;
}
interface SuggestionsResponse {
  source: string;
  liveMatchCount: number;
  liveMarketCount: number;
  totalMatchCount: number;
  simples: SimpleBet[];
  combos: ComboBet[];
  /** Combos engineered for very low risk: each leg ≥65% prob, joint ≥45%. */
  safeCombos: ComboBet[];
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------
async function getJson<T>(url: string): Promise<T> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  return (await r.json()) as T;
}
function useBoard() {
  return useQuery({
    queryKey: ["bet365-board"],
    queryFn: () => getJson<BoardResponse>("/api/bet365/board"),
    refetchInterval: 60_000,
  });
}
function useSuggestions() {
  return useQuery({
    queryKey: ["bet365-suggestions"],
    queryFn: () => getJson<SuggestionsResponse>("/api/bet365/suggestions"),
    refetchInterval: 60_000,
  });
}

function useBankroll(): [number, (n: number) => void] {
  const [v, setV] = useState<number>(() => {
    if (typeof window === "undefined") return 100;
    const stored =
      window.localStorage.getItem("futbol-edge-bankroll") ??
      window.localStorage.getItem("laliga-edge-bankroll");
    const n = stored ? parseFloat(stored) : NaN;
    return isFinite(n) && n > 0 ? n : 100;
  });
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("futbol-edge-bankroll", String(v));
  }, [v]);
  return [v, setV];
}

// ---------------------------------------------------------------------------
// Bet slip — picks the user has selected, persisted to localStorage.
// Shown as a floating panel (bottom-right) with combined odds + payout.
// ---------------------------------------------------------------------------
interface SlipBet {
  id: string;            // unique key per leg
  matchId: number;
  matchLabel: string;
  market: string;        // group
  selection: string;
  odds: number;
  modelProb: number;
  source: MarketSource;
}
const SLIP_STORE_KEY = "futbol-edge-slip";
function useBetSlip() {
  const [legs, setLegs] = useState<SlipBet[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = window.localStorage.getItem(SLIP_STORE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as SlipBet[]) : [];
    } catch {
      return [];
    }
  });
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(SLIP_STORE_KEY, JSON.stringify(legs));
  }, [legs]);
  const has = (id: string) => legs.some((l) => l.id === id);
  const add = (b: SlipBet) => {
    setLegs((cur) => {
      // Replace any existing leg from the same match (combos must be independent)
      const filtered = cur.filter((l) => l.matchId !== b.matchId);
      return [...filtered, b];
    });
  };
  const remove = (id: string) => setLegs((cur) => cur.filter((l) => l.id !== id));
  const toggle = (b: SlipBet) => (has(b.id) ? remove(b.id) : add(b));
  const clear = () => setLegs([]);
  return { legs, add, remove, toggle, has, clear };
}

// Quarter-Kelly stake suggestion in € (clamped to 0.5..bankroll).
function kellyStakeEur(kellyFraction: number, bankroll: number): number {
  if (!isFinite(kellyFraction) || kellyFraction <= 0) return 0;
  const raw = bankroll * kellyFraction;
  return Math.max(0, Math.min(bankroll, raw));
}

/**
 * Probability that AT LEAST k of the given independent Bernoulli trials
 * (with per-trial success probabilities `probs`) succeed. Used to estimate
 * "what are the odds that at least half of today's picks win?" — the key
 * metric for portfolio safety.
 */
function atLeastKBinomial(probs: number[], k: number): number {
  const n = probs.length;
  if (n === 0) return 0;
  if (k <= 0) return 1;
  if (k > n) return 0;
  // dp[j] = prob of exactly j successes after processing i trials
  let dp = new Array<number>(n + 1).fill(0);
  dp[0] = 1;
  for (let i = 0; i < n; i++) {
    const p = probs[i]!;
    const next = new Array<number>(n + 1).fill(0);
    for (let j = 0; j <= i; j++) {
      next[j]     += dp[j]! * (1 - p);
      next[j + 1] += dp[j]! * p;
    }
    dp = next;
  }
  let s = 0;
  for (let j = k; j <= n; j++) s += dp[j]!;
  return s;
}

// ---------------------------------------------------------------------------
// Visual helpers
// ---------------------------------------------------------------------------
const RISK_STYLES: Record<string, { color: string; bg: string; ring: string; label: string; dot: string }> = {
  "molt baix": { color: "text-emerald-300", bg: "bg-emerald-500/10", ring: "ring-emerald-500/30", label: "Molt baix", dot: "bg-emerald-400" },
  baix:        { color: "text-lime-300",    bg: "bg-lime-500/10",    ring: "ring-lime-500/30",    label: "Baix",      dot: "bg-lime-400" },
  moderat:     { color: "text-amber-300",   bg: "bg-amber-500/10",   ring: "ring-amber-500/30",   label: "Moderat",   dot: "bg-amber-400" },
  alt:         { color: "text-orange-300",  bg: "bg-orange-500/10",  ring: "ring-orange-500/30",  label: "Alt",       dot: "bg-orange-400" },
  "molt alt":  { color: "text-red-300",     bg: "bg-red-500/10",     ring: "ring-red-500/30",     label: "Molt alt",  dot: "bg-red-400" },
};

function RiskPill({ tier, compact = false }: { tier: string; compact?: boolean }) {
  const s = RISK_STYLES[tier] ?? RISK_STYLES["moderat"]!;
  return (
    <span
      className={
        "inline-flex items-center gap-1.5 uppercase tracking-[0.16em] font-semibold rounded ring-1 ring-inset " +
        s.bg + " " + s.color + " " + s.ring + " " +
        (compact ? "text-[9px] px-1.5 py-0.5" : "text-[10px] px-2 py-1")
      }
    >
      <span className={"inline-block w-1.5 h-1.5 rounded-full " + s.dot} />
      {compact ? s.label : `Risc ${s.label.toLowerCase()}`}
    </span>
  );
}

// Quality tier — captures "what kind of pick is this?". The user explicitly
// wants to find the unicorn: very probable AND high odds (= "joia").
const QUALITY_STYLES: Record<QualityTier, { label: string; color: string; bg: string; ring: string; dot: string; icon: typeof Crown }> = {
  joia:      { label: "Joia",       color: "text-fuchsia-300", bg: "bg-fuchsia-500/10", ring: "ring-fuchsia-500/40", dot: "bg-fuchsia-400", icon: Crown },
  valor:     { label: "Valor",      color: "text-amber-300",   bg: "bg-amber-500/10",   ring: "ring-amber-500/40",   dot: "bg-amber-400",   icon: Star },
  segur:     { label: "Segura",     color: "text-emerald-300", bg: "bg-emerald-500/10", ring: "ring-emerald-500/40", dot: "bg-emerald-400", icon: Lock },
  edge:      { label: "Edge +",     color: "text-cyan-300",    bg: "bg-cyan-500/10",    ring: "ring-cyan-500/40",    dot: "bg-cyan-400",    icon: TrendingUp },
  estandard: { label: "Estàndard",  color: "text-slate-300",   bg: "bg-slate-500/10",   ring: "ring-slate-500/40",   dot: "bg-slate-400",   icon: ShieldCheck },
};

function SortPicker({ value, onChange }: { value: SimplesSort; onChange: (s: SimplesSort) => void }) {
  const opts: { v: SimplesSort; label: string; hint: string }[] = [
    { v: "value", label: "Valor",  hint: "prob × quota" },
    { v: "prob",  label: "Prob.",  hint: "més probable" },
    { v: "odds",  label: "Quota",  hint: "quota més alta" },
    { v: "edge",  label: "Edge",   hint: "infravalorades" },
  ];
  return (
    <div className="inline-flex items-center gap-1 rounded-lg bg-black/30 ring-1 ring-inset ring-border/60 p-1">
      <span className="px-2 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Ordena per</span>
      {opts.map((o) => {
        const active = value === o.v;
        return (
          <button
            key={o.v}
            type="button"
            onClick={() => onChange(o.v)}
            title={o.hint}
            className={
              "text-[11px] uppercase tracking-[0.14em] font-semibold px-2.5 py-1 rounded-md transition-colors " +
              (active
                ? "bg-primary text-black"
                : "text-muted-foreground hover:text-foreground hover:bg-white/[0.04]")
            }
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function QualityBadge({ tier, compact = false }: { tier: QualityTier; compact?: boolean }) {
  const s = QUALITY_STYLES[tier];
  const Icon = s.icon;
  return (
    <span
      className={
        "inline-flex items-center gap-1 uppercase tracking-[0.16em] font-bold rounded ring-1 ring-inset " +
        s.bg + " " + s.color + " " + s.ring + " " +
        (compact ? "text-[9px] px-1.5 py-0.5" : "text-[10px] px-2 py-1")
      }
      title={tier === "joia" ? "Joia: probabilitat alta i quota alta — el que estàs buscant" : tier === "valor" ? "Valor: probabilitat sòlida amb quota destacada" : tier === "segur" ? "Segura: probabilitat molt alta" : tier === "edge" ? "Edge positiu: el mercat infravalora" : "Pick estàndard"}
    >
      <Icon className={compact ? "w-2.5 h-2.5" : "w-3 h-3"} />
      {s.label}
    </span>
  );
}

function fmtKickoff(iso: string): string {
  try {
    const d = new Date(iso);
    return format(d, "EEE d MMM · HH:mm", { locale: ca });
  } catch {
    return iso;
  }
}
function relTime(iso: string): string {
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true, locale: ca });
  } catch {
    return "";
  }
}
function pct(p: number): string {
  return `${(p * 100).toFixed(0)}%`;
}
function eur(n: number): string {
  if (!isFinite(n)) return "—";
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k €`;
  if (n >= 100) return `${n.toFixed(0)} €`;
  return `${n.toFixed(2)} €`;
}

// ---------------------------------------------------------------------------
// Filter state
// ---------------------------------------------------------------------------
type RiskFilter = "all" | "molt baix" | "baix" | "moderat" | "alt";
type SourceFilter = "all" | "live";
type SimplesSort = "value" | "prob" | "odds" | "edge";
type RiskMode = "conservador" | "equilibrat" | "agressiu";
interface Filters {
  risk: RiskFilter;
  query: string;
  source: SourceFilter;
  league: string; // "all" or league code
  sort: SimplesSort;
  mode: RiskMode;
  /** Minimum model probability (0..1) to show a simple. */
  minProb: number;
  /** Minimum decimal odds to show a simple. */
  minOdds: number;
}
const DEFAULT_FILTERS: Filters = {
  risk: "all", query: "", source: "all", league: "all", sort: "value",
  mode: "equilibrat", minProb: 0.45, minOdds: 1.30,
};

/**
 * Risk mode = quick preset that overrides the user's explicit min sliders
 * with stricter or looser defaults. Conservador = max safety, Agressiu = max
 * upside, Equilibrat = current balanced behavior.
 */
function applyRiskMode(f: Filters, mode: RiskMode): Filters {
  if (mode === "conservador") return { ...f, mode, minProb: Math.max(f.minProb, 0.62), minOdds: Math.max(f.minOdds, 1.40), sort: "value" };
  if (mode === "agressiu")    return { ...f, mode, minProb: Math.min(f.minProb, 0.45), minOdds: Math.max(f.minOdds, 1.70), sort: "odds" };
  return { ...f, mode, minProb: 0.45, minOdds: 1.30, sort: "value" };
}

function matchesFilter(label: string, q: string): boolean {
  if (!q) return true;
  return label.toLowerCase().includes(q.toLowerCase());
}

// ---------------------------------------------------------------------------
// Tab definitions for match cards
// ---------------------------------------------------------------------------
interface TabDef {
  key: string;
  label: string;
  icon: typeof Trophy;
  groups: string[];
}
const TAB_DEFS: TabDef[] = [
  { key: "result",  label: "Resultat", icon: Trophy, groups: ["1X2", "Doble oportunitat", "Resultat al descans", "Resultat exacte", "Porteria a zero", "Guanyar sense encaixar"] },
  { key: "goals",   label: "Gols",     icon: Target, groups: ["Gols", "BTTS (Ambdós marquen)", "Gol a cada part"] },
  { key: "corners", label: "Còrners",  icon: Flame,  groups: ["Còrners"] },
  { key: "cards",   label: "Targetes", icon: Square, groups: ["Targetes", "Targeta vermella"] },
  { key: "other",   label: "Altres",   icon: Zap,    groups: ["Fores de joc", "Faltes", "Penal al partit"] },
];

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
export default function Board() {
  const board = useBoard();
  const suggestions = useSuggestions();
  const data = board.data;
  const sg = suggestions.data;

  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [bankroll, setBankroll] = useBankroll();
  const [edgeOnly, setEdgeOnly] = useState(false);
  const slip = useBetSlip();

  const live = data?.matches.filter((m) => m.status === "live") ?? [];
  const upcoming = data?.matches.filter((m) => m.status === "upcoming") ?? [];

  // -------- map matchId -> league for cross-referencing simples
  const leagueByMatch = useMemo(() => {
    const map = new Map<number, League>();
    for (const m of data?.matches ?? []) map.set(m.matchId, m.league);
    return map;
  }, [data]);

  // -------- list of leagues currently present (for the filter chips)
  const availableLeagues = useMemo<League[]>(() => {
    const map = new Map<string, League>();
    for (const m of data?.matches ?? []) if (!map.has(m.league.code)) map.set(m.league.code, m.league);
    return [...map.values()].sort((a, b) => {
      if (a.tier !== b.tier) return a.tier - b.tier;
      return a.name.localeCompare(b.name);
    });
  }, [data]);

  // -------- filtered datasets -------------------------------------------------
  const filteredMatches = useMemo(() => {
    if (!data) return [];
    return data.matches.filter((m) => {
      if (filters.source === "live" && m.source !== "live") return false;
      if (filters.league !== "all" && m.league.code !== filters.league) return false;
      const label = `${m.homeShort} ${m.homeName} ${m.awayShort} ${m.awayName} ${m.league.name}`;
      if (!matchesFilter(label, filters.query)) return false;
      return true;
    });
  }, [data, filters]);

  const filteredSimples = useMemo(() => {
    if (!sg) return [];
    const filtered = sg.simples.filter((b) => {
      if (b.modelProb < filters.minProb) return false;
      if (b.odds < filters.minOdds) return false;
      if (filters.risk !== "all" && b.riskTier !== filters.risk) return false;
      if (filters.source === "live" && b.source !== "live") return false;
      if (filters.league !== "all") {
        const lg = leagueByMatch.get(b.matchId);
        if (!lg || lg.code !== filters.league) return false;
      }
      const lgName = leagueByMatch.get(b.matchId)?.name ?? "";
      if (!matchesFilter(`${b.matchLabel} ${b.selection} ${lgName}`, filters.query)) return false;
      return true;
    });
    const cmp: Record<SimplesSort, (a: SimpleBet, b: SimpleBet) => number> = {
      value: (a, b) => b.valueScore - a.valueScore,
      prob:  (a, b) => b.modelProb  - a.modelProb,
      odds:  (a, b) => b.odds       - a.odds,
      edge:  (a, b) => b.edge       - a.edge,
    };
    return [...filtered].sort(cmp[filters.sort]);
  }, [sg, filters, leagueByMatch]);

  // Top picks of the day = picks that satisfy the user's "safe + max odds" goal.
  // We pull from sg.simples and rank by valueScore but respect the global
  // RISK MODE so the user can dial the whole board between max-safety and
  // max-upside. To avoid showing 9 copies of the same selection type
  // ("Under 10.5 Còrners") we apply a market-diversity cap of 2 per selection.
  const heroPicks = useMemo(() => {
    if (!sg) return [];
    const minProb = filters.minProb;
    const minOdds = filters.minOdds;
    const pool = sg.simples.filter((b) => b.modelProb >= minProb && b.odds >= minOdds);
    const cmp: Record<SimplesSort, (a: SimpleBet, b: SimpleBet) => number> = {
      value: (a, b) => b.valueScore - a.valueScore,
      prob:  (a, b) => b.modelProb  - a.modelProb,
      odds:  (a, b) => b.odds       - a.odds,
      edge:  (a, b) => b.edge       - a.edge,
    };
    const ranked = [...pool].sort(cmp[filters.sort]);
    const perSelectionCount = new Map<string, number>();
    const perMatchCount = new Map<number, number>();
    const out: SimpleBet[] = [];
    for (const b of ranked) {
      const sig = `${b.market}::${b.selection}`;
      const c = perSelectionCount.get(sig) ?? 0;
      const m = perMatchCount.get(b.matchId) ?? 0;
      if (c >= 2 || m >= 2) continue;
      perSelectionCount.set(sig, c + 1);
      perMatchCount.set(b.matchId, m + 1);
      out.push(b);
      if (out.length >= 9) break;
    }
    return out;
  }, [sg, filters.minProb, filters.minOdds, filters.sort]);

  // The single best pick of the day — top of the value ranking with a safety
  // and confidence floor. Headline "Aposta del dia". Respects risk mode: in
  // Conservador we require ≥62% prob; in Agressiu we relax confidence and
  // bias toward higher odds.
  const apostaDelDia = useMemo(() => {
    if (!sg) return null;
    const mode = filters.mode;
    const probFloor   = mode === "conservador" ? 0.62 : mode === "agressiu" ? 0.48 : 0.50;
    const oddsFloor   = mode === "agressiu" ? 1.70 : 1.50;
    const confFloor   = mode === "agressiu" ? 0.40 : 0.45;
    const pool = sg.simples
      .filter((b) => b.modelProb >= probFloor && b.odds >= oddsFloor && b.confidence >= confFloor);
    if (pool.length === 0) return null;
    if (mode === "agressiu") {
      // Maximize odds × prob² — biased toward bigger payouts that still hit.
      return [...pool].sort((a, b) => (b.odds * b.modelProb * b.modelProb) - (a.odds * a.modelProb * a.modelProb))[0]!;
    }
    return [...pool].sort((a, b) => b.valueScore - a.valueScore)[0]!;
  }, [sg, filters.mode]);

  // Bankroll plan = recommended Kelly portfolio across the day's top picks.
  // Sums fractional-Kelly stakes, expected profit, and computes the joint
  // probability of "at least half the picks win" via a binomial estimate.
  const bankrollPlan = useMemo(() => {
    if (heroPicks.length === 0) return null;
    const picks = heroPicks.slice(0, filters.mode === "conservador" ? 4 : 6);
    let totalStake = 0;
    let totalEv    = 0;
    let totalReturnIfAllWin = 0;
    const probs: number[] = [];
    const leagues = new Set<string>();
    const matches = new Set<number>();
    for (const p of picks) {
      const stake = kellyStakeEur(p.kellyFraction, bankroll);
      totalStake += stake;
      // EV per pick = stake × (odds × prob - 1)
      totalEv += stake * (p.odds * p.modelProb - 1);
      totalReturnIfAllWin += stake * p.odds;
      probs.push(p.modelProb);
      const lg = leagueByMatch.get(p.matchId);
      if (lg) leagues.add(lg.code);
      matches.add(p.matchId);
    }
    // Probability of at least ceil(N/2) picks winning (independent assumption).
    const need = Math.ceil(picks.length / 2);
    const probAtLeastHalf = atLeastKBinomial(probs, need);
    return {
      picks,
      totalStake: +totalStake.toFixed(2),
      totalEv: +totalEv.toFixed(2),
      totalReturnIfAllWin: +totalReturnIfAllWin.toFixed(2),
      avgProb: probs.reduce((a, b) => a + b, 0) / probs.length,
      probAtLeastHalf,
      leagueCount: leagues.size,
      matchCount: matches.size,
      need,
    };
  }, [heroPicks, bankroll, filters.mode, leagueByMatch]);

  return (
    <Layout
      source={data?.source ?? null}
      liveCount={data?.liveMatchCount}
      totalCount={data?.totalMatchCount}
      leagueCount={availableLeagues.length}
      bankroll={bankroll}
      onBankrollChange={setBankroll}
    >
      {data && data.liveMarketCount > 0 && data.liveMatchCount < data.totalMatchCount && (
        <div className="mb-6 rounded-lg border border-accent/25 bg-accent/[0.04] p-4 text-sm text-foreground/80">
          <strong className="text-accent font-semibold">Quotes mixtes.</strong>{" "}
          Tenim quotes <span className="text-accent font-semibold">reals de DraftKings</span> per a {data.liveMatchCount} dels {data.totalMatchCount} partits (els més propers). Per als més llunyans encara no hi ha mercats publicats, així que es mostren probabilitats i quotes del nostre model. Cada quota indica la seva font.
        </div>
      )}
      {data && data.liveMarketCount === 0 && data.totalMatchCount > 0 && (
        <div className="mb-6 rounded-lg border border-primary/25 bg-primary/[0.04] p-4 text-sm text-foreground/80">
          <strong className="text-primary font-semibold">Mode model.</strong>{" "}
          DraftKings encara no ha publicat mercats per a aquests partits. Mostrem totes les quotes derivades del model Poisson; es marcaran com a <span className="text-accent font-semibold">live</span> automàticament quan es publiquin.
        </div>
      )}

      {/* ============== APOSTA DEL DIA ============== */}
      {apostaDelDia && (
        <ApostaDelDiaHero
          bet={apostaDelDia}
          bankroll={bankroll}
          match={data?.matches.find((m) => m.matchId === apostaDelDia.matchId) ?? null}
          league={leagueByMatch.get(apostaDelDia.matchId) ?? null}
          slip={slip}
        />
      )}

      {/* ============== BANKROLL PLAN ============== */}
      {bankrollPlan && (
        <BankrollPlanCard
          plan={bankrollPlan}
          bankroll={bankroll}
          mode={filters.mode}
          slip={slip}
          leagueByMatch={leagueByMatch}
        />
      )}

      {/* ============== HERO METRICS ============== */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Stat label="Partits en directe" value={live.length} icon={<Flame className="w-4 h-4" />} tint="text-red-300" />
        <Stat label="Pròxims partits"    value={upcoming.length} icon={<Clock className="w-4 h-4" />} tint="text-primary" />
        <Stat label="Apostes simples"    value={sg?.simples.length ?? 0} icon={<TrendingUp className="w-4 h-4" />} tint="text-accent" />
        <Stat label="Combinades"         value={sg?.combos.length ?? 0} icon={<Layers className="w-4 h-4" />} tint="text-amber-300" />
      </section>

      {/* ============== HERO PICKS · PODIUM ============== */}
      {heroPicks.length > 0 && (
        <section className="mb-8">
          <SectionHeader
            title="Top apostes del dia"
            subtitle="Les apostes amb millor relació probabilitat × quota d'avui. Busquem el punt dolç: el més probable possible amb la quota més alta possible. Els segells Joia i Valor són els que combinen tots dos."
            icon={<Star className="w-5 h-5" />}
          />
          {/* Podium row: top 3 picks first, larger and more emphatic. */}
          {(() => {
            const podium = heroPicks.slice(0, 3);
            const rest   = heroPicks.slice(3, 9);
            return (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                  {podium.map((b, i) => (
                    <HeroPickCard key={b.id} bet={b} bankroll={bankroll} rank={i + 1} matchById={data?.matches} league={leagueByMatch.get(b.matchId) ?? null} slip={slip} />
                  ))}
                </div>
                {rest.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {rest.map((b, i) => (
                      <HeroPickCard key={b.id} bet={b} bankroll={bankroll} rank={i + 4} matchById={data?.matches} league={leagueByMatch.get(b.matchId) ?? null} slip={slip} />
                    ))}
                  </div>
                )}
              </>
            );
          })()}
        </section>
      )}

      {/* ============== FILTERS BAR ============== */}
      <FiltersBar
        filters={filters}
        onChange={setFilters}
        edgeOnly={edgeOnly}
        onToggleEdgeOnly={() => setEdgeOnly((v) => !v)}
        totalMatches={data?.matches.length ?? 0}
        shownMatches={filteredMatches.length}
        totalSimples={sg?.simples.length ?? 0}
        shownSimples={filteredSimples.length}
        leagues={availableLeagues}
      />

      {/* ============== MATCHES ============== */}
      <section className="mb-12" id="matches">
        <SectionHeader
          title="Quotes per partit"
          subtitle="Obre cada categoria amb les pestanyes. Punts verds = quotes reals DraftKings; punts ambres = del nostre model. Edge positiu = el mercat infravalora aquesta opció."
          icon={<Gauge className="w-5 h-5" />}
        />
        {board.isLoading ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-72 w-full rounded-xl" />)}
          </div>
        ) : board.isError ? (
          <ErrorBlock />
        ) : filteredMatches.length === 0 ? (
          <EmptyBlock label={data && data.matches.length > 0 ? "Cap partit coincideix amb els filtres actuals." : "No hi ha partits a la finestra."} />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {filteredMatches.map((m) => <MatchCard key={m.matchId} match={m} bankroll={bankroll} edgeOnly={edgeOnly} slip={slip} />)}
          </div>
        )}
      </section>

      {/* ============== SIMPLE BETS ============== */}
      <section className="mb-12" id="simples">
        <div className="mb-4 flex flex-col md:flex-row md:items-end md:justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-xl md:text-2xl font-semibold tracking-tight">
              <span className="text-primary"><ShieldCheck className="w-5 h-5" /></span>
              Apostes simples
            </h2>
            <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
              Cada selecció combina probabilitat i quota. Per defecte ordenem per <span className="text-primary font-semibold">valor</span> (prob × quota): el millor compromís entre seguretat i quota alta.
            </p>
          </div>
          <SortPicker value={filters.sort} onChange={(s) => setFilters({ ...filters, sort: s })} />
        </div>
        {suggestions.isLoading ? (
          <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}</div>
        ) : suggestions.isError ? (
          <ErrorBlock />
        ) : filteredSimples.length === 0 ? (
          <EmptyBlock label="No hem trobat apostes simples amb prou confiança per als filtres actuals." />
        ) : (
          <div className="matte-card rounded-xl overflow-hidden">
            <div className="hidden md:grid grid-cols-12 gap-2 px-4 py-3 text-[11px] uppercase tracking-[0.16em] text-muted-foreground border-b border-border/60">
              <div className="col-span-1">#</div>
              <div className="col-span-3">Partit</div>
              <div className="col-span-3">Selecció</div>
              <div className="col-span-1 text-center">Quota</div>
              <div className="col-span-1 text-center">Prob.</div>
              <div className="col-span-1 text-center" title="Valor esperat (prob × quota)">VE</div>
              <div className="col-span-1 text-right">Guany</div>
              <div className="col-span-1 text-right">Tipus</div>
            </div>
            {filteredSimples.map((b, i) => <SimpleBetRow key={b.id} bet={b} index={i + 1} bankroll={bankroll} league={leagueByMatch.get(b.matchId) ?? null} slip={slip} />)}
          </div>
        )}
      </section>

      {/* ============== SAFE COMBOS · DUO SEGURA ============== */}
      {sg && sg.safeCombos && sg.safeCombos.length > 0 && (
        <section className="mb-8" id="safe-combos">
          <SectionHeader
            title="Duo Segura · combinades de mínim risc"
            subtitle="Combinacions on cada cama té >65% de probabilitat individual i la probabilitat conjunta supera el 45%. Multipliquen la quota mantenint la seguretat: el punt dolç entre simple i combinada."
            icon={<ShieldCheck className="w-5 h-5" />}
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {sg.safeCombos.map((c) => (
              <div key={c.id} className="relative">
                <div className="absolute -top-2 left-3 z-10 inline-flex items-center gap-1 rounded-full bg-emerald-500/15 ring-1 ring-emerald-500/40 text-emerald-300 text-[10px] uppercase tracking-[0.16em] px-2 py-0.5 font-bold">
                  <ShieldCheck className="w-3 h-3" /> Mínim risc
                </div>
                <ComboCard combo={c} bankroll={bankroll} slip={slip} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ============== COMBOS ============== */}
      <section className="mb-8" id="combos">
        <SectionHeader
          title="Combinades · de menys a més risc"
          subtitle="Combinacions que ajunten les seleccions individuals més fortes de partits diferents (per mantenir la independència)."
          icon={<Sparkles className="w-5 h-5" />}
        />
        {suggestions.isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{[...Array(2)].map((_, i) => <Skeleton key={i} className="h-48 rounded-xl" />)}</div>
        ) : suggestions.isError ? (
          <ErrorBlock />
        ) : !sg || sg.combos.length === 0 ? (
          <EmptyBlock label="Cal almenys 2 partits amb seleccions de confiança per construir combinades." />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {sg.combos.map((c) => <ComboCard key={c.id} combo={c} bankroll={bankroll} slip={slip} />)}
          </div>
        )}
      </section>

      {/* ============== FLOATING BET SLIP ============== */}
      <BetSlipPanel slip={slip} bankroll={bankroll} />
    </Layout>
  );
}

// ---------------------------------------------------------------------------
// Sub-components: layout primitives
// ---------------------------------------------------------------------------
function Stat({ label, value, icon, tint }: { label: string; value: number | string; icon: React.ReactNode; tint: string }) {
  return (
    <div className="matte-card rounded-xl p-4">
      <div className="flex items-center justify-between mb-2 text-muted-foreground">
        <span className="text-[11px] uppercase tracking-[0.18em]">{label}</span>
        <span className={tint}>{icon}</span>
      </div>
      <div className="text-3xl font-semibold tracking-tight font-mono">{value}</div>
    </div>
  );
}

function SectionHeader({ title, subtitle, icon }: { title: string; subtitle: string; icon: React.ReactNode }) {
  return (
    <div className="mb-4 flex flex-col md:flex-row md:items-end md:justify-between gap-2">
      <div>
        <h2 className="flex items-center gap-2 text-xl md:text-2xl font-semibold tracking-tight">
          <span className="text-primary">{icon}</span> {title}
        </h2>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">{subtitle}</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Range slider — used in FiltersBar for prob/odds floors.
// ---------------------------------------------------------------------------
function RangeSlider({
  label, value, min, max, step, onChange, format, tint,
}: {
  label: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void; format: (v: number) => string; tint: string;
}) {
  return (
    <label className="flex items-center gap-2 min-w-[150px] flex-1 max-w-[260px]">
      <span className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground font-semibold whitespace-nowrap">{label}</span>
      <input
        type="range"
        min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="flex-1 h-1 accent-primary cursor-pointer"
      />
      <span className={`text-[11px] font-mono font-semibold tabular-nums w-12 text-right ${tint}`}>{format(value)}</span>
    </label>
  );
}

// ---------------------------------------------------------------------------
// Bankroll plan card — aggregates the day's recommended Kelly stakes,
// expected profit, and probability of beating the day. The user's headline
// metric for "what should I do today to win money safely?".
// ---------------------------------------------------------------------------
type BankrollPlan = {
  picks: SimpleBet[];
  totalStake: number;
  totalEv: number;
  totalReturnIfAllWin: number;
  avgProb: number;
  probAtLeastHalf: number;
  leagueCount: number;
  matchCount: number;
  need: number;
};

function BankrollPlanCard({
  plan, bankroll, mode, slip, leagueByMatch,
}: {
  plan: BankrollPlan;
  bankroll: number;
  mode: RiskMode;
  slip: ReturnType<typeof useBetSlip>;
  leagueByMatch: Map<number, League>;
}) {
  const stakePct = bankroll > 0 ? (plan.totalStake / bankroll) * 100 : 0;
  const roiPct   = plan.totalStake > 0 ? (plan.totalEv / plan.totalStake) * 100 : 0;
  const allInSlip = () => {
    for (const p of plan.picks) {
      slip.add({
        id: p.id, matchId: p.matchId, matchLabel: p.matchLabel,
        market: p.market, selection: p.selection, odds: p.odds, modelProb: p.modelProb, source: p.source,
      });
    }
  };
  const modeLabel = mode === "conservador" ? "Conservador" : mode === "agressiu" ? "Agressiu" : "Equilibrat";
  return (
    <section className="mb-8 rounded-2xl border border-emerald-500/25 bg-gradient-to-br from-emerald-950/30 via-background/60 to-amber-950/15 p-5 md:p-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-5">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/15 ring-1 ring-emerald-500/40 flex items-center justify-center">
            <ShieldCheck className="w-6 h-6 text-emerald-300" />
          </div>
          <div>
            <h2 className="text-lg md:text-xl font-bold tracking-tight">Pla de banca d'avui</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Cartera Kelly fraccional · Mode <span className="text-emerald-300 font-semibold">{modeLabel}</span> · {plan.matchCount} partits · {plan.leagueCount} lligues
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={allInSlip}
          className="shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 ring-1 ring-emerald-500/40 text-xs uppercase tracking-[0.14em] font-bold transition-colors"
        >
          <Layers className="w-3.5 h-3.5" /> Afegir tot al butlletí
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <PlanStat
          label="Inversió suggerida"
          value={`${plan.totalStake.toFixed(2)} €`}
          sub={`${stakePct.toFixed(1)}% banca`}
          tint="text-foreground"
        />
        <PlanStat
          label="Guany esperat"
          value={`${plan.totalEv >= 0 ? "+" : ""}${plan.totalEv.toFixed(2)} €`}
          sub={`ROI ${roiPct >= 0 ? "+" : ""}${roiPct.toFixed(1)}%`}
          tint={plan.totalEv >= 0 ? "text-emerald-300" : "text-red-300"}
        />
        <PlanStat
          label={`Prob. ≥${plan.need} encerts`}
          value={`${(plan.probAtLeastHalf * 100).toFixed(0)}%`}
          sub={`Mitjana ${(plan.avgProb * 100).toFixed(0)}%`}
          tint="text-amber-300"
        />
        <PlanStat
          label="Si tot guanya"
          value={`${plan.totalReturnIfAllWin.toFixed(2)} €`}
          sub={`×${plan.totalStake > 0 ? (plan.totalReturnIfAllWin / plan.totalStake).toFixed(2) : "0.00"} multiplicador`}
          tint="text-primary"
        />
      </div>

      {/* Mini list of picks composing the plan */}
      <div className="space-y-1.5">
        {plan.picks.map((p, i) => {
          const stake = kellyStakeEur(p.kellyFraction, bankroll);
          const lg = leagueByMatch.get(p.matchId);
          const inSlip = slip.has(p.id);
          return (
            <div key={p.id} className="flex items-center gap-2 text-xs px-3 py-2 rounded-md bg-background/40 ring-1 ring-border/40 hover:ring-border/80 transition-colors">
              <span className="font-mono text-muted-foreground w-5 shrink-0">{i + 1}.</span>
              {lg && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: lg.color }} />}
              <span className="text-foreground/90 truncate flex-1 min-w-0">
                <span className="text-muted-foreground">{p.matchLabel}</span> · <span className="font-semibold">{p.selection}</span>
              </span>
              <span className="font-mono text-emerald-300 tabular-nums shrink-0">{Math.round(p.modelProb * 100)}%</span>
              <span className="font-mono text-primary tabular-nums shrink-0">@{p.odds.toFixed(2)}</span>
              <span className="font-mono text-foreground tabular-nums shrink-0 w-14 text-right">{stake.toFixed(2)}€</span>
              <button
                type="button"
                onClick={() => slip.toggle({
                  id: p.id, matchId: p.matchId, matchLabel: p.matchLabel,
                  market: p.market, selection: p.selection, odds: p.odds, modelProb: p.modelProb, source: p.source,
                })}
                className={
                  "shrink-0 px-1.5 py-0.5 rounded text-[10px] uppercase tracking-[0.12em] font-bold ring-1 ring-inset transition-colors " +
                  (inSlip
                    ? "bg-emerald-500/15 text-emerald-300 ring-emerald-500/40"
                    : "bg-muted/20 text-muted-foreground ring-border/60 hover:text-foreground")
                }
                title={inSlip ? "Treure del butlletí" : "Afegir al butlletí"}
              >
                {inSlip ? "✓" : "+"}
              </button>
            </div>
          );
        })}
      </div>
      <p className="mt-4 text-[11px] text-muted-foreground/80 leading-relaxed">
        <strong className="text-foreground/80">Com llegir-ho:</strong> Si avui apostes <span className="text-emerald-300 font-semibold">{plan.totalStake.toFixed(2)} €</span> repartits en aquests {plan.picks.length} picks, el model espera un guany net de <span className={plan.totalEv >= 0 ? "text-emerald-300 font-semibold" : "text-red-300 font-semibold"}>{plan.totalEv >= 0 ? "+" : ""}{plan.totalEv.toFixed(2)} €</span> per dia mitjà. Hi ha un <span className="text-amber-300 font-semibold">{(plan.probAtLeastHalf * 100).toFixed(0)}%</span> de probabilitat que almenys {plan.need} dels {plan.picks.length} picks surtin guanyadors (assumint independència).
      </p>
    </section>
  );
}

function PlanStat({ label, value, sub, tint }: { label: string; value: string; sub: string; tint: string }) {
  return (
    <div className="rounded-lg border border-border/40 bg-background/40 px-3 py-2.5">
      <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground font-semibold">{label}</div>
      <div className={`text-xl md:text-2xl font-bold font-mono tabular-nums tracking-tight mt-0.5 ${tint}`}>{value}</div>
      <div className="text-[10px] text-muted-foreground/70 mt-0.5">{sub}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Filters bar (sticky)
// ---------------------------------------------------------------------------
function FiltersBar({
  filters, onChange, edgeOnly, onToggleEdgeOnly,
  totalMatches, shownMatches, totalSimples, shownSimples,
  leagues,
}: {
  filters: Filters; onChange: (f: Filters) => void;
  edgeOnly: boolean; onToggleEdgeOnly: () => void;
  totalMatches: number; shownMatches: number;
  totalSimples: number; shownSimples: number;
  leagues: League[];
}) {
  const RISK_OPTIONS: { v: RiskFilter; label: string }[] = [
    { v: "all", label: "Tots" },
    { v: "molt baix", label: "Molt baix" },
    { v: "baix", label: "Baix" },
    { v: "moderat", label: "Moderat" },
    { v: "alt", label: "Alt" },
  ];
  const isFiltered = filters.risk !== "all" || filters.query !== "" || filters.source !== "all" || filters.league !== "all" || filters.minProb > 0.45 || filters.minOdds > 1.30;
  const MODE_OPTIONS: { v: RiskMode; label: string; sub: string; iconColor: string }[] = [
    { v: "conservador", label: "Conservador", sub: "≥62% prob", iconColor: "text-emerald-300" },
    { v: "equilibrat",  label: "Equilibrat",  sub: "Per defecte", iconColor: "text-primary" },
    { v: "agressiu",    label: "Agressiu",    sub: "Quotes altes", iconColor: "text-amber-300" },
  ];
  return (
    <div className="sticky top-16 z-10 -mx-4 md:-mx-8 px-4 md:px-8 py-3 mb-6 backdrop-blur-md bg-background/80 border-y border-border/60">
      {/* Strategic mode + thresholds row */}
      <div className="flex flex-col lg:flex-row lg:items-center gap-3 mb-3 pb-3 border-b border-border/40">
        <div className="flex items-center gap-2 shrink-0">
          <ShieldCheck className="w-4 h-4 text-emerald-300" />
          <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground font-semibold">Estratègia</span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {MODE_OPTIONS.map((o) => {
            const active = filters.mode === o.v;
            return (
              <button
                key={o.v}
                type="button"
                onClick={() => onChange(applyRiskMode(filters, o.v))}
                title={`Mode ${o.label} — ${o.sub}`}
                className={
                  "flex flex-col items-start gap-0 px-3 py-1.5 rounded-md ring-1 ring-inset transition-colors " +
                  (active
                    ? "bg-primary/15 text-primary ring-primary/40"
                    : "bg-muted/20 text-muted-foreground ring-border/60 hover:text-foreground hover:bg-muted/40")
                }
              >
                <span className="text-[11px] uppercase tracking-[0.14em] font-bold leading-tight">{o.label}</span>
                <span className="text-[9px] uppercase tracking-[0.10em] opacity-70 leading-tight">{o.sub}</span>
              </button>
            );
          })}
        </div>
        <div className="flex flex-1 items-center gap-4 min-w-0">
          <RangeSlider
            label="Prob. mín."
            value={filters.minProb}
            min={0.30} max={0.85} step={0.01}
            format={(v) => `${Math.round(v * 100)}%`}
            onChange={(v) => onChange({ ...filters, minProb: v })}
            tint="text-emerald-300"
          />
          <RangeSlider
            label="Quota mín."
            value={filters.minOdds}
            min={1.10} max={3.00} step={0.05}
            format={(v) => v.toFixed(2)}
            onChange={(v) => onChange({ ...filters, minOdds: v })}
            tint="text-primary"
          />
        </div>
      </div>

      <div className="flex flex-col lg:flex-row lg:items-center gap-3">
        <div className="flex items-center gap-2 shrink-0">
          <Filter className="w-4 h-4 text-primary" />
          <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground font-semibold">Filtres</span>
        </div>

        {/* Risk chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto -mx-1 px-1 py-0.5">
          {RISK_OPTIONS.map((o) => {
            const active = filters.risk === o.v;
            const s = RISK_STYLES[o.v as string];
            return (
              <button
                key={o.v}
                type="button"
                onClick={() => onChange({ ...filters, risk: o.v })}
                className={
                  "shrink-0 text-[11px] uppercase tracking-[0.14em] px-2.5 py-1.5 rounded-md ring-1 ring-inset font-semibold transition-colors " +
                  (active
                    ? (s ? `${s.bg} ${s.color} ${s.ring}` : "bg-primary/15 text-primary ring-primary/40")
                    : "bg-muted/20 text-muted-foreground ring-border/60 hover:text-foreground hover:bg-muted/40")
                }
              >
                {o.v !== "all" && s && <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1.5 ${s.dot} align-middle`} />}
                {o.label}
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div className="relative flex-1 min-w-[180px] max-w-md">
          <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            placeholder="Cerca un equip o selecció…"
            value={filters.query}
            onChange={(e) => onChange({ ...filters, query: e.target.value })}
            className="w-full bg-muted/20 border border-border/60 rounded-md pl-8 pr-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary/40 focus:border-primary/40 placeholder:text-muted-foreground/60"
          />
        </div>

        {/* Source toggle */}
        <button
          type="button"
          onClick={() => onChange({ ...filters, source: filters.source === "live" ? "all" : "live" })}
          className={
            "shrink-0 text-[11px] uppercase tracking-[0.14em] px-2.5 py-1.5 rounded-md ring-1 ring-inset font-semibold transition-colors flex items-center gap-1.5 " +
            (filters.source === "live"
              ? "bg-accent/10 text-accent ring-accent/40"
              : "bg-muted/20 text-muted-foreground ring-border/60 hover:text-foreground hover:bg-muted/40")
          }
        >
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-accent" />
          Només DraftKings
        </button>

        <button
          type="button"
          onClick={onToggleEdgeOnly}
          className={
            "shrink-0 text-[11px] uppercase tracking-[0.14em] px-2.5 py-1.5 rounded-md ring-1 ring-inset font-semibold transition-colors flex items-center gap-1.5 " +
            (edgeOnly
              ? "bg-accent/10 text-accent ring-accent/40"
              : "bg-muted/20 text-muted-foreground ring-border/60 hover:text-foreground hover:bg-muted/40")
          }
          title="Mostra només els mercats on el model troba valor (edge > +2%)"
        >
          {edgeOnly ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
          Només edges +
        </button>

        {isFiltered && (
          <button
            type="button"
            onClick={() => onChange(DEFAULT_FILTERS)}
            className="shrink-0 text-[11px] uppercase tracking-[0.14em] text-muted-foreground hover:text-foreground transition-colors"
          >
            Esborra filtres
          </button>
        )}
      </div>

      {/* League chips — second row */}
      {leagues.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto -mx-1 px-1 py-1 mt-2">
          <span className="shrink-0 text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-semibold mr-1">Lligues</span>
          <button
            type="button"
            onClick={() => onChange({ ...filters, league: "all" })}
            className={
              "shrink-0 text-[11px] uppercase tracking-[0.14em] px-2.5 py-1.5 rounded-md ring-1 ring-inset font-semibold transition-colors " +
              (filters.league === "all"
                ? "bg-primary/15 text-primary ring-primary/40"
                : "bg-muted/20 text-muted-foreground ring-border/60 hover:text-foreground hover:bg-muted/40")
            }
          >
            Totes
            <span className="ml-1.5 font-mono text-[10px] text-muted-foreground/80">{leagues.length}</span>
          </button>
          {leagues.map((lg) => {
            const active = filters.league === lg.code;
            return (
              <button
                key={lg.code}
                type="button"
                onClick={() => onChange({ ...filters, league: active ? "all" : lg.code })}
                className={
                  "shrink-0 text-[11px] uppercase tracking-[0.14em] px-2.5 py-1.5 rounded-md ring-1 ring-inset font-semibold transition-colors flex items-center gap-1.5 " +
                  (active
                    ? "bg-primary/15 text-primary ring-primary/40"
                    : "bg-muted/20 text-muted-foreground ring-border/60 hover:text-foreground hover:bg-muted/40")
                }
                title={`${lg.country} · ${lg.name}`}
              >
                <span
                  className="inline-block w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: lg.color }}
                />
                {lg.shortName}
              </button>
            );
          })}
        </div>
      )}

      <div className="flex items-center gap-4 mt-2 text-[10px] uppercase tracking-[0.16em] text-muted-foreground font-mono">
        <span>{shownMatches}/{totalMatches} partits</span>
        <span>{shownSimples}/{totalSimples} apostes simples</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Best picks per match (3 strategic picks: safe / value / bold)
// ---------------------------------------------------------------------------
const PICK_FLAVORS = {
  safe: {
    label: "Segura",
    sub: "Mín. risc",
    color: "emerald",
    icon: Lock,
    accent: "text-emerald-300",
    border: "border-emerald-500/40",
    bgSoft: "bg-emerald-500/[0.07]",
    bgRing: "ring-emerald-500/30",
    chip: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
    glow: "from-emerald-500/[0.1]",
  },
  value: {
    label: "Valor",
    sub: "Sweet spot",
    color: "amber",
    icon: Scale,
    accent: "text-amber-300",
    border: "border-amber-500/45",
    bgSoft: "bg-amber-500/[0.08]",
    bgRing: "ring-amber-500/35",
    chip: "bg-amber-500/15 text-amber-300 ring-amber-500/35",
    glow: "from-amber-500/[0.14]",
  },
  bold: {
    label: "Atrevida",
    sub: "Màx. quota",
    color: "rose",
    icon: Rocket,
    accent: "text-rose-300",
    border: "border-rose-500/40",
    bgSoft: "bg-rose-500/[0.07]",
    bgRing: "ring-rose-500/30",
    chip: "bg-rose-500/15 text-rose-300 ring-rose-500/30",
    glow: "from-rose-500/[0.1]",
  },
} as const;

type PickFlavor = keyof typeof PICK_FLAVORS;

function BestPicksBar({ bestPicks, bankroll, slip, match }: { bestPicks: MatchBestPicks; bankroll: number; slip: ReturnType<typeof useBetSlip>; match: BoardMatch }) {
  const items: { flavor: PickFlavor; pick: MatchPick }[] = [];
  if (bestPicks.safe) items.push({ flavor: "safe", pick: bestPicks.safe });
  if (bestPicks.value) items.push({ flavor: "value", pick: bestPicks.value });
  if (bestPicks.bold) items.push({ flavor: "bold", pick: bestPicks.bold });

  if (items.length === 0) {
    return (
      <div className="px-4 py-3 border-y border-border/50 text-[11px] uppercase tracking-[0.16em] text-muted-foreground text-center">
        Sense apostes prou fiables per a aquest partit
      </div>
    );
  }

  return (
    <div className="px-3 py-3 border-y border-border/50 bg-gradient-to-b from-white/[0.015] to-transparent">
      <div className="flex items-center gap-1.5 mb-2 px-1">
        <Sparkles className="w-3 h-3 text-primary" />
        <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-semibold">
          Millors apostes d'aquest partit
        </span>
      </div>
      <div className={"grid gap-2 " + (items.length === 3 ? "grid-cols-3" : items.length === 2 ? "grid-cols-2" : "grid-cols-1")}>
        {items.map(({ flavor, pick }) => (
          <BestPickCard key={pick.key} flavor={flavor} pick={pick} bankroll={bankroll} slip={slip} match={match} />
        ))}
      </div>
    </div>
  );
}

function BestPickCard({ flavor, pick, bankroll, slip, match }: { flavor: PickFlavor; pick: MatchPick; bankroll: number; slip: ReturnType<typeof useBetSlip>; match: BoardMatch }) {
  const f = PICK_FLAVORS[flavor];
  const Icon = f.icon;
  const stake = kellyStakeEur(pick.kellyFraction, bankroll);
  const profit = stake > 0 ? stake * pick.odds - stake : bankroll * pick.odds - bankroll;
  const slipId = `${match.matchId}-${pick.key}`;
  const inSlip = slip.has(slipId);
  return (
    <div
      className={
        "relative overflow-hidden rounded-lg border " + f.border + " " + f.bgSoft +
        " p-2.5 flex flex-col gap-1.5 transition-transform hover:-translate-y-0.5"
      }
    >
      <div className={"absolute -top-6 -right-6 w-16 h-16 rounded-full blur-2xl bg-gradient-to-br " + f.glow + " to-transparent pointer-events-none"} />
      <div className="flex items-center justify-between gap-1.5">
        <span className={"inline-flex items-center gap-1 text-[9px] uppercase tracking-[0.16em] font-bold px-1.5 py-0.5 rounded ring-1 ring-inset " + f.chip}>
          <Icon className="w-2.5 h-2.5" />
          {f.label}
        </span>
        <span className={"font-mono text-[15px] font-bold tabular-nums " + f.accent}>
          {pick.odds.toFixed(2)}
        </span>
      </div>
      <div className="text-[11px] text-muted-foreground uppercase tracking-[0.12em] leading-tight">
        {pick.group}
      </div>
      <div className="text-[12.5px] font-semibold leading-tight line-clamp-2 min-h-[2.4em]">
        {pick.selection}
      </div>
      <ConfidenceBar confidence={pick.confidence} />
      <div className="flex items-center justify-between text-[10px] font-mono pt-1 border-t border-border/40">
        <span className="text-muted-foreground">
          <span className={f.accent + " font-semibold"}>{pct(pick.modelProb)}</span> prob
        </span>
        {stake > 0 && (
          <span className="text-primary/90 font-semibold" title="Aposta recomanada (Kelly)">
            <Calculator className="inline w-2.5 h-2.5 -mt-0.5 mr-0.5" />{eur(stake)}
          </span>
        )}
        <span className="text-accent font-semibold">+{eur(profit)}</span>
      </div>
      <button
        type="button"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); slip.toggle({ id: slipId, matchId: match.matchId, matchLabel: `${match.homeShort} vs ${match.awayShort}`, market: pick.group, selection: pick.selection, odds: pick.odds, modelProb: pick.modelProb, source: pick.source }); }}
        className={
          "mt-1 w-full text-[10px] uppercase tracking-[0.14em] font-semibold py-1 rounded transition-colors flex items-center justify-center gap-1 " +
          (inSlip ? "bg-accent/20 text-accent ring-1 ring-inset ring-accent/40" : "bg-white/[0.04] text-muted-foreground hover:bg-white/[0.08] hover:text-foreground ring-1 ring-inset ring-border/40")
        }
      >
        {inSlip ? <><Check className="w-3 h-3" /> Al butlletí</> : <><Plus className="w-3 h-3" /> Afegir al butlletí</>}
      </button>
    </div>
  );
}

function ConfidenceBar({ confidence }: { confidence: number }) {
  const pctVal = Math.max(0, Math.min(1, confidence));
  const tier = pctVal >= 0.7 ? { color: "bg-accent", label: "Alta" } : pctVal >= 0.45 ? { color: "bg-amber-400", label: "Mitjana" } : { color: "bg-orange-400", label: "Baixa" };
  return (
    <div className="flex items-center gap-1.5" title={`Confiança ${tier.label} · ${(pctVal * 100).toFixed(0)}%`}>
      <ShieldCheck className="w-2.5 h-2.5 text-muted-foreground/70 shrink-0" />
      <div className="flex-1 h-1 rounded-full bg-white/[0.06] overflow-hidden">
        <div className={"h-full " + tier.color} style={{ width: `${(pctVal * 100).toFixed(0)}%` }} />
      </div>
      <span className="text-[9px] text-muted-foreground font-mono tabular-nums">{(pctVal * 100).toFixed(0)}</span>
    </div>
  );
}

function LeagueBadge({ league, compact = false }: { league: League; compact?: boolean }) {
  return (
    <span
      className={
        "inline-flex items-center gap-1.5 uppercase tracking-[0.14em] font-semibold rounded ring-1 ring-inset " +
        (compact ? "text-[9px] px-1.5 py-0.5" : "text-[10px] px-2 py-0.5")
      }
      style={{
        color: league.color,
        backgroundColor: `${league.color}14`,
        boxShadow: `inset 0 0 0 1px ${league.color}55`,
      }}
      title={`${league.country} · ${league.name}`}
    >
      <span
        className="inline-block rounded-full shrink-0"
        style={{ width: 6, height: 6, backgroundColor: league.color }}
      />
      {league.shortName}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Hero pick card
// ---------------------------------------------------------------------------
function ValueStars({ value }: { value: number }) {
  // value = prob * odds. 1.0 = fair. We map [0.95..1.40+] to 1..5 stars.
  const score = Math.max(1, Math.min(5, Math.round((value - 0.85) * 8)));
  return (
    <span className="inline-flex items-center gap-0.5" title={`Valor esperat ×${value.toFixed(2)}`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={"w-2.5 h-2.5 " + (i <= score ? "fill-amber-300 text-amber-300" : "text-muted-foreground/30")}
        />
      ))}
    </span>
  );
}

function HeroPickCard({
  bet, bankroll, rank, matchById, league, slip,
}: {
  bet: SimpleBet; bankroll: number; rank: number; matchById: BoardMatch[] | undefined; league: League | null; slip: ReturnType<typeof useBetSlip>;
}) {
  const match = matchById?.find((m) => m.matchId === bet.matchId);
  const stake = kellyStakeEur(bet.kellyFraction, bankroll);
  const payout = stake > 0 ? stake * bet.odds : bankroll * bet.odds;
  const profit = stake > 0 ? payout - stake : payout - bankroll;
  const valueScore = bet.modelProb * bet.odds;
  const slipId = bet.id;
  const inSlip = slip.has(slipId);
  return (
    <div className="matte-card matte-card-hover rounded-xl p-4 flex flex-col gap-3 group relative overflow-hidden">
      <div className="absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl opacity-20 bg-primary -mr-10 -mt-10 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-24 h-24 rounded-full blur-3xl opacity-10 bg-accent -ml-8 -mb-8 pointer-events-none" />

      <div className="flex items-center justify-between gap-2 flex-wrap relative">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="inline-grid place-items-center w-6 h-6 rounded-md bg-primary/15 ring-1 ring-primary/40 text-primary text-[11px] font-bold font-mono">
            {rank}
          </span>
          <QualityBadge tier={bet.qualityTier} compact />
          {league && <LeagueBadge league={league} compact />}
        </div>
        <span className={
          "text-[10px] uppercase tracking-[0.18em] font-semibold flex items-center gap-1 " +
          (bet.source === "live" ? "text-accent" : "text-primary")
        }>
          <span className={"inline-block w-1.5 h-1.5 rounded-full " + (bet.source === "live" ? "bg-accent" : "bg-primary/70")} />
          {bet.source === "live" ? "DK live" : "Model"}
        </span>
      </div>

      <div className="flex items-center gap-2 relative">
        {match?.homeCrest && <img src={match.homeCrest} alt="" className="w-6 h-6 object-contain" />}
        <span className="text-sm font-semibold truncate">{bet.matchLabel}</span>
        {match?.awayCrest && <img src={match.awayCrest} alt="" className="w-6 h-6 object-contain ml-auto" />}
      </div>

      <div className="relative">
        <div className="flex items-center justify-between gap-2">
          <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{bet.market}</div>
          <ValueStars value={valueScore} />
        </div>
        <div className="text-base font-semibold mt-0.5 leading-tight">{bet.selection}</div>
        <div className="mt-2"><ConfidenceBar confidence={bet.confidence} /></div>
      </div>

      <div className="grid grid-cols-3 gap-2 pt-3 border-t border-border/40 relative">
        <div>
          <div className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground">Quota</div>
          <div className="font-mono text-lg font-bold text-primary leading-tight">{bet.odds.toFixed(2)}</div>
        </div>
        <div>
          <div className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground" title="Aposta recomanada (Kelly ¼)">Kelly</div>
          <div className="font-mono text-lg font-bold text-amber-300 leading-tight">{stake > 0 ? eur(stake) : "—"}</div>
        </div>
        <div className="text-right">
          <div className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground">{stake > 0 ? "Guany Kelly" : "Guany"}</div>
          <div className="font-mono text-lg font-bold text-accent leading-tight">+{eur(profit)}</div>
        </div>
      </div>

      <div className="flex items-center gap-2 relative">
        <div className="text-[10px] text-muted-foreground flex items-center gap-1 flex-1">
          {bet.status === "live" ? (
            <><span className="pulse-dot scale-75" /><span className="text-red-300">en directe</span></>
          ) : (
            <><Clock className="w-3 h-3" />{fmtKickoff(bet.kickoff)}</>
          )}
          <span className="ml-auto text-muted-foreground/60">VE ×{valueScore.toFixed(2)}</span>
        </div>
      </div>

      <button
        type="button"
        onClick={() => slip.toggle({ id: slipId, matchId: bet.matchId, matchLabel: bet.matchLabel, market: bet.market, selection: bet.selection, odds: bet.odds, modelProb: bet.modelProb, source: bet.source })}
        className={
          "w-full text-[11px] uppercase tracking-[0.14em] font-semibold py-2 rounded transition-colors flex items-center justify-center gap-1.5 " +
          (inSlip ? "bg-accent/20 text-accent ring-1 ring-inset ring-accent/40" : "bg-primary/10 text-primary hover:bg-primary/20 ring-1 ring-inset ring-primary/30")
        }
      >
        {inSlip ? <><Check className="w-3.5 h-3.5" /> Al butlletí</> : <><Plus className="w-3.5 h-3.5" /> Afegir al butlletí</>}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Match card with tabs
// ---------------------------------------------------------------------------
function groupMarkets(list: Market[]): Record<string, Market[]> {
  const grouped: Record<string, Market[]> = {};
  for (const mk of list) {
    if (!grouped[mk.group]) grouped[mk.group] = [];
    grouped[mk.group]!.push(mk);
  }
  return grouped;
}

function countPositiveEdges(list: Market[]): number {
  return list.filter((m) => (m.edge ?? 0) > 0.02).length;
}

function MatchCard({ match, bankroll, edgeOnly, slip }: { match: BoardMatch; bankroll: number; edgeOnly: boolean; slip: ReturnType<typeof useBetSlip> }) {
  const baseGrouped = useMemo(() => groupMarkets(match.markets), [match.markets]);
  // When edgeOnly, drop selections with edge <= +2% from each group
  const grouped = useMemo(() => {
    if (!edgeOnly) return baseGrouped;
    const out: Record<string, Market[]> = {};
    for (const g of Object.keys(baseGrouped)) {
      const filtered = baseGrouped[g]!.filter((m) => (m.edge ?? 0) > 0.02);
      if (filtered.length > 0) out[g] = filtered;
    }
    return out;
  }, [baseGrouped, edgeOnly]);
  const filteredPlayers = useMemo(() => {
    if (!edgeOnly) return match.playerMarkets;
    return match.playerMarkets
      .map((p) => ({ ...p, markets: p.markets.filter((m) => (m.edge ?? 0) > 0.02) }))
      .filter((p) => p.markets.length > 0);
  }, [match.playerMarkets, edgeOnly]);

  const [tab, setTab] = useState<string>("result");

  // Build tab data
  type TabRow = TabDef & { markets: Market[]; positives: number };
  const tabsData = useMemo<TabRow[]>(() => {
    const arr: TabRow[] = TAB_DEFS.map((t) => {
      const mks: Market[] = [];
      for (const g of t.groups) if (grouped[g]) mks.push(...grouped[g]!);
      return { ...t, markets: mks, positives: countPositiveEdges(mks) };
    }).filter((t) => t.markets.length > 0);

    if (filteredPlayers.length > 0) {
      const allPlayerMarkets = filteredPlayers.flatMap((p) => p.markets);
      arr.push({
        key: "players",
        label: "Jugadors",
        icon: Users,
        groups: [],
        markets: allPlayerMarkets,
        positives: countPositiveEdges(allPlayerMarkets),
      });
    }
    return arr;
  }, [grouped, filteredPlayers]);

  // Default tab = first available
  useEffect(() => {
    if (!tabsData.find((t) => t.key === tab) && tabsData[0]) setTab(tabsData[0].key);
  }, [tabsData, tab]);

  const activeTab = tabsData.find((t) => t.key === tab) ?? tabsData[0];

  return (
    <div className="matte-card matte-card-hover rounded-xl overflow-hidden flex flex-col">
      {/* HEADER */}
      <div className="px-4 py-3 flex items-center justify-between gap-2 border-b border-border/60 flex-wrap">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground min-w-0">
          {match.status === "live" ? (
            <>
              <span className="pulse-dot" />
              <span className="text-red-300 font-semibold">EN DIRECTE {match.minute ? `· ${match.minute}'` : ""}</span>
            </>
          ) : (
            <><Clock className="w-3.5 h-3.5 shrink-0" /> <span className="truncate">{fmtKickoff(match.kickoff)}</span></>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <LeagueBadge league={match.league} compact />
          <span
            className={
              "text-[10px] uppercase tracking-[0.18em] px-2 py-0.5 rounded " +
              (match.source === "live"
                ? "bg-accent/10 text-accent ring-1 ring-inset ring-accent/30"
                : "bg-primary/10 text-primary ring-1 ring-inset ring-primary/30")
            }
            title={match.bookmaker ? `Quotes reals via ${match.bookmaker}` : "Quotes derivades del model"}
          >
            {match.source === "live" ? `live · ${match.bookmaker ?? "draftkings"}` : "model"}
          </span>
        </div>
      </div>

      {/* TEAMS */}
      <div className="px-4 py-4 grid grid-cols-7 items-center gap-2">
        <div className="col-span-3 flex items-center gap-3 min-w-0">
          {match.homeCrest ? <img src={match.homeCrest} alt="" className="w-9 h-9 object-contain shrink-0" /> : <div className="w-9 h-9 rounded bg-muted shrink-0" />}
          <span className="font-semibold truncate">{match.homeShort}</span>
        </div>
        <div className="col-span-1 text-center">
          {match.status === "live" || match.homeScore != null ? (
            <div className="font-mono text-2xl font-semibold tracking-tight">{match.homeScore ?? 0}–{match.awayScore ?? 0}</div>
          ) : (
            <div className="text-muted-foreground text-sm font-medium">vs</div>
          )}
        </div>
        <div className="col-span-3 flex items-center gap-3 justify-end min-w-0">
          <span className="font-semibold truncate text-right">{match.awayShort}</span>
          {match.awayCrest ? <img src={match.awayCrest} alt="" className="w-9 h-9 object-contain shrink-0" /> : <div className="w-9 h-9 rounded bg-muted shrink-0" />}
        </div>
      </div>

      {/* 1X2 PROBABILITY BAR (model) */}
      <ProbabilityBar match={match} />

      {/* BEST PICKS — 3 strategic picks per match */}
      <BestPicksBar bestPicks={match.bestPicks} bankroll={bankroll} slip={slip} match={match} />

      {/* TABS */}
      <div className="border-b border-border/50 px-2 pt-2 flex items-center gap-1 overflow-x-auto">
        {tabsData.map((t) => {
          const Icon = t.icon;
          const active = t.key === activeTab?.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={
                "shrink-0 flex items-center gap-1.5 px-2.5 py-2 text-[11px] uppercase tracking-[0.14em] font-semibold rounded-t-md border-b-2 transition-colors " +
                (active
                  ? "border-primary text-primary bg-primary/[0.06]"
                  : "border-transparent text-muted-foreground hover:text-foreground")
              }
            >
              <Icon className="w-3.5 h-3.5" />
              {t.label}
              <span className="font-mono text-[10px] text-muted-foreground/80">{t.markets.length}</span>
              {t.positives > 0 && (
                <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-accent/20 text-accent text-[9px] font-mono">
                  {t.positives}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* TAB BODY */}
      <div className="p-3 space-y-3 flex-1">
        {activeTab?.key === "players" ? (
          <PlayersTab homePlayers={filteredPlayers.filter((p) => p.team === "home")} awayPlayers={filteredPlayers.filter((p) => p.team === "away")} match={match} slip={slip} />
        ) : activeTab ? (
          <ActiveMarketsTab grouped={grouped} groups={activeTab.groups} match={match} slip={slip} />
        ) : (
          <div className="text-xs text-muted-foreground text-center py-6">
            {edgeOnly ? "Cap mercat amb edge positiu en aquest partit." : "No hi ha mercats per a aquest partit."}
          </div>
        )}
      </div>

      {match.oddsLastUpdate && (
        <div className="px-4 py-2 border-t border-border/40 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          Actualitzat {relTime(match.oddsLastUpdate)}
        </div>
      )}
    </div>
  );
}

function ActiveMarketsTab({ grouped, groups, match, slip }: { grouped: Record<string, Market[]>; groups: string[]; match: BoardMatch; slip: ReturnType<typeof useBetSlip> }) {
  const presentGroups = groups.filter((g) => grouped[g]);
  return (
    <div className="space-y-3">
      {presentGroups.map((g) => (
        <div key={g}>
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-1.5 px-1">{g}</div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {grouped[g]!.map((mk) => <MarketChip key={mk.key} market={mk} group={g} match={match} slip={slip} />)}
          </div>
        </div>
      ))}
    </div>
  );
}

function PlayersTab({ homePlayers, awayPlayers, match, slip }: { homePlayers: PlayerMarket[]; awayPlayers: PlayerMarket[]; match: BoardMatch; slip: ReturnType<typeof useBetSlip> }) {
  return (
    <div className="space-y-3">
      {homePlayers.length > 0 && <PlayerSection title={match.homeShort} crest={match.homeCrest} players={homePlayers} match={match} slip={slip} />}
      {awayPlayers.length > 0 && <PlayerSection title={match.awayShort} crest={match.awayCrest} players={awayPlayers} match={match} slip={slip} />}
    </div>
  );
}

function PlayerSection({ title, crest, players, match, slip }: { title: string; crest: string; players: PlayerMarket[]; match: BoardMatch; slip: ReturnType<typeof useBetSlip> }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-1.5 px-1 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        {crest ? <img src={crest} alt="" className="w-3.5 h-3.5 object-contain" /> : null}
        {title}
      </div>
      <div className="space-y-2">
        {players.map((p) => <PlayerRow key={p.playerId} player={p} match={match} slip={slip} />)}
      </div>
    </div>
  );
}

function PlayerRow({ player, match, slip }: { player: PlayerMarket; match: BoardMatch; slip: ReturnType<typeof useBetSlip> }) {
  return (
    <div className="rounded-md border border-border/50 bg-muted/10 p-2.5">
      <div className="flex items-center gap-2 mb-2">
        {player.headshot ? (
          <img src={player.headshot} alt="" className="w-8 h-8 rounded-full object-cover bg-muted" />
        ) : (
          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-[10px] text-muted-foreground">
            {player.playerName.split(" ").map((s) => s[0]).slice(0, 2).join("")}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium truncate">{player.playerName}</div>
          <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            {player.positionLabel} · {player.seasonGoals}G · {player.seasonAssists}A
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {player.markets.map((mk) => <MarketChip key={mk.key} market={mk} group={`${player.playerName}`} match={match} slip={slip} />)}
      </div>
    </div>
  );
}

function MarketChip({ market, group, match, slip }: { market: Market; group: string; match: BoardMatch; slip: ReturnType<typeof useBetSlip> }) {
  const edge = market.edge ?? 0;
  const isPositive = edge > 0.02;
  const isNegative = edge < -0.05;
  const isLive = market.source === "live";
  const slipId = `${match.matchId}-${market.key}`;
  const inSlip = slip.has(slipId);
  const canAdd = !!market.odds && market.odds > 1.01;
  return (
    <div
      className={
        "relative rounded-md px-2.5 py-2 border flex flex-col gap-0.5 transition-colors " +
        (inSlip
          ? "border-accent/60 bg-accent/[0.1] ring-1 ring-inset ring-accent/30"
          : isPositive
            ? "border-accent/40 bg-accent/[0.06] hover:bg-accent/[0.1]"
            : isNegative
              ? "border-border/40 bg-muted/20 opacity-60"
              : "border-border/60 bg-muted/20 hover:bg-muted/30")
      }
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] truncate text-foreground/90 flex items-center gap-1">
          <span className={"inline-block w-1.5 h-1.5 rounded-full " + (isLive ? "bg-accent" : "bg-primary/70")}
            title={isLive ? "Quota real DraftKings" : "Quota generada pel model"}
          />
          <span className="truncate">{market.selection}</span>
        </span>
        <span className="font-mono text-sm font-semibold">{market.odds ? market.odds.toFixed(2) : "—"}</span>
      </div>
      <div className="flex items-center justify-between text-[10px] text-muted-foreground font-mono">
        <span>{pct(market.modelProb)}</span>
        {edge !== 0 && (
          <span className={isPositive ? "text-accent font-semibold" : isNegative ? "text-muted-foreground" : ""}>
            {edge > 0 ? "+" : ""}{(edge * 100).toFixed(1)}%
          </span>
        )}
      </div>
      {canAdd && (
        <button
          type="button"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); slip.toggle({ id: slipId, matchId: match.matchId, matchLabel: `${match.homeShort} vs ${match.awayShort}`, market: group, selection: market.selection, odds: market.odds!, modelProb: market.modelProb, source: market.source }); }}
          className={
            "mt-1 text-[9px] uppercase tracking-[0.14em] font-semibold py-0.5 rounded transition-colors flex items-center justify-center gap-1 " +
            (inSlip ? "bg-accent/20 text-accent" : "bg-white/[0.04] text-muted-foreground hover:bg-white/[0.1] hover:text-foreground")
          }
          title={inSlip ? "Treure del butlletí" : "Afegir al butlletí"}
        >
          {inSlip ? <><Check className="w-2.5 h-2.5" /> Al butlletí</> : <><Plus className="w-2.5 h-2.5" /> Afegir</>}
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Simple bet row
// ---------------------------------------------------------------------------
function SimpleBetRow({ bet, index, bankroll, league, slip }: { bet: SimpleBet; index: number; bankroll: number; league: League | null; slip: ReturnType<typeof useBetSlip> }) {
  const stake = kellyStakeEur(bet.kellyFraction, bankroll);
  const profit = stake > 0 ? stake * bet.odds - stake : bankroll * bet.odds - bankroll;
  const inSlip = slip.has(bet.id);
  return (
    <div className={"grid grid-cols-1 md:grid-cols-12 gap-2 px-4 py-3 border-b border-border/40 last:border-b-0 hover:bg-white/[0.02] transition-colors " + (inSlip ? "bg-accent/[0.04]" : "")}>
      <div className="hidden md:flex md:col-span-1 items-center gap-1.5">
        <span className="text-xs font-mono text-muted-foreground">{String(index).padStart(2, "0")}</span>
      </div>
      <div className="md:col-span-3 flex flex-col min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-medium text-sm truncate">{bet.matchLabel}</span>
          {league && <LeagueBadge league={league} compact />}
        </div>
        <span className="text-[11px] text-muted-foreground flex items-center gap-1">
          {bet.status === "live" ? (
            <><span className="pulse-dot scale-75" /><span className="text-red-300">en directe</span></>
          ) : (
            fmtKickoff(bet.kickoff)
          )}
        </span>
      </div>
      <div className="md:col-span-3 flex flex-col gap-1">
        <span className="font-semibold text-sm flex items-center gap-1.5">
          <span className={"inline-block w-1.5 h-1.5 rounded-full " + (bet.source === "live" ? "bg-accent" : "bg-primary/70")}
            title={bet.source === "live" ? "Quota real DraftKings" : "Quota del model"} />
          {bet.selection}
        </span>
        <span className="text-[11px] text-muted-foreground">{bet.market} · {bet.rationale}</span>
        <ConfidenceBar confidence={bet.confidence} />
      </div>
      <div className="md:col-span-1 text-center flex md:block items-center justify-between">
        <span className="md:hidden text-[10px] text-muted-foreground uppercase tracking-wider">Quota</span>
        <span className="font-mono font-semibold text-base">{bet.odds.toFixed(2)}</span>
      </div>
      <div className="md:col-span-1 text-center flex md:block items-center justify-between">
        <span className="md:hidden text-[10px] text-muted-foreground uppercase tracking-wider">Prob.</span>
        <span className="font-mono text-sm">{pct(bet.modelProb)}</span>
      </div>
      <div className="md:col-span-1 text-center flex md:block items-center justify-between" title="Valor esperat = probabilitat × quota. >1.00 = +EV.">
        <span className="md:hidden text-[10px] text-muted-foreground uppercase tracking-wider">VE</span>
        <span className={"font-mono text-sm font-semibold " + (bet.valueScore > 1.10 ? "text-accent" : bet.valueScore > 1.00 ? "text-lime-300" : "text-muted-foreground")}>
          ×{bet.valueScore.toFixed(2)}
        </span>
      </div>
      <div className="md:col-span-1 text-right flex md:block items-center justify-between">
        <span className="md:hidden text-[10px] text-muted-foreground uppercase tracking-wider">Aposta · Guany</span>
        <div className="md:flex md:flex-col md:items-end">
          <span className="font-mono text-sm font-semibold text-accent leading-tight">+{eur(profit)}</span>
          {stake > 0 && (
            <span className="font-mono text-[10px] text-amber-300/80 leading-tight" title="Aposta recomanada (Kelly ¼)">
              <Calculator className="inline w-2.5 h-2.5 -mt-0.5 mr-0.5" />{eur(stake)}
            </span>
          )}
        </div>
      </div>
      <div className="md:col-span-1 flex md:justify-end items-center gap-1.5">
        <QualityBadge tier={bet.qualityTier} compact />
        <button
          type="button"
          onClick={() => slip.toggle({ id: bet.id, matchId: bet.matchId, matchLabel: bet.matchLabel, market: bet.market, selection: bet.selection, odds: bet.odds, modelProb: bet.modelProb, source: bet.source })}
          className={
            "shrink-0 inline-grid place-items-center w-7 h-7 rounded-md transition-colors " +
            (inSlip
              ? "bg-accent/20 text-accent ring-1 ring-inset ring-accent/40"
              : "bg-white/[0.04] text-muted-foreground hover:bg-primary/15 hover:text-primary ring-1 ring-inset ring-border/40")
          }
          title={inSlip ? "Treure del butlletí" : "Afegir al butlletí"}
        >
          {inSlip ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Combo card
// ---------------------------------------------------------------------------
function ComboCard({ combo, bankroll, slip }: { combo: ComboBet; bankroll: number; slip: ReturnType<typeof useBetSlip> }) {
  const payout = bankroll * combo.combinedOdds;
  const profit = payout - bankroll;
  const valueScore = combo.combinedProb * combo.combinedOdds;
  // Add the entire combo to the slip in one click (replaces all current legs).
  const loadCombo = () => {
    slip.clear();
    for (const leg of combo.legs) {
      slip.add({
        id: `${leg.matchId}-${leg.market}-${leg.selection}`,
        matchId: leg.matchId,
        matchLabel: leg.matchLabel,
        market: leg.market,
        selection: leg.selection,
        odds: leg.odds,
        modelProb: leg.modelProb,
        source: leg.source,
      });
    }
  };
  return (
    <div className="matte-card matte-card-hover rounded-xl p-5 flex flex-col gap-4 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-40 h-40 rounded-full blur-3xl opacity-15 bg-primary -mr-12 -mt-12 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-32 h-32 rounded-full blur-3xl opacity-10 bg-accent -ml-10 -mb-10 pointer-events-none" />

      <div className="flex items-start justify-between gap-3 relative">
        <div>
          <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground flex items-center gap-1.5">
            <Layers className="w-3 h-3 text-primary" />
            Combinada · {combo.legs.length} cames
          </div>
          <div className="text-sm font-medium mt-1.5 max-w-md text-foreground/90 leading-snug">{combo.rationale}</div>
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <RiskPill tier={combo.riskTier} />
          <ValueStars value={valueScore} />
        </div>
      </div>

      <div className="space-y-1.5 relative">
        {combo.legs.map((leg, i) => (
          <div
            key={i}
            className="flex items-center gap-3 text-sm border border-border/40 rounded-md px-3 py-2 bg-black/20 hover:border-border/70 transition-colors"
          >
            <span className="inline-grid place-items-center w-5 h-5 rounded-full bg-primary/15 ring-1 ring-primary/30 text-primary text-[10px] font-bold font-mono">
              {i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <div className="font-medium truncate flex items-center gap-1.5">
                <span
                  className={"inline-block w-1.5 h-1.5 rounded-full shrink-0 " + (leg.source === "live" ? "bg-accent" : "bg-primary/70")}
                  title={leg.source === "live" ? "Quota real DraftKings" : "Quota model"}
                />
                <span className="truncate">{leg.matchLabel}</span>
              </div>
              <div className="text-[11px] text-muted-foreground truncate">{leg.market} · {leg.selection}</div>
            </div>
            <div className="text-right shrink-0">
              <div className="font-mono font-bold text-primary">{leg.odds.toFixed(2)}</div>
              <div className="text-[10px] text-emerald-300/80 font-mono">{pct(leg.modelProb)}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="relative grid grid-cols-2 gap-3 pt-3 border-t border-border/50">
        <div className="rounded-lg bg-primary/[0.08] ring-1 ring-inset ring-primary/25 p-3">
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Quota total</div>
          <div className="font-mono text-2xl font-bold text-primary tabular-nums leading-none mt-1">
            ×{combo.combinedOdds.toFixed(2)}
          </div>
          <div className="text-[10px] text-muted-foreground mt-1.5 font-mono">
            Prob conjunta {pct(combo.combinedProb)}
          </div>
        </div>
        <div className="rounded-lg bg-accent/[0.08] ring-1 ring-inset ring-accent/30 p-3">
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Aposta {eur(bankroll)} →
          </div>
          <div className="font-mono text-2xl font-bold text-accent tabular-nums leading-none mt-1">
            +{eur(profit)}
          </div>
          <div className="text-[10px] text-muted-foreground mt-1.5 font-mono">
            Retorn total {eur(payout)}
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={loadCombo}
        className="relative w-full text-[11px] uppercase tracking-[0.16em] font-bold py-2.5 rounded-md bg-primary/15 hover:bg-primary/25 text-primary ring-1 ring-inset ring-primary/40 transition-colors flex items-center justify-center gap-1.5"
      >
        <Layers className="w-3.5 h-3.5" />
        Carrega aquesta combinada al butlletí
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Aposta del dia — single highlighted "bet of the day" hero banner.
// ---------------------------------------------------------------------------
function ApostaDelDiaHero({ bet, bankroll, match, league, slip }: { bet: SimpleBet; bankroll: number; match: BoardMatch | null; league: League | null; slip: ReturnType<typeof useBetSlip> }) {
  const stake = kellyStakeEur(bet.kellyFraction, bankroll);
  const payout = stake > 0 ? stake * bet.odds : bankroll * bet.odds;
  const profit = stake > 0 ? payout - stake : payout - bankroll;
  const valueScore = bet.modelProb * bet.odds;
  const inSlip = slip.has(bet.id);
  return (
    <section className="mb-6">
      <div className="relative matte-card rounded-2xl p-5 md:p-6 overflow-hidden border border-primary/40">
        <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full blur-3xl bg-primary/30 pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 w-56 h-56 rounded-full blur-3xl bg-accent/20 pointer-events-none" />
        <div className="relative grid grid-cols-1 md:grid-cols-12 gap-5 md:gap-6 items-center">
          <div className="md:col-span-7 flex flex-col gap-3 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.22em] font-bold text-primary bg-primary/15 ring-1 ring-inset ring-primary/40 px-2 py-1 rounded">
                <Crown className="w-3 h-3" />
                Aposta del dia
              </span>
              <QualityBadge tier={bet.qualityTier} compact />
              {league && <LeagueBadge league={league} compact />}
              <RiskPill tier={bet.riskTier} compact />
              <span className={
                "text-[10px] uppercase tracking-[0.18em] font-semibold flex items-center gap-1 " +
                (bet.source === "live" ? "text-accent" : "text-primary")
              }>
                <span className={"inline-block w-1.5 h-1.5 rounded-full " + (bet.source === "live" ? "bg-accent" : "bg-primary/70")} />
                {bet.source === "live" ? "DK live" : "Model"}
              </span>
            </div>
            <div className="flex items-center gap-3">
              {match?.homeCrest && <img src={match.homeCrest} alt="" className="w-9 h-9 object-contain" />}
              <span className="text-base md:text-lg font-semibold truncate">{bet.matchLabel}</span>
              {match?.awayCrest && <img src={match.awayCrest} alt="" className="w-9 h-9 object-contain" />}
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{bet.market}</div>
              <div className="text-2xl md:text-3xl font-bold leading-tight mt-1">{bet.selection}</div>
              <div className="text-[12px] text-muted-foreground mt-1.5 leading-snug max-w-xl">{bet.rationale}</div>
            </div>
            <div className="max-w-md mt-1"><ConfidenceBar confidence={bet.confidence} /></div>
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground font-mono">
              {bet.status === "live" ? (
                <><span className="pulse-dot scale-75" /><span className="text-red-300">en directe</span></>
              ) : (
                <><Clock className="w-3 h-3" />{fmtKickoff(bet.kickoff)}</>
              )}
              <span className="ml-2 text-muted-foreground/70">VE ×{valueScore.toFixed(2)}</span>
              <ValueStars value={valueScore} />
            </div>
          </div>

          <div className="md:col-span-5 flex flex-col gap-3">
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-lg bg-primary/10 ring-1 ring-inset ring-primary/30 p-3 text-center">
                <div className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground">Quota</div>
                <div className="font-mono text-2xl font-bold text-primary leading-none mt-1">{bet.odds.toFixed(2)}</div>
              </div>
              <div className="rounded-lg bg-emerald-400/10 ring-1 ring-inset ring-emerald-400/30 p-3 text-center">
                <div className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground">Prob.</div>
                <div className="font-mono text-2xl font-bold text-emerald-300 leading-none mt-1">{pct(bet.modelProb)}</div>
              </div>
              <div className="rounded-lg bg-amber-400/10 ring-1 ring-inset ring-amber-400/30 p-3 text-center">
                <div className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground" title="Kelly ¼">Kelly</div>
                <div className="font-mono text-2xl font-bold text-amber-300 leading-none mt-1">{stake > 0 ? eur(stake) : "—"}</div>
              </div>
            </div>
            <div className="rounded-lg bg-accent/10 ring-1 ring-inset ring-accent/40 p-3 text-center">
              <div className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
                {stake > 0 ? `Apostant ${eur(stake)} guanyes` : `Apostant ${eur(bankroll)} guanyes`}
              </div>
              <div className="font-mono text-3xl font-bold text-accent leading-none mt-1">+{eur(profit)}</div>
              <div className="text-[10px] text-muted-foreground mt-1 font-mono">Retorn total {eur(stake > 0 ? payout : bankroll * bet.odds)}</div>
            </div>
            <button
              type="button"
              onClick={() => slip.toggle({ id: bet.id, matchId: bet.matchId, matchLabel: bet.matchLabel, market: bet.market, selection: bet.selection, odds: bet.odds, modelProb: bet.modelProb, source: bet.source })}
              className={
                "w-full text-[11px] uppercase tracking-[0.16em] font-bold py-2.5 rounded-md transition-colors flex items-center justify-center gap-2 " +
                (inSlip
                  ? "bg-accent/20 text-accent ring-1 ring-inset ring-accent/40"
                  : "bg-primary text-black hover:bg-primary/90")
              }
            >
              {inSlip ? <><Check className="w-4 h-4" /> Al butlletí</> : <><Plus className="w-4 h-4" /> Afegir al butlletí</>}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// 1X2 probability bar — visual breakdown of model home/draw/away probs.
// ---------------------------------------------------------------------------
function ProbabilityBar({ match }: { match: BoardMatch }) {
  // Find the 1X2 markets in match.markets (group "Resultat 1X2" or "1X2")
  const oneX2 = match.markets.filter((m) => /1X2|Resultat/i.test(m.group)).slice(0, 3);
  // Map by selection: home / draw / away
  const homeP = oneX2.find((m) => /local|home|^1$/i.test(m.selection))?.modelProb ?? null;
  const drawP = oneX2.find((m) => /empat|draw|^X$/i.test(m.selection))?.modelProb ?? null;
  const awayP = oneX2.find((m) => /visit|away|^2$/i.test(m.selection))?.modelProb ?? null;
  if (homeP == null || drawP == null || awayP == null) return null;
  const total = homeP + drawP + awayP;
  if (total <= 0) return null;
  const h = (homeP / total) * 100;
  const d = (drawP / total) * 100;
  const a = (awayP / total) * 100;
  return (
    <div className="px-4 py-2.5 border-y border-border/50 bg-black/20">
      <div className="flex items-center justify-between text-[9px] uppercase tracking-[0.18em] text-muted-foreground mb-1">
        <span title={`${match.homeShort} guanya`} className="text-primary/80 font-semibold">{match.homeShort} {pct(homeP)}</span>
        <span title="Empat">Empat {pct(drawP)}</span>
        <span title={`${match.awayShort} guanya`} className="text-amber-300/80 font-semibold">{pct(awayP)} {match.awayShort}</span>
      </div>
      <div className="flex w-full h-2 rounded-full overflow-hidden ring-1 ring-inset ring-border/40">
        <div className="bg-primary/70 hover:bg-primary transition-colors" style={{ width: `${h}%` }} title={`${match.homeShort}: ${pct(homeP)}`} />
        <div className="bg-muted-foreground/40" style={{ width: `${d}%` }} title={`Empat: ${pct(drawP)}`} />
        <div className="bg-amber-400/70 hover:bg-amber-400 transition-colors" style={{ width: `${a}%` }} title={`${match.awayShort}: ${pct(awayP)}`} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Floating bet slip panel (bottom-right). Persists across reloads.
// ---------------------------------------------------------------------------
function BetSlipPanel({ slip, bankroll }: { slip: ReturnType<typeof useBetSlip>; bankroll: number }) {
  const [open, setOpen] = useState(false);
  const [stakeOverride, setStakeOverride] = useState<string>("");
  const legs = slip.legs;
  // Compute combined values (assuming independence — same as backend).
  const { combinedOdds, combinedProb } = useMemo(() => {
    if (legs.length === 0) return { combinedOdds: 0, combinedProb: 0 };
    let o = 1, p = 1;
    for (const l of legs) { o *= l.odds; p *= l.modelProb; }
    return { combinedOdds: o, combinedProb: p };
  }, [legs]);
  const stake = (() => {
    const n = parseFloat(stakeOverride);
    return isFinite(n) && n > 0 ? n : bankroll;
  })();
  const payout = stake * combinedOdds;
  const profit = payout - stake;
  const evRatio = combinedProb * combinedOdds; // > 1 is +EV vs fair

  const isCombo = legs.length >= 2;

  if (legs.length === 0 && !open) return null;

  return (
    <div className="fixed bottom-4 right-4 z-40 w-[min(92vw,380px)]">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-full matte-card rounded-xl px-4 py-3 flex items-center justify-between gap-3 shadow-2xl ring-1 ring-primary/30 hover:ring-primary/60 transition-all"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="relative inline-grid place-items-center w-9 h-9 rounded-lg bg-primary/20 ring-1 ring-primary/40 text-primary shrink-0">
              <Layers className="w-4 h-4" />
              <span className="absolute -top-1.5 -right-1.5 inline-grid place-items-center min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-black text-[10px] font-bold font-mono">
                {legs.length}
              </span>
            </div>
            <div className="text-left min-w-0">
              <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Butlletí</div>
              <div className="text-sm font-semibold truncate">
                {legs.length === 1 ? "Aposta simple" : `Combinada · ×${combinedOdds.toFixed(2)}`}
              </div>
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Guany</div>
            <div className="font-mono text-base font-bold text-accent leading-none">+{eur(profit)}</div>
          </div>
        </button>
      ) : (
        <div className="matte-card rounded-xl shadow-2xl ring-1 ring-primary/30 max-h-[80vh] flex flex-col overflow-hidden">
          <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-border/50 bg-gradient-to-r from-primary/[0.08] to-transparent">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-bold uppercase tracking-[0.16em]">Butlletí · {legs.length}</h3>
            </div>
            <div className="flex items-center gap-1">
              {legs.length > 0 && (
                <button type="button" onClick={() => slip.clear()} className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground hover:text-destructive flex items-center gap-1 px-2 py-1 rounded">
                  <Trash2 className="w-3 h-3" /> Buidar
                </button>
              )}
              <button type="button" onClick={() => setOpen(false)} className="inline-grid place-items-center w-7 h-7 rounded-md hover:bg-white/[0.06] text-muted-foreground hover:text-foreground" title="Tancar">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {legs.length === 0 ? (
              <div className="text-center text-xs text-muted-foreground py-8 px-4">
                El butlletí està buit. Toca <span className="text-primary font-semibold">+ Afegir</span> en qualsevol mercat per construir la teva aposta.
              </div>
            ) : (
              legs.map((leg) => (
                <div key={leg.id} className="rounded-md border border-border/50 bg-black/20 p-2.5 flex items-start gap-2">
                  <span className={"inline-block w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 " + (leg.source === "live" ? "bg-accent" : "bg-primary/70")} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground truncate">{leg.matchLabel}</div>
                    <div className="text-sm font-semibold leading-tight truncate">{leg.selection}</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5 truncate">{leg.market} · {pct(leg.modelProb)} prob</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-mono text-sm font-bold text-primary leading-none">{leg.odds.toFixed(2)}</div>
                    <button type="button" onClick={() => slip.remove(leg.id)} className="mt-1.5 inline-grid place-items-center w-6 h-6 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive" title="Treure">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {legs.length > 0 && (
            <div className="border-t border-border/50 p-3 space-y-3 bg-black/30">
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-md bg-primary/[0.08] ring-1 ring-inset ring-primary/30 p-2 text-center">
                  <div className="text-[9px] uppercase tracking-[0.16em] text-muted-foreground">{isCombo ? "Quota total" : "Quota"}</div>
                  <div className="font-mono text-base font-bold text-primary leading-none mt-0.5">{isCombo ? `×${combinedOdds.toFixed(2)}` : combinedOdds.toFixed(2)}</div>
                </div>
                <div className="rounded-md bg-emerald-400/[0.08] ring-1 ring-inset ring-emerald-400/30 p-2 text-center">
                  <div className="text-[9px] uppercase tracking-[0.16em] text-muted-foreground">Prob.</div>
                  <div className="font-mono text-base font-bold text-emerald-300 leading-none mt-0.5">{pct(combinedProb)}</div>
                </div>
                <div className={"rounded-md p-2 text-center ring-1 ring-inset " + (evRatio > 1 ? "bg-accent/[0.1] ring-accent/40" : "bg-muted/20 ring-border/40")}>
                  <div className="text-[9px] uppercase tracking-[0.16em] text-muted-foreground">VE</div>
                  <div className={"font-mono text-base font-bold leading-none mt-0.5 " + (evRatio > 1 ? "text-accent" : "text-muted-foreground")}>×{evRatio.toFixed(2)}</div>
                </div>
              </div>

              <label className="block">
                <div className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground mb-1">Aposta (€)</div>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0.5"
                  step="0.5"
                  value={stakeOverride}
                  onChange={(e) => setStakeOverride(e.target.value)}
                  placeholder={String(bankroll)}
                  className="w-full bg-black/40 border border-border/60 rounded-md px-2.5 py-1.5 text-sm font-mono focus:outline-none focus:border-primary/60"
                />
              </label>

              <div className="rounded-md bg-accent/[0.08] ring-1 ring-inset ring-accent/30 p-2.5 flex items-center justify-between">
                <div>
                  <div className="text-[9px] uppercase tracking-[0.16em] text-muted-foreground">Guany potencial</div>
                  <div className="text-[10px] text-muted-foreground font-mono">Retorn {eur(payout)}</div>
                </div>
                <div className="font-mono text-2xl font-bold text-accent leading-none">+{eur(profit)}</div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ErrorBlock() {
  return (
    <div className="matte-card rounded-xl p-6 text-center text-sm text-destructive">
      No s'han pogut carregar les dades. Torna-ho a provar en uns segons.
    </div>
  );
}
function EmptyBlock({ label }: { label: string }) {
  return (
    <div className="matte-card rounded-xl p-8 text-center text-sm text-muted-foreground">{label}</div>
  );
}

// Re-export for layout (Wallet icon used in header)
export { Wallet };
