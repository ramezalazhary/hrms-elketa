import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useState, useMemo, memo, useEffect, useRef } from "react";
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
import { hasManagementCapabilities } from "@/shared/utils/accessControl";
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
  ArrowRightLeft,
} from "lucide-react";
import { ThemeToggle } from "@/shared/components/ThemeToggle";

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
  const userHasManagementCapabilities = hasManagementCapabilities(currentUser);
  const isManagementMode = userHasManagementCapabilities && viewMode === "management";
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

  const employees = useAppSelector((state) => state.employees.items);
  const roleLabel = (currentRole || "EMPLOYEE").replaceAll("_", " ");
  const displayName = useMemo(() => {
    const matched = employees.find(
      (emp) =>
        (currentUser?.id != null &&
          String(emp.id ?? emp._id ?? "") === String(currentUser.id)) ||
        (!!currentUser?.email &&
          !!emp.email &&
          String(emp.email).trim().toLowerCase() ===
            String(currentUser.email).trim().toLowerCase()),
    );
    return (
      matched?.fullName ||
      currentUser?.fullName ||
      currentUser?.email?.split("@")[0] ||
      "User"
    );
  }, [employees, currentUser?.id, currentUser?.email, currentUser?.fullName]);

  const pageTitle = usePageTitle();

  const handleLogout = async () => {
    await dispatch(logoutThunk());
    navigate("/login");
  };

  const handleModeSwitch = (mode) => {
    dispatch(setViewMode(mode));
    if (mode === "personal") {
      navigate("/");
    } else {
      navigate("/dashboard");
    }
  };

  return (
    <div
      className="flex h-screen overflow-hidden bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50 transition-colors duration-300 selection:bg-indigo-100 selection:text-indigo-900"
      style={{ "--sidebar-width": isCollapsed ? "4.5rem" : "16rem" }}
    >
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
        className={`fixed inset-y-0 left-0 z-[70] flex h-screen shrink-0 flex-col border-r border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/80 backdrop-blur-xl transition-[width] duration-200 ease-out md:sticky md:top-0 md:translate-x-0
          ${
            isCollapsed
              ? "w-[4.5rem]"
              : "w-[85vw] max-w-72 md:w-64"
          }
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="relative flex h-full min-h-0 flex-col p-4">
          <button
            type="button"
            onClick={toggleSidebarSize}
            className="absolute -right-2.5 top-16 z-10 hidden h-6 w-6 items-center justify-center rounded-full border border-zinc-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/95 text-zinc-400 shadow-sm hover:text-zinc-700 dark:hover:text-zinc-300 md:flex"
          >
            {isCollapsed ? (
              <ChevronRight size={12} />
            ) : (
              <ChevronLeft size={12} />
            )}
          </button>

          <div className="mb-5 rounded-[24px] border border-zinc-200/70 dark:border-zinc-800 bg-white dark:bg-zinc-900/90 dark:bg-zinc-900/90 px-3 py-3 shadow-[0_10px_30px_rgba(15,23,42,0.04)] dark:shadow-none">
            <div className="flex h-9 items-center justify-between">
              {!isCollapsed ? (
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-zinc-950 dark:bg-indigo-600 text-white shadow-sm">
                    <span className="text-white font-bold text-sm">H</span>
                  </div>
                  <div>
                    <span className="block text-[15px] font-semibold tracking-tight text-zinc-950 dark:text-white">
                      HRMS
                    </span>
                    <span className="block text-[11px] text-zinc-400 dark:text-zinc-500 dark:text-zinc-400">Focused workspace</span>
                  </div>
                </div>
              ) : (
                <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-2xl bg-zinc-950 dark:bg-indigo-600 text-white shadow-sm">
                  <span className="text-white font-bold text-sm">H</span>
                </div>
              )}
              <button
                type="button"
                onClick={() => setSidebarOpen(false)}
                className="md:hidden text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-400 dark:hover:text-zinc-300"
              >
                <X size={18} />
              </button>
            </div>
          </div>
          {/* Workspace mode الآن مدمج في الكارت العلوي */}

          <nav className="flex-1 space-y-1 overflow-y-auto pr-1">
            {filteredNavStructure.map((item) => (
              <div key={item.label}>
                {item.type === "group" ? (
                  <div className="mb-2">
                    {!isCollapsed ? (
                      <button
                        type="button"
                        onClick={() => toggleGroup(item.label)}
                        className="mt-3 flex w-full items-center justify-between px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-400"
                      >
                        {item.label}
                        <ChevronRight
                          className={`transition-transform duration-200 ${expandedGroups[item.label] ? "rotate-90 text-zinc-600 dark:text-zinc-400" : ""}`}
                          size={12}
                        />
                      </button>
                    ) : (
                      <div className="h-px bg-zinc-100 dark:bg-zinc-800 my-3 mx-2" />
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
              <div className="rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/80 px-3 py-4 text-center text-xs text-zinc-500 dark:text-zinc-400">
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
        </div>
      </aside>

      {/* Enhanced Main Content */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-zinc-50 dark:bg-zinc-950 transition-colors duration-300">
        <DashboardHeader
          pageTitle={pageTitle}
          displayName={displayName}
          roleLabel={roleLabel}
          emailInitial={currentUser?.email?.[0]?.toUpperCase() || "?"}
          hasManagementCapabilities={userHasManagementCapabilities}
          isManagementMode={isManagementMode}
          onOpenSidebar={() => setSidebarOpen(true)}
          onModeSwitch={handleModeSwitch}
          onLogout={handleLogout}
          onToggleNotifications={() => setShowNotifications((v) => !v)}
        />

        {/* Main Content Area */}
        <main className="min-h-0 flex-1 overflow-y-auto">
          <div className="p-3 sm:p-4 md:p-6 lg:p-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

function usePageTitle() {
  const { pathname } = useLocation();
  return useMemo(() => {
    const segments = pathname.split("/").filter(Boolean);
    const last = segments[segments.length - 1] || "home";
    return last
      .split("-")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  }, [pathname]);
}

const WorkspaceModeSwitch = memo(function WorkspaceModeSwitch({
  isManagementMode,
  onModeSwitch,
  showLabel = true,
  fullWidth = false,
}) {
  return (
    <div
      className={`flex items-center gap-2 rounded-2xl border border-zinc-200/70 bg-zinc-50/90 px-2 py-1.5 dark:border-zinc-800 dark:bg-zinc-800/50 ${
        fullWidth ? "w-full justify-between" : ""
      }`}
    >
      {showLabel && (
        <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400 sm:text-[11px]">
          Workspace
        </span>
      )}
      <div
        className={`flex items-center gap-0.5 rounded-2xl bg-zinc-100/80 p-0.5 dark:bg-zinc-900/50 ${
          fullWidth ? "ml-auto flex-1 justify-end sm:flex-none" : ""
        }`}
      >
        <button
          type="button"
          onClick={() => onModeSwitch("personal")}
          className={`rounded-xl px-2.5 py-1.5 text-[11px] font-semibold transition-all sm:px-3 sm:py-1 sm:text-xs ${
            !isManagementMode
              ? "bg-white text-zinc-950 shadow-sm dark:bg-zinc-800 dark:text-white"
              : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300"
          }`}
        >
          Personal
        </button>
        <button
          type="button"
          onClick={() => onModeSwitch("management")}
          className={`rounded-xl px-2.5 py-1.5 text-[11px] font-semibold transition-all sm:px-3 sm:py-1 sm:text-xs ${
            isManagementMode
              ? "bg-white text-zinc-950 shadow-sm dark:bg-zinc-800 dark:text-white"
              : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300"
          }`}
        >
          Management
        </button>
      </div>
    </div>
  );
});

const DashboardHeader = memo(function DashboardHeader({
  pageTitle,
  displayName,
  roleLabel,
  emailInitial,
  hasManagementCapabilities,
  isManagementMode,
  onOpenSidebar,
  onModeSwitch,
  onLogout,
  onToggleNotifications,
}) {
  return (
    <header className="shrink-0 border-b border-zinc-200 bg-white/95 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-900/95">
      <div className="flex items-center gap-2 px-3 py-2.5 sm:gap-2.5 sm:px-4 sm:py-3 lg:px-5 min-[1395px]:gap-3 min-[1395px]:px-8 min-[1395px]:py-3.5">
        <button
          type="button"
          onClick={onOpenSidebar}
          aria-label="Open menu"
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-zinc-600 transition hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800 md:hidden"
        >
          <Menu size={20} />
        </button>

        <div className="min-w-0 flex-1 overflow-hidden">
          <p className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100 md:hidden">
            {pageTitle}
          </p>
          <div className="hidden min-w-0 md:block">
            <Breadcrumb className="max-w-full overflow-x-auto text-xs lg:text-sm [&_ol]:flex-nowrap [&_ol]:overflow-x-auto [&_ol]:pb-0.5 [&_ol]:scrollbar-none" />
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1 sm:gap-1.5 min-[1395px]:gap-3">
          <div className="hidden sm:block [&_button]:h-9 [&_button]:w-9">
            <ThemeToggle />
          </div>

          {hasManagementCapabilities && (
            <div className="hidden min-[1395px]:block">
              <WorkspaceModeSwitch
                isManagementMode={isManagementMode}
                onModeSwitch={onModeSwitch}
                showLabel={false}
              />
            </div>
          )}

          <button
            type="button"
            onClick={onToggleNotifications}
            aria-label="Notifications"
            className="relative hidden h-10 w-10 items-center justify-center rounded-xl text-zinc-600 transition hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800 lg:inline-flex"
          >
            <Bell size={18} />
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500" />
          </button>

          <div className="min-[1395px]:hidden">
            <HeaderUserMenu
              displayName={displayName}
              roleLabel={roleLabel}
              emailInitial={emailInitial}
              onLogout={onLogout}
              variant="dropdown"
            />
          </div>
          <div className="hidden min-[1395px]:block">
            <HeaderUserMenu
              displayName={displayName}
              roleLabel={roleLabel}
              emailInitial={emailInitial}
              onLogout={onLogout}
              variant="inline"
            />
          </div>
        </div>
      </div>

      {hasManagementCapabilities && (
        <div className="border-t border-zinc-100 px-3 py-2 dark:border-zinc-800/80 sm:px-4 lg:px-5 min-[1395px]:hidden">
          <WorkspaceModeSwitch
            isManagementMode={isManagementMode}
            onModeSwitch={onModeSwitch}
            showLabel={false}
            fullWidth
          />
        </div>
      )}
    </header>
  );
});

const HeaderUserMenu = memo(function HeaderUserMenu({
  displayName,
  roleLabel,
  emailInitial,
  onLogout,
  variant = "inline",
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  if (variant === "dropdown") {
    return (
      <div ref={rootRef} className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-haspopup="menu"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-900 text-sm font-medium text-white shadow-sm transition hover:ring-2 hover:ring-zinc-300 dark:bg-indigo-600 dark:hover:ring-indigo-500/40"
        >
          {emailInitial}
        </button>
        {open && (
          <div
            role="menu"
            className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-56 animate-in fade-in zoom-in-95 rounded-2xl border border-zinc-200/90 bg-white p-2 shadow-xl ring-1 ring-zinc-950/[0.06] duration-150 dark:border-zinc-800 dark:bg-zinc-900 dark:ring-zinc-800"
          >
            <div className="border-b border-zinc-100 px-3 py-2.5 dark:border-zinc-800">
              <p className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">{displayName}</p>
              <p className="truncate text-xs capitalize text-zinc-500 dark:text-zinc-400">{roleLabel}</p>
            </div>
            <div className="mt-1 flex items-center justify-between gap-3 rounded-xl px-3 py-2 sm:hidden">
              <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Theme</span>
              <ThemeToggle />
            </div>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onLogout();
              }}
              className="mt-1 flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold text-rose-600 transition hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-500/10"
            >
              <LogOut size={16} />
              Sign out
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex min-w-0 items-center gap-2 min-[1536px]:gap-3">
      <div className="flex min-w-0 items-center gap-2 min-[1536px]:gap-2.5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-sm font-medium text-white shadow-sm dark:bg-indigo-600">
          {emailInitial}
        </div>
        <div className="hidden min-w-0 min-[1536px]:block">
          <p className="max-w-[9rem] truncate text-sm font-medium text-zinc-900 dark:text-zinc-100 2xl:max-w-[12rem]">
            {displayName}
          </p>
          <p className="truncate text-xs capitalize text-zinc-500 dark:text-zinc-400">{roleLabel}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={onLogout}
        className="group inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-zinc-200/90 text-zinc-600 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-rose-500/30 dark:hover:bg-rose-500/10 dark:hover:text-rose-400 min-[1536px]:h-auto min-[1536px]:w-auto min-[1536px]:gap-1.5 min-[1536px]:px-3 min-[1536px]:py-2 min-[1536px]:text-sm min-[1536px]:font-semibold"
        title="Sign out"
      >
        <LogOut size={16} className="shrink-0 transition-transform group-hover:-translate-x-0.5" />
        <span className="hidden min-[1536px]:inline">Sign out</span>
      </button>
    </div>
  );
});

const SidebarLink = memo(function SidebarLink({ to, label, icon: Icon, isCollapsed, closeMobile }) {
  return (
    <NavLink
      to={to}
      end
      onClick={closeMobile}
      title={isCollapsed ? label : ""}
      className={({ isActive }) =>
        `group flex ${
          isCollapsed ? "justify-center" : "items-center gap-3"
        } rounded-2xl border border-transparent px-3 py-2.5 text-sm font-semibold transition-all duration-200
        ${
          isActive
            ? "border-zinc-900/90 dark:border-indigo-500/50 bg-zinc-900 dark:bg-indigo-500/10 text-white dark:text-indigo-400 shadow-[0_10px_24px_rgba(15,23,42,0.16)] dark:shadow-none"
            : "text-slate-600 dark:text-slate-400 hover:border-zinc-200/80 dark:hover:border-zinc-800/80 dark:hover:border-zinc-700/80 hover:bg-white dark:hover:bg-zinc-900/95 dark:hover:bg-zinc-800/50 hover:text-zinc-900 dark:hover:text-zinc-100 dark:hover:text-zinc-200 hover:shadow-sm dark:hover:shadow-none"
        }`
      }
    >
      {({ isActive }) => (
        <>
          <Icon
            size={18}
            className={`shrink-0 transition-colors ${isCollapsed ? "mx-auto" : ""} ${
              isActive ? "text-white" : "text-slate-400 group-hover:text-zinc-700 dark:hover:text-zinc-300"
            }`}
          />
          {!isCollapsed && <span className="truncate">{label}</span>}
        </>
      )}
    </NavLink>
  );
});
