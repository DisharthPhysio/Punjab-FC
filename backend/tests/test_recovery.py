"""Forgot-password via a personal recovery question (no email), persistent athlete login, back-compat for old accounts."""
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

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import platform_routes as pr  # noqa: E402

pytestmark = pytest.mark.asyncio
_hash = lambda p: bcrypt.hashpw(p.encode(), bcrypt.gensalt()).decode()
_verify = lambda p, h: bcrypt.checkpw(p.encode(), h.encode())
H = lambda tok: {"Authorization": f"Bearer {tok}"}


@pytest_asyncio.fixture
async def env():
    db = AsyncMongoMockClient()[f"t_{uuid.uuid4().hex[:8]}"]
    state = {"now": datetime.now(timezone.utc)}

    async def fake_email(*a, **k):
        raise AssertionError("password reset must not send email any more")

    pr.init(db=db, send_email=fake_email, hash_password=_hash, verify_password=_verify, jwt_secret="x" * 40, jwt_algorithm="HS256",
            now_utc=lambda: state["now"], today_str=lambda: state["now"].strftime("%Y-%m-%d"))
    app = FastAPI()
    app.include_router(pr.platform_router)
    c = httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://t")
    yield db, c, state
    await c.aclose()


SIGNUP = {"name": "Indy", "email": "indy@x.com", "password": "secret1", "recovery_question": "fav_teacher", "recovery_answer": "Mrs. D'Souza"}


async def test_signup_requires_a_recovery_question(env):
    _, c, _ = env
    bad = await c.post("/api/v2/athlete/signup", json={k: v for k, v in SIGNUP.items() if not k.startswith("recovery")})
    assert bad.status_code == 400 and "recovery question" in bad.json()["detail"]
    assert (await c.post("/api/v2/athlete/signup", json={**SIGNUP, "recovery_question": "made_up"})).status_code == 400
    assert (await c.post("/api/v2/athlete/signup", json={**SIGNUP, "recovery_answer": " ! "})).status_code == 400
    ok = await c.post("/api/v2/athlete/signup", json=SIGNUP)
    assert ok.status_code == 200
    me = (await c.get("/api/v2/athlete/me", headers=H(ok.json()["token"]))).json()
    assert me["has_recovery"] is True
    assert "recovery_answer_hash" not in me["athlete"] and "recovery_question" not in me["athlete"]     # never exposed


async def test_reset_with_the_right_question_and_answer(env):
    db, c, _ = env
    await c.post("/api/v2/athlete/signup", json=SIGNUP)
    body = {"role": "athlete", "email": "INDY@x.com ", "question_id": "fav_teacher", "answer": "mrs d souza", "new_password": "brandnew1"}
    r = await c.post("/api/v2/auth/recovery/reset", json=body)          # case / punctuation / spacing in the answer don't matter
    assert r.status_code == 200, r.text
    assert (await c.post("/api/v2/athlete/login", json={"email": "indy@x.com", "password": "secret1"})).status_code == 401
    assert (await c.post("/api/v2/athlete/login", json={"email": "indy@x.com", "password": "brandnew1"})).status_code == 200
    stored = await db.athletes.find_one({"email": "indy@x.com"})
    assert "souza" not in str(stored).lower()                           # only a hash is stored


async def test_date_of_birth_answers_match_across_formats(env):
    _, c, _ = env
    await c.post("/api/v2/athlete/signup", json={**SIGNUP, "recovery_question": "birth_date", "recovery_answer": "12/05/2000"})
    r = await c.post("/api/v2/auth/recovery/reset", json={"role": "athlete", "email": "indy@x.com", "question_id": "birth_date", "answer": "12-05-2000", "new_password": "brandnew1"})
    assert r.status_code == 200
    # leading zeros on day / month don't matter either
    await c.post("/api/v2/athlete/signup", json={**SIGNUP, "email": "z@x.com", "recovery_question": "birth_date", "recovery_answer": "01/02/1980"})
    for typed in ("1-2-1980", "1 2 1980", "01.02.1980"):
        ok = await c.post("/api/v2/auth/recovery/reset", json={"role": "athlete", "email": "z@x.com", "question_id": "birth_date", "answer": typed, "new_password": "brandnew1"})
        assert ok.status_code == 200, typed
    wrong = await c.post("/api/v2/auth/recovery/reset", json={"role": "athlete", "email": "z@x.com", "question_id": "birth_date", "answer": "02/01/1980", "new_password": "brandnew1"})
    assert wrong.status_code == 400                                        # day and month swapped is a different date


async def test_non_latin_answers_work(env):
    _, c, _ = env
    await c.post("/api/v2/athlete/signup", json={**SIGNUP, "recovery_answer": "श्रीमती शर्मा"})
    ok = await c.post("/api/v2/auth/recovery/reset", json={"role": "athlete", "email": "indy@x.com", "question_id": "fav_teacher", "answer": "श्रीमती  शर्मा", "new_password": "brandnew1"})
    assert ok.status_code == 200


async def test_wrong_question_wrong_answer_unknown_email_all_look_the_same(env):
    _, c, _ = env
    await c.post("/api/v2/athlete/signup", json=SIGNUP)
    base = {"role": "athlete", "email": "indy@x.com", "question_id": "fav_teacher", "answer": "Mrs. D'Souza", "new_password": "brandnew1"}
    msgs = set()
    for change in ({"answer": "wrong"}, {"question_id": "first_pet"}, {"email": "ghost@x.com"}, {"role": "admin"}):
        r = await c.post("/api/v2/auth/recovery/reset", json={**base, **change})
        assert r.status_code == 400
        msgs.add(r.json()["detail"])
    assert len(msgs) == 1                                               # no way to tell which part was wrong / whether the email exists
    assert (await c.post("/api/v2/athlete/login", json={"email": "indy@x.com", "password": "secret1"})).status_code == 200   # unchanged


async def test_lockout_after_repeated_wrong_answers(env):
    _, c, state = env
    await c.post("/api/v2/athlete/signup", json=SIGNUP)
    body = {"role": "athlete", "email": "indy@x.com", "question_id": "fav_teacher", "answer": "nope", "new_password": "brandnew1"}
    for _ in range(pr.RECOVERY_MAX_FAILS):
        assert (await c.post("/api/v2/auth/recovery/reset", json=body)).status_code == 400
    locked = await c.post("/api/v2/auth/recovery/reset", json={**body, "answer": "Mrs. D'Souza"})   # even the RIGHT answer is refused while locked
    assert locked.status_code == 429
    state["now"] += timedelta(minutes=pr.RECOVERY_LOCK_MINUTES + 1)
    assert (await c.post("/api/v2/auth/recovery/reset", json={**body, "answer": "Mrs. D'Souza"})).status_code == 200


async def test_admin_accounts_recover_too_and_old_email_endpoints_are_gone(env):
    _, c, _ = env
    r = await c.post("/api/v2/team/register", json={"team_name": "FC", "email": "coach@x.com", "password": "secret1", "recovery_question": "first_school", "recovery_answer": "St Mary"})
    assert r.status_code == 200
    ok = await c.post("/api/v2/auth/recovery/reset", json={"role": "admin", "email": "coach@x.com", "question_id": "first_school", "answer": "st mary", "new_password": "brandnew1"})
    assert ok.status_code == 200
    assert (await c.post("/api/v2/admin/login", json={"email": "coach@x.com", "password": "brandnew1"})).status_code == 200
    for path in ("/api/v2/athlete/forgot-password", "/api/v2/admin/forgot-password", "/api/v2/athlete/reset-password", "/api/v2/admin/reset-password"):
        assert (await c.post(path, json={"email": "a@b.com"})).status_code in (404, 405)
    # registering a NEW account without a question is refused; adding a team to an existing one doesn't need it
    assert (await c.post("/api/v2/team/register", json={"team_name": "X", "email": "new@x.com", "password": "secret1"})).status_code == 400
    assert (await c.post("/api/v2/team/register", json={"team_name": "FC 2", "email": "coach@x.com", "password": "brandnew1"})).status_code == 200


async def test_existing_accounts_are_asked_once(env):
    db, c, _ = env
    # an account created BEFORE this feature: no recovery fields at all
    await db.athletes.insert_one({"id": "old1", "name": "Old", "email": "old@x.com", "password_hash": _hash("secret1"), "created_at": "2025-01-01"})
    login = (await c.post("/api/v2/athlete/login", json={"email": "old@x.com", "password": "secret1"})).json()
    assert (await c.get("/api/v2/athlete/me", headers=H(login["token"]))).json()["has_recovery"] is False
    # nothing to reset with yet
    r = await c.post("/api/v2/auth/recovery/reset", json={"role": "athlete", "email": "old@x.com", "question_id": "birth_date", "answer": "x1", "new_password": "brandnew1"})
    assert r.status_code == 400
    # the one-time prompt saves it...
    assert (await c.post("/api/v2/account/recovery", headers=H(login["token"]), json={"question_id": "first_pet", "answer": "Bruno"})).status_code == 200
    assert (await c.get("/api/v2/athlete/me", headers=H(login["token"]))).json()["has_recovery"] is True
    # ...and now it works; changing it later needs the current password
    assert (await c.post("/api/v2/account/recovery", headers=H(login["token"]), json={"question_id": "first_pet", "answer": "Rex"})).status_code == 401
    assert (await c.post("/api/v2/account/recovery", headers=H(login["token"]), json={"question_id": "first_pet", "answer": "Rex", "current_password": "secret1"})).status_code == 200
    assert (await c.post("/api/v2/auth/recovery/reset", json={"role": "athlete", "email": "old@x.com", "question_id": "first_pet", "answer": "rex", "new_password": "brandnew1"})).status_code == 200


async def test_athletes_stay_logged_in(env):
    _, c, state = env
    tok = (await c.post("/api/v2/athlete/signup", json=SIGNUP)).json()["token"]
    state["now"] += timedelta(days=200)                                  # long after the old 30-day expiry
    me = await c.get("/api/v2/athlete/me", headers=H(tok))
    assert me.status_code == 200
    fresh = me.json()["token"]                                           # sliding renewal: a new 365-day token every visit
    state["now"] += timedelta(days=300)
    assert (await c.get("/api/v2/athlete/me", headers=H(fresh))).status_code == 200
