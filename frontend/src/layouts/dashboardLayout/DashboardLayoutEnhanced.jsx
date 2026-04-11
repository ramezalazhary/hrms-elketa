import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useState, useEffect, useMemo, memo } from "react";
import { useAppDispatch, useAppSelector } from "@/shared/hooks/reduxHooks";
import { logoutThunk } from "@/modules/identity/store";
import { fetchDepartmentsThunk } from "@/modules/departments/store";
import { normaliseRoleKey } from "@/shared/components/EntityBadges";
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
  const { currentUser } = useAppSelector((state) => state.identity);
  const departments = useAppSelector((state) => state.departments.items);
  const currentRole = normaliseRoleKey(currentUser?.role);

  const isAdmin = currentRole === "ADMIN";
  const isHrManager = currentRole === "HR_MANAGER";
  const isHR = currentRole === "HR_STAFF" || isHrManager || isAdmin;
  const isHrBonusApprover =
    currentRole === "HR_STAFF" ||
    currentRole === "HR_MANAGER" ||
    currentRole === "ADMIN";

  const hasHrOpsAccess =
    isAdmin ||
    isHrManager ||
    currentUser?.permissions?.some(
      (p) => p.module === "attendance" && p.actions.includes("view"),
    );

  const isHrDepartmentHead = useMemo(
    () =>
      departments.some((d) => d.name === "HR" && d.head === currentUser?.email),
    [departments, currentUser?.email],
  );

  useEffect(() => {
    if (currentRole === "HR_STAFF" || isAdmin) {
      void dispatch(fetchDepartmentsThunk());
    }
  }, [dispatch, currentRole, isAdmin]);

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
    const structure = [{ type: "link", to: "/", label: "Home", icon: Home }];

    structure.push({
      type: "link",
      to: "/employees/time-off",
      label: "Time off",
      icon: CalendarCheck,
    });

    const canApproveLeave =
      currentRole === "TEAM_LEADER" ||
      currentRole === "MANAGER" ||
      currentRole === "HR_STAFF" ||
      currentRole === "HR_MANAGER" ||
      currentRole === "ADMIN";

    if (canApproveLeave) {
      structure.push({
        type: "link",
        to: "/employees/time-off/approvals",
        label: "Leave approvals",
        icon: CalendarRange,
      });
    }

    if (isHrBonusApprover) {
      structure.push({
        type: "link",
        to: "/employees/bonus-approvals",
        label: "Bonus approvals",
        icon: CalendarCheck,
      });
    }

    if (currentRole === "TEAM_LEADER") {
      structure.push({
        type: "link",
        to: "/dashboard",
        label: "My Team",
        icon: Users,
      });
    } else if (currentRole === "MANAGER") {
      structure.push({
        type: "link",
        to: "/dashboard",
        label: "My Department",
        icon: LayoutDashboard,
      });
    }

    // Organizations & Employees restricted to HR/Admin
    if (isHR) {
      const orgChildren = [
        {
          type: "link",
          to: "/organizations",
          label: "Structure",
          icon: Network,
        },
        { type: "link", to: "/employees", label: "Employees", icon: Users },
        {
          type: "link",
          to: "/departments",
          label: "Departments",
          icon: Briefcase,
        },
      ];
      if (isAdmin) {
        orgChildren.push({
          type: "link",
          to: "/admin/organization-rules",
          label: "Organization Rules",
          icon: Settings,
        });
      }
      orgChildren.push({
        type: "link",
        to: "/admin/holidays",
        label: "Holidays",
        icon: CalendarOff,
      });
      orgChildren.push({
        type: "link",
        to: "/reports",
        label: "Reports",
        icon: BarChart3,
      });
      structure.push({
        type: "group",
        label: "Organizations",
        icon: Network,
        children: orgChildren,
      });
    }

    if (hasHrOpsAccess) {
      const hrOpsChildren = [
        {
          type: "link",
          to: "/attendance",
          label: "Attendance",
          icon: CalendarRange,
        },
      ];
      if (isHR) {
        hrOpsChildren.push({
          type: "link",
          to: "/payroll",
          label: "Payroll",
          icon: Wallet,
        });
        hrOpsChildren.push({
          type: "link",
          to: "/advances",
          label: "Advances",
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
  }, [currentRole, isHR, hasHrOpsAccess]);

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
        className={`fixed inset-y-0 left-0 z-[70] bg-white border-r border-zinc-200 transition-[width] duration-200 ease-out md:translate-x-0 md:static md:inset-0
          ${
            isCollapsed
              ? "w-[4.5rem]"
              : "w-[85vw] max-w-72 md:w-64"
          }
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="h-full flex flex-col p-4 relative">
          <button
            type="button"
            onClick={toggleSidebarSize}
            className="hidden md:flex absolute -right-2.5 top-16 w-5 h-5 bg-white border border-zinc-200 rounded-full items-center justify-center text-zinc-400 hover:text-zinc-700 z-10"
          >
            {isCollapsed ? (
              <ChevronRight size={12} />
            ) : (
              <ChevronLeft size={12} />
            )}
          </button>

          <div className="flex items-center justify-between mb-8 h-9 px-2">
            {!isCollapsed ? (
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">H</span>
                </div>
                <span className="text-lg font-semibold text-zinc-900">
                  HRMS
                </span>
              </div>
            ) : (
              <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center mx-auto">
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

          {/* Search in sidebar */}
          {!isCollapsed && (
            <div className="mb-6">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <input
                  type="text"
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
            </div>
          )}

          <nav className="flex-1 space-y-1 overflow-y-auto">
            {navStructure.map((item) => (
              <div key={item.label}>
                {item.type === "group" ? (
                  <div className="mb-2">
                    {!isCollapsed ? (
                      <button
                        type="button"
                        onClick={() => toggleGroup(item.label)}
                        className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium uppercase tracking-wider text-zinc-400 hover:text-zinc-600 mt-4"
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
                      <div className="space-y-1 mt-1">
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

            {(isAdmin || isHrManager || (currentRole === "HR_STAFF" && isHrDepartmentHead)) &&
              !isCollapsed && (
                <p className="px-3 pt-6 pb-2 text-xs font-medium uppercase tracking-wider text-zinc-400">
                  Administration
                </p>
              )}
            {isAdmin && (
              <SidebarLink
                to="/admin/users"
                label="Permissions"
                icon={UserCog}
                isCollapsed={isCollapsed}
                closeMobile={() => setSidebarOpen(false)}
              />
            )}
            {(isAdmin || isHrManager ||
              (currentRole === "HR_STAFF" && isHrDepartmentHead)) && (
              <SidebarLink
                to="/admin/password-requests"
                label="Password requests"
                icon={FileKey}
                isCollapsed={isCollapsed}
                closeMobile={() => setSidebarOpen(false)}
              />
            )}
          </nav>

          <div
            className={`mt-auto pt-4 border-t border-zinc-100 ${isCollapsed ? "items-center" : ""}`}
          >
            <div
              className={`mb-3 flex items-center gap-3 ${isCollapsed ? "justify-center" : "px-2"}`}
            >
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-medium shadow-sm">
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
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-slate-500 hover:text-rose-600 hover:bg-rose-50/50 transition-all duration-200 group ${
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
      <div className="flex-1 flex flex-col min-h-0 bg-zinc-50 min-w-0">
        {/* Enhanced Header */}
        <header className="md:hidden shrink-0 h-16 bg-white border-b border-zinc-200 flex items-center px-4 justify-between">
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
        `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 group
        ${
          isActive
            ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200/50"
            : "text-slate-500 hover:bg-white hover:text-indigo-600 hover:shadow-sm"
        }`
      }
    >
      {({ isActive }) => (
        <>
          <Icon
            size={18}
            className={`shrink-0 transition-colors ${isCollapsed ? "mx-auto" : ""} ${
              isActive ? "text-white" : "text-slate-400 group-hover:text-indigo-600"
            }`}
          />
          {!isCollapsed && <span className="truncate">{label}</span>}
        </>
      )}
    </NavLink>
  );
});
