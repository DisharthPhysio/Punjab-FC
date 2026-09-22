import { createContext, useContext, useEffect, useState, useCallback } from "react";
import apiV2 from "@/lib/apiV2";

const PlatformAuthContext = createContext(null);

export function PlatformAuthProvider({ children }) {
  const [role, setRole] = useState(() => localStorage.getItem("pfc_role") || null); // "athlete" | "admin" | null
  const [user, setUser] = useState(null); // null = checking, false = logged out, obj = logged in
  const [teams, setTeams] = useState([]);
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
      const res = await apiV2.get(`/${savedRole}/me`);
      setRole(savedRole);
      setUser(savedRole === "athlete" ? res.data.athlete : res.data.admin);
      setTeams(res.data.teams || []);
    } catch {
      localStorage.removeItem("pfc_token");
      localStorage.removeItem("pfc_role");
      setUser(false);
      setRole(null);
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
    setUser(userData); // optimistic; refresh() below confirms and fills in `teams`
    await refresh();
  };

  const logout = () => {
    localStorage.removeItem("pfc_token");
    localStorage.removeItem("pfc_role");
    setRole(null);
    setUser(false);
    setTeams([]);
  };

  return (
    <PlatformAuthContext.Provider value={{ role, user, teams, loading, login, logout, refresh }}>
      {children}
    </PlatformAuthContext.Provider>
  );
}

export const usePlatformAuth = () => useContext(PlatformAuthContext);
