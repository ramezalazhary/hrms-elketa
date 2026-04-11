import { Department } from "../models/Department.js";
import { Employee } from "../models/Employee.js";
import { isAdminRole } from "../utils/roles.js";
import { can } from "../services/authorizationPolicyService.js";

const HR_DEPARTMENT_NAME = process.env.HR_DEPARTMENT_NAME || "HR";

/**
 * Checks whether a user is head of the HR department by email **or** ObjectId.
 *
 * @param {string | undefined} email Authenticated user's email.
 * @param {string | undefined} userId Authenticated user's id (from JWT).
 * @returns {Promise<boolean>}
 */
export async function isHrDepartmentHead(email, userId) {
  if (!email && !userId) return false;

  const conditions = [];
  if (email) conditions.push({ head: email });
  if (userId) {
    const actor = await Employee.findById(userId).select("_id").lean();
    if (actor) conditions.push({ headId: actor._id });
  }
  if (conditions.length === 0) return false;

  const dep = await Department.findOne({
    name: HR_DEPARTMENT_NAME,
    $or: conditions,
  }).select("_id");
  return Boolean(dep);
}

/**
 * Express middleware: only users with system Admin role may proceed.
 */
export function requireSystemAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  if (isAdminRole(req.user.role)) {
    return next();
  }
  return res.status(403).json({ error: "Forbidden" });
}

/**
 * Express middleware: Admin **or** HR_MANAGER **or** Head of HR may proceed.
 */
export async function requireAdminOrHrHead(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const decision = await can(req.user, "manage", "users");
  if (decision.allow) return next();
  return res.status(403).json({ error: "Forbidden", reason: decision.reason });
}
