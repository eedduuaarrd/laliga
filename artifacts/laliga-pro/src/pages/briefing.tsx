import { useGetMorningBriefing } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { format } from "date-fns";

export default function Briefing() {
  const { data: briefing, isLoading } = useGetMorningBriefing();

  if (isLoading) return <div className="space-y-4"><Skeleton className="h-64" /><Skeleton className="h-64" /></div>;
  if (!briefing) return <div>Briefing not available</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      <div className="text-center space-y-4 pt-8 pb-4 border-b border-border/50">
        <div className="text-sm text-primary font-bold tracking-[0.2em] uppercase">Daily Intelligence Report</div>
        <h1 className="text-4xl md:text-5xl font-black tracking-tight leading-tight">{briefing.headline}</h1>
        <div className="text-muted-foreground font-mono text-sm">{format(new Date(briefing.date), "EEEE, MMMM d, yyyy")}</div>
      </div>

      <div className="text-lg leading-relaxed text-muted-foreground border-l-4 border-primary pl-6 py-2">
        {briefing.summary}
      </div>

      <div className="grid md:grid-cols-2 gap-8 pt-4">
        {/* Top Picks */}
        <div className="space-y-4">
          <h2 className="text-xl font-bold tracking-tight border-b pb-2 flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm bg-primary"></div>
            High-Confidence Plays
          </h2>
          {briefing.topPicks.map(pick => (
            <Card key={pick.matchId} className="bg-primary/5 border-primary/20 hover:border-primary/50 transition-colors">
              <CardContent className="p-4">
                <div className="flex justify-between items-start mb-2">
                  <div className="text-sm font-bold">{pick.homeTeam.shortName} vs {pick.awayTeam.shortName}</div>
                  <Badge>{Math.round(pick.confidence * 100)}% Conf</Badge>
                </div>
                <div className="text-sm text-primary font-medium mb-3">{pick.recommendation}</div>
                <Link href={`/predictions/${pick.matchId}`} className="text-xs text-muted-foreground hover:text-foreground underline">View full analysis →</Link>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Upset Watch */}
        <div className="space-y-4">
          <h2 className="text-xl font-bold tracking-tight border-b pb-2 flex items-center gap-2 text-destructive">
            <div className="w-3 h-3 rounded-sm bg-destructive"></div>
            Upset Alerts
          </h2>
          {briefing.upsetWatch.map(pick => (
            <Card key={pick.matchId} className="bg-destructive/5 border-destructive/20 hover:border-destructive/50 transition-colors">
              <CardContent className="p-4">
                <div className="flex justify-between items-start mb-2">
                  <div className="text-sm font-bold">{pick.homeTeam.shortName} vs {pick.awayTeam.shortName}</div>
                  <Badge variant="destructive">Alert</Badge>
                </div>
                <div className="text-sm text-destructive font-medium mb-3">{pick.recommendation}</div>
                <Link href={`/predictions/${pick.matchId}`} className="text-xs text-muted-foreground hover:text-foreground underline">Examine edge →</Link>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <div className="pt-8">
         <h2 className="text-2xl font-bold tracking-tight mb-6">Key Storylines</h2>
         <div className="grid gap-6">
           {briefing.keyStorylines.map((story, i) => (
             <Card key={i} className="bg-card">
               <CardHeader className="pb-2">
                 <CardTitle className="text-lg">{story.title}</CardTitle>
               </CardHeader>
               <CardContent>
                 <p className="text-muted-foreground text-sm leading-relaxed">{story.body}</p>
               </CardContent>
             </Card>
           ))}
         </div>
      </div>
    </div>
  );
}
