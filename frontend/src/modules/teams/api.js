import { fetchWithAuth } from "@/shared/api/fetchWithAuth";
import { API_URL } from "@/shared/api/apiBase";

async function handleResponse(response) {
  if (!response.ok) {
    return await response.json().then((error) => Promise.reject(error));
  }
  return await response.json();
}

export const getTeamsApi = async (filters = {}) => {
  const params = new URLSearchParams();
  if (filters.departmentId) params.append("departmentId", filters.departmentId);

  const url = params.toString()
    ? `${API_URL}/teams?${params}`
    : `${API_URL}/teams`;
  const response = await fetchWithAuth(url);
  return handleResponse(response);
};

export const getTeamApi = async (teamId) => {
  const response = await fetchWithAuth(`${API_URL}/teams/${teamId}`);
  return handleResponse(response);
};

export const createTeamApi = async (team) => {
  const response = await fetchWithAuth(`${API_URL}/teams`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(team),
  });
  return handleResponse(response);
};

export const updateTeamApi = async (team) => {
  const response = await fetchWithAuth(`${API_URL}/teams/${team.id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(team),
  });
  return handleResponse(response);
};

export const deleteTeamApi = async (teamId) => {
  const response = await fetchWithAuth(`${API_URL}/teams/${teamId}`, {
    method: "DELETE",
  });
  return handleResponse(response);
};
