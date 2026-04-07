import { fetchWithAuth } from "@/shared/api/fetchWithAuth";
import { API_URL } from "@/shared/api/apiBase";
import { handleApiResponse } from "@/shared/api/handleApiResponse";

export async function downloadBulkTemplateApi() {
  const response = await fetchWithAuth(`${API_URL}/bulk/template`);
  if (!response.ok) {
    let body = null;
    try {
      body = await response.json();
    } catch {
      /* ignore */
    }
    throw new Error(body?.error || `Template download failed (${response.status})`);
  }
  return response.blob();
}

export async function uploadBulkFileApi(file) {
  const formData = new FormData();
  formData.append("file", file);
  const response = await fetchWithAuth(`${API_URL}/bulk/upload`, {
    method: "POST",
    body: formData,
  });
  return handleApiResponse(response);
}

export async function getAlertsFeedApi() {
  const response = await fetchWithAuth(`${API_URL}/alerts`);
  return handleApiResponse(response);
}
