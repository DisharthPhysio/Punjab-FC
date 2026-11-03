import { createContext, useContext, useEffect, useState, useCallback } from "react";
import apiV2 from "@/lib/apiV2";

const PlatformAuthContext = createContext(null);
const TEAM_KEY = "pfc_team_id";

export function PlatformAuthProvider({ children }) {
  const [role, setRole] = useState(() => localStorage.getItem("pfc_role") || null); // "athlete" | "admin" | "team_athlete" | null
  const [user, setUser] = useState(null); // null = checking, false = logged out, obj = logged in
  const [teams, setTeams] = useState([]); // admin's linked teams
  const [activeTeamId, setActiveTeamIdState] = useState(() => localStorage.getItem(TEAM_KEY) || null); // which of them the admin is working in
  const [team, setTeam] = useState(null); // team_athlete's own team {id, team_name}
  const [loading, setLoading] = useState(true);
  const [hasRecovery, setHasRecovery] = useState(true); // false -> the one-time "set a recovery question" screen is shown
  const [connectionError, setConnectionError] = useState(false); // server unreachable (NOT the same as being logged out)

  // The localStorage write happens first, synchronously, because the API layer reads it from there.
  const setActiveTeam = useCallback((id) => {
    if (id) localStorage.setItem(TEAM_KEY, id); else localStorage.removeItem(TEAM_KEY);
    setActiveTeamIdState(id || null);
  }, []);

  // Only a real rejection from the server (401/403/404 on the account) logs someone out. A sleeping server, a
  // dropped connection or a 5xx must NOT wipe a saved login: that is what used to make athletes sign in again.
  const isAuthRejection = (err) => [401, 403].includes(err?.response?.status);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  const refresh = useCallback(async () => {
    const token = localStorage.getItem("pfc_token");
    const savedRole = localStorage.getItem("pfc_role");
    if (!token || !savedRole) {
      setUser(false);
      setLoading(false);
      return;
    }
    setConnectionError(false);
    const fetchMe = async () => {
      if (savedRole === "athlete") return apiV2.get("/athlete/me");
      if (savedRole === "admin") return apiV2.get("/admin/me");
      if (savedRole === "team_athlete") return apiV2.get("/team/mine");
      throw Object.assign(new Error("unknown role"), { response: { status: 401 } });
    };
    try {
      let res, lastErr;
      for (const wait of [0, 1500, 4000, 9000]) { // a free-tier server can take a while to wake up
        if (wait) await sleep(wait);
        try { res = await fetchMe(); break; } catch (err) { lastErr = err; if (isAuthRejection(err)) throw err; }
      }
      if (!res) throw lastErr;
      // sliding renewal: every visit hands back a fresh long-lived token, so regular users never expire
      if (res.data.token) localStorage.setItem("pfc_token", res.data.token);
      if (savedRole === "athlete") {
        setRole("athlete"); setUser(res.data.athlete); setTeams([]); setTeam(null); setHasRecovery(!!res.data.has_recovery);
      } else if (savedRole === "admin") {
        const list = res.data.teams || [];
        setRole("admin"); setUser(res.data.admin); setTeams(list); setTeam(null); setHasRecovery(!!res.data.has_recovery);
        // keep the remembered team if this account still has it, otherwise fall back to the first one
        const saved = localStorage.getItem(TEAM_KEY);
        setActiveTeam(list.some((t) => t.id === saved) ? saved : list[0]?.id || null);
      } else {
        setRole("team_athlete"); setUser(res.data.player); setTeam(res.data.team); setTeams([]); setHasRecovery(true);
      }
    } catch (err) {
      if (isAuthRejection(err)) {
        localStorage.removeItem("pfc_token");
        localStorage.removeItem("pfc_role");
        setActiveTeam(null);
        setUser(false);
        setRole(null);
        setTeam(null);
        setTeams([]);
      } else {
        setConnectionError(true); // keep the saved login; the app offers a Retry
        setUser((u) => (u === null ? false : u));
      }
    } finally {
      setLoading(false);
    }
  }, [setActiveTeam]);

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** options.teamId: select this team straight away (used right after creating one). */
  const login = async (newRole, token, userData, options = {}) => {
    setLoading(true); // hold the screens (spinner) until refresh() has confirmed the account, incl. whether it still needs a recovery question
    localStorage.setItem("pfc_token", token);
    localStorage.setItem("pfc_role", newRole);
    // never carry a previous account's team over to a new login
    setActiveTeam(options.teamId || null);
    setRole(newRole);
    setUser(userData); // optimistic; refresh() below confirms and fills in teams/team
    await refresh();
  };

  const logout = () => {
    localStorage.removeItem("pfc_token");
    localStorage.removeItem("pfc_role");
    setActiveTeam(null);
    setRole(null);
    setUser(false);
    setTeams([]);
    setTeam(null);
    setConnectionError(false);
  };

  const activeTeam = teams.find((t) => t.id === activeTeamId) || teams[0] || null;

  return (
    <PlatformAuthContext.Provider value={{ role, user, teams, team, activeTeam, activeTeamId: activeTeam?.id || null, setActiveTeam, loading, login, logout, refresh, hasRecovery, connectionError }}>
      {children}
    </PlatformAuthContext.Provider>
  );
}

export const usePlatformAuth = () => useContext(PlatformAuthContext);
