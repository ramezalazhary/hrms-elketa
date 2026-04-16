/**
 * @file `/api/permissions` — granular `UserPermission` documents per user.
 * Admin or HR Head; HR Head restricted to HR employees and stricter PUT rules.
 */
import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { enforcePolicy } from "../middleware/enforcePolicy.js";
import { UserPermission } from "../models/Permission.js";
import { PageAccessOverride } from "../models/PageAccessOverride.js";
import { Employee } from "../models/Employee.js";
import { validatePermissionCreation } from "../middleware/validation.js";
import { strictLimiter } from "../middleware/security.js";
import { isAdminRole, normalizeRole } from "../utils/roles.js";
import {
  HR_TEMPLATES,
  PAGE_POLICY_CATALOG,
  PAGE_ACCESS_LEVELS,
  isHrDepartmentMember,
  simulateAccess,
  simulatePageCatalogAccess,
} from "../services/authorizationPolicyService.js";
import { createAuditLog } from "../services/auditService.js";
import { bumpAuthzVersion } from "../services/authzVersionService.js";

const router = Router();
const HR_TEMPLATE_KEYS = Object.freeze(Object.keys(HR_TEMPLATES));
const POLICY_ASSIGNABLE_ROLES = new Set([
  "ADMIN",
  "HR",
  "HR_STAFF",
  "HR_MANAGER",
]);

const HR_DEPARTMENT_NAME = process.env.HR_DEPARTMENT_NAME || "HR";

/**
 * Middleware: after `requireAdminOrHrHead`, ensures non-admins only target users in the HR department.
 * @param {import("express").Request} req expects `params.userId`
 * @returns {Promise<void>} `next()` or 403/404 JSON.
 */
async function restrictHrHeadToHrEmployees(req, res, next) {
  if (isAdminRole(req.user.role))
    return next();

  const actorCanManagePolicy = await isHrDepartmentMember(req.user);
  if (!actorCanManagePolicy) {
    return res.status(403).json({ error: "Only ADMIN or HR department members can apply policy" });
  }

  const targetUser = await Employee.findById(req.params.userId).select("email");
  if (!targetUser) return res.status(404).json({ error: "User not found" });

  const targetEmployee = await Employee.findOne({
    email: targetUser.email,
  }).select("department");
  if (!targetEmployee) {
    return res
      .status(403)
      .json({ error: "Target user is not an employee record" });
  }

  if (targetEmployee.department !== HR_DEPARTMENT_NAME) {
    return res
      .status(403)
      .json({ error: "HR Head can only manage HR employees" });
  }

  return next();
}

async function restrictPolicyTargetRoles(req, res, next) {
  const targetUser = await Employee.findById(req.params.userId).select("role");
  if (!targetUser) return res.status(404).json({ error: "User not found" });
  const targetRole = normalizeRole(targetUser.role);
  if (!POLICY_ASSIGNABLE_ROLES.has(targetRole)) {
    return res.status(403).json({
      error:
        "Cannot assign policy to this role. Promote target to HR_STAFF, HR_MANAGER, or ADMIN first.",
    });
  }
  req.targetPolicyUser = targetUser;
  return next();
}

router.post("/simulate", requireAuth, enforcePolicy("manage", "permissions"), async (req, res) => {
  try {
    const {
      role,
      action,
      resource,
      context,
      hrTemplates,
      hrLevel,
      isHrDepartmentMember,
      pageAccessOverrides,
    } = req.body ?? {};
    const decision = await simulateAccess({
      user: {
        ...req.user,
        role: normalizeRole(role || req.user.role),
        hrTemplates: Array.isArray(hrTemplates) ? hrTemplates : req.user.hrTemplates,
        hrLevel: hrLevel || req.user.hrLevel,
        isHrDepartmentMember:
          typeof isHrDepartmentMember === "boolean"
            ? isHrDepartmentMember
            : req.user?.isHrDepartmentMember,
        pageAccessOverrides: Array.isArray(pageAccessOverrides)
          ? pageAccessOverrides
          : req.user?.pageAccessOverrides,
      },
      action: String(action || "read"),
      resource: String(resource || "users"),
      context: context ?? {},
    });
    return res.json(decision);
  } catch (error) {
    console.error("Error simulating access:", error);
    return res.status(500).json({ error: "Failed to simulate access" });
  }
});

router.get(
  "/page-catalog",
  requireAuth,
  enforcePolicy("manage", "permissions"),
  async (_req, res) => {
    return res.json({
      pages: PAGE_POLICY_CATALOG,
      generatedAt: new Date().toISOString(),
    });
  },
);

router.post(
  "/resolve-preview",
  requireAuth,
  enforcePolicy("manage", "permissions"),
  async (req, res) => {
    try {
      const {
        role,
        hrTemplates,
        hrLevel,
        context,
        pageAccessOverrides,
        isHrDepartmentMember,
      } = req.body ?? {};
      const user = {
        ...req.user,
        role: normalizeRole(role || req.user.role),
        hrTemplates: Array.isArray(hrTemplates) ? hrTemplates : req.user.hrTemplates,
        hrLevel: hrLevel || req.user.hrLevel,
        isHrDepartmentMember:
          typeof isHrDepartmentMember === "boolean"
            ? isHrDepartmentMember
            : req.user?.isHrDepartmentMember,
        pageAccessOverrides: Array.isArray(pageAccessOverrides)
          ? pageAccessOverrides
          : [],
      };
      const pages = await simulatePageCatalogAccess(user, context ?? {});
      return res.json({
        pages,
        generatedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Error resolving page preview:", error);
      return res.status(500).json({ error: "Failed to resolve page preview" });
    }
  },
);

router.get(
  "/page-overrides/:userId",
  requireAuth,
  enforcePolicy("manage", "permissions"),
  restrictHrHeadToHrEmployees,
  restrictPolicyTargetRoles,
  async (req, res) => {
    try {
      const rows = await PageAccessOverride.find({ userId: req.params.userId })
        .select("pageId level source updatedAt")
        .lean();
      return res.json({
        userId: req.params.userId,
        overrides: rows.map((r) => ({
          pageId: String(r.pageId),
          level: String(r.level || "NONE").toUpperCase(),
          source: String(r.source || "manual_override"),
          updatedAt: r.updatedAt,
        })),
      });
    } catch (error) {
      console.error("Error fetching page overrides:", error);
      return res.status(500).json({ error: "Failed to fetch page overrides" });
    }
  },
);

router.put(
  "/page-overrides/:userId",
  requireAuth,
  enforcePolicy("manage", "permissions"),
  restrictHrHeadToHrEmployees,
  restrictPolicyTargetRoles,
  strictLimiter,
  async (req, res) => {
    try {
      const userId = req.params.userId;
      const targetUser = await Employee.findById(userId).select("_id");
      if (!targetUser) return res.status(404).json({ error: "User not found" });

      const overrides = Array.isArray(req.body?.overrides) ? req.body.overrides : null;
      if (!overrides) {
        return res.status(400).json({ error: "overrides array is required" });
      }

      const pageIds = new Set(PAGE_POLICY_CATALOG.map((p) => p.pageId));
      const invalid = overrides.filter((row) => {
        const pageId = String(row?.pageId || "").trim();
        const level = String(row?.level || "").trim().toUpperCase();
        return (
          !pageIds.has(pageId) ||
          !PAGE_ACCESS_LEVELS.includes(level)
        );
      });
      if (invalid.length > 0) {
        return res.status(400).json({
          error: "Invalid page overrides",
          invalid,
        });
      }

      // Full replace strategy: write deterministic set only.
      await PageAccessOverride.deleteMany({ userId });
      const docs = overrides
        .map((row) => ({
          userId,
          pageId: String(row.pageId),
          level: String(row.level).toUpperCase(),
          source: "manual_override",
          updatedBy: req.user?.email || "",
        }))
        .filter((row) => row.level !== "NONE");
      if (docs.length > 0) {
        await PageAccessOverride.insertMany(docs);
      }
      await bumpAuthzVersion(userId);

      return res.json({
        success: true,
        userId,
        overrides: docs.map((d) => ({
          pageId: d.pageId,
          level: d.level,
          source: d.source,
        })),
      });
    } catch (error) {
      console.error("Error updating page overrides:", error);
      return res.status(500).json({ error: "Failed to update page overrides" });
    }
  },
);

router.get(
  "/:userId",
  requireAuth,
  enforcePolicy("manage", "permissions"),
  restrictHrHeadToHrEmployees,
  restrictPolicyTargetRoles,
  async (req, res) => {
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
  },
);

router.post(
  "/:userId",
  requireAuth,
  enforcePolicy("manage", "permissions"),
  restrictHrHeadToHrEmployees,
  restrictPolicyTargetRoles,
  strictLimiter,
  validatePermissionCreation,
  async (req, res) => {
    try {
      const { userId } = req.params;
      const { module, actions, scope } = req.body;

      const user = await Employee.findById(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const permission = await UserPermission.findOneAndUpdate(
        { userId, module },
        { userId, module, actions, scope },
        { upsert: true, new: true },
      );
      await bumpAuthzVersion(userId);

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

router.put(
  "/:userId",
  requireAuth,
  enforcePolicy("manage", "permissions"),
  restrictHrHeadToHrEmployees,
  restrictPolicyTargetRoles,
  strictLimiter,
  async (req, res) => {
    try {
      const items = Array.isArray(req.body?.permissions)
        ? req.body.permissions
        : null;
      if (!items)
        return res.status(400).json({ error: "permissions array is required" });

      await UserPermission.deleteMany({ userId: req.params.userId });

      const docs = items.map((p) => ({
        userId: req.params.userId,
        module: String(p.module),
        actions: Array.isArray(p.actions) ? p.actions.map(String) : [],
        scope: String(p.scope ?? "self"),
      }));

      const created = await UserPermission.insertMany(docs);
      await bumpAuthzVersion(req.params.userId);
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

router.delete(
  "/:userId/:permissionId",
  requireAuth,
  enforcePolicy("manage", "permissions"),
  restrictHrHeadToHrEmployees,
  restrictPolicyTargetRoles,
  strictLimiter,
  async (req, res) => {
    try {
      const { userId, permissionId } = req.params;

      const permission = await UserPermission.findOneAndDelete({
        _id: permissionId,
        userId: userId,
      });
      await bumpAuthzVersion(userId);

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

router.delete(
  "/:userId",
  requireAuth,
  enforcePolicy("manage", "permissions"),
  restrictHrHeadToHrEmployees,
  restrictPolicyTargetRoles,
  strictLimiter,
  async (req, res) => {
    try {
      await UserPermission.deleteMany({ userId: req.params.userId });
      await bumpAuthzVersion(req.params.userId);
      return res.json({ success: true, message: "All permissions deleted" });
    } catch (error) {
      console.error("Error deleting permissions:", error);
      res.status(500).json({ error: "Failed to delete permissions" });
    }
  },
);

router.put(
  "/hr-templates/:userId",
  requireAuth,
  enforcePolicy("manage", "permissions"),
  strictLimiter,
  async (req, res) => {
    try {
      const employee = await Employee.findById(req.params.userId);
      if (!employee) return res.status(404).json({ error: "User not found" });
      const role = normalizeRole(employee.role);
      if (role !== "HR" && role !== "HR_STAFF" && role !== "HR_MANAGER") {
        return res.status(400).json({ error: "Target user is not in HR role" });
      }
      const templates = Array.isArray(req.body?.templates)
        ? [...new Set(req.body.templates.map((x) => String(x).trim()))]
        : [];
      const invalid = templates.filter((tpl) => !HR_TEMPLATE_KEYS.includes(tpl));
      if (invalid.length > 0) {
        return res.status(400).json({
          error: "Invalid HR templates",
          invalid,
          allowed: HR_TEMPLATE_KEYS,
        });
      }
      if (
        templates.includes("PERMISSIONS_MANAGER") &&
        role !== "HR_MANAGER"
      ) {
        return res.status(400).json({
          error: "PERMISSIONS_MANAGER template is allowed only for HR_MANAGER",
        });
      }
      const hrLevel = String(req.body?.hrLevel || employee.hrLevel || "STAFF")
        .trim()
        .toUpperCase();
      if (hrLevel !== "STAFF" && hrLevel !== "MANAGER") {
        return res.status(400).json({ error: "hrLevel must be STAFF or MANAGER" });
      }
      const oldValue = {
        hrTemplates: Array.isArray(employee.hrTemplates) ? employee.hrTemplates : [],
        hrLevel: employee.hrLevel || "STAFF",
      };
      employee.hrTemplates = templates;
      employee.hrLevel = hrLevel;
      await employee.save();
      await bumpAuthzVersion(employee._id);
      await createAuditLog({
        entityType: "Employee",
        entityId: employee._id,
        operation: "UPDATE",
        changes: {
          hrTemplates: { from: oldValue.hrTemplates, to: templates },
          hrLevel: { from: oldValue.hrLevel, to: hrLevel },
        },
        previousValues: oldValue,
        newValues: { hrTemplates: templates, hrLevel },
        performedBy: req.user.email,
        ipAddress: req.ip,
        userAgent: req.get("User-Agent"),
      });
      return res.json({
        success: true,
        userId: employee._id,
        hrTemplates: employee.hrTemplates,
        hrLevel: employee.hrLevel,
      });
    } catch (error) {
      console.error("Error updating hr templates:", error);
      return res.status(500).json({ error: "Failed to update HR templates" });
    }
  },
);

export default router;
