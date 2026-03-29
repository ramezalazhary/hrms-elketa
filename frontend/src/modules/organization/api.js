import { fetchWithAuth } from "@/shared/api/fetchWithAuth";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

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
