"""Offline tests (in-memory MongoDB, no network) for: multiple teams per account,
the daily team-login cap, and the 'second player already submitted' check-in bug.

Run:  cd backend && pip install mongomock-motor httpx pytest pytest-asyncio
      pytest tests/test_team_features.py -n 0 -p no:cacheprovider
"""
import os
import sys
import uuid
from pathlib import Path

import httpx
import pytest
import pytest_asyncio
from fastapi import FastAPI
from mongomock_motor import AsyncMongoMockClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import bcrypt  # noqa: E402
import platform_routes as pr  # noqa: E402

pytestmark = pytest.mark.asyncio


def _hash(p): return bcrypt.hashpw(p.encode(), bcrypt.gensalt()).decode()
def _verify(p, h): return bcrypt.checkpw(p.encode(), h.encode())


@pytest_asyncio.fixture
async def env(monkeypatch):
    from datetime import datetime, timezone
    db = AsyncMongoMockClient()[f"t_{uuid.uuid4().hex[:8]}"]
    state = {"day": "2026-10-24"}

    async def fake_email(*a, **k): return {"id": "x"}

    pr.init(db=db, send_email=fake_email, hash_password=_hash, verify_password=_verify,
            jwt_secret="x" * 40, jwt_algorithm="HS256",
            now_utc=lambda: datetime.now(timezone.utc), today_str=lambda: state["day"])
    app = FastAPI()
    app.include_router(pr.platform_router)
    client = httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://t")
    yield db, client, state
    await client.aclose()


def H(tok): return {"Authorization": f"Bearer {tok}"}
CHECKIN = {"sleepQuality": 4, "hydration": 4, "motivation": 4, "sessionType": "Training", "rpe": 5, "duration": 60}


async def make_team(client, email="coach@x.com", pw="secret1", name="Punjab FC"):
    r = await client.post("/api/v2/team/register", json={"email": email, "password": pw, "team_name": name})
    return r


# ---------------------------------------------------------------- 1) several teams, one account
async def test_same_account_can_create_many_teams(env):
    db, c, _ = env
    r1 = await make_team(c, name="Punjab FC")
    assert r1.status_code == 200
    tok = r1.json()["token"]

    # register again with the SAME email + password -> adds a second team to the same account
    r2 = await make_team(c, name="Punjab FC U18")
    assert r2.status_code == 200, r2.text
    assert r2.json()["admin"]["id"] == r1.json()["admin"]["id"]
    assert r2.json()["team"]["athlete_code"] != r1.json()["team"]["athlete_code"]

    # logged-in endpoint adds a third
    r3 = await c.post("/api/v2/admin/teams", json={"team_name": "Punjab FC Women"}, headers=H(tok))
    assert r3.status_code == 200, r3.text

    me = (await c.get("/api/v2/admin/me", headers=H(tok))).json()
    assert {t["team_name"] for t in me["teams"]} == {"Punjab FC", "Punjab FC U18", "Punjab FC Women"}
    assert (await db.admins.count_documents({})) == 1

    # each team has its own roster, addressed with team_id
    ids = {t["team_name"]: t["id"] for t in me["teams"]}
    await c.post(f"/api/v2/team/roster?team_id={ids['Punjab FC']}", json={"name": "Messi"}, headers=H(tok))
    a = (await c.get(f"/api/v2/team/roster?team_id={ids['Punjab FC']}", headers=H(tok))).json()["players"]
    b = (await c.get(f"/api/v2/team/roster?team_id={ids['Punjab FC U18']}", headers=H(tok))).json()["players"]
    assert [p["name"] for p in a] == ["Messi"] and b == []


async def test_multi_team_guards(env):
    _, c, _ = env
    tok = (await make_team(c)).json()["token"]
    # wrong password for an existing email must NOT add a team
    bad = await make_team(c, pw="wrongpw1", name="Hijack")
    assert bad.status_code == 409
    # duplicate name on the same account, blank name
    assert (await c.post("/api/v2/admin/teams", json={"team_name": " punjab  fc "}, headers=H(tok))).status_code == 409
    assert (await c.post("/api/v2/admin/teams", json={"team_name": "  "}, headers=H(tok))).status_code == 400
    # another account may reuse the name
    assert (await make_team(c, email="other@x.com", name="Punjab FC")).status_code == 200
    # needs a login
    assert (await c.post("/api/v2/admin/teams", json={"team_name": "Z"})).status_code == 401


async def test_cannot_open_someone_elses_team(env):
    _, c, _ = env
    r1 = await make_team(c, email="a@x.com", name="A")
    r2 = await make_team(c, email="b@x.com", name="B")
    r = await c.get(f"/api/v2/team/roster?team_id={r2.json()['team']['id']}", headers=H(r1.json()["token"]))
    assert r.status_code == 403


# ---------------------------------------------------------------- 2) the 'already submitted' bug
async def _join_two_players(c, tok):
    team = (await c.get("/api/v2/admin/me", headers=H(tok))).json()["teams"][0]
    for n in ("Bobby", "Shaiza"):
        await c.post(f"/api/v2/team/roster?team_id={team['id']}", json={"name": n}, headers=H(tok))
    players = (await c.post("/api/v2/team/join", json={"code": team["athlete_code"]})).json()["available_players"]
    toks = []
    for p in players:
        r = await c.post("/api/v2/team/select", json={"code": team["athlete_code"], "player_id": p["id"]})
        assert r.status_code == 200, r.text
        toks.append(r.json()["token"])
    return toks


async def test_second_player_blocked_by_stale_index_and_fixed_by_startup(env):
    db, c, _ = env
    tok = (await make_team(c)).json()["token"]
    t1, t2 = await _join_two_players(c, tok)

    # an index left behind by an older version of the app (unique on athlete_id+context+date)
    await db.checkins_v2.create_index([("athlete_id", 1), ("context", 1), ("date", 1)], unique=True)

    assert (await c.post("/api/v2/checkin/team", json=CHECKIN, headers=H(t1))).status_code == 200
    broken = await c.post("/api/v2/checkin/team", json=CHECKIN, headers=H(t2))
    assert broken.status_code == 409          # <- the bug you saw: a different player is told "already submitted"

    await pr.ensure_indexes()                  # what the new startup does
    names = (await db.checkins_v2.index_information()).keys()
    assert not any("athlete_id_1_context_1_date_1" == n for n in names)

    fixed = await c.post("/api/v2/checkin/team", json=CHECKIN, headers=H(t2))
    assert fixed.status_code == 200, fixed.text

    # a REAL duplicate is still rejected, for the same player
    again = await c.post("/api/v2/checkin/team", json=CHECKIN, headers=H(t2))
    assert again.status_code == 409


async def test_each_player_can_check_in_once_per_day(env):
    _, c, state = env
    await pr.ensure_indexes()
    tok = (await make_team(c)).json()["token"]
    t1, t2 = await _join_two_players(c, tok)
    assert (await c.post("/api/v2/checkin/team", json=CHECKIN, headers=H(t1))).status_code == 200
    assert (await c.post("/api/v2/checkin/team", json=CHECKIN, headers=H(t2))).status_code == 200
    assert (await c.post("/api/v2/checkin/team", json=CHECKIN, headers=H(t1))).status_code == 409
    state["day"] = "2026-10-25"
    assert (await c.post("/api/v2/checkin/team", json=CHECKIN, headers=H(t1))).status_code == 200
    mine = (await c.get("/api/v2/checkin/team/mine", headers=H(t1))).json()
    assert mine["today"] == "2026-10-25" and len(mine["checkins"]) == 2


# ---------------------------------------------------------------- 3) 150 team logins / day
async def test_team_login_cap_and_individual_unlimited(env, monkeypatch):
    _, c, state = env
    await pr.ensure_indexes()
    monkeypatch.setattr(pr, "TEAM_DAILY_LOGIN_LIMIT", 3)
    tok = (await make_team(c)).json()["token"]
    team = (await c.get("/api/v2/admin/me", headers=H(tok))).json()["teams"][0]
    pid = (await c.post(f"/api/v2/team/roster?team_id={team['id']}", json={"name": "Bobby"}, headers=H(tok))).json()["id"]
    sel = {"code": team["athlete_code"], "player_id": pid}

    for _ in range(3):
        assert (await c.post("/api/v2/team/select", json=sel)).status_code == 200
    blocked = await c.post("/api/v2/team/select", json=sel)
    assert blocked.status_code == 429
    assert blocked.json()["detail"] == pr.TEAM_LOGIN_LIMIT_MSG

    # a different team is not affected
    other = (await make_team(c, email="o@x.com", name="Other")).json()
    pid2 = (await c.post(f"/api/v2/team/roster?team_id={other['team']['id']}", json={"name": "Z"}, headers=H(other["token"]))).json()["id"]
    assert (await c.post("/api/v2/team/select", json={"code": other["team"]["athlete_code"], "player_id": pid2})).status_code == 200

    # individual athletes: no cap at all (well past 3)
    for i in range(12):
        r = await c.post("/api/v2/athlete/signup", json={"name": f"A{i}", "email": f"a{i}@x.com", "password": "secret1"})
        assert r.status_code == 200
        assert (await c.post("/api/v2/athlete/login", json={"email": f"a{i}@x.com", "password": "secret1"})).status_code == 200

    # next day the counter starts over
    state["day"] = "2026-10-25"
    assert (await c.post("/api/v2/team/select", json=sel)).status_code == 200


async def test_default_cap_is_150():
    assert pr.TEAM_DAILY_LOGIN_LIMIT == 150
