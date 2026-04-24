import { useListInjuries } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Link } from "wouter";

export default function Injuries() {
  const { data: injuries, isLoading } = useListInjuries();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold tracking-tight">Injuries & Suspensions</h1>
      </div>
      
      <p className="text-muted-foreground text-sm">
        League-wide absence report factoring into predictive models.
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
                  <TableHead>Player</TableHead>
                  <TableHead>Team</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-center text-muted-foreground">Expected Return</TableHead>
                  <TableHead className="text-center font-bold">Impact Score</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {injuries?.map((injury) => (
                  <TableRow key={injury.id} className="hover:bg-muted/50 transition-colors">
                    <TableCell className="font-medium">
                      <Link href={`/players/${injury.playerId}`} className="hover:underline hover:text-primary">
                        {injury.playerName}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link href={`/teams/${injury.teamId}`} className="text-sm text-muted-foreground hover:underline hover:text-primary">
                        {injury.teamShortName}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={injury.type === 'suspension' ? 'border-yellow-500 text-yellow-500' : 'border-destructive text-destructive'}>
                        {injury.type.toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell>
                       <span className={`text-xs font-bold ${injury.severity === 'major' ? 'text-destructive' : injury.severity === 'moderate' ? 'text-orange-500' : 'text-muted-foreground'}`}>
                         {injury.severity.toUpperCase()}
                       </span>
                    </TableCell>
                    <TableCell className="text-sm">
                      {injury.description}
                    </TableCell>
                    <TableCell className="text-center text-sm text-muted-foreground font-mono">
                      {injury.expectedReturn}
                    </TableCell>
                    <TableCell className="text-center">
                       <span className="font-mono font-bold text-destructive text-lg bg-destructive/10 px-2 py-1 rounded">
                         {injury.impactScore.toFixed(1)}
                       </span>
                    </TableCell>
                  </TableRow>
                ))}
                {injuries?.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">No injuries reported.</TableCell>
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
