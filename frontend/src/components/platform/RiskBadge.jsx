import { AlertTriangle, ShieldCheck, ShieldAlert } from "lucide-react";

const CONFIG = {
  red: { label: "Needs attention", cls: "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30", Icon: AlertTriangle },
  amber: { label: "Watch", cls: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30", Icon: ShieldAlert },
  green: { label: "Good", cls: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30", Icon: ShieldCheck },
};

export function RiskBadge({ level, className = "" }) {
  if (!level) return <span className={`rounded-full border border-border bg-secondary px-2.5 py-1 text-xs font-semibold text-muted-foreground ${className}`}>Not joined</span>;
  const c = CONFIG[level] || CONFIG.green;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold ${c.cls} ${className}`}>
      <c.Icon className="h-3 w-3" /> {c.label}
    </span>
  );
}
