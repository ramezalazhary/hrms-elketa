import { fetchWithAuth } from "@/shared/api/fetchWithAuth";
import { API_URL } from "@/shared/api/apiBase";

export async function getDocumentRequirementsApi() {
  const response = await fetchWithAuth(`${API_URL}/policy/documents`);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to fetch document requirements");
  }
  return response.json();
}

export async function updateDocumentRequirementsApi(documentRequirements) {
  const response = await fetchWithAuth(`${API_URL}/policy/documents`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ documentRequirements }),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to update document requirements");
  }
  return response.json();
}
