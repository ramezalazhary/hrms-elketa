import { normaliseRoleKey } from "@/shared/components/EntityBadges";

export const ACCESS_LEVEL = Object.freeze({
  NONE: "NONE",
  VIEW: "VIEW",
  EDIT: "EDIT",
  ADMIN: "ADMIN",
});

const ACCESS_LEVEL_ORDER = Object.freeze({
  [ACCESS_LEVEL.NONE]: 0,
  [ACCESS_LEVEL.VIEW]: 1,
  [ACCESS_LEVEL.EDIT]: 2,
  [ACCESS_LEVEL.ADMIN]: 3,
});

function getPageOverrideLevel(user, pageId) {
  const list = Array.isArray(user?.pageAccessOverrides) ? user.pageAccessOverrides : [];
  const hit = list.find((row) => String(row?.pageId || "") === String(pageId));
  const level = String(hit?.level || "").toUpperCase();
  return Object.prototype.hasOwnProperty.call(ACCESS_LEVEL_ORDER, level) ? level : null;
}

function getPageLevelFromOverrides(user, pageId) {
  const override = getPageOverrideLevel(user, pageId);
  if (override) return override;
  const role = normaliseRoleKey(user?.role);
  if (role === "ADMIN") return ACCESS_LEVEL.ADMIN;
  return ACCESS_LEVEL.NONE;
}

export function hasAccessLevel(level, minimumLevel) {
  return (ACCESS_LEVEL_ORDER[level] || 0) >= (ACCESS_LEVEL_ORDER[minimumLevel] || 0);
}

export function getAccessLevelLabel(level) {
  if (level === ACCESS_LEVEL.ADMIN) return "Admin";
  if (level === ACCESS_LEVEL.EDIT) return "Editor";
  if (level === ACCESS_LEVEL.VIEW) return "Viewer";
  return "No access";
}

export function isHrRole(user) {
  const role = normaliseRoleKey(user?.role);
  return role === "HR" || role === "HR_STAFF" || role === "HR_MANAGER";
}

export function isHrDepartmentMember(user) {
  if (typeof user?.isHrDepartmentMember === "boolean") {
    return user.isHrDepartmentMember;
  }
  return isHrRole(user);
}

export function isHrManagerLevel(user) {
  if (!isHrRole(user)) return false;
  return String(user?.hrLevel || "").toUpperCase() === "MANAGER";
}

export function hasTemplate(user, templateKey) {
  const list = Array.isArray(user?.hrTemplates) ? user.hrTemplates : [];
  return list.includes(templateKey);
}

function hasAnyTemplate(user, templateKeys) {
  return templateKeys.some((key) => hasTemplate(user, key));
}

export function canManagePermissions(user) {
  return hasAccessLevel(getPermissionsAccessLevel(user), ACCESS_LEVEL.EDIT);
}

export function getPermissionsAccessLevel(user) {
  return getPageLevelFromOverrides(user, "permissions_admin");
}

export function canReadEmployees(user) {
  return hasAccessLevel(getEmployeesAccessLevel(user), ACCESS_LEVEL.VIEW);
}

export function canManageEmployees(user) {
  return hasAccessLevel(getEmployeesAccessLevel(user), ACCESS_LEVEL.EDIT);
}

export function getEmployeesAccessLevel(user) {
  const override = getPageLevelFromOverrides(user, "employees");
  if (override !== ACCESS_LEVEL.NONE) return override;
  const role = normaliseRoleKey(user?.role);
  // Managers and team leaders need baseline read access to open
  // employee profiles for their scoped team/department members.
  if (role === "MANAGER" || role === "TEAM_LEADER") {
    return ACCESS_LEVEL.VIEW;
  }
  return ACCESS_LEVEL.NONE;
}

export function getEmployeeDirectoryAccessLevel(user) {
  return getEmployeesAccessLevel(user);
}

export function canManageDepartments(user) {
  return hasAccessLevel(getDepartmentsAccessLevel(user), ACCESS_LEVEL.EDIT);
}

export function getOrganizationsAccessLevel(user) {
  return getPageLevelFromOverrides(user, "organizations");
}

export function canAccessOrganizations(user) {
  return hasAccessLevel(getOrganizationsAccessLevel(user), ACCESS_LEVEL.VIEW);
}

export function getDepartmentsAccessLevel(user) {
  return getPageLevelFromOverrides(user, "departments");
}

export function canAccessDepartments(user) {
  return hasAccessLevel(getDepartmentsAccessLevel(user), ACCESS_LEVEL.VIEW);
}

export function canReadHolidays(user) {
  return hasAccessLevel(getHolidaysAccessLevel(user), ACCESS_LEVEL.VIEW);
}

export function getHolidaysAccessLevel(user) {
  return getPageLevelFromOverrides(user, "holidays");
}

export function canManageHolidays(user) {
  return hasAccessLevel(getHolidaysAccessLevel(user), ACCESS_LEVEL.EDIT);
}

export function getLeaveOperationsAccessLevel(user) {
  const override = getPageOverrideLevel(user, "leave_operations");
  if (override) return override;
  const legacyHolidaysOverride = getPageOverrideLevel(user, "holidays");
  if (legacyHolidaysOverride) return legacyHolidaysOverride;
  const role = normaliseRoleKey(user?.role);
  if (role === "ADMIN") return ACCESS_LEVEL.ADMIN;
  if (role === "HR_MANAGER") return ACCESS_LEVEL.EDIT;
  if (role === "HR_STAFF" || role === "HR") return ACCESS_LEVEL.VIEW;
  return ACCESS_LEVEL.NONE;
}

export function canAccessLeaveOperations(user) {
  return hasAccessLevel(getLeaveOperationsAccessLevel(user), ACCESS_LEVEL.VIEW);
}

export function canApproveLeaves(user) {
  return hasAccessLevel(getLeaveApprovalsAccessLevel(user), ACCESS_LEVEL.EDIT);
}

export function canAccessLeaveApprovals(user) {
  return hasAccessLevel(getLeaveApprovalsAccessLevel(user), ACCESS_LEVEL.VIEW);
}

export function getLeaveApprovalsAccessLevel(user) {
  const override = getPageOverrideLevel(user, "leave_approvals");
  if (override) return override;
  const role = normaliseRoleKey(user?.role);
  if (role === "ADMIN") return ACCESS_LEVEL.ADMIN;
  if (role === "HR_MANAGER" || role === "HR" || role === "HR_STAFF") {
    return ACCESS_LEVEL.EDIT;
  }
  // Team leaders and managers get baseline EDIT access so they can see
  // history, and approve requests in their queue (matching backend policy).
  if (role === "MANAGER" || role === "TEAM_LEADER") return ACCESS_LEVEL.EDIT;
  return ACCESS_LEVEL.NONE;
}

export function canManageBonusApprovals(user) {
  return hasAccessLevel(getPageLevelFromOverrides(user, "bonus_approvals"), ACCESS_LEVEL.EDIT);
}

export function canManagePayroll(user) {
  return hasAccessLevel(getPayrollAccessLevel(user), ACCESS_LEVEL.EDIT);
}

export function canViewPayroll(user) {
  return hasAccessLevel(getPayrollAccessLevel(user), ACCESS_LEVEL.VIEW);
}

export function getPayrollAccessLevel(user) {
  return getPageLevelFromOverrides(user, "payroll");
}

export function getAdvancesAccessLevel(user) {
  return getPageLevelFromOverrides(user, "advances");
}

export function canAccessAdvances(user) {
  return hasAccessLevel(getAdvancesAccessLevel(user), ACCESS_LEVEL.VIEW);
}

export function canViewReports(user) {
  return hasAccessLevel(getReportsAccessLevel(user), ACCESS_LEVEL.VIEW);
}

export function getReportsAccessLevel(user) {
  return getPageLevelFromOverrides(user, "reports");
}

export function canAccessAttendance(user) {
  return hasAccessLevel(getAttendanceAccessLevel(user), ACCESS_LEVEL.VIEW);
}

export function getAttendanceAccessLevel(user) {
  return getPageLevelFromOverrides(user, "attendance");
}

export function canViewAttendanceAnalysis(user) {
  const analysisLevel = getPageLevelFromOverrides(user, "attendance_analysis");
  if (hasAccessLevel(analysisLevel, ACCESS_LEVEL.VIEW)) return true;
  // Admin level on attendance implies full read/edit/analysis scope.
  return hasAccessLevel(getAttendanceAccessLevel(user), ACCESS_LEVEL.ADMIN);
}

export function canManageAttendance(user) {
  return hasAccessLevel(getAttendanceAccessLevel(user), ACCESS_LEVEL.EDIT);
}

export function canAccessDashboardPage(user) {
  return hasAccessLevel(getDashboardAccessLevel(user), ACCESS_LEVEL.VIEW);
}

export function getDashboardAccessLevel(user) {
  const override = getPageOverrideLevel(user, "dashboard");
  if (override) return override;
  const role = normaliseRoleKey(user?.role);
  // Baseline management access: dashboard is operationally required for leadership roles
  // even when explicit page override rows are not configured yet.
  if (
    role === "ADMIN" ||
    role === "HR_MANAGER" ||
    role === "HR_STAFF" ||
    role === "HR" ||
    role === "MANAGER" ||
    role === "TEAM_LEADER"
  ) {
    return ACCESS_LEVEL.VIEW;
  }
  return ACCESS_LEVEL.NONE;
}

export function canAccessOnboardingApprovals(user) {
  return hasAccessLevel(getPageLevelFromOverrides(user, "onboarding"), ACCESS_LEVEL.VIEW);
}

export function canManageOnboardingApprovals(user) {
  return hasAccessLevel(getPageLevelFromOverrides(user, "onboarding"), ACCESS_LEVEL.EDIT);
}

export function canManageOrganizationRules(user) {
  return hasAccessLevel(getPageLevelFromOverrides(user, "organization_rules"), ACCESS_LEVEL.EDIT);
}

export function canManagePartners(user, chiefExecutiveEmployeeId) {
  const role = normaliseRoleKey(user?.role);
  if (role === "ADMIN") return true;
  if (!chiefExecutiveEmployeeId || !user?.id) return false;
  return String(user.id) === String(chiefExecutiveEmployeeId);
}

export function canAccessPasswordRequests(user) {
  return hasAccessLevel(getPageLevelFromOverrides(user, "password_requests"), ACCESS_LEVEL.VIEW);
}
