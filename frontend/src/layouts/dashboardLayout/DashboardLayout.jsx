/**
 * @file Authenticated shell: collapsible sidebar, role-based nav groups, logout.
 * Renders `<Outlet />` for child routes. Local state persists sidebar collapse in `localStorage`.
 */
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useState, useEffect, useMemo } from "react";
import { useAppDispatch, useAppSelector } from "@/shared/hooks/reduxHooks";
import { logoutThunk } from "@/modules/identity/store";
import { fetchDepartmentsThunk } from "@/modules/departments/store";
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
} from "lucide-react";

/** Minimal dashboard chrome: neutral sidebar, hairline borders, no heavy shadows. */
export function DashboardLayout() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState({
    Organizations: true,
  });

  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { currentUser } = useAppSelector((state) => state.identity);
  const departments = useAppSelector((state) => state.departments.items);
  const currentRole = currentUser?.role;

  const isAdmin = currentRole === "ADMIN" || currentRole === 3;
  const isHR = currentRole === "HR_STAFF" || isAdmin;
  const isManager = ["MANAGER", "TEAM_LEADER"].includes(currentRole) || isHR;

  const isHrDepartmentHead = useMemo(
    () =>
      departments.some(
        (d) => d.name === "HR" && d.head === currentUser?.email,
      ),
    [departments, currentUser?.email],
  );

  useEffect(() => {
    if (currentRole === "HR_STAFF" || isAdmin) {
      void dispatch(fetchDepartmentsThunk());
    }
  }, [dispatch, currentRole, isAdmin]);

  useEffect(() => {
    const saved = localStorage.getItem("sidebar-collapsed");
    if (saved !== null) setIsCollapsed(JSON.parse(saved));
  }, []);

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

  const navStructure = [{ type: "link", to: "/", label: "Home", icon: Home }];
  
  if (currentRole === "TEAM_LEADER") {
    navStructure.push({
      type: "link",
      to: "/dashboard",
      label: "My Team",
      icon: Users,
    });
  } else if (currentRole === "MANAGER") {
    navStructure.push({
      type: "link",
      to: "/dashboard",
      label: "My Department",
      icon: LayoutDashboard,
    });
  }

  // Organizations & Employees restricted to HR/Admin
  if (isHR) {
    navStructure.push({
      type: "group",
      label: "Organizations",
      icon: Network,
      children: [
        { type: "link", to: "/organizations", label: "Structure", icon: Network },
        { type: "link", to: "/employees", label: "Employees", icon: Users },
        { type: "link", to: "/departments", label: "Departments", icon: Briefcase },
        { type: "link", to: "/attendance", label: "Attendance", icon: CalendarRange },
      ],
    });
  } else if (currentRole === "MANAGER") {
    // Managers no longer have Employees/Departments links as requested
  }

  return (
    <div className="min-h-screen flex overflow-hidden bg-zinc-50 text-zinc-900">
      {sidebarOpen && (
        <button
          type="button"
          aria-label="Close menu"
          className="fixed inset-0 z-[60] bg-zinc-900/10 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-[70] bg-white border-r border-zinc-200 transition-[width] duration-200 ease-out md:translate-x-0 md:static md:inset-0
          ${isCollapsed ? "w-[4.5rem]" : "w-56"}
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="h-full flex flex-col p-3 relative">
          <button
            type="button"
            onClick={toggleSidebarSize}
            className="hidden md:flex absolute -right-2.5 top-16 w-5 h-5 bg-white border border-zinc-200 rounded-full items-center justify-center text-zinc-400 hover:text-zinc-700 z-10"
          >
            {isCollapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
          </button>

          <div className="flex items-center justify-between mb-8 h-9 px-1">
            {!isCollapsed ? (
              <span className="text-sm font-medium tracking-tight text-zinc-900">HRMS</span>
            ) : (
              <span className="text-xs font-medium text-zinc-500 mx-auto">H</span>
            )}
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              className="md:hidden text-zinc-400 hover:text-zinc-600"
            >
              <X size={18} />
            </button>
          </div>

          <nav className="flex-1 space-y-0.5 overflow-y-auto px-0.5">
            {navStructure.map((item) => (
              <div key={item.label}>
                {item.type === "group" ? (
                  <div className="mb-1">
                    {!isCollapsed ? (
                      <button
                        type="button"
                        onClick={() => toggleGroup(item.label)}
                        className="w-full flex items-center justify-between px-2 py-2 text-[10px] font-medium uppercase tracking-widest text-zinc-400 hover:text-zinc-600 mt-4"
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
                      <div className="space-y-0.5 mt-0.5">
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

            {(isAdmin || (currentRole === "HR_STAFF" && isHrDepartmentHead)) && !isCollapsed && (
              <p className="px-2 pt-6 pb-1 text-[10px] font-medium uppercase tracking-widest text-zinc-400">
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
            {(isAdmin || (currentRole === "HR_STAFF" && isHrDepartmentHead)) && (
              <SidebarLink
                to="/admin/password-requests"
                label="Password requests"
                icon={FileKey}
                isCollapsed={isCollapsed}
                closeMobile={() => setSidebarOpen(false)}
              />
            )}
          </nav>

          <div className={`mt-auto pt-4 border-t border-zinc-100 ${isCollapsed ? "items-center" : ""}`}>
            <div
              className={`mb-3 flex items-center gap-2.5 ${isCollapsed ? "justify-center" : "px-1"}`}
            >
              <div className="w-8 h-8 rounded-full border border-zinc-200 bg-zinc-50 flex items-center justify-center text-xs font-medium text-zinc-600 shrink-0">
                {currentUser?.email?.[0].toUpperCase()}
              </div>
              {!isCollapsed && (
                <div className="min-w-0">
                  <p className="text-xs font-medium text-zinc-900 truncate">
                    {currentUser?.email?.split("@")[0]}
                  </p>
                  <p className="text-[10px] text-zinc-500 font-normal">{currentRole}</p>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={async () => {
                await dispatch(logoutThunk());
                navigate("/login");
              }}
              className={`w-full flex items-center gap-2 px-2 py-2 rounded-md text-xs font-medium text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 transition-colors ${
                isCollapsed ? "justify-center" : ""
              }`}
              title="Sign out"
            >
              <LogOut size={16} className="shrink-0" />
              {!isCollapsed && <span>Sign out</span>}
            </button>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-h-0 bg-zinc-50">
        <header className="md:hidden shrink-0 h-14 bg-white border-b border-zinc-200 flex items-center px-4 justify-between">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="p-2 text-zinc-600 hover:bg-zinc-100 rounded-md"
          >
            <Menu size={20} />
          </button>
          <span className="text-sm font-medium text-zinc-900">HRMS</span>
          <div className="w-8 h-8 rounded-full border border-zinc-200 bg-zinc-50 flex items-center justify-center text-xs font-medium text-zinc-600">
            {currentUser?.email?.[0].toUpperCase()}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6 md:p-8 pt-6 md:pt-8 selection:bg-zinc-200 selection:text-zinc-900">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function SidebarLink({ to, label, icon: Icon, isCollapsed, closeMobile }) {
  return (
    <NavLink
      to={to}
      end
      onClick={closeMobile}
      title={isCollapsed ? label : ""}
      className={({ isActive }) =>
        `flex items-center gap-2.5 px-2 py-2 rounded-md text-xs font-medium transition-colors
        ${
          isActive
            ? "bg-indigo-50 text-indigo-700 shadow-sm border border-indigo-100"
            : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-800"
        }`
      }
    >
      <Icon size={16} className={`shrink-0 opacity-80 ${isCollapsed ? "mx-auto" : ""}`} />
      {!isCollapsed && <span className="truncate">{label}</span>}
    </NavLink>
  );
}
