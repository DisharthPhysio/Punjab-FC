import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { CalendarDays, CheckCircle2, Circle } from "lucide-react";
import apiV2, { formatApiError } from "@/lib/apiV2";
import { AuthShell } from "@/components/platform/AuthShell";
import { Calendar } from "@/components/ui/calendar";

function toDateStr(d) {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, "0"), day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function toMonthStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function TeamCalendar() {
  const [month, setMonth] = useState(new Date());
  const [daysWithCheckins, setDaysWithCheckins] = useState([]);
  const [selected, setSelected] = useState(new Date());
  const [dayData, setDayData] = useState(null);

  const loadMonth = useCallback(async (monthDate) => {
    try {
      const res = await apiV2.get("/team/days-with-checkins", { params: { month: toMonthStr(monthDate) } });
      setDaysWithCheckins(res.data.days);
    } catch (err) {
      toast.error(formatApiError(err?.response?.data?.detail));
    }
  }, []);

  const loadDay = useCallback(async (date) => {
    setDayData(null);
    try {
      const res = await apiV2.get("/team/day", { params: { date: toDateStr(date) } });
      setDayData(res.data);
    } catch (err) {
      toast.error(formatApiError(err?.response?.data?.detail));
    }
  }, []);

  useEffect(() => { loadMonth(month); }, [month, loadMonth]);
  useEffect(() => { loadDay(selected); }, [selected, loadDay]);

  const highlightedDates = daysWithCheckins.map((d) => new Date(d + "T00:00:00"));

  return (
    <AuthShell icon={CalendarDays} title="Day-by-day" subtitle="Browse any date's check-in status" backTo="/team/home" maxWidth="max-w-lg">
      <div className="space-y-6">
        <div className="rounded-2xl border border-border bg-card p-2">
          <Calendar
            mode="single"
            selected={selected}
            onSelect={(d) => d && setSelected(d)}
            onMonthChange={setMonth}
            modifiers={{ hasCheckins: highlightedDates }}
            modifiersClassNames={{ hasCheckins: "font-bold underline decoration-primary decoration-2 underline-offset-4" }}
            disabled={{ after: new Date() }}
            className="mx-auto"
          />
        </div>

        <div>
          <p className="mb-3 text-sm font-bold">
            {selected.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
          </p>
          {!dayData ? (
            <div className="grid place-items-center py-6">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : (
            <div className="space-y-2">
              {dayData.players.map((p) => (
                <div key={p.player_id} className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    {p.checkedIn ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <Circle className="h-4 w-4 text-muted-foreground" />}
                    <span className="text-sm font-medium">{p.name}</span>
                  </div>
                  {p.checkedIn && p.checkin && (
                    <span className="text-xs text-muted-foreground">
                      Sleep {p.checkin.sleepQuality}/5 · Load {p.checkin.load ?? "—"}
                    </span>
                  )}
                  {!p.joined && <span className="text-xs text-muted-foreground">Not joined</span>}
                </div>
              ))}
              {dayData.players.length === 0 && (
                <p className="rounded-xl border border-dashed border-border p-5 text-center text-sm text-muted-foreground">No players on the roster yet.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </AuthShell>
  );
}
