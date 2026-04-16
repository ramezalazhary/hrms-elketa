import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useState, useMemo, memo } from "react";
import { useAppDispatch, useAppSelector } from "@/shared/hooks/reduxHooks";
import { logoutThunk, setViewMode } from "@/modules/identity/store";
import { normaliseRoleKey } from "@/shared/components/EntityBadges";
import { canManagePermissions } from "@/shared/utils/accessControl";
import { canReadEmployees } from "@/shared/utils/accessControl";
import { canAccessLeaveApprovals } from "@/shared/utils/accessControl";
import { canManageBonusApprovals } from "@/shared/utils/accessControl";
import { canManagePayroll } from "@/shared/utils/accessControl";
import { canViewPayroll } from "@/shared/utils/accessControl";
import { canViewReports } from "@/shared/utils/accessControl";
import { canAccessAttendance } from "@/shared/utils/accessControl";
import { canAccessLeaveOperations } from "@/shared/utils/accessControl";
import { canAccessDashboardPage } from "@/shared/utils/accessControl";
import { canAccessOrganizations } from "@/shared/utils/accessControl";
import { canAccessDepartments } from "@/shared/utils/accessControl";
import { canAccessAdvances } from "@/shared/utils/accessControl";
import { canManageOrganizationRules } from "@/shared/utils/accessControl";
import { canAccessPasswordRequests } from "@/shared/utils/accessControl";
import { getAccessLevelLabel } from "@/shared/utils/accessControl";
import { getAttendanceAccessLevel } from "@/shared/utils/accessControl";
import { getAdvancesAccessLevel } from "@/shared/utils/accessControl";
import { getDepartmentsAccessLevel } from "@/shared/utils/accessControl";
import { getEmployeesAccessLevel } from "@/shared/utils/accessControl";
import { getLeaveOperationsAccessLevel } from "@/shared/utils/accessControl";
import { getOrganizationsAccessLevel } from "@/shared/utils/accessControl";
import { getPayrollAccessLevel } from "@/shared/utils/accessControl";
import { getPermissionsAccessLevel } from "@/shared/utils/accessControl";
import { getReportsAccessLevel } from "@/shared/utils/accessControl";
import { Breadcrumb } from "@/shared/components/Breadcrumb";
import {
  Home,
  Users,
  Network,
  Briefcase,
  LogOut,
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  UserCog,
  FileKey,
  Menu,
  X,
  CalendarRange,
  Settings,
  Bell,
  Search,
  CalendarCheck,
  BarChart3,
  Wallet,
  CircleDollarSign,
  CalendarOff,
  Sparkles,
  Shield,
} from "lucide-react";

/**
 * Enhanced dashboard layout with improved UI/UX
 * Features: better navigation, search, notifications, breadcrumbs
 */
export function DashboardLayout() {
  const [isCollapsed, setIsCollapsed] = useState(() => {
    try {
      const saved = localStorage.getItem("sidebar-collapsed");
      if (saved !== null) return JSON.parse(saved);
    } catch {
      /* ignore invalid stored value */
    }
    return false;
  });
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState({
    Organizations: true,
    "HR Operations": true,
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [showNotifications, setShowNotifications] = useState(false);

  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { currentUser, viewMode } = useAppSelector((state) => state.identity);
  const currentRole = normaliseRoleKey(currentUser?.role);
  const hrLevel = String(currentUser?.hrLevel || "STAFF").toUpperCase();

  const isAdmin = currentRole === "ADMIN";
  const isHRRole =
    currentRole === "HR" ||
    currentRole === "HR_STAFF" ||
    currentRole === "HR_MANAGER";
  const isHrManager = isHRRole && hrLevel === "MANAGER";
  const canOpenLeaveApprovals = canAccessLeaveApprovals(currentUser);
  const isHrBonusApprover = canManageBonusApprovals(currentUser);
  const canOpenPayroll = canViewPayroll(currentUser);
  const canOpenReports = canViewReports(currentUser);
  const canOpenAttendance = canAccessAttendance(currentUser);
  const canOpenLeaveOpsPage = canAccessLeaveOperations(currentUser);
  const canOpenDashboard = canAccessDashboardPage(currentUser);
  const canOpenOrganizations = canAccessOrganizations(currentUser);
  const canOpenDepartments = canAccessDepartments(currentUser);
  const canOpenAdvances = canAccessAdvances(currentUser);
  const canOpenOrganizationRules = canManageOrganizationRules(currentUser);
  const canOpenPasswordRequests = canAccessPasswordRequests(currentUser);
  const canOpenLeaveOperations = canOpenLeaveOpsPage;

  const hasHrOpsAccess = canOpenAttendance;
  const hasManagementCapabilities =
    isAdmin ||
    isHrManager ||
    currentRole === "HR_STAFF" ||
    currentRole === "MANAGER" ||
    currentRole === "TEAM_LEADER" ||
    currentRole === "HR" ||
    (Array.isArray(currentUser?.hrTemplates) &&
      currentUser.hrTemplates.length > 0) ||
    (Array.isArray(currentUser?.permissions) && currentUser.permissions.length > 0);
  const isManagementMode = hasManagementCapabilities && viewMode === "management";
  const canOpenPermissionsPage = canManagePermissions(currentUser);
  const canOpenEmployeesPages = canReadEmployees(currentUser);
  const attendanceLevelLabel = getAccessLevelLabel(getAttendanceAccessLevel(currentUser));
  const advancesLevelLabel = getAccessLevelLabel(getAdvancesAccessLevel(currentUser));
  const departmentsLevelLabel = getAccessLevelLabel(getDepartmentsAccessLevel(currentUser));
  const employeesLevelLabel = getAccessLevelLabel(getEmployeesAccessLevel(currentUser));
  const leaveOpsLevelLabel = getAccessLevelLabel(getLeaveOperationsAccessLevel(currentUser));
  const organizationsLevelLabel = getAccessLevelLabel(getOrganizationsAccessLevel(currentUser));
  const payrollLevelLabel = getAccessLevelLabel(getPayrollAccessLevel(currentUser));
  const reportsLevelLabel = getAccessLevelLabel(getReportsAccessLevel(currentUser));
  const permissionsLevelLabel = getAccessLevelLabel(getPermissionsAccessLevel(currentUser));

  const toggleSidebarSize = () => {
    setIsCollapsed((prev) => {
      const newVal = !prev;
      localStorage.setItem("sidebar-collapsed", JSON.stringify(newVal));
      return newVal;
    });
  };

  const toggleGroup = (label) => {
    if (isCollapsed) setIsCollapsed(false);
    setExpandedGroups((prev) => ({
      ...prev,
      [label]: !prev[label],
    }));
  };

  const navStructure = useMemo(() => {
    const structure = [];

    if (!isManagementMode) {
      structure.push({ type: "link", to: "/", label: "Home", icon: Home });
    }

    const canApproveLeave = isManagementMode && canOpenLeaveApprovals;

    if (canApproveLeave) {
      structure.push({
        type: "link",
        to: "/employees/time-off/approvals",
        label: "Leave approvals",
        icon: CalendarRange,
      });
    }

    if (isManagementMode && isHrBonusApprover) {
      structure.push({
        type: "link",
        to: "/employees/bonus-approvals",
        label: "Bonus approvals",
        icon: CalendarCheck,
      });
    }

    if (canOpenDashboard && isManagementMode && currentRole === "TEAM_LEADER") {
      structure.push({
        type: "link",
        to: "/dashboard",
        label: "My Team",
        icon: Users,
      });
    } else if (canOpenDashboard && isManagementMode && currentRole === "MANAGER") {
      structure.push({
        type: "link",
        to: "/dashboard",
        label: "My Department",
        icon: LayoutDashboard,
      });
    } else if (canOpenDashboard && isManagementMode) {
      structure.push({
        type: "link",
        to: "/dashboard",
        label: "Management Dashboard",
        icon: LayoutDashboard,
      });
    }

    if (
      isManagementMode &&
      (canOpenOrganizations ||
        canOpenEmployeesPages ||
        canOpenDepartments ||
        canOpenLeaveOperations ||
        canOpenReports ||
        canOpenOrganizationRules)
    ) {
      const orgChildren = [
        ...(canOpenOrganizations
          ? [{ type: "link", to: "/organizations", label: `Structure (${organizationsLevelLabel})`, icon: Network }]
          : []),
        ...(canOpenEmployeesPages
          ? [{ type: "link", to: "/employees", label: `Employees (${employeesLevelLabel})`, icon: Users }]
          : []),
        ...(canOpenDepartments
          ? [{ type: "link", to: "/departments", label: `Departments (${departmentsLevelLabel})`, icon: Briefcase }]
          : []),
      ];
      if (canOpenOrganizationRules) {
        orgChildren.push({
          type: "link",
          to: "/admin/organization-rules",
          label: "Organization Rules",
          icon: Settings,
        });
      }
      if (canOpenLeaveOperations) {
        orgChildren.push({
          type: "link",
          to: "/leave-operations",
          label: `Leave Ops (${leaveOpsLevelLabel})`,
          icon: CalendarOff,
        });
      }
      if (canOpenReports) {
        orgChildren.push({
          type: "link",
          to: "/reports",
          label: `Reports (${reportsLevelLabel})`,
          icon: BarChart3,
        });
      }
      structure.push({
        type: "group",
        label: "Organizations",
        icon: Network,
        children: orgChildren,
      });
    }

    if (isManagementMode && hasHrOpsAccess) {
      const hrOpsChildren = [
        {
          type: "link",
          to: "/attendance",
          label: `Attendance (${attendanceLevelLabel})`,
          icon: CalendarRange,
        },
      ];
      if (canOpenPayroll) {
        hrOpsChildren.push({
          type: "link",
          to: "/payroll",
          label: `Payroll (${payrollLevelLabel})`,
          icon: Wallet,
        });
      }
      if (canOpenAdvances) {
        hrOpsChildren.push({
          type: "link",
          to: "/advances",
          label: `Advances (${advancesLevelLabel})`,
          icon: CircleDollarSign,
        });
      }
      structure.push({
        type: "group",
        label: "HR Operations",
        icon: CalendarRange,
        children: hrOpsChildren,
      });
    }

    return structure;
  }, [
    currentRole,
    hasHrOpsAccess,
    isManagementMode,
    isHrBonusApprover,
    canOpenLeaveApprovals,
    canOpenOrganizations,
    canOpenEmployeesPages,
    canOpenDepartments,
    canOpenPayroll,
    canOpenAdvances,
    canOpenReports,
    canOpenLeaveOperations,
    canOpenOrganizationRules,
    canOpenDashboard,
    attendanceLevelLabel,
    advancesLevelLabel,
    departmentsLevelLabel,
    employeesLevelLabel,
    leaveOpsLevelLabel,
    organizationsLevelLabel,
    payrollLevelLabel,
    reportsLevelLabel,
  ]);

  const filteredNavStructure = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return navStructure;
    const hits = [];
    for (const item of navStructure) {
      if (item.type === "group") {
        const matchedChildren = (item.children || []).filter((c) =>
          c.label.toLowerCase().includes(q),
        );
        if (item.label.toLowerCase().includes(q) || matchedChildren.length > 0) {
          hits.push({
            ...item,
            children: matchedChildren.length > 0 ? matchedChildren : item.children,
          });
        }
      } else if (item.label.toLowerCase().includes(q)) {
        hits.push(item);
      }
    }
    return hits;
  }, [navStructure, searchQuery]);

  const roleLabel = (currentRole || "EMPLOYEE").replaceAll("_", " ");

  return (
    <div className="min-h-screen flex overflow-hidden bg-slate-50 text-slate-900 selection:bg-indigo-100 selection:text-indigo-900">
      {sidebarOpen && (
        <button
          type="button"
          aria-label="Close menu"
          className="fixed inset-0 z-[60] bg-zinc-900/10 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Enhanced Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-[70] border-r border-zinc-200/80 bg-zinc-50/95 backdrop-blur transition-[width] duration-200 ease-out md:translate-x-0 md:static md:inset-0
          ${
            isCollapsed
              ? "w-[4.5rem]"
              : "w-[85vw] max-w-72 md:w-64"
          }
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="relative flex h-full flex-col p-4">
          <button
            type="button"
            onClick={toggleSidebarSize}
            className="absolute -right-2.5 top-16 z-10 hidden h-5 w-5 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-400 hover:text-zinc-700 md:flex"
          >
            {isCollapsed ? (
              <ChevronRight size={12} />
            ) : (
              <ChevronLeft size={12} />
            )}
          </button>

          <div className="mb-5 flex h-9 items-center justify-between px-2">
            {!isCollapsed ? (
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-zinc-900 text-white shadow-sm">
                  <span className="text-white font-bold text-sm">H</span>
                </div>
                <span className="text-lg font-semibold text-zinc-900">
                  HRMS
                </span>
              </div>
            ) : (
              <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-xl bg-zinc-900 text-white shadow-sm">
                <span className="text-white font-bold text-sm">H</span>
              </div>
            )}
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              className="md:hidden text-zinc-400 hover:text-zinc-600"
            >
              <X size={18} />
            </button>
          </div>

          {!isCollapsed && (
            <div className="mb-4 space-y-3">
              <div className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white px-3 py-2">
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-600">
                  {isManagementMode ? <Shield className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}
                  {isManagementMode ? "Management mode" : "Personal mode"}
                </div>
                <span className="rounded-md bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium uppercase text-zinc-600">
                  {roleLabel}
                </span>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <input
                  type="text"
                  placeholder="Quick find pages..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-xl border border-zinc-200 bg-white py-2 pl-10 pr-4 text-sm text-zinc-800 placeholder:text-zinc-400 focus:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-200"
                />
              </div>
            </div>
          )}
          {!isCollapsed && hasManagementCapabilities && (
            <div className="mb-3 px-1">
              <button
                type="button"
                onClick={() =>
                  dispatch(
                    setViewMode(isManagementMode ? "personal" : "management"),
                  )
                }
                className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
                title={
                  isManagementMode
                    ? "Switch to Personal Mode"
                    : "Switch to Management Mode"
                }
              >
                {isManagementMode
                  ? "Switch to Personal Mode"
                  : "Switch to Management Mode"}
              </button>
            </div>
          )}

          <nav className="flex-1 space-y-1 overflow-y-auto pr-1">
            {filteredNavStructure.map((item) => (
              <div key={item.label}>
                {item.type === "group" ? (
                  <div className="mb-2">
                    {!isCollapsed ? (
                      <button
                        type="button"
                        onClick={() => toggleGroup(item.label)}
                        className="mt-3 flex w-full items-center justify-between px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-400 hover:text-zinc-600"
                      >
                        {item.label}
                        <ChevronRight
                          className={`transition-transform duration-200 ${expandedGroups[item.label] ? "rotate-90 text-zinc-600" : ""}`}
                          size={12}
                        />
                      </button>
                    ) : (
                      <div className="h-px bg-zinc-100 my-3 mx-2" />
                    )}
                    {(expandedGroups[item.label] || isCollapsed) && (
                      <div className="mt-1 space-y-1">
                        {item.children.map((child) => (
                          <SidebarLink
                            key={child.to}
                            to={child.to}
                            label={child.label}
                            icon={child.icon}
                            isCollapsed={isCollapsed}
                            closeMobile={() => setSidebarOpen(false)}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <SidebarLink
                    to={item.to}
                    label={item.label}
                    icon={item.icon}
                    isCollapsed={isCollapsed}
                    closeMobile={() => setSidebarOpen(false)}
                  />
                )}
              </div>
            ))}

            {filteredNavStructure.length === 0 && !isCollapsed && (
              <div className="rounded-xl border border-dashed border-zinc-200 bg-white/80 px-3 py-4 text-center text-xs text-zinc-500">
                No matching pages.
              </div>
            )}

            {isManagementMode &&
              canOpenPermissionsPage &&
              !isCollapsed && (
                <p className="px-3 pt-6 pb-2 text-xs font-medium uppercase tracking-wider text-zinc-400">
                  Administration
                </p>
              )}
            {isManagementMode && canOpenPermissionsPage && (
              <SidebarLink
                to="/admin/users"
                label={`Permissions (${permissionsLevelLabel})`}
                icon={UserCog}
                isCollapsed={isCollapsed}
                closeMobile={() => setSidebarOpen(false)}
              />
            )}
            {isManagementMode && canOpenPasswordRequests && (
              <SidebarLink
                to="/admin/password-requests"
                label="Password requests"
                icon={FileKey}
                isCollapsed={isCollapsed}
                closeMobile={() => setSidebarOpen(false)}
              />
            )}
          </nav>

          <div className={`mt-auto border-t border-zinc-200/80 pt-4 ${isCollapsed ? "items-center" : ""}`}>
            <div
              className={`mb-3 flex items-center gap-3 ${isCollapsed ? "justify-center" : "px-2"}`}
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-900 text-white font-medium shadow-sm">
                {currentUser?.email?.[0].toUpperCase()}
              </div>
              {!isCollapsed && (
                <div className="min-w-0">
                  <p className="text-sm font-medium text-zinc-900 truncate">
                    {currentUser?.email?.split("@")[0]}
                  </p>
                  <p className="text-xs text-zinc-500 font-normal capitalize">
                    {currentRole?.replace("_", " ")}
                  </p>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={async () => {
                await dispatch(logoutThunk());
                navigate("/login");
              }}
              className={`group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-500 transition-all duration-200 hover:bg-rose-50/70 hover:text-rose-600 ${
                isCollapsed ? "justify-center" : ""
              }`}
              title="Sign out"
            >
              <LogOut size={18} className="shrink-0 transition-transform group-hover:-translate-x-1" />
              {!isCollapsed && <span>Sign out</span>}
            </button>
          </div>
        </div>
      </aside>

      {/* Enhanced Main Content */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-zinc-50">
        {/* Enhanced Header */}
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-zinc-200 bg-white px-4 md:hidden">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="p-2 text-zinc-600 hover:bg-zinc-100 rounded-lg"
          >
            <Menu size={20} />
          </button>
          <span className="text-lg font-semibold text-zinc-900">HRMS</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative p-2 text-zinc-600 hover:bg-zinc-100 rounded-lg"
            >
              <Bell size={18} />
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
            </button>
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-medium text-sm">
              {currentUser?.email?.[0].toUpperCase()}
            </div>
          </div>
        </header>

        {/* Desktop Header with Breadcrumb */}
        <header className="hidden md:block shrink-0 bg-white border-b border-zinc-200">
          <div className="px-4 py-3 lg:px-8 lg:py-4">
            <Breadcrumb />
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-3 sm:p-4 md:p-6 lg:p-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

const SidebarLink = memo(function SidebarLink({ to, label, icon: Icon, isCollapsed, closeMobile }) {
  return (
    <NavLink
      to={to}
      end
      onClick={closeMobile}
      title={isCollapsed ? label : ""}
      className={({ isActive }) =>
        `group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all duration-200
        ${
          isActive
            ? "bg-zinc-900 text-white shadow-sm"
            : "text-slate-600 hover:bg-white hover:text-zinc-900"
        }`
      }
    >
      {({ isActive }) => (
        <>
          <Icon
            size={18}
            className={`shrink-0 transition-colors ${isCollapsed ? "mx-auto" : ""} ${
              isActive ? "text-white" : "text-slate-400 group-hover:text-zinc-700"
            }`}
          />
          {!isCollapsed && <span className="truncate">{label}</span>}
        </>
      )}
    </NavLink>
  );
});
