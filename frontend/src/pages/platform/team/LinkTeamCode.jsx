import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { KeyRound } from "lucide-react";
import apiV2, { formatApiError } from "@/lib/apiV2";
import { usePlatformAuth } from "@/context/PlatformAuthContext";
import { AuthShell } from "@/components/platform/AuthShell";
import { CodeInput } from "@/components/platform/CodeInput";
import { Button } from "@/components/ui/button";

export default function LinkTeamCode() {
  const navigate = useNavigate();
  const { refresh, teams } = usePlatformAuth();
  const hasTeam = (teams?.length || 0) > 0;
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (code.length !== 6) return toast.error("Enter the 6-digit access code");
    setSubmitting(true);
    try {
      const res = await apiV2.post("/admin/link-team", { code });
      await refresh();
      toast.success(`You now have access to ${res.data.team.team_name}`);
      navigate("/team/home", { replace: true });
    } catch (err) {
      toast.error(formatApiError(err?.response?.data?.detail));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell
      icon={KeyRound}
      title="Enter team access code"
      subtitle="Ask the team's admin for their 6-digit admin code"
      backTo={hasTeam ? "/team/home" : undefined}
      exitConfirm={!hasTeam}
    >
      <div className="space-y-6">
        <CodeInput value={code} onChange={setCode} />
        <Button className="w-full" size="lg" onClick={submit} disabled={submitting || code.length !== 6} data-testid="link-team-submit">
          {submitting ? "Checking…" : "Get access"}
        </Button>
      </div>
    </AuthShell>
  );
}
