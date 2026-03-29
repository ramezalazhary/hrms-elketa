/**
 * Single source of truth for the REST base path.
 * Must match `VITE_API_URL` in `frontend/.env` (e.g. http://localhost:5000/api).
 * Trailing slashes are removed so `${API_URL}/users` never becomes `//users`.
 * @param {unknown} raw
 * @returns {string}
 */
export function normalizeApiBaseUrl(raw) {
  return String(raw == null ? "" : raw).replace(/\/+$/, "");
}

export const API_URL = normalizeApiBaseUrl(
  import.meta.env.VITE_API_URL || "http://localhost:5000/api",
);
