import { fetchWithAuth } from "@/shared/api/fetchWithAuth";
import { API_URL } from "@/shared/api/apiBase";
import { handleApiResponse } from "@/shared/api/handleApiResponse";

export async function getBranchesApi() {
  const response = await fetchWithAuth(`${API_URL}/branches`);
  return handleApiResponse(response);
}
