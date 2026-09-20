import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { Trash2, ClipboardList, AlertCircle, Pencil, Eraser } from "lucide-react";
import api, { formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { EditResponseDialog } from "@/components/EditResponseDialog";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

function fmt(ts) {
  try {
    const d = new Date(ts);
    return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch {
    return ts;
  }
}

export function ResponsesDialog({ open, onOpenChange, onChanged, date }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [editing, setEditing] = useState(null);
  const [clearOpen, setClearOpen] = useState(false);
  const [clearing, setClearing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/checkins", { params: { limit: 300, ...(date ? { date } : {}) } });
      setRows(res.data);
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const undoDelete = async (checkin, session) => {
    try {
      await api.post("/checkins/restore", { checkin, session });
      toast.success(`Restored ${checkin.name}'s response`);
      load();
      onChanged?.();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    }
  };

  const confirmDelete = async () => {
    if (!pending) return;
    setDeleting(true);
    try {
      const res = await api.delete(`/checkins/${pending.id}`);
      const { checkin, session } = res.data;
      setRows((r) => r.filter((x) => x.id !== pending.id));
      const name = pending.name;
      setPending(null);
      onChanged?.();
      toast.success(`Deleted ${name}'s response`, {
        action: { label: "Undo", onClick: () => undoDelete(checkin, session) },
        duration: 8000,
      });
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    } finally {
      setDeleting(false);
    }
  };

  const confirmClear = async () => {
    setClearing(true);
    try {
      const res = await api.delete("/checkins/today");
      toast.success(`Cleared ${res.data.deletedCheckins} of today's check-ins`);
      setClearOpen(false);
      load();
      onChanged?.();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    } finally {
      setClearing(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl" data-testid="responses-dialog">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-2xl font-black uppercase tracking-tight">
              <ClipboardList className="h-5 w-5 text-primary" /> Manage Responses
            </DialogTitle>
            <DialogDescription>
              Edit or delete any check-in submitted by mistake. Removing a response also deletes its logged training session.
            </DialogDescription>
            {date && (
              <p className="text-xs font-semibold text-primary" data-testid="responses-date-note">
                Showing responses for {format(parseISO(date), "EEEE, d MMMM yyyy")}
              </p>
            )}
          </DialogHeader>

          {!date && (
            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={() => setClearOpen(true)} disabled={rows.length === 0}
                className="gap-1.5 border-rose-500/40 text-rose-500 hover:bg-rose-500/10" data-testid="clear-today-button">
                <Eraser className="h-4 w-4" /> Clear today's check-ins
              </Button>
            </div>
          )}

          <div className="max-h-[60vh] overflow-y-auto rounded-xl border border-border">
            {loading ? (
              <div className="p-8 text-center text-muted-foreground">Loading responses…</div>
            ) : rows.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">{date ? "No responses on this day." : "No responses yet."}</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted/80 text-xs uppercase text-muted-foreground backdrop-blur">
                  <tr>
                    <th className="px-3 py-2 text-left">When</th>
                    <th className="px-3 py-2 text-left">Athlete</th>
                    <th className="px-3 py-2 text-center">Sleep</th>
                    <th className="px-3 py-2 text-center">Hyd</th>
                    <th className="px-3 py-2 text-center">Mot</th>
                    <th className="px-3 py-2 text-center">Ill</th>
                    <th className="px-3 py-2 text-center">Load</th>
                    <th className="px-3 py-2 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-t border-border" data-testid={`response-row-${r.id}`}>
                      <td className="px-3 py-2 text-muted-foreground">{fmt(r.timestamp)}</td>
                      <td className="px-3 py-2 font-semibold">{r.name}</td>
                      <td className="px-3 py-2 text-center">{r.sleepQuality}</td>
                      <td className="px-3 py-2 text-center">{r.hydration}</td>
                      <td className="px-3 py-2 text-center">{r.motivation}</td>
                      <td className="px-3 py-2 text-center">{r.feelingIll ? "Yes" : "No"}</td>
                      <td className="px-3 py-2 text-center font-mono">{r.load ?? "—"}</td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setEditing(r)}
                            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-primary hover:bg-primary/10"
                            data-testid={`edit-response-${r.id}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => setPending(r)}
                            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-rose-500 hover:bg-rose-500/10"
                            data-testid={`delete-response-${r.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!pending} onOpenChange={(o) => !o && setPending(null)}>
        <AlertDialogContent data-testid="delete-response-confirm">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-rose-500" /> Delete this response?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pending && `This permanently removes ${pending.name}'s check-in from ${fmt(pending.timestamp)}${pending.load ? " and its training session" : ""}. This cannot be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="cancel-delete-response">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); confirmDelete(); }}
              disabled={deleting}
              className="bg-rose-500 hover:bg-rose-600"
              data-testid="confirm-delete-response"
            >
              {deleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={clearOpen} onOpenChange={setClearOpen}>
        <AlertDialogContent data-testid="clear-today-confirm">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-rose-500" /> Clear today's check-ins?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes every check-in and training session submitted today, giving you a fresh start. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="cancel-clear-today">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); confirmClear(); }}
              disabled={clearing}
              className="bg-rose-500 hover:bg-rose-600"
              data-testid="confirm-clear-today"
            >
              {clearing ? "Clearing…" : "Clear all"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <EditResponseDialog
        response={editing}
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(null)}
        onSaved={() => { load(); onChanged?.(); }}
      />
    </>
  );
}
