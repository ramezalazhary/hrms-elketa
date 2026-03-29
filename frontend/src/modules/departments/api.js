import { fetchWithAuth } from "@/shared/api/fetchWithAuth";
import { API_URL } from "@/shared/api/apiBase";

function handleResponse(response) {
  if (!response.ok) {
    return response.json().then((error) => Promise.reject(error));
  }
  return response.json();
}

export const getDepartmentsApi = async () => {
  const response = await fetchWithAuth(`${API_URL}/departments`);
  return handleResponse(response);
};

export const createDepartmentApi = async (department) => {
  const response = await fetchWithAuth(`${API_URL}/departments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(department),
  });
  return handleResponse(response);
};

export const deleteDepartmentApi = async (departmentId) => {
  const response = await fetchWithAuth(
    `${API_URL}/departments/${departmentId}`,
    { method: "DELETE" },
  );
  return handleResponse(response);
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
  return handleResponse(response);
};
