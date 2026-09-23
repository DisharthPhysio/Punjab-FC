import { useNavigate } from "react-router-dom";
import { useRef } from "react";
import { motion } from "framer-motion";
import { User, ShieldCheck, Activity, ChevronRight } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";

const OPTIONS = [
  {
    key: "athlete",
    title: "I'm an Athlete",
    desc: "Log your daily check-in, on your own or as part of a team.",
    icon: User,
    to: "/athlete",
  },
  {
    key: "team",
    title: "I'm a Team / Coach",
    desc: "Register a new team or access an existing one as an admin.",
    icon: ShieldCheck,
    to: "/team",
  },
];

const LONG_PRESS_MS = 5000;

export default function Landing() {
  const navigate = useNavigate();
  const pressTimer = useRef(null);

  // Hidden site-admin entry point: press and hold the title for 5 seconds.
  const startPress = () => {
    clearTimeout(pressTimer.current);
    pressTimer.current = setTimeout(() => navigate("/superadmin/login"), LONG_PRESS_MS);
  };
  const cancelPress = () => clearTimeout(pressTimer.current);

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-5 pt-5 sm:px-8">
        <div
          className="flex items-center gap-2 text-sm font-semibold text-muted-foreground select-none"
          onPointerDown={startPress}
          onPointerUp={cancelPress}
          onPointerLeave={cancelPress}
          onPointerCancel={cancelPress}
        >
          <Activity className="h-4 w-4 text-primary" />
          Load &amp; Recovery Platform
        </div>
        <ThemeToggle />
      </div>

      <div className="mx-auto flex min-h-[calc(100vh-72px)] max-w-3xl flex-col items-center justify-center px-5 py-12 sm:px-8">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="mb-10 text-center"
        >
          <h1 className="display text-4xl font-extrabold tracking-tight sm:text-5xl">Welcome back</h1>
          <p className="mt-3 text-base text-muted-foreground">How would you like to sign in?</p>
        </motion.div>

        <div className="grid w-full gap-4 sm:grid-cols-2">
          {OPTIONS.map((opt, i) => (
            <motion.button
              key={opt.key}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.08 * i, ease: "easeOut" }}
              onClick={() => navigate(opt.to)}
              data-testid={`landing-${opt.key}`}
              className="group flex flex-col items-start gap-4 rounded-2xl border border-border bg-card p-6 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md"
            >
              <div className="grid h-12 w-12 place-items-center rounded-xl bg-primary/10 text-primary">
                <opt.icon className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-xl font-bold">{opt.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{opt.desc}</p>
              </div>
              <div className="mt-auto flex items-center gap-1 text-sm font-semibold text-primary">
                Continue <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </div>
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  );
}
