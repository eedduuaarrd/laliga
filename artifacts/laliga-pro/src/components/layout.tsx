import { Link, useLocation } from "wouter";
import { 
  LayoutDashboard, 
  Swords, 
  BrainCircuit, 
  Trophy, 
  ShieldHalf, 
  Users, 
  TrendingUp, 
  Activity, 
  Newspaper,
  Menu
} from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/briefing", label: "Morning Briefing", icon: Newspaper },
  { href: "/matches", label: "Matches", icon: Swords },
  { href: "/predictions", label: "Predictions", icon: BrainCircuit },
  { href: "/value-bets", label: "Value Bets", icon: TrendingUp },
  { href: "/standings", label: "Standings", icon: Trophy },
  { href: "/teams", label: "Teams", icon: ShieldHalf },
  { href: "/players", label: "Players", icon: Users },
  { href: "/injuries", label: "Injuries", icon: Activity },
];

function SidebarContent() {
  const [location] = useLocation();

  return (
    <div className="flex flex-col h-full bg-sidebar border-r border-sidebar-border text-sidebar-foreground">
      <div className="p-4 border-b border-sidebar-border flex items-center gap-2">
        <div className="w-8 h-8 bg-primary rounded flex items-center justify-center text-primary-foreground font-bold">LL</div>
        <span className="font-bold text-lg tracking-tight">Pro Analytics</span>
      </div>
      <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
          return (
            <Link key={item.href} href={item.href}>
              <div className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors cursor-pointer ${isActive ? "bg-sidebar-primary text-sidebar-primary-foreground font-medium" : "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"}`}>
                <item.icon className="w-5 h-5" />
                <span>{item.label}</span>
              </div>
            </Link>
          );
        })}
      </nav>
      <div className="p-4 border-t border-sidebar-border text-xs text-sidebar-foreground/50">
        System Status: <span className="text-primary font-medium">Online</span>
      </div>
    </div>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col md:flex-row">
      {/* Mobile Header */}
      <div className="md:hidden flex items-center justify-between p-4 border-b bg-card">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-primary rounded flex items-center justify-center text-primary-foreground font-bold text-xs">LL</div>
          <span className="font-bold">Pro Analytics</span>
        </div>
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon">
              <Menu className="w-5 h-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-64 border-r-sidebar-border">
            <SidebarContent />
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop Sidebar */}
      <div className="hidden md:block w-64 h-screen sticky top-0 shrink-0">
        <SidebarContent />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <header className="h-14 border-b bg-card/50 backdrop-blur sticky top-0 z-10 px-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="text-sm font-medium">Live Market Data</div>
          </div>
        </header>
        <main className="flex-1 p-4 md:p-6 overflow-x-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}
