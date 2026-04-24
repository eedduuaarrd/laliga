import { useListMatches } from "@workspace/api-client-react";
import { useState } from "react";
import { format } from "date-fns";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
type ListMatchesStatus = "scheduled" | "live" | "finished";

export default function Matches() {
  const [status, setStatus] = useState<ListMatchesStatus | "all">("all");
  const { data: matches, isLoading } = useListMatches({ status: status === "all" ? undefined : status as any });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold tracking-tight">Matches</h1>
        <Tabs value={status} onValueChange={(v) => setStatus(v as any)}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="live">Live</TabsTrigger>
            <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
            <TabsTrigger value="finished">Finished</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32" />)}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {matches?.map(match => (
            <Link key={match.id} href={`/matches/${match.id}`}>
              <Card className="hover:border-primary transition-colors cursor-pointer bg-card/50">
                <CardContent className="p-4 flex flex-col h-full justify-between">
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-xs text-muted-foreground uppercase tracking-wider">GW {match.gameweek}</span>
                    <Badge variant={match.status === 'live' ? 'destructive' : match.status === 'finished' ? 'secondary' : 'outline'}>
                      {match.status === 'live' ? `${match.minute}'` : match.status.toUpperCase()}
                    </Badge>
                  </div>
                  
                  <div className="flex justify-between items-center px-2">
                    <div className="flex flex-col items-center gap-2 w-1/3">
                      <img src={match.homeTeam.crestUrl} alt={match.homeTeam.shortName} className="w-10 h-10 object-contain" />
                      <span className="font-bold text-sm text-center">{match.homeTeam.shortName}</span>
                    </div>
                    
                    <div className="flex flex-col items-center justify-center w-1/3">
                      {match.status !== 'upcoming' ? (
                        <div className="text-2xl font-black bg-background px-3 py-1 rounded-md border border-border">
                          {match.homeScore} - {match.awayScore}
                        </div>
                      ) : (
                        <div className="text-sm font-medium text-muted-foreground bg-background px-2 py-1 rounded-md border border-border">
                          {format(new Date(match.kickoff), "HH:mm")}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col items-center gap-2 w-1/3">
                      <img src={match.awayTeam.crestUrl} alt={match.awayTeam.shortName} className="w-10 h-10 object-contain" />
                      <span className="font-bold text-sm text-center">{match.awayTeam.shortName}</span>
                    </div>
                  </div>
                  
                  <div className="mt-4 text-xs text-center text-muted-foreground pt-3 border-t border-border/50">
                    {format(new Date(match.kickoff), "MMM d, yyyy")} • {match.venue}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
          {matches?.length === 0 && (
            <div className="col-span-full py-12 text-center text-muted-foreground">
              No matches found for this filter.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
