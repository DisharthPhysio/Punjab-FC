import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { CheckCircle2, ClipboardList, Pencil } from "lucide-react";
import apiV2, { formatApiError } from "@/lib/apiV2";
import { AuthShell } from "@/components/platform/AuthShell";
import { CheckInForm } from "@/components/platform/CheckInForm";
import { CheckInHistory } from "@/components/platform/CheckInHistory";
import { ExportButtons } from "@/components/platform/ExportButtons";
import { Button } from "@/components/ui/button";

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default function IndividualCheckIn() {
  const [checkins, setCheckins] = useState(null); // null = loading
  const [editing, setEditing] = useState(null); // checkin being edited, or null

  const load = useCallback(async () => {
    try {
      const res = await apiV2.get("/checkin/mine");
      setCheckins(res.data.checkins);
    } catch (err) {
      toast.error(formatApiError(err?.response?.data?.detail));
      setCheckins([]);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const today = checkins?.find((c) => c.date === todayStr());

  const handleSubmit = async (payload) => {
    try {
      if (editing) {
        await apiV2.patch(`/checkin/${editing.id}`, payload);
        toast.success("Check-in updated!");
        setEditing(null);
      } else {
        await apiV2.post("/checkin", payload);
        toast.success("Check-in logged!");
      }
      await load();
    } catch (err) {
      toast.error(formatApiError(err?.response?.data?.detail));
    }
  };

  const handleDelete = async (id) => {
    try {
      await apiV2.delete(`/checkin/${id}`);
      toast.success("Deleted");
      if (editing?.id === id) setEditing(null);
      await load();
    } catch (err) {
      toast.error(formatApiError(err?.response?.data?.detail));
    }
  };

  return (
    <AuthShell icon={ClipboardList} title="Individual check-in" subtitle="Takes under a minute" exitConfirm maxWidth="max-w-xl">
      <div className="space-y-8">
        {checkins === null ? (
          <div className="grid place-items-center py-10">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : editing ? (
          <CheckInForm onSubmit={handleSubmit} initial={editing} submitLabel="Save changes" />
        ) : today ? (
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-6 text-center">
            <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-emerald-500" />
            <p className="font-bold">You're all set for today</p>
            <p className="mt-1 text-sm text-muted-foreground">You can still edit today's entry if something changes.</p>
            <Button variant="outline" size="sm" className="mt-4 gap-1.5" onClick={() => setEditing(today)} data-testid="edit-today-checkin">
              <Pencil className="h-3.5 w-3.5" /> Edit today's entry
            </Button>
          </div>
        ) : (
          <CheckInForm onSubmit={handleSubmit} />
        )}

        <div>
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">Your history</h3>
            {checkins?.length > 0 && (
              <ExportButtons pdfUrl="/checkin/export/pdf" filename="my-checkin-history" />
            )}
          </div>
          <CheckInHistory
            checkins={checkins || []}
            onEdit={(c) => setEditing(c)}
            onDelete={handleDelete}
          />
        </div>
      </div>
    </AuthShell>
  );
}
