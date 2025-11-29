<<<<<<< HEAD
=======
import { Switch, Route } from "wouter";
>>>>>>> 9cb4134f265eef55780dc90b3f570550bf0e2451
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
<<<<<<< HEAD
import Home from "@/pages/Home";

=======
import NotFound from "@/pages/not-found";
import Home from "@/pages/Home";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route component={NotFound} />
    </Switch>
  );
}

>>>>>>> 9cb4134f265eef55780dc90b3f570550bf0e2451
function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
<<<<<<< HEAD
        <Home />
=======
        <Router />
>>>>>>> 9cb4134f265eef55780dc90b3f570550bf0e2451
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
