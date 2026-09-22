import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { KeyRound } from "lucide-react";
import apiV2, { formatApiError } from "@/lib/apiV2";
import { AuthShell } from "@/components/platform/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ForgotPassword() {
  const [params] = useSearchParams();
  const role = params.get("role") || "athlete"; // "athlete" | "admin"
  const navigate = useNavigate();
  const [email, setEmail] = useState(params.get("email") || "");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await apiV2.post(`/${role}/forgot-password`, { email: email.trim().toLowerCase() });
      toast.success("If that account exists, a reset code is on its way.");
      navigate(`/reset-password?role=${role}&email=${encodeURIComponent(email.trim().toLowerCase())}`);
    } catch (err) {
      toast.error(formatApiError(err?.response?.data?.detail));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell icon={KeyRound} title="Forgot password" subtitle="We'll email you a code to reset it.">
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-1.5">
          <Label htmlFor="fp-email">Email</Label>
          <Input
            id="fp-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            data-testid="forgot-password-email"
          />
        </div>
        <Button className="w-full" size="lg" type="submit" disabled={submitting} data-testid="forgot-password-submit">
          {submitting ? "Sending…" : "Send reset code"}
        </Button>
      </form>
    </AuthShell>
  );
}
