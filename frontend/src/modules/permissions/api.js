import { fetchWithAuth } from "@/shared/api/fetchWithAuth";
import { API_URL } from "@/shared/api/apiBase";
import { handleApiResponse } from "@/shared/api/handleApiResponse";

export async function getUserPermissionsApi(userId) {
  const response = await fetchWithAuth(`${API_URL}/permissions/${userId}`);
  return handleApiResponse(response);
}

export async function replaceUserPermissionsApi(userId, permissions) {
  const response = await fetchWithAuth(`${API_URL}/permissions/${userId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ permissions }),
  });
  return handleApiResponse(response);
}

export async function deleteUserPermissionsApi(userId) {
  const response = await fetchWithAuth(`${API_URL}/permissions/${userId}`, {
    method: "DELETE",
  });
  return handleApiResponse(response);
}

export async function simulateAccessApi(payload) {
  const response = await fetchWithAuth(`${API_URL}/permissions/simulate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleApiResponse(response);
}

export async function updateHrTemplatesApi(userId, payload) {
  const response = await fetchWithAuth(`${API_URL}/permissions/hr-templates/${userId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleApiResponse(response);
}

export async function getPageCatalogApi() {
  const response = await fetchWithAuth(`${API_URL}/permissions/page-catalog`);
  return handleApiResponse(response);
}

export async function resolvePagePreviewApi(payload) {
  const response = await fetchWithAuth(`${API_URL}/permissions/resolve-preview`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleApiResponse(response);
}

export async function getPageOverridesApi(userId) {
  const response = await fetchWithAuth(`${API_URL}/permissions/page-overrides/${userId}`);
  return handleApiResponse(response);
}

export async function updatePageOverridesApi(userId, overrides) {
  const response = await fetchWithAuth(`${API_URL}/permissions/page-overrides/${userId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ overrides }),
  });
  return handleApiResponse(response);
}
