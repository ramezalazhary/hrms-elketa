import { fetchWithAuth } from "@/shared/api/fetchWithAuth";
import { API_URL } from "@/shared/api/apiBase";
import { handleApiResponse } from "@/shared/api/handleApiResponse";

// Standard Employees API (Already existed)
export const getEmployeesApi = async (params) => {
  const query = params ? `?${new URLSearchParams(params).toString()}` : "";
  const response = await fetchWithAuth(`${API_URL}/employees${query}`);
  return handleApiResponse(response);
};

export const createEmployeeApi = async (data) => {
  const response = await fetchWithAuth(`${API_URL}/employees`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return handleApiResponse(response);
};

export const updateEmployeeApi = async ({ id, ...data }) => {
  const response = await fetchWithAuth(`${API_URL}/employees/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return handleApiResponse(response);
};

export const getEmployeeByIdApi = async (id) => {
  const response = await fetchWithAuth(`${API_URL}/employees/${id}`);
  return handleApiResponse(response);
};

export const processSalaryIncreaseApi = async ({ id, ...data }) => {
  const response = await fetchWithAuth(`${API_URL}/employees/${id}/process-increase`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return handleApiResponse(response);
};

export const transferEmployeeApi = async (id, data) => {
  const response = await fetchWithAuth(`${API_URL}/employees/${id}/transfer`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return handleApiResponse(response);
};

export const resetPasswordApi = async (data) => {
  const response = await fetchWithAuth(`${API_URL}/auth/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return handleApiResponse(response);
};

export const deleteEmployeeApi = async (id) => {
  const response = await fetchWithAuth(`${API_URL}/employees/${id}`, {
    method: "DELETE",
  });
  return handleApiResponse(response);
};

// Onboarding API (Refactored)
export const generateOnboardingApi = async (data) => {
  const response = await fetchWithAuth(`${API_URL}/onboarding/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return handleApiResponse(response);
};

export const verifyOnboardingTokenApi = async (token) => {
  const response = await fetch(`${API_URL}/onboarding/verify/${token}`);
  return handleApiResponse(response);
};

export const submitOnboardingApi = async (token, data) => {
  const response = await fetch(`${API_URL}/onboarding/submit/${token}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return handleApiResponse(response);
};

export const getOnboardingLinksApi = async () => {
  const response = await fetchWithAuth(`${API_URL}/onboarding/links`);
  return handleApiResponse(response);
};

export const stopOnboardingLinkApi = async (id) => {
  const response = await fetchWithAuth(`${API_URL}/onboarding/links/${id}/stop`, {
    method: "PATCH",
  });
  return handleApiResponse(response);
};

export const deleteOnboardingLinkApi = async (id) => {
  const response = await fetchWithAuth(`${API_URL}/onboarding/links/${id}`, {
    method: "DELETE",
  });
  return handleApiResponse(response);
};

export const getOnboardingSubmissionsApi = async () => {
  const response = await fetchWithAuth(`${API_URL}/onboarding/submissions`);
  return handleApiResponse(response);
};

export const processOnboardingSubmissionApi = async (id, data) => {
  const response = await fetchWithAuth(`${API_URL}/onboarding/submissions/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return handleApiResponse(response);
};

/** @param {Record<string, string>} [params] */
export const listLeaveRequestsApi = async (params) => {
  const q = params ? `?${new URLSearchParams(params).toString()}` : "";
  const response = await fetchWithAuth(`${API_URL}/leave-requests${q}`);
  return handleApiResponse(response);
};

/** @param {{ employeeId?: string }} [params] — omit for own balance */
export const getLeaveBalanceApi = async (params) => {
  const q = params?.employeeId
    ? `?${new URLSearchParams({ employeeId: params.employeeId }).toString()}`
    : "";
  const response = await fetchWithAuth(`${API_URL}/leave-requests/balance${q}`);
  return handleApiResponse(response);
};

/** HR/Admin: add manual annual leave day credits (increases vacation entitlement). */
export const postLeaveBalanceCreditApi = async ({ employeeId, days, reason }) => {
  const response = await fetchWithAuth(`${API_URL}/leave-requests/balance-credit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ employeeId, days, reason }),
  });
  return handleApiResponse(response);
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
  return handleApiResponse(response);
};

export const createLeaveRequestApi = async (data) => {
  const response = await fetchWithAuth(`${API_URL}/leave-requests`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return handleApiResponse(response);
};

export const leaveRequestActionApi = async (id, body) => {
  const response = await fetchWithAuth(`${API_URL}/leave-requests/${id}/action`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return handleApiResponse(response);
};

export const cancelLeaveRequestApi = async (id) => {
  const response = await fetchWithAuth(`${API_URL}/leave-requests/${id}/cancel`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  return handleApiResponse(response);
};

// --- Assessments API ---

export const getEmployeeAssessmentsApi = async (employeeId) => {
  const response = await fetchWithAuth(`${API_URL}/assessments/employee/${employeeId}`);
  return handleApiResponse(response);
};

export const createAssessmentApi = async (data) => {
  const response = await fetchWithAuth(`${API_URL}/assessments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return handleApiResponse(response);
};

export const getAssessmentEligibilityApi = async (employeeId) => {
  const response = await fetchWithAuth(
    `${API_URL}/assessments/eligibility/${employeeId}`,
  );
  /* Backend returns 404 + { canAssess: false } for unknown id; avoid throwing so UI can set a resolved gate */
  if (response.status === 404) {
    return { canAssess: false };
  }
  return handleApiResponse(response);
};

