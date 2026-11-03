"""Hand-checked numbers for the metrics + insights engines (no database needed)."""
import sys
from datetime import datetime, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import insights as I  # noqa: E402
import metrics as M  # noqa: E402

TODAY = "2026-10-30"


def day(age):
    return (datetime.strptime(TODAY, "%Y-%m-%d") - timedelta(days=age)).strftime("%Y-%m-%d")


def ci(age, load=400, sleep=8.0, sq=4, hyd=4, mot=4, sore=0, **kw):
    return {"date": day(age), "load": load, "sleepHours": sleep, "sleepQuality": sq, "hydration": hyd,
            "motivation": mot, "sorenessSeverity": sore, **kw}


def steady(days=42, **kw):
    return [ci(a, **kw) for a in range(days)]


def test_steady_athlete_is_all_normal():
    m = M.build_metrics(steady(), [], TODAY)
    assert m["hasGps"] is False and m["gps"] is None
    assert m["load"]["wowPct"] == 0 and m["load"]["acwr"] == 1.0 and m["load"]["acwrRisk"] == "green"
    assert m["load"]["chronic4wk"] == 2800          # 7 days x 400
    assert m["athleteView"]["load"]["label"] == "normal"
    assert m["readiness"]["diff"] == 0 and m["readiness"]["arrow"] == "flat" and m["readiness"]["lowDays7"] == 0
    assert m["sleep"] == {**m["sleep"], "avg7": 8.0, "debt7": 0.0, "lastNight": 8.0}


def test_readiness_vs_own_average_and_low_days():
    rows = steady()
    rows[0] = ci(0, sq=2, hyd=2, mot=2, sore=3)                 # a bad day today
    rows[1] = ci(1, sq=2, hyd=2, mot=2, sore=3)                 # and yesterday
    m = M.build_metrics(rows, [], TODAY)
    base = M.readiness_score(ci(5))
    assert m["readiness"]["ownAvg"] is not None and m["readiness"]["ownAvg"] < base + 1
    assert m["readiness"]["today"] < m["readiness"]["ownAvg"] - 10
    assert m["readiness"]["arrow"] == "down"
    assert m["readiness"]["lowDays7"] == 2


def test_sleep_average_and_debt():
    rows = steady(sleep=8.0)
    for a, h in zip(range(7), [5, 6, 7, 8, 9, 6, 7]):          # last 7 nights
        rows[a]["sleepHours"] = h
    m = M.build_metrics(rows, [], TODAY)
    assert m["sleep"]["lastNight"] == 5 and m["sleep"]["avg7"] == 6.9
    assert m["sleep"]["debt7"] == 9.0                           # 3+2+1+0+0+2+1  (9h over target is not credit)


def test_week_on_week_acwr_and_load_label():
    rows = steady(load=300)
    for a in range(7):
        rows[a]["load"] = 600                                   # this week doubled
    m = M.build_metrics(rows, [], TODAY)
    assert m["load"]["wowPct"] == 100
    assert m["load"]["chronic4wk"] == round((4200 + 3 * 2100) / 4)      # 4-week chronic = mean weekly load
    assert m["load"]["acwr"] == round(4200 / ((4200 + 3 * 2100) / 4), 2)
    assert m["athleteView"]["load"]["label"] == "higher"


def test_acwr_needs_two_weeks_of_history():
    m = M.build_metrics(steady(days=8, load=500), [], TODAY)
    assert m["load"]["acwr"] is None                            # 8 days is not enough to call a ratio
    assert m["athleteView"]["load"]["basis"] == "wow"


def test_strain_vs_usual():
    rows = []
    for a in range(35):
        w = a // 7
        # same repetitive pattern every week, but this week is heavier -> strain climbs vs the usual
        rows.append(ci(a, load=(700 if a % 2 == 0 else 500) if w == 0 else (500 if a % 2 == 0 else 300)))
    m = M.build_metrics(rows, [], TODAY)
    assert m["load"]["strain"] and m["load"]["strainUsual"]
    assert m["load"]["strainRatio"] > 1.3
    assert any(i["code"] == "strain_high" for i in I.build_insights(m, rows, [], TODAY))


def test_hydration_is_a_flag():
    rows = steady()
    rows[0]["hydration"] = 2
    m = M.build_metrics(rows, [], TODAY)
    assert m["hydration"]["lowToday"] is True and m["hydration"]["dot"] == "red"
    rows[0]["hydration"] = 3
    assert M.build_metrics(rows, [], TODAY)["hydration"]["dot"] == "amber"
    rows[0]["hydration"] = 5
    assert M.build_metrics(rows, [], TODAY)["hydration"]["dot"] == "green"


def gps_rows():
    out = []
    for a in range(0, 42, 3):
        out.append({"date": day(a), "distance_m": 8000, "hsr_distance_m": 400, "sprints": 8,
                    "max_speed_kmh": 32.0 if a > 7 else 27.0})
    return out


def test_gps_hsr_acwr_and_vmax_exposure():
    m = M.build_metrics(steady(), gps_rows(), TODAY)
    assert m["hasGps"] is True
    g = m["gps"]
    assert g["vmax"] == 32.0 and g["vmaxWeekPeak"] == 27.0 and g["vmaxPct"] == 84 and g["vmaxStatus"] == "amber"
    assert g["hsrAcwr"] is not None and 0.8 <= g["hsrAcwr"] <= 1.5
    codes = {i["code"] for i in I.build_insights(m, steady(), gps_rows(), TODAY)}
    assert "vmax_low" in codes


def test_vmax_needs_a_baseline():
    m = M.build_metrics(steady(), [{"date": day(1), "max_speed_kmh": 30, "hsr_distance_m": 300}], TODAY)
    assert m["gps"]["vmaxPct"] is None                         # one session is not a Vmax baseline


def test_insights_athlete_view_hides_coach_jargon_and_templates_render():
    rows = steady()
    rows[0].update(feelingIll=True)
    m = M.build_metrics(rows, gps_rows(), TODAY)
    coach = {i["code"] for i in I.build_insights(m, rows, gps_rows(), TODAY, "coach")}
    athlete = {i["code"] for i in I.build_insights(m, rows, gps_rows(), TODAY, "athlete")}
    assert athlete <= I.ATHLETE_CODES and "illness_recent" in athlete
    assert "vmax_low" in coach and "vmax_low" not in athlete
    assert I.render("sleep_debt", {"debt": 6.5, "target": 8}) == "Sleep debt over the last 7 days is 6.5 h (target 8 h a night)."


def test_not_enough_data():
    m = M.build_metrics(steady(days=2), [], TODAY)
    assert [i["code"] for i in I.build_insights(m, steady(days=2), [], TODAY)] == ["no_data"]


def test_every_template_param_is_supplied_by_the_engine():
    """Run a rich scenario and make sure no {{placeholder}} is left unfilled."""
    rows = steady()
    for a in range(0, 7):
        rows[a].update(sleep=5.0, sleepHours=5.0, hydration=2, sorenessSeverity=3, sorenessAreas=["Hamstrings"], feelingIll=(a < 2))
        rows[a]["load"] = 900 if a % 2 == 0 else 100
    m = M.build_metrics(rows, gps_rows(), TODAY)
    for ins in I.build_insights(m, rows, gps_rows(), TODAY):
        assert "{{" not in I.render(ins["code"], ins["params"]), ins
