import { fetchWithAuth } from "@/shared/api/fetchWithAuth";
import { API_URL } from "@/shared/api/apiBase";
import { handleApiResponse } from "@/shared/api/handleApiResponse";

export const getPositionsApi = async (filters = {}) => {
  const params = new URLSearchParams();
  if (filters.departmentId) params.append("departmentId", filters.departmentId);
  if (filters.teamId) params.append("teamId", filters.teamId);
  if (filters.status) params.append("status", filters.status);

  const url = params.toString()
    ? `${API_URL}/positions?${params}`
    : `${API_URL}/positions`;
  const response = await fetchWithAuth(url);
  return handleApiResponse(response);
};

export const getPositionApi = async (positionId) => {
  const response = await fetchWithAuth(`${API_URL}/positions/${positionId}`);
  return handleApiResponse(response);
};

export const createPositionApi = async (position) => {
  const response = await fetchWithAuth(`${API_URL}/positions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(position),
  });
  return handleApiResponse(response);
};

export const updatePositionApi = async (position) => {
  const response = await fetchWithAuth(`${API_URL}/positions/${position.id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(position),
  });
  return handleApiResponse(response);
};

export const deletePositionApi = async (positionId) => {
  const response = await fetchWithAuth(`${API_URL}/positions/${positionId}`, {
    method: "DELETE",
  });
  return handleApiResponse(response);
};
