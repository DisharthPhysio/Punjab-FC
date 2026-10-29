import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { KeyRound } from "lucide-react";
import apiV2, { formatApiError } from "@/lib/apiV2";
import { usePlatformAuth } from "@/context/PlatformAuthContext";
import { AuthShell } from "@/components/platform/AuthShell";
import { CodeInput } from "@/components/platform/CodeInput";
import { Button } from "@/components/ui/button";

export default function LinkTeamCode() {
  const navigate = useNavigate();
  const { refresh, teams, setActiveTeam } = usePlatformAuth();
  const { t } = useTranslation();
  const hasTeam = (teams?.length || 0) > 0;
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (code.length !== 6) return toast.error(t("linkCode.enterCode"));
    setSubmitting(true);
    try {
      const res = await apiV2.post("/admin/link-team", { code });
      setActiveTeam(res.data.team.id);
      await refresh();
      toast.success(t("linkCode.success", { team: res.data.team.team_name }));
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
      title={t("linkCode.title")}
      subtitle={t("linkCode.subtitle")}
      backTo={hasTeam ? "/team/home" : undefined}
      exitConfirm={!hasTeam}
    >
      <div className="space-y-6">
        <CodeInput value={code} onChange={setCode} />
        <Button className="w-full" size="lg" onClick={submit} disabled={submitting || code.length !== 6} data-testid="link-team-submit">
          {submitting ? t("linkCode.checking") : t("linkCode.get")}
        </Button>
      </div>
    </AuthShell>
  );
}
