import axios from "axios";

const getApiUrl = () => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }

  return '/api';
};

const api = axios.create({ baseURL: getApiUrl() });

export default api;
