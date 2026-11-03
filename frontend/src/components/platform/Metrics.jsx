import { useTranslation } from "react-i18next";
import { ArrowUp, ArrowDown, ArrowRight, Flag, CheckCircle2, Info, AlertTriangle, AlertCircle } from "lucide-react";

/** The two metric views, driven by the numbers backend/metrics.py computes.
 *  CoachMetrics  - 6 metrics (no GPS) or 7 (with GPS) + a hydration FLAG (not a score).
 *  AthleteMetrics - 4 plain items. */

const BORDER = { red: "border-l-rose-500", amber: "border-l-amber-500", green: "border-l-emerald-500" };
const DOT = { red: "bg-rose-500", amber: "bg-amber-500", green: "bg-emerald-500" };
const TEXT = { red: "text-rose-500", amber: "text-amber-500", green: "text-emerald-500" };
const n = (v, d = 0) => (v == null ? "–" : Number(v).toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d }));
const signed = (v, suffix = "") => (v == null ? "–" : `${v > 0 ? "+" : ""}${v}${suffix}`);

function Tile({ label, value, sub, sev, testid, children }) {
  return (
    <div className={`rounded-xl border border-border border-l-4 bg-card p-4 ${BORDER[sev] || "border-l-slate-400/60"}`} data-testid={testid}>
      <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="mt-1 flex items-center gap-2">
        <p className="font-mono text-2xl font-extrabold leading-tight">{value}</p>
        {children}
      </div>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

const ArrowIcon = ({ arrow, className = "h-5 w-5" }) =>
  arrow === "up" ? <ArrowUp className={`${className} text-emerald-500`} /> : arrow === "down" ? <ArrowDown className={`${className} text-rose-500`} /> : arrow === "flat" ? <ArrowRight className={`${className} text-muted-foreground`} /> : null;

const sevReadiness = (r) => (r.today == null ? null : r.today < 50 || (r.diff != null && r.diff <= -20) ? "red" : (r.diff != null && r.diff <= -10) || r.lowDays7 >= 3 ? "amber" : "green");
const sevSleep = (s) => (s.debt7 == null ? null : s.debt7 >= 10 ? "red" : s.debt7 >= 5 ? "amber" : "green");
const sevWow = (w) => (w == null ? null : w >= 50 ? "red" : w >= 30 || w <= -30 ? "amber" : "green");
const sevStrain = (r) => (r == null ? null : r >= 1.5 ? "red" : r >= 1.3 ? "amber" : "green");

export function CoachMetrics({ m }) {
  const { t } = useTranslation();
  const { readiness: r, sleep: s, load: l, gps: g, hydration: h } = m;
  const hours = (v) => (v == null ? "–" : t("metrics.hours", { n: n(v, 1) }));
  return (
    <div className="space-y-3" data-testid="coach-metrics">
      <div className="grid gap-3 sm:grid-cols-2">
        <Tile testid="metric-readiness" label={t("metrics.readiness")} value={n(r.today)} sev={sevReadiness(r)}
          sub={t("metrics.readinessSub", { avg: n(r.ownAvg), diff: signed(r.diff), low: r.lowDays7 })}><ArrowIcon arrow={r.arrow} /></Tile>
        <Tile testid="metric-sleep" label={t("metrics.sleep")} value={hours(s.avg7)} sev={sevSleep(s)}
          sub={t("metrics.sleepSub", { last: hours(s.lastNight), debt: hours(s.debt7) })} />
        <Tile testid="metric-wow" label={t("metrics.wow")} value={signed(l.wowPct, "%")} sev={sevWow(l.wowPct)}
          sub={t("metrics.wowSub", { week: n(l.week), prev: n(l.prevWeek) })} />
        <Tile testid="metric-acwr" label="ACWR" value={n(l.acwr, 2)} sev={l.acwrRisk}
          sub={l.acwr == null ? t("metrics.needTwoWeeks") : t("metrics.acwrSub", { chronic: n(l.chronic4wk) })} />
        <Tile testid="metric-monotony" label={t("metrics.monotony")} value={n(l.monotony, 2)} sev={l.monotonyRisk}
          sub={t("metrics.monotonySub", { strain: n(l.strain), days: l.daysLogged })} />
        {g ? (
          <>
            <Tile testid="metric-hsr" label={t("metrics.hsrAcwr")} value={n(g.hsrAcwr, 2)} sev={g.hsrAcwrRisk}
              sub={g.hsrAcwr == null ? t("metrics.needTwoWeeks") : t("metrics.hsrSub", { acute: n(g.hsrAcute), chronic: n(g.hsrChronic) })} />
            <Tile testid="metric-vmax" label={t("metrics.vmax")} value={g.vmaxPct == null ? "–" : `${g.vmaxPct}%`} sev={g.vmaxStatus}
              sub={g.vmaxPct == null ? t("metrics.vmaxBuilding") : t("metrics.vmaxSub", { peak: n(g.vmaxWeekPeak, 1), vmax: n(g.vmax, 1) })} />
          </>
        ) : (
          <Tile testid="metric-strain" label={t("metrics.strainVsUsual")} value={signed(l.strainVsUsualPct, "%")} sev={sevStrain(l.strainRatio)}
            sub={l.strainRatio == null ? t("metrics.needMoreWeeks") : t("metrics.strainSub", { strain: n(l.strain), usual: n(l.strainUsual) })} />
        )}
      </div>

      <div className={`flex items-start gap-2 rounded-xl border px-3 py-2 text-xs font-medium ${h.lowToday ? "border-rose-500/40 bg-rose-500/10 text-rose-600 dark:text-rose-400" : "border-border bg-card text-muted-foreground"}`} data-testid="hydration-flag">
        {h.lowToday ? <Flag className="mt-0.5 h-3.5 w-3.5 shrink-0" /> : <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
        <span>
          {h.today == null ? t("metrics.hydNone")
            : h.lowToday ? t("metrics.hydLow", { value: h.today, count: h.lowDays7 })
            : t("metrics.hydOk", { value: h.today, count: h.lowDays7 })}
        </span>
      </div>
      <p className="px-1 text-[11px] leading-relaxed text-muted-foreground">{t("metrics.footnote")}</p>
    </div>
  );
}

export function AthleteMetrics({ m }) {
  const { t } = useTranslation();
  const a = m.athleteView;
  const r = a.readiness;
  const avgText = r.arrow == null ? t("metrics.noAvg") : t(r.arrow === "up" ? "metrics.aboveAvg" : r.arrow === "down" ? "metrics.belowAvg" : "metrics.inLineAvg", { avg: r.ownAvg });
  const loadSev = { higher: "amber", normal: "green", lower: null }[a.load.label];
  return (
    <div className="grid gap-3 sm:grid-cols-2" data-testid="athlete-metrics">
      <Tile testid="a-readiness" label={t("metrics.readinessToday")} value={n(r.value)} sev={sevReadiness(m.readiness)} sub={r.value == null ? t("metrics.noCheckinToday") : avgText}>
        <ArrowIcon arrow={r.arrow} />
      </Tile>
      <Tile testid="a-sleep" label={t("metrics.sleepTitle")} value={a.sleep.lastNight == null ? "–" : t("metrics.hours", { n: n(a.sleep.lastNight, 1) })} sev={sevSleep(m.sleep)}
        sub={a.sleep.lastNight == null && a.sleep.avg7 == null ? t("metrics.noCheckinToday") : t("metrics.sleepAthleteSub", { avg: a.sleep.avg7 == null ? "–" : t("metrics.hours", { n: n(a.sleep.avg7, 1) }) })} />
      <Tile testid="a-hydration" label={t("metrics.hydrationToday")} value={a.hydration.dot ? t(`metrics.dot.${a.hydration.dot}`) : "–"} sev={a.hydration.dot}
        sub={a.hydration.value ? t("metrics.rated", { value: a.hydration.value }) : t("metrics.noCheckinToday")}>
        {a.hydration.dot && <span className={`h-4 w-4 rounded-full ${DOT[a.hydration.dot]}`} data-testid="hydration-dot" />}
      </Tile>
      <Tile testid="a-load" label={t("metrics.loadThisWeek")} value={a.load.label ? t(`metrics.load.${a.load.label}`) : "–"} sev={loadSev}
        sub={a.load.label ? t("metrics.vsUsual") : t("metrics.needMoreData")} />
    </div>
  );
}

const SEV_ICON = { red: AlertCircle, amber: AlertTriangle, green: CheckCircle2, info: Info };

export function InsightsList({ insights }) {
  const { t } = useTranslation();
  if (!insights?.length) return null;
  return (
    <div className="rounded-2xl border border-border bg-card p-5" data-testid="insights">
      <p className="mb-3 text-sm font-bold">{t("metrics.insightsTitle")}</p>
      <ul className="space-y-2">
        {insights.map((i, idx) => {
          const Icon = SEV_ICON[i.severity] || Info;
          const params = { ...i.params, ...(i.params?.area ? { area: t(`values.sorenessAreas.${i.params.area}`, { defaultValue: i.params.area }) } : {}) };
          return (
            <li key={`${i.code}-${idx}`} className="flex items-start gap-2 text-sm" data-testid={`insight-${i.code}`}>
              <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${TEXT[i.severity] || "text-muted-foreground"}`} />
              <span>{t(`insights.${i.code}`, params)}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
