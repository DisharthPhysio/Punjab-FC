"""
Phase 1 — multi-tenant platform routes (Athlete / Team / Admin).

This module is deliberately kept separate from server.py's original single-team
coach routes so the existing (working, tested) code path is left untouched.
server.py calls init(...) once at import time to hand over its already-built
db handle, email sender, password helpers, JWT secret, and day/time helpers,
then mounts `platform_router` alongside its own `api_router`.

New collections introduced here:
  athletes       - individual athlete accounts (email + password)
  admins         - team-owner / admin accounts (email + password)
  teams          - one doc per team: name, 6-digit athlete_code, 6-digit admin_code
  team_players   - roster slots an admin creates; an athlete "claims" one by name
  checkins_v2    - daily check-ins, either context="individual" or context="team"

Auth model:
  - An Athlete always authenticates with their own email/password (JWT type="athlete").
    From their account they can check in individually AND/OR join any number of teams
    by entering that team's 6-digit athlete code and confirming their name on the roster.
  - A Team is created by an Admin (email/password, JWT type="admin"). Registering a new
    team both creates the team and verifies that admin as its owner. A *different* person
    who needs access to an existing team (e.g. a physio) creates their own admin account
    and links it to that team by entering the team's 6-digit admin code.
"""
import re
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import List, Literal, Optional

import jwt
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

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
    await _db.teams.create_index("athlete_code", unique=True)
    await _db.teams.create_index("admin_code", unique=True)
    await _db.team_players.create_index([("team_id", 1)])
    await _db.team_players.create_index([("claimed_by_athlete_id", 1)])
    await _db.checkins_v2.create_index(
        [("athlete_id", 1), ("context", 1), ("team_id", 1), ("date", 1)], unique=True
    )


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
    if not stored_code or stored_code != (submitted or "").strip():
        return False
    return _parse_iso(stored_expiry) >= _now_utc()


def make_token(sub: str, ttype: str, days: int = 30) -> str:
    payload = {"sub": sub, "type": ttype, "exp": _now_utc() + timedelta(days=days)}
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


# ---------- email templates ----------
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


async def send_code_email(to_email: str, code: str, purpose: Literal["verify", "reset"]):
    if purpose == "verify":
        subject = "Verify your email"
        html = _code_email_html("Confirm your email", code, "Enter this code to verify your account.")
    else:
        subject = "Your password reset code"
        html = _code_email_html("Reset your password", code, "Enter this code to set a new password.")
    await _send_email(subject, html, to=[to_email])


# ---------- payload models ----------
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


class VerifyPayload(BaseModel):
    email: str
    code: str


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


class ClaimPayload(BaseModel):
    code: str
    player_id: str


class CheckInV2Payload(BaseModel):
    context: Literal["individual", "team"]
    team_id: Optional[str] = None
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
    logSession: bool = False
    sessionType: Optional[str] = ""
    rpe: Optional[int] = 0
    duration: Optional[int] = 0
    notes: Optional[str] = ""


def _password_ok(pw: str):
    if len(pw or "") < 6:
        raise HTTPException(400, "Password must be at least 6 characters")


# ================= Athlete auth =================
@platform_router.post("/athlete/signup")
async def athlete_signup(payload: AthleteSignup):
    email = norm_email(payload.email)
    if not valid_email(email):
        raise HTTPException(400, "Enter a valid email address")
    if not payload.name.strip():
        raise HTTPException(400, "Enter your name")
    _password_ok(payload.password)

    existing = await _db.athletes.find_one({"email": email})
    code = gen_code()
    if existing:
        if existing.get("verified"):
            raise HTTPException(409, "An account with this email already exists. Try logging in.")
        await _db.athletes.update_one({"email": email}, {"$set": {
            "name": payload.name.strip(), "password_hash": _hash_password(payload.password),
            "verify_code": code, "verify_code_expires": code_expiry().isoformat(),
        }})
    else:
        await _db.athletes.insert_one({
            "id": str(uuid.uuid4()), "name": payload.name.strip(), "email": email,
            "password_hash": _hash_password(payload.password), "verified": False,
            "verify_code": code, "verify_code_expires": code_expiry().isoformat(),
            "reset_code": None, "reset_code_expires": None,
            "created_at": _now_utc().isoformat(),
        })
    await send_code_email(email, code, "verify")
    return {"message": "Verification code sent to your email."}


@platform_router.post("/athlete/verify")
async def athlete_verify(payload: VerifyPayload):
    email = norm_email(payload.email)
    athlete = await _db.athletes.find_one({"email": email})
    if not athlete:
        raise HTTPException(404, "Account not found")
    if not athlete.get("verified"):
        if not code_is_valid(athlete.get("verify_code"), athlete.get("verify_code_expires"), payload.code):
            raise HTTPException(400, "That code is invalid or has expired.")
        await _db.athletes.update_one({"email": email}, {"$set": {"verified": True, "verify_code": None, "verify_code_expires": None}})
    token = make_token(athlete["id"], "athlete")
    return {"token": token, "athlete": {"id": athlete["id"], "name": athlete["name"], "email": email}}


@platform_router.post("/athlete/login")
async def athlete_login(payload: LoginPayload):
    email = norm_email(payload.email)
    athlete = await _db.athletes.find_one({"email": email})
    if not athlete or not _verify_password(payload.password, athlete["password_hash"]):
        raise HTTPException(401, "Incorrect email or password")
    if not athlete.get("verified"):
        code = gen_code()
        await _db.athletes.update_one({"email": email}, {"$set": {"verify_code": code, "verify_code_expires": code_expiry().isoformat()}})
        await send_code_email(email, code, "verify")
        raise HTTPException(403, "Please verify your email first — we've sent a new code.")
    token = make_token(athlete["id"], "athlete")
    return {"token": token, "athlete": {"id": athlete["id"], "name": athlete["name"], "email": email}}


@platform_router.post("/athlete/forgot-password")
async def athlete_forgot(payload: ForgotPayload):
    email = norm_email(payload.email)
    athlete = await _db.athletes.find_one({"email": email})
    if athlete:
        code = gen_code()
        await _db.athletes.update_one({"email": email}, {"$set": {"reset_code": code, "reset_code_expires": code_expiry().isoformat()}})
        await send_code_email(email, code, "reset")
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
    memberships = await _db.team_players.find({"claimed_by_athlete_id": athlete["id"]}, {"_id": 0}).to_list(20)
    team_ids = list({m["team_id"] for m in memberships})
    names = {}
    if team_ids:
        async for t in _db.teams.find({"id": {"$in": team_ids}}, {"_id": 0, "id": 1, "team_name": 1}):
            names[t["id"]] = t["team_name"]
    for m in memberships:
        m["team_name"] = names.get(m["team_id"], "Team")
    return {"athlete": athlete, "teams": memberships}


# ================= Team join (by an authenticated athlete) =================
@platform_router.post("/team/lookup")
async def team_lookup(payload: TeamCodePayload, athlete: dict = Depends(get_current_athlete)):
    team = await _db.teams.find_one({"athlete_code": payload.code.strip()}, {"_id": 0})
    if not team:
        raise HTTPException(404, "No team found for that code")
    mine = await _db.team_players.find_one({"team_id": team["id"], "claimed_by_athlete_id": athlete["id"]}, {"_id": 0})
    if mine:
        return {"team": {"id": team["id"], "team_name": team["team_name"]}, "claimed": mine, "available_players": []}
    players = await _db.team_players.find(
        {"team_id": team["id"], "claimed_by_athlete_id": None}, {"_id": 0}
    ).sort("name", 1).to_list(500)
    return {"team": {"id": team["id"], "team_name": team["team_name"]}, "claimed": None, "available_players": players}


@platform_router.post("/team/claim")
async def team_claim(payload: ClaimPayload, athlete: dict = Depends(get_current_athlete)):
    team = await _db.teams.find_one({"athlete_code": payload.code.strip()})
    if not team:
        raise HTTPException(404, "No team found for that code")
    player = await _db.team_players.find_one({"id": payload.player_id, "team_id": team["id"]})
    if not player:
        raise HTTPException(404, "Player not found on this team's roster")
    if player.get("claimed_by_athlete_id") and player["claimed_by_athlete_id"] != athlete["id"]:
        raise HTTPException(409, "That name has already been claimed by another athlete. Contact your team admin.")
    already = await _db.team_players.find_one({"team_id": team["id"], "claimed_by_athlete_id": athlete["id"]})
    if already and already["id"] != player["id"]:
        raise HTTPException(409, f"You're already registered on this team as {already['name']}.")
    await _db.team_players.update_one({"id": player["id"]}, {"$set": {"claimed_by_athlete_id": athlete["id"]}})
    player["claimed_by_athlete_id"] = athlete["id"]
    player.pop("_id", None)
    return {"team": {"id": team["id"], "team_name": team["team_name"]}, "player": player}


# ================= Team registration & Admin auth =================
@platform_router.post("/team/register")
async def team_register(payload: TeamRegisterPayload):
    email = norm_email(payload.email)
    if not valid_email(email):
        raise HTTPException(400, "Enter a valid email address")
    if not payload.team_name.strip():
        raise HTTPException(400, "Enter a team name")
    _password_ok(payload.password)

    existing = await _db.admins.find_one({"email": email})
    code = gen_code()
    if existing:
        if existing.get("verified"):
            raise HTTPException(409, "An account with this email already exists. Try Admin Access instead.")
        admin_id = existing["id"]
        await _db.admins.update_one({"email": email}, {"$set": {
            "password_hash": _hash_password(payload.password),
            "verify_code": code, "verify_code_expires": code_expiry().isoformat(),
        }})
        team_ids = existing.get("team_ids") or []
        team_id = team_ids[0] if team_ids else None
        if team_id:
            await _db.teams.update_one({"id": team_id}, {"$set": {"team_name": payload.team_name.strip()}})
    else:
        admin_id = str(uuid.uuid4())
        await _db.admins.insert_one({
            "id": admin_id, "email": email, "password_hash": _hash_password(payload.password),
            "verified": False, "verify_code": code, "verify_code_expires": code_expiry().isoformat(),
            "reset_code": None, "reset_code_expires": None,
            "team_ids": [], "created_at": _now_utc().isoformat(),
        })
        team_id = None

    if not team_id:
        team_id = str(uuid.uuid4())
        athlete_code = await unique_team_code("athlete_code")
        admin_code = await unique_team_code("admin_code")
        await _db.teams.insert_one({
            "id": team_id, "team_name": payload.team_name.strip(), "owner_admin_id": admin_id,
            "athlete_code": athlete_code, "admin_code": admin_code, "verified": False,
            "created_at": _now_utc().isoformat(),
        })
        await _db.admins.update_one({"id": admin_id}, {"$addToSet": {"team_ids": team_id}})

    await send_code_email(email, code, "verify")
    return {"message": "Verification code sent to your email."}


@platform_router.post("/team/verify")
async def team_verify(payload: VerifyPayload):
    email = norm_email(payload.email)
    admin = await _db.admins.find_one({"email": email})
    if not admin:
        raise HTTPException(404, "Account not found")
    if not admin.get("verified"):
        if not code_is_valid(admin.get("verify_code"), admin.get("verify_code_expires"), payload.code):
            raise HTTPException(400, "That code is invalid or has expired.")
        await _db.admins.update_one({"email": email}, {"$set": {"verified": True, "verify_code": None, "verify_code_expires": None}})
        await _db.teams.update_many({"owner_admin_id": admin["id"]}, {"$set": {"verified": True}})
    token = make_token(admin["id"], "admin")
    team = await _db.teams.find_one({"owner_admin_id": admin["id"]}, {"_id": 0})
    return {"token": token, "admin": {"id": admin["id"], "email": email}, "team": team}


@platform_router.post("/admin/signup")
async def admin_signup(payload: AdminSignup):
    """For someone who needs access to an EXISTING team (e.g. a physio) rather than
    creating a new one. Creates an admin account with no team attached; they link to
    a team afterwards via /admin/link-team using that team's admin code (item 8)."""
    email = norm_email(payload.email)
    if not valid_email(email):
        raise HTTPException(400, "Enter a valid email address")
    _password_ok(payload.password)

    existing = await _db.admins.find_one({"email": email})
    code = gen_code()
    if existing:
        if existing.get("verified"):
            raise HTTPException(409, "An account with this email already exists. Try logging in.")
        await _db.admins.update_one({"email": email}, {"$set": {
            "password_hash": _hash_password(payload.password),
            "verify_code": code, "verify_code_expires": code_expiry().isoformat(),
        }})
    else:
        await _db.admins.insert_one({
            "id": str(uuid.uuid4()), "email": email, "password_hash": _hash_password(payload.password),
            "verified": False, "verify_code": code, "verify_code_expires": code_expiry().isoformat(),
            "reset_code": None, "reset_code_expires": None,
            "team_ids": [], "created_at": _now_utc().isoformat(),
        })
    await send_code_email(email, code, "verify")
    return {"message": "Verification code sent to your email."}


@platform_router.post("/admin/verify")
async def admin_verify(payload: VerifyPayload):
    email = norm_email(payload.email)
    admin = await _db.admins.find_one({"email": email})
    if not admin:
        raise HTTPException(404, "Account not found")
    if not admin.get("verified"):
        if not code_is_valid(admin.get("verify_code"), admin.get("verify_code_expires"), payload.code):
            raise HTTPException(400, "That code is invalid or has expired.")
        await _db.admins.update_one({"email": email}, {"$set": {"verified": True, "verify_code": None, "verify_code_expires": None}})
    token = make_token(admin["id"], "admin")
    teams = await _db.teams.find({"id": {"$in": admin.get("team_ids") or []}}, {"_id": 0}).to_list(50)
    return {"token": token, "admin": {"id": admin["id"], "email": email}, "needs_code": len(teams) == 0, "teams": teams}


@platform_router.post("/admin/login")
async def admin_login(payload: LoginPayload):
    email = norm_email(payload.email)
    admin = await _db.admins.find_one({"email": email})
    if not admin or not _verify_password(payload.password, admin["password_hash"]):
        raise HTTPException(401, "Incorrect email or password")
    if not admin.get("verified"):
        code = gen_code()
        await _db.admins.update_one({"email": email}, {"$set": {"verify_code": code, "verify_code_expires": code_expiry().isoformat()}})
        await send_code_email(email, code, "verify")
        raise HTTPException(403, "Please verify your email first — we've sent a new code.")
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
        await send_code_email(email, code, "reset")
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
    players = await _db.team_players.find({"team_id": team["id"]}, {"_id": 0}).sort("name", 1).to_list(500)
    return {"team_id": team["id"], "team_name": team["team_name"], "players": players}


@platform_router.post("/team/roster")
async def team_roster_add(payload: RosterPlayerPayload, team_id: Optional[str] = None, admin: dict = Depends(get_current_admin)):
    team = await _admins_team(admin, team_id)
    if not payload.name.strip():
        raise HTTPException(400, "Enter a player name")
    player = {"id": str(uuid.uuid4()), "team_id": team["id"], "name": payload.name.strip(),
              "contact": (payload.contact or "").strip(), "claimed_by_athlete_id": None,
              "created_at": _now_utc().isoformat()}
    await _db.team_players.insert_one(player)
    player.pop("_id", None)
    return player


@platform_router.delete("/team/roster/{player_id}")
async def team_roster_remove(player_id: str, team_id: Optional[str] = None, admin: dict = Depends(get_current_admin)):
    team = await _admins_team(admin, team_id)
    result = await _db.team_players.delete_one({"id": player_id, "team_id": team["id"]})
    if result.deleted_count == 0:
        raise HTTPException(404, "Player not found")
    return {"message": "Removed"}


# ================= Check-ins (individual & team, shared by any athlete) =================
@platform_router.post("/checkin")
async def submit_checkin_v2(payload: CheckInV2Payload, athlete: dict = Depends(get_current_athlete)):
    team_player_id = None
    team_id = None
    if payload.context == "team":
        if not payload.team_id:
            raise HTTPException(400, "team_id is required for a team check-in")
        player = await _db.team_players.find_one({"team_id": payload.team_id, "claimed_by_athlete_id": athlete["id"]})
        if not player:
            raise HTTPException(403, "You haven't joined this team yet")
        team_player_id = player["id"]
        team_id = payload.team_id

    today = _today_str()
    existing = await _db.checkins_v2.find_one({
        "athlete_id": athlete["id"], "context": payload.context, "team_id": team_id, "date": today,
    })
    if existing:
        raise HTTPException(409, "You've already submitted a check-in for today.")

    load = None
    if payload.logSession and payload.rpe and payload.duration:
        load = payload.rpe * payload.duration

    doc = payload.model_dump()
    doc.update({
        "id": str(uuid.uuid4()), "athlete_id": athlete["id"], "athlete_name": athlete["name"],
        "team_player_id": team_player_id, "team_id": team_id, "date": today, "load": load,
        "created_at": _now_utc().isoformat(),
    })
    try:
        await _db.checkins_v2.insert_one(dict(doc))
    except Exception:
        raise HTTPException(409, "You've already submitted a check-in for today.")
    doc.pop("_id", None)
    return doc


@platform_router.get("/checkin/mine")
async def my_checkins(context: Optional[str] = None, team_id: Optional[str] = None, limit: int = 60,
                       athlete: dict = Depends(get_current_athlete)):
    query = {"athlete_id": athlete["id"]}
    if context:
        query["context"] = context
    if team_id:
        query["team_id"] = team_id
    rows = await _db.checkins_v2.find(query, {"_id": 0}).sort("date", -1).to_list(min(limit, 200))
    return {"checkins": rows}
