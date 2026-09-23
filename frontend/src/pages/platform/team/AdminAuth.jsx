import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
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
    <AuthShell icon={ShieldCheck} title="Admin access" subtitle="Team owners log in here too" backTo="/team">
      <Tabs value={mode} onValueChange={setMode} className="mb-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="login" data-testid="admin-tab-login">Log in</TabsTrigger>
          <TabsTrigger value="signup" data-testid="admin-tab-signup">New admin</TabsTrigger>
        </TabsList>
      </Tabs>

      {mode === "signup" && (
        <p className="mb-4 rounded-lg bg-secondary/60 px-3 py-2 text-xs text-muted-foreground">
          Use this if someone (e.g. a physio) needs access to a team they don't own — you'll enter the team's
          admin code on the next screen. Registering a brand-new team? Go back and choose "New team" instead.
        </p>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="ad-email">Email</Label>
          <Input id="ad-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" data-testid="admin-email" />
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="ad-pass">Password</Label>
            {mode === "login" && (
              <button type="button" onClick={() => navigate(`/forgot-password?role=admin&email=${encodeURIComponent(email.trim().toLowerCase())}`)} className="text-xs font-medium text-primary hover:underline">
                Forgot password?
              </button>
            )}
          </div>
          <Input id="ad-pass" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" data-testid="admin-password" />
        </div>
        <Button className="w-full" size="lg" type="submit" disabled={submitting} data-testid="admin-submit">
          {submitting ? "Please wait…" : mode === "signup" ? "Create account" : "Log in"}
        </Button>
      </form>
    </AuthShell>
  );
}
