import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { UserPlus, KeyRound, Trash2, Bell, BellOff, ShieldCheck, Users, Copy, Eye, EyeOff } from "lucide-react";
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

  const [teamCode, setTeamCode] = useState("");
  const [codeDraft, setCodeDraft] = useState("");
  const [codeSaving, setCodeSaving] = useState(false);
  const [showCode, setShowCode] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [teamRes, codeRes] = await Promise.all([api.get("/team"), api.get("/team-access-code")]);
      setTeam(teamRes.data);
      setTeamCode(codeRes.data.code);
      setCodeDraft(codeRes.data.code);
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

  const saveCode = async () => {
    setCodeSaving(true);
    try {
      const res = await api.put("/team-access-code", { code: codeDraft.trim() });
      setTeamCode(res.data.code);
      setCodeDraft(res.data.code);
      toast.success(res.data.code ? "My Stats access code saved" : "My Stats turned off");
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    } finally {
      setCodeSaving(false);
    }
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(teamCode);
      toast.success("Code copied");
    } catch {
      toast.error("Couldn't copy - select and copy it manually");
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
          <p className="flex items-center gap-1.5 text-sm font-semibold"><Users className="h-4 w-4" /> Players' "My Stats" access code</p>
          <p className="text-xs text-muted-foreground">
            One shared code lets any player see their own load, sleep, hydration, mood and soreness history at
            <code className="mx-1 rounded bg-background px-1 py-0.5">/my-stats</code>
            after picking their own name - no email or individual login. Leave it blank to turn My Stats off.
          </p>
          {teamCode && (
            <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2" data-testid="current-team-code">
              <code className="flex-1 font-mono text-sm">{showCode ? teamCode : "•".repeat(teamCode.length)}</code>
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setShowCode((v) => !v)} data-testid="toggle-code-visibility">
                {showCode ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </Button>
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={copyCode} data-testid="copy-code-button">
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
          <div className="flex gap-2">
            <Input
              type="text" placeholder="e.g. PunjabFC2026 (4-20 characters)" value={codeDraft}
              onChange={(e) => setCodeDraft(e.target.value)} data-testid="team-code-input"
            />
            <Button size="sm" onClick={saveCode} disabled={codeSaving || codeDraft.trim() === teamCode} data-testid="save-code-button">
              {codeSaving ? "Saving…" : "Save"}
            </Button>
          </div>
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
