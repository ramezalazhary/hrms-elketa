import { fetchWithAuth } from "@/shared/api/fetchWithAuth";
import { API_URL } from "@/shared/api/apiBase";
import { buildAttendanceQueryParams } from "./utils";

async function handleResponse(response) {
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    return Promise.reject(error);
  }
  return response.json();
}

/**
 * @param {{ startDate?: string, endDate?: string, employeeCode?: string }} params
 * @returns {Promise<Array>} Attendance documents (employeeId populated when applicable).
 */
export const getAttendanceApi = async (params = {}) => {
  const query = buildAttendanceQueryParams(params);
  const url = query ? `${API_URL}/attendance?${query}` : `${API_URL}/attendance`;
  const response = await fetchWithAuth(url);
  const data = await handleResponse(response);
  return Array.isArray(data) ? data : [];
};

export const createAttendanceApi = async (data) => {
  const response = await fetchWithAuth(`${API_URL}/attendance`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return handleResponse(response);
};

export const updateAttendanceApi = async (id, data) => {
  const response = await fetchWithAuth(`${API_URL}/attendance/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return handleResponse(response);
};

export const deleteAttendanceApi = async (id) => {
  const response = await fetchWithAuth(`${API_URL}/attendance/${id}`, {
    method: "DELETE",
  });
  return handleResponse(response);
};

export const deleteAttendanceBulkApi = async (ids) => {
  const response = await fetchWithAuth(`${API_URL}/attendance/bulk`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids }),
  });
  return handleResponse(response);
};

export const importAttendanceApi = async (file, overwrite = false) => {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("overwrite", overwrite.toString());
  
  const response = await fetchWithAuth(`${API_URL}/attendance/import`, {
    method: "POST",
    body: formData,
  });
  return handleResponse(response);
};

/**
 * Downloads the attendance import template for Excel
 */
export const downloadAttendanceTemplateApi = async () => {
  const response = await fetchWithAuth(`${API_URL}/attendance/template`);
  if (!response.ok) throw new Error("Failed to download template");
  
  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "AttendanceTemplate.xlsx";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
};
