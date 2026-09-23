import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api/v2`;

const apiSuperAdmin = axios.create({ baseURL: API });

apiSuperAdmin.interceptors.request.use((config) => {
  const token = localStorage.getItem("sa_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export { formatApiError } from "@/lib/api";
export default apiSuperAdmin;
