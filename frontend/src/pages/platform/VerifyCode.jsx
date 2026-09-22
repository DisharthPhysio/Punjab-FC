import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { MailCheck } from "lucide-react";
import apiV2, { formatApiError } from "@/lib/apiV2";
import { usePlatformAuth } from "@/context/PlatformAuthContext";
import { AuthShell } from "@/components/platform/AuthShell";
import { CodeInput } from "@/components/platform/CodeInput";
import { Button } from "@/components/ui/button";

// role: "athlete" | "team" (owner, verifies via /team/verify) | "admin" (standalone signup)
export default function VerifyCode() {
  const [params] = useSearchParams();
  const role = params.get("role") || "athlete";
  const email = params.get("email") || "";
  const next = params.get("next") || "/";
  const navigate = useNavigate();
  const { login } = usePlatformAuth();
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const endpoint = role === "team" ? "/team/verify" : role === "admin" ? "/admin/verify" : "/athlete/verify";
  const authRole = role === "team" ? "admin" : role; // team-owner verify still logs in as "admin"

  const handleVerify = async () => {
    if (code.length !== 6) return toast.error("Enter the 6-digit code");
    setSubmitting(true);
    try {
      const res = await apiV2.post(endpoint, { email, code });
      const token = res.data.token;
      const userObj = authRole === "athlete" ? res.data.athlete : res.data.admin;
      await login(authRole, token, userObj);
      toast.success("Email verified!");
      navigate(next, { replace: true });
    } catch (err) {
      toast.error(formatApiError(err?.response?.data?.detail));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell
      icon={MailCheck}
      title="Check your email"
      subtitle={`We sent a 6-digit code to ${email || "your email"}`}
      backFallback="/"
    >
      <div className="space-y-6">
        <CodeInput value={code} onChange={setCode} />
        <Button
          className="w-full"
          size="lg"
          disabled={submitting || code.length !== 6}
          onClick={handleVerify}
          data-testid="verify-code-submit"
        >
          {submitting ? "Verifying…" : "Verify"}
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          Code not arriving? Check your spam folder — it expires in 15 minutes.
        </p>
      </div>
    </AuthShell>
  );
}
