import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import apiV2, { formatApiError } from "@/lib/apiV2";
import { formatDay } from "@/lib/dates";
import { CoachMetrics, AthleteMetrics, InsightsList } from "@/components/platform/Metrics";

export function StatsDisplay({ stats, audience = "athlete" }) {
  const { t, i18n } = useTranslation();
  const chartData = stats.dailySeries.map((d) => ({
    ...d,
    label: formatDay(d.date, i18n.language),
  }));

  return (
    <div className="space-y-6">
      {stats.metrics && (audience === "coach" ? <CoachMetrics m={stats.metrics} /> : <AthleteMetrics m={stats.metrics} />)}
      <InsightsList insights={stats.insights} />

      <div className="rounded-2xl border border-border bg-card p-5">
        <p className="mb-4 text-sm font-bold">{t("stats.dailyChart")}</p>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.15} vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={3} />
              <YAxis yAxisId="load" tick={{ fontSize: 10 }} />
              <YAxis yAxisId="readiness" orientation="right" domain={[0, 100]} tick={{ fontSize: 10 }} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Bar yAxisId="load" dataKey="load" fill="hsl(160 84% 39%)" radius={[3, 3, 0, 0]} name={t("stats.load")} />
              <Line yAxisId="readiness" type="monotone" dataKey="readiness" stroke="#f59e0b" strokeWidth={2} dot={false} connectNulls name={t("stats.readiness")} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

/** endpoint: "/stats/team/mine" (team athlete) or "/stats/mine" (individual athlete). */
export function StatsView({ endpoint = "/stats/team/mine", children }) {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    let active = true;
    apiV2.get(endpoint)
      .then((res) => active && setStats(res.data))
      .catch((err) => toast.error(formatApiError(err?.response?.data?.detail)));
    return () => { active = false; };
  }, [endpoint]);

  if (!stats) {
    return (
      <div className="grid place-items-center py-10">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {children}
      <StatsDisplay stats={stats} audience="athlete" />
    </div>
  );
}
