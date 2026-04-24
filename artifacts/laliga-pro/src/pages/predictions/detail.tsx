import { useGetPrediction } from "@workspace/api-client-react";
import { useParams } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";

export default function PredictionDetail() {
  const params = useParams();
  const id = parseInt(params.id || "0");
  const { data, isLoading } = useGetPrediction(id, { query: { enabled: !!id, queryKey: ['/api/predictions/', id] } });

  if (isLoading) return <div className="space-y-4"><Skeleton className="h-32" /><Skeleton className="h-96" /></div>;
  if (!data) return <div>Prediction not found</div>;

  const { base, scoreMatrix, topScorelines, formFactor, h2h, absenceImpact, marketOdds } = data;

  const maxProb = Math.max(...scoreMatrix.map(s => s.probability));

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="bg-card border-primary/20">
        <CardContent className="p-6">
          <div className="flex justify-between items-center mb-6">
            <div className="text-sm text-muted-foreground">{format(new Date(base.kickoff), "MMM d, yyyy - HH:mm")}</div>
            <Badge variant="outline" className="text-primary border-primary">{base.recommendation}</Badge>
          </div>
          
          <div className="flex justify-between items-center">
            <div className="flex flex-col items-center gap-4 w-1/3">
              <img src={base.homeTeam.crestUrl} alt={base.homeTeam.name} className="w-20 h-20 object-contain" />
              <h2 className="text-xl font-bold text-center">{base.homeTeam.shortName}</h2>
              <div className="text-2xl font-mono text-primary">{(base.homeWinProb * 100).toFixed(1)}%</div>
            </div>
            
            <div className="w-1/3 flex flex-col items-center">
              <div className="text-sm font-bold text-muted-foreground mb-2">DRAW</div>
              <div className="text-2xl font-mono">{(base.drawProb * 100).toFixed(1)}%</div>
              <div className="mt-4 text-xs uppercase tracking-wider text-muted-foreground">Exp Goals</div>
              <div className="font-mono text-lg">{base.expectedHomeGoals.toFixed(2)} - {base.expectedAwayGoals.toFixed(2)}</div>
            </div>

            <div className="flex flex-col items-center gap-4 w-1/3">
              <img src={base.awayTeam.crestUrl} alt={base.awayTeam.name} className="w-20 h-20 object-contain" />
              <h2 className="text-xl font-bold text-center">{base.awayTeam.shortName}</h2>
              <div className="text-2xl font-mono text-chart-2">{(base.awayWinProb * 100).toFixed(1)}%</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Score Matrix */}
        <Card>
          <CardHeader>
            <CardTitle>Poisson Score Matrix</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <div className="inline-block min-w-full">
                <div className="flex">
                  <div className="w-8 shrink-0 flex items-center justify-center -rotate-90 text-xs text-muted-foreground font-bold">
                    HOME
                  </div>
                  <div className="flex-1">
                    <div className="flex pl-8 mb-2">
                      <div className="w-full text-center text-xs text-muted-foreground font-bold">AWAY</div>
                    </div>
                    <div className="flex pl-8 mb-1">
                      {Array.from({ length: 6 }).map((_, i) => (
                        <div key={`col-${i}`} className="w-12 text-center text-xs font-mono">{i}</div>
                      ))}
                    </div>
                    {Array.from({ length: 6 }).map((_, h) => (
                      <div key={`row-${h}`} className="flex mb-1 items-center">
                        <div className="w-8 text-center text-xs font-mono shrink-0">{h}</div>
                        {Array.from({ length: 6 }).map((_, a) => {
                          const cell = scoreMatrix.find(s => s.homeGoals === h && s.awayGoals === a);
                          const prob = cell ? cell.probability : 0;
                          const intensity = prob / maxProb;
                          return (
                            <div 
                              key={`cell-${h}-${a}`} 
                              className="w-12 h-10 flex items-center justify-center text-[10px] font-mono border border-background/20"
                              style={{ 
                                backgroundColor: `hsl(var(--primary) / ${intensity * 0.8})`,
                                color: intensity > 0.5 ? 'hsl(var(--primary-foreground))' : 'hsl(var(--foreground))'
                              }}
                              title={`${h}-${a}: ${(prob * 100).toFixed(1)}%`}
                            >
                              {(prob * 100).toFixed(1)}
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6">
              <h4 className="text-sm font-bold mb-3">Most Likely Scorelines</h4>
              <div className="grid grid-cols-3 gap-2">
                {topScorelines.slice(0, 3).map((ts, i) => (
                  <div key={i} className="bg-muted p-2 rounded-md text-center border border-border/50">
                    <div className="text-lg font-bold font-mono">{ts.label}</div>
                    <div className="text-xs text-primary">{(ts.probability * 100).toFixed(1)}%</div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          {/* Market Value */}
          <Card>
            <CardHeader>
              <CardTitle>Market Edge Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-2 text-center text-xs font-bold text-muted-foreground mb-2">
                  <div>HOME</div>
                  <div>DRAW</div>
                  <div>AWAY</div>
                </div>
                
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-muted p-2 rounded">
                    <div className="text-xs text-muted-foreground mb-1">Odds</div>
                    <div className="font-mono">{marketOdds.homeOdds.toFixed(2)}</div>
                  </div>
                  <div className="bg-muted p-2 rounded">
                    <div className="text-xs text-muted-foreground mb-1">Odds</div>
                    <div className="font-mono">{marketOdds.drawOdds.toFixed(2)}</div>
                  </div>
                  <div className="bg-muted p-2 rounded">
                    <div className="text-xs text-muted-foreground mb-1">Odds</div>
                    <div className="font-mono">{marketOdds.awayOdds.toFixed(2)}</div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className={`p-2 rounded border ${marketOdds.valueHome > 5 ? 'border-primary bg-primary/10' : 'border-border'}`}>
                    <div className="text-xs text-muted-foreground mb-1">Edge</div>
                    <div className={`font-mono font-bold ${marketOdds.valueHome > 0 ? 'text-primary' : 'text-destructive'}`}>
                      {marketOdds.valueHome > 0 ? '+' : ''}{marketOdds.valueHome.toFixed(1)}%
                    </div>
                  </div>
                  <div className={`p-2 rounded border ${marketOdds.valueDraw > 5 ? 'border-primary bg-primary/10' : 'border-border'}`}>
                    <div className="text-xs text-muted-foreground mb-1">Edge</div>
                    <div className={`font-mono font-bold ${marketOdds.valueDraw > 0 ? 'text-primary' : 'text-destructive'}`}>
                      {marketOdds.valueDraw > 0 ? '+' : ''}{marketOdds.valueDraw.toFixed(1)}%
                    </div>
                  </div>
                  <div className={`p-2 rounded border ${marketOdds.valueAway > 5 ? 'border-primary bg-primary/10' : 'border-border'}`}>
                    <div className="text-xs text-muted-foreground mb-1">Edge</div>
                    <div className={`font-mono font-bold ${marketOdds.valueAway > 0 ? 'text-primary' : 'text-destructive'}`}>
                      {marketOdds.valueAway > 0 ? '+' : ''}{marketOdds.valueAway.toFixed(1)}%
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Form Factor */}
          <Card>
            <CardHeader>
              <CardTitle>Form Factor</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex justify-between items-center mb-4">
                <div className="flex gap-1">
                  {formFactor.homeLast5.map((f, i) => (
                    <Badge key={i} variant="outline" className={`w-6 h-6 p-0 flex items-center justify-center font-mono ${f === 'W' ? 'border-primary text-primary' : f === 'L' ? 'border-destructive text-destructive' : 'border-muted-foreground text-muted-foreground'}`}>
                      {f}
                    </Badge>
                  ))}
                </div>
                <div className="text-sm font-bold text-muted-foreground">LAST 5</div>
                <div className="flex gap-1">
                  {formFactor.awayLast5.map((f, i) => (
                    <Badge key={i} variant="outline" className={`w-6 h-6 p-0 flex items-center justify-center font-mono ${f === 'W' ? 'border-primary text-primary' : f === 'L' ? 'border-destructive text-destructive' : 'border-muted-foreground text-muted-foreground'}`}>
                      {f}
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="flex justify-between items-center pt-4 border-t border-border/50">
                <div className="text-2xl font-bold font-mono text-primary">{formFactor.homeFormScore.toFixed(1)}</div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground">Form Rating</div>
                <div className="text-2xl font-bold font-mono text-chart-2">{formFactor.awayFormScore.toFixed(1)}</div>
              </div>
            </CardContent>
          </Card>

          {/* Absences */}
          <Card>
            <CardHeader>
              <CardTitle>Absence Impact</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex justify-between mb-4">
                <div className="text-center">
                  <div className="text-xl font-bold text-destructive">{absenceImpact.homeImpact.toFixed(1)}</div>
                  <div className="text-xs text-muted-foreground">Home Impact</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-destructive">{absenceImpact.awayImpact.toFixed(1)}</div>
                  <div className="text-xs text-muted-foreground">Away Impact</div>
                </div>
              </div>
              <div className="space-y-4 text-sm">
                {absenceImpact.homeMissing.length > 0 && (
                  <div>
                    <div className="font-bold mb-1 text-xs text-muted-foreground">{base.homeTeam.shortName} Missing:</div>
                    {absenceImpact.homeMissing.map(m => (
                      <div key={m.id} className="flex justify-between items-center py-1">
                        <span>{m.playerName}</span>
                        <Badge variant="outline" className={m.severity === 'major' ? 'border-destructive text-destructive' : ''}>{m.severity}</Badge>
                      </div>
                    ))}
                  </div>
                )}
                {absenceImpact.awayMissing.length > 0 && (
                  <div>
                    <div className="font-bold mb-1 text-xs text-muted-foreground mt-3">{base.awayTeam.shortName} Missing:</div>
                    {absenceImpact.awayMissing.map(m => (
                      <div key={m.id} className="flex justify-between items-center py-1">
                        <span>{m.playerName}</span>
                        <Badge variant="outline" className={m.severity === 'major' ? 'border-destructive text-destructive' : ''}>{m.severity}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
