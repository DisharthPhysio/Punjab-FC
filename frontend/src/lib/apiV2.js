import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api/v2`;

const apiV2 = axios.create({ baseURL: API });

apiV2.interceptors.request.use((config) => {
  const token = localStorage.getItem("pfc_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export { formatApiError } from "@/lib/api";
export default apiV2;
