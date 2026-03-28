import { fetchWithAuth } from "@/shared/api/fetchWithAuth";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const api = {
  get: async (url, options = {}) => {
    const query = options.params ? "?" + new URLSearchParams(options.params).toString() : "";
    const response = await fetchWithAuth(`${API_URL}${url}${query}`, {
      method: "GET",
      ...options,
    });
    if (!response.ok) throw await response.json();
    return { data: await response.json() };
  },
  post: async (url, data, options = {}) => {
    const isFormData = data instanceof FormData;
    const response = await fetchWithAuth(`${API_URL}${url}`, {
      method: "POST",
      headers: isFormData ? {} : { "Content-Type": "application/json" },
      body: isFormData ? data : JSON.stringify(data),
      ...options,
    });
    if (!response.ok) throw await response.json();
    return { data: await response.json() };
  },
  put: async (url, data, options = {}) => {
    const response = await fetchWithAuth(`${API_URL}${url}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
      ...options,
    });
    if (!response.ok) throw await response.json();
    return { data: await response.json() };
  },
  delete: async (url, options = {}) => {
    const response = await fetchWithAuth(`${API_URL}${url}`, {
      method: "DELETE",
      ...options,
    });
    if (!response.ok) throw await response.json();
    return { data: await response.json() };
  },
};

const attendanceApi = {
  // Events
  getEvents: (params) => api.get("/attendance/events", { params }),
  addEvent: (data) => api.post("/attendance/events", data),
  importEvents: (formData) => api.post("/attendance/events/import", formData),
  voidEvent: (id, reason) => api.put(`/attendance/events/${id}/void`, { reason }),

  // Engine
  processDay: (employeeId, date) => api.post("/attendance/process", { employeeId, date }),
  processBulk: (data) => api.post("/attendance/process/bulk", data),

  // Daily
  getDailyRecords: (params) => api.get("/attendance/daily", { params }),
  getEmployeeDaily: (employeeId, params) => api.get(`/attendance/daily/${employeeId}`, { params }),
  overrideDaily: (id, data) => api.put(`/attendance/daily/${id}/override`, data),

  // Policies
  getPolicies: () => api.get("/attendance/policies"),
  createPolicy: (data) => api.post("/attendance/policies", data),
  updatePolicy: (id, data) => api.put(`/attendance/policies/${id}`, data),
  deletePolicy: (id) => api.delete(`/attendance/policies/${id}`),

  // Metrics
  getMetrics: (params) => api.get("/attendance/metrics", { params }),
  generateMetrics: (year, month) => api.post("/attendance/metrics/generate", { year, month }),
  getPayrollSummary: (month) => api.get("/attendance/metrics/payroll-summary", { params: { month } }),

  // Dashboards
  getTodaySnapshot: () => api.get("/attendance/dashboard/today"),
  getPeriodSummary: (from, to) => api.get("/attendance/dashboard/summary", { params: { from, to } }),
};

export default attendanceApi;
