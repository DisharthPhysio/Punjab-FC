import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { ShieldCheck } from "lucide-react";
import apiV2, { formatApiError } from "@/lib/apiV2";
import { AuthShell } from "@/components/platform/AuthShell";
import { CodeInput } from "@/components/platform/CodeInput";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ResetPassword() {
  const [params] = useSearchParams();
  const role = params.get("role") || "athlete";
  const email = params.get("email") || "";
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (code.length !== 6) return toast.error(t("reset.enterCode"));
    setSubmitting(true);
    try {
      await apiV2.post(`/${role}/reset-password`, { email, code, new_password: newPassword });
      toast.success(t("reset.updated"));
      navigate(role === "athlete" ? "/athlete/individual" : "/team/admin-auth", { replace: true });
    } catch (err) {
      toast.error(formatApiError(err?.response?.data?.detail));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell icon={ShieldCheck} title={t("reset.title")} subtitle={email ? t("reset.codeSentTo", { email }) : t("reset.codeSentYourEmail")} backTo={role === "admin" ? "/team/admin-auth" : "/athlete/individual"}>
      <form onSubmit={handleSubmit} className="space-y-6">
        <CodeInput value={code} onChange={setCode} />
        <div className="space-y-1.5">
          <Label htmlFor="rp-pass">{t("reset.newPassword")}</Label>
          <Input
            id="rp-pass"
            type="password"
            required
            minLength={6}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder={t("athleteAuth.passwordPlaceholder")}
            data-testid="reset-password-new"
          />
        </div>
        <Button className="w-full" size="lg" type="submit" disabled={submitting || code.length !== 6} data-testid="reset-password-submit">
          {submitting ? t("reset.updating") : t("reset.update")}
        </Button>
      </form>
    </AuthShell>
  );
}
