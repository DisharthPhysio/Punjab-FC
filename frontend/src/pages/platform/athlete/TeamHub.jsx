import { useEffect, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import { toast } from "sonner";
import { CheckCircle2, Users, BarChart3 } from "lucide-react";
import apiV2, { formatApiError } from "@/lib/apiV2";
import { AuthShell } from "@/components/platform/AuthShell";
import { CheckInForm } from "@/components/platform/CheckInForm";
import { CheckInHistory } from "@/components/platform/CheckInHistory";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default function TeamHub() {
  const { teamId } = useParams();
  const [checkins, setCheckins] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await apiV2.get("/checkin/mine", { params: { context: "team", team_id: teamId } });
      setCheckins(res.data.checkins);
    } catch (err) {
      toast.error(formatApiError(err?.response?.data?.detail));
      setCheckins([]);
    }
  }, [teamId]);

  useEffect(() => { load(); }, [load]);

  const alreadyToday = checkins?.some((c) => c.date === todayStr());

  const handleSubmit = async (payload) => {
    try {
      await apiV2.post("/checkin", { context: "team", team_id: teamId, ...payload });
      toast.success("Check-in logged!");
      await load();
    } catch (err) {
      toast.error(formatApiError(err?.response?.data?.detail));
    }
  };

  return (
    <AuthShell icon={Users} title="Team check-in" backTo="/athlete/mode" maxWidth="max-w-xl">
      <Tabs defaultValue="checkin">
        <TabsList className="mb-6 grid w-full grid-cols-2">
          <TabsTrigger value="checkin" data-testid="team-tab-checkin">Check-in</TabsTrigger>
          <TabsTrigger value="stats" data-testid="team-tab-stats">My stats</TabsTrigger>
        </TabsList>

        <TabsContent value="checkin">
          <div className="space-y-8">
            {checkins === null ? (
              <div className="grid place-items-center py-10">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            ) : alreadyToday ? (
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-6 text-center">
                <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-emerald-500" />
                <p className="font-bold">You're all set for today</p>
                <p className="mt-1 text-sm text-muted-foreground">Your team's medical staff can see this check-in.</p>
              </div>
            ) : (
              <CheckInForm onSubmit={handleSubmit} />
            )}
            <div>
              <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted-foreground">Your history</h3>
              <CheckInHistory checkins={checkins || []} />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="stats">
          <div className="rounded-2xl border border-dashed border-border bg-card/50 p-8 text-center">
            <BarChart3 className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
            <p className="font-bold">Your full stats are coming next</p>
            <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
              Average &amp; peak load, monotony, strain, readiness vs. last week, and your daily load chart —
              this is built in Phase 3, right after this auth foundation ships.
            </p>
          </div>
        </TabsContent>
      </Tabs>
    </AuthShell>
  );
}
