import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { ShieldCheck } from "lucide-react";
import apiV2, { formatApiError } from "@/lib/apiV2";
import { usePlatformAuth } from "@/context/PlatformAuthContext";
import { AuthShell } from "@/components/platform/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function AdminAuth() {
  const navigate = useNavigate();
  const { login } = usePlatformAuth();
  const { t } = useTranslation();
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    const cleanEmail = email.trim().toLowerCase();
    try {
      if (mode === "signup") {
        const res = await apiV2.post("/admin/signup", { email: cleanEmail, password });
        await login("admin", res.data.token, res.data.admin);
        navigate("/team/link-code", { replace: true });
      } else {
        const res = await apiV2.post("/admin/login", { email: cleanEmail, password });
        await login("admin", res.data.token, res.data.admin);
        navigate(res.data.needs_code ? "/team/link-code" : "/team/home", { replace: true });
      }
    } catch (err) {
      toast.error(formatApiError(err?.response?.data?.detail));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell icon={ShieldCheck} title={t("adminAuth.title")} subtitle={t("adminAuth.subtitle")} backTo="/team">
      <Tabs value={mode} onValueChange={setMode} className="mb-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="login" data-testid="admin-tab-login">{t("athleteAuth.login")}</TabsTrigger>
          <TabsTrigger value="signup" data-testid="admin-tab-signup">{t("adminAuth.newAdmin")}</TabsTrigger>
        </TabsList>
      </Tabs>

      {mode === "signup" && (
        <p className="mb-4 rounded-lg bg-secondary/60 px-3 py-2 text-xs text-muted-foreground">
          {t("adminAuth.newAdminHint")}
        </p>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="ad-email">{t("athleteAuth.email")}</Label>
          <Input id="ad-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" data-testid="admin-email" />
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="ad-pass">{t("athleteAuth.password")}</Label>
            {mode === "login" && (
              <button type="button" onClick={() => navigate(`/forgot-password?role=admin&email=${encodeURIComponent(email.trim().toLowerCase())}`)} className="text-xs font-medium text-primary hover:underline">
                {t("athleteAuth.forgotPassword")}
              </button>
            )}
          </div>
          <Input id="ad-pass" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t("athleteAuth.passwordPlaceholder")} data-testid="admin-password" />
        </div>
        <Button className="w-full" size="lg" type="submit" disabled={submitting} data-testid="admin-submit">
          {submitting ? t("common.pleaseWait") : mode === "signup" ? t("athleteAuth.createAccount") : t("athleteAuth.login")}
        </Button>
      </form>
    </AuthShell>
  );
}
