/** Canonical role constants. */
export const ROLE = Object.freeze({
  EMPLOYEE: "EMPLOYEE",
  TEAM_LEADER: "TEAM_LEADER",
  MANAGER: "MANAGER",
  HR: "HR",
  HR_STAFF: "HR_STAFF",
  HR_MANAGER: "HR_MANAGER",
  ADMIN: "ADMIN",
});

/** Legacy numeric -> canonical string. */
const ROLE_MAP = Object.freeze({
  1: ROLE.EMPLOYEE,
  2: ROLE.MANAGER,
  3: ROLE.ADMIN,
});

/** Role level for hierarchy comparisons. */
export const ROLE_LEVEL = Object.freeze({
  [ROLE.EMPLOYEE]: 1,
  [ROLE.TEAM_LEADER]: 2,
  [ROLE.MANAGER]: 2,
  [ROLE.HR]: 3,
  [ROLE.HR_STAFF]: 3,
  [ROLE.HR_MANAGER]: 3,
  [ROLE.ADMIN]: 4,
});

export const CANONICAL_ROLES = Object.freeze(Object.keys(ROLE_LEVEL));

/** @param {string|number|undefined|null} role */
export function normalizeRole(role) {
  if (typeof role === "number") return ROLE_MAP[role] || ROLE.EMPLOYEE;
  const r = String(role || "").trim().toUpperCase();
  if (r === "TL" || r === "TEAMLEADER" || r === "TEAM_LEAD" || r === "TEAM LEADER") {
    return ROLE.TEAM_LEADER;
  }
  if (Object.prototype.hasOwnProperty.call(ROLE_LEVEL, r)) return r;
  return ROLE.EMPLOYEE;
}

/** Strict input parser for API payload roles; returns null when invalid. */
export function parseRoleInput(role) {
  if (typeof role === "number") {
    return Object.prototype.hasOwnProperty.call(ROLE_MAP, role)
      ? ROLE_MAP[role]
      : null;
  }
  if (typeof role !== "string") return null;
  const normalized = role.trim().toUpperCase();
  if (
    normalized === "TL" ||
    normalized === "TEAMLEADER" ||
    normalized === "TEAM_LEAD" ||
    normalized === "TEAM LEADER"
  ) {
    return ROLE.TEAM_LEADER;
  }
  return CANONICAL_ROLES.includes(normalized) ? normalized : null;
}

/** @param {string|number|undefined|null} role */
export function isAdminRole(role) {
  return normalizeRole(role) === ROLE.ADMIN;
}

/** @param {{ role?: string|number } | null | undefined} user */
export function isHrOrAdmin(user) {
  if (!user) return false;
  const r = normalizeRole(user.role);
  return (
    r === ROLE.ADMIN ||
    r === ROLE.HR ||
    r === ROLE.HR_STAFF ||
    r === ROLE.HR_MANAGER
  );
}

/** @param {{ role?: string|number } | null | undefined} user */
export function canManageEmployments(user) {
  return isHrOrAdmin(user);
}

/** @param {{ role?: string|number } | null | undefined} user */
export function canViewReports(user) {
  return isHrOrAdmin(user);
}

/** @param {{ role?: string|number } | null | undefined} user */
export function canManagePositions(user) {
  return isHrOrAdmin(user);
}

/** @param {string|number|undefined|null} role */
export function isManagerOrAbove(role) {
  return ROLE_LEVEL[normalizeRole(role)] >= ROLE_LEVEL[ROLE.MANAGER];
}

/** @param {string|number|undefined|null} role */
export function isEmployeeRole(role) {
  return normalizeRole(role) === ROLE.EMPLOYEE;
}

/**
 * Fine-grained edit order (separate from ROLE_LEVEL which equates MANAGER=TEAM_LEADER).
 * ADMIN can always edit anyone; HR_MANAGER outranks HR_STAFF; MANAGER outranks TEAM_LEADER.
 */
const EDIT_ORDER = Object.freeze({
  [ROLE.EMPLOYEE]: 1,
  [ROLE.TEAM_LEADER]: 3,
  [ROLE.MANAGER]: 4,
  [ROLE.HR]: 6,
  [ROLE.HR_STAFF]: 6,
  [ROLE.HR_MANAGER]: 8,
  [ROLE.ADMIN]: 10,
});

/**
 * Returns true when an actor with `editorRole` is allowed to mutate a record
 * belonging to a user with `targetRole`.
 *
 * Rule: you may only act on someone strictly below you in the edit hierarchy.
 * ADMIN is always allowed.
 */
export function editorCanModifyTargetRole(editorRole, targetRole) {
  const er = normalizeRole(editorRole);
  if (er === ROLE.ADMIN) return true;
  const tr = normalizeRole(targetRole);
  const edOrd = EDIT_ORDER[er] ?? 1;
  const tgOrd = EDIT_ORDER[tr] ?? 1;
  return edOrd > tgOrd;
}
