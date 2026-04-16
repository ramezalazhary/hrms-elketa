import { Department } from "../models/Department.js";
import { Employee } from "../models/Employee.js";
import { normalizeRole, ROLE } from "../utils/roles.js";

export const ROLE_SCOPE = Object.freeze({
  [ROLE.ADMIN]: "company",
  [ROLE.HR]: "company",
  [ROLE.HR_STAFF]: "company",
  [ROLE.HR_MANAGER]: "company",
  [ROLE.MANAGER]: "department",
  [ROLE.TEAM_LEADER]: "team",
  [ROLE.EMPLOYEE]: "self",
});

export const HR_TEMPLATES = Object.freeze({
  ATTENDANCE_CREATOR: { attendance: ["read", "create"] },
  ATTENDANCE_REVIEWER: { attendance: ["read", "update", "approve", "manage"] },
  FINANCE: {
    salaries: ["read", "update"],
    advances: ["read", "create"],
    payroll: ["view", "manage"],
  },
  LEAVES_MANAGER: { leaves: ["read", "approve"] },
  EMPLOYEE_VIEWER: { employees: ["read"] },
  PERMISSIONS_MANAGER: { permissions: ["read", "approve", "manage"] },
  FULL_VIEW: {
    attendance: ["read"],
    salaries: ["read"],
    employees: ["read"],
    leaves: ["read"],
    payroll: ["view"],
  },
});

/**
 * Canonical catalog of pages shown in Access Policy UI.
 * `pageId` is the stable key; `path` is display metadata only.
 */
export const PAGE_POLICY_CATALOG = Object.freeze([
  {
    pageId: "dashboard",
    label: "Dashboard",
    path: "/dashboard",
    module: "management",
    managementMode: true,
    resource: "dashboard",
    actionsByLevel: { VIEW: "read", EDIT: "read", ADMIN: "read" },
    capabilitiesByLevel: {
      NONE: "No dashboard access.",
      VIEW: "View dashboard insights.",
      EDIT: "View dashboard insights.",
      ADMIN: "View dashboard insights.",
    },
    defaultLevel: "NONE",
  },
  {
    pageId: "attendance",
    label: "Attendance",
    path: "/attendance",
    module: "management",
    managementMode: true,
    resource: "attendance",
    actionsByLevel: { VIEW: "read", EDIT: "manage", ADMIN: "manage" },
    capabilitiesByLevel: {
      NONE: "No attendance access.",
      VIEW: "View attendance records.",
      EDIT: "View, import, and edit attendance.",
      ADMIN: "View, import, edit, and delete attendance.",
    },
    defaultLevel: "NONE",
  },
  {
    pageId: "attendance_analysis",
    label: "Attendance analysis",
    path: "/attendance (Monthly tab)",
    module: "management",
    managementMode: true,
    resource: "attendance",
    actionsByLevel: { VIEW: "read", EDIT: "read", ADMIN: "read" },
    capabilitiesByLevel: {
      NONE: "No monthly analysis access.",
      VIEW: "View monthly attendance analysis.",
      EDIT: "View monthly attendance analysis.",
      ADMIN: "View monthly attendance analysis.",
    },
    defaultLevel: "NONE",
  },
  {
    pageId: "organizations",
    label: "Structure",
    path: "/organizations",
    module: "management",
    managementMode: true,
    resource: "employees",
    actionsByLevel: { VIEW: "read", EDIT: "read", ADMIN: "read" },
    capabilitiesByLevel: {
      NONE: "No structure page access.",
      VIEW: "View organization structure.",
      EDIT: "View organization structure.",
      ADMIN: "View organization structure.",
    },
    defaultLevel: "NONE",
  },
  {
    pageId: "departments",
    label: "Departments",
    path: "/departments",
    module: "management",
    managementMode: true,
    resource: "departments",
    actionsByLevel: { VIEW: "read", EDIT: "manage", ADMIN: "manage" },
    capabilitiesByLevel: {
      NONE: "No departments access.",
      VIEW: "View departments pages.",
      EDIT: "View and manage departments.",
      ADMIN: "View and manage departments.",
    },
    defaultLevel: "NONE",
  },
  {
    pageId: "organization_rules",
    label: "Organization Rules",
    path: "/admin/organization-rules",
    module: "management",
    managementMode: true,
    resource: "organization_policy",
    actionsByLevel: { VIEW: "read", EDIT: "manage", ADMIN: "manage" },
    capabilitiesByLevel: {
      NONE: "No organization rules access.",
      VIEW: "View organization rules.",
      EDIT: "Manage organization rules.",
      ADMIN: "Manage organization rules.",
    },
    defaultLevel: "NONE",
  },
  {
    pageId: "employees",
    label: "Employees",
    path: "/employees",
    module: "management",
    managementMode: true,
    resource: "employees",
    actionsByLevel: { VIEW: "read", EDIT: "manage", ADMIN: "delete" },
    capabilitiesByLevel: {
      NONE: "No employee pages access.",
      VIEW: "View employee directory and profiles.",
      EDIT: "View and manage employee directory actions.",
      ADMIN: "Full employee directory administration.",
    },
    defaultLevel: "NONE",
  },
  {
    pageId: "payroll",
    label: "Payroll",
    path: "/payroll",
    module: "management",
    managementMode: true,
    resource: "payroll",
    actionsByLevel: { VIEW: "view", EDIT: "manage", ADMIN: "manage" },
    capabilitiesByLevel: {
      NONE: "No payroll access.",
      VIEW: "View payroll pages.",
      EDIT: "Manage payroll runs.",
      ADMIN: "Manage payroll runs and admin-only actions.",
    },
    defaultLevel: "NONE",
  },
  {
    pageId: "advances",
    label: "Advances",
    path: "/advances",
    module: "management",
    managementMode: true,
    resource: "payroll",
    actionsByLevel: { VIEW: "view", EDIT: "manage", ADMIN: "manage" },
    capabilitiesByLevel: {
      NONE: "No advances access.",
      VIEW: "View advances.",
      EDIT: "Manage advances.",
      ADMIN: "Manage advances.",
    },
    defaultLevel: "NONE",
  },
  {
    pageId: "reports",
    label: "Reports",
    path: "/reports",
    module: "management",
    managementMode: true,
    resource: "reports",
    actionsByLevel: { VIEW: "read", EDIT: "read", ADMIN: "read" },
    capabilitiesByLevel: {
      NONE: "No reports access.",
      VIEW: "View organization reports and warnings.",
      EDIT: "View organization reports and warnings.",
      ADMIN: "View organization reports and warnings.",
    },
    defaultLevel: "NONE",
  },
  {
    pageId: "leave_operations",
    label: "Leave operations",
    path: "/leave-operations",
    module: "management",
    managementMode: true,
    resource: "holidays",
    actionsByLevel: { VIEW: "read", EDIT: "manage", ADMIN: "manage" },
    capabilitiesByLevel: {
      NONE: "No leave operations access.",
      VIEW: "View leave operations.",
      EDIT: "Manage leave operations.",
      ADMIN: "Manage leave operations.",
    },
    defaultLevel: "NONE",
  },
  {
    pageId: "holidays",
    label: "Holidays",
    path: "/admin/holidays",
    module: "management",
    managementMode: true,
    resource: "holidays",
    actionsByLevel: { VIEW: "read", EDIT: "manage", ADMIN: "manage" },
    capabilitiesByLevel: {
      NONE: "No holidays access.",
      VIEW: "View holidays.",
      EDIT: "Create and edit holidays.",
      ADMIN: "Create, edit, and delete holidays.",
    },
    defaultLevel: "NONE",
  },
  {
    pageId: "permissions_admin",
    label: "Permissions admin",
    path: "/admin/users",
    module: "management",
    managementMode: true,
    resource: "permissions",
    actionsByLevel: { VIEW: "read", EDIT: "manage", ADMIN: "manage" },
    capabilitiesByLevel: {
      NONE: "No permissions admin access.",
      VIEW: "No permissions admin access.",
      EDIT: "Manage access policy and templates.",
      ADMIN: "Full permissions administration.",
    },
    defaultLevel: "NONE",
  },
  {
    pageId: "password_requests",
    label: "Password requests",
    path: "/admin/password-requests",
    module: "management",
    managementMode: true,
    resource: "auth",
    actionsByLevel: { VIEW: "manage", EDIT: "manage", ADMIN: "manage" },
    capabilitiesByLevel: {
      NONE: "No password requests access.",
      VIEW: "Review password requests.",
      EDIT: "Review password requests.",
      ADMIN: "Review password requests.",
    },
    defaultLevel: "NONE",
  },
  {
    pageId: "leave_approvals",
    label: "Leave approvals",
    path: "/employees/time-off/approvals",
    module: "management",
    managementMode: true,
    resource: "leaves",
    actionsByLevel: { VIEW: "read", EDIT: "approve", ADMIN: "approve" },
    capabilitiesByLevel: {
      NONE: "No leave approvals access.",
      VIEW: "Review leave requests.",
      EDIT: "Review and approve leave requests.",
      ADMIN: "Review and approve leave requests.",
    },
    defaultLevel: "NONE",
  },
  {
    pageId: "bonus_approvals",
    label: "Bonus approvals",
    path: "/employees/bonus-approvals",
    module: "management",
    managementMode: true,
    resource: "assessments",
    actionsByLevel: { VIEW: "read", EDIT: "manage", ADMIN: "manage" },
    capabilitiesByLevel: {
      NONE: "No bonus approvals access.",
      VIEW: "Review bonus workflows.",
      EDIT: "Review and approve bonus workflows.",
      ADMIN: "Review and approve bonus workflows.",
    },
    defaultLevel: "NONE",
  },
  {
    pageId: "onboarding",
    label: "Onboarding approvals",
    path: "/employees/onboarding",
    module: "management",
    managementMode: true,
    resource: "onboarding",
    actionsByLevel: { VIEW: "read", EDIT: "manage", ADMIN: "manage" },
    capabilitiesByLevel: {
      NONE: "No onboarding pages access.",
      VIEW: "Access onboarding queue pages.",
      EDIT: "Access onboarding queue pages.",
      ADMIN: "Access onboarding queue pages.",
    },
    defaultLevel: "NONE",
  },
]);

export const PAGE_ACCESS_LEVELS = Object.freeze(["NONE", "VIEW", "EDIT", "ADMIN"]);
const PAGE_LEVEL_RANK = Object.freeze({
  NONE: 0,
  VIEW: 1,
  EDIT: 2,
  ADMIN: 3,
});
const PAGE_LEVEL_SEQUENCE = Object.freeze(["VIEW", "EDIT", "ADMIN"]);
const PAGE_RESOURCE_PRIORITY = Object.freeze({
  attendance: ["attendance", "attendance_analysis"],
  employees: ["employees", "organizations"],
  payroll: ["payroll", "advances"],
  holidays: ["leave_operations", "holidays"],
});

const ROLE_PERMISSIONS = Object.freeze({
  [ROLE.MANAGER]: {
    employees: ["read"],
    attendance: ["read"],
    leaves: ["read", "approve"],
    dashboard: ["read"],
    performance: ["read", "create"],
    assessments: ["read", "assess"],
  },
  [ROLE.TEAM_LEADER]: {
    employees: ["read"],
    attendance: ["read"],
    leaves: ["read", "approve"],
    dashboard: ["read"],
    performance: ["read"],
    assessments: ["read", "assess"],
  },
  [ROLE.EMPLOYEE]: {
    employees: ["read"],
    attendance: ["read"],
    leaves: ["read"],
    payroll: ["view"],
    alerts: ["read"],
    assessments: ["read"],
  },
});

function isHrRole(role) {
  return role === ROLE.HR || role === ROLE.HR_STAFF || role === ROLE.HR_MANAGER;
}

function roleScope(role) {
  return ROLE_SCOPE[role] || "self";
}

function hrTemplatePermissions(user) {
  const templates = Array.isArray(user?.hrTemplates) ? user.hrTemplates : [];
  const merged = {};
  for (const tpl of templates) {
    const templateDef = HR_TEMPLATES[tpl];
    if (!templateDef) continue;
    for (const [resource, actions] of Object.entries(templateDef)) {
      if (!Array.isArray(actions)) continue;
      if (!merged[resource]) merged[resource] = new Set();
      for (const action of actions) merged[resource].add(action);
    }
  }
  return merged;
}

function hasHrTemplateAccess(user, resource, action) {
  const perms = hrTemplatePermissions(user);
  const allowed = perms[resource];
  if (!allowed) return false;
  if (allowed.has(action)) return true;
  if (action === "manage") {
    return (
      allowed.has("update") ||
      allowed.has("create") ||
      allowed.has("approve") ||
      allowed.has("delete")
    );
  }
  if (action === "read") {
    return allowed.has("view");
  }
  return false;
}

function hasRolePermission(role, resource, action) {
  const allowed = ROLE_PERMISSIONS[role]?.[resource];
  if (!Array.isArray(allowed)) return false;
  if (allowed.includes(action)) return true;
  if (action === "read") return allowed.includes("view");
  return false;
}

function resolveOverrideLevelForPage(user, pageId) {
  if (normalizeRole(user?.role) === ROLE.ADMIN) return "ADMIN";
  const rows = Array.isArray(user?.pageAccessOverrides) ? user.pageAccessOverrides : [];
  const row = rows.find((item) => String(item?.pageId || "") === String(pageId));
  const level = String(row?.level || "NONE").toUpperCase();
  return Object.prototype.hasOwnProperty.call(PAGE_LEVEL_RANK, level) ? level : "NONE";
}

function hasExplicitPageOverride(user, pageId) {
  if (normalizeRole(user?.role) === ROLE.ADMIN) return true;
  const rows = Array.isArray(user?.pageAccessOverrides) ? user.pageAccessOverrides : [];
  return rows.some((item) => String(item?.pageId || "") === String(pageId));
}

function resolveRequiredLevelForAction(page, action) {
  const actionsByLevel = page?.actionsByLevel || {};
  const requested = String(action || "").trim().toLowerCase();
  for (const level of PAGE_LEVEL_SEQUENCE) {
    const mapped = String(actionsByLevel[level] || "").trim().toLowerCase();
    if (mapped && mapped === requested) return level;
  }
  return null;
}

function resolvePagePolicyRequirement(resource, action, context = {}) {
  const pageIdHint = String(context?.pageId || "").trim();
  if (pageIdHint) {
    const hinted = PAGE_POLICY_CATALOG.find(
      (page) =>
        page.managementMode &&
        String(page.pageId) === pageIdHint &&
        String(page.resource) === String(resource),
    );
    const required = resolveRequiredLevelForAction(hinted, action);
    if (hinted && required) return { pageId: hinted.pageId, requiredLevel: required };
  }

  const candidates = PAGE_POLICY_CATALOG.filter(
    (page) => page.managementMode && String(page.resource) === String(resource),
  );
  if (candidates.length === 0) return null;

  const priority = PAGE_RESOURCE_PRIORITY[String(resource)] || [];
  const sorted = [...candidates].sort((a, b) => {
    const ai = priority.indexOf(String(a.pageId));
    const bi = priority.indexOf(String(b.pageId));
    const av = ai === -1 ? Number.MAX_SAFE_INTEGER : ai;
    const bv = bi === -1 ? Number.MAX_SAFE_INTEGER : bi;
    return av - bv;
  });

  for (const page of sorted) {
    const required = resolveRequiredLevelForAction(page, action);
    if (required) return { pageId: page.pageId, requiredLevel: required };
  }
  return null;
}

function canManagePolicyByAssignment(user, role) {
  if (role === ROLE.ADMIN) return true;
  if (!isHrRole(role)) return false;
  return (
    String(user?.hrLevel || "STAFF").toUpperCase() === "MANAGER" ||
    hasHrTemplateAccess(user, "permissions", "manage")
  );
}

export async function can(user, action, resource, context = {}) {
  if (!user) return { allow: false, reason: "unauthenticated", scope: "none" };
  const role = normalizeRole(user?.role);
  if (role === ROLE.ADMIN) return { allow: true, reason: "admin", scope: "all" };

  const scope = roleScope(role);
  const pageRequirement = resolvePagePolicyRequirement(resource, action, context || {});
  if (pageRequirement) {
    // Treat page overrides as explicit customizations.
    // If no explicit override row exists, fall back to baseline role/resource policy.
    if (hasExplicitPageOverride(user, pageRequirement.pageId)) {
      const grantedLevel = resolveOverrideLevelForPage(user, pageRequirement.pageId);
      const enough =
        (PAGE_LEVEL_RANK[grantedLevel] || 0) >=
        (PAGE_LEVEL_RANK[pageRequirement.requiredLevel] || 0);
      return enough
        ? {
            allow: true,
            reason: "page_override_allow",
            scope: scope === "company" ? "all" : scope,
            pageId: pageRequirement.pageId,
            requiredLevel: pageRequirement.requiredLevel,
            grantedLevel,
          }
        : {
            allow: false,
            reason: "page_override_deny",
            scope: "none",
            pageId: pageRequirement.pageId,
            requiredLevel: pageRequirement.requiredLevel,
            grantedLevel,
          };
    }
  }

  if (resource === "users" || resource === "permissions") {
    const inHrDepartment = await isHrDepartmentMember(user);
    const hasPolicyAssignment = canManagePolicyByAssignment(user, role);
    const allow = inHrDepartment && hasPolicyAssignment;
    return allow
      ? { allow: true, reason: "policy_assignment_allow", scope: "all" }
      : { allow: false, reason: "policy_assignment_required", scope: "none" };
  }

  if (resource === "reports") {
    const allow = isHrRole(role);
    return allow
      ? { allow: true, reason: "hr_reports", scope: "all" }
      : { allow: false, reason: "role_forbidden", scope: "none" };
  }

  if (resource === "holidays") {
    if (action === "manage") {
      const allow = role === ROLE.HR_MANAGER;
      return allow
        ? { allow: true, reason: "hr_manager_holidays_manage", scope: "all" }
        : { allow: false, reason: "role_forbidden", scope: "none" };
    }
    const allow = role === ROLE.HR_STAFF || role === ROLE.HR_MANAGER;
    return allow
      ? { allow: true, reason: "hr_holidays_read", scope: "all" }
      : { allow: false, reason: "role_forbidden", scope: "none" };
  }

  if (resource === "employees") {
    if (isHrRole(role)) {
      const allow = action === "read"
        ? hasHrTemplateAccess(user, "employees", "read")
        : hasHrTemplateAccess(user, "employees", action);
      return { allow, reason: allow ? "hr_template_allow" : "hr_template_deny", scope };
    }
    const allow = hasRolePermission(role, "employees", action);
    return { allow, reason: allow ? "role_matrix_allow" : "role_matrix_deny", scope };
  }

  if (resource === "assessments" && action === "manage") {
    const allow =
      isHrRole(role) &&
      ((user?.hrLevel || "STAFF") === "MANAGER" ||
        hasHrTemplateAccess(user, "payroll", "manage") ||
        hasHrTemplateAccess(user, "salaries", "update"));
    return allow
      ? { allow: true, reason: "hr_assessment_manage", scope: "all" }
      : { allow: false, reason: "role_forbidden", scope: "none" };
  }

  if (resource === "leaves") {
    if (isHrRole(role)) {
      if (action === "read" && context?.selfOnly === true) {
        return {
          allow: true,
          reason: "self_leave_read",
          scope: "self",
        };
      }
      const allow =
        (action === "read" &&
          (hasHrTemplateAccess(user, "leaves", "read") ||
            hasHrTemplateAccess(user, "leaves", "view"))) ||
        (action === "approve" &&
          (hasHrTemplateAccess(user, "leaves", "approve") ||
            (user?.hrLevel || "STAFF") === "MANAGER"));
      return {
        allow: Boolean(allow),
        reason: allow ? "hr_leaves_allow" : "hr_template_deny",
        scope,
      };
    }
    const allow = hasRolePermission(role, "leaves", action);
    return { allow, reason: allow ? "role_matrix_allow" : "role_forbidden", scope };
  }

  if (resource === "assessments" && action === "assess") {
    if (isHrRole(role)) {
      return { allow: true, reason: "hr_assessment", scope: "all" };
    }
    if (role === ROLE.MANAGER || role === ROLE.TEAM_LEADER) {
      return { allow: true, reason: "relationship_required", scope: "scoped" };
    }
    return { allow: false, reason: "role_forbidden", scope: "none" };
  }

  if (resource === "assessments" && action === "read") {
    if (isHrRole(role)) {
      return { allow: true, reason: "hr_assessment_read", scope: "all" };
    }
    if (role === ROLE.EMPLOYEE || role === ROLE.MANAGER || role === ROLE.TEAM_LEADER) {
      return { allow: true, reason: "self_or_relationship_required", scope: "scoped" };
    }
    return { allow: false, reason: "role_forbidden", scope: "none" };
  }

  if (resource === "teams" || resource === "departments" || resource === "bulk") {
    if (action === "read") {
      return { allow: true, reason: "authenticated_read", scope: "all" };
    }
    return { allow: false, reason: "admin_only", scope: "none" };
  }

  if (resource === "positions") {
    if (action === "read") {
      return { allow: true, reason: "authenticated_read", scope: "all" };
    }
    const allow = isHrRole(role);
    return allow
      ? { allow: true, reason: "hr_position_manage", scope: "all" }
      : { allow: false, reason: "admin_only", scope: "none" };
  }

  if (resource === "branches") {
    if (action === "read") {
      return { allow: true, reason: "authenticated_read", scope: "all" };
    }
    if (action === "delete") {
      return { allow: false, reason: "admin_only", scope: "none" };
    }
    const allow = isHrRole(role);
    return allow
      ? { allow: true, reason: "hr_branch_manage", scope: "all" }
      : { allow: false, reason: "role_forbidden", scope: "none" };
  }

  if (resource === "onboarding") {
    const allow = isHrRole(role);
    return allow
      ? { allow: true, reason: "hr_onboarding", scope: "all" }
      : { allow: false, reason: "role_forbidden", scope: "none" };
  }

  if (resource === "attendance") {
    if (action === "manage") {
      const allow =
        (isHrRole(role) &&
          (hasHrTemplateAccess(user, "attendance", "manage") ||
            hasHrTemplateAccess(user, "attendance", "update") ||
            hasHrTemplateAccess(user, "attendance", "create") ||
            hasHrTemplateAccess(user, "attendance", "approve"))) ||
        false;
      return allow
        ? { allow: true, reason: "hr_attendance", scope: "all" }
        : { allow: false, reason: "role_forbidden", scope: "none" };
    }
    if (isHrRole(role)) {
      const allow =
        hasHrTemplateAccess(user, "attendance", "read") ||
        hasHrTemplateAccess(user, "attendance", "view") ||
        user?.hrLevel === "MANAGER";
      return {
        allow,
        reason: allow ? "hr_attendance_read" : "hr_template_deny",
        scope,
      };
    }
    const allow = hasRolePermission(role, "attendance", "read");
    return { allow, reason: allow ? "role_matrix_allow" : "role_forbidden", scope };
  }

  if (resource === "payroll") {
    if (action === "manage") {
      const allow = isHrRole(role) && hasHrTemplateAccess(user, "payroll", "manage");
      return allow
        ? { allow: true, reason: "hr_payroll", scope: "all" }
        : { allow: false, reason: "role_forbidden", scope: "none" };
    }
    if (action === "view") {
      const allow =
        (isHrRole(role) &&
          (hasHrTemplateAccess(user, "payroll", "view") ||
            hasHrTemplateAccess(user, "salaries", "read"))) ||
        hasRolePermission(role, "payroll", "view");
      return allow
        ? { allow: true, reason: "hr_payroll_view", scope: "all" }
        : { allow: false, reason: "role_forbidden", scope: "none" };
    }
    return { allow: false, reason: "role_forbidden", scope: "none" };
  }

  if (resource === "alerts") {
    if (action === "manage") {
      const allow = isHrRole(role);
      return allow
        ? { allow: true, reason: "hr_alerts", scope: "all" }
        : { allow: false, reason: "role_forbidden", scope: "none" };
    }
    const isHr = isHrRole(role);
    return isHr
      ? { allow: true, reason: "hr_alerts", scope: "all" }
      : { allow: true, reason: "self_alerts", scope: "self" };
  }

  if (resource === "organization_policy") {
    if (action === "read") {
      return { allow: true, reason: "authenticated_read", scope: "all" };
    }
    if (action === "manage") {
      return role === ROLE.ADMIN
        ? { allow: true, reason: "admin_only", scope: "all" }
        : { allow: false, reason: "admin_only", scope: "none" };
    }
    return { allow: false, reason: "unsupported_action", scope: "none" };
  }

  if (resource === "auth") {
    const inHrDepartment = await isHrDepartmentMember(user);
    const hasPolicyAssignment = canManagePolicyByAssignment(user, role);
    const allow = inHrDepartment && hasPolicyAssignment;
    return allow
      ? { allow: true, reason: "policy_assignment_auth_allow", scope: "all" }
      : { allow: false, reason: "policy_assignment_required", scope: "none" };
  }

  if (resource === "dashboard") {
    const allow =
      role === ROLE.HR ||
      role === ROLE.HR_STAFF ||
      role === ROLE.HR_MANAGER ||
      role === ROLE.MANAGER ||
      role === ROLE.TEAM_LEADER;
    return allow
      ? { allow: true, reason: "leadership_dashboard", scope: "scoped" }
      : { allow: false, reason: "role_forbidden", scope: "none" };
  }

  return { allow: false, reason: "no_policy", scope: "none" };
}

export async function isHrDepartmentHead(user) {
  if (!user?.email && !user?.id) return false;
  const conditions = [];
  if (user.email) conditions.push({ head: user.email });
  if (user.id) conditions.push({ headId: user.id });
  if (conditions.length === 0) return false;
  const hrName = process.env.HR_DEPARTMENT_NAME || "HR";
  const dep = await Department.findOne({
    name: hrName,
    $or: conditions,
  })
    .select("_id")
    .lean();
  return Boolean(dep);
}

export async function isHrDepartmentMember(user) {
  if (!user) return false;
  if (typeof user?.isHrDepartmentMember === "boolean") {
    return user.isHrDepartmentMember;
  }

  const hrName = String(process.env.HR_DEPARTMENT_NAME || "HR");
  const hrNameUpper = hrName.toUpperCase();

  if (String(user?.department || "").trim().toUpperCase() === hrNameUpper) {
    return true;
  }

  if (user?.departmentId) {
    const dep = await Department.findOne({
      _id: user.departmentId,
      name: hrName,
    })
      .select("_id")
      .lean();
    if (dep) return true;
  }

  if (user?.id) {
    const employee = await Employee.findById(user.id)
      .select("department departmentId")
      .lean();
    if (!employee) return false;
    if (String(employee?.department || "").trim().toUpperCase() === hrNameUpper) {
      return true;
    }
    if (employee?.departmentId) {
      const dep = await Department.findOne({
        _id: employee.departmentId,
        name: hrName,
      })
        .select("_id")
        .lean();
      return Boolean(dep);
    }
  }

  return false;
}

export async function simulateAccess(input) {
  return can(input.user, input.action, input.resource, input.context || {});
}

/**
 * Resolves access level for each page from the canonical catalog.
 * Deny-by-default when no action is allowed.
 */
export async function simulatePageCatalogAccess(user, context = {}) {
  const resolved = [];
  for (const page of PAGE_POLICY_CATALOG) {
    const pageContext = { ...(context || {}), pageId: page.pageId };
    const viewDecision = await can(
      user,
      page.actionsByLevel?.VIEW || "read",
      page.resource,
      pageContext,
    );
    const editDecision = await can(
      user,
      page.actionsByLevel?.EDIT || page.actionsByLevel?.VIEW || "read",
      page.resource,
      pageContext,
    );
    const adminDecision = await can(
      user,
      page.actionsByLevel?.ADMIN || page.actionsByLevel?.EDIT || "read",
      page.resource,
      pageContext,
    );
    const grantedLevels = [viewDecision, editDecision, adminDecision]
      .filter((d) => d?.allow)
      .map((d) => String(d?.grantedLevel || "").toUpperCase())
      .filter((lvl) => Object.prototype.hasOwnProperty.call(PAGE_LEVEL_RANK, lvl));

    let level = "NONE";
    if (grantedLevels.length > 0) {
      level = grantedLevels.sort(
        (a, b) => (PAGE_LEVEL_RANK[b] || 0) - (PAGE_LEVEL_RANK[a] || 0),
      )[0];
    } else {
      if (viewDecision.allow) level = "VIEW";
      if (editDecision.allow) level = "EDIT";
      if (adminDecision.allow) level = "ADMIN";
    }

    resolved.push({
      pageId: page.pageId,
      label: page.label,
      path: page.path,
      module: page.module || "management",
      managementMode: Boolean(page.managementMode),
      resource: page.resource,
      level,
      summary:
        page?.capabilitiesByLevel?.[level] ||
        (level === "NONE" ? "No page access." : "Access granted by current policy."),
      decisions: {
        view: viewDecision,
        edit: editDecision,
        admin: adminDecision,
      },
    });
  }
  return resolved;
}
