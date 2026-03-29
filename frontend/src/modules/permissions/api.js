import { fetchWithAuth } from "@/shared/api/fetchWithAuth";
import { API_URL } from "@/shared/api/apiBase";

function handleResponse(response) {
  if (!response.ok) {
    return response.json().then((error) => Promise.reject(error));
  }
  return response.json();
}

export async function getUserPermissionsApi(userId) {
  const response = await fetchWithAuth(`${API_URL}/permissions/${userId}`);
  return handleResponse(response);
}

export async function replaceUserPermissionsApi(userId, permissions) {
  const response = await fetchWithAuth(`${API_URL}/permissions/${userId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ permissions }),
  });
  return handleResponse(response);
}

export async function deleteUserPermissionsApi(userId) {
  const response = await fetchWithAuth(`${API_URL}/permissions/${userId}`, {
    method: "DELETE",
  });
  return handleResponse(response);
}
