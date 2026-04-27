import { Activity, Wallet } from "lucide-react";

interface LayoutProps {
  children: React.ReactNode;
  source?: string | null;
  liveCount?: number;
  totalCount?: number;
  leagueCount?: number;
  bankroll?: number;
  onBankrollChange?: (n: number) => void;
}

const PRESETS = [10, 50, 100, 500];

export function Layout({ children, source, liveCount, totalCount, leagueCount, bankroll, onBankrollChange }: LayoutProps) {
  const hasLive = (liveCount ?? 0) > 0;
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="sticky top-0 z-20 border-b border-border/60 bg-background/85 backdrop-blur-md">
        <div className="max-w-[1400px] mx-auto px-4 md:px-8 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-md bg-primary text-primary-foreground font-black text-sm grid place-items-center tracking-tight shadow-sm shrink-0">
              FE
            </div>
            <div className="leading-tight min-w-0">
              <div className="text-[15px] font-semibold tracking-tight truncate">Futbol Edge</div>
              <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground truncate">
                {leagueCount && leagueCount > 0
                  ? `${leagueCount} lligues · quotes en directe · model probabilístic`
                  : "Multi-lliga · quotes en directe · model probabilístic"}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Bankroll input */}
            {onBankrollChange && (
              <div className="hidden sm:flex items-center gap-1.5 bg-muted/20 border border-border/60 rounded-md pl-2 pr-1 h-9">
                <Wallet className="w-3.5 h-3.5 text-primary" />
                <span className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground hidden md:inline">Pressupost</span>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={bankroll ?? 100}
                  onChange={(e) => {
                    const n = parseFloat(e.target.value);
                    if (isFinite(n) && n > 0) onBankrollChange(n);
                  }}
                  className="bg-transparent w-16 text-sm font-mono font-semibold text-right focus:outline-none"
                />
                <span className="text-xs text-muted-foreground">€</span>
                <div className="flex items-center gap-0.5 ml-1 border-l border-border/60 pl-1">
                  {PRESETS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => onBankrollChange(p)}
                      className={
                        "text-[10px] px-1.5 py-1 rounded font-mono transition-colors " +
                        (bankroll === p
                          ? "bg-primary/15 text-primary"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/30")
                      }
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="hidden lg:flex items-center gap-3">
              <span className="pulse-dot" />
              <span className="text-xs text-muted-foreground font-mono">{source ?? "Carregant…"}</span>
              {totalCount != null && totalCount > 0 && (
                <span
                  className={
                    "text-[10px] uppercase tracking-[0.18em] px-2 py-1 rounded border " +
                    (hasLive ? "border-accent/40 text-accent bg-accent/5" : "border-primary/40 text-primary bg-primary/5")
                  }
                >
                  {hasLive ? `${liveCount}/${totalCount} live` : "tot model"}
                </span>
              )}
            </div>
            <div className="lg:hidden flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" />
            </div>
          </div>
        </div>
      </header>
      <main className="flex-1 max-w-[1400px] w-full mx-auto px-4 md:px-8 py-6 md:py-10">
        {children}
      </main>
      <footer className="border-t border-border/60 mt-12 py-6 text-center text-[11px] text-muted-foreground tracking-wide">
        Quotes reals via DraftKings (ESPN public API) · Model Poisson multi-lliga · No és consell financer · Aposta amb responsabilitat
      </footer>
    </div>
  );
}
