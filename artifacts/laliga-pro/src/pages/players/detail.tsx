import { useParams } from "wouter";
import { useGetPlayer } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip } from "recharts";

export default function PlayerDetail() {
  const params = useParams();
  const id = parseInt(params.id || "0");
  const { data, isLoading } = useGetPlayer(id, { query: { enabled: !!id, queryKey: ['/api/players/', id] } });

  if (isLoading) return <div className="space-y-4"><Skeleton className="h-48" /><Skeleton className="h-96" /></div>;
  if (!data) return <div>Player not found</div>;

  const { player, radar, recentForm } = data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="bg-card">
        <CardContent className="p-8">
          <div className="flex flex-col md:flex-row items-center gap-8">
            <div className="w-24 h-24 rounded-full bg-primary/10 border-2 border-primary flex items-center justify-center text-3xl font-black text-primary">
              {player.shirtNumber}
            </div>
            
            <div className="flex-1 text-center md:text-left space-y-2">
              <h1 className="text-3xl font-bold">{player.name}</h1>
              <div className="text-muted-foreground flex items-center justify-center md:justify-start gap-4 text-sm">
                <span>{player.teamShortName}</span>
                <span className="w-1 h-1 rounded-full bg-border"></span>
                <span>{player.position}</span>
                <span className="w-1 h-1 rounded-full bg-border"></span>
                <span>{player.nationality}</span>
                <span className="w-1 h-1 rounded-full bg-border"></span>
                <span>{player.age} yrs</span>
              </div>
            </div>

            <div className="flex gap-6 text-center">
              <div>
                <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Rating</div>
                <div className="text-3xl font-bold text-primary font-mono">{player.rating.toFixed(2)}</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Season Metrics Profile</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radar}>
                  <PolarGrid stroke="hsl(var(--border))" />
                  <PolarAngleAxis dataKey="metric" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                  <Radar name={player.name} dataKey="value" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.4} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 text-center">
              <div className="bg-muted p-3 rounded-lg border border-border/50">
                <div className="text-xs text-muted-foreground mb-1">Goals</div>
                <div className="text-xl font-bold font-mono">{player.goals}</div>
              </div>
              <div className="bg-muted p-3 rounded-lg border border-border/50">
                <div className="text-xs text-muted-foreground mb-1">Assists</div>
                <div className="text-xl font-bold font-mono">{player.assists}</div>
              </div>
              <div className="bg-muted p-3 rounded-lg border border-border/50">
                <div className="text-xs text-muted-foreground mb-1">xG</div>
                <div className="text-xl font-bold font-mono">{player.xG.toFixed(2)}</div>
              </div>
              <div className="bg-muted p-3 rounded-lg border border-border/50">
                <div className="text-xs text-muted-foreground mb-1">Key Passes</div>
                <div className="text-xl font-bold font-mono">{player.keyPasses}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Form (Rating)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={recentForm} margin={{ top: 20, right: 20, left: -20, bottom: 20 }}>
                  <XAxis dataKey="matchLabel" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} angle={-45} textAnchor="end" />
                  <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} domain={[5, 10]} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))' }}
                    labelStyle={{ color: 'hsl(var(--muted-foreground))' }}
                    formatter={(value: number) => [value.toFixed(2), 'Rating']}
                  />
                  <Line type="monotone" dataKey="rating" stroke="hsl(var(--primary))" strokeWidth={3} dot={{ r: 5, fill: "hsl(var(--primary))" }} activeDot={{ r: 7 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            
            <div className="mt-6 space-y-2">
              <h4 className="text-sm font-bold text-muted-foreground mb-2">Last 5 Matches Overview</h4>
              {recentForm.slice(-5).reverse().map((form, i) => (
                <div key={i} className="flex justify-between items-center text-sm py-2 border-b border-border/50 last:border-0">
                  <span className="font-medium w-1/3">{form.matchLabel}</span>
                  <div className="flex gap-4 w-1/3 justify-center text-xs text-muted-foreground">
                    {form.goals > 0 && <span className="text-primary font-bold">{form.goals}G</span>}
                    {form.assists > 0 && <span className="text-chart-2 font-bold">{form.assists}A</span>}
                    {form.goals === 0 && form.assists === 0 && <span>-</span>}
                  </div>
                  <span className="font-mono font-bold w-1/3 text-right">{form.rating.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
