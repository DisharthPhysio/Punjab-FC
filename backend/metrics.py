"""
Load / wellness metrics shared by the app screens and the PDF/Excel reports.

Pure functions (rows in, dict out) so they can be unit-tested without a database.

Two audiences, one calculation
  * coaching staff  - 6 metrics (no GPS) or 7 (with GPS) + a simple hydration flag
  * the athlete     - 4 plain items: readiness, sleep, hydration dot, "this week vs usual"

"Week" always means the rolling 7 days ending today (day 0 = today, week 1 = days 7-13 ...),
so the numbers are comparable from one day to the next instead of jumping every Monday.
"""
import statistics
from datetime import datetime, timedelta
from typing import Dict, List, Optional

# ---- tunables (documented in one place on purpose) ----
SLEEP_TARGET_H = 8.0            # sleep debt = sum of shortfall against this, over the last 7 days
READINESS_LOW_DELTA = 10        # a "low day" is more than this many points under the player's own average...
READINESS_LOW_FLOOR = 60        # ...or under this when there is not yet enough history for an own-average
READINESS_ALWAYS_LOW = 50       # below this is low whatever the player's average is
HYDRATION_LOW = 2               # a day rated <= 2 on the 1-5 scale is flagged
ACWR_MIN_HISTORY_DAYS = 14      # ratios need at least two weeks of data behind them to mean anything
MONOTONY_WATCH = 1.5
MONOTONY_HIGH = 2.0
VMAX_MIN_SESSIONS = 3           # Vmax baseline needs a few sessions with a recorded top speed
VMAX_TARGET_PCT = 90            # weekly top speed should reach 90%+ of the player's Vmax at least once


# --------------------------------------------------------------------------- shared maths
def change_pct(current, previous):
    return int(round((current - previous) / previous * 100)) if previous and previous > 0 else None


def pearson_r(xs: List[float], ys: List[float]) -> Optional[float]:
    n = len(xs)
    if n < 3:
        return None
    mx, my = sum(xs) / n, sum(ys) / n
    cov = sum((x - mx) * (y - my) for x, y in zip(xs, ys))
    vx = sum((x - mx) ** 2 for x in xs)
    vy = sum((y - my) ** 2 for y in ys)
    if vx <= 0 or vy <= 0:
        return None
    return round(cov / ((vx ** 0.5) * (vy ** 0.5)), 2)


def week_stats(daily_loads: List[int]) -> dict:
    """Foster (1998): monotony = mean daily load / SD of daily load, strain = weekly load x monotony."""
    total = sum(daily_loads)
    out = {"load": total, "daysLogged": sum(1 for x in daily_loads if x > 0),
           "monotony": None, "strain": None, "monotonyRisk": None}
    if total <= 0 or len(daily_loads) < 2:
        return out
    sd = statistics.stdev(daily_loads)
    if sd == 0:
        return out
    mono_raw = (total / len(daily_loads)) / sd
    mono = round(mono_raw, 2)
    out["monotony"] = mono
    out["strain"] = int(round(total * mono_raw))
    out["monotonyRisk"] = "red" if mono >= MONOTONY_HIGH else ("amber" if mono >= MONOTONY_WATCH else "green")
    return out


def readiness_score(c: Optional[dict]) -> Optional[int]:
    if not c:
        return None
    sleep_q, hyd, mot = c.get("sleepQuality"), c.get("hydration"), c.get("motivation")
    if not sleep_q or not hyd or not mot:
        return None
    soreness = c.get("sorenessSeverity") or 0
    score = 100 * (0.30 * sleep_q / 5 + 0.25 * hyd / 5 + 0.25 * mot / 5 + 0.20 * (5 - soreness) / 5)
    if c.get("feelingIll"):
        score -= 20
    return max(0, min(100, round(score)))


def ratio_risk(value: Optional[float]) -> Optional[str]:
    """Shared by ACWR and HSR-ACWR: 0.8-1.3 is the usual 'sweet spot'."""
    if value is None:
        return None
    return "red" if value > 1.5 else ("amber" if (value >= 1.3 or value < 0.8) else "green")


def _day(s: str):
    return datetime.strptime(s, "%Y-%m-%d").date()


def _mean(xs):
    xs = [x for x in xs if x is not None]
    return sum(xs) / len(xs) if xs else None


def hydration_dot(h: Optional[int]) -> Optional[str]:
    if not h:
        return None
    return "green" if h >= 4 else ("amber" if h == 3 else "red")


# --------------------------------------------------------------------------- the main entry point
def build_metrics(checkins: List[dict], gps: Optional[List[dict]], today_str: str) -> dict:
    """checkins: this person's check-in rows (at least the last ~42 days); gps: their GPS sessions (any
    history; may be empty). Everything is as of `today_str`."""
    gps = gps or []
    today = _day(today_str)
    by_date = {r["date"]: r for r in checkins if r.get("date")}

    def dstr(age: int) -> str:
        return (today - timedelta(days=age)).strftime("%Y-%m-%d")

    row = lambda age: by_date.get(dstr(age))
    load_at = lambda age: ((row(age) or {}).get("load") or 0)
    loads = [load_at(a) for a in range(42)]                     # index = age in days, 0 = today
    wk = lambda w: loads[7 * w: 7 * w + 7]                      # rolling week w (0 = this week)

    first_date = min(by_date) if by_date else None
    history_days = ((today - _day(first_date)).days + 1) if first_date else 0
    enough_history = history_days >= ACWR_MIN_HISTORY_DAYS

    # ---- readiness: today vs own average, and low days in the last 7
    r_by_age = [readiness_score(row(a)) for a in range(28)]
    readiness_today = r_by_age[0]
    own_vals = [r for r in r_by_age[1:] if r is not None]
    own_avg = round(sum(own_vals) / len(own_vals)) if len(own_vals) >= 3 else None
    diff = (readiness_today - own_avg) if (readiness_today is not None and own_avg is not None) else None

    def is_low(r):
        if r is None:
            return False
        if r < READINESS_ALWAYS_LOW:
            return True
        return (r <= own_avg - READINESS_LOW_DELTA) if own_avg is not None else (r < READINESS_LOW_FLOOR)

    last7_r = r_by_age[:7]
    readiness = {
        "today": readiness_today, "ownAvg": own_avg, "diff": diff,
        "arrow": None if diff is None else ("up" if diff >= 3 else ("down" if diff <= -3 else "flat")),
        "lowDays7": sum(1 for r in last7_r if is_low(r)),
        "loggedDays7": sum(1 for r in last7_r if r is not None),
    }

    # ---- sleep: last night + 7-day average + debt against the target
    sleep_h = [(row(a) or {}).get("sleepHours") for a in range(7)]
    logged_sleep = [h for h in sleep_h if h is not None]
    sleep = {
        "lastNight": sleep_h[0], "avg7": round(sum(logged_sleep) / len(logged_sleep), 1) if logged_sleep else None,
        "debt7": round(sum(max(0.0, SLEEP_TARGET_H - h) for h in logged_sleep), 1) if logged_sleep else None,
        "loggedDays7": len(logged_sleep), "target": SLEEP_TARGET_H,
        "lastNightQuality": (row(0) or {}).get("sleepQuality"),
    }

    # ---- load: week-on-week %, ACWR with the 4-week chronic load, monotony, strain vs usual
    this_w, prev_w = week_stats(wk(0)), week_stats(wk(1))
    chronic_weekly = sum(loads[:28]) / 4
    acwr = round(this_w["load"] / chronic_weekly, 2) if (chronic_weekly > 0 and enough_history) else None
    weekly = [week_stats(wk(w)) for w in range(5)]               # weeks 0..4 (needs 35 days)
    prior = [w["strain"] for w in weekly[1:] if w["strain"] is not None and w["daysLogged"] >= 3]
    usual_strain = round(sum(prior) / len(prior)) if len(prior) >= 2 else None
    strain_ratio = round(this_w["strain"] / usual_strain, 2) if (this_w["strain"] and usual_strain) else None
    load = {
        "week": this_w["load"], "prevWeek": prev_w["load"], "wowPct": change_pct(this_w["load"], prev_w["load"]),
        "chronic4wk": round(chronic_weekly), "acwr": acwr, "acwrRisk": ratio_risk(acwr),
        "monotony": this_w["monotony"], "monotonyRisk": this_w["monotonyRisk"],
        "strain": this_w["strain"], "strainUsual": usual_strain, "strainRatio": strain_ratio,
        "strainVsUsualPct": None if strain_ratio is None else int(round((strain_ratio - 1) * 100)),
        "daysLogged": this_w["daysLogged"],
    }

    # ---- hydration: a simple flag (<= 2 on the 1-5 scale), not a score
    hyd = [(row(a) or {}).get("hydration") for a in range(7)]
    hydration = {
        "today": hyd[0], "dot": hydration_dot(hyd[0]),
        "lowToday": bool(hyd[0] and hyd[0] <= HYDRATION_LOW),
        "lowDays7": sum(1 for h in hyd if h and h <= HYDRATION_LOW),
    }

    # ---- GPS: HSR ACWR + % of Vmax exposure
    gps_dates = sorted(g["date"] for g in gps if g.get("date"))
    has_gps = any(d >= dstr(27) for d in gps_dates)
    gps_block = None
    if has_gps:
        hsr_at = lambda age: sum((g.get("hsr_distance_m") or 0) for g in gps if g.get("date") == dstr(age))
        hsr_acute = sum(hsr_at(a) for a in range(7))
        hsr_chronic = sum(hsr_at(a) for a in range(28)) / 4
        gps_history = (today - _day(gps_dates[0])).days + 1
        hsr_acwr = round(hsr_acute / hsr_chronic, 2) if (hsr_chronic > 0 and gps_history >= ACWR_MIN_HISTORY_DAYS) else None

        speeds = [(g["date"], g["max_speed_kmh"]) for g in gps if g.get("max_speed_kmh")]
        vmax = max((s for _, s in speeds), default=None)
        reliable = len(speeds) >= VMAX_MIN_SESSIONS and vmax

        def week_peak(w):
            lo, hi = dstr(7 * w + 6), dstr(7 * w)
            vals = [s for d, s in speeds if lo <= d <= hi]
            return max(vals) if vals else None

        peaks = [week_peak(w) for w in range(6)]
        pct = lambda p: int(round(p / vmax * 100)) if (p and reliable) else None
        vmax_pct = pct(peaks[0])
        gps_block = {
            "hsrAcwr": hsr_acwr, "hsrAcwrRisk": ratio_risk(hsr_acwr), "hsrAcute": int(round(hsr_acute)), "hsrChronic": int(round(hsr_chronic)),
            "vmax": round(vmax, 1) if vmax else None, "vmaxSessions": len(speeds),
            "vmaxWeekPeak": round(peaks[0], 1) if peaks[0] else None, "vmaxPct": vmax_pct,
            "vmaxStatus": None if vmax_pct is None else ("green" if vmax_pct >= VMAX_TARGET_PCT else ("amber" if vmax_pct >= 80 else "red")),
            "vmaxWeekly": [pct(p) for p in reversed(peaks)],       # oldest -> newest, for a small trend chart
            "sessions28": sum(1 for d in gps_dates if d >= dstr(27)),
        }

    # ---- athlete view: 4 plain items
    if enough_history and acwr is not None:
        label, basis = ("higher" if acwr > 1.3 else ("lower" if acwr < 0.8 else "normal")), "acwr"
    elif load["wowPct"] is not None and prev_w["load"] > 0:
        label, basis = ("higher" if load["wowPct"] >= 20 else ("lower" if load["wowPct"] <= -20 else "normal")), "wow"
    else:
        label, basis = None, None
    athlete_view = {
        "readiness": {"value": readiness_today, "ownAvg": own_avg, "diff": diff, "arrow": readiness["arrow"]},
        "sleep": {"lastNight": sleep["lastNight"], "avg7": sleep["avg7"]},
        "hydration": {"value": hydration["today"], "dot": hydration["dot"]},
        "load": {"label": label, "basis": basis, "wowPct": load["wowPct"], "acwr": acwr},
    }

    return {
        "asOf": today_str, "hasGps": has_gps, "historyDays": history_days,
        "checkedInToday": row(0) is not None, "daysLogged28": sum(1 for a in range(28) if row(a)),
        "readiness": readiness, "sleep": sleep, "load": load, "hydration": hydration,
        "gps": gps_block, "athleteView": athlete_view,
    }
