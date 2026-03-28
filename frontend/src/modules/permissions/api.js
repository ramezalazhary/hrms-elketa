import { fetchWithAuth } from "@/shared/api/fetchWithAuth";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

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
