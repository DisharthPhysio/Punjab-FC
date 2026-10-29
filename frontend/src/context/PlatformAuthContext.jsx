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

  // The localStorage write happens first, synchronously, because the API layer reads it from there.
  const setActiveTeam = useCallback((id) => {
    if (id) localStorage.setItem(TEAM_KEY, id); else localStorage.removeItem(TEAM_KEY);
    setActiveTeamIdState(id || null);
  }, []);

  const refresh = useCallback(async () => {
    const token = localStorage.getItem("pfc_token");
    const savedRole = localStorage.getItem("pfc_role");
    if (!token || !savedRole) {
      setUser(false);
      setLoading(false);
      return;
    }
    try {
      if (savedRole === "athlete") {
        const res = await apiV2.get("/athlete/me");
        setRole("athlete"); setUser(res.data.athlete); setTeams([]); setTeam(null);
      } else if (savedRole === "admin") {
        const res = await apiV2.get("/admin/me");
        const list = res.data.teams || [];
        setRole("admin"); setUser(res.data.admin); setTeams(list); setTeam(null);
        // keep the remembered team if this account still has it, otherwise fall back to the first one
        const saved = localStorage.getItem(TEAM_KEY);
        setActiveTeam(list.some((t) => t.id === saved) ? saved : list[0]?.id || null);
      } else if (savedRole === "team_athlete") {
        const res = await apiV2.get("/team/mine");
        setRole("team_athlete"); setUser(res.data.player); setTeam(res.data.team); setTeams([]);
      } else {
        throw new Error("unknown role");
      }
    } catch {
      localStorage.removeItem("pfc_token");
      localStorage.removeItem("pfc_role");
      setActiveTeam(null);
      setUser(false);
      setRole(null);
      setTeam(null);
      setTeams([]);
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
  };

  const activeTeam = teams.find((t) => t.id === activeTeamId) || teams[0] || null;

  return (
    <PlatformAuthContext.Provider value={{ role, user, teams, team, activeTeam, activeTeamId: activeTeam?.id || null, setActiveTeam, loading, login, logout, refresh }}>
      {children}
    </PlatformAuthContext.Provider>
  );
}

export const usePlatformAuth = () => useContext(PlatformAuthContext);
