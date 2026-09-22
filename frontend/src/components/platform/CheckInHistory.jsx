import { Moon, Droplets, Flame, AlertTriangle, Dumbbell } from "lucide-react";

const Pill = ({ icon: Icon, children }) => (
  <span className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary/60 px-2.5 py-1 text-xs font-medium text-muted-foreground">
    <Icon className="h-3 w-3" /> {children}
  </span>
);

export function CheckInHistory({ checkins, emptyLabel = "No check-ins yet — today's will show up here." }) {
  if (!checkins?.length) {
    return <p className="rounded-xl border border-dashed border-border bg-card/50 p-6 text-center text-sm text-muted-foreground">{emptyLabel}</p>;
  }
  return (
    <div className="space-y-3">
      {checkins.map((c) => (
        <div key={c.id} className="rounded-2xl border border-border bg-card p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-bold">{new Date(c.date + "T00:00:00").toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}</span>
            {(c.feelingIll || c.sorenessSeverity > 0) && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-semibold text-amber-600 dark:text-amber-400">
                <AlertTriangle className="h-3 w-3" /> Flagged
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {c.sleepHours != null && <Pill icon={Moon}>{c.sleepHours}h sleep · {c.sleepQuality}/5</Pill>}
            {c.sleepHours == null && <Pill icon={Moon}>Sleep {c.sleepQuality}/5</Pill>}
            <Pill icon={Droplets}>Hydration {c.hydration}/5</Pill>
            <Pill icon={Flame}>Motivation {c.motivation}/5</Pill>
            {c.logSession && c.load ? <Pill icon={Dumbbell}>Load {c.load}</Pill> : null}
          </div>
        </div>
      ))}
    </div>
  );
}
