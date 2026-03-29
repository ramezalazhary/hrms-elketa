import { fetchWithAuth } from "@/shared/api/fetchWithAuth";
import { API_URL } from "@/shared/api/apiBase";

/**
 * @param {Response} response
 * @returns {Promise<any>}
 */
async function handleResponse(response) {
  if (!response.ok) {
    return await response.json().then((error) => Promise.reject(error));
  }
  return await response.json();
}

/**
 * @returns {Promise<object[]>} Employees visible to the caller (server applies scope).
 */
export const getEmployeesApi = async () => {
  const response = await fetchWithAuth(`${API_URL}/employees`);
  return handleResponse(response);
};

/**
 * @param {object} employee Payload for `POST /employees`.
 * @returns {Promise<object>} Created employee (+ optional provisioning metadata).
 */
export const createEmployeeApi = async (employee) => {
  const response = await fetchWithAuth(`${API_URL}/employees`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(employee),
  });
  return handleResponse(response);
};

/**
 * @param {object} employee Must include `id` (Mongo _id string).
 * @returns {Promise<object>} Updated employee document.
 */
export const updateEmployeeApi = async (employee) => {
  const response = await fetchWithAuth(`${API_URL}/employees/${employee.id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(employee),
  });
  return handleResponse(response);
};

/**
 * @param {string} employeeId
 * @returns {Promise<object>} Deletion confirmation / body from API.
 */
export const deleteEmployeeApi = async (employeeId) => {
  const response = await fetchWithAuth(`${API_URL}/employees/${employeeId}`, {
    method: "DELETE",
  });
  return handleResponse(response);
};
