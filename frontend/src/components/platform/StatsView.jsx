import { useEffect, useState } from "react";
import { toast } from "sonner";
import { TrendingUp, TrendingDown, Minus, Gauge } from "lucide-react";
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import apiV2, { formatApiError } from "@/lib/apiV2";

const riskCls = (risk) =>
  risk === "red" ? "text-rose-500 border-rose-500/40 bg-rose-500/10"
  : risk === "amber" ? "text-amber-500 border-amber-500/40 bg-amber-500/10"
  : risk === "green" ? "text-emerald-500 border-emerald-500/40 bg-emerald-500/10"
  : "border-border bg-card";

const MetricCard = ({ label, value, sub, risk }) => (
  <div className={`rounded-2xl border p-4 ${riskCls(risk)}`}>
    <p className="text-xs font-semibold uppercase tracking-wide opacity-70">{label}</p>
    <p className="mt-1 font-mono text-2xl font-extrabold">{value}</p>
    {sub && <div className="mt-0.5 text-xs opacity-70">{sub}</div>}
  </div>
);

const TrendBadge = ({ delta, suffix = "" }) => {
  if (delta == null) return <span className="text-xs text-muted-foreground">No prior data</span>;
  const Icon = delta > 0 ? TrendingUp : delta < 0 ? TrendingDown : Minus;
  const cls = delta > 0 ? "text-emerald-500" : delta < 0 ? "text-rose-500" : "text-muted-foreground";
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-bold ${cls}`}>
      <Icon className="h-3 w-3" />{delta > 0 ? "+" : ""}{delta}{suffix} vs last week
    </span>
  );
};

export function StatsDisplay({ stats }) {
  const chartData = stats.dailySeries.map((d) => ({
    ...d,
    label: new Date(d.date + "T00:00:00").toLocaleDateString(undefined, { day: "numeric", month: "short" }),
  }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <MetricCard label="Avg load" value={stats.avgLoad} sub="last 28 days" />
        <MetricCard label="Peak load" value={stats.peakLoad} sub="last 28 days" />
        <MetricCard label="Week total" value={stats.weekLoad} sub={<TrendBadge delta={stats.weekChangePct} suffix="%" />} />
        <MetricCard label="Monotony" value={stats.monotony ?? "—"} risk={stats.monotonyRisk} sub="Foster '98 · this week" />
        <MetricCard label="Strain" value={stats.strain ?? "—"} risk={stats.monotonyRisk} sub="load × monotony" />
        <MetricCard label="ACWR" value={stats.acwr ?? "—"} risk={stats.acwrRisk} sub="acute : chronic" />
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-bold">Readiness</p>
            <p className="text-xs text-muted-foreground">Composite of sleep, hydration, motivation &amp; soreness</p>
          </div>
          <div className="text-right">
            <p className="font-mono text-2xl font-extrabold">{stats.readinessWeekAvg ?? "—"}</p>
            <TrendBadge delta={stats.readinessTrend} />
          </div>
        </div>
        {stats.readinessToday != null && (
          <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            <Gauge className="h-3 w-3" /> Today: {stats.readinessToday}/100
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <p className="mb-4 text-sm font-bold">Daily training load &amp; readiness</p>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.15} vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={3} />
              <YAxis yAxisId="load" tick={{ fontSize: 10 }} />
              <YAxis yAxisId="readiness" orientation="right" domain={[0, 100]} tick={{ fontSize: 10 }} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Bar yAxisId="load" dataKey="load" fill="hsl(160 84% 39%)" radius={[3, 3, 0, 0]} name="Load" />
              <Line yAxisId="readiness" type="monotone" dataKey="readiness" stroke="#f59e0b" strokeWidth={2} dot={false} connectNulls name="Readiness" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

export function StatsView() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    let active = true;
    apiV2.get("/stats/team/mine")
      .then((res) => active && setStats(res.data))
      .catch((err) => toast.error(formatApiError(err?.response?.data?.detail)));
    return () => { active = false; };
  }, []);

  if (!stats) {
    return (
      <div className="grid place-items-center py-10">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return <StatsDisplay stats={stats} />;
}
