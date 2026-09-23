import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { UserPlus, KeyRound, Trash2, Bell, BellOff, ShieldCheck } from "lucide-react";
import api, { formatApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";

export function TeamAccessDialog({ open, onOpenChange }) {
  const { user, logout } = useAuth();
  const [team, setTeam] = useState([]);
  const [loading, setLoading] = useState(false);

  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);

  const [curPw, setCurPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [changing, setChanging] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/team");
      setTeam(res.data);
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (open) load(); }, [open, load]);

  const addMember = async () => {
    if (!newEmail.trim() || !newPassword) return toast.error("Enter an email and a password");
    setAdding(true);
    try {
      await api.post("/team", { email: newEmail.trim(), password: newPassword, name: newName.trim() || "Medical Team" });
      toast.success(`Added ${newEmail.trim()}`);
      setNewEmail(""); setNewPassword(""); setNewName("");
      load();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    } finally {
      setAdding(false);
    }
  };

  const removeMember = async (member) => {
    try {
      await api.delete(`/team/${member.id}`);
      toast.success(`Removed ${member.email}`);
      if (member.email === user?.email) { logout(); return; }
      load();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    }
  };

  const toggleAlerts = async (member, value) => {
    try {
      await api.put("/auth/alerts", { receiveAlerts: value });
      toast.success(value ? "Alerts turned on for you" : "Alerts turned off for you");
      load();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    }
  };

  const changePassword = async () => {
    if (!curPw || !newPw) return toast.error("Enter your current and new password");
    if (newPw !== confirmPw) return toast.error("New password and confirmation don't match");
    setChanging(true);
    try {
      await api.put("/auth/password", { currentPassword: curPw, newPassword: newPw });
      toast.success("Password changed");
      setCurPw(""); setNewPw(""); setConfirmPw("");
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    } finally {
      setChanging(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto" data-testid="team-access-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" /> Medical Team Access
          </DialogTitle>
          <DialogDescription>
            Give each person on the medical team their own login. Everyone listed here can see the full
            dashboard; each person manages their own password and whether they receive alert emails.
          </DialogDescription>
        </DialogHeader>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground" data-testid="team-count">
            {team.length} {team.length === 1 ? "account" : "accounts"}
          </p>
          {loading && team.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">Loading…</p>
          ) : (
            <ul className="space-y-2">
              {team.map((m) => {
                const isYou = m.email === user?.email;
                return (
                  <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border px-3 py-2" data-testid={`team-row-${m.id}`}>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">
                        {m.name} {isYou && <span className="ml-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase text-primary">You</span>}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">{m.email}</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {isYou ? (
                        <Button
                          size="sm" variant="outline" className="h-7 gap-1 px-2 text-xs"
                          onClick={() => toggleAlerts(m, !m.receiveAlerts)} data-testid={`alerts-toggle-${m.id}`}
                        >
                          {m.receiveAlerts ? <Bell className="h-3.5 w-3.5" /> : <BellOff className="h-3.5 w-3.5" />}
                          {m.receiveAlerts ? "Alerts on" : "Alerts off"}
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground" data-testid={`alerts-status-${m.id}`}>
                          {m.receiveAlerts ? "Alerts on" : "Alerts off"}
                        </span>
                      )}
                      <Button
                        size="sm" variant="outline" className="h-7 w-7 p-0 text-rose-500 hover:bg-rose-500/10"
                        onClick={() => removeMember(m)} disabled={team.length <= 1}
                        title={team.length <= 1 ? "At least one account must remain" : `Remove ${m.email}`}
                        data-testid={`remove-team-${m.id}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="space-y-2 rounded-xl border border-border bg-secondary/40 p-3">
          <p className="flex items-center gap-1.5 text-sm font-semibold"><UserPlus className="h-4 w-4" /> Add a team member</p>
          <Input type="text" placeholder="Name (optional)" value={newName} onChange={(e) => setNewName(e.target.value)} data-testid="team-new-name" />
          <Input type="email" placeholder="Email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} data-testid="team-new-email" />
          <Input type="password" placeholder="Password (min. 8 characters)" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} data-testid="team-new-password" />
          <Button size="sm" onClick={addMember} disabled={adding} data-testid="team-add-button">
            {adding ? "Adding…" : "Add to Medical Team"}
          </Button>
        </div>

        <div className="space-y-2 rounded-xl border border-border bg-secondary/40 p-3">
          <p className="flex items-center gap-1.5 text-sm font-semibold"><KeyRound className="h-4 w-4" /> Change my password</p>
          <Input type="password" placeholder="Current password" value={curPw} onChange={(e) => setCurPw(e.target.value)} data-testid="change-pw-current" />
          <Input type="password" placeholder="New password (min. 8 characters)" value={newPw} onChange={(e) => setNewPw(e.target.value)} data-testid="change-pw-new" />
          <Input type="password" placeholder="Confirm new password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} data-testid="change-pw-confirm" />
          <Button size="sm" onClick={changePassword} disabled={changing} data-testid="change-pw-button">
            {changing ? "Changing…" : "Change password"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
