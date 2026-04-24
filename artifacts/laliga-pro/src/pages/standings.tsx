import { useGetStandings } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export default function Standings() {
  const { data: standings, isLoading } = useGetStandings();

  if (isLoading) return <div className="space-y-4"><Skeleton className="h-16" /><Skeleton className="h-96" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold tracking-tight">League Standings</h1>
      </div>

      <Card>
        <CardContent className="p-0">
          <Tabs defaultValue="overall" className="w-full">
            <div className="p-4 border-b border-border/50">
              <TabsList>
                <TabsTrigger value="overall">Overall</TabsTrigger>
                <TabsTrigger value="home">Home</TabsTrigger>
                <TabsTrigger value="away">Away</TabsTrigger>
                <TabsTrigger value="advanced">Advanced Metrics</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="overall" className="m-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12 text-center">#</TableHead>
                    <TableHead>Club</TableHead>
                    <TableHead className="text-center">MP</TableHead>
                    <TableHead className="text-center">W</TableHead>
                    <TableHead className="text-center">D</TableHead>
                    <TableHead className="text-center">L</TableHead>
                    <TableHead className="text-center">GF</TableHead>
                    <TableHead className="text-center">GA</TableHead>
                    <TableHead className="text-center">GD</TableHead>
                    <TableHead className="text-center font-bold">Pts</TableHead>
                    <TableHead className="text-center">Form</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {standings?.map((row) => (
                    <TableRow key={row.teamId} className="cursor-pointer hover:bg-muted/50 group transition-colors">
                      <TableCell className="text-center font-mono">
                        {row.position}
                      </TableCell>
                      <TableCell>
                        <Link href={`/teams/${row.teamId}`} className="flex items-center gap-3">
                          <img src={row.crestUrl} alt={row.teamName} className="w-6 h-6 object-contain" />
                          <span className="font-medium group-hover:text-primary transition-colors">{row.teamName}</span>
                        </Link>
                      </TableCell>
                      <TableCell className="text-center text-muted-foreground">{row.played}</TableCell>
                      <TableCell className="text-center">{row.wins}</TableCell>
                      <TableCell className="text-center">{row.draws}</TableCell>
                      <TableCell className="text-center">{row.losses}</TableCell>
                      <TableCell className="text-center">{row.goalsFor}</TableCell>
                      <TableCell className="text-center">{row.goalsAgainst}</TableCell>
                      <TableCell className="text-center font-mono">{row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference}</TableCell>
                      <TableCell className="text-center font-bold text-primary text-base">{row.points}</TableCell>
                      <TableCell>
                        <div className="flex gap-1 justify-center">
                          {row.form.map((f, i) => (
                            <Badge key={i} variant="outline" className={`w-5 h-5 p-0 flex items-center justify-center font-mono text-[10px] ${f === 'W' ? 'border-primary text-primary' : f === 'L' ? 'border-destructive text-destructive' : 'border-muted-foreground text-muted-foreground'}`}>
                              {f}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TabsContent>
            
            <TabsContent value="home" className="m-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12 text-center">#</TableHead>
                    <TableHead>Club</TableHead>
                    <TableHead className="text-center">W</TableHead>
                    <TableHead className="text-center">D</TableHead>
                    <TableHead className="text-center">L</TableHead>
                    <TableHead className="text-center">GF</TableHead>
                    <TableHead className="text-center">GA</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {standings?.map((row) => (
                    <TableRow key={row.teamId}>
                      <TableCell className="text-center font-mono">{row.position}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <img src={row.crestUrl} alt={row.teamName} className="w-6 h-6 object-contain" />
                          <span className="font-medium">{row.teamName}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">{row.homeWins}</TableCell>
                      <TableCell className="text-center">{row.homeDraws}</TableCell>
                      <TableCell className="text-center">{row.homeLosses}</TableCell>
                      <TableCell className="text-center">{row.homeGoalsFor}</TableCell>
                      <TableCell className="text-center">{row.homeGoalsAgainst}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TabsContent>
            
            <TabsContent value="away" className="m-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12 text-center">#</TableHead>
                    <TableHead>Club</TableHead>
                    <TableHead className="text-center">W</TableHead>
                    <TableHead className="text-center">D</TableHead>
                    <TableHead className="text-center">L</TableHead>
                    <TableHead className="text-center">GF</TableHead>
                    <TableHead className="text-center">GA</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {standings?.map((row) => (
                    <TableRow key={row.teamId}>
                      <TableCell className="text-center font-mono">{row.position}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <img src={row.crestUrl} alt={row.teamName} className="w-6 h-6 object-contain" />
                          <span className="font-medium">{row.teamName}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">{row.awayWins}</TableCell>
                      <TableCell className="text-center">{row.awayDraws}</TableCell>
                      <TableCell className="text-center">{row.awayLosses}</TableCell>
                      <TableCell className="text-center">{row.awayGoalsFor}</TableCell>
                      <TableCell className="text-center">{row.awayGoalsAgainst}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TabsContent>

            <TabsContent value="advanced" className="m-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12 text-center">#</TableHead>
                    <TableHead>Club</TableHead>
                    <TableHead className="text-center">Pts</TableHead>
                    <TableHead className="text-center">xG</TableHead>
                    <TableHead className="text-center">xGA</TableHead>
                    <TableHead className="text-center">xG Diff</TableHead>
                    <TableHead className="text-center">Clean Sheets</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {standings?.map((row) => {
                    const xgDiff = row.xG - row.xGA;
                    return (
                      <TableRow key={row.teamId}>
                        <TableCell className="text-center font-mono">{row.position}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <img src={row.crestUrl} alt={row.teamName} className="w-6 h-6 object-contain" />
                            <span className="font-medium">{row.teamName}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center font-bold text-primary">{row.points}</TableCell>
                        <TableCell className="text-center font-mono">{row.xG.toFixed(2)}</TableCell>
                        <TableCell className="text-center font-mono">{row.xGA.toFixed(2)}</TableCell>
                        <TableCell className={`text-center font-mono ${xgDiff > 0 ? 'text-primary' : 'text-destructive'}`}>
                          {xgDiff > 0 ? '+' : ''}{xgDiff.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-center">{row.cleanSheets}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
