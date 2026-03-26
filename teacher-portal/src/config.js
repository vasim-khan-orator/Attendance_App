const DEFAULT_HOST = typeof window !== "undefined" ? window.location.hostname : "localhost";

export const API_BASE_URL =
  import.meta.env.VITE_BACKEND_URL || `http://${DEFAULT_HOST}:8000`;
