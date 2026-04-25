import { useMemo, useState } from "react";
import { useListInjuries } from "@workspace/api-client-react";
import type { InjuryReport } from "@workspace/api-zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Link } from "wouter";
import { Activity, AlertTriangle, ShieldAlert, Stethoscope, Search } from "lucide-react";
import { formatDistanceToNow, parseISO } from "date-fns";
import { ca } from "date-fns/locale";

type SeverityFilter = "all" | "high" | "medium" | "low";
type TypeFilter = "all" | "injury" | "doubtful" | "suspension";

const SEVERITY_LABEL: Record<InjuryReport["severity"], string> = {
  high: "Greu",
  medium: "Moderada",
  low: "Lleu",
};

const TYPE_LABEL: Record<InjuryReport["type"], string> = {
  injury: "Lesió",
  doubtful: "Dubte",
  suspension: "Sancionat",
};

const POS_LABEL: Record<InjuryReport["position"], string> = {
  GK: "Porter",
  DEF: "Defensa",
  MID: "Migcampista",
  FWD: "Davanter",
};

function severityClasses(s: InjuryReport["severity"]) {
  if (s === "high") return "bg-destructive/15 text-destructive border-destructive/40";
  if (s === "medium") return "bg-orange-500/15 text-orange-500 border-orange-500/40";
  return "bg-muted text-muted-foreground border-border";
}

function typeIcon(t: InjuryReport["type"]) {
  if (t === "suspension") return <ShieldAlert className="h-3.5 w-3.5" />;
  if (t === "doubtful") return <AlertTriangle className="h-3.5 w-3.5" />;
  return <Stethoscope className="h-3.5 w-3.5" />;
}

function typeClasses(t: InjuryReport["type"]) {
  if (t === "suspension") return "border-yellow-500/50 text-yellow-500 bg-yellow-500/10";
  if (t === "doubtful") return "border-orange-400/50 text-orange-400 bg-orange-400/10";
  return "border-destructive/50 text-destructive bg-destructive/10";
}

function relativeDate(iso: string | null | undefined) {
  if (!iso) return null;
  try {
    return formatDistanceToNow(parseISO(iso), { addSuffix: true, locale: ca });
  } catch {
    return null;
  }
}

export default function Injuries() {
  const { data: injuries, isLoading } = useListInjuries();
  const [severity, setSeverity] = useState<SeverityFilter>("all");
  const [type, setType] = useState<TypeFilter>("all");
  const [query, setQuery] = useState("");

  const filtered = useMemo<InjuryReport[]>(() => {
    if (!injuries) return [];
    return injuries.filter((i) => {
      if (severity !== "all" && i.severity !== severity) return false;
      if (type !== "all" && i.type !== type) return false;
      if (query) {
        const q = query.toLowerCase();
        if (
          !i.playerName.toLowerCase().includes(q) &&
          !i.teamName.toLowerCase().includes(q) &&
          !(i.injuryType ?? "").toLowerCase().includes(q)
        )
          return false;
      }
      return true;
    });
  }, [injuries, severity, type, query]);

  const counts = useMemo(() => {
    const list = injuries ?? [];
    return {
      total: list.length,
      high: list.filter((i) => i.severity === "high").length,
      injuries: list.filter((i) => i.type === "injury").length,
      suspensions: list.filter((i) => i.type === "suspension").length,
      doubtful: list.filter((i) => i.type === "doubtful").length,
    };
  }, [injuries]);

  const grouped = useMemo(() => {
    const map = new Map<number, { teamName: string; teamCrestUrl: string; teamShortName: string; items: InjuryReport[] }>();
    for (const i of filtered) {
      const entry = map.get(i.teamId) ?? {
        teamName: i.teamName,
        teamCrestUrl: i.teamCrestUrl,
        teamShortName: i.teamShortName,
        items: [],
      };
      entry.items.push(i);
      map.set(i.teamId, entry);
    }
    // sort items inside each team by impact desc
    for (const v of map.values()) v.items.sort((a, b) => b.impactScore - a.impactScore);
    // sort teams by total impact desc
    return Array.from(map.entries())
      .map(([teamId, v]) => ({
        teamId,
        ...v,
        impact: v.items.reduce((s, i) => s + i.impactScore, 0),
      }))
      .sort((a, b) => b.impact - a.impact);
  }, [filtered]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Lesions i sancions</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Informe d'absències a tota la lliga, basat en notícies oficials d'ESPN i actualitzat cada 5 minuts.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <SummaryCard label="Total absències" value={counts.total} accent="default" />
        <SummaryCard label="Greus" value={counts.high} accent="destructive" />
        <SummaryCard label="Lesionats" value={counts.injuries} accent="destructive" />
        <SummaryCard label="Dubtes" value={counts.doubtful} accent="warning" />
        <SummaryCard label="Sancionats" value={counts.suspensions} accent="yellow" />
      </div>

      <Card>
        <CardContent className="p-4 flex flex-col md:flex-row gap-3 md:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cerca jugador, equip o tipus de lesió…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Tabs value={type} onValueChange={(v) => setType(v as TypeFilter)}>
            <TabsList>
              <TabsTrigger value="all">Tots</TabsTrigger>
              <TabsTrigger value="injury">Lesió</TabsTrigger>
              <TabsTrigger value="doubtful">Dubte</TabsTrigger>
              <TabsTrigger value="suspension">Sancionat</TabsTrigger>
            </TabsList>
          </Tabs>
          <Tabs value={severity} onValueChange={(v) => setSeverity(v as SeverityFilter)}>
            <TabsList>
              <TabsTrigger value="all">Tots</TabsTrigger>
              <TabsTrigger value="high">Greu</TabsTrigger>
              <TabsTrigger value="medium">Moderada</TabsTrigger>
              <TabsTrigger value="low">Lleu</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardContent>
      </Card>

      {isLoading && (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      )}

      {!isLoading && grouped.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center space-y-2">
            <Activity className="h-10 w-10 mx-auto text-muted-foreground" />
            <div className="text-lg font-medium">Sense absències que coincideixin amb els filtres</div>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Les dades provenen del feed de notícies oficial d'ESPN i només mostren absències verificades. Prova a treure
              filtres o torna a carregar més tard.
            </p>
          </CardContent>
        </Card>
      )}

      {!isLoading &&
        grouped.map((g) => (
          <Card key={g.teamId} className="overflow-hidden">
            <CardHeader className="bg-muted/30 py-3">
              <CardTitle className="flex items-center gap-3 text-base">
                <img src={g.teamCrestUrl} alt={g.teamShortName} className="w-8 h-8 object-contain" />
                <Link href={`/teams/${g.teamId}`} className="hover:underline">
                  {g.teamName}
                </Link>
                <Badge variant="outline" className="ml-auto font-mono">
                  {g.items.length} {g.items.length === 1 ? "absència" : "absències"}
                </Badge>
                <Badge variant="outline" className="font-mono border-destructive/40 text-destructive">
                  Impacte {g.impact.toFixed(2)}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 divide-y divide-border/50">
              {g.items.map((i) => (
                <InjuryRow key={i.id} injury={i} />
              ))}
            </CardContent>
          </Card>
        ))}
    </div>
  );
}

function InjuryRow({ injury }: { injury: InjuryReport }) {
  const initials = injury.playerName
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("");
  const since = relativeDate(injury.injuryDate);
  return (
    <div className="flex flex-col md:flex-row md:items-center gap-4 p-4">
      <div className="flex items-center gap-3 md:w-72 shrink-0">
        <Avatar className="h-12 w-12">
          {injury.headshotUrl ? <AvatarImage src={injury.headshotUrl} alt={injury.playerName} /> : null}
          <AvatarFallback className="text-xs">{initials}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <Link href={`/players/${injury.playerId}`} className="font-semibold hover:underline">
            {injury.playerName}
          </Link>
          <div className="text-xs text-muted-foreground flex items-center gap-2">
            {injury.shirtNumber != null && <span className="font-mono">#{injury.shirtNumber}</span>}
            <span>{POS_LABEL[injury.position]}</span>
            {injury.positionLabel && injury.positionLabel !== POS_LABEL[injury.position] && (
              <span className="opacity-70">· {injury.positionLabel}</span>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 md:w-72 shrink-0">
        <Badge variant="outline" className={`gap-1 ${typeClasses(injury.type)}`}>
          {typeIcon(injury.type)}
          {TYPE_LABEL[injury.type]}
        </Badge>
        <Badge variant="outline" className={severityClasses(injury.severity)}>
          {SEVERITY_LABEL[injury.severity]}
        </Badge>
        {injury.injuryType && (
          <Badge variant="secondary" className="font-mono text-xs">
            {injury.injuryType}
          </Badge>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="text-sm text-foreground/90">{injury.description}</div>
        <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-x-3 gap-y-1">
          <span>Estat: {injury.status}</span>
          {since && <span>· Notificat {since}</span>}
          {injury.expectedReturn && <span>· Retorn previst: {injury.expectedReturn}</span>}
        </div>
      </div>

      <div className="md:ml-4 text-center shrink-0">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Impacte</div>
        <div className="font-mono font-bold text-lg text-destructive bg-destructive/10 rounded px-3 py-1">
          {injury.impactScore.toFixed(2)}
        </div>
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: "default" | "destructive" | "warning" | "yellow";
}) {
  const cls =
    accent === "destructive"
      ? "text-destructive"
      : accent === "warning"
        ? "text-orange-500"
        : accent === "yellow"
          ? "text-yellow-500"
          : "text-foreground";
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className={`text-3xl font-bold font-mono mt-1 ${cls}`}>{value}</div>
      </CardContent>
    </Card>
  );
}
