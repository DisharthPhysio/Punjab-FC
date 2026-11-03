"""
Turns metrics + raw check-in / GPS rows into short, plain-language findings.

Each finding is {code, severity, params}. The app translates `code` itself (locales: insights.<code>);
the PDF/Excel reports render the English TEMPLATES below. A test keeps the two in sync.

Severity: "red" (act), "amber" (watch), "green" (good news), "info" (context).
"""
from collections import Counter
from datetime import datetime, timedelta
from typing import List, Optional

import metrics as M

TEMPLATES = {
    "no_data": "Not enough check-ins yet to analyse trends.",
    "all_clear": "Nothing flagged: readiness, sleep and load look steady.",
    "readiness_low_today": "Readiness today ({{value}}) is {{diff}} points below the usual {{avg}}.",
    "readiness_low_days": "{{count}} of the last 7 days were low-readiness days.",
    "sleep_debt": "Sleep debt over the last 7 days is {{debt}} h (target {{target}} h a night).",
    "sleep_short": "Average sleep is {{avg}} h over the last 7 days, under the {{target}} h target.",
    "sleep_good": "Sleep is on target: {{avg}} h average over the last 7 days.",
    "hydration_low_today": "Hydration was rated low today ({{value}}/5): a prompt to check in and drink up.",
    "hydration_low_days": "Hydration was rated low on {{count}} of the last 7 days.",
    "acwr_high": "Load is ramping up quickly: ACWR {{acwr}} (this week {{week}} vs usual {{chronic}}).",
    "acwr_low": "Load is well below usual: ACWR {{acwr}} (this week {{week}} vs usual {{chronic}}).",
    "wow_spike": "Weekly load is up {{pct}}% on last week.",
    "monotony_high": "Training monotony is {{value}}: sessions are too similar from day to day.",
    "strain_high": "This week's strain is {{pct}}% above the usual of the previous 4 weeks.",
    "hsr_acwr_high": "High-speed running load is ramping up: HSR ACWR {{value}}.",
    "hsr_acwr_low": "High-speed running is well below usual (HSR ACWR {{value}}).",
    "vmax_low": "Top speed this week reached only {{pct}}% of Vmax; aim for 90%+ at least once a week.",
    "vmax_ok": "Top speed this week reached {{pct}}% of Vmax: good high-speed exposure.",
    "soreness_recurring": "{{area}} soreness has been reported {{count}} times in the last 14 days.",
    "illness_recent": "Illness was reported on {{count}} of the last 3 days.",
    "effort_vs_output": "Perceived effort is running higher than GPS output recently: a possible fatigue sign.",
    "load_matched": "Perceived effort (RPE) and GPS distance move together (r = {{r}}): internal and external load agree.",
    "compliance_low": "Only {{count}} of the last 7 days have a check-in.",
}

# What the athlete sees: no load-science jargon, nothing about other people's data.
ATHLETE_CODES = {
    "no_data", "all_clear", "readiness_low_today", "readiness_low_days", "sleep_debt", "sleep_short", "sleep_good",
    "hydration_low_today", "hydration_low_days", "wow_spike", "acwr_high", "soreness_recurring", "illness_recent",
    "compliance_low",
}

_SEV_ORDER = {"red": 0, "amber": 1, "info": 2, "green": 3}


def render(code: str, params: Optional[dict] = None) -> str:
    text = TEMPLATES.get(code, code)
    for k, v in (params or {}).items():
        text = text.replace("{{" + k + "}}", str(v))
    return text


def _lin_resid_last(pairs):
    """Least-squares load~distance; returns the mean residual (in SDs) of the most recent 3 pairs."""
    n = len(pairs)
    xs, ys = [p[1] for p in pairs], [p[2] for p in pairs]
    mx, my = sum(xs) / n, sum(ys) / n
    vx = sum((x - mx) ** 2 for x in xs)
    if vx <= 0:
        return None
    slope = sum((x - mx) * (y - my) for x, y in zip(xs, ys)) / vx
    icpt = my - slope * mx
    res = [y - (icpt + slope * x) for x, y in zip(xs, ys)]
    sd = (sum(r * r for r in res) / (n - 1)) ** 0.5 if n > 2 else 0
    if sd <= 0:
        return None
    recent = [r for (d, _, _), r in sorted(zip(pairs, res), key=lambda t: t[0][0])][-3:]
    return sum(recent) / len(recent) / sd


def build_insights(m: dict, checkins: List[dict], gps: Optional[List[dict]], today_str: str, audience: str = "coach") -> List[dict]:
    gps = gps or []
    out = []
    add = lambda code, sev, **params: out.append({"code": code, "severity": sev, "params": params})
    today = datetime.strptime(today_str, "%Y-%m-%d").date()
    ago = lambda n: (today - timedelta(days=n)).strftime("%Y-%m-%d")

    if m["daysLogged28"] < 3:
        add("no_data", "info")
        return out

    r, s, ld, hy, g = m["readiness"], m["sleep"], m["load"], m["hydration"], m["gps"]

    # readiness
    if r["diff"] is not None and r["diff"] <= -M.READINESS_LOW_DELTA:
        add("readiness_low_today", "red" if (r["today"] or 100) < M.READINESS_ALWAYS_LOW else "amber",
            value=r["today"], diff=abs(r["diff"]), avg=r["ownAvg"])
    if r["lowDays7"] >= 3:
        add("readiness_low_days", "red" if r["lowDays7"] >= 5 else "amber", count=r["lowDays7"])

    # sleep
    if s["debt7"] is not None and s["debt7"] >= 5:
        add("sleep_debt", "red" if s["debt7"] >= 10 else "amber", debt=s["debt7"], target=int(s["target"]))
    if s["avg7"] is not None and s["loggedDays7"] >= 3:
        if s["avg7"] < 7:
            add("sleep_short", "red" if s["avg7"] < 6 else "amber", avg=s["avg7"], target=int(s["target"]))
        elif s["avg7"] >= 7.5:
            add("sleep_good", "green", avg=s["avg7"])

    # hydration (a flag, not a score)
    if hy["lowToday"]:
        add("hydration_low_today", "amber", value=hy["today"])
    if hy["lowDays7"] >= 3:
        add("hydration_low_days", "amber", count=hy["lowDays7"])

    # load
    if ld["acwr"] is not None:
        if ld["acwr"] >= 1.3:
            add("acwr_high", "red" if ld["acwr"] > 1.5 else "amber", acwr=ld["acwr"], week=ld["week"], chronic=ld["chronic4wk"])
        elif ld["acwr"] < 0.8:
            add("acwr_low", "info", acwr=ld["acwr"], week=ld["week"], chronic=ld["chronic4wk"])
    if ld["wowPct"] is not None and ld["wowPct"] >= 30 and ld["prevWeek"] > 0:
        add("wow_spike", "amber", pct=ld["wowPct"])
    if ld["monotony"] is not None and ld["monotony"] >= M.MONOTONY_WATCH and ld["daysLogged"] >= 4:
        add("monotony_high", "red" if ld["monotony"] >= M.MONOTONY_HIGH else "amber", value=ld["monotony"])
    if ld["strainRatio"] is not None and ld["strainRatio"] >= 1.3:
        add("strain_high", "red" if ld["strainRatio"] >= 1.5 else "amber", pct=ld["strainVsUsualPct"])

    # GPS
    if g:
        if g["hsrAcwr"] is not None:
            if g["hsrAcwr"] >= 1.3:
                add("hsr_acwr_high", "red" if g["hsrAcwr"] > 1.5 else "amber", value=g["hsrAcwr"])
            elif g["hsrAcwr"] < 0.8:
                add("hsr_acwr_low", "info", value=g["hsrAcwr"])
        if g["vmaxPct"] is not None:
            if g["vmaxPct"] < M.VMAX_TARGET_PCT:
                add("vmax_low", "red" if g["vmaxPct"] < 80 else "amber", pct=g["vmaxPct"])
            else:
                add("vmax_ok", "green", pct=g["vmaxPct"])
        # does perceived effort still track what the GPS says the player actually did?
        loads = {c["date"]: c.get("load") for c in checkins if c.get("load")}
        pairs = []
        for gs in gps:
            if gs.get("distance_m") and loads.get(gs["date"]):
                pairs.append((gs["date"], gs["distance_m"], loads[gs["date"]]))
        if len(pairs) >= 6:
            z = _lin_resid_last(pairs)
            rr = M.pearson_r([p[1] for p in pairs], [p[2] for p in pairs])
            if z is not None and z >= 1.0:
                add("effort_vs_output", "amber")
            elif rr is not None and rr >= 0.6 and len(pairs) >= 8:
                add("load_matched", "info", r=rr)

    # soreness / illness
    areas = Counter()
    ill_days = 0
    for c in checkins:
        if c["date"] >= ago(13) and (c.get("sorenessSeverity") or 0) > 0:
            areas.update(c.get("sorenessAreas") or [])
        if c["date"] >= ago(2) and c.get("feelingIll"):
            ill_days += 1
    if areas:
        area, cnt = areas.most_common(1)[0]
        if cnt >= 3:
            add("soreness_recurring", "amber", area=area, count=cnt)
    if ill_days:
        add("illness_recent", "red" if ill_days >= 2 else "amber", count=ill_days)

    # compliance
    logged7 = sum(1 for a in range(7) if any(c["date"] == ago(a) for c in checkins))
    if logged7 < 4:
        add("compliance_low", "red" if logged7 < 2 else "amber", count=logged7)

    if not any(i["severity"] in ("red", "amber") for i in out):
        add("all_clear", "green")

    if audience == "athlete":
        out = [i for i in out if i["code"] in ATHLETE_CODES]
    out.sort(key=lambda i: _SEV_ORDER.get(i["severity"], 9))
    return out
