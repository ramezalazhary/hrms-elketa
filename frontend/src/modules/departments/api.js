import { fetchWithAuth } from "@/shared/api/fetchWithAuth";
import { API_URL } from "@/shared/api/apiBase";
import { handleApiResponse } from "@/shared/api/handleApiResponse";

export const getDepartmentsApi = async () => {
  const response = await fetchWithAuth(`${API_URL}/departments`);
  return handleApiResponse(response);
};

export const createDepartmentApi = async (department) => {
  const response = await fetchWithAuth(`${API_URL}/departments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(department),
  });
  return handleApiResponse(response);
};

export const deleteDepartmentApi = async (departmentId) => {
  const response = await fetchWithAuth(
    `${API_URL}/departments/${departmentId}`,
    { method: "DELETE" },
  );
  return handleApiResponse(response);
};

export const updateDepartmentApi = async (department) => {
  const response = await fetchWithAuth(
    `${API_URL}/departments/${department.id}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(department),
    },
  );
  return handleApiResponse(response);
};
