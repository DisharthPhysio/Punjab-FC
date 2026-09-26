"""
Multi-tenant platform routes (Athlete / Team / Admin / Super Admin).

Kept separate from server.py's original single-team coach routes so that
code path is left untouched. server.py calls init(...) once at import time
to hand over its already-built db handle, email sender, password helpers,
JWT secret, and day/time helpers, then mounts `platform_router`.

Auth model (v2, simplified — no email verification step anywhere):
  - An individual Athlete has their own email/password account (JWT type="athlete").
    Signup logs them in immediately — no confirmation code.
  - A Team athlete needs NO account at all: enter the team's 6-digit athlete
    code, pick your name off the roster once, and a long-lived token
    (JWT type="team_athlete", carrying team_id + a per-claim secret) is issued
    and stored on that device. No email, no password.
  - A Team is created by an Admin (email/password, JWT type="admin"), also
    logged in immediately on signup. A *different* person who needs access to
    an existing team (e.g. a physio) creates their own admin account (also no
    verification) and links it to that team with the team's 6-digit admin code.
  - A hidden Super Admin (fixed, seeded credentials) can list and remove any
    athlete/admin account, or reset a team athlete's claim on their roster
    slot — the moderation safety net now that signup has no verification gate.

Password reset (forgot-password) still uses an emailed code — that is a
different, still-justified security control (proving you own the email
before changing a password), independent of the removed signup verification.
"""
import os
import re
import secrets
import statistics
import uuid
from datetime import datetime, timedelta, timezone
from typing import List, Literal, Optional

import jwt
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, Field

import export_utils

platform_router = APIRouter(prefix="/api/v2")

# ---- wired in by server.py via init(), before the app starts serving ----
_db = None
_send_email = None
_hash_password = None
_verify_password = None
_JWT_SECRET = None
_JWT_ALGORITHM = "HS256"
_now_utc = None
_today_str = None

CODE_TTL_MINUTES = 15
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
SUPER_ADMIN_EMAIL_DEFAULT = "disharthjain98@gmail.com"
SUPER_ADMIN_PASSWORD_DEFAULT = "Disharth10@"


def init(db, send_email, hash_password, verify_password, jwt_secret, jwt_algorithm, now_utc, today_str):
    global _db, _send_email, _hash_password, _verify_password, _JWT_SECRET, _JWT_ALGORITHM, _now_utc, _today_str
    _db = db
    _send_email = send_email
    _hash_password = hash_password
    _verify_password = verify_password
    _JWT_SECRET = jwt_secret
    _JWT_ALGORITHM = jwt_algorithm
    _now_utc = now_utc
    _today_str = today_str


async def ensure_indexes():
    """Called once from server.py's startup event."""
    await _db.athletes.create_index("email", unique=True)
    await _db.admins.create_index("email", unique=True)
    await _db.superadmins.create_index("email", unique=True)
    await _db.teams.create_index("athlete_code", unique=True)
    await _db.teams.create_index("admin_code", unique=True)
    await _db.team_players.create_index([("team_id", 1)])
    await _db.checkins_v2.create_index(
        [("athlete_id", 1), ("team_player_id", 1), ("context", 1), ("date", 1)], unique=True
    )
    await _db.gps_sessions.create_index([("team_id", 1), ("team_player_id", 1), ("date", 1)])
    # Seed the hidden super admin account (env vars override the defaults given at build time).
    email = os.environ.get("SUPER_ADMIN_EMAIL", SUPER_ADMIN_EMAIL_DEFAULT).strip().lower()
    password = os.environ.get("SUPER_ADMIN_PASSWORD", SUPER_ADMIN_PASSWORD_DEFAULT)
    if not await _db.superadmins.find_one({"email": email}):
        await _db.superadmins.insert_one({
            "id": str(uuid.uuid4()), "email": email, "password_hash": _hash_password(password),
            "created_at": _now_utc().isoformat(),
        })


# ---------- small helpers ----------
def norm_email(e: str) -> str:
    return (e or "").strip().lower()


def valid_email(e: str) -> bool:
    return bool(EMAIL_RE.match(e or ""))


def gen_code() -> str:
    return f"{secrets.randbelow(1_000_000):06d}"


async def unique_team_code(field: str) -> str:
    for _ in range(20):
        code = gen_code()
        if not await _db.teams.find_one({field: code}):
            return code
    raise HTTPException(500, "Could not generate a unique code, please try again.")


def code_expiry():
    return _now_utc() + timedelta(minutes=CODE_TTL_MINUTES)


def _parse_iso(s: Optional[str]) -> datetime:
    if not s:
        return datetime.min.replace(tzinfo=timezone.utc)
    try:
        return datetime.fromisoformat(s)
    except Exception:
        return datetime.min.replace(tzinfo=timezone.utc)


def code_is_valid(stored_code: Optional[str], stored_expiry: Optional[str], submitted: str) -> bool:
    """Still used for forgot/reset-password, which keeps its emailed-code check
    even though signup verification was removed — different security purpose."""
    if not stored_code or stored_code != (submitted or "").strip():
        return False
    return _parse_iso(stored_expiry) >= _now_utc()


# Same Foster (1998) formula as the legacy single-team dashboard (server.py's week_stats),
# duplicated here (rather than imported) to keep this module import-cycle-free.
MONOTONY_WATCH = 1.5
MONOTONY_HIGH = 2.0


def week_stats(daily_loads: List[int]) -> dict:
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


def change_pct(current, previous):
    return int(round((current - previous) / previous * 100)) if previous and previous > 0 else None


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


def make_token(sub: str, ttype: str, days: int = 30, **extra) -> str:
    payload = {"sub": sub, "type": ttype, "exp": _now_utc() + timedelta(days=days)}
    payload.update(extra)
    return jwt.encode(payload, _JWT_SECRET, algorithm=_JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, _JWT_SECRET, algorithms=[_JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Session expired, please log in again")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid session, please log in again")


def bearer_token(request: Request) -> str:
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    return auth[7:]


_PRIVATE_FIELDS = {"_id": 0, "password_hash": 0, "verify_code": 0, "verify_code_expires": 0, "reset_code": 0, "reset_code_expires": 0}


async def get_current_athlete(request: Request) -> dict:
    payload = decode_token(bearer_token(request))
    if payload.get("type") != "athlete":
        raise HTTPException(status_code=401, detail="Not authenticated as an athlete")
    athlete = await _db.athletes.find_one({"id": payload["sub"]}, _PRIVATE_FIELDS)
    if not athlete:
        raise HTTPException(status_code=401, detail="Account not found")
    return athlete


async def get_current_admin(request: Request) -> dict:
    payload = decode_token(bearer_token(request))
    if payload.get("type") != "admin":
        raise HTTPException(status_code=401, detail="Not authenticated as an admin")
    admin = await _db.admins.find_one({"id": payload["sub"]}, _PRIVATE_FIELDS)
    if not admin:
        raise HTTPException(status_code=401, detail="Account not found")
    return admin


async def get_current_team_athlete(request: Request) -> dict:
    """No email/password behind this — the JWT (issued once at /team/select) plus a
    per-claim secret checked against team_players.claim_token IS the credential.
    If a team admin or the super admin resets the claim, this secret stops matching
    and the token is silently invalidated, forcing a rejoin with the code."""
    payload = decode_token(bearer_token(request))
    if payload.get("type") != "team_athlete":
        raise HTTPException(status_code=401, detail="Not authenticated")
    player = await _db.team_players.find_one({"id": payload["sub"]}, {"_id": 0})
    if not player or not player.get("claim_token") or player["claim_token"] != payload.get("ct"):
        raise HTTPException(status_code=401, detail="Your access was reset — please rejoin with your team's code.")
    return player


async def get_current_superadmin(request: Request) -> dict:
    payload = decode_token(bearer_token(request))
    if payload.get("type") != "superadmin":
        raise HTTPException(status_code=401, detail="Not authenticated")
    sa = await _db.superadmins.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
    if not sa:
        raise HTTPException(status_code=401, detail="Account not found")
    return sa


async def _admins_team(admin: dict, team_id: Optional[str] = None) -> dict:
    ids = admin.get("team_ids") or []
    if not ids:
        raise HTTPException(400, "No team linked to this account yet. Enter a team access code first.")
    tid = team_id or ids[0]
    if tid not in ids:
        raise HTTPException(403, "You don't have access to that team.")
    team = await _db.teams.find_one({"id": tid}, {"_id": 0})
    if not team:
        raise HTTPException(404, "Team not found")
    return team


# ---------- email templates (forgot/reset-password only now) ----------
def _code_email_html(title: str, code: str, note: str) -> str:
    return f"""
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;">
      <div style="background:#0B0F17;color:#fff;padding:24px;border-radius:12px 12px 0 0;text-align:center;">
        <h2 style="margin:0;letter-spacing:0.5px;">{title}</h2>
      </div>
      <div style="border:1px solid #eee;border-top:none;padding:28px;border-radius:0 0 12px 12px;text-align:center;">
        <p style="color:#555;margin:0 0 18px;">{note}</p>
        <div style="font-size:34px;font-weight:800;letter-spacing:10px;color:#0B7A4B;background:#F0FDF4;border-radius:10px;padding:16px 0;">{code}</div>
        <p style="color:#999;font-size:12px;margin-top:18px;">This code expires in {CODE_TTL_MINUTES} minutes. If you didn't request this, you can ignore this email.</p>
      </div>
    </div>"""


async def send_reset_code_email(to_email: str, code: str):
    html = _code_email_html("Reset your password", code, "Enter this code to set a new password.")
    await _send_email("Your password reset code", html, to=[to_email])


def _password_ok(pw: str):
    if len(pw or "") < 6:
        raise HTTPException(400, "Password must be at least 6 characters")


# ================= payload models =================
class AthleteSignup(BaseModel):
    name: str
    email: str
    password: str


class TeamRegisterPayload(BaseModel):
    team_name: str
    email: str
    password: str


class AdminSignup(BaseModel):
    email: str
    password: str


class LoginPayload(BaseModel):
    email: str
    password: str


class ForgotPayload(BaseModel):
    email: str


class ResetPayload(BaseModel):
    email: str
    code: str
    new_password: str


class RosterPlayerPayload(BaseModel):
    name: str
    contact: Optional[str] = ""


class TeamCodePayload(BaseModel):
    code: str


class SelectPlayerPayload(BaseModel):
    code: str
    player_id: str


class CheckInPayload(BaseModel):
    sleepHours: Optional[float] = None
    sleepQuality: int
    sleepNotes: Optional[str] = ""
    hydration: int
    motivation: int
    feelingIll: bool = False
    symptoms: List[str] = Field(default_factory=list)
    illnessSeverity: Optional[str] = ""
    temperature: Optional[str] = ""
    illnessNotes: Optional[str] = ""
    sorenessAreas: List[str] = Field(default_factory=list)
    sorenessSide: Optional[str] = ""
    sorenessSeverity: Optional[int] = 0
    sorenessNotes: Optional[str] = ""
    # Training log is mandatory (not an optional toggle): every check-in logs a session.
    sessionType: str
    rpe: int
    duration: int
    notes: Optional[str] = ""


def _validate_checkin(payload: "CheckInPayload"):
    if not payload.sessionType.strip():
        raise HTTPException(400, "Select today's session type")
    if not (1 <= payload.rpe <= 10):
        raise HTTPException(400, "Select today's session RPE (1-10)")
    if payload.duration < 1:
        raise HTTPException(400, "Enter today's session duration in minutes")


class SuperAdminLoginPayload(BaseModel):
    email: str
    password: str


class EmailSummaryPayload(BaseModel):
    team_id: str
    to_email: str


class GpsSessionPayload(BaseModel):
    player_id: str
    date: str  # YYYY-MM-DD, the training/match day this GPS data is for
    distance_m: Optional[float] = None
    hsr_distance_m: Optional[float] = None  # high-speed running distance
    sprints: Optional[int] = None
    max_speed_kmh: Optional[float] = None
    notes: Optional[str] = ""


def _load_from_payload(payload: CheckInPayload) -> int:
    return payload.rpe * payload.duration


# ================= Athlete auth (individual only — no verification step) =================
@platform_router.post("/athlete/signup")
async def athlete_signup(payload: AthleteSignup):
    email = norm_email(payload.email)
    if not valid_email(email):
        raise HTTPException(400, "Enter a valid email address")
    if not payload.name.strip():
        raise HTTPException(400, "Enter your name")
    _password_ok(payload.password)
    if await _db.athletes.find_one({"email": email}):
        raise HTTPException(409, "An account with this email already exists. Try logging in.")
    athlete_id = str(uuid.uuid4())
    await _db.athletes.insert_one({
        "id": athlete_id, "name": payload.name.strip(), "email": email,
        "password_hash": _hash_password(payload.password),
        "reset_code": None, "reset_code_expires": None,
        "created_at": _now_utc().isoformat(),
    })
    token = make_token(athlete_id, "athlete")
    return {"token": token, "athlete": {"id": athlete_id, "name": payload.name.strip(), "email": email}}


@platform_router.post("/athlete/login")
async def athlete_login(payload: LoginPayload):
    email = norm_email(payload.email)
    athlete = await _db.athletes.find_one({"email": email})
    if not athlete or not _verify_password(payload.password, athlete["password_hash"]):
        raise HTTPException(401, "Incorrect email or password")
    token = make_token(athlete["id"], "athlete")
    return {"token": token, "athlete": {"id": athlete["id"], "name": athlete["name"], "email": email}}


@platform_router.post("/athlete/forgot-password")
async def athlete_forgot(payload: ForgotPayload):
    email = norm_email(payload.email)
    athlete = await _db.athletes.find_one({"email": email})
    if athlete:
        code = gen_code()
        await _db.athletes.update_one({"email": email}, {"$set": {"reset_code": code, "reset_code_expires": code_expiry().isoformat()}})
        await send_reset_code_email(email, code)
    return {"message": "If an account exists for that email, a reset code has been sent."}


@platform_router.post("/athlete/reset-password")
async def athlete_reset(payload: ResetPayload):
    email = norm_email(payload.email)
    athlete = await _db.athletes.find_one({"email": email})
    if not athlete:
        raise HTTPException(404, "Account not found")
    if not code_is_valid(athlete.get("reset_code"), athlete.get("reset_code_expires"), payload.code):
        raise HTTPException(400, "That code is invalid or has expired.")
    _password_ok(payload.new_password)
    await _db.athletes.update_one({"email": email}, {"$set": {
        "password_hash": _hash_password(payload.new_password), "reset_code": None, "reset_code_expires": None}})
    return {"message": "Password updated. You can now log in."}


@platform_router.get("/athlete/me")
async def athlete_me(athlete: dict = Depends(get_current_athlete)):
    return {"athlete": athlete}


# ================= Team athlete: code + pick your name, no account at all =================
@platform_router.post("/team/join")
async def team_join(payload: TeamCodePayload):
    team = await _db.teams.find_one({"athlete_code": payload.code.strip()}, {"_id": 0})
    if not team:
        raise HTTPException(404, "No team found for that code")
    players = await _db.team_players.find(
        {"team_id": team["id"], "claim_token": None}, {"_id": 0, "claim_token": 0}
    ).sort("name", 1).to_list(500)
    return {"team": {"id": team["id"], "team_name": team["team_name"]}, "available_players": players}


@platform_router.post("/team/select")
async def team_select(payload: SelectPlayerPayload):
    team = await _db.teams.find_one({"athlete_code": payload.code.strip()})
    if not team:
        raise HTTPException(404, "No team found for that code")
    player = await _db.team_players.find_one({"id": payload.player_id, "team_id": team["id"]})
    if not player:
        raise HTTPException(404, "Player not found on this team's roster")
    if player.get("claim_token"):
        raise HTTPException(409, "That name has already been claimed. Ask your team admin to reset it if it's you.")
    claim_token = secrets.token_urlsafe(16)
    await _db.team_players.update_one({"id": player["id"]}, {"$set": {"claim_token": claim_token, "claimed_at": _now_utc().isoformat()}})
    token = make_token(player["id"], "team_athlete", days=365, team_id=team["id"], ct=claim_token)
    return {"token": token, "team": {"id": team["id"], "team_name": team["team_name"]}, "player": {"id": player["id"], "name": player["name"]}}


@platform_router.get("/team/mine")
async def team_mine(player: dict = Depends(get_current_team_athlete)):
    team = await _db.teams.find_one({"id": player["team_id"]}, {"_id": 0, "id": 1, "team_name": 1})
    return {"team": team, "player": {"id": player["id"], "name": player["name"]}}


# ================= Team registration & Admin auth (no verification step) =================
@platform_router.post("/team/register")
async def team_register(payload: TeamRegisterPayload):
    email = norm_email(payload.email)
    if not valid_email(email):
        raise HTTPException(400, "Enter a valid email address")
    if not payload.team_name.strip():
        raise HTTPException(400, "Enter a team name")
    _password_ok(payload.password)
    if await _db.admins.find_one({"email": email}):
        raise HTTPException(409, "An account with this email already exists. Try Admin Access instead.")

    admin_id = str(uuid.uuid4())
    team_id = str(uuid.uuid4())
    athlete_code = await unique_team_code("athlete_code")
    admin_code = await unique_team_code("admin_code")
    await _db.admins.insert_one({
        "id": admin_id, "email": email, "password_hash": _hash_password(payload.password),
        "reset_code": None, "reset_code_expires": None,
        "team_ids": [team_id], "created_at": _now_utc().isoformat(),
    })
    await _db.teams.insert_one({
        "id": team_id, "team_name": payload.team_name.strip(), "owner_admin_id": admin_id,
        "athlete_code": athlete_code, "admin_code": admin_code, "created_at": _now_utc().isoformat(),
    })
    token = make_token(admin_id, "admin")
    team = await _db.teams.find_one({"id": team_id}, {"_id": 0})
    return {"token": token, "admin": {"id": admin_id, "email": email}, "team": team}


@platform_router.post("/admin/signup")
async def admin_signup(payload: AdminSignup):
    """For someone who needs access to an EXISTING team (e.g. a physio) rather than
    creating a new one. Creates an admin account with no team attached; they link to
    a team afterwards via /admin/link-team using that team's admin code."""
    email = norm_email(payload.email)
    if not valid_email(email):
        raise HTTPException(400, "Enter a valid email address")
    _password_ok(payload.password)
    if await _db.admins.find_one({"email": email}):
        raise HTTPException(409, "An account with this email already exists. Try logging in.")
    admin_id = str(uuid.uuid4())
    await _db.admins.insert_one({
        "id": admin_id, "email": email, "password_hash": _hash_password(payload.password),
        "reset_code": None, "reset_code_expires": None,
        "team_ids": [], "created_at": _now_utc().isoformat(),
    })
    token = make_token(admin_id, "admin")
    return {"token": token, "admin": {"id": admin_id, "email": email}, "needs_code": True, "teams": []}


@platform_router.post("/admin/login")
async def admin_login(payload: LoginPayload):
    email = norm_email(payload.email)
    admin = await _db.admins.find_one({"email": email})
    if not admin or not _verify_password(payload.password, admin["password_hash"]):
        raise HTTPException(401, "Incorrect email or password")
    token = make_token(admin["id"], "admin")
    teams = await _db.teams.find({"id": {"$in": admin.get("team_ids") or []}}, {"_id": 0}).to_list(50)
    return {"token": token, "admin": {"id": admin["id"], "email": email}, "needs_code": len(teams) == 0, "teams": teams}


@platform_router.post("/admin/forgot-password")
async def admin_forgot(payload: ForgotPayload):
    email = norm_email(payload.email)
    admin = await _db.admins.find_one({"email": email})
    if admin:
        code = gen_code()
        await _db.admins.update_one({"email": email}, {"$set": {"reset_code": code, "reset_code_expires": code_expiry().isoformat()}})
        await send_reset_code_email(email, code)
    return {"message": "If an account exists for that email, a reset code has been sent."}


@platform_router.post("/admin/reset-password")
async def admin_reset(payload: ResetPayload):
    email = norm_email(payload.email)
    admin = await _db.admins.find_one({"email": email})
    if not admin:
        raise HTTPException(404, "Account not found")
    if not code_is_valid(admin.get("reset_code"), admin.get("reset_code_expires"), payload.code):
        raise HTTPException(400, "That code is invalid or has expired.")
    _password_ok(payload.new_password)
    await _db.admins.update_one({"email": email}, {"$set": {
        "password_hash": _hash_password(payload.new_password), "reset_code": None, "reset_code_expires": None}})
    return {"message": "Password updated. You can now log in."}


@platform_router.post("/admin/link-team")
async def admin_link_team(payload: TeamCodePayload, admin: dict = Depends(get_current_admin)):
    team = await _db.teams.find_one({"admin_code": payload.code.strip()})
    if not team:
        raise HTTPException(404, "No team found for that access code")
    await _db.admins.update_one({"id": admin["id"]}, {"$addToSet": {"team_ids": team["id"]}})
    team.pop("_id", None)
    return {"team": team}


@platform_router.get("/admin/me")
async def admin_me(admin: dict = Depends(get_current_admin)):
    teams = await _db.teams.find({"id": {"$in": admin.get("team_ids") or []}}, {"_id": 0}).to_list(50)
    return {"admin": admin, "teams": teams}


# ================= Roster & codes (admin) =================
@platform_router.get("/team/codes")
async def team_codes(team_id: Optional[str] = None, admin: dict = Depends(get_current_admin)):
    team = await _admins_team(admin, team_id)
    roster_count = await _db.team_players.count_documents({"team_id": team["id"]})
    return {"team_id": team["id"], "team_name": team["team_name"], "athlete_code": team["athlete_code"],
            "admin_code": team["admin_code"], "roster_count": roster_count}


@platform_router.get("/team/roster")
async def team_roster(team_id: Optional[str] = None, admin: dict = Depends(get_current_admin)):
    team = await _admins_team(admin, team_id)
    players = await _db.team_players.find({"team_id": team["id"]}, {"_id": 0, "claim_token": 0}).sort("name", 1).to_list(500)
    for p in players:
        p["joined"] = bool(p.get("claimed_at"))
    return {"team_id": team["id"], "team_name": team["team_name"], "players": players}


@platform_router.post("/team/roster")
async def team_roster_add(payload: RosterPlayerPayload, team_id: Optional[str] = None, admin: dict = Depends(get_current_admin)):
    team = await _admins_team(admin, team_id)
    if not payload.name.strip():
        raise HTTPException(400, "Enter a player name")
    player = {"id": str(uuid.uuid4()), "team_id": team["id"], "name": payload.name.strip(),
              "contact": (payload.contact or "").strip(), "claim_token": None, "claimed_at": None,
              "created_at": _now_utc().isoformat()}
    await _db.team_players.insert_one(player)
    player.pop("_id", None)
    player.pop("claim_token", None)
    player["joined"] = False
    return player


@platform_router.delete("/team/roster/{player_id}")
async def team_roster_remove(player_id: str, team_id: Optional[str] = None, admin: dict = Depends(get_current_admin)):
    team = await _admins_team(admin, team_id)
    result = await _db.team_players.delete_one({"id": player_id, "team_id": team["id"]})
    if result.deleted_count == 0:
        raise HTTPException(404, "Player not found")
    return {"message": "Removed"}


@platform_router.post("/team/roster/{player_id}/unclaim")
async def team_roster_unclaim(player_id: str, team_id: Optional[str] = None, admin: dict = Depends(get_current_admin)):
    """Frees up a roster name (e.g. someone lost their device, or picked the wrong
    name) so it can be claimed again with the team code. Also immediately revokes
    whatever token was issued for the previous claim."""
    team = await _admins_team(admin, team_id)
    result = await _db.team_players.update_one(
        {"id": player_id, "team_id": team["id"]}, {"$set": {"claim_token": None, "claimed_at": None}}
    )
    if result.matched_count == 0:
        raise HTTPException(404, "Player not found")
    return {"message": "Reset — they can rejoin with the team code."}


# ================= GPS data (optional feature) =================
# Research basis: session-RPE (our existing rpe x duration "load") is the standard
# internal-load measure in the sports-science literature, and correlates well with
# GPS total distance in particular; high-speed-running distance and accelerations
# track a meaningfully different dimension and often correlate weakly with RPE --
# that gap is informative (e.g. high output but low perceived effort, or the
# reverse), not a data-quality problem. So rather than compress GPS data into a
# single opaque "external load" number, this keeps distance/HSR/sprints/max speed
# as separate fields and lets the coach see how they move against internal load.
@platform_router.post("/team/gps")
async def add_gps_session(payload: GpsSessionPayload, team_id: Optional[str] = None, admin: dict = Depends(get_current_admin)):
    team = await _admins_team(admin, team_id)
    player = await _db.team_players.find_one({"id": payload.player_id, "team_id": team["id"]})
    if not player:
        raise HTTPException(404, "Player not found on this team's roster")
    doc = payload.model_dump()
    doc.update({"id": str(uuid.uuid4()), "team_id": team["id"], "team_player_id": payload.player_id,
                "player_name": player["name"], "created_at": _now_utc().isoformat()})
    await _db.gps_sessions.insert_one(dict(doc))
    doc.pop("_id", None)
    return doc


@platform_router.get("/team/gps")
async def list_gps_sessions(player_id: str, team_id: Optional[str] = None, admin: dict = Depends(get_current_admin)):
    team = await _admins_team(admin, team_id)
    rows = await _db.gps_sessions.find(
        {"team_id": team["id"], "team_player_id": player_id}, {"_id": 0}
    ).sort("date", -1).to_list(200)
    return {"sessions": rows}


@platform_router.delete("/team/gps/{session_id}")
async def delete_gps_session(session_id: str, team_id: Optional[str] = None, admin: dict = Depends(get_current_admin)):
    team = await _admins_team(admin, team_id)
    result = await _db.gps_sessions.delete_one({"id": session_id, "team_id": team["id"]})
    if result.deleted_count == 0:
        raise HTTPException(404, "Session not found")
    return {"message": "Deleted"}


@platform_router.get("/team/gps/analysis")
async def gps_analysis(player_id: str, team_id: Optional[str] = None, admin: dict = Depends(get_current_admin)):
    team = await _admins_team(admin, team_id)
    player = await _db.team_players.find_one({"id": player_id, "team_id": team["id"]})
    if not player:
        raise HTTPException(404, "Player not found")
    gps_rows = await _db.gps_sessions.find({"team_id": team["id"], "team_player_id": player_id}, {"_id": 0}).to_list(200)
    checkin_rows = await _db.checkins_v2.find(
        {"team_player_id": player_id, "context": "team", "load": {"$ne": None}}, {"_id": 0, "date": 1, "load": 1}
    ).to_list(500)
    internal_by_date = {c["date"]: c["load"] for c in checkin_rows}

    paired = []
    for g in sorted(gps_rows, key=lambda x: x["date"]):
        internal = internal_by_date.get(g["date"])
        paired.append({**g, "internal_load": internal})

    matched = [p for p in paired if p.get("distance_m") is not None and p.get("internal_load") is not None]
    correlation = None
    if len(matched) >= 3:
        xs = [p["distance_m"] for p in matched]
        ys = [p["internal_load"] for p in matched]
        n = len(matched)
        mean_x, mean_y = sum(xs) / n, sum(ys) / n
        cov = sum((x - mean_x) * (y - mean_y) for x, y in zip(xs, ys))
        var_x = sum((x - mean_x) ** 2 for x in xs)
        var_y = sum((y - mean_y) ** 2 for y in ys)
        if var_x > 0 and var_y > 0:
            correlation = round(cov / ((var_x ** 0.5) * (var_y ** 0.5)), 2)

    return {"player_name": player["name"], "sessions": paired, "correlation": correlation, "matchedSamples": len(matched)}


@platform_router.get("/team/gps/export/pdf")
async def export_gps_pdf(player_id: str, team_id: Optional[str] = None, admin: dict = Depends(get_current_admin)):
    team = await _admins_team(admin, team_id)
    analysis = await gps_analysis(player_id=player_id, team_id=team["id"], admin=admin)
    pdf = export_utils.generate_gps_pdf(team["team_name"], analysis["player_name"], analysis["sessions"], analysis["correlation"])
    return Response(content=pdf, media_type="application/pdf",
                     headers={"Content-Disposition": f'attachment; filename="{analysis["player_name"]}-gps.pdf"'})


# ================= Check-ins: individual (Athlete) =================
@platform_router.post("/checkin")
async def submit_individual_checkin(payload: CheckInPayload, athlete: dict = Depends(get_current_athlete)):
    _validate_checkin(payload)
    today = _today_str()
    if await _db.checkins_v2.find_one({"athlete_id": athlete["id"], "context": "individual", "date": today}):
        raise HTTPException(409, "You've already submitted a check-in for today.")
    doc = payload.model_dump()
    doc.update({"id": str(uuid.uuid4()), "context": "individual", "athlete_id": athlete["id"],
                "athlete_name": athlete["name"], "date": today, "load": _load_from_payload(payload),
                "created_at": _now_utc().isoformat()})
    try:
        await _db.checkins_v2.insert_one(dict(doc))
    except Exception:
        raise HTTPException(409, "You've already submitted a check-in for today.")
    doc.pop("_id", None)
    return doc


@platform_router.get("/checkin/mine")
async def my_individual_checkins(limit: int = 60, athlete: dict = Depends(get_current_athlete)):
    rows = await _db.checkins_v2.find(
        {"athlete_id": athlete["id"], "context": "individual"}, {"_id": 0}
    ).sort("date", -1).to_list(min(limit, 200))
    return {"checkins": rows}


@platform_router.patch("/checkin/{checkin_id}")
async def edit_individual_checkin(checkin_id: str, payload: CheckInPayload, athlete: dict = Depends(get_current_athlete)):
    _validate_checkin(payload)
    existing = await _db.checkins_v2.find_one({"id": checkin_id, "athlete_id": athlete["id"], "context": "individual"})
    if not existing:
        raise HTTPException(404, "Check-in not found")
    updates = payload.model_dump()
    updates["load"] = _load_from_payload(payload)
    await _db.checkins_v2.update_one({"id": checkin_id}, {"$set": updates})
    existing.update(updates)
    existing.pop("_id", None)
    return existing


@platform_router.delete("/checkin/{checkin_id}")
async def delete_individual_checkin(checkin_id: str, athlete: dict = Depends(get_current_athlete)):
    result = await _db.checkins_v2.delete_one({"id": checkin_id, "athlete_id": athlete["id"], "context": "individual"})
    if result.deleted_count == 0:
        raise HTTPException(404, "Check-in not found")
    return {"message": "Deleted"}


@platform_router.get("/checkin/export/pdf")
async def export_individual_pdf(athlete: dict = Depends(get_current_athlete)):
    rows = await _db.checkins_v2.find(
        {"athlete_id": athlete["id"], "context": "individual"}, {"_id": 0}
    ).sort("date", -1).to_list(500)
    pdf = export_utils.generate_history_pdf(athlete["name"], "Individual check-in history", rows)
    return Response(content=pdf, media_type="application/pdf",
                     headers={"Content-Disposition": f'attachment; filename="{athlete["name"]}-checkins.pdf"'})


# ================= Check-ins: team athlete (code-based, no account) =================
@platform_router.post("/checkin/team")
async def submit_team_checkin(payload: CheckInPayload, player: dict = Depends(get_current_team_athlete)):
    _validate_checkin(payload)
    today = _today_str()
    if await _db.checkins_v2.find_one({"team_player_id": player["id"], "context": "team", "date": today}):
        raise HTTPException(409, "You've already submitted a check-in for today.")
    doc = payload.model_dump()
    doc.update({"id": str(uuid.uuid4()), "context": "team", "team_id": player["team_id"],
                "team_player_id": player["id"], "player_name": player["name"], "date": today,
                "load": _load_from_payload(payload), "created_at": _now_utc().isoformat()})
    try:
        await _db.checkins_v2.insert_one(dict(doc))
    except Exception:
        raise HTTPException(409, "You've already submitted a check-in for today.")
    doc.pop("_id", None)
    return doc


@platform_router.get("/checkin/team/mine")
async def my_team_checkins(limit: int = 60, player: dict = Depends(get_current_team_athlete)):
    rows = await _db.checkins_v2.find(
        {"team_player_id": player["id"], "context": "team"}, {"_id": 0}
    ).sort("date", -1).to_list(min(limit, 200))
    return {"checkins": rows}


@platform_router.patch("/checkin/team/{checkin_id}")
async def edit_team_checkin(checkin_id: str, payload: CheckInPayload, player: dict = Depends(get_current_team_athlete)):
    _validate_checkin(payload)
    existing = await _db.checkins_v2.find_one({"id": checkin_id, "team_player_id": player["id"], "context": "team"})
    if not existing:
        raise HTTPException(404, "Check-in not found")
    updates = payload.model_dump()
    updates["load"] = _load_from_payload(payload)
    await _db.checkins_v2.update_one({"id": checkin_id}, {"$set": updates})
    existing.update(updates)
    existing.pop("_id", None)
    return existing


@platform_router.delete("/checkin/team/{checkin_id}")
async def delete_team_checkin(checkin_id: str, player: dict = Depends(get_current_team_athlete)):
    result = await _db.checkins_v2.delete_one({"id": checkin_id, "team_player_id": player["id"], "context": "team"})
    if result.deleted_count == 0:
        raise HTTPException(404, "Check-in not found")
    return {"message": "Deleted"}


@platform_router.get("/checkin/team/export/pdf")
async def export_team_athlete_pdf(player: dict = Depends(get_current_team_athlete)):
    rows = await _db.checkins_v2.find(
        {"team_player_id": player["id"], "context": "team"}, {"_id": 0}
    ).sort("date", -1).to_list(500)
    pdf = export_utils.generate_history_pdf(player["name"], "Team check-in history", rows)
    return Response(content=pdf, media_type="application/pdf",
                     headers={"Content-Disposition": f'attachment; filename="{player["name"]}-checkins.pdf"'})


# ================= Stats (shared math for athlete self-view & admin views) =================
async def _compute_stats(base_query: dict, player_name: str) -> dict:
    today = datetime.strptime(_today_str(), "%Y-%m-%d").date()
    window_start = (today - timedelta(days=41)).strftime("%Y-%m-%d")  # 6 weeks of history for the chart
    query = {**base_query, "date": {"$gte": window_start}}
    rows = await _db.checkins_v2.find(query, {"_id": 0}).to_list(200)
    by_date = {r["date"]: r for r in rows}

    def day(offset_from_today: int) -> str:
        return (today - timedelta(days=offset_from_today)).strftime("%Y-%m-%d")

    daily_series = []
    for i in range(41, -1, -1):  # oldest -> newest
        d = day(i)
        r = by_date.get(d)
        daily_series.append({"date": d, "load": (r.get("load") or 0) if r else 0, "readiness": readiness_score(r)})

    last28 = daily_series[-28:]
    last28_loads = [pt["load"] for pt in last28]
    last7_loads = [pt["load"] for pt in daily_series[-7:]]
    prev7_loads = [pt["load"] for pt in daily_series[-14:-7]]

    nonzero_28 = [x for x in last28_loads if x > 0]
    avg_load = round(sum(nonzero_28) / len(nonzero_28)) if nonzero_28 else 0
    peak_load = max(last28_loads) if last28_loads else 0

    this_week = week_stats(last7_loads)
    prev_week = week_stats(prev7_loads)
    this_week["changePct"] = change_pct(this_week["load"], prev_week["load"])

    chronic_avg = sum(last28_loads) / 28
    acute_avg = sum(last7_loads) / 7
    acwr = round(acute_avg / chronic_avg, 2) if chronic_avg > 0 else None
    acwr_risk = None
    if acwr is not None:
        acwr_risk = "red" if acwr > 1.5 else ("amber" if (acwr >= 1.3 or acwr < 0.8) else "green")

    this_week_readi = [pt["readiness"] for pt in daily_series[-7:] if pt["readiness"] is not None]
    prev_week_readi = [pt["readiness"] for pt in daily_series[-14:-7] if pt["readiness"] is not None]
    readiness_week_avg = round(sum(this_week_readi) / len(this_week_readi)) if this_week_readi else None
    readiness_prev_avg = round(sum(prev_week_readi) / len(prev_week_readi)) if prev_week_readi else None
    readiness_trend = (readiness_week_avg - readiness_prev_avg) if (readiness_week_avg is not None and readiness_prev_avg is not None) else None

    today_row = by_date.get(_today_str())
    return {
        "player_name": player_name,
        "avgLoad": avg_load, "peakLoad": peak_load,
        "weekLoad": this_week["load"], "weekChangePct": this_week["changePct"],
        "monotony": this_week["monotony"], "strain": this_week["strain"], "monotonyRisk": this_week["monotonyRisk"],
        "acwr": acwr, "acwrRisk": acwr_risk,
        "readinessToday": readiness_score(today_row),
        "readinessWeekAvg": readiness_week_avg, "readinessPrevWeekAvg": readiness_prev_avg,
        "readinessTrend": readiness_trend,
        "dailySeries": last28,
        "checkedInToday": today_row is not None,
        "todayCheckin": today_row,
    }


RISK_LEVEL = lambda score: "red" if score >= 50 else ("amber" if score >= 25 else "green")


def _risk_score(stats: dict) -> int:
    """0-100+ composite used to rank players by concern. Combines load-spike risk
    (ACWR), fatigue-accumulation risk (monotony) and today's subjective signals
    (illness, soreness, low readiness). A triage aid, not a medical diagnosis."""
    score = 0
    score += {"red": 40, "amber": 15}.get(stats.get("acwrRisk"), 0)
    score += {"red": 25, "amber": 10}.get(stats.get("monotonyRisk"), 0)
    today = stats.get("todayCheckin")
    if today:
        if today.get("feelingIll"):
            score += 20
        score += (today.get("sorenessSeverity") or 0) * 4
        r = stats.get("readinessToday")
        if r is not None:
            if r < 50:
                score += 15
            elif r < 70:
                score += 5
    return score


@platform_router.get("/stats/team/mine")
async def my_team_stats(player: dict = Depends(get_current_team_athlete)):
    """A team athlete's own load & readiness picture: average/peak/week-total load,
    monotony, strain, ACWR, readiness vs. the previous week, and a daily series to chart."""
    stats = await _compute_stats({"team_player_id": player["id"], "context": "team"}, player["name"])
    stats.pop("todayCheckin", None)  # internal-only field used for risk scoring
    return stats


@platform_router.get("/team/sleep-correlation")
async def team_sleep_correlation(team_id: Optional[str] = None, admin: dict = Depends(get_current_admin)):
    """Sleep hours vs. sleep quality across the whole squad's check-in history,
    for the command centre. Plain Pearson correlation -- no extra dependency,
    just paired (hours, quality) samples where both were actually logged."""
    team = await _admins_team(admin, team_id)
    rows = await _db.checkins_v2.find(
        {"team_id": team["id"], "context": "team", "sleepHours": {"$ne": None}},
        {"_id": 0, "sleepHours": 1, "sleepQuality": 1, "player_name": 1, "date": 1},
    ).sort("date", -1).to_list(1000)
    points = [r for r in rows if r.get("sleepHours") is not None and r.get("sleepQuality")]

    n = len(points)
    correlation = None
    if n >= 3:
        xs = [p["sleepHours"] for p in points]
        ys = [p["sleepQuality"] for p in points]
        mean_x, mean_y = sum(xs) / n, sum(ys) / n
        cov = sum((x - mean_x) * (y - mean_y) for x, y in zip(xs, ys))
        var_x = sum((x - mean_x) ** 2 for x in xs)
        var_y = sum((y - mean_y) ** 2 for y in ys)
        if var_x > 0 and var_y > 0:
            correlation = round(cov / ((var_x ** 0.5) * (var_y ** 0.5)), 2)

    buckets = {}
    for p in points:
        b = round(p["sleepHours"])
        buckets.setdefault(b, []).append(p["sleepQuality"])
    bucketed = sorted(
        [{"hours": k, "avgQuality": round(sum(v) / len(v), 2), "count": len(v)} for k, v in buckets.items()],
        key=lambda x: x["hours"],
    )
    return {"points": points, "correlation": correlation, "sampleSize": n, "buckets": bucketed}


@platform_router.get("/team/dashboard")
async def team_dashboard(team_id: Optional[str] = None, admin: dict = Depends(get_current_admin)):
    """The command centre's player-card grid + the data the ranking view sorts on."""
    team = await _admins_team(admin, team_id)
    players = await _db.team_players.find({"team_id": team["id"]}, {"_id": 0}).sort("name", 1).to_list(500)

    out = []
    for p in players:
        entry = {"id": p["id"], "name": p["name"], "contact": p.get("contact", ""),
                  "joined": bool(p.get("claim_token"))}
        if p.get("claim_token"):
            stats = await _compute_stats({"team_player_id": p["id"], "context": "team"}, p["name"])
            risk = _risk_score(stats)
            today = stats.pop("todayCheckin", None)
            entry.update(stats)
            entry["riskScore"] = risk
            entry["riskLevel"] = RISK_LEVEL(risk)
            if today:
                entry["today"] = {
                    "sleepQuality": today.get("sleepQuality"), "sleepHours": today.get("sleepHours"),
                    "hydration": today.get("hydration"), "motivation": today.get("motivation"),
                    "feelingIll": today.get("feelingIll"), "symptoms": today.get("symptoms", []),
                    "sorenessAreas": today.get("sorenessAreas", []), "sorenessSeverity": today.get("sorenessSeverity", 0),
                }
        else:
            entry.update({"riskScore": None, "riskLevel": None, "checkedInToday": False, "today": None})
        out.append(entry)

    checked_in = sum(1 for a in out if a.get("checkedInToday"))
    flagged = sum(1 for a in out if a.get("riskLevel") == "red")
    return {"team_name": team["team_name"], "summary": {"total": len(out), "checkedIn": checked_in, "flagged": flagged}, "players": out}


@platform_router.get("/team/export/pdf")
async def export_team_pdf(team_id: Optional[str] = None, admin: dict = Depends(get_current_admin)):
    team = await _admins_team(admin, team_id)
    dash = await team_dashboard(team_id=team["id"], admin=admin)
    pdf = export_utils.generate_team_pdf(dash["team_name"], dash["summary"], dash["players"])
    return Response(content=pdf, media_type="application/pdf",
                     headers={"Content-Disposition": f'attachment; filename="{dash["team_name"]}-report.pdf"'})


@platform_router.get("/team/export/excel")
async def export_team_excel(team_id: Optional[str] = None, admin: dict = Depends(get_current_admin)):
    team = await _admins_team(admin, team_id)
    dash = await team_dashboard(team_id=team["id"], admin=admin)
    xlsx = export_utils.generate_team_excel(dash["team_name"], dash["players"])
    return Response(content=xlsx, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                     headers={"Content-Disposition": f'attachment; filename="{dash["team_name"]}-report.xlsx"'})


@platform_router.get("/team/player/{player_id}")
async def team_player_detail(player_id: str, team_id: Optional[str] = None, admin: dict = Depends(get_current_admin)):
    team = await _admins_team(admin, team_id)
    player = await _db.team_players.find_one({"id": player_id, "team_id": team["id"]}, {"_id": 0, "claim_token": 0})
    if not player:
        raise HTTPException(404, "Player not found")
    if not player.get("claimed_at"):
        return {"player": player, "stats": None, "checkins": []}
    stats = await _compute_stats({"team_player_id": player_id, "context": "team"}, player["name"])
    risk = _risk_score(stats)
    stats["riskScore"] = risk
    stats["riskLevel"] = RISK_LEVEL(risk)
    stats.pop("todayCheckin", None)
    checkins = await _db.checkins_v2.find(
        {"team_player_id": player_id, "context": "team"}, {"_id": 0}
    ).sort("date", -1).to_list(30)
    return {"player": player, "stats": stats, "checkins": checkins}


@platform_router.get("/team/player/{player_id}/export/pdf")
async def export_player_pdf(player_id: str, team_id: Optional[str] = None, admin: dict = Depends(get_current_admin)):
    team = await _admins_team(admin, team_id)
    player = await _db.team_players.find_one({"id": player_id, "team_id": team["id"]}, {"_id": 0})
    if not player:
        raise HTTPException(404, "Player not found")
    checkins = await _db.checkins_v2.find(
        {"team_player_id": player_id, "context": "team"}, {"_id": 0}
    ).sort("date", -1).to_list(500)
    pdf = export_utils.generate_history_pdf(player["name"], f"{team['team_name']} — check-in history", checkins)
    return Response(content=pdf, media_type="application/pdf",
                     headers={"Content-Disposition": f'attachment; filename="{player["name"]}-checkins.pdf"'})


# ================= Hidden Super Admin (moderation safety net) =================
@platform_router.post("/superadmin/login")
async def superadmin_login(payload: SuperAdminLoginPayload):
    email = norm_email(payload.email)
    sa = await _db.superadmins.find_one({"email": email})
    if not sa or not _verify_password(payload.password, sa["password_hash"]):
        raise HTTPException(401, "Incorrect email or password")
    token = make_token(sa["id"], "superadmin", days=7)
    return {"token": token}


@platform_router.get("/superadmin/athletes")
async def superadmin_list_athletes(sa: dict = Depends(get_current_superadmin)):
    rows = await _db.athletes.find({}, _PRIVATE_FIELDS).sort("created_at", -1).to_list(2000)
    return {"athletes": rows}


@platform_router.delete("/superadmin/athletes/{athlete_id}")
async def superadmin_delete_athlete(athlete_id: str, sa: dict = Depends(get_current_superadmin)):
    await _db.checkins_v2.delete_many({"athlete_id": athlete_id, "context": "individual"})
    result = await _db.athletes.delete_one({"id": athlete_id})
    if result.deleted_count == 0:
        raise HTTPException(404, "Not found")
    return {"message": "Removed"}


@platform_router.get("/superadmin/admins")
async def superadmin_list_admins(sa: dict = Depends(get_current_superadmin)):
    rows = await _db.admins.find({}, _PRIVATE_FIELDS).sort("created_at", -1).to_list(2000)
    team_ids = list({tid for r in rows for tid in (r.get("team_ids") or [])})
    names = {}
    if team_ids:
        async for t in _db.teams.find({"id": {"$in": team_ids}}, {"_id": 0, "id": 1, "team_name": 1}):
            names[t["id"]] = t["team_name"]
    for r in rows:
        r["teamNames"] = [names.get(tid, "Unknown") for tid in (r.get("team_ids") or [])]
    return {"admins": rows}


@platform_router.delete("/superadmin/admins/{admin_id}")
async def superadmin_delete_admin(admin_id: str, sa: dict = Depends(get_current_superadmin)):
    result = await _db.admins.delete_one({"id": admin_id})
    if result.deleted_count == 0:
        raise HTTPException(404, "Not found")
    return {"message": "Removed"}


@platform_router.get("/superadmin/teams")
async def superadmin_list_teams(sa: dict = Depends(get_current_superadmin)):
    rows = await _db.teams.find({}, {"_id": 0}).sort("created_at", -1).to_list(2000)
    for t in rows:
        t["rosterCount"] = await _db.team_players.count_documents({"team_id": t["id"]})
    return {"teams": rows}


@platform_router.get("/superadmin/teams/{team_id}/roster")
async def superadmin_team_roster(team_id: str, sa: dict = Depends(get_current_superadmin)):
    team = await _db.teams.find_one({"id": team_id}, {"_id": 0})
    if not team:
        raise HTTPException(404, "Team not found")
    players = await _db.team_players.find({"team_id": team_id}, {"_id": 0, "claim_token": 0}).sort("name", 1).to_list(500)
    for p in players:
        p["joined"] = bool(p.get("claimed_at"))
    return {"team": team, "players": players}


@platform_router.delete("/superadmin/teams/{team_id}")
async def superadmin_delete_team(team_id: str, sa: dict = Depends(get_current_superadmin)):
    """Cascade-deletes the team: roster, all its check-ins and GPS sessions, and
    unlinks it from every admin who had access. Cannot be undone."""
    team = await _db.teams.find_one({"id": team_id})
    if not team:
        raise HTTPException(404, "Team not found")
    await _db.team_players.delete_many({"team_id": team_id})
    await _db.checkins_v2.delete_many({"team_id": team_id, "context": "team"})
    await _db.gps_sessions.delete_many({"team_id": team_id})
    await _db.admins.update_many({"team_ids": team_id}, {"$pull": {"team_ids": team_id}})
    await _db.teams.delete_one({"id": team_id})
    return {"message": f"{team['team_name']} and all its data were removed."}


@platform_router.post("/superadmin/team-players/{player_id}/unclaim")
async def superadmin_unclaim(player_id: str, sa: dict = Depends(get_current_superadmin)):
    result = await _db.team_players.update_one({"id": player_id}, {"$set": {"claim_token": None, "claimed_at": None}})
    if result.matched_count == 0:
        raise HTTPException(404, "Not found")
    return {"message": "Player slot reset — they'll need to rejoin with the team code."}


@platform_router.post("/superadmin/email-team-summary")
async def superadmin_email_summary(payload: EmailSummaryPayload, sa: dict = Depends(get_current_superadmin)):
    """Optional, per the request: send a team's roster/status summary to any address,
    from the platform's configured sender. Subject to the same Resend sending-domain
    restriction noted for every other email in this app."""
    team = await _db.teams.find_one({"id": payload.team_id}, {"_id": 0})
    if not team:
        raise HTTPException(404, "Team not found")
    players = await _db.team_players.find({"team_id": team["id"]}, {"_id": 0}).sort("name", 1).to_list(500)
    rows_html = "".join(
        f"<tr><td style='padding:6px 10px;border-bottom:1px solid #eee'>{p['name']}</td>"
        f"<td style='padding:6px 10px;border-bottom:1px solid #eee'>{'Joined' if p.get('claim_token') else 'Not joined'}</td></tr>"
        for p in players
    )
    html = f"""
    <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;">
      <h2>{team['team_name']} — squad summary</h2>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <tr><th style="text-align:left;padding:6px 10px;">Player</th><th style="text-align:left;padding:6px 10px;">Status</th></tr>
        {rows_html}
      </table>
      <p style="color:#999;font-size:12px;margin-top:16px;">Sent by the Load &amp; Recovery Platform admin.</p>
    </div>"""
    await _send_email(f"{team['team_name']} — squad summary", html, to=[norm_email(payload.to_email)])
    return {"message": f"Summary sent to {payload.to_email}"}
