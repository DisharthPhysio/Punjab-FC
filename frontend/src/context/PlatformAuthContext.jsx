import { createContext, useContext, useEffect, useState, useCallback } from "react";
import apiV2 from "@/lib/apiV2";

const PlatformAuthContext = createContext(null);

export function PlatformAuthProvider({ children }) {
  const [role, setRole] = useState(() => localStorage.getItem("pfc_role") || null); // "athlete" | "admin" | "team_athlete" | null
  const [user, setUser] = useState(null); // null = checking, false = logged out, obj = logged in
  const [teams, setTeams] = useState([]); // admin's linked teams
  const [team, setTeam] = useState(null); // team_athlete's own team {id, team_name}
  const [loading, setLoading] = useState(true);

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
        setRole("admin"); setUser(res.data.admin); setTeams(res.data.teams || []); setTeam(null);
      } else if (savedRole === "team_athlete") {
        const res = await apiV2.get("/team/mine");
        setRole("team_athlete"); setUser(res.data.player); setTeam(res.data.team); setTeams([]);
      } else {
        throw new Error("unknown role");
      }
    } catch {
      localStorage.removeItem("pfc_token");
      localStorage.removeItem("pfc_role");
      setUser(false);
      setRole(null);
      setTeam(null);
      setTeams([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = async (newRole, token, userData) => {
    localStorage.setItem("pfc_token", token);
    localStorage.setItem("pfc_role", newRole);
    setRole(newRole);
    setUser(userData); // optimistic; refresh() below confirms and fills in teams/team
    await refresh();
  };

  const logout = () => {
    localStorage.removeItem("pfc_token");
    localStorage.removeItem("pfc_role");
    setRole(null);
    setUser(false);
    setTeams([]);
    setTeam(null);
  };

  return (
    <PlatformAuthContext.Provider value={{ role, user, teams, team, loading, login, logout, refresh }}>
      {children}
    </PlatformAuthContext.Provider>
  );
}

export const usePlatformAuth = () => useContext(PlatformAuthContext);
