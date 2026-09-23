import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ShieldAlert, Trash2, RotateCcw, LogOut, Mail, ChevronDown, ChevronRight } from "lucide-react";
import apiSuperAdmin, { formatApiError } from "@/lib/apiSuperAdmin";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

function DeleteButton({ onConfirm, label }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <button className="rounded-lg p-1.5 text-muted-foreground hover:text-destructive" aria-label={label}>
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove this account?</AlertDialogTitle>
          <AlertDialogDescription>This can't be undone. Their login will stop working immediately.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Remove</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function TeamRosterRow({ team, onChanged }) {
  const [open, setOpen] = useState(false);
  const [players, setPlayers] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await apiSuperAdmin.get(`/superadmin/teams/${team.id}/roster`);
      setPlayers(res.data.players);
    } catch (err) {
      toast.error(formatApiError(err?.response?.data?.detail));
    }
  }, [team.id]);

  const toggle = () => {
    setOpen((o) => !o);
    if (!players) load();
  };

  const unclaim = async (playerId) => {
    try {
      await apiSuperAdmin.post(`/superadmin/team-players/${playerId}/unclaim`);
      toast.success("Reset — they can rejoin with the team code.");
      load();
      onChanged?.();
    } catch (err) {
      toast.error(formatApiError(err?.response?.data?.detail));
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card">
      <button onClick={toggle} className="flex w-full items-center justify-between px-4 py-3 text-left" data-testid={`sa-team-${team.team_name}`}>
        <div>
          <p className="text-sm font-bold">{team.team_name}</p>
          <p className="text-xs text-muted-foreground">{team.rosterCount} players</p>
        </div>
        {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
      </button>
      {open && (
        <div className="space-y-1.5 border-t border-border p-3">
          {players === null && <p className="py-2 text-center text-xs text-muted-foreground">Loading…</p>}
          {players?.map((p) => (
            <div key={p.id} className="flex items-center justify-between rounded-lg bg-background px-3 py-2">
              <div>
                <p className="text-sm font-medium">{p.name}</p>
                <p className="text-xs text-muted-foreground">{p.joined ? "Joined" : "Not joined"}{p.contact ? ` · ${p.contact}` : ""}</p>
              </div>
              {p.joined && (
                <button onClick={() => unclaim(p.id)} className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground" title="Reset claim" aria-label={`Reset ${p.name}`}>
                  <RotateCcw className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
          {players?.length === 0 && <p className="py-2 text-center text-xs text-muted-foreground">No players yet.</p>}
        </div>
      )}
    </div>
  );
}

export default function SuperAdminPanel() {
  const navigate = useNavigate();
  const [athletes, setAthletes] = useState(null);
  const [admins, setAdmins] = useState(null);
  const [teams, setTeams] = useState(null);
  const [emailTeamId, setEmailTeamId] = useState("");
  const [emailTo, setEmailTo] = useState("");
  const [sendingEmail, setSendingEmail] = useState(false);

  const loadAll = useCallback(async () => {
    try {
      const [a, ad, t] = await Promise.all([
        apiSuperAdmin.get("/superadmin/athletes"),
        apiSuperAdmin.get("/superadmin/admins"),
        apiSuperAdmin.get("/superadmin/teams"),
      ]);
      setAthletes(a.data.athletes);
      setAdmins(ad.data.admins);
      setTeams(t.data.teams);
    } catch (err) {
      if (err?.response?.status === 401) {
        localStorage.removeItem("sa_token");
        navigate("/superadmin/login", { replace: true });
        return;
      }
      toast.error(formatApiError(err?.response?.data?.detail));
    }
  }, [navigate]);

  useEffect(() => {
    if (!localStorage.getItem("sa_token")) {
      navigate("/superadmin/login", { replace: true });
      return;
    }
    loadAll();
  }, [loadAll, navigate]);

  const deleteAthlete = async (id) => {
    try {
      await apiSuperAdmin.delete(`/superadmin/athletes/${id}`);
      setAthletes((rows) => rows.filter((r) => r.id !== id));
      toast.success("Athlete account removed");
    } catch (err) {
      toast.error(formatApiError(err?.response?.data?.detail));
    }
  };

  const deleteAdmin = async (id) => {
    try {
      await apiSuperAdmin.delete(`/superadmin/admins/${id}`);
      setAdmins((rows) => rows.filter((r) => r.id !== id));
      toast.success("Admin account removed");
    } catch (err) {
      toast.error(formatApiError(err?.response?.data?.detail));
    }
  };

  const sendSummary = async () => {
    if (!emailTeamId || !emailTo.trim()) return toast.error("Pick a team and enter an email");
    setSendingEmail(true);
    try {
      const res = await apiSuperAdmin.post("/superadmin/email-team-summary", { team_id: emailTeamId, to_email: emailTo.trim() });
      toast.success(res.data.message);
    } catch (err) {
      toast.error(formatApiError(err?.response?.data?.detail));
    } finally {
      setSendingEmail(false);
    }
  };

  const loading = athletes === null || admins === null || teams === null;

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-5 pt-5 sm:px-8">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-sm font-medium text-muted-foreground">
          <ShieldAlert className="h-4 w-4" /> Site admin
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button variant="ghost" size="icon" onClick={() => { localStorage.removeItem("sa_token"); navigate("/"); }} data-testid="superadmin-logout">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-5 py-8 sm:px-8">
        <h1 className="display mb-6 text-3xl font-extrabold tracking-tight">Accounts</h1>

        {loading ? (
          <div className="grid place-items-center py-10">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : (
          <Tabs defaultValue="athletes">
            <TabsList className="mb-5 grid w-full grid-cols-3">
              <TabsTrigger value="athletes" data-testid="sa-tab-athletes">Athletes</TabsTrigger>
              <TabsTrigger value="admins" data-testid="sa-tab-admins">Coaches</TabsTrigger>
              <TabsTrigger value="teams" data-testid="sa-tab-teams">Teams</TabsTrigger>
            </TabsList>

            <TabsContent value="athletes">
              <div className="space-y-2">
                {athletes.map((a) => (
                  <div key={a.id} className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3">
                    <div>
                      <p className="text-sm font-semibold">{a.name}</p>
                      <p className="text-xs text-muted-foreground">{a.email}</p>
                    </div>
                    <DeleteButton label={`Remove ${a.name}`} onConfirm={() => deleteAthlete(a.id)} />
                  </div>
                ))}
                {athletes.length === 0 && <p className="text-center text-sm text-muted-foreground">No individual athlete accounts yet.</p>}
              </div>
            </TabsContent>

            <TabsContent value="admins">
              <div className="space-y-2">
                {admins.map((a) => (
                  <div key={a.id} className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3">
                    <div>
                      <p className="text-sm font-semibold">{a.email}</p>
                      <p className="text-xs text-muted-foreground">{a.teamNames?.length ? a.teamNames.join(", ") : "No team linked"}</p>
                    </div>
                    <DeleteButton label={`Remove ${a.email}`} onConfirm={() => deleteAdmin(a.id)} />
                  </div>
                ))}
                {admins.length === 0 && <p className="text-center text-sm text-muted-foreground">No coach/admin accounts yet.</p>}
              </div>
            </TabsContent>

            <TabsContent value="teams">
              <div className="mb-6 space-y-2">
                {teams.map((t) => <TeamRosterRow key={t.id} team={t} onChanged={loadAll} />)}
                {teams.length === 0 && <p className="text-center text-sm text-muted-foreground">No teams yet.</p>}
              </div>

              <div className="rounded-2xl border border-border bg-card p-4">
                <p className="mb-3 flex items-center gap-1.5 text-sm font-bold"><Mail className="h-4 w-4" /> Email a team's summary</p>
                <p className="mb-3 text-xs text-muted-foreground">
                  Sent from the platform's configured address — still subject to your Resend sending-domain
                  setup, same as every other email in the app.
                </p>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <select
                    value={emailTeamId}
                    onChange={(e) => setEmailTeamId(e.target.value)}
                    className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm"
                    data-testid="sa-email-team-select"
                  >
                    <option value="">Select team…</option>
                    {teams.map((t) => <option key={t.id} value={t.id}>{t.team_name}</option>)}
                  </select>
                  <Input value={emailTo} onChange={(e) => setEmailTo(e.target.value)} placeholder="recipient@example.com" className="flex-1" data-testid="sa-email-to" />
                  <Button onClick={sendSummary} disabled={sendingEmail} data-testid="sa-email-send">
                    {sendingEmail ? "Sending…" : "Send"}
                  </Button>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
}
