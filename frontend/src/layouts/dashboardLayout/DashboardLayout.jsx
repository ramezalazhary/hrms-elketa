import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { useAppDispatch, useAppSelector } from "@/shared/hooks/reduxHooks";
import { logoutThunk } from "@/modules/identity/store";
import { 
  Home, 
  Users, 
  Network, 
  Briefcase, 
  CalendarCheck, 
  BarChart3, 
  ClipboardList, 
  LogOut, 
  ChevronLeft, 
  ChevronRight,
  LayoutDashboard,
  Database,
  TableProperties,
  UserCog,
  FileKey,
  Menu,
  X
} from "lucide-react";

/**
 * DashboardLayout - Light Premium Edition
 * Replaces the dark theme with a clean, high-contrast light theme.
 * Features a collapsible/mini-sidebar with visual persistence.
 */
export function DashboardLayout() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState({
    Organizations: true,
    Attendance: true,
  });

  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { currentUser } = useAppSelector((state) => state.identity);
  const currentRole = currentUser?.role;

  const isAdmin = currentRole === "ADMIN";
  const isHR = currentRole === "HR_STAFF" || isAdmin;
  const isManager = ["MANAGER", "TEAM_LEADER"].includes(currentRole) || isHR;

  // Persistence for collapsed state
  useEffect(() => {
    const saved = localStorage.getItem("sidebar-collapsed");
    if (saved !== null) setIsCollapsed(JSON.parse(saved));
  }, []);

  const toggleSidebarSize = () => {
    setIsCollapsed(prev => {
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

  const navStructure = [
    { type: "link", to: "/", label: "Home", icon: Home },
  ];

  if (currentRole === "TEAM_LEADER") {
    navStructure.push({ type: "link", to: "/dashboard", label: "Dashboard", icon: LayoutDashboard });
  }

  if (isManager) {
    navStructure.push({
      type: "group",
      label: "Organizations",
      icon: Network,
      children: [
        { type: "link", to: "/organizations", label: "Structure", icon: Network },
        { type: "link", to: "/employees", label: "Employees", icon: Users },
        { type: "link", to: "/departments", label: "Departments", icon: Briefcase },
      ],
    });
  }

  const attendanceChildren = [
    { type: "link", to: "/attendance/me", label: "My Attendance", icon: CalendarCheck },
  ];

  if (isManager) {
    attendanceChildren.push({ type: "link", to: "/attendance", label: "Live Dashboard", icon: LayoutDashboard });
  }

  if (isHR) {
    attendanceChildren.push({ type: "link", to: "/attendance/events", label: "Raw Events", icon: Database });
    attendanceChildren.push({ type: "link", to: "/attendance/import", label: "Sync Log", icon: TableProperties });
    attendanceChildren.push({ type: "link", to: "/attendance/policies", label: "Policies", icon: ClipboardList });
    attendanceChildren.push({ type: "link", to: "/attendance/reports", label: "Payroll Data", icon: BarChart3 });
  }

  navStructure.push({
    type: "group",
    label: "Attendance",
    icon: CalendarCheck,
    children: attendanceChildren
  });

  return (
    <div className="min-h-screen bg-slate-50 flex overflow-hidden">
      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-[60] bg-slate-900/20 backdrop-blur-sm md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed inset-y-0 left-0 z-[70] bg-white border-r border-slate-200 transition-all duration-300 ease-in-out transform md:translate-x-0 md:static md:inset-0
          ${isCollapsed ? "w-20" : "w-72"} 
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="h-full flex flex-col p-4 relative">
          
          {/* Collapse Toggle - Floating handle style */}
          <button 
            onClick={toggleSidebarSize} 
            className="hidden md:flex absolute -right-3 top-20 w-6 h-6 bg-white border border-slate-200 rounded-full items-center justify-center text-slate-400 hover:text-indigo-600 hover:border-indigo-200 shadow-sm transition-all z-10"
          >
             {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>

          {/* Logo Section */}
          <div className="flex items-center justify-between mb-10 h-10 px-2">
            <div className={`flex items-center gap-3 transition-opacity ${isCollapsed ? "opacity-0" : "opacity-100"}`}>
              <div className="w-9 h-9 rounded-2xl bg-indigo-600 flex items-center justify-center text-white font-black shadow-lg shadow-indigo-500/20">H</div>
              <span className="text-xl font-black tracking-tighter text-slate-900">HRMS <span className="text-indigo-600">PRO</span></span>
            </div>
            {isCollapsed && (
               <div className="w-10 h-10 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 font-black border border-indigo-100 mx-auto">H</div>
            )}
            <button onClick={() => setSidebarOpen(false)} className="md:hidden text-slate-400 hover:text-slate-600">
               <X size={20} />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-1 overflow-y-auto no-scrollbar px-1">
            {navStructure.map((item) => (
              <div key={item.label}>
                {item.type === "group" ? (
                  <div className="mb-2">
                    {!isCollapsed ? (
                      <button
                        onClick={() => toggleGroup(item.label)}
                        className="w-full flex items-center justify-between px-3 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 hover:text-slate-600 mt-6"
                      >
                        {item.label}
                        <ChevronRight className={`transition-transform duration-300 ${expandedGroups[item.label] ? "rotate-90 text-indigo-500" : ""}`} size={14} />
                      </button>
                    ) : (
                      <div className="h-px bg-slate-100 my-4 mx-2" />
                    )}
                    {(expandedGroups[item.label] || isCollapsed) && (
                      <div className="space-y-1 mt-1">
                        {item.children.map((child) => (
                           <SidebarLink key={child.to} to={child.to} label={child.label} icon={child.icon} isCollapsed={isCollapsed} closeMobile={() => setSidebarOpen(false)} />
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <SidebarLink to={item.to} label={item.label} icon={item.icon} isCollapsed={isCollapsed} closeMobile={() => setSidebarOpen(false)} />
                )}
              </div>
            ))}

            {/* Admin Section */}
            {(isAdmin || isHR) && !isCollapsed && (
               <p className="px-3 pt-6 pb-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Administration</p>
            )}
            {isAdmin && (
               <>
                 <SidebarLink to="/admin/users" label="Permissions" icon={UserCog} isCollapsed={isCollapsed} closeMobile={() => setSidebarOpen(false)} />
                 <SidebarLink to="/admin/password-requests" label="Requests" icon={FileKey} isCollapsed={isCollapsed} closeMobile={() => setSidebarOpen(false)} />
               </>
            )}
          </nav>

          {/* User Block */}
          <div className={`mt-auto pt-6 border-t border-slate-100 transition-all ${isCollapsed ? "items-center" : ""}`}>
             <div className={`mb-4 flex items-center gap-3 transition-all ${isCollapsed ? "justify-center" : "px-2"}`}>
                <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-indigo-600 shrink-0 shadow-sm">
                  {currentUser?.email?.[0].toUpperCase()}
                </div>
                {!isCollapsed && (
                  <div className="min-w-0">
                    <p className="text-sm font-black text-slate-900 truncate">{currentUser?.email?.split('@')[0]}</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mt-1">{currentRole}</p>
                  </div>
                )}
             </div>
             
             <button 
               onClick={async () => { await dispatch(logoutThunk()); navigate("/login"); }}
               className={`w-full flex items-center gap-4 px-3 py-3 rounded-xl transition-all group
                 ${isCollapsed ? "justify-center text-slate-400 hover:text-rose-500" : "bg-slate-50 text-slate-500 hover:bg-rose-50 hover:text-rose-600"}`}
               title="Sign Out"
             >
                <LogOut size={20} className="shrink-0 group-hover:translate-x-1 transition-transform" />
                {!isCollapsed && <span className="text-xs font-black uppercase tracking-wider">Log Out</span>}
             </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden bg-white">
        {/* Mobile Header */}
        <header className="md:hidden fixed top-0 inset-x-0 h-16 bg-white border-b border-slate-100 z-[50] flex items-center px-4 justify-between">
            <button onClick={() => setSidebarOpen(true)} className="p-2 text-slate-600 hover:bg-slate-50 rounded-lg"><Menu size={24} /></button>
            <span className="font-black text-slate-900 tracking-tighter text-lg">HRMS <span className="text-indigo-600">PRO</span></span>
            <div className="w-9 h-9 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 font-bold shadow-sm">
              {currentUser?.email?.[0].toUpperCase()}
            </div>
        </header>

        {/* Scrollable Content */}
        <main className="flex-1 overflow-y-auto bg-slate-50/20 p-8 pt-24 md:pt-10 custom-scrollbar relative selection:bg-indigo-100 selection:text-indigo-900">
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
        `flex items-center gap-4 px-3 py-3 rounded-xl transition-all duration-200 group
        ${isActive 
          ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/20" 
          : "text-slate-500 hover:bg-indigo-50 hover:text-indigo-600"}`
      }
    >
      <Icon size={20} className={`shrink-0 transition-transform ${isCollapsed ? "mx-auto" : "group-hover:scale-110"}`} />
      {!isCollapsed && <span className="text-[13px] font-extrabold tracking-tight truncate">{label}</span>}
    </NavLink>
  );
}
