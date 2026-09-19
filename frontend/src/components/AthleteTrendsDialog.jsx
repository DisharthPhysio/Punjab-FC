import { useEffect, useState } from "react";
import {
  ResponsiveContainer, AreaChart, Area, LineChart, Line,
  XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";
import { TrendingUp, Activity } from "lucide-react";
import api from "@/lib/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const dayLabel = (ds) => {
  const d = new Date(ds + "T00:00:00");
  return d.toLocaleDateString([], { weekday: "short" });
};

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

export function AthleteTrendsDialog({ name, open, onOpenChange }) {
  const [days, setDays] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && name) {
      setLoading(true);
      api.get(`/trends?name=${encodeURIComponent(name)}`)
        .then((r) => setDays(r.data.days.map((d) => ({ ...d, label: dayLabel(d.date) }))))
        .catch(() => setDays([]))
        .finally(() => setLoading(false));
    }
  }, [open, name]);

  const totalLoad = days.reduce((s, d) => s + (d.load || 0), 0);
  const avgLoad = days.filter((d) => d.load > 0).length
    ? Math.round(totalLoad / days.filter((d) => d.load > 0).length) : 0;
  const peak = days.reduce((m, d) => Math.max(m, d.load || 0), 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl" data-testid="athlete-trends-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl font-black uppercase tracking-tight">
            <TrendingUp className="h-5 w-5 text-primary" /> {name} · 7-Day Trends
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="grid h-64 place-items-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-3 gap-3">
              {[["Avg Load", avgLoad], ["Peak Load", peak], ["Week Total", totalLoad]].map(([l, v]) => (
                <div key={l} className="rounded-xl border border-border bg-secondary/40 p-3 text-center">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">{l}</p>
                  <p className="font-mono text-2xl font-bold">{v}</p>
                </div>
              ))}
            </div>

            <div>
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <Activity className="h-3.5 w-3.5" /> Training Load (RPE × min)
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
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} stroke="currentColor" className="text-muted-foreground" />
                  <YAxis tick={{ fontSize: 12 }} stroke="currentColor" className="text-muted-foreground" />
                  <Tooltip content={<TooltipBox />} />
                  <Area type="monotone" dataKey="load" name="Load" stroke="#10B981" strokeWidth={2.5} fill="url(#loadFill)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Readiness (Sleep · Hydration · Motivation, 1-5)
              </p>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={days} margin={{ top: 5, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-border" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} stroke="currentColor" className="text-muted-foreground" />
                  <YAxis domain={[0, 5]} ticks={[1, 2, 3, 4, 5]} tick={{ fontSize: 12 }} stroke="currentColor" className="text-muted-foreground" />
                  <Tooltip content={<TooltipBox />} />
                  <Line type="monotone" dataKey="sleep" name="Sleep" stroke="#3B82F6" strokeWidth={2} dot={{ r: 3 }} connectNulls />
                  <Line type="monotone" dataKey="hydration" name="Hydration" stroke="#06B6D4" strokeWidth={2} dot={{ r: 3 }} connectNulls />
                  <Line type="monotone" dataKey="motivation" name="Motivation" stroke="#F59E0B" strokeWidth={2} dot={{ r: 3 }} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
