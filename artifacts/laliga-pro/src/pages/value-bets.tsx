import { useListValueBets } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";

export default function ValueBets() {
  const { data: bets, isLoading } = useListValueBets();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold tracking-tight">Market Value Bets</h1>
        <Badge variant="outline" className="text-primary border-primary">Live Odds Feed</Badge>
      </div>
      
      <p className="text-muted-foreground text-sm">
        Discrepancies between the underlying predictive model and live market odds. High edge % indicates significant value.
      </p>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-4">
              {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Match</TableHead>
                  <TableHead>Kickoff</TableHead>
                  <TableHead>Market Pick</TableHead>
                  <TableHead className="text-center">Odds</TableHead>
                  <TableHead className="text-center text-muted-foreground">Implied %</TableHead>
                  <TableHead className="text-center text-muted-foreground">Model %</TableHead>
                  <TableHead className="text-center font-bold text-primary">Edge</TableHead>
                  <TableHead className="text-center">Confidence</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bets?.map((bet) => (
                  <TableRow key={`${bet.matchId}-${bet.market}`} className="hover:bg-muted/50 transition-colors">
                    <TableCell className="font-medium">
                      {bet.matchLabel}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(bet.kickoff), "MMM d, HH:mm")}
                    </TableCell>
                    <TableCell className="font-bold text-sm">
                      {bet.market}
                    </TableCell>
                    <TableCell className="text-center font-mono">
                      {bet.marketOdds.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-center font-mono text-muted-foreground">
                      {(bet.impliedProb * 100).toFixed(1)}%
                    </TableCell>
                    <TableCell className="text-center font-mono text-muted-foreground">
                      {(bet.modelProb * 100).toFixed(1)}%
                    </TableCell>
                    <TableCell className="text-center font-mono font-bold text-primary bg-primary/5">
                      +{bet.edge.toFixed(1)}%
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={bet.confidence === 'high' ? 'default' : bet.confidence === 'medium' ? 'secondary' : 'outline'}>
                        {bet.confidence.toUpperCase()}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {bets?.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">No value bets currently identified.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
