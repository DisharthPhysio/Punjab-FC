import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Lock, ArrowLeft, ShieldCheck } from "lucide-react";
import api, { formatApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function CoachLogin() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("disharthjain98@gmail.com");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { data } = await api.post("/auth/login", { email, password });
      login(data.access_token, data.user);
      navigate("/coach/dashboard");
    } catch (err) {
      setError(formatApiError(err.response?.data?.detail) || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4">
      <div className="absolute right-4 top-4"><ThemeToggle /></div>
      <div className="pointer-events-none absolute -left-24 -top-24 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
      <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm rounded-3xl border border-border bg-card p-8"
      >
        <div className="mb-6 grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary">
          <ShieldCheck className="h-7 w-7" />
        </div>
        <h1 className="text-3xl font-black uppercase tracking-tight">Medical Team<br />Command Center</h1>
        <p className="mt-2 text-sm text-muted-foreground">Sign in to view your squad's readiness.</p>

        <form onSubmit={submit} className="mt-6 space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Email</label>
            <Input
              data-testid="coach-login-email-input" type="email" value={email}
              onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" required
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                data-testid="coach-login-password-input" type="password" value={password}
                onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="pl-9" required
              />
            </div>
          </div>
          {error && <p className="text-sm text-rose-500" data-testid="login-error">{error}</p>}
          <Button
            data-testid="coach-login-submit-button" type="submit" disabled={loading}
            className="h-12 w-full text-base font-bold uppercase tracking-wide"
          >
            {loading ? "Signing in..." : "Sign In"}
          </Button>
        </form>

        <Link to="/" className="mt-6 flex items-center justify-center gap-1.5 text-sm text-muted-foreground hover:text-primary">
          <ArrowLeft className="h-4 w-4" /> Back to athlete check-in
        </Link>
      </motion.div>
    </div>
  );
}
