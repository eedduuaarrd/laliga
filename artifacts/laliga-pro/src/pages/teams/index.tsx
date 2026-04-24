import { useListTeams } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function Teams() {
  const { data: teams, isLoading } = useListTeams();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold tracking-tight">Teams</h1>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {[...Array(20)].map((_, i) => <Skeleton key={i} className="h-48" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {teams?.map(team => (
            <Link key={team.id} href={`/teams/${team.id}`}>
              <Card className="hover:border-primary transition-colors cursor-pointer bg-card/50 text-center h-full group">
                <CardContent className="p-6 flex flex-col items-center justify-center h-full gap-4">
                  <div className="w-16 h-16 rounded-full bg-background flex items-center justify-center border border-border group-hover:border-primary transition-colors">
                    <img src={team.crestUrl} alt={team.name} className="w-10 h-10 object-contain" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm leading-tight group-hover:text-primary transition-colors">{team.name}</h3>
                    <p className="text-xs text-muted-foreground mt-1">{team.stadium}</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
