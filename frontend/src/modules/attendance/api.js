import { fetchWithAuth } from "@/shared/api/fetchWithAuth";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

async function handleResponse(response) {
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    return Promise.reject(error);
  }
  return response.json();
}

export const getAttendanceApi = async (params) => {
  const query = new URLSearchParams(params).toString();
  const response = await fetchWithAuth(`${API_URL}/attendance?${query}`);
  return handleResponse(response);
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
