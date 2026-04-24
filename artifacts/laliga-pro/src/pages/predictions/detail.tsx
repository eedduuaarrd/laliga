import {
  useGetPrediction,
  useGetPlayerProps,
  useGetProbableLineups,
} from "@workspace/api-client-react";
import { useParams } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";

export default function PredictionDetail() {
  const params = useParams();
  const id = parseInt(params.id || "0");
  const { data, isLoading } = useGetPrediction(id, {
    query: { enabled: !!id, queryKey: ["/api/predictions/", id] },
  });
  const { data: lineups } = useGetProbableLineups(id, {
    query: { enabled: !!id, queryKey: ["/api/predictions/", id, "lineups"] },
  });
  const { data: props } = useGetPlayerProps(id, {
    query: { enabled: !!id, queryKey: ["/api/predictions/", id, "players"] },
  });

  if (isLoading)
    return (
      <div className="space-y-4">
        <Skeleton className="h-32" />
        <Skeleton className="h-96" />
      </div>
    );
  if (!data) return <div>Prediction not found</div>;

  const { base, scoreMatrix, topScorelines, formFactor, absenceImpact, marketOdds } = data;
  const maxProb = Math.max(...scoreMatrix.map((s) => s.probability));
  const sourceLabel =
    base.source === "bookmaker"
      ? `Bookmaker · ${base.bookmaker ?? "Market"}`
      : "Model · Poisson on team xG";

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="bg-card border-primary/20">
        <CardContent className="p-6">
          <div className="flex flex-wrap justify-between items-center gap-2 mb-6">
            <div className="text-sm text-muted-foreground">
              {format(new Date(base.kickoff), "MMM d, yyyy - HH:mm")}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded border border-primary/40 text-primary bg-primary/5">
                {sourceLabel}
              </span>
              {base.oddsLastUpdate && (
                <span className="text-[10px] text-muted-foreground">
                  Updated {format(new Date(base.oddsLastUpdate), "HH:mm")}
                </span>
              )}
              <Badge variant="outline" className="text-primary border-primary">
                {base.recommendation}
              </Badge>
            </div>
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
              <div className="font-mono text-lg">
                {base.expectedHomeGoals.toFixed(2)} - {base.expectedAwayGoals.toFixed(2)}
              </div>
            </div>

            <div className="flex flex-col items-center gap-4 w-1/3">
              <img src={base.awayTeam.crestUrl} alt={base.awayTeam.name} className="w-20 h-20 object-contain" />
              <h2 className="text-xl font-bold text-center">{base.awayTeam.shortName}</h2>
              <div className="text-2xl font-mono text-chart-2">{(base.awayWinProb * 100).toFixed(1)}%</div>
            </div>
          </div>

          {/* New Match Markets row */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-6 pt-6 border-t border-border/50">
            <Stat label="BTTS" value={`${(base.bttsProb * 100).toFixed(0)}%`} />
            <Stat label="Over 2.5" value={`${(base.over25Prob * 100).toFixed(0)}%`} />
            <Stat label="Under 2.5" value={`${(base.under25Prob * 100).toFixed(0)}%`} />
            <Stat label={`CS ${base.homeTeam.abbreviation}`} value={`${(base.cleanSheetHome * 100).toFixed(0)}%`} />
            <Stat label={`CS ${base.awayTeam.abbreviation}`} value={`${(base.cleanSheetAway * 100).toFixed(0)}%`} />
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
                <div className="flex pl-8 mb-1">
                  <div className="w-8 shrink-0" />
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={`col-${i}`} className="w-12 text-center text-xs font-mono text-muted-foreground">{i}</div>
                  ))}
                </div>
                {Array.from({ length: 6 }).map((_, h) => (
                  <div key={`row-${h}`} className="flex pl-8 mb-1 items-center">
                    <div className="w-8 text-center text-xs font-mono shrink-0 text-muted-foreground">{h}</div>
                    {Array.from({ length: 6 }).map((_, a) => {
                      const cell = scoreMatrix.find((s) => s.homeGoals === h && s.awayGoals === a);
                      const prob = cell ? cell.probability : 0;
                      const intensity = prob / maxProb;
                      return (
                        <div
                          key={`cell-${h}-${a}`}
                          className="w-12 h-10 flex items-center justify-center text-[10px] font-mono border border-background/20"
                          style={{
                            backgroundColor: `hsl(var(--primary) / ${intensity * 0.8})`,
                            color: intensity > 0.5 ? "hsl(var(--primary-foreground))" : "hsl(var(--foreground))",
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
              <CardTitle className="flex items-center justify-between">
                Market Edge Analysis
                <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded border border-primary/40 text-primary bg-primary/5">
                  {base.bookmaker ?? "Bookmaker"}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-2 text-center text-xs font-bold text-muted-foreground mb-2">
                  <div>HOME</div>
                  <div>DRAW</div>
                  <div>AWAY</div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <OddsCell odds={marketOdds.homeOdds} />
                  <OddsCell odds={marketOdds.drawOdds} />
                  <OddsCell odds={marketOdds.awayOdds} />
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <EdgeCell value={marketOdds.valueHome} />
                  <EdgeCell value={marketOdds.valueDraw} />
                  <EdgeCell value={marketOdds.valueAway} />
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
                    <Badge key={i} variant="outline" className={`w-6 h-6 p-0 flex items-center justify-center font-mono ${f === "W" ? "border-primary text-primary" : f === "L" ? "border-destructive text-destructive" : "border-muted-foreground text-muted-foreground"}`}>
                      {f}
                    </Badge>
                  ))}
                </div>
                <div className="text-sm font-bold text-muted-foreground">LAST 5</div>
                <div className="flex gap-1">
                  {formFactor.awayLast5.map((f, i) => (
                    <Badge key={i} variant="outline" className={`w-6 h-6 p-0 flex items-center justify-center font-mono ${f === "W" ? "border-primary text-primary" : f === "L" ? "border-destructive text-destructive" : "border-muted-foreground text-muted-foreground"}`}>
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
                {absenceImpact.homeMissing.length === 0 && absenceImpact.awayMissing.length === 0 && (
                  <div className="text-xs text-muted-foreground">No injuries reported by ESPN.</div>
                )}
                {absenceImpact.homeMissing.length > 0 && (
                  <div>
                    <div className="font-bold mb-1 text-xs text-muted-foreground">{base.homeTeam.shortName} Missing:</div>
                    {absenceImpact.homeMissing.map((m) => (
                      <div key={m.id} className="flex justify-between items-center py-1">
                        <span>{m.playerName}</span>
                        <Badge variant="outline" className={m.severity === "high" ? "border-destructive text-destructive" : ""}>{m.severity}</Badge>
                      </div>
                    ))}
                  </div>
                )}
                {absenceImpact.awayMissing.length > 0 && (
                  <div>
                    <div className="font-bold mb-1 text-xs text-muted-foreground mt-3">{base.awayTeam.shortName} Missing:</div>
                    {absenceImpact.awayMissing.map((m) => (
                      <div key={m.id} className="flex justify-between items-center py-1">
                        <span>{m.playerName}</span>
                        <Badge variant="outline" className={m.severity === "high" ? "border-destructive text-destructive" : ""}>{m.severity}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Probable Lineups */}
      {lineups && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Probable Lineups
              <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded border border-primary/40 text-primary bg-primary/5">
                Predicted from ESPN roster
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-6">
              {(["home", "away"] as const).map((side) => {
                const lineup = lineups[side];
                const team = side === "home" ? base.homeTeam : base.awayTeam;
                return (
                  <div key={side}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <img src={team.crestUrl} alt={team.name} className="w-6 h-6 object-contain" />
                        <span className="font-bold">{team.shortName}</span>
                        <Badge variant="outline" className="font-mono text-xs">{lineup.formation}</Badge>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Confidence {(lineup.confidence * 100).toFixed(0)}%
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      {lineup.starting.map((p) => (
                        <div key={p.id} className="flex items-center justify-between text-sm py-1.5 px-2 rounded bg-muted/50">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-xs font-mono text-muted-foreground w-8 shrink-0">{p.positionLabel.slice(0, 3).toUpperCase()}</span>
                            <span className="truncate">{p.name}</span>
                          </div>
                          {p.shirtNumber !== null && p.shirtNumber !== undefined && (
                            <span className="text-xs font-mono text-muted-foreground">#{p.shirtNumber}</span>
                          )}
                        </div>
                      ))}
                    </div>
                    {lineup.bench.length > 0 && (
                      <div className="mt-3">
                        <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Bench</div>
                        <div className="flex flex-wrap gap-1">
                          {lineup.bench.map((p) => (
                            <span key={p.id} className="text-xs px-2 py-0.5 rounded border border-border/50 bg-background">{p.name}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Player Props (Anytime Scorer / Assist) */}
      {props && (
        <Card>
          <CardHeader>
            <CardTitle>Player Props · Anytime Scorer & Assist</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-6">
              {(["home", "away"] as const).map((side) => {
                const team = side === "home" ? base.homeTeam : base.awayTeam;
                const list = props[side].slice(0, 6);
                return (
                  <div key={side}>
                    <div className="flex items-center gap-2 mb-3">
                      <img src={team.crestUrl} alt={team.name} className="w-6 h-6 object-contain" />
                      <span className="font-bold">{team.shortName}</span>
                    </div>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-xs text-muted-foreground">
                          <th className="text-left pb-2 font-medium">Player</th>
                          <th className="text-right pb-2 font-medium">Goal %</th>
                          <th className="text-right pb-2 font-medium">Assist %</th>
                          <th className="text-right pb-2 font-medium">G+A %</th>
                        </tr>
                      </thead>
                      <tbody>
                        {list.map((p) => (
                          <tr key={p.playerId} className="border-t border-border/30">
                            <td className="py-1.5">
                              <div className="font-medium">{p.playerName}</div>
                              <div className="text-[10px] text-muted-foreground">
                                {p.seasonGoals}G {p.seasonAssists}A · {p.seasonAppearances} app
                              </div>
                            </td>
                            <td className="text-right font-mono">{(p.anytimeScorerProb * 100).toFixed(0)}%</td>
                            <td className="text-right font-mono">{(p.anytimeAssistProb * 100).toFixed(0)}%</td>
                            <td className="text-right font-mono text-primary">{(p.goalContributionProb * 100).toFixed(0)}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })}
            </div>
            <p className="text-[10px] text-muted-foreground mt-4">
              Probabilities derived from real season goals/assists per game (ESPN), scaled by predicted team xG. Not a bookmaker quote.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-muted/50 p-2 rounded text-center">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="font-mono font-bold text-lg">{value}</div>
    </div>
  );
}

function OddsCell({ odds }: { odds: number }) {
  return (
    <div className="bg-muted p-2 rounded">
      <div className="text-xs text-muted-foreground mb-1">Odds</div>
      <div className="font-mono">{odds.toFixed(2)}</div>
    </div>
  );
}

function EdgeCell({ value }: { value: number }) {
  return (
    <div className={`p-2 rounded border ${value > 5 ? "border-primary bg-primary/10" : "border-border"}`}>
      <div className="text-xs text-muted-foreground mb-1">Edge</div>
      <div className={`font-mono font-bold ${value > 0 ? "text-primary" : "text-destructive"}`}>
        {value > 0 ? "+" : ""}{value.toFixed(1)}%
      </div>
    </div>
  );
}
