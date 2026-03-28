import {
  UserPermission,
} from "../models/Permission.js";

export async function requirePermission(req, res, next, permission) {
  const user = req.user;

  if (!user) {
    return res.status(401).json({ error: "Authentication required" });
  }

  // Admins (role 3) have all permissions
  if (user.role === 3) {
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

    // Check if user has the required action
    if (!userPermission.actions.includes(permission.action)) {
      return res.status(403).json({
        error: `Action '${permission.action}' not allowed for module: ${permission.module}`,
      });
    }

    // Check scope if specified
    if (
      permission.scope &&
      userPermission.scope !== permission.scope &&
      userPermission.scope !== "all"
    ) {
      return res.status(403).json({
        error: `Scope '${permission.scope}' not allowed for module: ${permission.module}`,
      });
    }

    // Store permission info for later use in route handlers
    req.userPermission = userPermission;

    next();
  } catch (error) {
    console.error("Permission check error:", error);
    res.status(500).json({ error: "Permission validation failed" });
  }
}

// Helper function to create permission middleware
export function checkPermission(permission) {
  return (req, res, next) =>
    requirePermission(req, res, next, permission);
}

// Scope validation helpers
export function validateScopeAccess(
  user,
  userPermission,
  resourceOwnerId,
  resourceDepartment,
) {
  const scope = userPermission.scope;

  switch (scope) {
    case "self":
      // Only allow access to own resources
      return resourceOwnerId === user.id;

    case "department":
      // Allow access to resources in user's department
      // This would need additional logic to determine user's department
      return true; // Placeholder - implement based on your department logic

    case "all":
      // Allow access to all resources
      return true;

    default:
      return false;
  }
}
