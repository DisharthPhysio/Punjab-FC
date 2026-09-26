import { useState } from "react";
import { Moon, Droplets, Flame, AlertTriangle, Dumbbell, Pencil, Trash2 } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const Pill = ({ icon: Icon, children }) => (
  <span className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary/60 px-2.5 py-1 text-xs font-medium text-muted-foreground">
    <Icon className="h-3 w-3" /> {children}
  </span>
);

/** onEdit/onDelete are optional -- pass both to let a player manage their own
 * past responses. Omit them (e.g. on the admin's read-only player-detail view)
 * and the row is just a plain summary card. */
export function CheckInHistory({ checkins, emptyLabel = "No check-ins yet — today's will show up here.", onEdit, onDelete }) {
  const [confirmId, setConfirmId] = useState(null);

  if (!checkins?.length) {
    return <p className="rounded-xl border border-dashed border-border bg-card/50 p-6 text-center text-sm text-muted-foreground">{emptyLabel}</p>;
  }

  return (
    <div className="space-y-3">
      {checkins.map((c) => (
        <div key={c.id} className="rounded-2xl border border-border bg-card p-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-sm font-bold">{new Date(c.date + "T00:00:00").toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}</span>
            <div className="flex items-center gap-2">
              {(c.feelingIll || c.sorenessSeverity > 0) && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-semibold text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="h-3 w-3" /> Flagged
                </span>
              )}
              {onEdit && (
                <button onClick={() => onEdit(c)} className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground" aria-label="Edit this check-in" data-testid={`edit-checkin-${c.date}`}>
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              )}
              {onDelete && (
                <button onClick={() => setConfirmId(c.id)} className="rounded-lg p-1.5 text-muted-foreground hover:text-destructive" aria-label="Delete this check-in" data-testid={`delete-checkin-${c.date}`}>
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {c.sleepHours != null && <Pill icon={Moon}>{c.sleepHours}h sleep · {c.sleepQuality}/5</Pill>}
            {c.sleepHours == null && <Pill icon={Moon}>Sleep {c.sleepQuality}/5</Pill>}
            <Pill icon={Droplets}>Hydration {c.hydration}/5</Pill>
            <Pill icon={Flame}>Motivation {c.motivation}/5</Pill>
            {c.load ? <Pill icon={Dumbbell}>Load {c.load}</Pill> : null}
          </div>
        </div>
      ))}

      {onDelete && (
        <AlertDialog open={!!confirmId} onOpenChange={(open) => !open && setConfirmId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this check-in?</AlertDialogTitle>
              <AlertDialogDescription>This can't be undone. You'll be able to submit a new one for that day.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => { onDelete(confirmId); setConfirmId(null); }}>Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
