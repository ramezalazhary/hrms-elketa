import { fetchWithAuth } from "@/shared/api/fetchWithAuth";
import { API_URL } from "@/shared/api/apiBase";

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

/** @param {Record<string, string>} [params] */
export const listLeaveRequestsApi = async (params) => {
  const q = params ? `?${new URLSearchParams(params).toString()}` : "";
  const response = await fetchWithAuth(`${API_URL}/leave-requests${q}`);
  return handleResponse(response);
};

/** @param {{ employeeId?: string }} [params] — omit for own balance */
export const getLeaveBalanceApi = async (params) => {
  const q = params?.employeeId
    ? `?${new URLSearchParams({ employeeId: params.employeeId }).toString()}`
    : "";
  const response = await fetchWithAuth(`${API_URL}/leave-requests/balance${q}`);
  return handleResponse(response);
};

/** HR/Admin: add manual annual leave day credits (increases vacation entitlement). */
export const postLeaveBalanceCreditApi = async ({ employeeId, days, reason }) => {
  const response = await fetchWithAuth(`${API_URL}/leave-requests/balance-credit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ employeeId, days, reason }),
  });
  return handleResponse(response);
};

/** HR/Admin: bulk vacation credits (department, employeeIds, or Admin-only all active). */
export const postLeaveBalanceCreditBulkApi = async (body) => {
  const response = await fetchWithAuth(
    `${API_URL}/leave-requests/balance-credit/bulk`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  return handleResponse(response);
};

export const createLeaveRequestApi = async (data) => {
  const response = await fetchWithAuth(`${API_URL}/leave-requests`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return handleResponse(response);
};

export const leaveRequestActionApi = async (id, body) => {
  const response = await fetchWithAuth(`${API_URL}/leave-requests/${id}/action`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return handleResponse(response);
};

export const cancelLeaveRequestApi = async (id) => {
  const response = await fetchWithAuth(`${API_URL}/leave-requests/${id}/cancel`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  return handleResponse(response);
};
