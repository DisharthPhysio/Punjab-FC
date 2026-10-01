import { useEffect, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import { toast } from "sonner";
import { User, AlertTriangle, Thermometer, CheckCircle2, ClipboardList, Plus } from "lucide-react";
import apiV2, { formatApiError } from "@/lib/apiV2";
import { AuthShell } from "@/components/platform/AuthShell";
import { RiskBadge } from "@/components/platform/RiskBadge";
import { StatsDisplay } from "@/components/platform/StatsView";
import { CheckInHistory } from "@/components/platform/CheckInHistory";
import { ExportButtons } from "@/components/platform/ExportButtons";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";

function NoteDialog({ trigger, title, description, onSubmit, submitLabel = "Save" }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!note.trim()) return toast.error("Enter a note first");
    setSubmitting(true);
    try {
      await onSubmit(note.trim());
      setNote("");
      setOpen(false);
    } catch (err) {
      toast.error(formatApiError(err?.response?.data?.detail));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Iced and rested, cleared by physio for training tomorrow." rows={4} data-testid="note-dialog-textarea" />
        <DialogFooter>
          <Button onClick={submit} disabled={submitting} data-testid="note-dialog-submit">{submitting ? "Saving…" : submitLabel}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function PlayerDetail() {
  const { playerId } = useParams();
  const [data, setData] = useState(null);
  const [notes, setNotes] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await apiV2.get(`/team/player/${playerId}`);
      setData(res.data);
    } catch (err) {
      toast.error(formatApiError(err?.response?.data?.detail));
    }
  }, [playerId]);

  const loadNotes = useCallback(async () => {
    try {
      const res = await apiV2.get(`/team/player/${playerId}/notes`);
      setNotes(res.data.notes);
    } catch (err) {
      toast.error(formatApiError(err?.response?.data?.detail));
    }
  }, [playerId]);

  useEffect(() => { load(); loadNotes(); }, [load, loadNotes]);

  const deleteCheckin = async (checkinId) => {
    try {
      await apiV2.delete(`/team/player/${playerId}/checkin/${checkinId}`);
      toast.success("Deleted");
      await load();
    } catch (err) {
      toast.error(formatApiError(err?.response?.data?.detail));
    }
  };

  const acknowledge = async (note) => {
    await apiV2.post(`/team/player/${playerId}/acknowledge`, { note });
    toast.success("Flag cleared and logged");
    await Promise.all([load(), loadNotes()]);
  };

  const addNote = async (note) => {
    await apiV2.post(`/team/player/${playerId}/notes`, { note });
    toast.success("Note added");
    await loadNotes();
  };

  if (!data) {
    return (
      <AuthShell backTo="/team/home">
        <div className="grid place-items-center py-10">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      </AuthShell>
    );
  }

  const { player, stats, checkins, acknowledgedToday } = data;
  const todayFlag = checkins?.[0]?.date === new Date().toISOString().slice(0, 10) ? checkins[0] : null;
  const showFlag = todayFlag && (todayFlag.feelingIll || todayFlag.sorenessSeverity > 0) && !acknowledgedToday;

  return (
    <AuthShell icon={User} title={player.name} subtitle={player.contact || undefined} backTo="/team/home" maxWidth="max-w-xl">
      <div className="space-y-6">
        {!player.claimed_at ? (
          <div className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            {player.name} hasn't joined with the team's athlete code yet — no data to show.
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between rounded-2xl border border-border bg-card p-4">
              <span className="text-sm font-semibold">Current status</span>
              <RiskBadge level={stats?.riskLevel} />
            </div>

            {acknowledgedToday && (
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                <p className="flex items-center gap-1.5 text-sm font-bold text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2 className="h-4 w-4" /> Today's flag cleared — see notes below
                </p>
              </div>
            )}

            {showFlag && (
              <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
                <p className="mb-2 flex items-center gap-1.5 text-sm font-bold text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="h-4 w-4" /> Flagged today
                </p>
                <div className="space-y-1 text-sm text-amber-800 dark:text-amber-300">
                  {todayFlag.feelingIll && (
                    <p className="flex items-center gap-1.5">
                      <Thermometer className="h-3.5 w-3.5" />
                      Feeling ill{todayFlag.symptoms?.length ? `: ${todayFlag.symptoms.join(", ")}` : ""}
                      {todayFlag.illnessSeverity ? ` (${todayFlag.illnessSeverity})` : ""}
                    </p>
                  )}
                  {todayFlag.sorenessSeverity > 0 && (
                    <p>Soreness {todayFlag.sorenessSeverity}/5{todayFlag.sorenessAreas?.length ? `: ${todayFlag.sorenessAreas.join(", ")}` : ""}</p>
                  )}
                </div>
                <NoteDialog
                  title="Clear this flag"
                  description="Add the advice or treatment given, for the record. This clears today's flag from the dashboard."
                  onSubmit={acknowledge}
                  submitLabel="Clear flag"
                  trigger={<Button size="sm" variant="outline" className="mt-3" data-testid="clear-flag-button">Clear flag &amp; add note</Button>}
                />
              </div>
            )}

            {stats && <StatsDisplay stats={stats} />}

            <div>
              <div className="mb-3 flex items-center justify-between gap-2">
                <h3 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">Recent check-ins</h3>
                {checkins?.length > 0 && (
                  <ExportButtons pdfUrl={`/team/player/${playerId}/export/pdf`} filename={`${player.name}-checkins`} canShare={false} showDaysFilter />
                )}
              </div>
              <CheckInHistory checkins={checkins} emptyLabel="No check-ins logged yet." onDelete={deleteCheckin} />
            </div>

            <div>
              <div className="mb-3 flex items-center justify-between gap-2">
                <h3 className="flex items-center gap-1.5 text-sm font-bold uppercase tracking-wide text-muted-foreground">
                  <ClipboardList className="h-3.5 w-3.5" /> Notes &amp; records
                </h3>
                <NoteDialog
                  title="Add a note"
                  description="Advice, treatment, or anything worth keeping on record for this player."
                  onSubmit={addNote}
                  trigger={<Button size="sm" variant="outline" className="gap-1"><Plus className="h-3.5 w-3.5" /> Add note</Button>}
                />
              </div>
              <div className="space-y-2">
                {notes === null && <p className="py-2 text-center text-xs text-muted-foreground">Loading…</p>}
                {notes?.length === 0 && <p className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">No notes yet.</p>}
                {notes?.map((n) => (
                  <div key={n.id} className="rounded-xl border border-border bg-card p-3">
                    <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                      <span>{new Date(n.date + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" })} · {n.author}</span>
                      {n.type === "acknowledgment" && <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-emerald-600 dark:text-emerald-400">Flag cleared</span>}
                    </div>
                    <p className="text-sm">{n.note}</p>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </AuthShell>
  );
}
