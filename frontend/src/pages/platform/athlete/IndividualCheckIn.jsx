import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { CheckCircle2, ClipboardList } from "lucide-react";
import apiV2, { formatApiError } from "@/lib/apiV2";
import { AuthShell } from "@/components/platform/AuthShell";
import { CheckInForm } from "@/components/platform/CheckInForm";
import { CheckInHistory } from "@/components/platform/CheckInHistory";

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default function IndividualCheckIn() {
  const [checkins, setCheckins] = useState(null); // null = loading

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

  const alreadyToday = checkins?.some((c) => c.date === todayStr());

  const handleSubmit = async (payload) => {
    try {
      await apiV2.post("/checkin", payload);
      toast.success("Check-in logged!");
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
        ) : alreadyToday ? (
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-6 text-center">
            <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-emerald-500" />
            <p className="font-bold">You're all set for today</p>
            <p className="mt-1 text-sm text-muted-foreground">Come back tomorrow for your next check-in.</p>
          </div>
        ) : (
          <CheckInForm onSubmit={handleSubmit} />
        )}

        <div>
          <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted-foreground">Your history</h3>
          <CheckInHistory checkins={checkins || []} />
        </div>
      </div>
    </AuthShell>
  );
}
