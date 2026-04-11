const MIN = 1;
const MAX = 31;
/** Default when policy has no valid value in either nested block. */
export const DEFAULT_WORKING_DAYS_PER_MONTH = 22;

/**
 * @param {unknown} raw
 * @returns {number | null} Clamped 1–31, or null if not a finite number.
 */
export function clampWorkingDaysPerMonth(raw) {
  const n = Math.floor(Number(raw));
  if (!Number.isFinite(n)) return null;
  return Math.min(MAX, Math.max(MIN, n));
}

/**
 * Single source for "working days per month" across attendance analysis and payroll.
 * Reads only {@link OrganizationPolicy}: prefers `attendanceRules`, then `payrollConfig`, then default.
 *
 * @param {import("mongoose").Document | Record<string, unknown> | null | undefined} orgPolicy
 * @returns {number}
 */
export function resolveWorkingDaysPerMonth(orgPolicy) {
  const ar = clampWorkingDaysPerMonth(orgPolicy?.attendanceRules?.workingDaysPerMonth);
  const pc = clampWorkingDaysPerMonth(orgPolicy?.payrollConfig?.workingDaysPerMonth);
  if (ar != null) return ar;
  if (pc != null) return pc;
  return DEFAULT_WORKING_DAYS_PER_MONTH;
}

/**
 * After PATCH fields, force the same value into both nested objects (creates empty subdocs if missing).
 *
 * @param {import("mongoose").Document | Record<string, unknown>} policy
 * @param {{ attendanceWd?: number, payrollWd?: number }} [opts]
 *        Include `attendanceWd` only if `attendanceRules` was in the request body; same for `payrollWd`.
 */
export function finalizePolicyWorkingDays(policy, opts = {}) {
  if (!policy) return;
  const { attendanceWd, payrollWd } = opts;
  const a =
    attendanceWd !== undefined && attendanceWd !== null
      ? clampWorkingDaysPerMonth(attendanceWd)
      : null;
  const p =
    payrollWd !== undefined && payrollWd !== null
      ? clampWorkingDaysPerMonth(payrollWd)
      : null;
  const unified = a ?? p ?? resolveWorkingDaysPerMonth(policy);

  if (!policy.attendanceRules || typeof policy.attendanceRules !== "object") {
    policy.attendanceRules = {};
  }
  if (!policy.payrollConfig || typeof policy.payrollConfig !== "object") {
    policy.payrollConfig = {};
  }
  policy.attendanceRules.workingDaysPerMonth = unified;
  policy.payrollConfig.workingDaysPerMonth = unified;
}
