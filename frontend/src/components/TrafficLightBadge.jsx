import { cn } from "@/lib/utils";

const STYLES = {
  green: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
  amber: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
  red: "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30",
  grey: "bg-slate-500/10 text-slate-500 dark:text-slate-400 border-slate-400/30",
};

const DOTS = {
  green: "bg-emerald-500",
  amber: "bg-amber-500",
  red: "bg-rose-500",
  grey: "bg-slate-400",
};

export function TrafficLightBadge({ status, label, testId }) {
  return (
    <span
      data-testid={testId}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold whitespace-nowrap",
        STYLES[status]
      )}
    >
      <span className={cn("h-2 w-2 rounded-full", DOTS[status])} />
      {label}
    </span>
  );
}

// ---- status helpers ----
export const goodScaleStatus = (v) => {
  const n = Number(v);
  if (!n) return "grey";
  if (n <= 2) return "red";
  if (n === 3) return "amber";
  return "green";
};

export const loadStatus = (v) => {
  const n = Number(v);
  if (!n) return "grey";
  if (n > 600) return "red";
  if (n >= 300) return "amber";
  return "green";
};

export const sorenessStatus = (areas, severity) => {
  if (!areas || areas.length === 0) return "green";
  const n = Number(severity);
  if (n >= 4) return "red";
  if (n === 3) return "amber";
  return "green";
};
