"""Stats + report endpoints against an in-memory MongoDB: scoping, ranges, PDF/Excel validity, coach vs athlete views."""
import io
import sys
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

import bcrypt
import httpx
import pytest
import pytest_asyncio
from fastapi import FastAPI
from mongomock_motor import AsyncMongoMockClient
from openpyxl import load_workbook

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import platform_routes as pr  # noqa: E402

pytestmark = pytest.mark.asyncio
_hash = lambda p: bcrypt.hashpw(p.encode(), bcrypt.gensalt()).decode()
_verify = lambda p, h: bcrypt.checkpw(p.encode(), h.encode())
H = lambda tok: {"Authorization": f"Bearer {tok}"}
NOW = datetime(2026, 10, 30, 9, 0, tzinfo=timezone.utc)
day = lambda a: (NOW - timedelta(days=a)).strftime("%Y-%m-%d")


def row(age, **kw):
    base = {"id": str(uuid.uuid4()), "date": day(age), "sleepHours": 7.5, "sleepQuality": 4, "hydration": 4, "motivation": 4, "sessionType": "Field / Pitch",
            "rpe": 6, "duration": 60, "load": 360, "sorenessSeverity": 0, "sorenessAreas": [], "feelingIll": False, "symptoms": []}
    base.update(kw)
    return base


@pytest_asyncio.fixture
async def env():
    db = AsyncMongoMockClient()[f"t_{uuid.uuid4().hex[:8]}"]
    pr.init(db=db, send_email=None, hash_password=_hash, verify_password=_verify, jwt_secret="x" * 40, jwt_algorithm="HS256",
            now_utc=lambda: NOW, today_str=lambda: NOW.strftime("%Y-%m-%d"))
    app = FastAPI()
    app.include_router(pr.platform_router)
    c = httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://t")
    reg = (await c.post("/api/v2/team/register", json={"team_name": "Punjab FC", "email": "c@x.com", "password": "secret1", "recovery_question": "first_pet", "recovery_answer": "Rex"})).json()
    admin, team = reg["token"], reg["team"]
    players = {}
    for n in ("Bobby", "Shaiza", "Zed"):
        players[n] = (await c.post("/api/v2/team/roster", json={"name": n}, headers=H(admin))).json()["id"]
    toks = {}
    for n in ("Bobby", "Shaiza"):                                      # Zed never joins
        toks[n] = (await c.post("/api/v2/team/select", json={"code": team["athlete_code"], "player_id": players[n]})).json()["token"]
    for n in ("Bobby", "Shaiza"):
        for a in range(45):
            await db.checkins_v2.insert_one({**row(a), "context": "team", "team_id": team["id"], "team_player_id": players[n], "player_name": n})
    for a in range(0, 45, 3):                                          # GPS for Bobby only
        await db.gps_sessions.insert_one({"id": str(uuid.uuid4()), "team_id": team["id"], "team_player_id": players["Bobby"], "date": day(a), "distance_m": 8000,
                                          "hsr_distance_m": 400, "sprints": 9, "max_speed_kmh": 31.0 if a > 5 else 30.5, "session_label": "Training", "source": "import"})
    yield db, c, admin, team, players, toks
    await c.aclose()


async def test_coach_player_detail_has_gps_metrics_only_when_the_player_has_gps(env):
    _, c, admin, _, pl, _ = env
    with_gps = (await c.get(f"/api/v2/team/player/{pl['Bobby']}", headers=H(admin))).json()
    no_gps = (await c.get(f"/api/v2/team/player/{pl['Shaiza']}", headers=H(admin))).json()
    assert with_gps["metrics"]["hasGps"] and with_gps["metrics"]["gps"]["hsrAcwr"] is not None and with_gps["metrics"]["gps"]["vmaxPct"] is not None
    assert no_gps["metrics"]["hasGps"] is False and no_gps["metrics"]["gps"] is None          # no GPS -> the 6-metric coach view
    assert isinstance(with_gps["insights"], list) and with_gps["insights"]


async def test_athlete_stats_for_team_and_individual_athletes(env):
    db, c, _, _, _, toks = env
    s = (await c.get("/api/v2/stats/team/mine", headers=H(toks["Bobby"]))).json()
    assert {"readiness", "sleep", "hydration", "load"} <= set(s["metrics"]["athleteView"])
    assert all(i["code"] in __import__("insights").ATHLETE_CODES for i in s["insights"])        # no coach jargon for athletes
    ind = (await c.post("/api/v2/athlete/signup", json={"name": "Indy", "email": "i@x.com", "password": "secret1", "recovery_question": "first_pet", "recovery_answer": "Rex"})).json()
    for a in range(20):
        await db.checkins_v2.insert_one({**row(a), "context": "individual", "athlete_id": ind["athlete"]["id"]})
    st = (await c.get("/api/v2/stats/mine", headers=H(ind["token"]))).json()
    assert st["metrics"]["athleteView"]["load"]["label"] in ("normal", "higher", "lower") and st["metrics"]["hasGps"] is False
    assert (await c.get("/api/v2/stats/mine", headers=H(toks["Bobby"]))).status_code == 401      # team athletes use their own route


async def test_exports_are_valid_files_for_every_range(env):
    _, c, admin, _, pl, toks = env
    for days in (None, 7, 14, 30):
        q = f"?days={days}" if days else ""
        for url in ("/api/v2/team/export/pdf", f"/api/v2/team/player/{pl['Bobby']}/export/pdf", f"/api/v2/team/player/{pl['Shaiza']}/export/pdf"):
            r = await c.get(url + q, headers=H(admin))
            assert r.status_code == 200 and r.content[:4] == b"%PDF" and r.headers["content-type"] == "application/pdf", (url, days, r.text[:200])
        r = await c.get("/api/v2/checkin/team/export/pdf" + q, headers=H(toks["Bobby"]))
        assert r.status_code == 200 and r.content[:4] == b"%PDF"
    assert (await c.get("/api/v2/team/export/pdf?days=5", headers=H(admin))).status_code == 400


async def test_excel_has_each_players_checkins_and_gps_for_the_period(env):
    _, c, admin, _, pl, _ = env
    wb = load_workbook(io.BytesIO((await c.get("/api/v2/team/export/excel?days=7", headers=H(admin))).content))
    assert wb.sheetnames == ["Summary", "Check-ins", "GPS", "Insights"]
    checkins = [r for r in wb["Check-ins"].iter_rows(min_row=2, values_only=True)]
    assert len(checkins) == 14 and {r[0] for r in checkins} == {"Bobby", "Shaiza"}               # 2 players x 7 days
    assert all(r[1] >= day(6) for r in checkins)                                                   # nothing outside the period
    gps = [r for r in wb["GPS"].iter_rows(min_row=2, values_only=True)]
    assert gps and {r[0] for r in gps} == {"Bobby"}
    summary = {r[0]: r for r in wb["Summary"].iter_rows(min_row=4, values_only=True)}
    assert summary["Zed"][1] == "Not joined" and summary["Bobby"][16] is not None                 # HSR ACWR present for the GPS player
    one = load_workbook(io.BytesIO((await c.get(f"/api/v2/team/player/{pl['Shaiza']}/export/excel", headers=H(admin))).content))
    assert {r[0] for r in one["Check-ins"].iter_rows(min_row=2, values_only=True)} == {"Shaiza"}
    assert one["GPS"].max_row == 1                                                                 # header only: no GPS for her


async def test_all_time_covers_the_full_history_but_7_days_does_not(env):
    _, c, admin, _, _, _ = env
    all_rows = load_workbook(io.BytesIO((await c.get("/api/v2/team/export/excel", headers=H(admin))).content))["Check-ins"].max_row - 1
    seven = load_workbook(io.BytesIO((await c.get("/api/v2/team/export/excel?days=7", headers=H(admin))).content))["Check-ins"].max_row - 1
    assert all_rows == 90 and seven == 14


async def test_unicode_player_names_dont_break_the_download_header(env):
    db, c, admin, team, _, _ = env
    pid = (await c.post("/api/v2/team/roster", json={"name": "अर्जुन शर्मा"}, headers=H(admin))).json()["id"]
    r = await c.get(f"/api/v2/team/player/{pid}/export/pdf", headers=H(admin))
    assert r.status_code == 200 and "filename*=UTF-8''" in r.headers["content-disposition"]


async def test_other_coaches_cannot_download_this_squad(env):
    _, c, admin, team, pl, toks = env
    other = (await c.post("/api/v2/team/register", json={"team_name": "Rivals", "email": "o@x.com", "password": "secret1", "recovery_question": "first_pet", "recovery_answer": "Rex"})).json()
    assert (await c.get(f"/api/v2/team/export/pdf?team_id={team['id']}", headers=H(other["token"]))).status_code == 403
    assert (await c.get(f"/api/v2/team/player/{pl['Bobby']}/export/pdf", headers=H(other["token"]))).status_code == 404
    assert (await c.get("/api/v2/team/export/pdf", headers=H(toks["Bobby"]))).status_code == 401   # a player is not a coach


async def test_insight_templates_match_the_english_locale():
    """The app translates insights from locale keys; the PDFs use backend templates. They must say the same thing."""
    import json
    import insights as I
    en = json.load(open(Path(__file__).resolve().parents[2] / "frontend/src/locales/en.json"))["insights"]
    for code, tpl in I.TEMPLATES.items():
        assert en.get(code) == tpl, f"locale insights.{code} differs from backend template"
