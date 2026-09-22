import { useNavigate } from "react-router-dom";
import { PlusCircle, ShieldCheck, ChevronRight } from "lucide-react";
import { AuthShell } from "@/components/platform/AuthShell";

const OPTIONS = [
  { key: "new", title: "New team", desc: "Register your club or squad and build your roster.", icon: PlusCircle, to: "/team/register" },
  { key: "admin", title: "Admin access", desc: "Log in, or get access to a team you don't manage yet.", icon: ShieldCheck, to: "/team/admin-auth" },
];

export default function TeamLanding() {
  const navigate = useNavigate();
  return (
    <AuthShell icon={ShieldCheck} title="Team login" subtitle="Are you registering a new team, or accessing one?" maxWidth="max-w-lg">
      <div className="space-y-3">
        {OPTIONS.map((opt) => (
          <button
            key={opt.key}
            onClick={() => navigate(opt.to)}
            data-testid={`team-landing-${opt.key}`}
            className="group flex w-full items-center gap-4 rounded-xl border border-border bg-background p-4 text-left transition-colors hover:border-primary/50"
          >
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
              <opt.icon className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <p className="font-bold">{opt.title}</p>
              <p className="text-sm text-muted-foreground">{opt.desc}</p>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
          </button>
        ))}
      </div>
    </AuthShell>
  );
}
