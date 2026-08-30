// In Electron (file:// protocol), window.location.hostname is "" (empty string).
// We must fall back to "localhost" to avoid building invalid URLs like http://:8000.
const DEFAULT_HOST =
  (typeof window !== "undefined" && window.location.hostname)
    ? window.location.hostname
    : "localhost";

export const API_BASE_URL =
  import.meta.env.VITE_BACKEND_URL || `http://${DEFAULT_HOST}:8000`;
