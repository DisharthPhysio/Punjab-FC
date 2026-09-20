import { cn } from "@/lib/utils";

// value: 1-5, higher is better
const COLORS = {
  1: "bg-rose-500 text-white border-rose-500",
  2: "bg-rose-400 text-white border-rose-400",
  3: "bg-amber-400 text-slate-900 border-amber-400",
  4: "bg-emerald-500 text-white border-emerald-500",
  5: "bg-emerald-600 text-white border-emerald-600",
};

export function WellnessRating({ value, onChange, testIdPrefix, labels }) {
  return (
    <div className="flex gap-2">
      {[1, 2, 3, 4, 5].map((n) => {
        const active = value === n;
        return (
          <button
            key={n}
            type="button"
            data-testid={`${testIdPrefix}-${n}`}
            aria-pressed={active}
            onClick={() => onChange(n)}
            className={cn(
              "flex h-12 flex-1 flex-col items-center justify-center rounded-xl border text-base font-bold transition-all duration-150 active:scale-95",
              active
                ? `${COLORS[n]} shadow-lg scale-105`
                : "border-border bg-secondary text-muted-foreground hover:border-primary/50 hover:text-foreground"
            )}
          >
            {n}
          </button>
        );
      })}
    </div>
  );
}
