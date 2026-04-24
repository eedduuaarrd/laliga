import { useParams } from "wouter";
import { useGetTeam } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";

export default function TeamDetail() {
  const params = useParams();
  const id = parseInt(params.id || "0");
  const { data, isLoading } = useGetTeam(id, { query: { enabled: !!id, queryKey: ['/api/teams/', id] } });

  if (isLoading) return <div className="space-y-4"><Skeleton className="h-48" /><Skeleton className="h-96" /></div>;
  if (!data) return <div>Team not found</div>;

  const { team, position, points, played, wins, draws, losses, form, squad, upcomingMatches } = data;

  const groupedSquad = squad.reduce((acc, player) => {
    if (!acc[player.position]) acc[player.position] = [];
    acc[player.position].push(player);
    return acc;
  }, {} as Record<string, typeof squad>);

  return (
    <div className="space-y-6">
      <Card className="bg-card border-t-4 border-t-primary overflow-hidden relative">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
           <img src={team.crestUrl} alt="crest bg" className="w-64 h-64 object-contain" />
        </div>
        <CardContent className="p-8 relative z-10">
          <div className="flex flex-col md:flex-row items-center md:items-start gap-8">
            <div className="bg-background rounded-full p-4 border border-border">
              <img src={team.crestUrl} alt={team.name} className="w-24 h-24 object-contain" />
            </div>
            
            <div className="flex-1 text-center md:text-left space-y-4">
              <div>
                <h1 className="text-3xl font-bold">{team.name}</h1>
                <div className="text-muted-foreground mt-1 text-sm">{team.city} • Founded {team.founded}</div>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-2xl">
                <div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Position</div>
                  <div className="text-xl font-bold text-primary">#{position}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Points</div>
                  <div className="text-xl font-bold">{points}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Manager</div>
                  <div className="text-sm font-medium pt-1">{team.manager}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Stadium</div>
                  <div className="text-sm font-medium pt-1">{team.stadium}</div>
                </div>
              </div>
            </div>

            <div className="flex flex-col items-center md:items-end justify-center gap-2 border border-border/50 bg-background/50 p-4 rounded-lg">
              <div className="text-xs text-muted-foreground uppercase tracking-wider">Record</div>
              <div className="font-mono text-lg">{wins}W - {draws}D - {losses}L</div>
              <div className="flex gap-1 mt-2">
                {form.map((f, i) => (
                  <Badge key={i} variant="outline" className={`w-6 h-6 p-0 flex items-center justify-center font-mono ${f === 'W' ? 'border-primary text-primary' : f === 'L' ? 'border-destructive text-destructive' : 'border-muted-foreground text-muted-foreground'}`}>
                    {f}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Squad Overview</CardTitle>
            </CardHeader>
            <CardContent>
              {['FWD', 'MID', 'DEF', 'GK'].map(pos => {
                const players = groupedSquad[pos];
                if (!players?.length) return null;
                return (
                  <div key={pos} className="mb-6 last:mb-0">
                    <h3 className="font-bold text-sm text-muted-foreground uppercase tracking-wider mb-3 pb-1 border-b border-border/50">{pos}</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {players.map(p => (
                        <div key={p.id} className="flex justify-between items-center p-2 rounded-md hover:bg-muted/50 transition-colors border border-transparent hover:border-border/50">
                          <div className="flex items-center gap-3">
                            <span className="w-6 text-center text-xs font-mono text-muted-foreground">{p.shirtNumber}</span>
                            <span className="text-sm font-medium">{p.name}</span>
                          </div>
                          <div className="text-xs text-muted-foreground">{p.nationality}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Upcoming Fixtures</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border/50">
                {upcomingMatches.map(match => {
                  const isHome = match.homeTeam.id === team.id;
                  const opponent = isHome ? match.awayTeam : match.homeTeam;
                  return (
                    <div key={match.id} className="p-4 flex items-center justify-between hover:bg-muted/20 transition-colors">
                      <div className="flex flex-col">
                        <span className="text-xs text-muted-foreground mb-1">{format(new Date(match.kickoff), "MMM d, HH:mm")}</span>
                        <div className="flex items-center gap-2 text-sm font-medium">
                          <span className="text-muted-foreground w-4">{isHome ? 'vs' : '@'}</span>
                          <img src={opponent.crestUrl} alt={opponent.shortName} className="w-4 h-4 object-contain" />
                          <span>{opponent.shortName}</span>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-xs font-mono bg-background">GW {match.gameweek}</Badge>
                    </div>
                  )
                })}
                {upcomingMatches.length === 0 && <div className="p-4 text-center text-sm text-muted-foreground">No upcoming matches</div>}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
