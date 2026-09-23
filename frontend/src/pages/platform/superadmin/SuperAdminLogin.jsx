import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ShieldAlert } from "lucide-react";
import apiSuperAdmin, { formatApiError } from "@/lib/apiSuperAdmin";
import { AuthShell } from "@/components/platform/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function SuperAdminLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await apiSuperAdmin.post("/superadmin/login", { email: email.trim().toLowerCase(), password });
      localStorage.setItem("sa_token", res.data.token);
      navigate("/superadmin/panel", { replace: true });
    } catch (err) {
      toast.error(formatApiError(err?.response?.data?.detail));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell icon={ShieldAlert} title="Site admin" subtitle="Restricted access">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="sa-email">Email</Label>
          <Input id="sa-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} data-testid="superadmin-email" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sa-pass">Password</Label>
          <Input id="sa-pass" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} data-testid="superadmin-password" />
        </div>
        <Button className="w-full" size="lg" type="submit" disabled={submitting} data-testid="superadmin-submit">
          {submitting ? "Please wait…" : "Log in"}
        </Button>
      </form>
    </AuthShell>
  );
}
