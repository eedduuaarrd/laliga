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
}
interface ComboBet {
  id: string;
  legs: {
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
}
interface SuggestionsResponse {
  source: string;
  liveMatchCount: number;
  liveMarketCount: number;
  totalMatchCount: number;
  simples: SimpleBet[];
  combos: ComboBet[];
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
interface Filters {
  risk: RiskFilter;
  query: string;
  source: SourceFilter;
  league: string; // "all" or league code
}
const DEFAULT_FILTERS: Filters = { risk: "all", query: "", source: "all", league: "all" };

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
    return sg.simples.filter((b) => {
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
  }, [sg, filters, leagueByMatch]);

  const heroPicks = useMemo(() => {
    if (!sg) return [];
    // Best 6 picks with positive (or near-zero) edge — these are "destacades"
    return [...sg.simples]
      .sort((a, b) => {
        // prefer live + low risk + decent edge + tier-1 leagues
        const tierA = leagueByMatch.get(a.matchId)?.tier ?? 9;
        const tierB = leagueByMatch.get(b.matchId)?.tier ?? 9;
        const sa = (a.source === "live" ? 0.05 : 0) + a.modelProb + a.edge * 0.5 - tierA * 0.01;
        const sb = (b.source === "live" ? 0.05 : 0) + b.modelProb + b.edge * 0.5 - tierB * 0.01;
        return sb - sa;
      })
      .slice(0, 6);
  }, [sg, leagueByMatch]);

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

      {/* ============== HERO METRICS ============== */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Stat label="Partits en directe" value={live.length} icon={<Flame className="w-4 h-4" />} tint="text-red-300" />
        <Stat label="Pròxims partits"    value={upcoming.length} icon={<Clock className="w-4 h-4" />} tint="text-primary" />
        <Stat label="Apostes simples"    value={sg?.simples.length ?? 0} icon={<TrendingUp className="w-4 h-4" />} tint="text-accent" />
        <Stat label="Combinades"         value={sg?.combos.length ?? 0} icon={<Layers className="w-4 h-4" />} tint="text-amber-300" />
      </section>

      {/* ============== HERO PICKS ============== */}
      {heroPicks.length > 0 && (
        <section className="mb-8">
          <SectionHeader
            title="Apostes destacades"
            subtitle={`Les ${heroPicks.length} millors seleccions del moment combinant probabilitat, valor i fiabilitat de la quota.`}
            icon={<Star className="w-5 h-5" />}
          />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {heroPicks.map((b, i) => (
              <HeroPickCard key={b.id} bet={b} bankroll={bankroll} rank={i + 1} matchById={data?.matches} league={leagueByMatch.get(b.matchId) ?? null} />
            ))}
          </div>
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
            {filteredMatches.map((m) => <MatchCard key={m.matchId} match={m} bankroll={bankroll} edgeOnly={edgeOnly} />)}
          </div>
        )}
      </section>

      {/* ============== SIMPLE BETS ============== */}
      <section className="mb-12" id="simples">
        <SectionHeader
          title="Apostes simples · ordenades per risc"
          subtitle="Filtra per nivell de risc o equip a la barra superior. Calcula el guany potencial pel pressupost que has marcat al cap (header)."
          icon={<ShieldCheck className="w-5 h-5" />}
        />
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
              <div className="col-span-1 text-center">Edge</div>
              <div className="col-span-1 text-right">Guany</div>
              <div className="col-span-1 text-right">Risc</div>
            </div>
            {filteredSimples.map((b, i) => <SimpleBetRow key={b.id} bet={b} index={i + 1} bankroll={bankroll} league={leagueByMatch.get(b.matchId) ?? null} />)}
          </div>
        )}
      </section>

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
            {sg.combos.map((c) => <ComboCard key={c.id} combo={c} bankroll={bankroll} />)}
          </div>
        )}
      </section>
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
  const isFiltered = filters.risk !== "all" || filters.query !== "" || filters.source !== "all" || filters.league !== "all";
  return (
    <div className="sticky top-16 z-10 -mx-4 md:-mx-8 px-4 md:px-8 py-3 mb-6 backdrop-blur-md bg-background/80 border-y border-border/60">
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
function HeroPickCard({
  bet, bankroll, rank, matchById, league,
}: {
  bet: SimpleBet; bankroll: number; rank: number; matchById: BoardMatch[] | undefined; league: League | null;
}) {
  const match = matchById?.find((m) => m.matchId === bet.matchId);
  const payout = bankroll * bet.odds;
  const profit = payout - bankroll;
  const s = RISK_STYLES[bet.riskTier] ?? RISK_STYLES["moderat"]!;
  return (
    <a
      href="#matches"
      className="matte-card matte-card-hover rounded-xl p-4 flex flex-col gap-3 group relative overflow-hidden"
    >
      <div className="absolute top-0 right-0 w-24 h-24 rounded-full blur-3xl opacity-10 bg-primary -mr-6 -mt-6 pointer-events-none" />
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-mono">#{rank}</span>
          <RiskPill tier={bet.riskTier} compact />
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

      <div className="flex items-center gap-2">
        {match?.homeCrest && <img src={match.homeCrest} alt="" className="w-6 h-6 object-contain" />}
        <span className="text-sm font-semibold truncate">{bet.matchLabel}</span>
        {match?.awayCrest && <img src={match.awayCrest} alt="" className="w-6 h-6 object-contain ml-auto" />}
      </div>

      <div>
        <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{bet.market}</div>
        <div className="text-base font-semibold mt-0.5 leading-tight">{bet.selection}</div>
      </div>

      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border/40">
        <div>
          <div className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground">Quota</div>
          <div className="font-mono text-base font-semibold">{bet.odds.toFixed(2)}</div>
        </div>
        <div>
          <div className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground">Prob.</div>
          <div className={`font-mono text-base font-semibold ${s.color}`}>{pct(bet.modelProb)}</div>
        </div>
        <div className="text-right">
          <div className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground">Guany</div>
          <div className="font-mono text-base font-semibold text-accent">+{eur(profit)}</div>
        </div>
      </div>

      <div className="text-[10px] text-muted-foreground flex items-center gap-1">
        {bet.status === "live" ? (
          <><span className="pulse-dot scale-75" /><span className="text-red-300">en directe</span></>
        ) : (
          <><Clock className="w-3 h-3" />{fmtKickoff(bet.kickoff)}</>
        )}
      </div>
    </a>
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

function MatchCard({ match, bankroll, edgeOnly }: { match: BoardMatch; bankroll: number; edgeOnly: boolean }) {
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

      {/* TOP PICK */}
      {match.topPick && (
        <div className="px-4 py-2 bg-primary/[0.04] border-y border-primary/15 flex items-center gap-2 text-sm flex-wrap">
          <ShieldCheck className="w-4 h-4 text-primary shrink-0" />
          <span className="text-muted-foreground">Pic del model:</span>
          <span className="font-semibold">{match.topPick.selection}</span>
          <span className="ml-auto font-mono text-primary">
            {pct(match.topPick.modelProb)} · {match.topPick.odds?.toFixed(2)}
          </span>
          {match.topPick.odds && (
            <span className="font-mono text-[11px] text-accent border-l border-border/60 pl-2 ml-1">
              +{eur(bankroll * match.topPick.odds - bankroll)} per {eur(bankroll)}
            </span>
          )}
        </div>
      )}

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
          <PlayersTab homePlayers={filteredPlayers.filter((p) => p.team === "home")} awayPlayers={filteredPlayers.filter((p) => p.team === "away")} match={match} />
        ) : activeTab ? (
          <ActiveMarketsTab grouped={grouped} groups={activeTab.groups} />
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

function ActiveMarketsTab({ grouped, groups }: { grouped: Record<string, Market[]>; groups: string[] }) {
  const presentGroups = groups.filter((g) => grouped[g]);
  return (
    <div className="space-y-3">
      {presentGroups.map((g) => (
        <div key={g}>
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-1.5 px-1">{g}</div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {grouped[g]!.map((mk) => <MarketChip key={mk.key} market={mk} />)}
          </div>
        </div>
      ))}
    </div>
  );
}

function PlayersTab({ homePlayers, awayPlayers, match }: { homePlayers: PlayerMarket[]; awayPlayers: PlayerMarket[]; match: BoardMatch }) {
  return (
    <div className="space-y-3">
      {homePlayers.length > 0 && <PlayerSection title={match.homeShort} crest={match.homeCrest} players={homePlayers} />}
      {awayPlayers.length > 0 && <PlayerSection title={match.awayShort} crest={match.awayCrest} players={awayPlayers} />}
    </div>
  );
}

function PlayerSection({ title, crest, players }: { title: string; crest: string; players: PlayerMarket[] }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-1.5 px-1 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        {crest ? <img src={crest} alt="" className="w-3.5 h-3.5 object-contain" /> : null}
        {title}
      </div>
      <div className="space-y-2">
        {players.map((p) => <PlayerRow key={p.playerId} player={p} />)}
      </div>
    </div>
  );
}

function PlayerRow({ player }: { player: PlayerMarket }) {
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
        {player.markets.map((mk) => <MarketChip key={mk.key} market={mk} />)}
      </div>
    </div>
  );
}

function MarketChip({ market }: { market: Market }) {
  const edge = market.edge ?? 0;
  const isPositive = edge > 0.02;
  const isNegative = edge < -0.05;
  const isLive = market.source === "live";
  return (
    <div
      className={
        "relative rounded-md px-2.5 py-2 border flex flex-col gap-0.5 transition-colors " +
        (isPositive
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
    </div>
  );
}

// ---------------------------------------------------------------------------
// Simple bet row
// ---------------------------------------------------------------------------
function SimpleBetRow({ bet, index, bankroll, league }: { bet: SimpleBet; index: number; bankroll: number; league: League | null }) {
  const profit = bankroll * bet.odds - bankroll;
  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-2 px-4 py-3 border-b border-border/40 last:border-b-0 hover:bg-white/[0.02] transition-colors">
      <div className="hidden md:flex md:col-span-1 items-center">
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
      <div className="md:col-span-3 flex flex-col">
        <span className="font-semibold text-sm flex items-center gap-1.5">
          <span className={"inline-block w-1.5 h-1.5 rounded-full " + (bet.source === "live" ? "bg-accent" : "bg-primary/70")}
            title={bet.source === "live" ? "Quota real DraftKings" : "Quota del model"} />
          {bet.selection}
        </span>
        <span className="text-[11px] text-muted-foreground">{bet.market} · {bet.rationale}</span>
      </div>
      <div className="md:col-span-1 text-center flex md:block items-center justify-between">
        <span className="md:hidden text-[10px] text-muted-foreground uppercase tracking-wider">Quota</span>
        <span className="font-mono font-semibold text-base">{bet.odds.toFixed(2)}</span>
      </div>
      <div className="md:col-span-1 text-center flex md:block items-center justify-between">
        <span className="md:hidden text-[10px] text-muted-foreground uppercase tracking-wider">Prob.</span>
        <span className="font-mono text-sm">{pct(bet.modelProb)}</span>
      </div>
      <div className="md:col-span-1 text-center flex md:block items-center justify-between">
        <span className="md:hidden text-[10px] text-muted-foreground uppercase tracking-wider">Edge</span>
        <span className={"font-mono text-sm font-semibold " + (bet.edge > 0.05 ? "text-accent" : bet.edge > 0 ? "text-lime-300" : "text-muted-foreground")}>
          {bet.edge > 0 ? "+" : ""}{(bet.edge * 100).toFixed(1)}%
        </span>
      </div>
      <div className="md:col-span-1 text-right flex md:block items-center justify-between">
        <span className="md:hidden text-[10px] text-muted-foreground uppercase tracking-wider">Guany</span>
        <span className="font-mono text-sm font-semibold text-accent">+{eur(profit)}</span>
      </div>
      <div className="md:col-span-1 flex md:justify-end items-center">
        <RiskPill tier={bet.riskTier} compact />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Combo card
// ---------------------------------------------------------------------------
function ComboCard({ combo, bankroll }: { combo: ComboBet; bankroll: number }) {
  const payout = bankroll * combo.combinedOdds;
  const profit = payout - bankroll;
  return (
    <div className="matte-card matte-card-hover rounded-xl p-5 flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            Combinada · {combo.legs.length} cames
          </div>
          <div className="text-base font-medium mt-1 max-w-md">{combo.rationale}</div>
        </div>
        <RiskPill tier={combo.riskTier} />
      </div>

      <div className="space-y-2">
        {combo.legs.map((leg, i) => (
          <div key={i} className="flex items-center gap-3 text-sm border border-border/50 rounded-md px-3 py-2 bg-background/40">
            <ChevronRight className="w-4 h-4 text-primary shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="font-medium truncate flex items-center gap-1.5">
                <span className={"inline-block w-1.5 h-1.5 rounded-full shrink-0 " + (leg.source === "live" ? "bg-accent" : "bg-primary/70")} />
                {leg.matchLabel}
              </div>
              <div className="text-[11px] text-muted-foreground">{leg.market} · {leg.selection}</div>
            </div>
            <div className="text-right shrink-0">
              <div className="font-mono font-semibold">{leg.odds.toFixed(2)}</div>
              <div className="text-[10px] text-muted-foreground font-mono">{pct(leg.modelProb)}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-4 gap-3 pt-3 border-t border-border/50">
        <KV label="Quota total" value={combo.combinedOdds.toFixed(2)} accent="text-primary" />
        <KV label="Probabilitat" value={pct(combo.combinedProb)} accent="text-foreground" />
        <KV label={`Aposta ${eur(bankroll)}`} value={`→ ${eur(payout)}`} accent="text-foreground" />
        <KV label="Guany net" value={`+${eur(profit)}`} accent="text-accent" />
      </div>
    </div>
  );
}

function KV({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground truncate">{label}</div>
      <div className={`font-mono text-base font-semibold ${accent}`}>{value}</div>
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
