import { UserPermission } from "../models/Permission.js";

/**
 * Checks `UserPermission` for a module/action (and optional scope) after auth.
 * Admins bypass the DB check.
 *
 * @param {import("express").Request} req Expects `req.user`; may set `req.userPermission` on success.
 * @param {import("express").Response} res
 * @param {import("express").NextFunction} next
 * @param {{ module: string, action: string, scope?: string }} permission Required granular rule.
 * @returns {Promise<void>}
 *
 * Data flow: admin → `next()`; else `UserPermission.findOne({ userId, module })` →
 * validate `actions` contains `action` → optional scope match → set `req.userPermission` → `next()`;
 * failures → 401/403/500 JSON.
 */
export async function requirePermission(req, res, next, permission) {
  const user = req.user;

  if (!user) {
    return res.status(401).json({ error: "Authentication required" });
  }

  if (user.role === 3 || user.role === "ADMIN") {
    return next();
  }

  try {
    const userPermission = await UserPermission.findOne({
      userId: user.id,
      module: permission.module,
    });

    if (!userPermission) {
      return res.status(403).json({
        error: `No permissions for module: ${permission.module}`,
      });
    }

    if (!userPermission.actions.includes(permission.action)) {
      return res.status(403).json({
        error: `Action '${permission.action}' not allowed for module: ${permission.module}`,
      });
    }

    if (
      permission.scope &&
      userPermission.scope !== permission.scope &&
      userPermission.scope !== "all"
    ) {
      return res.status(403).json({
        error: `Scope '${permission.scope}' not allowed for module: ${permission.module}`,
      });
    }

    req.userPermission = userPermission;

    next();
  } catch (error) {
    console.error("Permission check error:", error);
    res.status(500).json({ error: "Permission validation failed" });
  }
}

/**
 * Wraps `requirePermission` for use in `router.get(path, checkPermission({...}), handler)`.
 *
 * @param {{ module: string, action: string, scope?: string }} permission
 * @returns {import("express").RequestHandler}
 */
export function checkPermission(permission) {
  return (req, res, next) => requirePermission(req, res, next, permission);
}

/**
 * Pure helper: whether a resource is visible under a permission scope (placeholder for `department`).
 *
 * @param {{ id: string, email: string, role: string }} user
 * @param {{ scope: string }} userPermission Row from DB.
 * @param {string} resourceOwnerId Compared to `user.id` for `self`.
 * @param {string} resourceDepartment Reserved for department checks.
 * @returns {boolean}
 */
export function validateScopeAccess(
  user,
  userPermission,
  resourceOwnerId,
  resourceDepartment,
) {
  const scope = userPermission.scope;

  switch (scope) {
    case "self":
      return resourceOwnerId === user.id;

    case "department":
      return true;

    case "all":
      return true;

    default:
      return false;
  }
}
