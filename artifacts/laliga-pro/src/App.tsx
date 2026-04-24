import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "@/components/layout";
import NotFound from "@/pages/not-found";

import Dashboard from "@/pages/dashboard";
import Matches from "@/pages/matches";
import MatchDetail from "@/pages/matches/detail";
import Predictions from "@/pages/predictions";
import PredictionDetail from "@/pages/predictions/detail";
import Standings from "@/pages/standings";
import Teams from "@/pages/teams";
import TeamDetail from "@/pages/teams/detail";
import Players from "@/pages/players";
import PlayerDetail from "@/pages/players/detail";
import ValueBets from "@/pages/value-bets";
import Injuries from "@/pages/injuries";
import Briefing from "@/pages/briefing";

const queryClient = new QueryClient();

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/matches" component={Matches} />
        <Route path="/matches/:id" component={MatchDetail} />
        <Route path="/predictions" component={Predictions} />
        <Route path="/predictions/:id" component={PredictionDetail} />
        <Route path="/standings" component={Standings} />
        <Route path="/teams" component={Teams} />
        <Route path="/teams/:id" component={TeamDetail} />
        <Route path="/players" component={Players} />
        <Route path="/players/:id" component={PlayerDetail} />
        <Route path="/value-bets" component={ValueBets} />
        <Route path="/injuries" component={Injuries} />
        <Route path="/briefing" component={Briefing} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
