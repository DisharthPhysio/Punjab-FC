import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Users, Plus, X } from "lucide-react";
import apiV2, { formatApiError } from "@/lib/apiV2";
import { AuthShell } from "@/components/platform/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function RosterSetup() {
  const navigate = useNavigate();
  const [players, setPlayers] = useState([]);
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await apiV2.get("/team/roster");
      setPlayers(res.data.players);
    } catch (err) {
      toast.error(formatApiError(err?.response?.data?.detail));
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const addPlayer = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setAdding(true);
    try {
      await apiV2.post("/team/roster", { name: name.trim(), contact: contact.trim() });
      setName(""); setContact("");
      await load();
    } catch (err) {
      toast.error(formatApiError(err?.response?.data?.detail));
    } finally {
      setAdding(false);
    }
  };

  const removePlayer = async (id) => {
    try {
      await apiV2.delete(`/team/roster/${id}`);
      setPlayers((p) => p.filter((x) => x.id !== id));
    } catch (err) {
      toast.error(formatApiError(err?.response?.data?.detail));
    }
  };

  return (
    <AuthShell icon={Users} title="Build your roster" subtitle="Add each player's name and contact info" backTo="/team/home" maxWidth="max-w-lg">
      <form onSubmit={addPlayer} className="mb-5 flex flex-col gap-2 sm:flex-row">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Player name" data-testid="roster-player-name" className="flex-1" />
        <Input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Phone / email (optional)" data-testid="roster-player-contact" className="flex-1" />
        <Button type="submit" disabled={adding || !name.trim()} data-testid="roster-add-player" className="gap-1.5">
          <Plus className="h-4 w-4" /> Add
        </Button>
      </form>

      <div className="mb-6 space-y-2">
        {players.length === 0 && <p className="text-center text-sm text-muted-foreground">No players added yet.</p>}
        {players.map((p) => (
          <div key={p.id} className="flex items-center justify-between rounded-xl border border-border bg-background px-4 py-2.5">
            <div>
              <p className="text-sm font-semibold">{p.name}</p>
              <p className="text-xs text-muted-foreground">
                {p.contact ? `${p.contact} · ` : ""}
                <span className={p.joined ? "text-emerald-600 dark:text-emerald-400" : ""}>{p.joined ? "Joined" : "Not joined"}</span>
              </p>
            </div>
            <button onClick={() => removePlayer(p.id)} className="rounded-lg p-1.5 text-muted-foreground hover:text-destructive" aria-label={`Remove ${p.name}`}>
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      <p className="mb-4 text-xs text-muted-foreground">
        A player can always log in on a new device just by entering the team code and picking their
        name again — there's no "reset" step needed anymore.
      </p>

      <Button className="w-full" size="lg" onClick={() => navigate("/team/home")} data-testid="roster-continue">
        {players.length > 0 ? "Continue" : "Skip for now"}
      </Button>
    </AuthShell>
  );
}
