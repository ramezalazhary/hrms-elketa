import { fetchWithAuth } from "@/shared/api/fetchWithAuth";
import { API_URL } from "@/shared/api/apiBase";
import { handleApiResponse } from "@/shared/api/handleApiResponse";

export async function getDocumentRequirementsApi() {
  const response = await fetchWithAuth(`${API_URL}/policy/documents`);
  return handleApiResponse(response);
}

export async function updateDocumentRequirementsApi(payload) {
  const response = await fetchWithAuth(`${API_URL}/policy/documents`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleApiResponse(response);
}

// ── Declared Company Holidays ────────────────────────────────────────────────

export async function getHolidaysApi({ year, month } = {}) {
  const params = new URLSearchParams();
  if (year != null) params.set("year", year);
  if (month != null) params.set("month", month);
  const qs = params.toString();
  const response = await fetchWithAuth(`${API_URL}/holidays${qs ? `?${qs}` : ""}`);
  return handleApiResponse(response);
}

export async function createHolidayApi(payload) {
  const response = await fetchWithAuth(`${API_URL}/holidays`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleApiResponse(response);
}

export async function updateHolidayApi(id, payload) {
  const response = await fetchWithAuth(`${API_URL}/holidays/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleApiResponse(response);
}

export async function deleteHolidayApi(id) {
  const response = await fetchWithAuth(`${API_URL}/holidays/${id}`, {
    method: "DELETE",
  });
  return handleApiResponse(response);
}
