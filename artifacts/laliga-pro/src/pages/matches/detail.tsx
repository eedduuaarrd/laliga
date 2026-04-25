import { useParams } from "wouter";
import { useGetMatch } from "@workspace/api-client-react";
import type {
  MatchSummary,
  LiveMarkets,
  LiveOdds,
  InjuryReport,
  MatchEvent,
} from "@workspace/api-zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Link } from "wouter";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Legend,
} from "recharts";
import { format } from "date-fns";
import { ca } from "date-fns/locale";
import {
  Activity,
  Goal,
  RectangleHorizontal,
  ArrowRightLeft,
  Video,
  Radio,
  TrendingUp,
  ShieldAlert,
} from "lucide-react";

export default function MatchDetail() {
  const params = useParams();
  const id = parseInt(params.id || "0");
  // Live data refetches every 30s while live; finished matches do not poll.
  const { data, isLoading } = useGetMatch(id, {
    query: {
      enabled: !!id,
      queryKey: ["/api/matches/", id],
      refetchInterval: (q) =>
        (q.state.data as { match?: { status?: string } } | undefined)?.match?.status === "live" ? 30_000 : false,
      refetchIntervalInBackground: false,
    },
  });

  if (isLoading) return <div className="space-y-4"><Skeleton className="h-32" /><Skeleton className="h-96" /></div>;
  if (!data) return <div>Partit no trobat</div>;

  const { match, stats, homeLineup, awayLineup, momentum, events, refereeStats, liveMarkets, liveOdds, suspensions } = data;
  const isLive = match.status === "live";

  const radarData = [
    { metric: "Possessió", home: stats.homePossession, away: stats.awayPossession, full: 100 },
    { metric: "Xuts", home: pct(stats.homeShots, stats.homeShots + stats.awayShots), away: pct(stats.awayShots, stats.homeShots + stats.awayShots), full: 100 },
    { metric: "xG", home: pct(stats.homeXG, stats.homeXG + stats.awayXG), away: pct(stats.awayXG, stats.homeXG + stats.awayXG), full: 100 },
    { metric: "Encerts pase", home: stats.homePassAccuracy, away: stats.awayPassAccuracy, full: 100 },
    { metric: "Còrners", home: pct(stats.homeCorners, stats.homeCorners + stats.awayCorners), away: pct(stats.awayCorners, stats.homeCorners + stats.awayCorners), full: 100 },
  ];

  return (
    <div className="space-y-6">
      <Header match={match} isLive={isLive} />

      {isLive && liveMarkets && <LiveProbabilityBar match={match} markets={liveMarkets} />}

      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2">
          <Tabs defaultValue={isLive ? "markets" : "stats"}>
            <TabsList className="w-full">
              {isLive && (
                <TabsTrigger value="markets" className="flex-1">
                  <Radio className="h-3.5 w-3.5 mr-1.5" /> En joc
                </TabsTrigger>
              )}
              <TabsTrigger value="stats" className="flex-1">Estadístiques</TabsTrigger>
              <TabsTrigger value="events" className="flex-1">Esdeveniments</TabsTrigger>
              <TabsTrigger value="momentum" className="flex-1">Moment</TabsTrigger>
              <TabsTrigger value="lineups" className="flex-1">Alineacions</TabsTrigger>
            </TabsList>

            <div className="mt-4">
              {isLive && liveMarkets && (
                <TabsContent value="markets">
                  <LiveMarketsTab match={match} markets={liveMarkets} odds={liveOdds ?? undefined} />
                </TabsContent>
              )}

              <TabsContent value="stats">
                <Card>
                  <CardContent className="p-6">
                    <div className="h-64 mb-8">
                      <ResponsiveContainer width="100%" height="100%">
                        <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                          <PolarGrid stroke="hsl(var(--border))" />
                          <PolarAngleAxis dataKey="metric" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                          <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                          <Radar name={match.homeTeam.shortName} dataKey="home" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.3} />
                          <Radar name={match.awayTeam.shortName} dataKey="away" stroke="hsl(var(--chart-2))" fill="hsl(var(--chart-2))" fillOpacity={0.3} />
                          <Legend />
                        </RadarChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="space-y-4">
                      <StatBar label="Possessió %" home={stats.homePossession} away={stats.awayPossession} max={100} />
                      <StatBar label="Gols esperats (xG)" home={stats.homeXG} away={stats.awayXG} max={Math.max(stats.homeXG, stats.awayXG, 3)} />
                      <StatBar label="Xuts totals" home={stats.homeShots} away={stats.awayShots} max={Math.max(stats.homeShots, stats.awayShots, 20)} />
                      <StatBar label="Xuts a porta" home={stats.homeShotsOnTarget} away={stats.awayShotsOnTarget} max={Math.max(stats.homeShotsOnTarget, stats.awayShotsOnTarget, 10)} />
                      <StatBar label="Encerts pase %" home={stats.homePassAccuracy} away={stats.awayPassAccuracy} max={100} />
                      <StatBar label="Còrners" home={stats.homeCorners} away={stats.awayCorners} max={Math.max(stats.homeCorners, stats.awayCorners, 10)} />
                      <StatBar label="Faltes" home={stats.homeFouls} away={stats.awayFouls} max={Math.max(stats.homeFouls, stats.awayFouls, 20)} />
                      <StatBar label="Targetes grogues" home={stats.homeYellow} away={stats.awayYellow} max={Math.max(stats.homeYellow, stats.awayYellow, 5)} />
                      <StatBar label="Targetes vermelles" home={stats.homeRed} away={stats.awayRed} max={Math.max(stats.homeRed, stats.awayRed, 2)} />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="events">
                <EventsTimeline match={match} events={events} />
              </TabsContent>

              <TabsContent value="momentum">
                <Card>
                  <CardContent className="p-6 h-[400px]">
                    {momentum.length === 0 ? (
                      <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                        Encara no hi ha prou esdeveniments per estimar el moment.
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={momentum} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                          <XAxis dataKey="minute" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                          <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                          <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))" }} />
                          <Area type="monotone" dataKey="homeIntensity" stackId="1" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.3} name={match.homeTeam.shortName} />
                          <Area type="monotone" dataKey="awayIntensity" stackId="2" stroke="hsl(var(--chart-2))" fill="hsl(var(--chart-2))" fillOpacity={0.3} name={match.awayTeam.shortName} />
                        </AreaChart>
                      </ResponsiveContainer>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="lineups">
                <div className="grid grid-cols-2 gap-4">
                  <LineupCard team={match.homeTeam.shortName} formation={homeLineup.formation} starting={homeLineup.starting} accent="primary" />
                  <LineupCard team={match.awayTeam.shortName} formation={awayLineup.formation} starting={awayLineup.starting} accent="chart-2" />
                </div>
              </TabsContent>
            </div>
          </Tabs>
        </div>

        <div className="space-y-6">
          {liveOdds && <LiveOddsCard odds={liveOdds} match={match} />}

          {suspensions && suspensions.length > 0 && <SuspensionsCard items={suspensions} />}

          <Card>
            <CardHeader>
              <CardTitle className="text-sm uppercase tracking-wider text-muted-foreground">Informació del partit</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="text-xs text-muted-foreground">Estadi</div>
                <div className="font-medium">{match.venue}</div>
              </div>
              <div className="pt-4 border-t border-border/50">
                <div className="text-xs text-muted-foreground mb-2">Àrbitre</div>
                <div className="font-medium">{refereeStats.name}</div>
                <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
                  <div className="bg-muted p-2 rounded">
                    <div className="text-muted-foreground">Mitjana targetes</div>
                    <div className="font-mono">{refereeStats.avgYellow} Y / {refereeStats.avgRed} R</div>
                  </div>
                  <div className="bg-muted p-2 rounded">
                    <div className="text-muted-foreground">Mitjana faltes</div>
                    <div className="font-mono">{refereeStats.avgFouls}</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function pct(n: number, total: number): number {
  if (!total) return 0;
  return Math.round((n / total) * 100);
}

function Header({ match, isLive }: { match: MatchSummary; isLive: boolean }) {
  const status = match.status;
  return (
    <Card className={isLive ? "border-destructive/40 shadow-[0_0_0_1px_hsl(var(--destructive)/0.4)]" : "bg-card"}>
      <CardContent className="p-6">
        <div className="flex justify-between items-center mb-6">
          <Badge variant="outline">Jornada {match.gameweek}</Badge>
          {isLive ? (
            <Badge variant="destructive" className="gap-2 px-3 py-1">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
              </span>
              EN DIRECTE · {match.minute}'
            </Badge>
          ) : (
            <Badge variant={status === "finished" ? "secondary" : "outline"}>
              {status === "finished" ? "FINALITZAT" : status === "upcoming" ? "PRÒXIM" : status.toUpperCase()}
            </Badge>
          )}
          <div className="text-sm text-muted-foreground">{format(new Date(match.kickoff), "d MMM yyyy · HH:mm", { locale: ca })}</div>
        </div>

        <div className="flex justify-between items-center">
          <Link href={`/teams/${match.homeTeam.id}`} className="flex flex-col items-center gap-3 w-1/3 hover:opacity-80">
            <img src={match.homeTeam.crestUrl} alt={match.homeTeam.name} className="w-24 h-24 object-contain" />
            <h2 className="text-xl font-bold text-center">{match.homeTeam.name}</h2>
          </Link>

          <div className="w-1/3 text-center">
            {status !== "upcoming" ? (
              <>
                <div className={`text-6xl font-black font-mono tracking-tighter ${isLive ? "text-destructive" : ""}`}>
                  {match.homeScore} - {match.awayScore}
                </div>
                <div className="text-xs text-muted-foreground mt-2 uppercase tracking-wider">{match.statusDetail}</div>
              </>
            ) : (
              <div className="text-2xl font-bold text-muted-foreground">VS</div>
            )}
          </div>

          <Link href={`/teams/${match.awayTeam.id}`} className="flex flex-col items-center gap-3 w-1/3 hover:opacity-80">
            <img src={match.awayTeam.crestUrl} alt={match.awayTeam.name} className="w-24 h-24 object-contain" />
            <h2 className="text-xl font-bold text-center">{match.awayTeam.name}</h2>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

function LiveProbabilityBar({ match, markets }: { match: MatchSummary; markets: LiveMarkets }) {
  const home = Math.round(markets.homeWinProb * 100);
  const draw = Math.round(markets.drawProb * 100);
  const away = Math.round(markets.awayWinProb * 100);
  return (
    <Card className="border-destructive/30">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-destructive" />
            <span className="font-semibold uppercase tracking-wider text-destructive">Probabilitat en directe · {markets.recommendation}</span>
          </div>
          <div className="text-muted-foreground font-mono">Min {markets.asOfMinute ?? match.minute}'</div>
        </div>
        <div className="flex h-3 rounded-full overflow-hidden bg-muted">
          <div className="bg-primary" style={{ width: `${home}%` }} />
          <div className="bg-muted-foreground/40" style={{ width: `${draw}%` }} />
          <div className="bg-chart-2" style={{ width: `${away}%` }} />
        </div>
        <div className="grid grid-cols-3 text-xs font-mono">
          <div>
            <div className="text-primary font-bold">{home}%</div>
            <div className="text-muted-foreground">{match.homeTeam.shortName}</div>
          </div>
          <div className="text-center">
            <div className="text-foreground font-bold">{draw}%</div>
            <div className="text-muted-foreground">Empat</div>
          </div>
          <div className="text-right">
            <div className="text-chart-2 font-bold">{away}%</div>
            <div className="text-muted-foreground">{match.awayTeam.shortName}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function LiveMarketsTab({ match, markets, odds }: { match: MatchSummary; markets: LiveMarkets; odds?: LiveOdds }) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <Activity className="h-4 w-4" /> Resultat (1X2 en viu)
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-3 gap-3">
          <ProbCell label={match.homeTeam.shortName} prob={markets.homeWinProb} accent="primary" odd={odds?.homeMoneyline ?? null} />
          <ProbCell label="Empat" prob={markets.drawProb} accent="muted" odd={odds?.drawMoneyline ?? null} />
          <ProbCell label={match.awayTeam.shortName} prob={markets.awayWinProb} accent="chart-2" odd={odds?.awayMoneyline ?? null} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <Goal className="h-4 w-4" /> Pròxim gol
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-3 gap-3">
          <ProbCell label={match.homeTeam.shortName} prob={markets.nextGoalHome} accent="primary" />
          <ProbCell label="Cap més" prob={markets.nextGoalNone} accent="muted" />
          <ProbCell label={match.awayTeam.shortName} prob={markets.nextGoalAway} accent="chart-2" />
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm uppercase tracking-wider text-muted-foreground">Total de gols</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <BinaryProb label="Més de 2.5 gols" yes={markets.over25Prob} no={markets.under25Prob} />
            <BinaryProb label="Més de 3.5 gols" yes={markets.over35Prob} no={1 - markets.over35Prob} />
            <BinaryProb label="Tots dos marquen" yes={markets.bttsProb} no={1 - markets.bttsProb} />
            {odds?.overUnder != null && (
              <div className="text-xs font-mono text-muted-foreground pt-2 border-t border-border/40">
                {odds.bookmaker} línia O/U: {odds.overUnder}
                {odds.overOdds != null && odds.underOdds != null && (
                  <span> · Over {fmtOdd(odds.overOdds)} / Under {fmtOdd(odds.underOdds)}</span>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm uppercase tracking-wider text-muted-foreground">Porteria a zero</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <BinaryProb label={`${match.homeTeam.shortName} mantinguda`} yes={markets.cleanSheetHome} no={1 - markets.cleanSheetHome} />
            <BinaryProb label={`${match.awayTeam.shortName} mantinguda`} yes={markets.cleanSheetAway} no={1 - markets.cleanSheetAway} />
            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border/40">
              <Mini label="xRem casa" value={markets.expectedRemainingHomeGoals.toFixed(2)} />
              <Mini label="xRem fora" value={markets.expectedRemainingAwayGoals.toFixed(2)} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm uppercase tracking-wider text-muted-foreground">Targetes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <BinaryProb label="Més de 3.5 targetes" yes={markets.over35CardsProb} no={1 - markets.over35CardsProb} />
            <BinaryProb label="Més de 4.5 targetes" yes={markets.over45CardsProb} no={1 - markets.over45CardsProb} />
            <BinaryProb label="Més de 5.5 targetes" yes={markets.over55CardsProb} no={1 - markets.over55CardsProb} />
            <Mini label="Total esperat" value={markets.expectedTotalCards.toFixed(2)} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm uppercase tracking-wider text-muted-foreground">Còrners</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <BinaryProb label="Més de 8.5 còrners" yes={markets.over85CornersProb} no={1 - markets.over85CornersProb} />
            <BinaryProb label="Més de 9.5 còrners" yes={markets.over95CornersProb} no={1 - markets.over95CornersProb} />
            <Mini label="Total esperat" value={markets.expectedTotalCorners.toFixed(2)} />
          </CardContent>
        </Card>
      </div>

      <p className="text-[11px] text-muted-foreground italic">
        Probabilitats calculades amb un model Poisson sobre el temps restant a partir d'estadístiques en directe d'ESPN.
        Quotes proporcionades per {odds?.bookmaker ?? "el llibre disponible"} amb finalitats merament informatives.
      </p>
    </div>
  );
}

function ProbCell({ label, prob, accent, odd }: { label: string; prob: number; accent: "primary" | "chart-2" | "muted"; odd?: number | null }) {
  const cls = accent === "primary" ? "text-primary" : accent === "chart-2" ? "text-chart-2" : "text-foreground";
  const bg = accent === "primary" ? "bg-primary/10" : accent === "chart-2" ? "bg-chart-2/10" : "bg-muted";
  return (
    <div className={`rounded-md p-3 ${bg}`}>
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`text-2xl font-bold font-mono ${cls}`}>{Math.round(prob * 100)}%</div>
      {odd != null && <div className="text-xs font-mono text-muted-foreground">Quota {fmtOdd(odd)}</div>}
    </div>
  );
}

function BinaryProb({ label, yes }: { label: string; yes: number; no: number }) {
  const pctYes = Math.round(yes * 100);
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono font-bold">{pctYes}%</span>
      </div>
      <Progress value={pctYes} className="h-2" />
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-muted rounded p-2 text-center">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="font-mono font-bold">{value}</div>
    </div>
  );
}

function fmtOdd(american: number): string {
  return american > 0 ? `+${american}` : `${american}`;
}

function LiveOddsCard({ odds, match }: { odds: LiveOdds; match: MatchSummary }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <Radio className="h-4 w-4" /> Quotes en viu · {odds.bookmaker}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{match.homeTeam.shortName}</div>
            <div className="font-mono font-bold">{odds.homeMoneyline != null ? fmtOdd(odds.homeMoneyline) : "—"}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Empat</div>
            <div className="font-mono font-bold">{odds.drawMoneyline != null ? fmtOdd(odds.drawMoneyline) : "—"}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{match.awayTeam.shortName}</div>
            <div className="font-mono font-bold">{odds.awayMoneyline != null ? fmtOdd(odds.awayMoneyline) : "—"}</div>
          </div>
        </div>
        {odds.spreadDetails && (
          <div className="text-xs flex justify-between border-t border-border/40 pt-2">
            <span className="text-muted-foreground">Hàndicap</span>
            <span className="font-mono">{odds.spreadDetails}</span>
          </div>
        )}
        {odds.overUnder != null && (
          <div className="text-xs flex justify-between">
            <span className="text-muted-foreground">Total línia</span>
            <span className="font-mono">{odds.overUnder}</span>
          </div>
        )}
        <div className="text-[10px] text-muted-foreground italic pt-2 border-t border-border/40">
          Probabilitats implícites: {match.homeTeam.shortName} {Math.round(odds.homeImpliedProb * 100)}% · X {Math.round(odds.drawImpliedProb * 100)}% · {match.awayTeam.shortName} {Math.round(odds.awayImpliedProb * 100)}%
        </div>
      </CardContent>
    </Card>
  );
}

function SuspensionsCard({ items }: { items: InjuryReport[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <ShieldAlert className="h-4 w-4" /> Baixes per aquest partit
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.map((i) => {
          const initials = i.playerName.split(" ").map((p) => p[0]).slice(0, 2).join("");
          return (
            <div key={i.id} className="flex items-center gap-3">
              <Avatar className="h-9 w-9">
                {i.headshotUrl ? <AvatarImage src={i.headshotUrl} alt={i.playerName} /> : null}
                <AvatarFallback className="text-[10px]">{initials}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <Link href={`/players/${i.playerId}`} className="text-sm font-medium hover:underline truncate block">
                  {i.playerName}
                </Link>
                <div className="text-xs text-muted-foreground truncate">
                  {i.positionLabel || i.position} · {i.injuryType ?? i.status}
                </div>
              </div>
              <Badge variant="outline" className={
                i.severity === "high" ? "border-destructive/50 text-destructive" : "border-orange-400/50 text-orange-500"
              }>
                {i.type === "suspension" ? "Sancionat" : i.severity === "high" ? "Greu" : "Moderada"}
              </Badge>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function eventIcon(type: MatchEvent["type"]) {
  if (type === "goal") return <Goal className="h-4 w-4" />;
  if (type === "yellow" || type === "red") return <RectangleHorizontal className="h-4 w-4" />;
  if (type === "sub") return <ArrowRightLeft className="h-4 w-4" />;
  if (type === "var") return <Video className="h-4 w-4" />;
  return <Activity className="h-4 w-4" />;
}

function eventBadgeClasses(type: MatchEvent["type"]) {
  if (type === "goal") return "border-primary text-primary bg-primary/10";
  if (type === "yellow") return "border-yellow-500 text-yellow-500 bg-yellow-500/10";
  if (type === "red") return "border-red-500 text-red-500 bg-red-500/10";
  if (type === "sub") return "border-blue-400 text-blue-400 bg-blue-400/10";
  if (type === "var") return "border-purple-400 text-purple-400 bg-purple-400/10";
  return "";
}

const EVENT_LABEL: Record<MatchEvent["type"], string> = {
  goal: "GOL",
  yellow: "GROGA",
  red: "VERMELLA",
  sub: "CANVI",
  var: "VAR",
  other: "EVENT",
};

function EventsTimeline({ match, events }: { match: MatchSummary; events: MatchEvent[] }) {
  if (events.length === 0) {
    return (
      <Card>
        <CardContent className="p-12 text-center text-muted-foreground text-sm">
          Encara no hi ha esdeveniments registrats.
        </CardContent>
      </Card>
    );
  }
  // Show in reverse so newest is on top.
  const ordered = [...events].sort((a, b) => b.minute - a.minute);
  return (
    <Card>
      <CardContent className="p-0 divide-y divide-border/40">
        {ordered.map((e, i) => {
          const home = e.teamSide === "home";
          return (
            <div key={i} className="flex items-stretch">
              <div className="w-14 text-center text-sm font-bold text-muted-foreground bg-muted/30 flex items-center justify-center">{e.minute}'</div>
              <div className={`flex-1 p-3 flex items-center gap-3 ${home ? "" : "flex-row-reverse text-right bg-muted/10"}`}>
                <Badge variant="outline" className={`gap-1 ${eventBadgeClasses(e.type)}`}>
                  {eventIcon(e.type)}
                  {EVENT_LABEL[e.type]}
                </Badge>
                <div className={`flex-1 ${home ? "" : "text-right"}`}>
                  <div className="font-medium text-sm">
                    {e.playerName ?? (home ? match.homeTeam.shortName : match.awayTeam.shortName)}
                  </div>
                  {e.detail && <div className="text-xs text-muted-foreground mt-0.5">{e.detail}</div>}
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function LineupCard({
  team,
  formation,
  starting,
  accent,
}: {
  team: string;
  formation: string;
  starting: { id: number; shirtNumber: number; name: string; position: string }[];
  accent: "primary" | "chart-2";
}) {
  const cls = accent === "primary" ? "text-primary" : "text-chart-2";
  return (
    <Card>
      <CardHeader className="py-3">
        <CardTitle className="text-sm flex justify-between">
          <span>{team}</span>
          <span className={cls}>{formation}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-1">
          {starting.map((p) => (
            <div key={p.id} className="flex justify-between text-sm py-1 border-b border-border/50 last:border-0">
              <span>
                <span className="text-muted-foreground mr-2 w-6 inline-block font-mono text-xs">{p.shirtNumber}</span>
                {p.name}
              </span>
              <span className="text-muted-foreground text-xs">{p.position}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function StatBar({ label, home, away, max }: { label: string; home: number; away: number; max: number }) {
  const homePct = max > 0 ? (home / max) * 100 : 0;
  const awayPct = max > 0 ? (away / max) * 100 : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span className="font-mono w-12 text-foreground">{typeof home === "number" && home % 1 !== 0 ? home.toFixed(2) : home}</span>
        <span>{label}</span>
        <span className="font-mono w-12 text-right text-foreground">{typeof away === "number" && away % 1 !== 0 ? away.toFixed(2) : away}</span>
      </div>
      <div className="flex h-2 w-full gap-1">
        <div className="flex-1 bg-muted rounded-l-full overflow-hidden flex justify-end">
          <div className="bg-primary h-full" style={{ width: `${homePct}%` }} />
        </div>
        <div className="flex-1 bg-muted rounded-r-full overflow-hidden">
          <div className="bg-chart-2 h-full" style={{ width: `${awayPct}%` }} />
        </div>
      </div>
    </div>
  );
}
