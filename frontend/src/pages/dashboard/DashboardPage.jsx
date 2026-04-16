import { useEffect, useMemo, useState, memo } from "react";
import { Link } from "react-router-dom";
import { getTeamsApi } from "@/modules/teams/api";
import { SubmitAssessmentModal } from "@/modules/employees/components/SubmitAssessmentModal";
import {
  canManagerOrTeamLeaderEvaluateEmployee,
  canTeamLeaderEvaluateRosterMember,
  departmentHeadedByUser,
} from "@/modules/employees/utils/evaluationAccess";
import { normaliseRoleKey } from "@/shared/components/EntityBadges";
import { Layout } from "@/shared/components/Layout";
import { useToast } from "@/shared/components/ToastProvider";
import { useAppDispatch, useAppSelector } from "@/shared/hooks/reduxHooks";
import { fetchDepartmentsThunk } from "@/modules/departments/store";
import { fetchEmployeesThunk } from "@/modules/employees/store";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { 
  Calendar, 
  Clock, 
  AlertTriangle, 
  TrendingUp, 
  FileWarning, 
  ShieldCheck, 
  Star, 
  ShieldAlert, 
  PieChart as PieChartIcon, 
  BarChart3, 
  ArrowUpRight, 
  RefreshCw, 
  CheckCircle2, 
  Zap,
  LayoutDashboard,
  Briefcase,
  Building2,
  Users as UsersIcon
} from "lucide-react";
import { StatusBadge } from "@/shared/components/EntityBadges";
import {
  createManagementRequestApi,
  getDashboardAlertsApi,
  getDashboardMetricsApi,
} from "@/modules/dashboard/api";
import { getEmployeeAttendanceApi, getTodayAttendanceApi } from "@/modules/attendance/api";
import { getAssessmentRemindersApi, listLeaveRequestsApi } from "@/modules/employees/api";
import { formatTotalHours } from "@/modules/attendance/utils";
import { DashboardAlerts } from "./DashboardAlerts";
import { employeeBelongsToDepartment } from "@/shared/utils/departmentMembership";
import { mergeTeamsForDepartment, mergedTeamNamesForDepartment } from "@/shared/utils/mergeDepartmentTeams";

function AssessmentReminderWidget() {
  const [data, setData] = useState(null);
  useEffect(() => {
    getAssessmentRemindersApi()
      .then(setData)
      .catch(() => {});
  }, []);
  if (!data || data.totalAssessable === 0) return null;
  const pct = data.totalAssessable
    ? Math.round((data.completedCount / data.totalAssessable) * 100)
    : 0;
  return (
    <Link
      to="/employees"
      className="block rounded-2xl border border-amber-200/50 bg-gradient-to-br from-amber-50/50 to-white p-5 shadow-sm hover:shadow-md transition-all group"
    >
      <div className="flex items-center gap-3 mb-3">
        <div className="h-9 w-9 rounded-lg bg-amber-100 flex items-center justify-center">
          <Star className="h-4 w-4 text-amber-600" />
        </div>
        <div>
          <p className="text-xs font-bold text-amber-900">Monthly Assessments</p>
          <p className="text-[10px] text-amber-600 font-medium">{data.monthName} {data.year}</p>
        </div>
      </div>
      <div className="flex items-end justify-between">
        <div>
          <p className="text-2xl font-black text-amber-900 tabular-nums">{data.pendingCount}</p>
          <p className="text-[10px] text-amber-600 font-bold">Pending</p>
        </div>
        <div className="text-right">
          <p className="text-sm font-bold text-amber-700">{pct}%</p>
          <p className="text-[10px] text-amber-500">Completed</p>
        </div>
      </div>
      <div className="mt-2 h-1.5 rounded-full bg-amber-100 overflow-hidden">
        <div
          className="h-full rounded-full bg-amber-500 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </Link>
  );
}

const STATUS_PIE_COLORS = {
  Active: "#10b981",
  "On Leave": "#f59e0b",
  Resigned: "#64748b",
  Terminated: "#ef4444",
};

function WelcomeBanner({ employee, attendanceHistory }) {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const hour = currentTime.getHours();
  const greeting = hour < 12 ? "Good Morning" : hour < 17 ? "Good Afternoon" : "Good Evening";
  
  const todayRecord = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return attendanceHistory.find(h => h.date?.startsWith(today));
  }, [attendanceHistory]);

  return (
    <div className="relative overflow-hidden rounded-3xl bg-slate-950 p-8 shadow-2xl mb-8 group border border-white/10">
      {/* Dynamic Mesh Gradient Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-600/40 via-teal-900/40 to-slate-950 opacity-100 transition-all duration-500 group-hover:scale-110" />
      <div className="absolute top-0 right-0 -mr-16 -mt-16 h-64 w-64 rounded-full bg-indigo-500/10 blur-3xl" />
      <div className="absolute bottom-0 left-0 -ml-16 -mb-16 h-64 w-64 rounded-full bg-teal-500/10 blur-3xl" />

      <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
             <span className="px-3 py-1 bg-white/10 backdrop-blur-md rounded-full text-[10px] font-black uppercase tracking-widest text-indigo-200 border border-white/5">
               {greeting}
             </span>
             {todayRecord && (
               <span className="flex items-center gap-1.5 px-3 py-1 bg-emerald-500/20 backdrop-blur-md rounded-full text-[10px] font-black uppercase tracking-widest text-emerald-400 border border-emerald-500/20 animate-pulse">
                 <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,1)]" />
                 Active Duty
               </span>
             )}
          </div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white">
            {employee.fullName.split(' ')[0]} <span className="text-white/40">[{employee.employeeCode}]</span>
          </h1>
          <p className="text-indigo-100/60 text-sm font-medium">
            Strategic operations at <span className="text-white font-bold">{employee.department}</span> unit
          </p>
        </div>

        <div className="flex items-center gap-6 md:border-l md:border-white/10 md:pl-8">
           <div className="text-right">
             <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-1">Current Sync</p>
             <p className="text-2xl font-black text-white tabular-nums">
               {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
             </p>
             <p className="text-[10px] font-bold text-indigo-300">
               {currentTime.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })}
             </p>
           </div>
           
           {todayRecord && (
             <div className="hidden sm:block px-4 py-3 bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10">
               <p className="text-[9px] font-bold text-white/40 uppercase mb-1">Today's Check-in</p>
               <p className="text-lg font-black text-white">{todayRecord.checkIn}</p>
             </div>
           )}
        </div>
      </div>
    </div>
  );
}

const EmployeeDashboard = memo(function EmployeeDashboard({ currentUser, employees, onSendRequest }) {
  const [attendanceHistory, setAttendanceHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [requestData, setRequestData] = useState({ type: 'ANALYTICS', message: '' });
  const [submitting, setSubmitting] = useState(false);

  const employee = useMemo(() => 
    employees.find(e => e.email === currentUser?.email),
    [employees, currentUser]
  );

  const handleSubmitRequest = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    await onSendRequest(requestData);
    setIsRequestModalOpen(false);
    setRequestData({ type: 'ANALYTICS', message: '' });
    setSubmitting(false);
  };

  useEffect(() => {
    const empId = employee?._id || employee?.id;
    if (!empId) return;
    const fetchHistory = async () => {
      try {
        const data = await getEmployeeAttendanceApi(empId);
        setAttendanceHistory(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error("Failed to fetch personal attendance", e);
      } finally {
        setIsLoading(false);
      }
    };
    fetchHistory();
  }, [employee]);

  if (!employee) return (
    <div className="py-20 text-center animate-pulse">
      <div className="h-10 w-10 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
      <p className="text-sm font-medium text-zinc-400">Synchronizing Personal Records...</p>
    </div>
  );

  const idExpiryDays = employee.nationalIdExpiryDate ? Math.ceil((new Date(employee.nationalIdExpiryDate) - new Date()) / (1000 * 60 * 60 * 24)) : null;

  return (
    <Layout
      title={`Welcome back, ${employee.fullName.split(' ')[0]}`}
      description="Your professional overview and presence log."
      hideHeader={true}
    >
      <div className="space-y-6">
        <WelcomeBanner employee={employee} attendanceHistory={attendanceHistory} />
        
        {/* Personal Pulse Row */}
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          <article className="rounded-2xl border border-white/20 glass-premium p-5 shadow-premium hover-lift">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Days Present</p>
            <p className="mt-1 text-2xl font-black text-slate-900">{attendanceHistory.filter(h => h.status === 'PRESENT').length}</p>
            <p className="text-[10px] text-emerald-600 font-bold mt-1">Current Month</p>
          </article>
          <article className="rounded-2xl border border-white/20 glass-premium p-5 shadow-premium hover-lift">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Late Arrivals</p>
            <p className="mt-1 text-2xl font-black text-amber-600">{attendanceHistory.filter(h => h.status === 'LATE').length}</p>
            <p className="text-[10px] text-amber-500 font-bold mt-1">Requires Attention</p>
          </article>
          <article className="rounded-2xl border border-white/20 glass-premium p-5 shadow-premium hover-lift">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">ID Status</p>
            <div className="mt-1 flex items-baseline gap-2">
               <p className={`text-xl font-black ${idExpiryDays !== null && idExpiryDays <= 30 ? 'text-rose-600' : 'text-emerald-600'}`}>
                 {idExpiryDays !== null ? (idExpiryDays <= 0 ? "Expired" : `${idExpiryDays}d Left`) : "Valid"}
               </p>
               {idExpiryDays !== null && idExpiryDays <= 30 && (
                 <span className="flex h-2 w-2 rounded-full bg-rose-500 animate-ping" />
               )}
            </div>
            <p className="text-[10px] text-slate-500 font-medium mt-1">Renewal Compliance</p>
          </article>
          <article className="rounded-2xl border border-white/20 glass-premium p-5 shadow-premium hover-lift">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Position</p>
            <p className="mt-1 text-sm font-bold text-slate-900 truncate">{employee.position || '—'}</p>
            <p className="text-[10px] text-indigo-500 font-bold mt-1">{employee.department}</p>
          </article>
        </div>

        {/* Compliance & Hierarchy Row */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Missing Documents Checklist */}
          <article className="rounded-3xl border border-white/20 glass-premium shadow-premium overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-white/40">
               <h3 className="text-xs font-black uppercase tracking-widest text-slate-900 border-l-4 border-indigo-500 pl-3">Compliance Checklist</h3>
               <span className="text-[9px] font-bold bg-zinc-100 text-zinc-500 px-2 py-0.5 rounded-full uppercase tracking-widest">Documents</span>
            </div>
            <div className="p-6">
               {(employee.documentChecklist || []).filter(d => d.status === 'MISSING').length > 0 ? (
                 <div className="space-y-4">
                   <p className="text-xs text-zinc-500 font-medium mb-4">
                     Please submit the following original documents to HR to finalize your file:
                   </p>
                   {(employee.documentChecklist || []).filter(d => d.status === 'MISSING').map((doc, idx) => (
                     <div key={idx} className="flex items-center justify-between p-3 bg-rose-50/50 border border-rose-100 rounded-xl group transition-all hover:bg-rose-50">
                        <div className="flex items-center gap-3">
                           <div className="h-8 w-8 rounded-lg bg-rose-100 flex items-center justify-center">
                              <FileWarning className="h-4 w-4 text-rose-600" />
                           </div>
                           <span className="text-sm font-bold text-rose-900 truncate max-w-[200px]">{doc.documentName}</span>
                        </div>
                        <span className="text-[9px] font-black bg-rose-200 text-rose-700 px-2 py-0.5 rounded uppercase tracking-tighter shadow-sm">MISSING</span>
                     </div>
                   ))}
                 </div>
               ) : (
                 <div className="py-10 text-center">
                    <div className="h-12 w-12 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-4 border border-emerald-100">
                       <ShieldCheck className="h-6 w-6 text-emerald-600" />
                    </div>
                    <p className="text-sm font-bold text-zinc-900">Records Clear</p>
                    <p className="text-xs text-zinc-400 mt-1">All required documents have been verified.</p>
                 </div>
               )}
            </div>
          </article>

          {/* Management Hierarchy Section */}
          <article className="rounded-3xl border border-white/20 glass-premium shadow-premium overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-white/40">
               <h3 className="text-xs font-black uppercase tracking-widest text-slate-900 border-l-4 border-indigo-500 pl-3">Management & Reporting</h3>
            </div>
            <div className="p-6">
              <div className="space-y-6">
                <div>
                  <p className="text-[9px] font-bold text-zinc-400 uppercase mb-2">Direct Manager</p>
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center text-sm font-bold text-indigo-500 shadow-inner">
                      {(employee.effectiveManager?.fullName || employee.managerId?.fullName)?.[0] || '?'}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-zinc-900">{employee.effectiveManager?.fullName || employee.managerId?.fullName || "Not Assigned"}</p>
                      <p className="text-[10px] text-zinc-400">{employee.effectiveManager?.email || employee.managerId?.email || "No contact info"}</p>
                    </div>
                  </div>
                </div>
                <div className="h-px bg-zinc-100" />
                <div>
                  <p className="text-[9px] font-bold text-zinc-400 uppercase mb-2">Team Leader</p>
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center text-sm font-bold text-emerald-500 shadow-inner">
                      {(employee.effectiveTeamLeader?.fullName || employee.teamLeaderId?.fullName)?.[0] || '?'}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-zinc-900">{employee.effectiveTeamLeader?.fullName || employee.teamLeaderId?.fullName || "Not Assigned"}</p>
                      <p className="text-[10px] text-zinc-400">{employee.effectiveTeamLeader?.email || employee.teamLeaderId?.email || "Unit support"}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </article>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Daily Attendance History */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between px-1">
               <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-400 flex items-center gap-2">
                 <Clock size={14} className="text-indigo-500" /> Recent Presence Logs
               </h3>
               {attendanceHistory.length > 0 && <span className="text-[10px] font-bold text-zinc-300">Last 30 Records</span>}
            </div>
            <div className="rounded-2xl border border-white/20 glass-premium shadow-premium overflow-hidden overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-white/40 border-b border-slate-100">
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Date</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Status</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Log</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Hours</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 italic font-medium text-zinc-800">
                  {isLoading ? (
                    <tr><td colSpan="4" className="px-6 py-10 text-center animate-pulse">Syncing...</td></tr>
                  ) : attendanceHistory.length === 0 ? (
                    <tr><td colSpan="4" className="px-6 py-10 text-center text-zinc-400">No attendance logs detected.</td></tr>
                  ) : (
                    attendanceHistory.map(record => (
                      <tr key={record._id} className="hover:bg-white/50 transition-colors group">
                        <td className="px-6 py-4 text-xs font-bold text-zinc-900">
                          {new Date(record.date).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase border ${
                            record.status === 'PRESENT' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                            record.status === 'LATE' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                            'bg-rose-50 text-rose-600 border-rose-100'
                          }`}>
                            {record.status}{record.unpaidLeave ? " · UNPAID" : ""}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-xs font-mono text-zinc-500">{record.checkIn || '—'} / {record.checkOut || '—'}</td>
                        <td className="px-6 py-4 text-right pr-8 text-xs font-black text-zinc-900">{formatTotalHours(record.totalHours)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Special Requests Module */}
          <article className="rounded-3xl border border-white/20 glass-premium shadow-premium overflow-hidden flex flex-col justify-center items-center py-8 px-6 bg-gradient-to-br from-indigo-50/50 via-white/50 to-purple-50/50 hover-lift relative group">
            <div className="absolute top-0 right-0 -mr-8 -mt-8 h-32 w-32 rounded-full bg-indigo-500/5 blur-2xl group-hover:bg-indigo-500/10 transition-colors" />
            <div className="absolute bottom-0 left-0 -ml-8 -mb-8 h-32 w-32 rounded-full bg-purple-500/5 blur-2xl group-hover:bg-purple-500/10 transition-colors" />
            
            <div className="h-12 w-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-200 mb-4 transition-transform group-hover:scale-110">
               <Zap size={24} fill="currentColor" />
            </div>
            <h3 className="text-base font-black text-slate-900 mb-1">Require Privileges?</h3>
            <p className="text-[11px] text-slate-500 text-center mb-6 max-w-[200px] leading-relaxed font-medium">
              Send a formal request for Analytics, HR Modules, or special permissions.
            </p>
            <button 
              onClick={() => setIsRequestModalOpen(true)} 
              className="w-full py-3 bg-indigo-600 text-white text-[10px] font-black rounded-2xl shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all active:scale-95 uppercase tracking-widest border border-indigo-500/20"
            >
              Submit Request
            </button>
          </article>
        </div>
      </div>

      {isRequestModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/40 backdrop-blur-sm p-4">
          <form 
            onSubmit={handleSubmitRequest}
            className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-zinc-200 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200"
          >
            <div className="px-6 py-4 border-b border-zinc-100 bg-zinc-50/50">
              <h2 className="font-bold text-zinc-900">New Management Request</h2>
              <p className="text-xs text-zinc-500 mt-1">Submit a formal request for elevated features.</p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-zinc-700 mb-1.5 uppercase tracking-widest">Type of Request</label>
                <select
                  required
                  value={requestData.type}
                  onChange={e => setRequestData({ ...requestData, type: e.target.value })}
                  className="w-full rounded-xl border border-zinc-200 px-4 py-2.5 text-sm bg-zinc-50/50 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition"
                >
                  <option value="ANALYTICS">Analytics Access</option>
                  <option value="HR_MODULES">HR Modules</option>
                  <option value="PERMISSION">Special Permissions</option>
                  <option value="OTHER">Other Request</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-zinc-700 mb-1.5 uppercase tracking-widest">Context & Reason</label>
                <textarea
                  required
                  value={requestData.message}
                  onChange={e => setRequestData({ ...requestData, message: e.target.value })}
                  rows={4}
                  placeholder="Explain why you need this access..."
                  className="w-full rounded-xl border border-zinc-200 px-4 py-3 text-sm bg-zinc-50/50 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition resize-none"
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-zinc-100 bg-zinc-50/50 flex justify-end gap-3">
              <button
                type="button"
                disabled={submitting}
                onClick={() => setIsRequestModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-zinc-600 hover:bg-zinc-100 rounded-xl transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl shadow-sm hover:bg-indigo-700 transition disabled:opacity-50"
              >
                {submitting ? "Sending..." : "Submit Request"}
              </button>
            </div>
          </form>
        </div>
      )}
    </Layout>
  );
});

function teamRosterMembers(team, employees) {
  const name = (team.name || "").trim();
  const nameKey = name.toLowerCase();
  const teamId = String(team.id ?? team._id ?? "");
  const memberEmails = new Set(
    (team.members || []).map((m) => String(m).toLowerCase().trim()).filter(Boolean),
  );
  const memberIdSet = new Set();
  for (const mid of team.memberIds || []) {
    const v = mid?.id ?? mid?._id ?? mid;
    if (v != null) memberIdSet.add(String(v));
  }
  return employees.filter((emp) => {
    const em = (emp.email || "").toLowerCase().trim();
    if (memberEmails.has(em)) return true;
    const eid = String(emp.id ?? emp._id ?? "");
    if (eid && memberIdSet.has(eid)) return true;
    if (teamId) {
      const popTeamId = String(emp.teamId ?? emp.team?.id ?? emp.team?._id ?? "");
      if (popTeamId && popTeamId === teamId) return true;
    }
    const tn = (emp.team || "").trim().toLowerCase();
    if (nameKey && tn === nameKey) return true;
    return false;
  });
}

const TeamLeaderDashboard = memo(function TeamLeaderDashboard({
  teams,
  employees,
  currentUserEmployee,
  currentUser,
  employeesLoading = false,
  canFetchAttendance = false,
}) {
  const [dailyAttendance, setDailyAttendance] = useState([]);
  const [loadingAttendance, setLoadingAttendance] = useState(false);
  const [evaluateTarget, setEvaluateTarget] = useState(null);

  const ledTeamNames = useMemo(
    () => [...new Set(teams.map((t) => t.name).filter(Boolean))],
    [teams],
  );

  useEffect(() => {
    if (!canFetchAttendance) {
      setDailyAttendance([]);
      setLoadingAttendance(false);
      return;
    }
    const fetchDaily = async () => {
      setLoadingAttendance(true);
      try {
        const data = await getTodayAttendanceApi();
        setDailyAttendance(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Failed to fetch daily attendance", err);
      } finally {
        setLoadingAttendance(false);
      }
    };
    fetchDaily();
  }, [canFetchAttendance]);

  const primaryTeam = teams[0] || {};
  const evaluableFallbackMembers = useMemo(
    () =>
      employees.filter((emp) =>
        canManagerOrTeamLeaderEvaluateEmployee(emp, currentUser, {
          excludeHrAdminRoles: true,
          ledTeamNames,
          evaluatorEmployee: currentUserEmployee,
        }) && emp.status !== "TERMINATED" && emp.status !== "RESIGNED",
      ),
    [employees, currentUser, ledTeamNames, currentUserEmployee],
  );
  const formattedHireDate = currentUserEmployee?.dateOfHire 
    ? new Date(currentUserEmployee.dateOfHire).toLocaleDateString()
    : "N/A";
  const userId = currentUser?.id != null ? String(currentUser.id) : "";
  const userEmail = (currentUser?.email || "").trim().toLowerCase();
  const teamRosterEmployees = useMemo(() => {
    const merged = teams.flatMap((team) => teamRosterMembers(team, employees));
    const seen = new Set();
    return merged.filter((emp) => {
      const id = String(emp.id ?? emp._id ?? "");
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }, [teams, employees]);
  const directLedEmployees = useMemo(
    () =>
      employees.filter((emp) => {
        const refs = [emp?.teamLeaderId, emp?.effectiveTeamLeader];
        return refs.some((ref) => {
          if (!ref) return false;
          if (typeof ref === "object") {
            const rid = ref._id ?? ref.id;
            const remail = (ref.email || "").trim().toLowerCase();
            return (userId && rid != null && String(rid) === userId)
              || (userEmail && remail && remail === userEmail);
          }
          return userId && String(ref) === userId;
        });
      }),
    [employees, userId, userEmail],
  );
  const teamLeaderScopeEmployees = useMemo(() => {
    const merged = [...teamRosterEmployees, ...directLedEmployees];
    const seen = new Set();
    return merged.filter((emp) => {
      const id = String(emp.id ?? emp._id ?? "");
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }, [teamRosterEmployees, directLedEmployees]);
  const teamLeaderScopeIds = useMemo(
    () => new Set(teamLeaderScopeEmployees.map((emp) => String(emp.id ?? emp._id ?? ""))),
    [teamLeaderScopeEmployees],
  );
  const scopedDailyAttendance = useMemo(
    () =>
      dailyAttendance.filter((record) => {
        const rid = String(record?.employeeId?._id ?? record?.employeeId ?? "");
        return rid && teamLeaderScopeIds.has(rid);
      }),
    [dailyAttendance, teamLeaderScopeIds],
  );

  if (employeesLoading) {
    return (
      <Layout title="Team Leadership" description={primaryTeam.name || "Operations"}>
        <section className="rounded-[20px] border border-zinc-200/80 bg-white p-8 text-sm text-zinc-600 shadow-sm ring-1 ring-zinc-950/[0.05]">
          Synchronizing team roster...
        </section>
      </Layout>
    );
  }

  return (
    <Layout title="Team Leadership" description={primaryTeam.name || "Operations"}>
      <div className="space-y-8 text-zinc-900">
        {/* Leadership Overview Banner - No Approval Required */}
        <section className="relative flex flex-col items-start gap-8 overflow-hidden rounded-[20px] bg-white p-8 shadow-sm ring-1 ring-zinc-950/[0.06] lg:flex-row lg:items-center">
          <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-zinc-200/40 blur-2xl" />
          <div className="relative flex h-24 w-24 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-zinc-700 to-zinc-900 text-3xl font-semibold tracking-tight text-white shadow-md">
            {primaryTeam.name?.[0] || "T"}
          </div>
          <div className="relative flex-1 space-y-3 text-left">
            <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200/90 bg-zinc-50 px-3 py-1">
               <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-zinc-500" />
               <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-600">Active leader</span>
            </div>
            <h2 className="text-2xl font-semibold tracking-tight text-zinc-900 md:text-3xl">{primaryTeam.leaderTitle || "Team Leader"} overview</h2>
            <p className="max-w-3xl text-sm font-medium leading-relaxed text-zinc-500">
              {primaryTeam.leaderResponsibility || "Managing operational excellence and team performance within the unit."}
            </p>
            <div className="flex flex-wrap justify-start gap-3 pt-2">
               <div className="flex items-center gap-3 rounded-xl border border-zinc-200/80 bg-zinc-50/80 px-4 py-2 shadow-sm">
                  <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">Commission date</span>
                  <span className="text-xs font-semibold text-zinc-900">{formattedHireDate}</span>
               </div>
            </div>
          </div>
        </section>

        {/* Assessment Reminder Widget */}
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          <AssessmentReminderWidget />
        </div>

        {/* Daily Attendance Widget */}
        <section className="space-y-4">
           <div className="flex items-center justify-between px-1">
              <h3 className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-wide text-zinc-500">
                <Calendar size={14} className="text-zinc-600" /> Active unit presence
              </h3>
              {scopedDailyAttendance.length > 0 && (
                <span className="rounded-full border border-zinc-200/90 bg-zinc-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-700">
                   Cycle: {new Date(scopedDailyAttendance[0].date).toLocaleDateString()}
                </span>
              )}
           </div>
           
           <div className="overflow-hidden rounded-[20px] bg-white shadow-sm ring-1 ring-zinc-950/[0.06]">
             <div className="overflow-x-auto">
             <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-zinc-100 bg-zinc-50/80">
                    <th className="px-6 py-4 font-medium uppercase tracking-wide text-zinc-500">Employee</th>
                    <th className="px-6 py-4 font-medium uppercase tracking-wide text-zinc-500">Signed in</th>
                    <th className="px-6 py-4 font-medium uppercase tracking-wide text-zinc-500">Status</th>
                    <th className="px-6 py-4 text-right font-medium uppercase tracking-wide text-zinc-500">Activity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {loadingAttendance ? (
                    <tr><td colSpan="4" className="px-6 py-12 text-center text-sm font-medium text-zinc-400 animate-pulse">Synchronizing daily logs…</td></tr>
                  ) : scopedDailyAttendance.length === 0 ? (
                    <tr><td colSpan="4" className="px-6 py-12 text-center text-sm font-medium italic text-zinc-500">No attendance logs for the current cycle.</td></tr>
                  ) : (
                    scopedDailyAttendance.map(record => (
                      <tr key={record._id} className="hover:bg-white/50 transition-colors group">
                        <td className="px-6 py-4">
                           <div className="font-bold text-zinc-900">{(record.employeeId?.fullName || "Staff").split(' ')[0]}</div>
                           <div className="text-[10px] text-zinc-400">{record.employeeCode}</div>
                        </td>
                        <td className="px-6 py-4 font-bold text-zinc-700">{record.checkIn || "—"}</td>
                        <td className="px-6 py-4">
                          <div className="inline-flex items-center gap-1.5">
                            <StatusBadge status={record.status} />
                            {record.unpaidLeave && (
                              <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-700">
                                UNPAID
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right pr-8">
                           <span className="text-[10px] font-bold text-zinc-400 italic">Verified Log</span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
             </table>
           </div>
          </div>
        </section>

        <div className="space-y-8">
          {teams.map((team, teamIdx) => {
            const teamMembers = teamRosterMembers(team, employees);
            const activeCount = teamMembers.filter(e => e.status === 'ACTIVE').length;

            return (
              <div
                key={team.id || `${team.name || "team"}-${teamIdx}`}
                className="space-y-6"
              >
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <article className="rounded-[20px] bg-white p-5 shadow-sm ring-1 ring-zinc-950/[0.06]">
                    <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">Headcount</p>
                    <p className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900">{teamMembers.length}</p>
                  </article>
                  <article className="rounded-[20px] bg-white p-5 shadow-sm ring-1 ring-zinc-950/[0.06]">
                    <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">Active members</p>
                    <p className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900">{activeCount}</p>
                  </article>
                  <article className="rounded-[20px] bg-white p-5 shadow-sm ring-1 ring-zinc-950/[0.06]">
                    <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">Team unit</p>
                    <p className="mt-1 truncate text-sm font-semibold uppercase tracking-tight text-zinc-900">{team.name}</p>
                  </article>
                </div>

                <div className="overflow-hidden rounded-[20px] bg-white shadow-sm ring-1 ring-zinc-950/[0.06]">
                  <div className="border-b border-zinc-100 bg-zinc-50/70 px-6 py-4">
                    <h2 className="border-l-4 border-zinc-900 pl-3 text-xs font-semibold uppercase tracking-wide text-zinc-900">Team roster</h2>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-zinc-100 bg-white">
                          <th className="px-6 py-3 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Employee</th>
                          <th className="px-6 py-3 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Information</th>
                          <th className="px-6 py-3 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Status</th>
                          <th className="px-6 py-3 text-[10px] font-bold text-zinc-400 uppercase tracking-widest text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100 text-xs text-zinc-800">
                        {teamMembers.length === 0 ? (
                          <tr><td colSpan="4" className="px-6 py-8 text-center text-zinc-400 italic">No members assigned to this team yet.</td></tr>
                        ) : (
                          teamMembers.map(emp => {
                            const canEvalHere =
                              canManagerOrTeamLeaderEvaluateEmployee(emp, currentUser, {
                                excludeHrAdminRoles: false,
                                ledTeamNames,
                                evaluatorEmployee: currentUserEmployee,
                              }) ||
                              canTeamLeaderEvaluateRosterMember(
                                emp,
                                team,
                                currentUser,
                                currentUserEmployee,
                              );
                            return (
                            <tr key={emp.id} className="hover:bg-zinc-50/50 transition-colors">
                              <td className="px-6 py-4">
                                <div className="font-bold text-zinc-900">{emp.fullName}</div>
                                <div className="text-[10px] font-mono text-zinc-400">{emp.employeeCode}</div>
                              </td>
                              <td className="px-6 py-4">
                                <div className="text-zinc-600 font-medium">{emp.position}</div>
                                <div className="text-[10px] text-zinc-400">{emp.email}</div>
                              </td>
                              <td className="px-6 py-4"><StatusBadge status={emp.status} /></td>
                              <td className="px-6 py-4 text-right">
                                <div className="flex flex-wrap items-center justify-end gap-2">
                                  {canEvalHere && emp.status !== "TERMINATED" && emp.status !== "RESIGNED" ? (
                                    <button
                                      type="button"
                                      onClick={() => setEvaluateTarget(emp)}
                                      className="inline-flex items-center gap-1.5 rounded-full border border-amber-200/90 bg-amber-50/90 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-amber-950 transition-colors hover:bg-amber-100"
                                    >
                                      <Star size={12} /> Evaluate
                                    </button>
                                  ) : null}
                                  <Link
                                    to={`/employees/${emp.id || emp._id}`}
                                    className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200/90 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-700 transition-colors hover:bg-zinc-50"
                                  >
                                    View
                                  </Link>
                                </div>
                              </td>
                            </tr>
                          );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            );
          })}
          {teams.length === 0 && evaluableFallbackMembers.length === 0 && (
            <div className="rounded-[20px] border border-dashed border-zinc-200/90 bg-zinc-50/40 p-12 text-center text-sm text-zinc-500 ring-1 ring-zinc-950/[0.04]">
              You are not currently assigned as a leader to any active teams.
            </div>
          )}
          {teams.length === 0 && evaluableFallbackMembers.length > 0 && (
            <div className="overflow-hidden rounded-[20px] bg-white shadow-sm ring-1 ring-zinc-950/[0.06]">
              <div className="border-b border-zinc-100 bg-zinc-50/70 px-6 py-4">
                <h2 className="border-l-4 border-zinc-900 pl-3 text-xs font-semibold uppercase tracking-wide text-zinc-900">
                  Team members available for evaluation
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-zinc-100 bg-white">
                      <th className="px-6 py-3 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Employee</th>
                      <th className="px-6 py-3 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Information</th>
                      <th className="px-6 py-3 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Status</th>
                      <th className="px-6 py-3 text-[10px] font-bold text-zinc-400 uppercase tracking-widest text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 text-xs text-zinc-800">
                    {evaluableFallbackMembers.map((emp) => (
                      <tr key={emp.id || emp._id} className="hover:bg-zinc-50/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-bold text-zinc-900">{emp.fullName}</div>
                          <div className="text-[10px] font-mono text-zinc-400">{emp.employeeCode}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-zinc-600 font-medium">{emp.position}</div>
                          <div className="text-[10px] text-zinc-400">{emp.email}</div>
                        </td>
                        <td className="px-6 py-4"><StatusBadge status={emp.status} /></td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex flex-wrap items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setEvaluateTarget(emp)}
                              className="inline-flex items-center gap-1.5 rounded-full border border-amber-200/90 bg-amber-50/90 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-amber-950 transition-colors hover:bg-amber-100"
                            >
                              <Star size={12} /> Evaluate
                            </button>
                            <Link
                              to={`/employees/${emp.id || emp._id}`}
                              className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200/90 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-700 transition-colors hover:bg-zinc-50"
                            >
                              View
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {evaluateTarget && (
        <SubmitAssessmentModal
          employee={evaluateTarget}
          onClose={() => setEvaluateTarget(null)}
        />
      )}
    </Layout>
  );
});

const DepartmentManagerDashboard = memo(function DepartmentManagerDashboard({
  department,
  employees,
  requests,
  currentUserEmployee,
  currentUser,
  alertsSummary,
  employeesLoading = false,
  canFetchAttendance = false,
}) {
  const [dailyAttendance, setDailyAttendance] = useState([]);
  const [loadingAttendance, setLoadingAttendance] = useState(false);
  const [evaluateTarget, setEvaluateTarget] = useState(null);
  const [standaloneTeamsForDept, setStandaloneTeamsForDept] = useState([]);

  useEffect(() => {
    const deptId = department?.id ?? department?._id;
    if (!deptId) {
      setStandaloneTeamsForDept([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const teams = await getTeamsApi({ departmentId: String(deptId) });
        if (!cancelled) setStandaloneTeamsForDept(Array.isArray(teams) ? teams : []);
      } catch (e) {
        console.error("Failed to load teams for department manager evaluate gate", e);
        if (!cancelled) setStandaloneTeamsForDept([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [department?.id, department?._id]);

  const deptHeadTeamNames = useMemo(
    () => [...new Set(mergedTeamNamesForDepartment(department, standaloneTeamsForDept))],
    [department, standaloneTeamsForDept],
  );

  const deptManagerTeamsByDepartmentId = useMemo(() => {
    const id = String(department.id ?? department._id ?? "");
    const m = new Map();
    if (id) m.set(id, standaloneTeamsForDept);
    return m;
  }, [department, standaloneTeamsForDept]);

  useEffect(() => {
    if (!canFetchAttendance) {
      setDailyAttendance([]);
      setLoadingAttendance(false);
      return;
    }
    const fetchDaily = async () => {
      setLoadingAttendance(true);
      try {
        const data = await getTodayAttendanceApi();
        setDailyAttendance(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Failed to fetch daily attendance", err);
      } finally {
        setLoadingAttendance(false);
      }
    };
    fetchDaily();
  }, [canFetchAttendance]);

  const managerId = currentUser?.id != null ? String(currentUser.id) : "";
  const managerEmail = (currentUser?.email || "").trim().toLowerCase();
  const directReportEmployees = useMemo(
    () =>
      employees.filter((emp) => {
        const mgr = emp?.managerId;
        const effMgr = emp?.effectiveManager;
        const refs = [mgr, effMgr];
        return refs.some((ref) => {
          if (!ref) return false;
          if (typeof ref === "object") {
            const rid = ref._id ?? ref.id;
            const remail = (ref.email || "").trim().toLowerCase();
            return (managerId && rid != null && String(rid) === managerId)
              || (managerEmail && remail && remail === managerEmail);
          }
          return managerId && String(ref) === managerId;
        });
      }),
    [employees, managerId, managerEmail],
  );
  const deptEmployees = useMemo(() => {
    const mergedTeams = mergeTeamsForDepartment(department, standaloneTeamsForDept);
    const rosterMembers = mergedTeams.flatMap((team) => teamRosterMembers(team, employees));
    const merged = [
      ...employees.filter((emp) => employeeBelongsToDepartment(emp, department)),
      ...directReportEmployees,
      ...rosterMembers,
    ];
    const seen = new Set();
    return merged.filter((emp) => {
      const id = String(emp.id ?? emp._id ?? "");
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }, [employees, department, directReportEmployees, standaloneTeamsForDept]);
  const managerScopeIds = useMemo(
    () => new Set(deptEmployees.map((emp) => String(emp.id ?? emp._id ?? ""))),
    [deptEmployees],
  );
  const scopedDailyAttendance = useMemo(
    () =>
      dailyAttendance.filter((record) => {
        const rid = String(record?.employeeId?._id ?? record?.employeeId ?? "");
        return rid && managerScopeIds.has(rid);
      }),
    [dailyAttendance, managerScopeIds],
  );
  const activeCount = deptEmployees.filter(e => e.status === 'ACTIVE').length;
  const pendingRequests = requests.filter(r => r.status === 'PENDING');

  const formattedHireDate = currentUserEmployee?.dateOfHire 
    ? new Date(currentUserEmployee.dateOfHire).toLocaleDateString()
    : "N/A";

  if (employeesLoading) {
    return (
      <Layout title={`${department.name} Department`} description={department.headTitle}>
        <section className="rounded-[20px] border border-zinc-200/80 bg-white p-8 text-sm text-zinc-600 shadow-sm ring-1 ring-zinc-950/[0.05]">
          Synchronizing department roster...
        </section>
      </Layout>
    );
  }

  return (
    <Layout title={`${department.name} Department`} description={department.headTitle}>
      <DashboardAlerts alerts={alertsSummary} />

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 mb-8">
        <AssessmentReminderWidget />
      </div>

      <section className="relative mb-10 flex flex-col items-center gap-8 overflow-hidden rounded-[20px] bg-white p-8 shadow-sm ring-1 ring-zinc-950/[0.06] md:flex-row">
        <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-zinc-200/40 blur-2xl" />
        <div className="relative flex h-24 w-24 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-zinc-700 to-zinc-900 text-3xl font-semibold tracking-tight text-white shadow-md">
          {department.name[0]}
        </div>
        <div className="relative flex-1 space-y-3 text-center md:text-left">
          <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200/90 bg-zinc-50 px-3 py-1">
             <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-zinc-500" />
             <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-600">Department head</span>
          </div>
          <h2 className="text-2xl font-semibold tracking-tight text-zinc-900 md:text-3xl">{department.headTitle} overview</h2>
          <p className="max-w-3xl text-sm font-medium leading-relaxed text-zinc-500">
            {department.headResponsibility || "No specific responsibility defined for this department head position."}
          </p>
          <div className="flex flex-wrap justify-center gap-4 pt-2 md:justify-start">
             <div className="flex items-center gap-3 rounded-xl border border-zinc-200/80 bg-zinc-50/80 px-4 py-2 shadow-sm">
                <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">Commission date</span>
                <span className="text-xs font-semibold text-zinc-900">{formattedHireDate}</span>
             </div>
             <div className="flex items-center gap-3 rounded-xl border border-zinc-200/80 bg-zinc-50/80 px-4 py-2 shadow-sm">
                <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">Direct report</span>
                <span className="text-xs font-semibold text-zinc-900">HR Director</span>
             </div>
          </div>
        </div>
      </section>

      <section className="mb-10 space-y-4">
         <div className="flex items-center justify-between px-1">
            <h3 className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-wide text-zinc-500">
              <Calendar size={14} className="text-zinc-600" /> Department presence
            </h3>
            {scopedDailyAttendance.length > 0 && (
              <span className="rounded-full border border-zinc-200/90 bg-zinc-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-700">
                 Cycle: {new Date(scopedDailyAttendance[0].date).toLocaleDateString()}
              </span>
            )}
         </div>
         
         <div className="overflow-hidden rounded-[20px] bg-white shadow-sm ring-1 ring-zinc-950/[0.06]">
           <div className="overflow-x-auto">
             <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-zinc-100 bg-zinc-50/80">
                    <th className="px-6 py-4 font-medium uppercase tracking-wide text-zinc-500">Personnel</th>
                    <th className="px-6 py-4 font-medium uppercase tracking-wide text-zinc-500">Role</th>
                    <th className="px-6 py-4 font-medium uppercase tracking-wide text-zinc-500">Arrival</th>
                    <th className="px-6 py-4 font-medium uppercase tracking-wide text-zinc-500">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 font-medium text-zinc-800 not-italic">
                  {loadingAttendance ? (
                    <tr><td colSpan="4" className="px-6 py-12 text-center text-sm font-medium text-zinc-400 animate-pulse">Loading presence…</td></tr>
                  ) : scopedDailyAttendance.length === 0 ? (
                    <tr><td colSpan="4" className="px-6 py-12 text-center text-sm font-medium italic text-zinc-500">No sign-ins for the current cycle.</td></tr>
                  ) : (
                    scopedDailyAttendance.map(record => (
                      <tr key={record._id} className="hover:bg-white/50 transition-colors group">
                        <td className="px-6 py-4">
                           <div className="font-bold text-zinc-900">{record.employeeId?.fullName}</div>
                           <div className="text-[10px] text-zinc-400">{record.employeeId?.email}</div>
                        </td>
                        <td className="px-6 py-4">
                           <div className="font-bold text-zinc-600 uppercase tracking-tighter text-[10px]">{record.employeeId?.department}</div>
                        </td>
                        <td className="px-6 py-4 font-black text-zinc-900">{record.checkIn || "—"}</td>
                        <td className="px-6 py-4 shrink-0">
                          <div className="inline-flex items-center gap-1.5">
                            <StatusBadge status={record.status} />
                            {record.unpaidLeave && (
                              <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-700">
                                UNPAID
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
             </table>
           </div>
          </div>
      </section>

      {pendingRequests.length > 0 && (
      <section className="relative mb-10 overflow-hidden rounded-[20px] bg-zinc-50/90 p-4 ring-1 ring-zinc-200/80 sm:p-6 lg:p-8">
          <h3 className="relative z-10 mb-6 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-800">
            <ShieldAlert size={14} className="text-zinc-500" /> Pending leave approvals
          </h3>
          <div className="relative z-10 space-y-4">
            {pendingRequests.map(req => (
              <div key={req._id} className="flex flex-col gap-4 rounded-[20px] border border-zinc-200/80 bg-white p-6 shadow-sm transition-shadow hover:shadow-md md:flex-row md:items-center md:justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-zinc-900">
                    {(req.employeeId?.fullName || req.employeeEmail || "Employee")}{" "}
                    <span className="ml-2 font-medium text-zinc-500">
                      requested {req.kind === "EXCUSE" ? "excuse" : (req.leaveType || "vacation").toLowerCase()}
                    </span>
                  </p>
                  <p className="text-xs font-medium italic text-zinc-500">
                    {req.kind === "EXCUSE"
                      ? `${new Date(req.excuseDate).toLocaleDateString()} ${req.startTime || ""}-${req.endTime || ""}`
                      : `${new Date(req.startDate).toLocaleDateString()} - ${new Date(req.endDate).toLocaleDateString()}`}
                  </p>
                </div>
                <Link
                  to="/employees/leave-approvals"
                  className="inline-flex shrink-0 items-center justify-center rounded-full bg-zinc-900 px-5 py-2 text-[10px] font-semibold uppercase tracking-wide text-white hover:bg-zinc-800"
                >
                  Open approvals
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}
      
      <div className="mb-10 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <article className="rounded-[20px] bg-white p-5 shadow-sm ring-1 ring-zinc-950/[0.06]">
          <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">Total staff</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900">{deptEmployees.length}</p>
        </article>
        <article className="rounded-[20px] bg-white p-5 shadow-sm ring-1 ring-zinc-950/[0.06]">
          <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">Active now</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900">{activeCount}</p>
        </article>
        <article className="rounded-[20px] bg-white p-5 shadow-sm ring-1 ring-zinc-950/[0.06]">
          <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">Sub-units</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900">{(department.teams || []).length}</p>
        </article>
      </div>

      <div className="space-y-10">
        <section>
          <h3 className="mb-4 flex items-center gap-2 px-1 text-[10px] font-medium uppercase tracking-wide text-zinc-500">
            <Briefcase size={14} className="text-zinc-600" /> Organizational units
          </h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {(department.teams || []).map(team => (
              <div key={team.id} className="group relative overflow-hidden rounded-[20px] bg-white p-6 shadow-sm ring-1 ring-zinc-950/[0.06]">
                <div className="absolute -right-4 -top-4 h-20 w-20 rounded-full bg-zinc-200/30 blur-xl transition-opacity group-hover:opacity-80" />
                <div className="relative z-10 mb-6 flex items-start justify-between">
                  <div>
                    <h4 className="text-lg font-semibold tracking-tight text-zinc-900">{team.name}</h4>
                    <p className="mt-1 text-[10px] font-medium uppercase tracking-wide text-zinc-500">{team.leaderTitle}: {team.leaderEmail || "Unassigned"}</p>
                  </div>
                  <span className="rounded-full border border-zinc-200/80 bg-zinc-50 px-3 py-1 text-[10px] font-semibold text-zinc-700 shadow-sm">{(team.members || []).length} members</span>
                </div>
                <div className="flex -space-x-2 overflow-hidden">
                  {(team.members || []).slice(0, 5).map((m, i) => (
                    <div key={i} className="inline-block h-6 w-6 rounded-full border-2 border-white bg-zinc-100 flex items-center justify-center text-[10px] font-bold text-zinc-500" title={m}>
                      {m[0].toUpperCase()}
                    </div>
                  ))}
                  {(team.members || []).length > 5 && (
                    <div className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-zinc-50 text-[8px] font-bold text-zinc-400">
                      +{(team.members || []).length - 5}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="overflow-hidden rounded-[20px] bg-white shadow-sm ring-1 ring-zinc-950/[0.06]">
          <div className="flex items-center justify-between border-b border-zinc-100 bg-zinc-50/70 px-6 py-5">
            <h3 className="border-l-4 border-zinc-900 pl-3 text-xs font-semibold uppercase tracking-wide text-zinc-900">Department personnel</h3>
            <span className="rounded-full border border-zinc-200/80 bg-white px-3 py-1 text-[10px] font-medium text-zinc-500">{deptEmployees.length} records</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-100 bg-zinc-50/80">
                  <th className="px-6 py-4 font-medium uppercase tracking-wide text-zinc-500">Employee</th>
                  <th className="px-6 py-4 font-medium uppercase tracking-wide text-zinc-500">Role</th>
                  <th className="px-6 py-4 font-medium uppercase tracking-wide text-zinc-500">Status</th>
                  <th className="px-6 py-4 text-right font-medium uppercase tracking-wide text-zinc-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 font-medium text-zinc-800 not-italic">
                {deptEmployees.map(emp => (
                  <tr key={emp.id} className="hover:bg-zinc-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-bold text-zinc-900">{emp.fullName}</div>
                      <div className="text-[10px] text-zinc-400">{emp.email}</div>
                    </td>
                    <td className="px-6 py-4">{emp.position}</td>
                    <td className="px-6 py-4"><StatusBadge status={emp.status} /></td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        {canManagerOrTeamLeaderEvaluateEmployee(emp, currentUser, {
                          excludeHrAdminRoles: false,
                          deptHeadTeamNames,
                          departments: [department],
                          teamsByDepartmentId: deptManagerTeamsByDepartmentId,
                          evaluatorEmployee: currentUserEmployee,
                        }) && emp.status !== "TERMINATED" && emp.status !== "RESIGNED" ? (
                          <button
                            type="button"
                            onClick={() => setEvaluateTarget(emp)}
                            className="inline-flex items-center gap-1.5 rounded-full border border-amber-200/90 bg-amber-50/90 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-amber-950 transition-colors hover:bg-amber-100"
                          >
                            <Star size={12} /> Evaluate
                          </button>
                        ) : null}
                        <Link
                          to={`/employees/${emp.id || emp._id}`}
                          className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200/90 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-700 transition-colors hover:bg-zinc-50"
                        >
                          View
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {evaluateTarget && (
        <SubmitAssessmentModal
          employee={evaluateTarget}
          onClose={() => setEvaluateTarget(null)}
        />
      )}
    </Layout>
  );
});

const AdminDashboard = memo(function AdminDashboard({ employees, departments, employeesPerDepartment, requests, alertsSummary, metricsSummary }) {
  const pendingRequests = requests.filter(r => r.status === 'PENDING');
  const totalPayroll = useMemo(() => {
    return employees.reduce((sum, emp) => sum + (emp.financial?.baseSalary || 0), 0);
  }, [employees]);

  const activeEmployees = employees.filter((e) => e.status === "ACTIVE").length;

  const statusData = useMemo(() => {
    const statuses = { ACTIVE: 0, ON_LEAVE: 0, RESIGNED: 0, TERMINATED: 0 };
    employees.forEach((emp) => {
      if (statuses[emp.status] !== undefined) statuses[emp.status]++;
    });
    return [
      { name: "Active", value: statuses.ACTIVE },
      { name: "On Leave", value: statuses.ON_LEAVE },
      { name: "Resigned", value: statuses.RESIGNED },
      { name: "Terminated", value: statuses.TERMINATED },
    ]
      .filter((s) => s.value > 0)
      .map((s) => ({
        ...s,
        color: STATUS_PIE_COLORS[s.name] || "#71717a",
      }));
  }, [employees]);

  const deptData = useMemo(() => {
    return employeesPerDepartment
      .map((d) => ({
        name: d.departmentName,
        members: d.employeeCount,
      }))
      .sort((a, b) => b.members - a.members);
  }, [employeesPerDepartment]);

  return (
    <Layout
      title="Global Overview"
      description="Headcount, payroll, and organization distribution."
    >
      <DashboardAlerts alerts={alertsSummary} />

      {/* Management Requests Section for Admin/HR */}
      <section className="mb-10">
        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 px-1 flex items-center gap-2">
          <ShieldAlert size={14} className="text-rose-500" /> Pending Leave Approvals
        </h3>
        {pendingRequests.length > 0 ? (
          <div className="space-y-4">
             {pendingRequests.map(req => (
              <div key={req._id} className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between p-4 rounded-2xl border border-white/20 glass-premium shadow-premium hover-lift transition-all hover:border-indigo-100 group">
                 <div className="flex gap-4 items-start sm:items-center">
                    <div className="h-10 w-10 rounded-2xl bg-indigo-600 flex items-center justify-center text-white font-black shadow-lg shadow-indigo-200 group-hover:scale-110 transition-transform">
                      {(req.employeeId?.fullName || req.employeeEmail || "E")[0].toUpperCase()}
                    </div>
                    <div>
                      <p className="text-[11px] font-black text-slate-900 leading-tight">
                        {(req.employeeId?.fullName || req.employeeEmail || "Employee")}
                      </p>
                      <p className="text-xs text-slate-500 font-medium mt-0.5">
                        {req.kind === "EXCUSE"
                          ? `Excuse ${new Date(req.excuseDate).toLocaleDateString()} ${req.startTime || ""}-${req.endTime || ""}`
                          : `${req.leaveType || "Vacation"} ${new Date(req.startDate).toLocaleDateString()} - ${new Date(req.endDate).toLocaleDateString()}`}
                      </p>
                    </div>
                 </div>
                 <Link
                   to="/employees/leave-approvals"
                   className="inline-flex w-full sm:w-auto items-center justify-center px-4 py-2 bg-indigo-600 text-white text-[10px] font-black rounded-xl shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95 uppercase tracking-widest"
                 >
                   Open approvals
                 </Link>
               </div>
             ))}
          </div>
        ) : (
          <div className="p-8 text-center rounded-xl border border-dashed border-zinc-200 bg-zinc-50/50">
             <p className="text-xs text-zinc-400 italic">No pending leave approvals at this time.</p>
          </div>
        )}
      </section>
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <article className="rounded-2xl border border-white/20 glass-premium p-6 shadow-premium hover-lift relative overflow-hidden group">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest relative z-10">Headcount</p>
          <div className="mt-3 flex flex-wrap items-baseline gap-2 relative z-10">
            <p className="text-3xl font-black text-slate-900 tracking-tighter tabular-nums">{employees.length}</p>
            <span className="text-[10px] text-emerald-600 font-black uppercase tracking-widest scale-90 px-2 py-0.5 bg-emerald-50 rounded-full">{activeEmployees} active</span>
          </div>
        </article>
        <article className="rounded-2xl border border-white/20 glass-premium p-6 shadow-premium hover-lift relative overflow-hidden group">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest relative z-10">Monthly Payroll</p>
          <p className="mt-3 text-3xl font-black text-slate-900 tracking-tighter tabular-nums relative z-10">
            {new Intl.NumberFormat("en-EG", {
              style: "currency",
              currency: "EGP",
              maximumFractionDigits: 0,
            }).format(metricsSummary?.totalPayroll || totalPayroll)}
          </p>
        </article>
        <article className="rounded-2xl border border-white/20 glass-premium p-6 shadow-premium hover-lift relative overflow-hidden group">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest relative z-10">Departments</p>
          <p className="mt-3 text-3xl font-black text-slate-900 tracking-tighter tabular-nums relative z-10">{departments.length}</p>
        </article>
        <article className="rounded-2xl border border-white/20 glass-premium p-6 shadow-premium hover-lift relative overflow-hidden group">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest relative z-10">Avg Salary</p>
          <p className="mt-3 text-3xl font-black text-indigo-600 tracking-tighter tabular-nums relative z-10">
            {new Intl.NumberFormat("en-EG", { style: "currency", currency: "EGP", maximumFractionDigits: 0 }).format(metricsSummary?.avgSalary || 0)}
          </p>
        </article>
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 mb-10">
        <Link to="/employees?salaryIncreaseFrom=today" className="block w-full rounded-2xl border border-amber-200/50 bg-gradient-to-br from-amber-50/50 to-white glass-premium p-6 shadow-premium hover-lift group relative overflow-hidden">
          <div className="absolute top-0 right-0 -mr-6 -mt-6 h-16 w-16 rounded-full bg-amber-500/10 blur-xl group-hover:bg-amber-500/20 transition-colors" />
          <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest flex items-center justify-between mb-4">
            Salary Adjustments
            <ArrowUpRight size={14} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
          </p>
          <p className="text-4xl font-black text-amber-900 tracking-tighter tabular-nums">{metricsSummary?.upcomingSalaryIncreases || 0}</p>
          <p className="text-[10px] text-amber-700 mt-2 font-black uppercase tracking-widest bg-amber-100/50 px-2 py-0.5 rounded-full inline-block">Next 30 Days</p>
        </Link>
        <Link to="/employees?idExpiringSoon=true" className="block w-full rounded-2xl border border-rose-200/50 bg-gradient-to-br from-rose-50/50 to-white glass-premium p-6 shadow-premium hover-lift group relative overflow-hidden">
          <div className="absolute top-0 right-0 -mr-6 -mt-6 h-16 w-16 rounded-full bg-rose-500/10 blur-xl group-hover:bg-rose-500/20 transition-colors" />
          <p className="text-[10px] font-black text-rose-600 uppercase tracking-widest flex items-center justify-between mb-4">
            ID Compliance
            <ShieldAlert size={14} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
          </p>
          <p className="text-4xl font-black text-rose-900 tracking-tighter tabular-nums">{metricsSummary?.idExpiringSoon || 0}</p>
          <p className="text-[10px] text-rose-700 mt-2 font-black uppercase tracking-widest bg-rose-100/50 px-2 py-0.5 rounded-full inline-block">Next 60 Days</p>
        </Link>
        <Link to="/employees?recentTransfers=true" className="block w-full rounded-2xl border border-indigo-200/50 bg-gradient-to-br from-indigo-50/50 to-white glass-premium p-6 shadow-premium hover-lift group relative overflow-hidden">
          <div className="absolute top-0 right-0 -mr-6 -mt-6 h-16 w-16 rounded-full bg-indigo-500/10 blur-xl group-hover:bg-indigo-500/20 transition-colors" />
          <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest flex items-center justify-between mb-4">
            Unit Transfers
            <RefreshCw size={14} className="group-hover:rotate-45 transition-transform" />
          </p>
          <p className="text-4xl font-black text-indigo-900 tracking-tighter tabular-nums">{alertsSummary?.recentTransfers || 0}</p>
          <p className="text-[10px] text-indigo-700 mt-2 font-black uppercase tracking-widest bg-indigo-100/50 px-2 py-0.5 rounded-full inline-block">Recent Changes</p>
        </Link>
      </div>

      <div className="grid gap-6 grid-cols-1 xl:grid-cols-2 mb-10">
        <section className="rounded-3xl border border-white/20 glass-premium p-8 shadow-premium relative overflow-hidden group">
          <div className="absolute top-0 right-0 -mr-12 -mt-12 h-40 w-40 rounded-full bg-indigo-500/5 blur-3xl" />
          <h2 className="mb-8 text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 flex items-center gap-2">
            <PieChartIcon size={14} className="text-indigo-500" /> Operational Status Distribution
          </h2>
          <div className="h-[260px] sm:h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={75}
                  outerRadius={105}
                  paddingAngle={4}
                  dataKey="value"
                  animationDuration={1500}
                  animationBegin={200}
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                  ))}
                </Pie>
                <Tooltip
                  cursor={{ fill: 'transparent' }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-white/80 backdrop-blur-md border border-white/40 p-3 rounded-2xl shadow-premium">
                          <p className="text-xs font-black text-slate-900 uppercase tracking-widest">{payload[0].name}</p>
                          <p className="text-xl font-black text-indigo-600 tabular-nums">{payload[0].value}</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend 
                   verticalAlign="bottom" 
                   height={36} 
                   iconType="circle"
                   wrapperStyle={{ fontSize: "10px", fontWeight: "900", textTransform: "uppercase", letterSpacing: "0.05em", color: "#64748b" }} 
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="rounded-3xl border border-white/20 glass-premium p-8 shadow-premium relative overflow-hidden group">
          <div className="absolute top-0 right-0 -mr-12 -mt-12 h-40 w-40 rounded-full bg-emerald-500/5 blur-3xl" />
          <h2 className="mb-8 text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 flex items-center gap-2">
            <BarChart3 size={14} className="text-emerald-500" /> Personnel per Department
          </h2>
          <div className="h-[260px] sm:h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={deptData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" strokeOpacity={0.5} />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 9, fill: "#94a3b8", fontWeight: "800" }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis tick={{ fontSize: 9, fill: "#94a3b8", fontWeight: "800" }} tickLine={false} axisLine={false} />
                <Tooltip
                  cursor={{ fill: "rgba(99, 102, 241, 0.05)", radius: 8 }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-white/80 backdrop-blur-md border border-white/40 p-3 rounded-2xl shadow-premium">
                          <p className="text-xs font-black text-slate-900 uppercase tracking-widest">{payload[0].payload.name}</p>
                          <p className="text-xl font-black text-indigo-600 tabular-nums">{payload[0].value}</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="members" fill="url(#barGradient)" radius={[6, 6, 0, 0]} barSize={32} animationDuration={1500}>
                  <defs>
                    <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#6366f1" />
                      <stop offset="100%" stopColor="#818cf8" />
                    </linearGradient>
                  </defs>
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>
    </Layout>
  );
});

export function DashboardPage() {
  const dispatch = useAppDispatch();
  const { showToast } = useToast();
  const { currentUser } = useAppSelector((state) => state.identity);
  const { items: employees, isLoading: employeesLoading } = useAppSelector((state) => state.employees);
  const { items: departments } = useAppSelector((state) => state.departments);

  const [requests, setRequests] = useState([]);
  const [alertsSummary, setAlertsSummary] = useState(null);
  const [metricsSummary, setMetricsSummary] = useState(null);

  const refreshRequests = async () => {
    try {
      const data = await listLeaveRequestsApi({ queue: "1", limit: "100" });
      setRequests(Array.isArray(data?.requests) ? data.requests : []);
    } catch (e) {
      console.error("Failed to fetch requests", e);
    }
  };

  const handleSendRequest = async (data) => {
    try {
      await createManagementRequestApi(data);
      await refreshRequests();
      showToast("Request submitted successfully", "success");
    } catch (e) {
      console.error("Request failed", e);
      showToast(e?.error || e?.message || "Failed to submit request", "error");
    }
  };

  useEffect(() => {
    const roleKey = normaliseRoleKey(currentUser?.role);
    const mayReadEmployees =
      roleKey === "ADMIN" ||
      roleKey === "HR" ||
      roleKey === "HR_STAFF" ||
      roleKey === "HR_MANAGER" ||
      roleKey === "MANAGER" ||
      roleKey === "TEAM_LEADER";
    const mayReadAttendance = mayReadEmployees;
    const mayApproveLeaves =
      roleKey === "ADMIN" ||
      roleKey === "HR_MANAGER" ||
      roleKey === "MANAGER" ||
      roleKey === "TEAM_LEADER";
    const shouldLoadDashboardSummaries =
      roleKey === "ADMIN" ||
      roleKey === "HR" ||
      roleKey === "HR_STAFF" ||
      roleKey === "HR_MANAGER";
    void dispatch(fetchDepartmentsThunk());
    if (mayReadEmployees) {
      void dispatch(fetchEmployeesThunk());
    }
    let cancelled = false;
    void (async () => {
      try {
        if (mayApproveLeaves) {
          const reqs = await listLeaveRequestsApi({ queue: "1", limit: "100" }).catch(() => null);
          if (!cancelled && reqs != null) setRequests(Array.isArray(reqs?.requests) ? reqs.requests : []);
        } else if (!cancelled) {
          setRequests([]);
        }

        if (shouldLoadDashboardSummaries && mayReadAttendance) {
          const alerts = await getDashboardAlertsApi().catch(() => null);
          if (!cancelled && alerts != null) setAlertsSummary(alerts);

          const metrics = await getDashboardMetricsApi().catch(() => null);
          if (!cancelled && metrics != null) setMetricsSummary(metrics);
        }
      } catch (e) {
        console.error("Failed to fetch dashboard summaries", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [dispatch, currentUser]);

  const dashboardRoleKey = normaliseRoleKey(currentUser?.role);
  const isManagementRole =
    dashboardRoleKey === "ADMIN" ||
    dashboardRoleKey === "HR" ||
    dashboardRoleKey === "HR_STAFF" ||
    dashboardRoleKey === "HR_MANAGER" ||
    dashboardRoleKey === "MANAGER" ||
    dashboardRoleKey === "TEAM_LEADER";

  const managedDepartments = useMemo(
    () => departments.filter((d) => departmentHeadedByUser(d, currentUser)),
    [departments, currentUser],
  );

  const managedTeams = useMemo(() => {
    const teams = [];
    const em = (currentUser?.email || "").toLowerCase().trim();
    const uid = currentUser?.id ? String(currentUser.id) : "";
    departments.forEach((dept) => {
      (dept.teams || []).forEach((team) => {
        const le = (team.leaderEmail || "").toLowerCase().trim();
        const lid = team.leaderId?.id ?? team.leaderId?._id ?? team.leaderId;
        if ((em && le === em) || (uid && lid != null && String(lid) === uid)) {
          teams.push({ ...team, departmentName: dept.name });
        }
      });
    });
    return teams;
  }, [departments, currentUser]);

  const [standaloneTeamsLed, setStandaloneTeamsLed] = useState([]);

  useEffect(() => {
    if (dashboardRoleKey !== "TEAM_LEADER") {
      setStandaloneTeamsLed([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const all = await getTeamsApi();
        if (!Array.isArray(all) || cancelled) return;
        const uid = currentUser?.id ? String(currentUser.id) : "";
        const email = (currentUser?.email || "").toLowerCase().trim();
        const led = all.filter((t) => {
          if (t.status && t.status !== "ACTIVE") return false;
          const le = (t.leaderEmail || "").toLowerCase().trim();
          const lid = t.leaderId?.id ?? t.leaderId?._id ?? t.leaderId;
          return (email && le === email) || (uid && lid != null && String(lid) === uid);
        });
        if (!cancelled) setStandaloneTeamsLed(led);
      } catch (e) {
        console.error("Failed to load teams for team leader dashboard", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [dashboardRoleKey, currentUser?.email, currentUser?.id]);

  const currentUserEmployee = useMemo(() => 
    employees.find(e => e.email === currentUser?.email),
  [employees, currentUser]);

  const mergedManagedTeams = useMemo(() => {
    const fromDept = managedTeams;
    const seen = new Set(
      fromDept.map((t) => (t.name || "").trim().toLowerCase()).filter(Boolean),
    );
    const extra = standaloneTeamsLed
      .filter((t) => {
        const key = (t.name || "").trim().toLowerCase();
        return key && !seen.has(key);
      })
      .map((t) => ({
        id: t.id,
        name: t.name,
        members: t.members || [],
        memberIds: t.memberIds || [],
        leaderEmail: t.leaderEmail,
        leaderTitle: t.leaderTitle,
        leaderResponsibility: t.leaderResponsibility,
        departmentName: t.departmentId?.name || "",
      }));
    const finalTeams = [...fromDept, ...extra];
    
    // Fallback inference: if user is TEAM_LEADER but explicit leader ties are missing,
    // infer their team based on their employment record.
    if (finalTeams.length === 0 && dashboardRoleKey === "TEAM_LEADER" && currentUserEmployee) {
      const myTeam = currentUserEmployee.team || currentUserEmployee.teamId;
      if (myTeam) {
         let inferredTeam = null;
         let isStandalone = false;
         
         // Search in departments
         departments.forEach(d => {
             (d.teams || []).forEach(t => {
                if (String(t._id || t.id) === String(myTeam) || t.name === myTeam) {
                   inferredTeam = { ...t, departmentName: d.name };
                }
             })
         });
         
         if (inferredTeam) {
             finalTeams.push(inferredTeam);
         } else {
             finalTeams.push({ id: myTeam, name: currentUserEmployee.team || "My Team", departmentName: currentUserEmployee.department || "" });
         }
      }
    }
    
    return finalTeams;
  }, [managedTeams, standaloneTeamsLed, dashboardRoleKey, currentUserEmployee, departments]);

  const employeesPerDepartment = useMemo(() => {
    const counts = new Map();
    for (const department of departments) counts.set(department.name, 0);
    for (const employee of employees) {
      counts.set(employee.department, (counts.get(employee.department) ?? 0) + 1);
    }
    return Array.from(counts.entries()).map(([departmentName, employeeCount]) => ({
      departmentName,
      employeeCount,
    }));
  }, [departments, employees]);



  if (!isManagementRole) {
    return (
      <Layout
        title="Management Dashboard"
        description="This space is reserved for management responsibilities."
      >
        <section className="rounded-3xl border border-zinc-200 bg-white p-8 shadow-sm">
          <p className="text-sm font-semibold text-zinc-900">No management assignment detected for your account.</p>
          <p className="mt-2 text-sm text-zinc-500">
            Continue from Home for your personal workspace.
          </p>
          <Link
            to="/"
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white transition-colors hover:bg-zinc-800"
          >
            Go to home
          </Link>
        </section>
      </Layout>
    );
  }

  if (dashboardRoleKey === "ADMIN") {
    return (
      <AdminDashboard
        employees={employees}
        departments={departments}
        employeesPerDepartment={employeesPerDepartment}
        requests={requests}
        alertsSummary={alertsSummary}
        metricsSummary={metricsSummary}
      />
    );
  }

  if (managedDepartments.length > 0) {
    return <DepartmentManagerDashboard
      department={managedDepartments[0]}
      employees={employees}
      requests={requests}
      currentUserEmployee={currentUserEmployee}
      currentUser={currentUser}
      alertsSummary={alertsSummary}
      employeesLoading={employeesLoading}
      canFetchAttendance={true}
    />;
  }

  // Always show TeamLeaderDashboard for Team Leaders, even if they have no teams yet.
  if (dashboardRoleKey === "TEAM_LEADER") {
    return <TeamLeaderDashboard
      teams={mergedManagedTeams}
      employees={employees}
      currentUserEmployee={currentUserEmployee}
      currentUser={currentUser}
      employeesLoading={employeesLoading}
      canFetchAttendance={true}
    />;
  }

  return (
    <Layout
      title="Management Dashboard"
      description="Operational dashboard for management roles."
    >
      <section className="rounded-3xl border border-zinc-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold text-zinc-900">Management dashboard is ready.</p>
        <p className="mt-2 text-sm text-zinc-500">
          Your role has access, but there is no active department or team assignment to render detailed modules.
        </p>
      </section>
    </Layout>
  );
}
