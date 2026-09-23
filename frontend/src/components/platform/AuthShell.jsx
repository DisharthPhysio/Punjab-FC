import { motion } from "framer-motion";
import { ThemeToggle } from "@/components/ThemeToggle";
import { BackButton } from "./BackButton";

export function AuthShell({ title, subtitle, icon: Icon, backTo, backFallback = "/", maxWidth = "max-w-md", children }) {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-5 pt-5 sm:px-8">
        <BackButton to={backTo} fallback={backFallback} />
        <ThemeToggle />
      </div>
      <div className={`mx-auto ${maxWidth} px-5 pb-16 pt-8 sm:px-0`}>
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
        >
          {(title || Icon) && (
            <div className="mb-7 text-center">
              {Icon && (
                <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary">
                  <Icon className="h-7 w-7" />
                </div>
              )}
              {title && <h1 className="display text-3xl font-extrabold tracking-tight">{title}</h1>}
              {subtitle && <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>}
            </div>
          )}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-7">{children}</div>
        </motion.div>
      </div>
    </div>
  );
}
