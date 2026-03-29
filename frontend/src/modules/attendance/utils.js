/**
 * Attendance list helpers: stable query strings and display formatting.
 */

/**
 * Builds query string for GET /attendance — omits empty filters so the backend
 * does not receive misleading empty `employeeCode` params.
 */
export function buildAttendanceQueryParams({ startDate, endDate, employeeCode } = {}) {
  const p = new URLSearchParams();
  if (startDate) p.set("startDate", startDate);
  if (endDate) p.set("endDate", endDate);
  const code = employeeCode != null ? String(employeeCode).trim() : "";
  if (code) p.set("employeeCode", code);
  return p.toString();
}

/**
 * Calendar day for display. Uses UTC date parts when the value is an ISO
 * midnight UTC string so the listed day matches the stored business date.
 */
export function formatAttendanceDate(value) {
  if (value == null || value === "") return "—";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  const day = d.getUTCDate();
  return new Date(Date.UTC(y, m, day)).toLocaleDateString(undefined, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** Populated employee subdocument from an attendance row, if present. */
export function getAttendanceEmployee(row) {
  const e = row?.employeeId;
  if (e && typeof e === "object" && (e.fullName || e.email)) return e;
  return null;
}

/** Stable row id for React keys (Mongo uses _id). */
export function getAttendanceRowId(row, index = 0) {
  if (row?._id != null) return String(row._id);
  if (row?.id != null) return String(row.id);
  return `attendance-${index}`;
}

/** Format hours for table cells. */
export function formatTotalHours(h) {
  if (h == null || Number.isNaN(Number(h))) return "—";
  const n = Number(h);
  return `${n.toFixed(1)}h`;
}
