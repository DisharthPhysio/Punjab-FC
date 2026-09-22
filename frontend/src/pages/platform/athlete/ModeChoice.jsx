import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ClipboardList, Users, LogOut, ChevronRight } from "lucide-react";
import { usePlatformAuth } from "@/context/PlatformAuthContext";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";

export default function ModeChoice() {
  const navigate = useNavigate();
  const { user, teams, logout } = usePlatformAuth();

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-5 pt-5 sm:px-8">
        <div className="text-sm font-semibold text-muted-foreground">Hi, {user?.name?.split(" ")[0] || "there"} 👋</div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button variant="ghost" size="icon" onClick={() => { logout(); navigate("/"); }} data-testid="athlete-logout">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-5 py-10 sm:px-8">
        <h1 className="display mb-8 text-3xl font-extrabold tracking-tight">What would you like to do?</h1>

        <div className="grid gap-4 sm:grid-cols-2">
          <motion.button
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}
            onClick={() => navigate("/athlete/checkin")}
            data-testid="mode-individual"
            className="group flex flex-col items-start gap-4 rounded-2xl border border-border bg-card p-6 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md"
          >
            <div className="grid h-12 w-12 place-items-center rounded-xl bg-primary/10 text-primary">
              <ClipboardList className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold">Individual check-in</h3>
              <p className="mt-1 text-sm text-muted-foreground">Log today's wellness on your own — see your own history right below it.</p>
            </div>
            <div className="mt-auto flex items-center gap-1 text-sm font-semibold text-primary">
              Continue <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </div>
          </motion.button>

          <motion.button
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.06 }}
            onClick={() => navigate("/athlete/join-team")}
            data-testid="mode-team"
            className="group flex flex-col items-start gap-4 rounded-2xl border border-border bg-card p-6 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md"
          >
            <div className="grid h-12 w-12 place-items-center rounded-xl bg-primary/10 text-primary">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold">Team check-in</h3>
              <p className="mt-1 text-sm text-muted-foreground">Enter your team's secret code to check in as part of your squad.</p>
            </div>
            <div className="mt-auto flex items-center gap-1 text-sm font-semibold text-primary">
              Continue <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </div>
          </motion.button>
        </div>

        {teams?.length > 0 && (
          <div className="mt-8">
            <p className="mb-3 text-sm font-semibold text-muted-foreground">Your teams</p>
            <div className="flex flex-wrap gap-2">
              {teams.map((t) => (
                <button
                  key={t.id}
                  onClick={() => navigate(`/athlete/team/${t.team_id}`)}
                  className="rounded-full border border-border bg-card px-4 py-2 text-sm font-medium transition-colors hover:border-primary/50"
                >
                  {t.team_name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
