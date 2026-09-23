import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { User, KeyRound, ChevronRight } from "lucide-react";
import { AuthShell } from "@/components/platform/AuthShell";

const OPTIONS = [
  { key: "individual", title: "Individual athlete", desc: "Log in with your email to check in on your own.", icon: User, to: "/athlete/individual" },
  { key: "team", title: "I have a team code", desc: "No account needed — enter your team's code and pick your name.", icon: KeyRound, to: "/athlete/join-team" },
];

export default function AthleteEntry() {
  const navigate = useNavigate();
  return (
    <AuthShell title="Athlete" subtitle="How would you like to check in?" backTo="/" maxWidth="max-w-lg">
      <div className="space-y-3">
        {OPTIONS.map((opt, i) => (
          <motion.button
            key={opt.key}
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.05 * i }}
            onClick={() => navigate(opt.to)}
            data-testid={`athlete-entry-${opt.key}`}
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
          </motion.button>
        ))}
      </div>
    </AuthShell>
  );
}
