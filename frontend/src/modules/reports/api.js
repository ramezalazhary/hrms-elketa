import { fetchWithAuth } from "@/shared/api/fetchWithAuth";
import { API_URL } from "@/shared/api/apiBase";
import { handleApiResponse } from "@/shared/api/handleApiResponse";

export async function getReportsSummaryApi() {
  const response = await fetchWithAuth(`${API_URL}/reports/summary`);
  return handleApiResponse(response);
}

export async function getOrgConsistencyApi() {
  const response = await fetchWithAuth(`${API_URL}/reports/org-consistency`);
  return handleApiResponse(response);
}
