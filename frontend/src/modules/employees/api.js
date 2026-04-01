import { fetchWithAuth } from "@/shared/api/fetchWithAuth";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const handleResponse = async (response) => {
  const data = await response.json();
  if (!response.ok) throw data;
  return data;
};

// Standard Employees API (Already existed)
export const getEmployeesApi = async (params) => {
  const query = params ? `?${new URLSearchParams(params).toString()}` : "";
  const response = await fetchWithAuth(`${API_URL}/employees${query}`);
  return handleResponse(response);
};

export const createEmployeeApi = async (data) => {
  const response = await fetchWithAuth(`${API_URL}/employees`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return handleResponse(response);
};

export const updateEmployeeApi = async ({ id, ...data }) => {
  const response = await fetchWithAuth(`${API_URL}/employees/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return handleResponse(response);
};

export const getEmployeeByIdApi = async (id) => {
  const response = await fetchWithAuth(`${API_URL}/employees/${id}`);
  return handleResponse(response);
};

export const processSalaryIncreaseApi = async ({ id, ...data }) => {
  const response = await fetchWithAuth(`${API_URL}/employees/${id}/process-increase`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return handleResponse(response);
};

export const deleteEmployeeApi = async (id) => {
  const response = await fetchWithAuth(`${API_URL}/employees/${id}`, {
    method: "DELETE",
  });
  return handleResponse(response);
};

// Onboarding API (Refactored)
export const generateOnboardingApi = async (data) => {
  const response = await fetchWithAuth(`${API_URL}/onboarding/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return handleResponse(response);
};

export const verifyOnboardingTokenApi = async (token) => {
  const response = await fetch(`${API_URL}/onboarding/verify/${token}`);
  return handleResponse(response);
};

export const submitOnboardingApi = async (token, data) => {
  const response = await fetch(`${API_URL}/onboarding/submit/${token}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return handleResponse(response);
};

export const getOnboardingLinksApi = async () => {
  const response = await fetchWithAuth(`${API_URL}/onboarding/links`);
  return handleResponse(response);
};

export const stopOnboardingLinkApi = async (id) => {
  const response = await fetchWithAuth(`${API_URL}/onboarding/links/${id}/stop`, {
    method: "PATCH",
  });
  return handleResponse(response);
};

export const deleteOnboardingLinkApi = async (id) => {
  const response = await fetchWithAuth(`${API_URL}/onboarding/links/${id}`, {
    method: "DELETE",
  });
  return handleResponse(response);
};

export const getOnboardingSubmissionsApi = async () => {
  const response = await fetchWithAuth(`${API_URL}/onboarding/submissions`);
  return handleResponse(response);
};

export const processOnboardingSubmissionApi = async (id, data) => {
  const response = await fetchWithAuth(`${API_URL}/onboarding/submissions/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return handleResponse(response);
};
