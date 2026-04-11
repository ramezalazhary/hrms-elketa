import { useEffect } from "react";
import { Navigate } from "react-router-dom";
import { Layout } from "@/shared/components/Layout";
import { useAppDispatch, useAppSelector } from "@/shared/hooks/reduxHooks";
import { fetchEmployeesThunk } from "@/modules/employees/store";
import { fetchDepartmentsThunk } from "@/modules/departments/store";
import { fetchTeamsThunk } from "@/modules/teams/store";
import { LeadershipOrgOverview } from "./LeadershipOrgOverview";
import { Briefcase, LayoutDashboard, Zap } from "lucide-react";

function isPersonalHomeRole(role) {
  return ["EMPLOYEE", "TEAM_LEADER", "MANAGER"].includes(role);
}

/**
 * Home: full org analytics for leadership (Admin, HR, managers); simple welcome card for employees.
 */
export function HomePage() {
  const dispatch = useAppDispatch();
  const currentUser = useAppSelector((state) => state.identity.currentUser);
  const employees = useAppSelector((state) => state.employees.items);
  const departments = useAppSelector((state) => state.departments.items);
  const teams = useAppSelector((state) => state.teams.items);
  const employeesLoading = useAppSelector((state) => state.employees.isLoading);

  const role = currentUser?.role;
  const showAnalytics = !isPersonalHomeRole(role);

  useEffect(() => {
    if (!showAnalytics) return;
    void dispatch(fetchEmployeesThunk());
    void dispatch(fetchDepartmentsThunk());
    void dispatch(fetchTeamsThunk({}));
  }, [dispatch, showAnalytics]);

  if (showAnalytics) {
    return (
      <LeadershipOrgOverview
        currentUser={currentUser}
        employees={employees}
        departments={departments}
        teams={teams}
        isLoading={employeesLoading}
      />
    );
  }

  if (!showAnalytics && role === "EMPLOYEE") {
    return <Navigate to="/dashboard" replace />;
  }

  const roleDisplay = currentUser?.role?.replace("_", " ") || "Member";

  return (
    <Layout
      title={`Welcome Back`}
      description="Operational pulse and institutional context."
    >
      <div className="grid gap-4 sm:gap-6 grid-cols-1 lg:grid-cols-3">
        {/* Profile Card */}
        <article className="rounded-2xl sm:rounded-3xl border border-white/20 glass-premium p-5 sm:p-8 shadow-premium hover-lift relative overflow-hidden group">
          <div className="absolute top-0 right-0 -mr-8 -mt-8 h-32 w-32 rounded-full bg-indigo-500/5 blur-2xl group-hover:bg-indigo-500/10 transition-colors" />
          
          <div className="relative z-10">
            <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 p-0.5 shadow-xl shadow-indigo-100 mb-6 group-hover:scale-105 transition-transform">
              <div className="w-full h-full rounded-[14px] bg-white flex items-center justify-center text-indigo-600 text-2xl font-black">
                {currentUser?.email?.[0]?.toUpperCase() || "U"}
              </div>
            </div>
            
            <h2 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight truncate">{currentUser?.email?.split('@')[0]}</h2>
            <div className="mt-1 flex items-center gap-2">
               <span className="px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-600 text-[10px] font-black uppercase tracking-widest border border-indigo-100">
                 {roleDisplay}
               </span>
               <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" title="Active Duty" />
            </div>

            <div className="mt-6 sm:mt-10 space-y-3 sm:space-y-4">
              <div className="flex justify-between items-center pb-4 border-b border-slate-100">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Verification Status</span>
                <span className="text-xs font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">Validated</span>
              </div>
              <div className="flex justify-between items-center pb-4 border-b border-slate-100">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Commission Date</span>
                <span className="text-xs font-black text-slate-700">
                  {currentUser?.createdAt
                    ? new Date(currentUser.createdAt).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
                    : "—"}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Security Level</span>
                <span className="text-xs font-black text-indigo-700">Standard Access</span>
              </div>
            </div>
          </div>
        </article>

        {/* Workspace Pulse */}
        <article className="rounded-2xl sm:rounded-3xl border border-white/20 glass-premium p-5 sm:p-8 shadow-premium md:col-span-2 flex flex-col justify-between relative overflow-hidden group">
          <div className="absolute top-0 right-0 -mr-12 -mt-12 h-40 w-40 rounded-full bg-indigo-500/5 blur-3xl" />
          
          <div className="relative z-10">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
              <LayoutDashboard size={14} className="text-indigo-500" /> Organizational Workspace
            </h3>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight max-w-xl leading-tight">
              Manage your <span className="text-indigo-600">institutional footprint</span> from the command center.
            </h2>
            <p className="mt-4 text-sm text-slate-500 font-medium leading-relaxed max-w-lg">
              Authorized personnel can access deep organization analytics and workforce metrics via the sidebar. 
              Your personalized operational dashboard is available for real-time tracking.
            </p>
          </div>

          <div className="mt-6 sm:mt-10 grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 relative z-10">
            <div className="p-5 rounded-2xl bg-white/60 backdrop-blur-md border border-white/80 shadow-sm hover-lift group/item">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                <Briefcase size={12} className="text-indigo-400 group-hover/item:text-indigo-600 transition-colors" /> HR Core Modules
              </p>
              <p className="text-sm font-black text-slate-900">Synchronized</p>
            </div>
            <div className="p-5 rounded-2xl bg-indigo-600 shadow-lg shadow-indigo-100 hover-lift group/item">
              <p className="text-[10px] font-black text-white/50 uppercase tracking-widest mb-2 flex items-center gap-2">
                <Zap size={12} className="text-white group-hover/item:scale-125 transition-transform" /> Next Operational Cycle
              </p>
              <p className="text-sm font-black text-white">Active Management</p>
            </div>
          </div>
        </article>
      </div>
    </Layout>
  );
}
