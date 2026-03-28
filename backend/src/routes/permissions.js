import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { UserPermission } from "../models/Permission.js";
import { User } from "../models/User.js";
import { Employee } from "../models/Employee.js";
import { Department } from "../models/Department.js";
import { validatePermissionCreation } from "../middleware/validation.js";
import { strictLimiter } from "../middleware/security.js";

const router = Router();

const HR_DEPARTMENT_NAME = process.env.HR_DEPARTMENT_NAME || "HR";

async function isHrHead(email) {
  const dep = await Department.findOne({
    name: HR_DEPARTMENT_NAME,
    head: email,
  }).select("_id");
  return Boolean(dep);
}

async function ensureCanManageTarget(req, res, next) {
  // Only admins can manage permissions at all.
  if (!req.user || (req.user.role !== 3 && req.user.role !== "ADMIN"))
    return res.status(403).json({ error: "Forbidden" });

  // Directors (or any non-HR-head admin) can manage anyone.
  const hrHead = await isHrHead(req.user.email);
  if (!hrHead) return next();

  // HR Head can only manage permissions for HR employees.
  const targetUser = await User.findById(req.params.userId).select("email");
  if (!targetUser) return res.status(404).json({ error: "User not found" });

  const targetEmployee = await Employee.findOne({
    email: targetUser.email,
  }).select("department");
  if (!targetEmployee)
    return res
      .status(403)
      .json({ error: "Target user is not an employee record" });

  if (targetEmployee.department !== HR_DEPARTMENT_NAME) {
    return res
      .status(403)
      .json({ error: "HR Head can only manage HR employees" });
  }

  return next();
}

// Get permissions for a user (admin-only)
router.get("/:userId", requireAuth, requireRole(3), async (req, res) => {
  try {
    const permissions = await UserPermission.find({
      userId: req.params.userId,
    }).sort({ module: 1 });
    return res.json(
      permissions.map((p) => ({
        id: p._id.toString(),
        userId: p.userId,
        module: p.module,
        actions: p.actions,
        scope: p.scope,
      })),
    );
  } catch (error) {
    console.error("Error fetching permissions:", error);
    res.status(500).json({ error: "Failed to fetch permissions" });
  }
});

// Create or update a specific permission (admin-only)
router.post(
  "/:userId",
  requireAuth,
  requireRole(3),
  strictLimiter,
  validatePermissionCreation,
  async (req, res) => {
    try {
      const { userId } = req.params;
      const { module, actions, scope } = req.body;

      // Check if user exists
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Upsert permission
      const permission = await UserPermission.findOneAndUpdate(
        { userId, module },
        { userId, module, actions, scope },
        { upsert: true, new: true },
      );

      res.status(201).json({
        id: permission._id.toString(),
        userId: permission.userId,
        module: permission.module,
        actions: permission.actions,
        scope: permission.scope,
      });
    } catch (error) {
      console.error("Error creating permission:", error);
      if (error.code === 11000) {
        res.status(409).json({
          error: "Permission already exists for this user and module",
        });
      } else {
        res.status(500).json({ error: "Failed to create permission" });
      }
    }
  },
);

// Replace all permissions for a user (admin-only)
router.put(
  "/:userId",
  requireAuth,
  requireRole(3),
  strictLimiter,
  async (req, res) => {
    try {
      const items = Array.isArray(req.body?.permissions)
        ? req.body.permissions
        : null;
      if (!items)
        return res.status(400).json({ error: "permissions array is required" });

      // If the actor is HR Head, only allow:
      // - HR modules (recruitment/payroll/attendance) with any actions
      // - System modules (employees/departments) with EDIT-only permissions (no create/delete)
      const hrHead = await isHrHead(req.user.email);
      if (hrHead) {
        const allowedModules = new Set([
          "recruitment",
          "payroll",
          "attendance",
          "employees",
          "departments",
        ]);
        const invalid = items.find(
          (p) => !allowedModules.has(String(p.module)),
        );
        if (invalid) {
          return res
            .status(403)
            .json({ error: "HR Head can only manage HR modules" });
        }

        const systemModules = new Set(["employees", "departments"]);
        const forbiddenSystemAction = items.find((p) => {
          const moduleName = String(p.module);
          if (!systemModules.has(moduleName)) return false;
          const actions = Array.isArray(p.actions) ? p.actions.map(String) : [];
          // allow only view/edit on system modules
          return actions.some((a) => a !== "view" && a !== "edit");
        });
        if (forbiddenSystemAction) {
          return res
            .status(403)
            .json({ error: "HR system permissions are edit-only" });
        }
      }

      // Delete existing permissions
      await UserPermission.deleteMany({ userId: req.params.userId });

      // Insert new permissions
      const docs = items.map((p) => ({
        userId: req.params.userId,
        module: String(p.module),
        actions: Array.isArray(p.actions) ? p.actions.map(String) : [],
        scope: String(p.scope ?? "self"),
      }));

      const created = await UserPermission.insertMany(docs);
      return res.json({
        success: true,
        count: created.length,
      });
    } catch (error) {
      console.error("Error updating permissions:", error);
      res.status(500).json({ error: "Failed to update permissions" });
    }
  },
);

// Delete a specific permission
router.delete(
  "/:userId/:permissionId",
  requireAuth,
  requireRole(3),
  strictLimiter,
  async (req, res) => {
    try {
      const { userId, permissionId } = req.params;

      const permission = await UserPermission.findOneAndDelete({
        _id: permissionId,
        userId: userId,
      });

      if (!permission) {
        return res.status(404).json({ error: "Permission not found" });
      }

      res.json({ message: "Permission deleted successfully" });
    } catch (error) {
      console.error("Error deleting permission:", error);
      res.status(500).json({ error: "Failed to delete permission" });
    }
  },
);

// Delete all permissions for a user (admin-only)
router.delete(
  "/:userId",
  requireAuth,
  requireRole(3),
  strictLimiter,
  async (req, res) => {
    try {
      await UserPermission.deleteMany({ userId: req.params.userId });
      return res.json({ success: true, message: "All permissions deleted" });
    } catch (error) {
      console.error("Error deleting permissions:", error);
      res.status(500).json({ error: "Failed to delete permissions" });
    }
  },
);

export default router;
