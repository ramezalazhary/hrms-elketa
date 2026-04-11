import { Department } from "../models/Department.js";
import { normalizeRole, ROLE, ROLE_LEVEL } from "../utils/roles.js";
import { resolveEmployeeAccess } from "./accessService.js";

export async function can(user, action, resource, context = {}) {
  const role = normalizeRole(user?.role);
  if (!user) return { allow: false, reason: "unauthenticated", scope: "none" };
  if (role === ROLE.ADMIN) return { allow: true, reason: "admin", scope: "all" };

  if (resource === "users" || resource === "permissions") {
    if (role === ROLE.HR_MANAGER) return { allow: true, reason: "hr_manager", scope: "all" };
    if (role === ROLE.HR_STAFF) {
      const isHrHead = await isHrDepartmentHead(user);
      return isHrHead
        ? { allow: true, reason: "hr_head", scope: "department" }
        : { allow: false, reason: "not_hr_head", scope: "none" };
    }
    return { allow: false, reason: "role_forbidden", scope: "none" };
  }

  if (resource === "reports") {
    const allow = role === ROLE.HR_MANAGER || role === ROLE.HR_STAFF;
    return allow
      ? { allow: true, reason: "hr_reports", scope: "all" }
      : { allow: false, reason: "role_forbidden", scope: "none" };
  }

  if (resource === "employees") {
    if (action === "process_increase") {
      const allow = role === ROLE.HR_STAFF || role === ROLE.HR_MANAGER;
      return {
        allow,
        reason: allow ? "hr_salary_increase" : "role_forbidden",
        scope: allow ? "company" : "self",
      };
    }
    // Migration adapter: policy remains source-of-truth while preserving legacy behavior.
    const legacy = await resolveEmployeeAccess(user);
    const actionMap = {
      read: "view",
      create: "create",
      edit: "edit",
      delete: "delete",
      transfer: "edit",
      export: "export",
    };
    const neededAction = actionMap[action] || "view";
    const allow = Array.isArray(legacy.actions) && legacy.actions.includes(neededAction);
    const scopeMap = {
      all: "company",
      department: "department",
      team: "team",
      self: "self",
    };
    return {
      allow,
      reason: allow ? "legacy_parity_allow" : "legacy_parity_deny",
      scope: scopeMap[legacy.scope] || "self",
      actions: legacy.actions || [],
      allowedTeams: legacy.teams || [],
      allowedDepartments: legacy.departments || [],
      legacyScope: legacy.scope,
    };
  }

  if (resource === "assessments" && action === "manage") {
    const allow = role === ROLE.HR_MANAGER || role === ROLE.HR_STAFF;
    return allow
      ? { allow: true, reason: "hr_assessment_manage", scope: "all" }
      : { allow: false, reason: "role_forbidden", scope: "none" };
  }

  if (resource === "assessments" && action === "assess") {
    if (role === ROLE.HR_STAFF || role === ROLE.HR_MANAGER) {
      return { allow: true, reason: "hr_assessment", scope: "all" };
    }
    if (role === ROLE.MANAGER || role === ROLE.TEAM_LEADER) {
      return { allow: true, reason: "relationship_required", scope: "scoped" };
    }
    return { allow: false, reason: "role_forbidden", scope: "none" };
  }

  if (resource === "assessments" && action === "read") {
    if (role === ROLE.HR_STAFF || role === ROLE.HR_MANAGER) {
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
    const allow = role === ROLE.HR_MANAGER || role === ROLE.HR_STAFF;
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
    const allow = role === ROLE.HR_MANAGER || role === ROLE.HR_STAFF;
    return allow
      ? { allow: true, reason: "hr_branch_manage", scope: "all" }
      : { allow: false, reason: "role_forbidden", scope: "none" };
  }

  if (resource === "onboarding") {
    const allow = role === ROLE.HR_MANAGER || role === ROLE.HR_STAFF;
    return allow
      ? { allow: true, reason: "hr_onboarding", scope: "all" }
      : { allow: false, reason: "role_forbidden", scope: "none" };
  }

  if (resource === "attendance") {
    if (action === "manage") {
      const allow = role === ROLE.HR_MANAGER || role === ROLE.HR_STAFF;
      return allow
        ? { allow: true, reason: "hr_attendance", scope: "all" }
        : { allow: false, reason: "role_forbidden", scope: "none" };
    }
    return { allow: true, reason: "authenticated_read", scope: "scoped" };
  }

  if (resource === "payroll") {
    if (action === "manage") {
      const allow = role === ROLE.HR_MANAGER || role === ROLE.HR_STAFF;
      return allow
        ? { allow: true, reason: "hr_payroll", scope: "all" }
        : { allow: false, reason: "role_forbidden", scope: "none" };
    }
    if (action === "view") {
      const allow = role === ROLE.HR_MANAGER || role === ROLE.HR_STAFF;
      return allow
        ? { allow: true, reason: "hr_payroll_view", scope: "all" }
        : { allow: false, reason: "role_forbidden", scope: "none" };
    }
    return { allow: false, reason: "role_forbidden", scope: "none" };
  }

  if (resource === "alerts") {
    if (action === "manage") {
      const allow = role === ROLE.HR_MANAGER || role === ROLE.HR_STAFF;
      return allow
        ? { allow: true, reason: "hr_alerts", scope: "all" }
        : { allow: false, reason: "role_forbidden", scope: "none" };
    }
    const isHr = role === ROLE.HR_MANAGER || role === ROLE.HR_STAFF;
    return isHr
      ? { allow: true, reason: "hr_alerts", scope: "all" }
      : { allow: true, reason: "self_alerts", scope: "self" };
  }

  if (resource === "organization_policy") {
    return { allow: false, reason: "admin_only", scope: "none" };
  }

  if (resource === "auth") {
    const allow = role === ROLE.HR_MANAGER || role === ROLE.HR_STAFF;
    const isHrHead = allow ? true : await isHrDepartmentHead(user);
    return isHrHead
      ? { allow: true, reason: "hr_auth_manage", scope: "all" }
      : { allow: false, reason: "role_forbidden", scope: "none" };
  }

  if (resource === "dashboard") {
    return { allow: true, reason: "authenticated_dashboard", scope: "scoped" };
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

export async function simulateAccess(input) {
  return can(input.user, input.action, input.resource, input.context || {});
}
