import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { KeyRound } from "lucide-react";
import apiV2, { formatApiError } from "@/lib/apiV2";
import { AuthShell } from "@/components/platform/AuthShell";
import { RecoveryFields } from "@/components/platform/RecoveryFields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Forgot password without email: the person picks the recovery question they chose at signup, answers it,
 *  and sets a new password. One page, used by athletes and coaches (?role=athlete|admin). */
export default function ForgotPassword() {
  const [params] = useSearchParams();
  const role = params.get("role") === "admin" ? "admin" : "athlete";
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [email, setEmail] = useState(params.get("email") || "");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const loginPath = role === "admin" ? "/team/admin-auth" : "/athlete/individual";

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!question) return toast.error(t("apiErrors.recoveryRequired"));
    setSubmitting(true);
    try {
      await apiV2.post("/auth/recovery/reset", { role, email: email.trim().toLowerCase(), question_id: question, answer, new_password: password });
      toast.success(t("forgot.success"));
      navigate(loginPath, { replace: true });
    } catch (err) {
      toast.error(formatApiError(err?.response?.data?.detail));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell icon={KeyRound} title={t("forgot.title")} subtitle={t("forgot.subtitle")} backTo={loginPath}>
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-1.5">
          <Label htmlFor="fp-email">{t("athleteAuth.email")}</Label>
          <Input id="fp-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" data-testid="forgot-password-email" />
        </div>
        <RecoveryFields mode="reset" question={question} answer={answer} onQuestion={setQuestion} onAnswer={setAnswer} idPrefix="forgot" />
        <div className="space-y-1.5">
          <Label htmlFor="fp-pass">{t("forgot.newPassword")}</Label>
          <Input id="fp-pass" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t("athleteAuth.passwordPlaceholder")} data-testid="forgot-password-new" />
        </div>
        <Button className="w-full" size="lg" type="submit" disabled={submitting} data-testid="forgot-password-submit">
          {submitting ? t("forgot.resetting") : t("forgot.reset")}
        </Button>
      </form>
    </AuthShell>
  );
}
