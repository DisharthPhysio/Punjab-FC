import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { toast } from "sonner";
import { User, AlertTriangle, Thermometer } from "lucide-react";
import apiV2, { formatApiError } from "@/lib/apiV2";
import { AuthShell } from "@/components/platform/AuthShell";
import { RiskBadge } from "@/components/platform/RiskBadge";
import { StatsDisplay } from "@/components/platform/StatsView";
import { CheckInHistory } from "@/components/platform/CheckInHistory";

export default function PlayerDetail() {
  const { playerId } = useParams();
  const [data, setData] = useState(null);

  useEffect(() => {
    let active = true;
    apiV2.get(`/team/player/${playerId}`)
      .then((res) => active && setData(res.data))
      .catch((err) => toast.error(formatApiError(err?.response?.data?.detail)));
    return () => { active = false; };
  }, [playerId]);

  if (!data) {
    return (
      <AuthShell backTo="/team/home">
        <div className="grid place-items-center py-10">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      </AuthShell>
    );
  }

  const { player, stats, checkins } = data;
  const todayFlag = checkins?.[0]?.date === new Date().toISOString().slice(0, 10) ? checkins[0] : null;

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

            {todayFlag && (todayFlag.feelingIll || todayFlag.sorenessSeverity > 0) && (
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
              </div>
            )}

            {stats && <StatsDisplay stats={stats} />}

            <div>
              <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted-foreground">Recent check-ins</h3>
              <CheckInHistory checkins={checkins} emptyLabel="No check-ins logged yet." />
            </div>
          </>
        )}
      </div>
    </AuthShell>
  );
}
