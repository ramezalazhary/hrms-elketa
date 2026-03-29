import { fetchWithAuth } from "@/shared/api/fetchWithAuth";
import { API_URL } from "@/shared/api/apiBase";

async function handleResponse(response) {
  if (!response.ok) {
    return await response.json().then((error) => Promise.reject(error));
  }
  return await response.json();
}

export const assignEmploymentApi = async (assignment) => {
  const response = await fetchWithAuth(`${API_URL}/employments/assign`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(assignment),
  });
  return handleResponse(response);
};

export const getEmployeeAssignmentsApi = async (employeeId) => {
  const response = await fetchWithAuth(`${API_URL}/employments/employee/${employeeId}`);
  return handleResponse(response);
};

export const unassignEmploymentApi = async (employeeId, departmentId) => {
  const response = await fetchWithAuth(`${API_URL}/employments/unassign`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ employeeId, departmentId }),
  });
  return handleResponse(response);
};
