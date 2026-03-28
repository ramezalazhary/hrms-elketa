import { fetchWithAuth } from "@/shared/api/fetchWithAuth";
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

async function handleResponse(response) {
  if (!response.ok) {
    return await response.json().then((error) => Promise.reject(error));
  }
  return await response.json();
}

export const getEmployeesApi = async () => {
  const response = await fetchWithAuth(`${API_URL}/employees`);
  return handleResponse(response);
};

export const createEmployeeApi = async (employee) => {
  console.log(employee, "employee to create");
  const response = await fetchWithAuth(`${API_URL}/employees`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(employee),
  });
  return handleResponse(response);
};

export const updateEmployeeApi = async (employee) => {
  const response = await fetchWithAuth(`${API_URL}/employees/${employee.id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(employee),
  });
  return handleResponse(response);
};

export const deleteEmployeeApi = async (employeeId) => {
  const response = await fetchWithAuth(`${API_URL}/employees/${employeeId}`, {
    method: "DELETE",
  });
  return handleResponse(response);
};
