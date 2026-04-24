import { useParams } from "wouter";
import { useGetMatch } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend } from "recharts";
import { format } from "date-fns";

export default function MatchDetail() {
  const params = useParams();
  const id = parseInt(params.id || "0");
  const { data, isLoading } = useGetMatch(id, { query: { enabled: !!id, queryKey: ['/api/matches/', id] } });

  if (isLoading) return <div className="space-y-4"><Skeleton className="h-32" /><Skeleton className="h-96" /></div>;
  if (!data) return <div>Match not found</div>;

  const { match, stats, homeLineup, awayLineup, momentum, events, refereeStats } = data;

  const radarData = [
    { metric: 'Possession', home: stats.homePossession, away: stats.awayPossession, full: 100 },
    { metric: 'Shots', home: stats.homeShots * 5, away: stats.awayShots * 5, full: 100 },
    { metric: 'xG', home: stats.homeXG * 30, away: stats.awayXG * 30, full: 100 },
    { metric: 'Pass Acc', home: stats.homePassAccuracy, away: stats.awayPassAccuracy, full: 100 },
    { metric: 'Corners', home: stats.homeCorners * 10, away: stats.awayCorners * 10, full: 100 },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="bg-card">
        <CardContent className="p-6">
          <div className="flex justify-between items-center mb-6">
            <Badge variant="outline">GW {match.gameweek}</Badge>
            <Badge variant={match.status === 'live' ? 'destructive' : match.status === 'finished' ? 'secondary' : 'outline'}>
              {match.status === 'live' ? `${match.minute}'` : match.status.toUpperCase()}
            </Badge>
            <div className="text-sm text-muted-foreground">{format(new Date(match.kickoff), "MMM d, yyyy - HH:mm")}</div>
          </div>
          
          <div className="flex justify-between items-center">
            <div className="flex flex-col items-center gap-4 w-1/3">
              <img src={match.homeTeam.crestUrl} alt={match.homeTeam.name} className="w-24 h-24 object-contain" />
              <h2 className="text-xl font-bold text-center">{match.homeTeam.name}</h2>
            </div>
            
            <div className="w-1/3 text-center">
              {match.status !== 'upcoming' ? (
                <div className="text-6xl font-black font-mono tracking-tighter">
                  {match.homeScore} - {match.awayScore}
                </div>
              ) : (
                <div className="text-2xl font-bold text-muted-foreground">VS</div>
              )}
            </div>

            <div className="flex flex-col items-center gap-4 w-1/3">
              <img src={match.awayTeam.crestUrl} alt={match.awayTeam.name} className="w-24 h-24 object-contain" />
              <h2 className="text-xl font-bold text-center">{match.awayTeam.name}</h2>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2">
          <Tabs defaultValue="stats">
            <TabsList className="w-full">
              <TabsTrigger value="stats" className="flex-1">Stats</TabsTrigger>
              <TabsTrigger value="lineups" className="flex-1">Lineups</TabsTrigger>
              <TabsTrigger value="momentum" className="flex-1">Momentum</TabsTrigger>
              <TabsTrigger value="events" className="flex-1">Events</TabsTrigger>
            </TabsList>
            
            <div className="mt-4">
              <TabsContent value="stats">
                <Card>
                  <CardContent className="p-6">
                    <div className="h-64 mb-8">
                      <ResponsiveContainer width="100%" height="100%">
                        <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                          <PolarGrid stroke="hsl(var(--border))" />
                          <PolarAngleAxis dataKey="metric" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                          <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                          <Radar name={match.homeTeam.shortName} dataKey="home" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.3} />
                          <Radar name={match.awayTeam.shortName} dataKey="away" stroke="hsl(var(--chart-2))" fill="hsl(var(--chart-2))" fillOpacity={0.3} />
                          <Legend />
                        </RadarChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="space-y-4">
                      <StatBar label="Possession %" home={stats.homePossession} away={stats.awayPossession} max={100} />
                      <StatBar label="Expected Goals (xG)" home={stats.homeXG} away={stats.awayXG} max={Math.max(stats.homeXG, stats.awayXG, 3)} />
                      <StatBar label="Total Shots" home={stats.homeShots} away={stats.awayShots} max={Math.max(stats.homeShots, stats.awayShots, 20)} />
                      <StatBar label="Shots on Target" home={stats.homeShotsOnTarget} away={stats.awayShotsOnTarget} max={Math.max(stats.homeShotsOnTarget, stats.awayShotsOnTarget, 10)} />
                      <StatBar label="Pass Accuracy %" home={stats.homePassAccuracy} away={stats.awayPassAccuracy} max={100} />
                      <StatBar label="Corners" home={stats.homeCorners} away={stats.awayCorners} max={Math.max(stats.homeCorners, stats.awayCorners, 10)} />
                      <StatBar label="Fouls" home={stats.homeFouls} away={stats.awayFouls} max={Math.max(stats.homeFouls, stats.awayFouls, 20)} />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="lineups">
                <div className="grid grid-cols-2 gap-4">
                  <Card>
                    <CardHeader className="py-3">
                      <CardTitle className="text-sm flex justify-between">
                        <span>{match.homeTeam.shortName}</span>
                        <span className="text-primary">{homeLineup.formation}</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="space-y-1">
                        {homeLineup.starting.map(p => (
                          <div key={p.id} className="flex justify-between text-sm py-1 border-b border-border/50 last:border-0">
                            <span><span className="text-muted-foreground mr-2 w-4 inline-block">{p.shirtNumber}</span> {p.name}</span>
                            <span className="text-muted-foreground text-xs">{p.position}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="py-3">
                      <CardTitle className="text-sm flex justify-between">
                        <span>{match.awayTeam.shortName}</span>
                        <span className="text-chart-2">{awayLineup.formation}</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="space-y-1">
                        {awayLineup.starting.map(p => (
                          <div key={p.id} className="flex justify-between text-sm py-1 border-b border-border/50 last:border-0">
                            <span><span className="text-muted-foreground mr-2 w-4 inline-block">{p.shirtNumber}</span> {p.name}</span>
                            <span className="text-muted-foreground text-xs">{p.position}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="momentum">
                <Card>
                  <CardContent className="p-6 h-[400px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={momentum} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <XAxis dataKey="minute" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                        <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                        <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))' }} />
                        <Area type="monotone" dataKey="homeIntensity" stackId="1" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.3} name={match.homeTeam.shortName} />
                        <Area type="monotone" dataKey="awayIntensity" stackId="2" stroke="hsl(var(--chart-2))" fill="hsl(var(--chart-2))" fillOpacity={0.3} name={match.awayTeam.shortName} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="events">
                <Card>
                  <CardContent className="p-6 space-y-4">
                    {events.map((e, i) => (
                      <div key={i} className={`flex items-center gap-4 ${e.teamSide === 'away' ? 'flex-row-reverse' : ''}`}>
                        <div className="w-12 text-center text-sm font-bold text-muted-foreground">{e.minute}'</div>
                        <div className={`flex-1 flex items-center gap-2 border rounded-md p-2 ${e.teamSide === 'away' ? 'flex-row-reverse text-right bg-muted/20' : 'bg-muted/10'}`}>
                          <Badge variant="outline" className={
                            e.type === 'goal' ? 'border-primary text-primary' : 
                            e.type === 'yellow' ? 'border-yellow-500 text-yellow-500' : 
                            e.type === 'red' ? 'border-red-500 text-red-500' : ''
                          }>{e.type.toUpperCase()}</Badge>
                          <span className="font-medium text-sm">{e.playerName}</span>
                          {e.detail && <span className="text-xs text-muted-foreground">({e.detail})</span>}
                        </div>
                        <div className="flex-1"></div>
                      </div>
                    ))}
                    {events.length === 0 && <div className="text-center text-muted-foreground py-8">No events available</div>}
                  </CardContent>
                </Card>
              </TabsContent>
            </div>
          </Tabs>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm uppercase tracking-wider text-muted-foreground">Match Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="text-xs text-muted-foreground">Venue</div>
                <div className="font-medium">{match.venue}</div>
              </div>
              <div className="pt-4 border-t border-border/50">
                <div className="text-xs text-muted-foreground mb-2">Referee</div>
                <div className="font-medium">{refereeStats.name}</div>
                <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
                  <div className="bg-muted p-2 rounded">
                    <div className="text-muted-foreground">Avg Cards</div>
                    <div className="font-mono">{refereeStats.avgYellow} Y / {refereeStats.avgRed} R</div>
                  </div>
                  <div className="bg-muted p-2 rounded">
                    <div className="text-muted-foreground">Avg Fouls</div>
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

function StatBar({ label, home, away, max }: { label: string, home: number, away: number, max: number }) {
  const homePct = (home / max) * 100;
  const awayPct = (away / max) * 100;
  
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span className="font-mono w-8">{typeof home === 'number' && home % 1 !== 0 ? home.toFixed(2) : home}</span>
        <span>{label}</span>
        <span className="font-mono w-8 text-right">{typeof away === 'number' && away % 1 !== 0 ? away.toFixed(2) : away}</span>
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
