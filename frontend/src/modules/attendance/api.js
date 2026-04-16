import { fetchWithAuth } from "@/shared/api/fetchWithAuth";
import { API_URL } from "@/shared/api/apiBase";
import { handleApiResponse } from "@/shared/api/handleApiResponse";
import { buildAttendanceQueryParams } from "./utils";

/**
 * @param {{ startDate?: string, endDate?: string, employeeCode?: string }} params
 * @returns {Promise<Array>} Attendance documents (employeeId populated when applicable).
 */
export const getAttendanceApi = async (params = {}) => {
  const query = buildAttendanceQueryParams(params);
  const url = query ? `${API_URL}/attendance?${query}` : `${API_URL}/attendance`;
  const response = await fetchWithAuth(url);
  const data = await handleApiResponse(response);
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.attendance)) return data.attendance;
  return [];
};

/**
 * @param {string} employeeId
 * @returns {Promise<Array>}
 */
export const getEmployeeAttendanceApi = async (employeeId) => {
  const response = await fetchWithAuth(`${API_URL}/attendance/employee/${employeeId}`);
  return handleApiResponse(response);
};

/**
 * Personal attendance stream for the last month.
 * @returns {Promise<Array>}
 */
export const getMyAttendanceApi = async () => {
  const response = await fetchWithAuth(`${API_URL}/attendance/me`);
  return handleApiResponse(response);
};

/**
 * @returns {Promise<Array>}
 */
export const getTodayAttendanceApi = async () => {
  const response = await fetchWithAuth(`${API_URL}/attendance?todayOnly=true`);
  return handleApiResponse(response);
};

export const createAttendanceApi = async (data) => {
  const { status: _ignoredStatus, ...payload } = data || {};
  const response = await fetchWithAuth(`${API_URL}/attendance`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleApiResponse(response);
};

export const updateAttendanceApi = async (id, data) => {
  const { status: _ignoredStatus, ...payload } = data || {};
  const response = await fetchWithAuth(`${API_URL}/attendance/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleApiResponse(response);
};

export const updateAttendanceDeductionSourceApi = async (
  id,
  { deductionSource, deductionValueType, deductionValue },
) => {
  const response = await fetchWithAuth(`${API_URL}/attendance/${id}/deduction-source`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ deductionSource, deductionValueType, deductionValue }),
  });
  return handleApiResponse(response);
};

export const deleteAttendanceApi = async (id) => {
  const response = await fetchWithAuth(`${API_URL}/attendance/${id}`, {
    method: "DELETE",
  });
  return handleApiResponse(response);
};

export const deleteAttendanceBulkApi = async (ids) => {
  const response = await fetchWithAuth(`${API_URL}/attendance/bulk`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids }),
  });
  return handleApiResponse(response);
};

export const importAttendanceApi = async (file, overwrite = false) => {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("overwrite", overwrite.toString());
  
  const response = await fetchWithAuth(`${API_URL}/attendance/import`, {
    method: "POST",
    body: formData,
  });
  return handleApiResponse(response);
};

/** GET /attendance/monthly-report?year=&month=&detail=true — summary excludes salary/EGP; includes approvedOvertimeUnits. */
export const getMonthlyReportApi = async ({ year, month, departmentId, detail = true }) => {
  const params = new URLSearchParams();
  params.set("year", String(year));
  params.set("month", String(month));
  if (departmentId) params.set("departmentId", departmentId);
  if (detail) params.set("detail", "true");
  const response = await fetchWithAuth(`${API_URL}/attendance/monthly-report?${params}`);
  return handleApiResponse(response);
};

/** Download monthly report as .xlsx */
export const downloadMonthlyReportExcelApi = async ({ year, month, departmentId }) => {
  const params = new URLSearchParams();
  params.set("year", String(year));
  params.set("month", String(month));
  if (departmentId) params.set("departmentId", departmentId);
  const response = await fetchWithAuth(`${API_URL}/attendance/monthly-report/export?${params}`);
  if (!response.ok) throw new Error("Failed to download report");
  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Attendance_Report_${year}-${String(month).padStart(2, "0")}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
};

/**
 * Downloads the attendance import template for Excel
 */
export const downloadAttendanceTemplateApi = async () => {
  const response = await fetchWithAuth(`${API_URL}/attendance/template`);
  if (!response.ok) {
    throw new Error("Failed to download template");
  }
  
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
