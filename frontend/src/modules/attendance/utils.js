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
  const totalSeconds = Math.round(Number(h) * 3600);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  
  const pad = (num) => String(num).padStart(2, '0');
  
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

/**
 * Parse a check-in/out string to seconds from midnight for comparison.
 * Supports 24h (HH:mm, HH:mm:ss) and 12h with AM/PM (matches backend import flexibility).
 * @param {unknown} value
 * @returns {number | null}
 */
export function parseAttendanceTimeToSeconds(value) {
  if (value == null) return null;
  if (typeof value === "number" && Number.isFinite(value)) {
    const total = Math.round(value * 86400);
    const h = Math.floor(total / 3600) % 24;
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    return h * 3600 + m * 60 + s;
  }
  if (typeof value !== "string") return null;
  const str = value.trim().toUpperCase();
  if (!str) return null;

  const m24 = str.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (m24) {
    const h = Number(m24[1]);
    const min = Number(m24[2]);
    const sec = m24[3] != null ? Number(m24[3]) : 0;
    if (h > 23 || min > 59 || sec > 59) return null;
    return h * 3600 + min * 60 + sec;
  }

  const m12 = str.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)$/);
  if (m12) {
    let h = Number(m12[1]);
    const min = Number(m12[2]);
    const sec = m12[3] != null ? Number(m12[3]) : 0;
    const ap = m12[4];
    if (min > 59 || sec > 59 || h < 1 || h > 12) return null;
    if (ap === "PM" && h < 12) h += 12;
    if (ap === "AM" && h === 12) h = 0;
    return h * 3600 + min * 60 + sec;
  }

  return null;
}

/**
 * @typedef {'missing_check_in' | 'missing_check_out' | 'identical_times'} AttendancePunchIssue
 */

/**
 * Data-quality flags for a single attendance row (daily list or monthly detail line).
 * @param {{ checkIn?: string | null, checkOut?: string | null }} row
 * @returns {AttendancePunchIssue | null}
 */
export function getAttendancePunchIssue(row) {
  const cin = row?.checkIn;
  const cout = row?.checkOut;
  const hasIn = typeof cin === "string" && cin.trim() !== "";
  const hasOut = typeof cout === "string" && cout.trim() !== "";

  if (hasIn && !hasOut) return "missing_check_out";
  if (!hasIn && hasOut) return "missing_check_in";
  if (hasIn && hasOut) {
    const a = parseAttendanceTimeToSeconds(cin);
    const b = parseAttendanceTimeToSeconds(cout);
    if (a != null && b != null && a === b) return "identical_times";
  }
  return null;
}

/** Stable key for counting distinct employees in punch alerts. */
export function getAttendanceRowEmployeeKey(row) {
  const e = row?.employeeId;
  if (e && typeof e === "object" && e._id != null) return String(e._id);
  if (e != null && typeof e !== "object") return String(e);
  if (row?.employeeCode != null && String(row.employeeCode).trim() !== "") {
    return `code:${String(row.employeeCode).trim()}`;
  }
  return null;
}

/**
 * Aggregate punch issues for the current filtered daily list.
 * @param {Array<Record<string, unknown>>} items
 */
export function summarizeAttendancePunchIssues(items) {
  const list = Array.isArray(items) ? items : [];
  let missingCheckIn = 0;
  let missingCheckOut = 0;
  let identicalTimes = 0;
  const employeeKeys = new Set();

  for (const row of list) {
    const issue = getAttendancePunchIssue(row);
    if (!issue) continue;
    if (issue === "missing_check_in") missingCheckIn += 1;
    else if (issue === "missing_check_out") missingCheckOut += 1;
    else if (issue === "identical_times") identicalTimes += 1;
    const ek = getAttendanceRowEmployeeKey(row);
    if (ek) employeeKeys.add(ek);
  }

  const affectedRows = missingCheckIn + missingCheckOut + identicalTimes;
  return {
    missingCheckIn,
    missingCheckOut,
    identicalTimes,
    affectedRows,
    distinctEmployees: employeeKeys.size,
  };
}
