import { useListPredictions } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";

export default function Predictions() {
  const { data: predictions, isLoading } = useListPredictions();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold tracking-tight">Predictions</h1>
        <Badge variant="outline" className="text-primary border-primary">Live Model Updated</Badge>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
      ) : (
        <div className="space-y-4">
          {predictions?.map(pred => (
            <Link key={pred.matchId} href={`/predictions/${pred.matchId}`}>
              <Card className="hover:border-primary transition-colors cursor-pointer group bg-card/50">
                <CardContent className="p-4 flex items-center justify-between gap-6">
                  
                  {/* Match Info */}
                  <div className="w-1/4">
                    <div className="text-xs text-muted-foreground mb-1">{format(new Date(pred.kickoff), "MMM d, HH:mm")}</div>
                    <div className="font-bold flex flex-col gap-1 text-sm">
                      <div className="flex items-center gap-2">
                        <img src={pred.homeTeam.crestUrl} alt={pred.homeTeam.shortName} className="w-5 h-5 object-contain" />
                        <span>{pred.homeTeam.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <img src={pred.awayTeam.crestUrl} alt={pred.awayTeam.shortName} className="w-5 h-5 object-contain" />
                        <span>{pred.awayTeam.name}</span>
                      </div>
                    </div>
                  </div>

                  {/* Probabilities */}
                  <div className="flex-1 space-y-2">
                    <div className="flex justify-between text-xs text-muted-foreground px-1">
                      <span>{pred.homeTeam.shortName} Win ({(pred.homeWinProb * 100).toFixed(1)}%)</span>
                      <span>Draw ({(pred.drawProb * 100).toFixed(1)}%)</span>
                      <span>{pred.awayTeam.shortName} Win ({(pred.awayWinProb * 100).toFixed(1)}%)</span>
                    </div>
                    <div className="h-3 flex gap-1 rounded overflow-hidden">
                      <div className="bg-primary h-full" style={{ width: `${pred.homeWinProb * 100}%` }} title={`Home Win: ${pred.homeWinProb * 100}%`} />
                      <div className="bg-muted-foreground/30 h-full" style={{ width: `${pred.drawProb * 100}%` }} title={`Draw: ${pred.drawProb * 100}%`} />
                      <div className="bg-chart-2 h-full" style={{ width: `${pred.awayWinProb * 100}%` }} title={`Away Win: ${pred.awayWinProb * 100}%`} />
                    </div>
                  </div>

                  {/* Expected Goals */}
                  <div className="w-24 text-center border-l border-border/50 pl-4 hidden md:block">
                    <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Exp. Goals</div>
                    <div className="font-mono text-lg font-bold">
                      {pred.expectedHomeGoals.toFixed(1)} - {pred.expectedAwayGoals.toFixed(1)}
                    </div>
                  </div>

                  {/* Recommendation */}
                  <div className="w-32 text-right">
                    <div className="mb-2">
                      <Badge variant={pred.confidence > 0.6 ? 'default' : 'secondary'}>
                        {Math.round(pred.confidence * 100)}% Conf
                      </Badge>
                    </div>
                    <div className="text-xs font-bold text-primary group-hover:underline">
                      {pred.recommendation}
                    </div>
                  </div>

                </CardContent>
              </Card>
            </Link>
          ))}
          {predictions?.length === 0 && (
            <div className="text-center text-muted-foreground py-12">No predictions available.</div>
          )}
        </div>
      )}
    </div>
  );
}
