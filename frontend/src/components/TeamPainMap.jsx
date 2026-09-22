import { useEffect, useRef, useState } from "react";
import { Flame } from "lucide-react";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";

// Which drawn shapes belong to which tracked body area. Front and back views of a simple figure.
const FRONT = [
  { area: "Shoulders", x: 20, y: 32, w: 24, h: 13, rx: 6 },
  { area: "Shoulders", x: 56, y: 32, w: 24, h: 13, rx: 6 },
  { area: "Groin", ellipse: true, cx: 50, cy: 103, rx: 12, ry: 8 },
  { area: "Quadriceps", x: 32, y: 112, w: 17, h: 52, rx: 8 },
  { area: "Quadriceps", x: 51, y: 112, w: 17, h: 52, rx: 8 },
];
const BACK = [
  { area: "Upper Back / Neck", x: 35, y: 22, w: 30, h: 26, rx: 9 },
  { area: "Shoulders", x: 20, y: 32, w: 24, h: 13, rx: 6 },
  { area: "Shoulders", x: 56, y: 32, w: 24, h: 13, rx: 6 },
  { area: "Lower Back", x: 37, y: 64, w: 26, h: 22, rx: 7 },
  { area: "Gluteus", ellipse: true, cx: 41, cy: 104, rx: 10, ry: 11 },
  { area: "Gluteus", ellipse: true, cx: 59, cy: 104, rx: 10, ry: 11 },
  { area: "Hamstrings", x: 32, y: 117, w: 17, h: 48, rx: 8 },
  { area: "Hamstrings", x: 51, y: 117, w: 17, h: 48, rx: 8 },
  { area: "Calves", x: 33, y: 170, w: 14, h: 46, rx: 7 },
  { area: "Calves", x: 53, y: 170, w: 14, h: 46, rx: 7 },
];
const DRAWN_AREAS = new Set([...FRONT, ...BACK].map((s) => s.area));

const NEUTRAL = "hsl(var(--muted-foreground) / 0.18)";
const heat = (count, max) => (count > 0 && max > 0 ? `hsl(0 84% 55% / ${(0.28 + 0.62 * (count / max)).toFixed(2)})` : NEUTRAL);
const slug = (s) => s.replace(/[^a-z0-9]+/gi, "-").toLowerCase();

function Figure({ title, shapes, byArea, max, leftLabel, rightLabel, testId }) {
  const silhouette = { fill: "hsl(var(--muted-foreground) / 0.10)", stroke: "hsl(var(--border))", strokeWidth: 0.8 };
  return (
    <figure className="w-36 shrink-0 sm:w-40" data-testid={testId}>
      <svg viewBox="0 0 100 232" role="img" aria-label={`${title} view of the body, shaded by number of athletes with soreness`} className="h-auto w-full">
        <circle cx="50" cy="13" r="10" style={silhouette} />
        <rect x="45" y="22" width="10" height="9" rx="3" style={silhouette} />
        <rect x="30" y="32" width="40" height="66" rx="10" style={silhouette} />
        <rect x="13" y="36" width="10" height="66" rx="5" style={silhouette} />
        <rect x="77" y="36" width="10" height="66" rx="5" style={silhouette} />
        <rect x="31" y="108" width="18" height="58" rx="9" style={silhouette} />
        <rect x="51" y="108" width="18" height="58" rx="9" style={silhouette} />
        <rect x="33" y="168" width="14" height="50" rx="7" style={silhouette} />
        <rect x="53" y="168" width="14" height="50" rx="7" style={silhouette} />
        {shapes.map((s, i) => {
          const info = byArea[s.area];
          const count = info ? info.athletes : 0;
          const tip = count > 0
            ? `${s.area}: ${count} ${count === 1 ? "athlete" : "athletes"} · average ${info.avgSeverity}/5 · highest ${info.maxSeverity}/5`
            : `${s.area}: none reported`;
          const common = {
            style: { fill: heat(count, max), stroke: "hsl(var(--border))", strokeWidth: 0.6 },
            "data-testid": `painmap-shape-${slug(s.area)}`, "data-area": s.area, "data-count": count,
          };
          return s.ellipse
            ? <ellipse key={`${s.area}-${i}`} cx={s.cx} cy={s.cy} rx={s.rx} ry={s.ry} {...common}><title>{tip}</title></ellipse>
            : <rect key={`${s.area}-${i}`} x={s.x} y={s.y} width={s.w} height={s.h} rx={s.rx} {...common}><title>{tip}</title></rect>;
        })}
        <text x="4" y="229" fontSize="8" className="fill-muted-foreground" fontWeight="700">{leftLabel}</text>
        <text x="96" y="229" fontSize="8" textAnchor="end" className="fill-muted-foreground" fontWeight="700">{rightLabel}</text>
      </svg>
      <figcaption className="mt-1 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</figcaption>
    </figure>
  );
}

const sideInitial = { Right: "R", Left: "L", Both: "R+L" };

export function TeamPainMap({ date, isToday, refreshKey }) {
  const [days, setDays] = useState(1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const reqId = useRef(0);

  useEffect(() => {
    const id = ++reqId.current;
    setLoading(true);
    api.get("/heatmap", { params: { days, ...(date ? { date } : {}) } })
      .then((res) => { if (id === reqId.current) { setData(res.data); setFailed(false); } })
      .catch(() => { if (id === reqId.current) setFailed(true); })
      .finally(() => { if (id === reqId.current) setLoading(false); });
  }, [days, date, refreshKey]);

  const windows = [
    { days: 1, label: isToday ? "Today" : "Selected day" },
    { days: 7, label: "Last 7 days" },
    { days: 14, label: "Last 14 days" },
  ];
  const areas = data?.areas || [];
  const byArea = Object.fromEntries(areas.map((a) => [a.area, a]));
  const max = Math.max(0, ...areas.filter((a) => DRAWN_AREAS.has(a.area)).map((a) => a.athletes));
  const affected = areas.filter((a) => a.athletes > 0);

  return (
    <section className="rounded-2xl border border-border bg-card p-5" data-testid="team-pain-map">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-lg font-bold"><Flame className="h-5 w-5 text-rose-500" /> Team Pain Map</h3>
          <p className="text-xs text-muted-foreground" data-testid="painmap-summary">
            {data
              ? `${data.athletesWithSoreness} of ${data.athletesChecked} athletes who checked in reported soreness${data.days > 1 ? ` (${data.start} to ${data.end})` : ` (${data.end})`}`
              : failed ? "Couldn't load the pain map." : "Loading…"}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Time window">
          {windows.map((w) => (
            <Button
              key={w.days} size="sm" variant={days === w.days ? "default" : "outline"} className="h-8"
              aria-pressed={days === w.days} onClick={() => setDays(w.days)} data-testid={`painmap-window-${w.days}`}
            >
              {w.label}
            </Button>
          ))}
        </div>
      </div>

      <div className={`mt-4 flex flex-wrap items-start gap-6 transition-opacity ${loading ? "opacity-60" : ""}`}>
        <div className="flex gap-3">
          <Figure title="Front" shapes={FRONT} byArea={byArea} max={max} leftLabel="R" rightLabel="L" testId="painmap-front" />
          <Figure title="Back" shapes={BACK} byArea={byArea} max={max} leftLabel="L" rightLabel="R" testId="painmap-back" />
        </div>

        <div className="min-w-[240px] flex-1">
          {affected.length === 0 ? (
            <p className="rounded-xl bg-secondary/40 px-4 py-6 text-center text-sm text-muted-foreground" data-testid="painmap-empty">
              No soreness reported in this period. 🎉
            </p>
          ) : (
            <ul className="space-y-2" data-testid="painmap-list">
              {affected.map((a) => (
                <li key={a.area} className="rounded-xl border border-border px-3 py-2" data-testid={`painmap-row-${slug(a.area)}`}>
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <span className="font-semibold">{a.area}</span>
                    <span className="text-xs text-muted-foreground">
                      <span className="font-mono font-bold text-foreground">{a.athletes}</span> {a.athletes === 1 ? "athlete" : "athletes"} · avg {a.avgSeverity}/5 · max {a.maxSeverity}/5
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {[a.right && `R ${a.right}`, a.left && `L ${a.left}`, a.both && `Both ${a.both}`, a.unspecified && `side not given ${a.unspecified}`].filter(Boolean).join(" · ")}
                  </p>
                  <p className="mt-0.5 text-xs">
                    {a.names.map((n, i) => (
                      <span key={n.name}>{i > 0 && ", "}{n.name} <span className="text-muted-foreground">{n.severity}{n.side ? ` (${sideInitial[n.side] || n.side})` : ""}</span></span>
                    ))}
                  </p>
                  {!DRAWN_AREAS.has(a.area) && (
                    <p className="mt-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">Older area name - not drawn on the figure</p>
                  )}
                </li>
              ))}
            </ul>
          )}
          <div className="mt-3 flex items-center gap-2 text-[11px] text-muted-foreground" aria-hidden="true">
            <span>Fewer</span>
            <span className="h-2 w-24 rounded-full" style={{ background: "linear-gradient(to right, hsl(0 84% 55% / 0.28), hsl(0 84% 55% / 0.9))" }} />
            <span>{max > 0 ? `${max} ${max === 1 ? "athlete" : "athletes"}` : "More"}</span>
            <span className="ml-2">· R / L = the athlete's right / left side</span>
          </div>
        </div>
      </div>
    </section>
  );
}
