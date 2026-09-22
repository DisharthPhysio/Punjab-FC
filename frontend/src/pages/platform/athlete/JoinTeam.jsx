import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Users, Check } from "lucide-react";
import apiV2, { formatApiError } from "@/lib/apiV2";
import { usePlatformAuth } from "@/context/PlatformAuthContext";
import { AuthShell } from "@/components/platform/AuthShell";
import { CodeInput } from "@/components/platform/CodeInput";
import { Button } from "@/components/ui/button";

export default function JoinTeam() {
  const navigate = useNavigate();
  const { refresh } = usePlatformAuth();
  const [step, setStep] = useState("code"); // "code" | "name"
  const [code, setCode] = useState("");
  const [team, setTeam] = useState(null);
  const [players, setPlayers] = useState([]);
  const [selected, setSelected] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const lookup = async () => {
    if (code.length !== 6) return toast.error("Enter the 6-digit team code");
    setSubmitting(true);
    try {
      const res = await apiV2.post("/team/lookup", { code });
      if (res.data.claimed) {
        toast.success(`Welcome back to ${res.data.team.team_name}`);
        navigate(`/athlete/team/${res.data.team.id}`, { replace: true });
        return;
      }
      setTeam(res.data.team);
      setPlayers(res.data.available_players);
      setStep("name");
    } catch (err) {
      toast.error(formatApiError(err?.response?.data?.detail));
    } finally {
      setSubmitting(false);
    }
  };

  const confirmName = async () => {
    if (!selected) return toast.error("Select your name to continue");
    setSubmitting(true);
    try {
      await apiV2.post("/team/claim", { code, player_id: selected });
      await refresh();
      toast.success(`You're in — welcome to ${team.team_name}!`);
      navigate(`/athlete/team/${team.id}`, { replace: true });
    } catch (err) {
      toast.error(formatApiError(err?.response?.data?.detail));
    } finally {
      setSubmitting(false);
    }
  };

  if (step === "name") {
    return (
      <AuthShell icon={Users} title={team?.team_name} subtitle="Which name on the roster is you?" backTo="/athlete/join-team">
        <div className="space-y-2">
          {players.length === 0 && (
            <p className="rounded-xl border border-dashed border-border p-5 text-center text-sm text-muted-foreground">
              No unclaimed names left on this roster. Ask your team admin to add you.
            </p>
          )}
          {players.map((p) => {
            const active = selected === p.id;
            return (
              <button
                key={p.id}
                onClick={() => setSelected(p.id)}
                data-testid={`roster-name-${p.name}`}
                className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left text-sm font-medium transition-colors ${active ? "border-primary bg-primary/10 text-primary" : "border-border bg-card hover:border-primary/40"}`}
              >
                {p.name}
                {active && <Check className="h-4 w-4" />}
              </button>
            );
          })}
        </div>
        {players.length > 0 && (
          <Button className="mt-6 w-full" size="lg" onClick={confirmName} disabled={submitting || !selected} data-testid="confirm-name-submit">
            {submitting ? "Confirming…" : "This is me"}
          </Button>
        )}
      </AuthShell>
    );
  }

  return (
    <AuthShell icon={Users} title="Join a team" subtitle="Enter the 6-digit code your team gave you" backTo="/athlete/mode">
      <div className="space-y-6">
        <CodeInput value={code} onChange={setCode} />
        <Button className="w-full" size="lg" onClick={lookup} disabled={submitting || code.length !== 6} data-testid="join-team-submit">
          {submitting ? "Looking up…" : "Continue"}
        </Button>
      </div>
    </AuthShell>
  );
}
