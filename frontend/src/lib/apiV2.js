import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api/v2`;

const apiV2 = axios.create({ baseURL: API });

apiV2.interceptors.request.use((config) => {
  const token = localStorage.getItem("pfc_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  // An admin can own several teams. Every admin request is scoped to the team picked on the home
  // screen via ?team_id= (endpoints that don't take it simply ignore it).
  if (localStorage.getItem("pfc_role") === "admin") {
    const teamId = localStorage.getItem("pfc_team_id");
    if (teamId && !(config.params && config.params.team_id)) config.params = { ...(config.params || {}), team_id: teamId };
  }
  return config;
});

export { formatApiError } from "@/lib/api";
export default apiV2;
