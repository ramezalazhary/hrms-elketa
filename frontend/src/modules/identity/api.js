import { getAuthHeaders } from "@/shared/api/fetchWithAuth";

/** Base URL for REST calls; must match Vite `VITE_API_URL` (no trailing `/api` duplication in paths below). */
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

/**
 * @param {Response} response Fetch response.
 * @returns {Promise<any>} Parsed JSON, or rejected promise with server error body.
 */
function handleResponse(response) {
  if (!response.ok) {
    return response.json().then((error) => Promise.reject(error));
  }
  return response.json();
}

/**
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{ accessToken: string, refreshToken: string, user: object }>}
 */
export const loginApi = async (email, password) => {
  const response = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  return handleResponse(response);
};

/**
 * @param {string} refreshToken
 * @returns {Promise<{ accessToken: string, refreshToken: string }>}
 */
export const refreshTokenApi = async (refreshToken) => {
  const response = await fetch(`${API_URL}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });

  return handleResponse(response);
};

/**
 * Blacklists access token server-side; requires `Authorization` header.
 * @returns {Promise<object>}
 * @throws {Error} When response not OK (local state should still clear).
 */
export const logoutApi = async () => {
  const response = await fetch(`${API_URL}/auth/logout`, {
    method: "POST",
    headers: getAuthHeaders(),
  });

  if (response.ok) {
    return response.json();
  }
  throw new Error("Logout failed");
};

/**
 * @param {string} currentPassword
 * @param {string} newPassword
 * @returns {Promise<object>} Success message JSON.
 */
export const changePasswordApi = async (currentPassword, newPassword) => {
  const response = await fetch(`${API_URL}/auth/change-password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify({ currentPassword, newPassword }),
  });

  return handleResponse(response);
};

/**
 * Public: request a password reset (creates a pending row for Admin / HR head).
 * @param {string} email
 * @returns {Promise<{ message: string }>}
 */
export const forgotPasswordApi = async (email) => {
  const response = await fetch(`${API_URL}/auth/forgot-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  return handleResponse(response);
};
