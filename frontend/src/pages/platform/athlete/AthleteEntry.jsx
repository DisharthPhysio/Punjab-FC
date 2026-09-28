import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { User, KeyRound, ChevronRight } from "lucide-react";
import { AuthShell } from "@/components/platform/AuthShell";

export default function AthleteEntry() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const OPTIONS = [
    { key: "individual", title: t("athleteEntry.individualTitle"), desc: t("athleteEntry.individualDesc"), icon: User, to: "/athlete/individual" },
    { key: "team", title: t("athleteEntry.teamTitle"), desc: t("athleteEntry.teamDesc"), icon: KeyRound, to: "/athlete/join-team" },
  ];

  return (
    <AuthShell title={t("athleteEntry.title")} subtitle={t("athleteEntry.subtitle")} backTo="/" maxWidth="max-w-lg">
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
