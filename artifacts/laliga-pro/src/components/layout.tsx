import { Activity } from "lucide-react";

interface LayoutProps {
  children: React.ReactNode;
  source?: string | null;
  realBet365?: boolean;
}

export function Layout({ children, source, realBet365 }: LayoutProps) {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="sticky top-0 z-20 border-b border-border/60 bg-background/85 backdrop-blur-md">
        <div className="max-w-[1400px] mx-auto px-4 md:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-md bg-primary text-primary-foreground font-black text-sm grid place-items-center tracking-tight shadow-sm">
              B65
            </div>
            <div className="leading-tight">
              <div className="text-[15px] font-semibold tracking-tight">Bet365 · La Liga Edge</div>
              <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                Quotes en directe · model probabilístic
              </div>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-3">
            <span className="pulse-dot" />
            <span className="text-xs text-muted-foreground font-mono">
              {source ?? "Carregant…"}
            </span>
            {realBet365 != null && (
              <span
                className={
                  "text-[10px] uppercase tracking-[0.18em] px-2 py-1 rounded border " +
                  (realBet365
                    ? "border-accent/40 text-accent bg-accent/5"
                    : "border-primary/40 text-primary bg-primary/5")
                }
              >
                {realBet365 ? "Live bet365" : "Mode model"}
              </span>
            )}
          </div>
          <div className="md:hidden flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" />
          </div>
        </div>
      </header>
      <main className="flex-1 max-w-[1400px] w-full mx-auto px-4 md:px-8 py-6 md:py-10">
        {children}
      </main>
      <footer className="border-t border-border/60 mt-12 py-6 text-center text-[11px] text-muted-foreground tracking-wide">
        Eines per analitzar quotes · No és consell financer · Aposta amb responsabilitat
      </footer>
    </div>
  );
}
