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
} from "lucide-react";
import { Layout } from "@/components/layout";
import { Skeleton } from "@/components/ui/skeleton";

// ---------------------------------------------------------------------------
// Types — match the bet365 routes on the backend
// ---------------------------------------------------------------------------
interface Market {
  key: string;
  group: string;
  selection: string;
  odds: number | null;
  modelProb: number;
  impliedProb: number | null;
  edge: number | null;
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
  source: "bet365" | "model";
  oddsLastUpdate: string | null;
  topPick: { selection: string; modelProb: number; odds: number | null } | null;
  markets: Market[];
}
interface BoardResponse {
  source: string;
  realBet365: boolean;
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
  }[];
  combinedOdds: number;
  combinedProb: number;
  riskTier: "baix" | "moderat" | "alt" | "molt alt";
  rationale: string;
}
interface SuggestionsResponse {
  source: string;
  realBet365: boolean;
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

// ---------------------------------------------------------------------------
// Visual helpers
// ---------------------------------------------------------------------------
const RISK_STYLES: Record<string, { color: string; bg: string; ring: string; label: string }> = {
  "molt baix": {
    color: "text-emerald-300",
    bg: "bg-emerald-500/10",
    ring: "ring-emerald-500/30",
    label: "Risc molt baix",
  },
  baix: {
    color: "text-lime-300",
    bg: "bg-lime-500/10",
    ring: "ring-lime-500/30",
    label: "Risc baix",
  },
  moderat: {
    color: "text-amber-300",
    bg: "bg-amber-500/10",
    ring: "ring-amber-500/30",
    label: "Risc moderat",
  },
  alt: {
    color: "text-orange-300",
    bg: "bg-orange-500/10",
    ring: "ring-orange-500/30",
    label: "Risc alt",
  },
  "molt alt": {
    color: "text-red-300",
    bg: "bg-red-500/10",
    ring: "ring-red-500/30",
    label: "Risc molt alt",
  },
};

function RiskPill({ tier }: { tier: string }) {
  const s = RISK_STYLES[tier] ?? RISK_STYLES["moderat"]!;
  return (
    <span
      className={`text-[10px] uppercase tracking-[0.18em] font-semibold px-2 py-1 rounded ${s.bg} ${s.color} ring-1 ring-inset ${s.ring}`}
    >
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

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
export default function Board() {
  const board = useBoard();
  const suggestions = useSuggestions();
  const data = board.data;
  const sg = suggestions.data;

  const live = data?.matches.filter((m) => m.status === "live") ?? [];
  const upcoming = data?.matches.filter((m) => m.status === "upcoming") ?? [];

  return (
    <Layout source={data?.source ?? null} realBet365={data?.realBet365}>
      {!data?.realBet365 && (
        <div className="mb-6 rounded-lg border border-primary/30 bg-primary/5 p-4 text-sm text-primary">
          <strong className="font-semibold">Quotes en mode model.</strong>{" "}
          Per veure les quotes reals de bet365 en directe, configura la clau de{" "}
          <code className="font-mono text-xs">THE_ODDS_API_KEY</code> a Secrets.
          Pots obtenir-ne una de gratis (500 peticions/mes) a{" "}
          <a
            href="https://the-odds-api.com"
            target="_blank"
            rel="noreferrer"
            className="underline hover:text-primary/80"
          >
            the-odds-api.com
          </a>
          . Mentrestant la web mostra les probabilitats del nostre model.
        </div>
      )}

      {/* HEADLINE METRICS */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        <Stat
          label="Partits en directe"
          value={live.length}
          icon={<Flame className="w-4 h-4" />}
          tint="text-red-300"
        />
        <Stat
          label="Pròxims partits"
          value={upcoming.length}
          icon={<Clock className="w-4 h-4" />}
          tint="text-primary"
        />
        <Stat
          label="Apostes simples suggerides"
          value={sg?.simples.length ?? 0}
          icon={<TrendingUp className="w-4 h-4" />}
          tint="text-accent"
        />
        <Stat
          label="Combinades"
          value={sg?.combos.length ?? 0}
          icon={<Layers className="w-4 h-4" />}
          tint="text-amber-300"
        />
      </section>

      {/* LIVE + UPCOMING MATCHES */}
      <section className="mb-12">
        <SectionHeader
          title="Quotes per partit"
          subtitle="Cada quota mostra el preu de bet365 i la probabilitat real segons el model. Edge positiu = el mercat infravalora aquesta opció."
          icon={<Gauge className="w-5 h-5" />}
        />
        {board.isLoading ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-64 w-full rounded-xl" />
            ))}
          </div>
        ) : board.isError ? (
          <ErrorBlock />
        ) : data!.matches.length === 0 ? (
          <EmptyBlock label="No hi ha partits en directe ni propers a la finestra de 10 dies." />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {data!.matches.map((m) => (
              <MatchCard key={m.matchId} match={m} />
            ))}
          </div>
        )}
      </section>

      {/* SIMPLE BET SUGGESTIONS */}
      <section className="mb-12">
        <SectionHeader
          title="Apostes simples · ordenades per risc"
          subtitle="Només s'inclouen mercats amb una probabilitat real ≥ 40% segons el model. Comencem pels més segurs i acabem pels més arriscats."
          icon={<ShieldCheck className="w-5 h-5" />}
        />
        {suggestions.isLoading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-lg" />
            ))}
          </div>
        ) : suggestions.isError ? (
          <ErrorBlock />
        ) : sg!.simples.length === 0 ? (
          <EmptyBlock label="No hem trobat apostes simples amb prou confiança ara mateix." />
        ) : (
          <div className="matte-card rounded-xl overflow-hidden">
            <div className="hidden md:grid grid-cols-12 gap-2 px-4 py-3 text-[11px] uppercase tracking-[0.16em] text-muted-foreground border-b border-border/60">
              <div className="col-span-1">#</div>
              <div className="col-span-3">Partit</div>
              <div className="col-span-3">Selecció</div>
              <div className="col-span-1 text-center">Quota</div>
              <div className="col-span-1 text-center">Prob.</div>
              <div className="col-span-1 text-center">Edge</div>
              <div className="col-span-2 text-right">Risc</div>
            </div>
            {sg!.simples.map((b, i) => (
              <SimpleBetRow key={b.id} bet={b} index={i + 1} />
            ))}
          </div>
        )}
      </section>

      {/* COMBO SUGGESTIONS */}
      <section className="mb-8">
        <SectionHeader
          title="Combinades · de menys a més risc"
          subtitle="Combinacions que ajunten les seleccions individuals més fortes de partits diferents (per mantenir la independència)."
          icon={<Sparkles className="w-5 h-5" />}
        />
        {suggestions.isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[...Array(2)].map((_, i) => (
              <Skeleton key={i} className="h-48 rounded-xl" />
            ))}
          </div>
        ) : suggestions.isError ? (
          <ErrorBlock />
        ) : sg!.combos.length === 0 ? (
          <EmptyBlock label="Cal almenys 2 partits amb seleccions de confiança per construir combinades." />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {sg!.combos.map((c) => (
              <ComboCard key={c.id} combo={c} />
            ))}
          </div>
        )}
      </section>
    </Layout>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------
function Stat({
  label,
  value,
  icon,
  tint,
}: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  tint: string;
}) {
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

function SectionHeader({
  title,
  subtitle,
  icon,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
}) {
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

function MatchCard({ match }: { match: BoardMatch }) {
  const grouped: Record<string, Market[]> = {};
  for (const mk of match.markets) {
    if (!grouped[mk.group]) grouped[mk.group] = [];
    grouped[mk.group]!.push(mk);
  }
  return (
    <div className="matte-card matte-card-hover rounded-xl overflow-hidden">
      {/* HEADER */}
      <div className="px-4 py-3 flex items-center justify-between border-b border-border/60">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          {match.status === "live" ? (
            <>
              <span className="pulse-dot" />
              <span className="text-red-300 font-semibold">
                EN DIRECTE {match.minute ? `· ${match.minute}'` : ""}
              </span>
            </>
          ) : (
            <>
              <Clock className="w-3.5 h-3.5" /> {fmtKickoff(match.kickoff)}
            </>
          )}
        </div>
        <span
          className={
            "text-[10px] uppercase tracking-[0.18em] px-2 py-0.5 rounded " +
            (match.source === "bet365"
              ? "bg-accent/10 text-accent ring-1 ring-inset ring-accent/30"
              : "bg-primary/10 text-primary ring-1 ring-inset ring-primary/30")
          }
        >
          {match.source}
        </span>
      </div>

      {/* TEAMS */}
      <div className="px-4 py-4 grid grid-cols-7 items-center gap-2">
        <div className="col-span-3 flex items-center gap-3 min-w-0">
          {match.homeCrest ? (
            <img src={match.homeCrest} alt="" className="w-8 h-8 object-contain shrink-0" />
          ) : (
            <div className="w-8 h-8 rounded bg-muted shrink-0" />
          )}
          <span className="font-semibold truncate">{match.homeShort}</span>
        </div>
        <div className="col-span-1 text-center">
          {match.status === "live" || match.homeScore != null ? (
            <div className="font-mono text-2xl font-semibold tracking-tight">
              {match.homeScore ?? 0} – {match.awayScore ?? 0}
            </div>
          ) : (
            <div className="text-muted-foreground text-sm font-medium">vs</div>
          )}
        </div>
        <div className="col-span-3 flex items-center gap-3 justify-end min-w-0">
          <span className="font-semibold truncate text-right">{match.awayShort}</span>
          {match.awayCrest ? (
            <img src={match.awayCrest} alt="" className="w-8 h-8 object-contain shrink-0" />
          ) : (
            <div className="w-8 h-8 rounded bg-muted shrink-0" />
          )}
        </div>
      </div>

      {/* TOP PICK */}
      {match.topPick && (
        <div className="px-4 py-2 bg-primary/[0.04] border-y border-primary/15 flex items-center gap-2 text-sm">
          <ShieldCheck className="w-4 h-4 text-primary" />
          <span className="text-muted-foreground">Pic del model:</span>
          <span className="font-semibold">{match.topPick.selection}</span>
          <span className="ml-auto font-mono text-primary">
            {pct(match.topPick.modelProb)} · {match.topPick.odds?.toFixed(2)}
          </span>
        </div>
      )}

      {/* MARKETS */}
      <div className="p-3 space-y-3">
        {Object.entries(grouped).map(([group, list]) => (
          <div key={group}>
            <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-1.5 px-1">
              {group}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {list.map((mk) => (
                <MarketChip key={mk.key} market={mk} />
              ))}
            </div>
          </div>
        ))}
      </div>

      {match.oddsLastUpdate && (
        <div className="px-4 py-2 border-t border-border/40 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          Actualitzat {relTime(match.oddsLastUpdate)}
        </div>
      )}
    </div>
  );
}

function MarketChip({ market }: { market: Market }) {
  const edge = market.edge ?? 0;
  const isPositive = edge > 0.02;
  const isNegative = edge < -0.05;
  return (
    <div
      className={
        "rounded-md px-2.5 py-2 border flex flex-col gap-0.5 " +
        (isPositive
          ? "border-accent/40 bg-accent/[0.06]"
          : isNegative
            ? "border-border/40 bg-muted/30 opacity-60"
            : "border-border/60 bg-muted/20")
      }
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] truncate text-foreground/90">{market.selection}</span>
        <span className="font-mono text-sm font-semibold">
          {market.odds ? market.odds.toFixed(2) : "—"}
        </span>
      </div>
      <div className="flex items-center justify-between text-[10px] text-muted-foreground font-mono">
        <span>{pct(market.modelProb)}</span>
        {edge !== 0 && (
          <span className={isPositive ? "text-accent font-semibold" : isNegative ? "text-muted-foreground" : ""}>
            {edge > 0 ? "+" : ""}
            {(edge * 100).toFixed(1)}%
          </span>
        )}
      </div>
    </div>
  );
}

function SimpleBetRow({ bet, index }: { bet: SimpleBet; index: number }) {
  const profitPerEur = (bet.odds - 1).toFixed(2);
  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-2 px-4 py-3 border-b border-border/40 last:border-b-0 hover:bg-white/[0.02] transition-colors">
      <div className="hidden md:flex md:col-span-1 items-center">
        <span className="text-xs font-mono text-muted-foreground">{String(index).padStart(2, "0")}</span>
      </div>
      <div className="md:col-span-3 flex flex-col">
        <span className="font-medium text-sm">{bet.matchLabel}</span>
        <span className="text-[11px] text-muted-foreground flex items-center gap-1">
          {bet.status === "live" ? (
            <>
              <span className="pulse-dot scale-75" />
              <span className="text-red-300">en directe</span>
            </>
          ) : (
            fmtKickoff(bet.kickoff)
          )}
        </span>
      </div>
      <div className="md:col-span-3 flex flex-col">
        <span className="font-semibold text-sm">{bet.selection}</span>
        <span className="text-[11px] text-muted-foreground">{bet.market} · {bet.rationale}</span>
      </div>
      <div className="md:col-span-1 text-center flex md:block items-center justify-between">
        <span className="md:hidden text-[10px] text-muted-foreground uppercase tracking-wider">Quota</span>
        <span className="font-mono font-semibold text-base">{bet.odds.toFixed(2)}</span>
        <div className="hidden md:block text-[10px] text-muted-foreground font-mono">+{profitPerEur} €/€</div>
      </div>
      <div className="md:col-span-1 text-center flex md:block items-center justify-between">
        <span className="md:hidden text-[10px] text-muted-foreground uppercase tracking-wider">Prob.</span>
        <span className="font-mono text-sm">{pct(bet.modelProb)}</span>
      </div>
      <div className="md:col-span-1 text-center flex md:block items-center justify-between">
        <span className="md:hidden text-[10px] text-muted-foreground uppercase tracking-wider">Edge</span>
        <span
          className={
            "font-mono text-sm font-semibold " +
            (bet.edge > 0.05 ? "text-accent" : bet.edge > 0 ? "text-lime-300" : "text-muted-foreground")
          }
        >
          {bet.edge > 0 ? "+" : ""}
          {(bet.edge * 100).toFixed(1)}%
        </span>
      </div>
      <div className="md:col-span-2 flex md:justify-end items-center">
        <RiskPill tier={bet.riskTier} />
      </div>
    </div>
  );
}

function ComboCard({ combo }: { combo: ComboBet }) {
  const profit = (combo.combinedOdds - 1).toFixed(2);
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
          <div
            key={i}
            className="flex items-center gap-3 text-sm border border-border/50 rounded-md px-3 py-2 bg-background/40"
          >
            <ChevronRight className="w-4 h-4 text-primary shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="font-medium truncate">{leg.matchLabel}</div>
              <div className="text-[11px] text-muted-foreground">
                {leg.market} · {leg.selection}
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="font-mono font-semibold">{leg.odds.toFixed(2)}</div>
              <div className="text-[10px] text-muted-foreground font-mono">{pct(leg.modelProb)}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-3 pt-3 border-t border-border/50">
        <KV label="Quota total" value={combo.combinedOdds.toFixed(2)} accent="text-primary" />
        <KV label="Probabilitat" value={pct(combo.combinedProb)} accent="text-foreground" />
        <KV label="Guany per €" value={`+${profit} €`} accent="text-accent" />
      </div>
    </div>
  );
}

function KV({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
      <div className={`font-mono text-lg font-semibold ${accent}`}>{value}</div>
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
    <div className="matte-card rounded-xl p-8 text-center text-sm text-muted-foreground">
      {label}
    </div>
  );
}
