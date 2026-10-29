import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { Moon } from "lucide-react";
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ZAxis } from "recharts";
import apiV2, { formatApiError } from "@/lib/apiV2";

function interpret(r, t) {
  if (r == null) return { label: t("sleepCorr.notEnoughShort"), cls: "text-muted-foreground" };
  const abs = Math.abs(r);
  const strength = abs >= 0.7 ? "strong" : abs >= 0.4 ? "moderate" : abs >= 0.2 ? "weak" : "little";
  const cls = abs >= 0.4 ? (r > 0 ? "text-emerald-500" : "text-rose-500") : "text-muted-foreground";
  const label = r === 0 ? t("sleepCorr.none") : t(`sleepCorr.${strength}${r > 0 ? "Positive" : "Negative"}`);
  return { label, cls };
}

export function SleepCorrelation() {
  const { t } = useTranslation();
  const [data, setData] = useState(null);

  useEffect(() => {
    let active = true;
    apiV2.get("/team/sleep-correlation")
      .then((res) => active && setData(res.data))
      .catch((err) => toast.error(formatApiError(err?.response?.data?.detail)));
    return () => { active = false; };
  }, []);

  if (!data) {
    return (
      <div className="grid place-items-center py-10">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (data.sampleSize < 3) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card/50 p-8 text-center">
        <Moon className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
        <p className="font-bold">{t("sleepCorr.notEnoughTitle")}</p>
        <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
          {t("sleepCorr.notEnoughDesc")}
        </p>
      </div>
    );
  }

  const { label, cls } = interpret(data.correlation, t);
  const chartData = data.points.map((p) => ({ x: p.sleepHours, y: p.sleepQuality, name: p.player_name, date: p.date }));

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-bold">{t("sleepCorr.title")}</p>
            <p className="text-xs text-muted-foreground">{t("sleepCorr.sample", { count: data.sampleSize })}</p>
          </div>
          <div className="text-right">
            <p className="font-mono text-2xl font-extrabold">{data.correlation ?? "—"}</p>
            <p className={`text-xs font-semibold ${cls}`}>{label}</p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <p className="mb-4 text-sm font-bold">{t("sleepCorr.plotted")}</p>
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 4, right: 12, left: -12, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
              <XAxis type="number" dataKey="x" name={t("sleepCorr.hoursSlept")} domain={[0, 12]} tick={{ fontSize: 10 }} label={{ value: t("sleepCorr.hoursSlept"), position: "insideBottom", offset: -2, fontSize: 10 }} />
              <YAxis type="number" dataKey="y" name={t("sleepCorr.quality")} domain={[0, 5.5]} ticks={[1, 2, 3, 4, 5]} tick={{ fontSize: 10 }} />
              <ZAxis range={[40, 40]} />
              <Tooltip
                cursor={{ strokeDasharray: "3 3" }}
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
                formatter={(value, name) => [value, name === "x" ? t("sleepCorr.hours") : t("sleepCorr.quality")]}
                labelFormatter={() => ""}
              />
              <Scatter data={chartData} fill="hsl(160 84% 39%)" fillOpacity={0.7} />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <p className="mb-3 text-sm font-bold">{t("sleepCorr.avgByHours")}</p>
        <div className="space-y-2">
          {data.buckets.map((b) => (
            <div key={b.hours} className="flex items-center gap-3">
              <span className="w-14 shrink-0 font-mono text-xs text-muted-foreground">{t("sleepCorr.hoursUnit", { n: b.hours })}</span>
              <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-secondary">
                <div className="h-full rounded-full bg-primary" style={{ width: `${(b.avgQuality / 5) * 100}%` }} />
              </div>
              <span className="w-16 shrink-0 text-right font-mono text-xs">{b.avgQuality}/5</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
