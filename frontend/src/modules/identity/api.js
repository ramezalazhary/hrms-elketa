import { getAuthHeaders } from "@/shared/api/fetchWithAuth";

const API_URL = import.meta.env.VITE_API_URL;

function handleResponse(response) {
  if (!response.ok) {
    return response.json().then((error) => Promise.reject(error));
  }
  return response.json();
}

export const loginApi = async (email, password) => {
  const response = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  return handleResponse(response);
};

export const refreshTokenApi = async (refreshToken) => {
  const response = await fetch(`${API_URL}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });

  return handleResponse(response);
};

export const logoutApi = async () => {
  const response = await fetch(`${API_URL}/auth/logout`, {
    method: "POST",
    headers: getAuthHeaders(),
  });

  if (response.ok) {
    return response.json();
  }
  // Even if logout fails on server, we should clear local state
  throw new Error("Logout failed");
};

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
