/**
 * Central role checks for RBAC. Accepts JWT payload shapes where `role` may be
 * legacy numeric (Admin = 3) or string (e.g. ADMIN, HR_MANAGER).
 */

/** @param {string|number|undefined} role */
export function isAdminRole(role) {
  return role === "ADMIN" || role === 3;
}

/** ADMIN, HR_MANAGER, or HR_STAFF */
export function isHrOrAdmin(user) {
  if (!user) return false;
  const r = user.role;
  return isAdminRole(r) || r === "HR_STAFF" || r === "HR_MANAGER";
}

/** @param {{ role?: string|number } | null | undefined} user */
export function canManageEmployments(user) {
  return isHrOrAdmin(user);
}

/** @param {{ role?: string|number } | null | undefined} user */
export function canViewReports(user) {
  return isHrOrAdmin(user);
}

/** ADMIN, HR_MANAGER, HR_STAFF — same as isHrOrAdmin, used in positions context */
export function canManagePositions(user) {
  return isHrOrAdmin(user);
}

/** @param {string|number|undefined} role */
export function isManagerOrAbove(role) {
  return isAdminRole(role) || role === "MANAGER" || role === 2 || role === "HR_MANAGER" || role === "HR_STAFF";
}

/** @param {string|number|undefined} role */
export function isEmployeeRole(role) {
  return role === "EMPLOYEE" || role === 1;
}
