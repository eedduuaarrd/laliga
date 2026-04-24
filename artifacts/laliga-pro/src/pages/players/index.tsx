import { useState } from "react";
import { useListPlayers } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function Players() {
  const [position, setPosition] = useState<string>("all");
  const { data: players, isLoading } = useListPlayers({ position: position === "all" ? undefined : position });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold tracking-tight">Players Database</h1>
        <Select value={position} onValueChange={setPosition}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Position" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Positions</SelectItem>
            <SelectItem value="FWD">Forwards</SelectItem>
            <SelectItem value="MID">Midfielders</SelectItem>
            <SelectItem value="DEF">Defenders</SelectItem>
            <SelectItem value="GK">Goalkeepers</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-4">
              {[...Array(10)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Player</TableHead>
                  <TableHead className="text-center">Pos</TableHead>
                  <TableHead className="text-center">Team</TableHead>
                  <TableHead className="text-center">Apps</TableHead>
                  <TableHead className="text-center">Goals</TableHead>
                  <TableHead className="text-center">Assists</TableHead>
                  <TableHead className="text-center">xG</TableHead>
                  <TableHead className="text-center font-bold">Rating</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {players?.map((player) => (
                  <TableRow key={player.id} className="hover:bg-muted/50 cursor-pointer transition-colors group">
                    <TableCell>
                      <Link href={`/players/${player.id}`} className="font-medium group-hover:text-primary transition-colors block py-1">
                        {player.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-center text-muted-foreground text-xs">{player.position}</TableCell>
                    <TableCell className="text-center">
                      <Link href={`/teams/${player.teamId}`} className="text-sm hover:underline hover:text-primary">
                        {player.teamShortName}
                      </Link>
                    </TableCell>
                    <TableCell className="text-center text-muted-foreground">{player.appearances}</TableCell>
                    <TableCell className="text-center font-mono">{player.goals}</TableCell>
                    <TableCell className="text-center font-mono">{player.assists}</TableCell>
                    <TableCell className="text-center font-mono text-muted-foreground">{player.xG.toFixed(2)}</TableCell>
                    <TableCell className="text-center font-bold text-primary">{player.rating.toFixed(2)}</TableCell>
                  </TableRow>
                ))}
                {players?.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No players found.</TableCell>
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
