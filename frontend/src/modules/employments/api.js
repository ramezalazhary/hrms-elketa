import { fetchWithAuth } from "@/shared/api/fetchWithAuth";
import { API_URL } from "@/shared/api/apiBase";
import { handleApiResponse } from "@/shared/api/handleApiResponse";

export const assignEmploymentApi = async (assignment) => {
  const response = await fetchWithAuth(`${API_URL}/employments/assign`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(assignment),
  });
  return handleApiResponse(response);
};

export const getEmployeeAssignmentsApi = async (employeeId) => {
  const response = await fetchWithAuth(`${API_URL}/employments/employee/${employeeId}`);
  return handleApiResponse(response);
};

export const unassignEmploymentApi = async (employeeId, departmentId) => {
  const response = await fetchWithAuth(`${API_URL}/employments/unassign`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ employeeId, departmentId }),
  });
  return handleApiResponse(response);
};
