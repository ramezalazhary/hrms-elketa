import { Department } from "../models/Department.js";

const HR_DEPARTMENT_NAME = process.env.HR_DEPARTMENT_NAME || "HR";

/**
 * Checks whether `email` is configured as head of the HR department.
 *
 * @param {string | undefined} email Authenticated user’s email.
 * @returns {Promise<boolean>} `true` if a department named HR exists with `head === email`.
 *
 * Data flow: `Department.findOne({ name: HR, head: email })` → truthy `_id` → boolean.
 */
export async function isHrDepartmentHead(email) {
  if (!email) return false;
  const dep = await Department.findOne({
    name: HR_DEPARTMENT_NAME,
    head: email,
  }).select("_id");
  return Boolean(dep);
}

/**
 * Express middleware: only users with system Admin role may proceed.
 *
 * @param {import("express").Request} req Must have `req.user` from `requireAuth` (`role` string or legacy `3`).
 * @param {import("express").Response} res
 * @param {import("express").NextFunction} next
 * @returns {void} Calls `next()` or sends 401/403 JSON.
 *
 * Data flow: no `req.user` → 401; role not ADMIN/3 → 403; else `next()`.
 */
export function requireSystemAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  if (req.user.role === "ADMIN" || req.user.role === 3) {
    return next();
  }
  return res.status(403).json({ error: "Forbidden" });
}

/**
 * Express middleware: Admin **or** Head of HR may proceed (e.g. user list, permission edits scoped in route).
 *
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @param {import("express").NextFunction} next
 * @returns {Promise<void>} Calls `next()` or sends 401/403 JSON.
 *
 * Data flow: no user → 401; ADMIN/3 → `next()`; `HR_STAFF` + `isHrDepartmentHead` → `next()`; else 403.
 */
export async function requireAdminOrHrHead(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  if (req.user.role === "ADMIN" || req.user.role === 3) {
    return next();
  }
  if (req.user.role === "HR_STAFF") {
    const ok = await isHrDepartmentHead(req.user.email);
    if (ok) return next();
  }
  return res.status(403).json({ error: "Forbidden" });
}
