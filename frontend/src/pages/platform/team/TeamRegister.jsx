import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { PlusCircle } from "lucide-react";
import apiV2, { formatApiError } from "@/lib/apiV2";
import { AuthShell } from "@/components/platform/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function TeamRegister() {
  const navigate = useNavigate();
  const [teamName, setTeamName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    const cleanEmail = email.trim().toLowerCase();
    try {
      await apiV2.post("/team/register", { team_name: teamName.trim(), email: cleanEmail, password });
      toast.success("Team created — verify your email to continue.");
      navigate(`/verify?role=team&email=${encodeURIComponent(cleanEmail)}&next=/team/roster-setup`);
    } catch (err) {
      toast.error(formatApiError(err?.response?.data?.detail));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell icon={PlusCircle} title="Register your team" subtitle="This also becomes your admin login" backTo="/team">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="t-name">Team name</Label>
          <Input id="t-name" required value={teamName} onChange={(e) => setTeamName(e.target.value)} placeholder="e.g. Punjab FC U19" data-testid="team-name-input" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="t-email">Email</Label>
          <Input id="t-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="coach@example.com" data-testid="team-email-input" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="t-pass">Password</Label>
          <Input id="t-pass" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" data-testid="team-password-input" />
        </div>
        <Button className="w-full" size="lg" type="submit" disabled={submitting} data-testid="team-register-submit">
          {submitting ? "Creating…" : "Create team"}
        </Button>
      </form>
    </AuthShell>
  );
}
