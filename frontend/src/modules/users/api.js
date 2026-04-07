import { fetchWithAuth } from "@/shared/api/fetchWithAuth";
import { API_URL } from "@/shared/api/apiBase";
import { handleApiResponse } from "@/shared/api/handleApiResponse";

export async function getUsersApi() {
  const response = await fetchWithAuth(`${API_URL}/users`);
  return handleApiResponse(response);
}

export async function updateUserRoleApi(userId, role) {
  const response = await fetchWithAuth(`${API_URL}/users/${userId}/role`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role }),
  });
  return handleApiResponse(response);
}

export async function createUserApi(payload) {
  const response = await fetchWithAuth(`${API_URL}/users`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleApiResponse(response);
}

export async function getPasswordRequestsApi() {
  const response = await fetchWithAuth(`${API_URL}/auth/password-requests`);
  return handleApiResponse(response);
}

export async function forceResetPasswordApi(email, newPassword) {
  const response = await fetchWithAuth(`${API_URL}/auth/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ targetEmail: email, newPassword }),
  });
  return handleApiResponse(response);
}
