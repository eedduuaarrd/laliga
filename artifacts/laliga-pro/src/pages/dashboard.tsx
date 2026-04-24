import { useGetDashboardSummary, useListValueBets, useListPredictions } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";

export default function Dashboard() {
  const { data: summary, isLoading: loadingSummary } = useGetDashboardSummary();
  const { data: valueBets, isLoading: loadingBets } = useListValueBets();
  const { data: predictions, isLoading: loadingPredictions } = useListPredictions();

  if (loadingSummary) {
    return <div className="space-y-4"><Skeleton className="h-32 w-full" /><Skeleton className="h-64 w-full" /></div>;
  }

  if (!summary) return null;

  return (
    <div className="space-y-6">
      {/* Live data banner */}
      <div className="flex items-center gap-3 text-xs px-3 py-2 rounded border border-primary/30 bg-primary/5">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
        </span>
        <span className="font-medium">Live data from ESPN public APIs.</span>
        <span className="text-muted-foreground">Match probabilities blend real bookmaker odds (DraftKings) with a Poisson model on team xG. Player props derived from real season totals.</span>
      </div>

      {/* Counters Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex flex-col items-center justify-center text-center">
            <div className="text-sm text-muted-foreground uppercase tracking-wider">Current Gameweek</div>
            <div className="text-3xl font-bold text-primary">{summary.currentGameweek}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex flex-col items-center justify-center text-center">
            <div className="text-sm text-muted-foreground uppercase tracking-wider">Live Matches</div>
            <div className="text-3xl font-bold text-red-500">{summary.liveMatches}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex flex-col items-center justify-center text-center">
            <div className="text-sm text-muted-foreground uppercase tracking-wider">Today's Matches</div>
            <div className="text-3xl font-bold">{summary.todaysMatches}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex flex-col items-center justify-center text-center">
            <div className="text-sm text-muted-foreground uppercase tracking-wider">League Leader</div>
            <div className="text-xl font-bold truncate w-full">{summary.leader.teamShortName}</div>
            <div className="text-sm text-muted-foreground">{summary.leader.points} pts</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Model Accuracy */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Model Accuracy Tracking</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-8 mb-6">
              <div>
                <div className="text-sm text-muted-foreground">Accuracy</div>
                <div className="text-2xl font-bold text-primary">{summary.modelAccuracy.accuracyPct}%</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Predictions</div>
                <div className="text-2xl font-bold">{summary.modelAccuracy.correctPredictions} / {summary.modelAccuracy.totalPredictions}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">ROI</div>
                <div className="text-2xl font-bold text-chart-2">+{summary.modelAccuracy.roi}%</div>
              </div>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={summary.weeklyAccuracy}>
                  <XAxis dataKey="gameweek" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} domain={['dataMin - 5', 'dataMax + 5']} />
                  <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))' }} />
                  <Line type="monotone" dataKey="accuracyPct" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4, fill: "hsl(var(--primary))" }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          {/* Top Players */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground uppercase">Top Scorer</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold">{summary.topScorer.playerName}</div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">{summary.topScorer.teamShortName}</span>
                <span className="font-bold text-primary">{summary.topScorer.goals} G</span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground uppercase">Top Assister</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold">{summary.topAssister.playerName}</div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">{summary.topAssister.teamShortName}</span>
                <span className="font-bold text-chart-2">{summary.topAssister.assists} A</span>
              </div>
            </CardContent>
          </Card>

          {/* Quick Links */}
          <Link href="/briefing">
            <div className="bg-card border hover:border-primary transition-colors rounded-lg p-4 cursor-pointer">
              <div className="text-sm font-bold mb-1">Morning Briefing</div>
              <div className="text-xs text-muted-foreground">Read today's insights</div>
            </div>
          </Link>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle>Top Value Bets</CardTitle>
            <Link href="/value-bets" className="text-sm text-primary hover:underline">View All</Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {loadingBets ? <Skeleton className="h-20" /> : valueBets?.slice(0, 3).map(bet => (
                <div key={`${bet.matchId}-${bet.market}`} className="flex justify-between items-center p-3 bg-muted/50 rounded-md border border-border/50">
                  <div>
                    <div className="text-sm font-bold">{bet.matchLabel}</div>
                    <div className="text-xs text-muted-foreground">{bet.market}</div>
                  </div>
                  <div className="text-right">
                    <Badge variant={bet.confidence === 'high' ? 'default' : 'secondary'}>{bet.edge}% Edge</Badge>
                    <div className="text-xs mt-1">Odds: {bet.marketOdds}</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle>Top Predictions</CardTitle>
            <Link href="/predictions" className="text-sm text-primary hover:underline">View All</Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {loadingPredictions ? <Skeleton className="h-20" /> : predictions?.slice(0, 3).map(pred => (
                <Link key={pred.matchId} href={`/predictions/${pred.matchId}`}>
                  <div className="flex justify-between items-center p-3 bg-muted/50 rounded-md border border-border/50 cursor-pointer hover:border-primary transition-colors">
                    <div>
                      <div className="text-sm font-bold flex gap-2">
                        <span>{pred.homeTeam.shortName}</span>
                        <span className="text-muted-foreground">v</span>
                        <span>{pred.awayTeam.shortName}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">{format(new Date(pred.kickoff), "MMM d, HH:mm")}</div>
                    </div>
                    <div className="text-right">
                      <Badge variant="outline">{pred.recommendation}</Badge>
                      <div className="text-xs mt-1 text-primary">Conf: {Math.round(pred.confidence * 100)}%</div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
