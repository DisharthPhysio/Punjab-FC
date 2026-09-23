import { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Copy, Users, KeyRound, ShieldCheck, ChevronRight, Gauge, AlertCircle } from "lucide-react";
import apiV2, { formatApiError } from "@/lib/apiV2";
import { usePlatformAuth } from "@/context/PlatformAuthContext";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { RiskBadge } from "@/components/platform/RiskBadge";
import { ExitConfirmButton } from "@/components/platform/ExitConfirmButton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

function CodeCard({ icon: Icon, label, code, hint }) {
  const copy = () => {
    navigator.clipboard.writeText(code);
    toast.success(`${label} copied`);
  };
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-1.5 flex items-center gap-2 text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        <span className="text-xs font-bold uppercase tracking-wide">{label}</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="font-mono text-2xl font-extrabold tracking-[0.25em]">{code}</span>
        <button onClick={copy} className="rounded-lg border border-border p-1.5 text-muted-foreground hover:text-foreground" aria-label={`Copy ${label}`}>
          <Copy className="h-3.5 w-3.5" />
        </button>
      </div>
      <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

function PlayerCard({ p, onOpen }) {
  return (
    <button
      onClick={() => onOpen(p.id)}
      data-testid={`player-card-${p.name}`}
      className="group flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 text-left transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md"
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="font-bold leading-tight">{p.name}</p>
          {p.joined && p.checkedInToday === false && (
            <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
              <AlertCircle className="h-3 w-3" /> Not checked in today
            </p>
          )}
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
      </div>
      <RiskBadge level={p.riskLevel} />
      {p.joined && (
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span>Week load <b className="font-mono text-foreground">{p.weekLoad ?? "—"}</b></span>
          {p.readinessToday != null && (
            <span className="inline-flex items-center gap-1"><Gauge className="h-3 w-3" />{p.readinessToday}/100</span>
          )}
        </div>
      )}
    </button>
  );
}

function RankingRow({ p, rank, onOpen }) {
  return (
    <button
      onClick={() => onOpen(p.id)}
      data-testid={`ranking-row-${p.name}`}
      className="flex w-full items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-left transition-colors hover:border-primary/50"
    >
      <span className="w-5 shrink-0 font-mono text-sm font-bold text-muted-foreground">{rank}</span>
      <div className="flex-1">
        <p className="text-sm font-semibold">{p.name}</p>
        <p className="text-xs text-muted-foreground">Risk score {p.riskScore}</p>
      </div>
      <RiskBadge level={p.riskLevel} />
    </button>
  );
}

export default function TeamHome() {
  const navigate = useNavigate();
  const { user } = usePlatformAuth();
  const [codes, setCodes] = useState(null);
  const [dash, setDash] = useState(null);

  const load = useCallback(async () => {
    try {
      const [codesRes, dashRes] = await Promise.all([apiV2.get("/team/codes"), apiV2.get("/team/dashboard")]);
      setCodes(codesRes.data);
      setDash(dashRes.data);
    } catch (err) {
      toast.error(formatApiError(err?.response?.data?.detail));
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openPlayer = (id) => navigate(`/team/player/${id}`);

  const ranked = useMemo(() => {
    if (!dash) return [];
    const joined = dash.players.filter((p) => p.joined);
    return [...joined].sort((a, b) => (b.riskScore ?? 0) - (a.riskScore ?? 0));
  }, [dash]);
  const notJoined = dash?.players.filter((p) => !p.joined) || [];

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-5 pt-5 sm:px-8">
        <ExitConfirmButton />
        <div className="flex items-center gap-3">
          <span className="hidden text-sm font-semibold text-muted-foreground sm:inline">{user?.email}</span>
          <ThemeToggle />
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-5 py-8 sm:px-8">
        <h1 className="display mb-1 text-3xl font-extrabold tracking-tight">{dash?.team_name || codes?.team_name || "Your team"}</h1>
        {dash && (
          <p className="mb-6 text-sm text-muted-foreground">
            {dash.summary.checkedIn}/{dash.summary.total} checked in today
            {dash.summary.flagged > 0 && <span className="ml-2 font-semibold text-rose-500">· {dash.summary.flagged} need attention</span>}
          </p>
        )}

        {codes && (
          <div className="mb-6 grid gap-3 sm:grid-cols-2">
            <CodeCard icon={Users} label="Athlete code" code={codes.athlete_code} hint="Share with players to join & check in." />
            <CodeCard icon={KeyRound} label="Admin code" code={codes.admin_code} hint="Share with staff who need dashboard access." />
          </div>
        )}

        <div className="mb-6 flex flex-wrap gap-3">
          <Button variant="outline" onClick={() => navigate("/team/roster-setup")} className="gap-1.5" data-testid="manage-roster-link">
            <Users className="h-4 w-4" /> Manage roster
          </Button>
          <Button variant="outline" onClick={() => navigate("/team/link-code")} className="gap-1.5" data-testid="link-another-team">
            <ShieldCheck className="h-4 w-4" /> Access another team
          </Button>
        </div>

        {!dash ? (
          <div className="grid place-items-center py-10">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : (
          <Tabs defaultValue="players">
            <TabsList className="mb-5 grid w-full grid-cols-2">
              <TabsTrigger value="players" data-testid="cc-tab-players">Players</TabsTrigger>
              <TabsTrigger value="ranking" data-testid="cc-tab-ranking">Risk ranking</TabsTrigger>
            </TabsList>

            <TabsContent value="players">
              <div className="grid gap-3 sm:grid-cols-2">
                {dash.players.map((p) => <PlayerCard key={p.id} p={p} onOpen={openPlayer} />)}
                {dash.players.length === 0 && (
                  <p className="col-span-2 rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                    No players yet — add your roster to get started.
                  </p>
                )}
              </div>
            </TabsContent>

            <TabsContent value="ranking">
              <div className="space-y-2">
                {ranked.map((p, i) => <RankingRow key={p.id} p={p} rank={i + 1} onOpen={openPlayer} />)}
                {ranked.length === 0 && (
                  <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                    Ranking appears once players have joined and checked in.
                  </p>
                )}
                {notJoined.length > 0 && (
                  <p className="pt-2 text-center text-xs text-muted-foreground">
                    {notJoined.length} player{notJoined.length > 1 ? "s" : ""} not yet joined — not ranked.
                  </p>
                )}
              </div>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
}
