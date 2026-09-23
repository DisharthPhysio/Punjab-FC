import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { User } from "lucide-react";
import apiV2, { formatApiError } from "@/lib/apiV2";
import { usePlatformAuth } from "@/context/PlatformAuthContext";
import { AuthShell } from "@/components/platform/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function AthleteAuth() {
  const navigate = useNavigate();
  const { login } = usePlatformAuth();
  const [mode, setMode] = useState("login"); // "login" | "signup"
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    const cleanEmail = email.trim().toLowerCase();
    try {
      if (mode === "signup") {
        const res = await apiV2.post("/athlete/signup", { name: name.trim(), email: cleanEmail, password });
        await login("athlete", res.data.token, res.data.athlete);
      } else {
        const res = await apiV2.post("/athlete/login", { email: cleanEmail, password });
        await login("athlete", res.data.token, res.data.athlete);
      }
      navigate("/athlete/checkin", { replace: true });
    } catch (err) {
      toast.error(formatApiError(err?.response?.data?.detail));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell icon={User} title="Individual athlete" subtitle="Use your personal email to continue" backTo="/athlete">
      <Tabs value={mode} onValueChange={setMode} className="mb-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="login" data-testid="athlete-tab-login">Log in</TabsTrigger>
          <TabsTrigger value="signup" data-testid="athlete-tab-signup">Sign up</TabsTrigger>
        </TabsList>
      </Tabs>

      <form onSubmit={handleSubmit} className="space-y-4">
        {mode === "signup" && (
          <div className="space-y-1.5">
            <Label htmlFor="a-name">Full name</Label>
            <Input id="a-name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" data-testid="athlete-name" />
          </div>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="a-email">Email</Label>
          <Input id="a-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" data-testid="athlete-email" />
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="a-pass">Password</Label>
            {mode === "login" && (
              <button
                type="button"
                onClick={() => navigate(`/forgot-password?role=athlete&email=${encodeURIComponent(email.trim().toLowerCase())}`)}
                className="text-xs font-medium text-primary hover:underline"
              >
                Forgot password?
              </button>
            )}
          </div>
          <Input id="a-pass" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" data-testid="athlete-password" />
        </div>
        <Button className="w-full" size="lg" type="submit" disabled={submitting} data-testid="athlete-submit">
          {submitting ? "Please wait…" : mode === "signup" ? "Create account" : "Log in"}
        </Button>
      </form>
    </AuthShell>
  );
}
