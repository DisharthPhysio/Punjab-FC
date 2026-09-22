import { useEffect, useState } from "react";
import {
  ResponsiveContainer, AreaChart, Area, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";
import { TrendingUp, Activity, CalendarRange } from "lucide-react";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { TrafficLightBadge } from "@/components/TrafficLightBadge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const RANGES = [7, 28, 90];

const parse = (ds) => new Date(ds + "T00:00:00");
const shortDay = (ds) => parse(ds).toLocaleDateString([], { weekday: "short" });
const dayMonth = (ds) => parse(ds).toLocaleDateString([], { day: "numeric", month: "short" });
const longDay = (ds) => parse(ds).toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" });

const TooltipBox = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-semibold">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }}>{p.name}: <span className="font-mono font-bold">{p.value ?? "—"}</span></p>
      ))}
    </div>
  );
};

const changeText = (pct) => (pct === null || pct === undefined ? "—" : `${pct > 0 ? "▲ " : pct < 0 ? "▼ " : ""}${Math.abs(pct)}%`);

export function AthleteTrendsDialog({ name, open, onOpenChange, endDate }) {
  const [range, setRange] = useState(7);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!(open && name)) return undefined;
    let cancelled = false;
    setLoading(true);
    api.get("/trends", { params: { name, days: range, ...(endDate ? { end: endDate } : {}) } })
      .then((r) => { if (!cancelled) setData(r.data); })
      .catch(() => { if (!cancelled) setData({ days: [], weeks: [] }); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, name, range, endDate]);

  const shownRange = data?.range || 7;
  const labelOf = shownRange <= 7 ? shortDay : dayMonth;
  const days = (data?.days || []).map((d) => ({ ...d, label: labelOf(d.date) }));
  const weeks = data?.weeks || [];
  const latestWeek = weeks[weeks.length - 1];

  const totalLoad = days.reduce((s, d) => s + (d.load || 0), 0);
  const trainingDays = days.filter((d) => d.load > 0).length;
  const avgLoad = trainingDays ? Math.round(totalLoad / trainingDays) : 0;
  const peak = days.reduce((m, d) => Math.max(m, d.load || 0), 0);

  const history = [...days].reverse().filter((d) => d.ill || (d.sorenessAreas && d.sorenessAreas.length > 0)).slice(0, 20);
  const weekBars = weeks.map((w) => ({ label: dayMonth(w.weekEnd), Load: w.load }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto" data-testid="athlete-trends-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl font-black uppercase tracking-tight">
            <TrendingUp className="h-5 w-5 text-primary" /> {name} · {shownRange}-Day Trends
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Time range">
          <CalendarRange className="mr-1 h-4 w-4 text-muted-foreground" />
          {RANGES.map((r) => (
            <Button key={r} size="sm" variant={range === r ? "default" : "outline"} className="h-8" aria-pressed={range === r}
              onClick={() => setRange(r)} data-testid={`trends-range-${r}`}>
              {r} days
            </Button>
          ))}
          {data?.end && <span className="ml-auto text-xs text-muted-foreground" data-testid="trends-end">up to {longDay(data.end)}</span>}
        </div>

        {loading && !data ? (
          <div className="grid h-64 place-items-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : (
          <div className={`space-y-6 transition-opacity ${loading ? "opacity-60" : ""}`}>
            <div className="grid grid-cols-3 gap-3">
              {[["Avg Load", avgLoad], ["Peak Load", peak], [shownRange <= 7 ? "Week Total" : "Total", totalLoad]].map(([l, v]) => (
                <div key={l} className="rounded-xl border border-border bg-secondary/40 p-3 text-center">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">{l}</p>
                  <p className="font-mono text-2xl font-bold">{v}</p>
                </div>
              ))}
            </div>

            {latestWeek && (
              <div data-testid="trends-week-summary">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Latest 7 days ({dayMonth(latestWeek.weekStart)} – {dayMonth(latestWeek.weekEnd)})
                </p>
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-xl border border-border bg-secondary/40 p-3 text-center">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Monotony</p>
                    <div className="mt-1 flex h-8 items-center justify-center">
                      {latestWeek.monotonyRisk
                        ? <TrafficLightBadge status={latestWeek.monotonyRisk} label={latestWeek.monotony} testId="trends-monotony" />
                        : <span className="font-mono text-2xl font-bold text-muted-foreground" data-testid="trends-monotony">—</span>}
                    </div>
                  </div>
                  <div className="rounded-xl border border-border bg-secondary/40 p-3 text-center">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Strain</p>
                    <p className="font-mono text-2xl font-bold" data-testid="trends-strain">{latestWeek.strain ?? "—"}</p>
                  </div>
                  <div className="rounded-xl border border-border bg-secondary/40 p-3 text-center">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">vs previous week</p>
                    <p className="font-mono text-2xl font-bold" data-testid="trends-week-change">{changeText(latestWeek.changePct)}</p>
                  </div>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Monotony = average daily load ÷ its day-to-day variation (rest days count as 0). 2.0 or more is high, 1.5–2.0 is worth watching.
                  Strain = weekly load × monotony. These are rule-of-thumb markers, not a diagnosis.
                </p>
              </div>
            )}

            <div>
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <Activity className="h-3.5 w-3.5" /> Daily Training Load (RPE × min)
              </p>
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={days} margin={{ top: 5, right: 8, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="loadFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10B981" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#10B981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-border" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} stroke="currentColor" className="text-muted-foreground" interval="preserveStartEnd" minTickGap={18} />
                  <YAxis tick={{ fontSize: 12 }} stroke="currentColor" className="text-muted-foreground" />
                  <Tooltip content={<TooltipBox />} />
                  <Area type="monotone" dataKey="load" name="Load" stroke="#10B981" strokeWidth={2.5} fill="url(#loadFill)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {shownRange >= 28 && weeks.length > 0 && (
              <div data-testid="trends-weekly">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Weekly Load (RPE × min)</p>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={weekBars} margin={{ top: 5, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-border" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="currentColor" className="text-muted-foreground" interval="preserveStartEnd" minTickGap={14} />
                    <YAxis tick={{ fontSize: 12 }} stroke="currentColor" className="text-muted-foreground" />
                    <Tooltip content={<TooltipBox />} />
                    <Bar dataKey="Load" name="Weekly load" fill="#10B981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
                <div className="mt-3 overflow-x-auto rounded-xl border border-border">
                  <table className="w-full min-w-[420px] text-sm" data-testid="trends-weekly-table">
                    <thead>
                      <tr className="bg-secondary/50 text-left text-xs font-bold uppercase tracking-wide text-muted-foreground">
                        <th className="px-3 py-2">Week ending</th>
                        <th className="px-3 py-2 text-center">Load</th>
                        <th className="px-3 py-2 text-center">vs prev.</th>
                        <th className="px-3 py-2 text-center">Monotony</th>
                        <th className="px-3 py-2 text-center">Strain</th>
                        <th className="px-3 py-2 text-center">Days logged</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...weeks].reverse().map((w) => (
                        <tr key={w.weekEnd} className="border-t border-border" data-testid={`trends-week-row-${w.weekEnd}`}>
                          <td className="px-3 py-2 font-medium">{dayMonth(w.weekEnd)}</td>
                          <td className="px-3 py-2 text-center font-mono font-bold">{w.load}</td>
                          <td className="px-3 py-2 text-center font-mono text-muted-foreground">{changeText(w.changePct)}</td>
                          <td className="px-3 py-2 text-center">
                            {w.monotonyRisk ? <TrafficLightBadge status={w.monotonyRisk} label={w.monotony} /> : <span className="text-muted-foreground">—</span>}
                          </td>
                          <td className="px-3 py-2 text-center font-mono">{w.strain ?? "—"}</td>
                          <td className="px-3 py-2 text-center font-mono text-muted-foreground">{w.daysLogged}/7</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Readiness (Sleep · Hydration · Motivation, 1-5)
              </p>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={days} margin={{ top: 5, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-border" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} stroke="currentColor" className="text-muted-foreground" interval="preserveStartEnd" minTickGap={18} />
                  <YAxis domain={[0, 5]} ticks={[1, 2, 3, 4, 5]} tick={{ fontSize: 12 }} stroke="currentColor" className="text-muted-foreground" />
                  <Tooltip content={<TooltipBox />} />
                  <Line type="monotone" dataKey="sleep" name="Sleep" stroke="#3B82F6" strokeWidth={2} dot={shownRange <= 28 ? { r: 3 } : false} connectNulls />
                  <Line type="monotone" dataKey="hydration" name="Hydration" stroke="#06B6D4" strokeWidth={2} dot={shownRange <= 28 ? { r: 3 } : false} connectNulls />
                  <Line type="monotone" dataKey="motivation" name="Motivation" stroke="#F59E0B" strokeWidth={2} dot={shownRange <= 28 ? { r: 3 } : false} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div data-testid="trends-history">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Illness &amp; soreness history</p>
              {history.length === 0 ? (
                <p className="rounded-xl bg-secondary/40 px-4 py-4 text-center text-sm text-muted-foreground" data-testid="trends-history-empty">
                  No illness or soreness reported in this period.
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {history.map((d) => (
                    <li key={d.date} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-border px-3 py-2 text-sm" data-testid={`trends-history-item-${d.date}`}>
                      <span className="w-24 shrink-0 font-semibold">{longDay(d.date)}</span>
                      {d.ill && (
                        <TrafficLightBadge status="red" label={`Unwell${d.illnessSeverity ? ` (${d.illnessSeverity})` : ""}${d.symptoms.length ? `: ${d.symptoms.join(", ")}` : ""}`} />
                      )}
                      {d.sorenessAreas.length > 0 && (
                        <TrafficLightBadge
                          status={(d.soreness || 0) >= 4 ? "red" : (d.soreness || 0) === 3 ? "amber" : "green"}
                          label={`Soreness ${d.soreness ?? 0}/5: ${d.sorenessAreas.join(", ")}${d.sorenessSide ? ` · ${d.sorenessSide}` : ""}`}
                        />
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
