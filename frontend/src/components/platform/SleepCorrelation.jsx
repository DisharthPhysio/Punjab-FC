import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Moon } from "lucide-react";
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ZAxis } from "recharts";
import apiV2, { formatApiError } from "@/lib/apiV2";

function interpret(r) {
  if (r == null) return { label: "Not enough data yet", cls: "text-muted-foreground" };
  const abs = Math.abs(r);
  const strength = abs >= 0.7 ? "Strong" : abs >= 0.4 ? "Moderate" : abs >= 0.2 ? "Weak" : "Little to no";
  const direction = r > 0 ? "positive" : r < 0 ? "negative" : "";
  const cls = abs >= 0.4 ? (r > 0 ? "text-emerald-500" : "text-rose-500") : "text-muted-foreground";
  const label = direction ? `${strength} ${direction} correlation` : "No correlation";
  return { label, cls };
}

export function SleepCorrelation() {
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
        <p className="font-bold">Not enough sleep data yet</p>
        <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
          Once players have logged a few days of hours + quality, the correlation shows up here.
        </p>
      </div>
    );
  }

  const { label, cls } = interpret(data.correlation);
  const chartData = data.points.map((p) => ({ x: p.sleepHours, y: p.sleepQuality, name: p.player_name, date: p.date }));

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-bold">Sleep hours vs. sleep quality</p>
            <p className="text-xs text-muted-foreground">{data.sampleSize} check-ins with both logged</p>
          </div>
          <div className="text-right">
            <p className="font-mono text-2xl font-extrabold">{data.correlation ?? "—"}</p>
            <p className={`text-xs font-semibold ${cls}`}>{label}</p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <p className="mb-4 text-sm font-bold">Every check-in, plotted</p>
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 4, right: 12, left: -12, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
              <XAxis type="number" dataKey="x" name="Sleep hours" domain={[0, 12]} tick={{ fontSize: 10 }} label={{ value: "Hours slept", position: "insideBottom", offset: -2, fontSize: 10 }} />
              <YAxis type="number" dataKey="y" name="Sleep quality" domain={[0, 5.5]} ticks={[1, 2, 3, 4, 5]} tick={{ fontSize: 10 }} />
              <ZAxis range={[40, 40]} />
              <Tooltip
                cursor={{ strokeDasharray: "3 3" }}
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
                formatter={(value, name) => [value, name === "x" ? "Hours" : "Quality"]}
                labelFormatter={() => ""}
              />
              <Scatter data={chartData} fill="hsl(160 84% 39%)" fillOpacity={0.7} />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <p className="mb-3 text-sm font-bold">Average quality by hours slept</p>
        <div className="space-y-2">
          {data.buckets.map((b) => (
            <div key={b.hours} className="flex items-center gap-3">
              <span className="w-14 shrink-0 font-mono text-xs text-muted-foreground">{b.hours}h</span>
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
