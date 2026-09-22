import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Copy, LogOut, Users, KeyRound, ShieldCheck, LayoutGrid, TrendingUp } from "lucide-react";
import apiV2, { formatApiError } from "@/lib/apiV2";
import { usePlatformAuth } from "@/context/PlatformAuthContext";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";

function CodeCard({ icon: Icon, label, code, hint }) {
  const copy = () => {
    navigator.clipboard.writeText(code);
    toast.success(`${label} copied`);
  };
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-2 flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4" />
        <span className="text-xs font-bold uppercase tracking-wide">{label}</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="font-mono text-3xl font-extrabold tracking-[0.3em]">{code}</span>
        <button onClick={copy} className="rounded-lg border border-border p-2 text-muted-foreground hover:text-foreground" aria-label={`Copy ${label}`}>
          <Copy className="h-4 w-4" />
        </button>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

export default function TeamHome() {
  const navigate = useNavigate();
  const { user, logout } = usePlatformAuth();
  const [codes, setCodes] = useState(null);
  const [players, setPlayers] = useState([]);

  const load = useCallback(async () => {
    try {
      const [codesRes, rosterRes] = await Promise.all([apiV2.get("/team/codes"), apiV2.get("/team/roster")]);
      setCodes(codesRes.data);
      setPlayers(rosterRes.data.players);
    } catch (err) {
      toast.error(formatApiError(err?.response?.data?.detail));
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const claimedCount = players.filter((p) => p.claimed_by_athlete_id).length;

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-5 pt-5 sm:px-8">
        <div className="text-sm font-semibold text-muted-foreground">{user?.email}</div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button variant="ghost" size="icon" onClick={() => { logout(); navigate("/"); }} data-testid="admin-logout">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-5 py-8 sm:px-8">
        <h1 className="display mb-1 text-3xl font-extrabold tracking-tight">{codes?.team_name || "Your team"}</h1>
        <p className="mb-6 text-sm text-muted-foreground">
          {claimedCount}/{players.length} players have joined with their code
        </p>

        {codes && (
          <div className="mb-8 grid gap-4 sm:grid-cols-2">
            <CodeCard icon={Users} label="Athlete code" code={codes.athlete_code} hint="Share with players to join the team and check in." />
            <CodeCard icon={KeyRound} label="Admin code" code={codes.admin_code} hint="Share with staff (e.g. physio) who need dashboard access." />
          </div>
        )}

        <div className="mb-8 flex flex-wrap gap-3">
          <Button variant="outline" onClick={() => navigate("/team/roster-setup")} className="gap-1.5" data-testid="manage-roster-link">
            <Users className="h-4 w-4" /> Manage roster
          </Button>
          <Button variant="outline" onClick={() => navigate("/team/link-code")} className="gap-1.5" data-testid="link-another-team">
            <ShieldCheck className="h-4 w-4" /> Access another team
          </Button>
        </div>

        <div className="rounded-2xl border border-dashed border-border bg-card/50 p-8 text-center">
          <div className="mx-auto mb-3 flex w-fit gap-3 text-muted-foreground">
            <LayoutGrid className="h-7 w-7" />
            <TrendingUp className="h-7 w-7" />
          </div>
          <p className="font-bold">The full command centre is next</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Player profile cards (tap for full detail), the risk-ranking system, sleep-quality correlation,
            and PDF export land in Phases 4–6, right after this auth foundation. For now, here's your roster:
          </p>
        </div>

        <div className="mt-6 space-y-2">
          {players.map((p) => (
            <div key={p.id} className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3">
              <div>
                <p className="text-sm font-semibold">{p.name}</p>
                {p.contact && <p className="text-xs text-muted-foreground">{p.contact}</p>}
              </div>
              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${p.claimed_by_athlete_id ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : "bg-secondary text-muted-foreground"}`}>
                {p.claimed_by_athlete_id ? "Joined" : "Not joined"}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
