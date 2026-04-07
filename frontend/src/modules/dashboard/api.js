import { fetchWithAuth } from "@/shared/api/fetchWithAuth";
import { API_URL } from "@/shared/api/apiBase";
import { handleApiResponse } from "@/shared/api/handleApiResponse";

export async function getDashboardAlertsApi() {
  const response = await fetchWithAuth(`${API_URL}/dashboard/alerts`);
  return handleApiResponse(response);
}

export async function getDashboardMetricsApi() {
  const response = await fetchWithAuth(`${API_URL}/dashboard/metrics`);
  return handleApiResponse(response);
}

export async function listManagementRequestsApi() {
  const response = await fetchWithAuth(`${API_URL}/management-requests`);
  return handleApiResponse(response);
}

export async function createManagementRequestApi(body) {
  const response = await fetchWithAuth(`${API_URL}/management-requests`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return handleApiResponse(response);
}

export async function updateManagementRequestStatusApi(id, status) {
  const response = await fetchWithAuth(`${API_URL}/management-requests/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  return handleApiResponse(response);
}

