import { fetchWithAuth } from "@/shared/api/fetchWithAuth";
import { handleApiResponse } from "@/shared/api/handleApiResponse";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

export const getPayrollRunsApi = async (params) => {
  const q = params ? `?${new URLSearchParams(params).toString()}` : "";
  const response = await fetchWithAuth(`${API_URL}/payroll/runs${q}`);
  return handleApiResponse(response);
};

export const getPayrollRunApi = async (id) => {
  const response = await fetchWithAuth(`${API_URL}/payroll/runs/${id}`);
  return handleApiResponse(response);
};

export const createPayrollRunApi = async (data) => {
  const response = await fetchWithAuth(`${API_URL}/payroll/runs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return handleApiResponse(response);
};

export const computePayrollRunApi = async (id) => {
  const response = await fetchWithAuth(`${API_URL}/payroll/runs/${id}/compute`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  return handleApiResponse(response);
};

export const finalizePayrollRunApi = async (id) => {
  const response = await fetchWithAuth(`${API_URL}/payroll/runs/${id}/finalize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  return handleApiResponse(response);
};

export const repairPayrollRunTotalsApi = async (id) => {
  const response = await fetchWithAuth(`${API_URL}/payroll/runs/${id}/repair-totals`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  return handleApiResponse(response);
};

export const deletePayrollRunApi = async (id) => {
  const response = await fetchWithAuth(`${API_URL}/payroll/runs/${id}`, {
    method: "DELETE",
  });
  return handleApiResponse(response);
};

export const getPayrollRecordsApi = async (runId) => {
  const response = await fetchWithAuth(`${API_URL}/payroll/runs/${runId}/records`);
  return handleApiResponse(response);
};

export const updatePayrollRecordApi = async (runId, recordId, body) => {
  const response = await fetchWithAuth(`${API_URL}/payroll/runs/${runId}/records/${recordId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return handleApiResponse(response);
};

export const getPaymentListApi = async (runId) => {
  const response = await fetchWithAuth(`${API_URL}/payroll/runs/${runId}/payment-list`);
  return handleApiResponse(response);
};

export const getInsuranceReportApi = async (runId) => {
  const response = await fetchWithAuth(`${API_URL}/payroll/runs/${runId}/insurance-report`);
  return handleApiResponse(response);
};

export const getTaxReportApi = async (runId) => {
  const response = await fetchWithAuth(`${API_URL}/payroll/runs/${runId}/tax-report`);
  return handleApiResponse(response);
};

export const downloadPayrollExcelApi = async (runId, type) => {
  const response = await fetchWithAuth(`${API_URL}/payroll/runs/${runId}/export/${type}`);
  if (!response.ok) throw new Error("Export failed");
  return response.blob();
};

export const getEmployeePayrollHistoryApi = async (employeeId) => {
  const response = await fetchWithAuth(`${API_URL}/payroll/employees/${employeeId}/history`);
  return handleApiResponse(response);
};

export const getAdvancesApi = async (params) => {
  const q = params ? `?${new URLSearchParams(params).toString()}` : "";
  const response = await fetchWithAuth(`${API_URL}/advances${q}`);
  return handleApiResponse(response);
};

export const getAdvanceApi = async (id) => {
  const response = await fetchWithAuth(`${API_URL}/advances/${id}`);
  return handleApiResponse(response);
};

export const createAdvanceApi = async (data) => {
  const response = await fetchWithAuth(`${API_URL}/advances`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return handleApiResponse(response);
};

export const approveAdvanceApi = async (id, data) => {
  const response = await fetchWithAuth(`${API_URL}/advances/${id}/approve`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return handleApiResponse(response);
};

export const cancelAdvanceApi = async (id) => {
  const response = await fetchWithAuth(`${API_URL}/advances/${id}`, {
    method: "DELETE",
  });
  return handleApiResponse(response);
};

export const getPayrollConfigApi = async () => {
  const response = await fetchWithAuth(`${API_URL}/payroll/config`);
  return handleApiResponse(response);
};
