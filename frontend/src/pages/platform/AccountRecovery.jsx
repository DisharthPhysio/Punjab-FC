import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { ShieldCheck } from "lucide-react";
import apiV2, { formatApiError } from "@/lib/apiV2";
import { usePlatformAuth } from "@/context/PlatformAuthContext";
import { homeFor } from "@/lib/navHistory";
import { AuthShell } from "@/components/platform/AuthShell";
import { RecoveryFields } from "@/components/platform/RecoveryFields";
import { Button } from "@/components/ui/button";

/** Shown ONCE, right after login, to accounts created before recovery questions existed. */
export default function AccountRecovery() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { role, refresh } = usePlatformAuth();
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!question) return toast.error(t("apiErrors.recoveryRequired"));
    setSaving(true);
    try {
      await apiV2.post("/account/recovery", { question_id: question, answer });
      await refresh();
      toast.success(t("recovery.saved"));
      navigate(homeFor(role), { replace: true });
    } catch (err) {
      toast.error(formatApiError(err?.response?.data?.detail));
    } finally {
      setSaving(false);
    }
  };

  return (
    <AuthShell icon={ShieldCheck} title={t("recovery.setupTitle")} subtitle={t("recovery.setupSubtitle")} exitConfirm>
      <form onSubmit={submit} className="space-y-5">
        <RecoveryFields question={question} answer={answer} onQuestion={setQuestion} onAnswer={setAnswer} idPrefix="setup" />
        <Button className="w-full" size="lg" type="submit" disabled={saving} data-testid="setup-recovery-submit">
          {saving ? t("player.saving") : t("recovery.save")}
        </Button>
      </form>
    </AuthShell>
  );
}
