import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Layout } from "@/shared/components/Layout";
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
import { Calendar, Clock, AlertTriangle, TrendingUp, FileWarning, ShieldCheck } from "lucide-react";
import { StatusBadge } from "@/shared/components/EntityBadges";
import { fetchWithAuth } from "@/shared/api/fetchWithAuth";
import { API_URL } from "@/shared/api/apiBase";
import { DashboardAlerts } from "./DashboardAlerts";

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
    return attendanceHistory.find(h => h.date.startsWith(today));
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

function EmployeeDashboard({ currentUser, employees }) {
  const [attendanceHistory, setAttendanceHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const employee = useMemo(() => 
    employees.find(e => e.email === currentUser?.email),
    [employees, currentUser]
  );

  useEffect(() => {
    if (!employee?._id) return;
    const fetchHistory = async () => {
      try {
        const res = await fetchWithAuth(`${API_URL}/attendance/employee/${employee._id}`);
        if (res.ok) setAttendanceHistory(await res.json());
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
        <div className="grid gap-4 md:grid-cols-4">
          <article className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Days Present</p>
            <p className="mt-1 text-2xl font-black text-zinc-900">{attendanceHistory.filter(h => h.status === 'PRESENT').length}</p>
            <p className="text-[10px] text-emerald-600 font-bold mt-1">Current Month</p>
          </article>
          <article className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Late Arrivals</p>
            <p className="mt-1 text-2xl font-black text-amber-600">{attendanceHistory.filter(h => h.status === 'LATE').length}</p>
            <p className="text-[10px] text-amber-500 font-bold mt-1">Requires Attention</p>
          </article>
          <article className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">ID Status</p>
            <div className="mt-1 flex items-baseline gap-2">
               <p className={`text-xl font-black ${idExpiryDays !== null && idExpiryDays <= 30 ? 'text-rose-600' : 'text-emerald-600'}`}>
                 {idExpiryDays !== null ? (idExpiryDays <= 0 ? "Expired" : `${idExpiryDays}d Left`) : "Valid"}
               </p>
               {idExpiryDays !== null && idExpiryDays <= 30 && (
                 <span className="flex h-2 w-2 rounded-full bg-rose-500 animate-ping" />
               )}
            </div>
            <p className="text-[10px] text-zinc-500 font-medium mt-1">Renewal Compliance</p>
          </article>
          <article className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Position</p>
            <p className="mt-1 text-sm font-bold text-zinc-900 truncate">{employee.position || '—'}</p>
            <p className="text-[10px] text-indigo-500 font-bold mt-1">{employee.department}</p>
          </article>
        </div>

        {/* Compliance & Hierarchy Row */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Missing Documents Checklist */}
          <article className="rounded-3xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between">
               <h3 className="text-xs font-black uppercase tracking-widest text-zinc-900 border-l-2 border-indigo-500 pl-3">Compliance Checklist</h3>
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
          <article className="rounded-3xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-zinc-100">
               <h3 className="text-xs font-black uppercase tracking-widest text-zinc-900 border-l-2 border-indigo-500 pl-3">Management & Reporting</h3>
            </div>
            <div className="p-6">
              <div className="space-y-6">
                <div>
                  <p className="text-[9px] font-bold text-zinc-400 uppercase mb-2">Direct Manager</p>
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center text-sm font-bold text-indigo-500 shadow-inner">
                      {employee.managerId?.fullName?.[0] || '?'}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-zinc-900">{employee.managerId?.fullName || "Not Assigned"}</p>
                      <p className="text-[10px] text-zinc-400">{employee.managerId?.email || "No contact info"}</p>
                    </div>
                  </div>
                </div>
                <div className="h-px bg-zinc-100" />
                <div>
                  <p className="text-[9px] font-bold text-zinc-400 uppercase mb-2">Team Leader</p>
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center text-sm font-bold text-emerald-500 shadow-inner">
                      {employee.teamLeaderId?.fullName?.[0] || '?'}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-zinc-900">{employee.teamLeaderId?.fullName || "Not Assigned"}</p>
                      <p className="text-[10px] text-zinc-400">{employee.teamLeaderId?.email || "Unit support"}</p>
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
            <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm overflow-hidden overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-zinc-50/50 border-b border-zinc-100">
                    <th className="px-6 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-400">Date</th>
                    <th className="px-6 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-400">Status</th>
                    <th className="px-6 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-400">Log</th>
                    <th className="px-6 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-400 text-right">Hours</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 italic font-medium text-zinc-800">
                  {isLoading ? (
                    <tr><td colSpan="4" className="px-6 py-10 text-center animate-pulse">Syncing...</td></tr>
                  ) : attendanceHistory.length === 0 ? (
                    <tr><td colSpan="4" className="px-6 py-10 text-center text-zinc-400">No attendance logs detected.</td></tr>
                  ) : (
                    attendanceHistory.map(record => (
                      <tr key={record._id} className="hover:bg-zinc-50/50 transition-colors">
                        <td className="px-6 py-4 text-xs font-bold text-zinc-900">
                          {new Date(record.date).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase border ${
                            record.status === 'PRESENT' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                            record.status === 'LATE' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                            'bg-rose-50 text-rose-600 border-rose-100'
                          }`}>
                            {record.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-xs font-mono text-zinc-500">{record.checkIn || '—'} / {record.checkOut || '—'}</td>
                        <td className="px-6 py-4 text-right pr-8 text-xs font-black text-zinc-900">{record.totalHours ? `${record.totalHours}h` : '—'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <article className="rounded-2xl border border-dashed border-zinc-200 p-6 bg-zinc-50/30">
             <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">Professional Tip</p>
             <p className="text-xs text-zinc-500 italic leading-relaxed">
               You can review your full historical documents and salary cycle details in your profile tab.
             </p>
          </article>
        </div>
      </div>
    </Layout>
  );
}

function TeamLeaderDashboard({ teams, employees, currentUserEmployee }) {
  const [dailyAttendance, setDailyAttendance] = useState([]);
  const [loadingAttendance, setLoadingAttendance] = useState(false);

  useEffect(() => {
    const fetchDaily = async () => {
      setLoadingAttendance(true);
      try {
        const res = await fetchWithAuth(`${API_URL}/attendance?todayOnly=true`);
        if (res.ok) {
           const data = await res.json();
           setDailyAttendance(data);
        }
      } catch (err) {
        console.error("Failed to fetch daily attendance", err);
      } finally {
        setLoadingAttendance(false);
      }
    };
    fetchDaily();
  }, []);

  const primaryTeam = teams[0] || {};
  const formattedHireDate = currentUserEmployee?.dateOfHire 
    ? new Date(currentUserEmployee.dateOfHire).toLocaleDateString()
    : "N/A";

  return (
    <Layout title="Team Leadership" description={primaryTeam.name || "Operations"}>
      <div className="space-y-8 text-zinc-900">
        {/* Leadership Overview Banner - No Approval Required */}
        <section className="p-6 rounded-2xl border border-zinc-200 bg-white shadow-sm flex flex-col lg:flex-row items-start lg:items-center gap-6">
          <div className="h-20 w-20 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600 text-3xl font-bold shadow-inner shrink-0">
            {primaryTeam.name?.[0] || "T"}
          </div>
          <div className="flex-1 text-left">
            <h2 className="text-xl font-bold">{primaryTeam.leaderTitle || "Team Leader"} Overview</h2>
            <p className="text-sm text-zinc-500 mt-1 leading-relaxed max-w-2xl">
              {primaryTeam.leaderResponsibility || "Managing operational excellence and team performance within the unit."}
            </p>
            <div className="mt-4 flex flex-wrap justify-start gap-4">
               <div className="px-3 py-1.5 bg-zinc-50 rounded-lg border border-zinc-100 flex items-center gap-2">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">In Position Since</span>
                  <span className="text-xs font-bold text-zinc-700">{formattedHireDate}</span>
               </div>
               <div className="px-3 py-1.5 bg-emerald-50 rounded-lg border border-emerald-100 flex items-center gap-2">
                  <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest text-[9px]">Status</span>
                  <span className="text-xs font-bold text-emerald-700">Active Leader</span>
               </div>
            </div>
          </div>
        </section>

        {/* Daily Attendance Widget */}
        <section className="space-y-4">
           <div className="flex justify-between items-center px-1">
              <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                <Calendar size={14} /> Active Unit Presence (Updated Daily)
              </h3>
              {dailyAttendance.length > 0 && (
                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 uppercase italic">
                   Tracking {new Date(dailyAttendance[0].date).toLocaleDateString()}
                </span>
              )}
           </div>
           
           <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
             <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-zinc-50/50 border-b border-zinc-100">
                    <th className="px-6 py-3 font-bold text-zinc-400 uppercase tracking-widest">Employee</th>
                    <th className="px-6 py-3 font-bold text-zinc-400 uppercase tracking-widest">Signed In</th>
                    <th className="px-6 py-3 font-bold text-zinc-400 uppercase tracking-widest">Status</th>
                    <th className="px-6 py-3 font-bold text-zinc-400 uppercase tracking-widest text-right">Activity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {loadingAttendance ? (
                    <tr><td colSpan="4" className="px-6 py-10 text-center text-zinc-400 animate-pulse">Synchronizing Daily Logs...</td></tr>
                  ) : dailyAttendance.length === 0 ? (
                    <tr><td colSpan="4" className="px-6 py-10 text-center text-zinc-400 italic font-medium">No attendance logs detected for the current operational cycle.</td></tr>
                  ) : (
                    dailyAttendance.map(record => (
                      <tr key={record._id} className="hover:bg-zinc-50/50 transition-colors">
                        <td className="px-6 py-4">
                           <div className="font-bold text-zinc-900">{(record.employeeId?.fullName || "Staff").split(' ')[0]}</div>
                           <div className="text-[10px] text-zinc-400">{record.employeeCode}</div>
                        </td>
                        <td className="px-6 py-4 font-bold text-zinc-700">{record.checkIn || "—"}</td>
                        <td className="px-6 py-4"><StatusBadge status={record.status} /></td>
                        <td className="px-6 py-4 text-right pr-8">
                           <span className="text-[10px] font-bold text-zinc-400 italic">Verified Log</span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
             </table>
           </div>
        </section>

        <div className="space-y-8">
          {teams.map(team => {
            const teamMembers = employees.filter(emp => (team.members || []).includes(emp.email));
            const activeCount = teamMembers.filter(e => e.status === 'ACTIVE').length;

            return (
              <div key={team.id} className="space-y-6">
                <div className="grid gap-4 md:grid-cols-3">
                  <article className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Headcount</p>
                    <p className="mt-1 text-2xl font-bold text-zinc-900">{teamMembers.length}</p>
                  </article>
                  <article className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Active Members</p>
                    <p className="mt-1 text-2xl font-bold text-emerald-600">{activeCount}</p>
                  </article>
                  <article className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Team Unit</p>
                    <p className="mt-1 text-sm font-bold text-zinc-600 uppercase tracking-tight">{team.name}</p>
                  </article>
                </div>

                <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
                  <div className="px-6 py-4 border-b border-zinc-100 bg-zinc-50/50">
                    <h2 className="text-sm font-bold uppercase tracking-tight">Team Roster</h2>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-zinc-100 bg-white">
                          <th className="px-6 py-3 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Employee</th>
                          <th className="px-6 py-3 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Information</th>
                          <th className="px-6 py-3 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100 text-xs text-zinc-800">
                        {teamMembers.length === 0 ? (
                          <tr><td colSpan="3" className="px-6 py-8 text-center text-zinc-400 italic">No members assigned to this team yet.</td></tr>
                        ) : (
                          teamMembers.map(emp => (
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
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            );
          })}
          {teams.length === 0 && (
            <div className="rounded-xl border border-dashed border-zinc-200 p-12 text-center text-zinc-500 italic">
              You are not currently assigned as a leader to any active teams.
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}

function DepartmentManagerDashboard({ department, employees, requests, onHandleRequest, currentUserEmployee, alertsSummary }) {
  const [dailyAttendance, setDailyAttendance] = useState([]);
  const [loadingAttendance, setLoadingAttendance] = useState(false);

  useEffect(() => {
    const fetchDaily = async () => {
      setLoadingAttendance(true);
      try {
        const res = await fetchWithAuth(`${API_URL}/attendance?todayOnly=true`);
        if (res.ok) {
           const data = await res.json();
           setDailyAttendance(data);
        }
      } catch (err) {
        console.error("Failed to fetch daily attendance", err);
      } finally {
        setLoadingAttendance(false);
      }
    };
    fetchDaily();
  }, []);

  const deptEmployees = employees.filter(emp => emp.department === department.name || emp.departmentId === department.id);
  const activeCount = deptEmployees.filter(e => e.status === 'ACTIVE').length;
  const pendingRequests = requests.filter(r => r.status === 'PENDING');

  const formattedHireDate = currentUserEmployee?.dateOfHire 
    ? new Date(currentUserEmployee.dateOfHire).toLocaleDateString()
    : "N/A";

  return (
    <Layout title={`${department.name} Department`} description={department.headTitle}>
      <DashboardAlerts alerts={alertsSummary} />

      <section className="mb-8 p-6 rounded-2xl border border-zinc-200 bg-white shadow-sm flex flex-col md:flex-row items-center gap-6">
        <div className="h-20 w-20 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 text-3xl font-bold shadow-inner">
          {department.name[0]}
        </div>
        <div className="flex-1 text-center md:text-left">
          <h2 className="text-xl font-bold text-zinc-900">{department.headTitle} Overview</h2>
          <p className="text-sm text-zinc-500 mt-1 leading-relaxed max-w-2xl">
            {department.headResponsibility || "No specific responsibility defined for this department head position."}
          </p>
          <div className="mt-4 flex flex-wrap justify-center md:justify-start gap-4">
             <div className="px-3 py-1.5 bg-zinc-50 rounded-lg border border-zinc-100 flex items-center gap-2">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">In Position Since</span>
                <span className="text-xs font-bold text-zinc-700">{formattedHireDate}</span>
             </div>
             <div className="px-3 py-1.5 bg-zinc-50 rounded-lg border border-zinc-100 flex items-center gap-2">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Report To</span>
                <span className="text-xs font-bold text-zinc-700">HR Director</span>
             </div>
          </div>
        </div>
      </section>

      {/* Daily Attendance Widget for Managers */}
      <section className="mb-8 space-y-4">
         <div className="flex justify-between items-center px-1">
            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
              <Calendar size={14} /> Department Presence Log (Daily View)
            </h3>
            {dailyAttendance.length > 0 && (
              <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 uppercase italic">
                 Cycle: {new Date(dailyAttendance[0].date).toLocaleDateString()}
              </span>
            )}
         </div>
         
         <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
           <div className="overflow-x-auto">
             <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-zinc-50/50 border-b border-zinc-100">
                    <th className="px-6 py-4 font-bold text-zinc-400 uppercase tracking-widest">Personnel</th>
                    <th className="px-6 py-4 font-bold text-zinc-400 uppercase tracking-widest">Operational Role</th>
                    <th className="px-6 py-4 font-bold text-zinc-400 uppercase tracking-widest">Arrival</th>
                    <th className="px-6 py-4 font-bold text-zinc-400 uppercase tracking-widest">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {loadingAttendance ? (
                    <tr><td colSpan="4" className="px-6 py-12 text-center text-zinc-400 animate-pulse font-medium">Fetching Institutional Presence Logs...</td></tr>
                  ) : dailyAttendance.length === 0 ? (
                    <tr><td colSpan="4" className="px-6 py-12 text-center text-zinc-400 italic font-medium">No personnel have signed in for the current operational cycle.</td></tr>
                  ) : (
                    dailyAttendance.map(record => (
                      <tr key={record._id} className="hover:bg-zinc-50/50 transition-colors">
                        <td className="px-6 py-4">
                           <div className="font-bold text-zinc-900">{record.employeeId?.fullName}</div>
                           <div className="text-[10px] text-zinc-400">{record.employeeId?.email}</div>
                        </td>
                        <td className="px-6 py-4">
                           <div className="font-bold text-zinc-600 uppercase tracking-tighter text-[10px]">{record.employeeId?.department}</div>
                        </td>
                        <td className="px-6 py-4 font-black text-zinc-900">{record.checkIn || "—"}</td>
                        <td className="px-6 py-4 shrink-0"><StatusBadge status={record.status} /></td>
                      </tr>
                    ))
                  )}
                </tbody>
             </table>
           </div>
         </div>
      </section>

      {pendingRequests.length > 0 && (
        <section className="mb-8 p-4 rounded-xl border border-indigo-100 bg-indigo-50/30">
          <h3 className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest mb-3">Unit Requests</h3>
          <div className="space-y-2">
            {pendingRequests.map(req => (
              <div key={req._id} className="flex items-center justify-between p-3 bg-white rounded-lg border border-indigo-100 shadow-sm">
                <div>
                  <p className="text-[11px] font-bold text-zinc-900">{req.senderName} requested {req.type.replace('_', ' ')} access</p>
                  <p className="text-[10px] text-zinc-500">{req.message}</p>
                  {req.type === "HR_MODULES" && (
                     <p className="text-[9px] mt-1 italic text-indigo-500 font-bold uppercase">
                       {req.managerApproval?.status === 'APPROVED' ? "✓ Manager Approved (Waiting for HR)" : "Requires Your Approval"}
                     </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => onHandleRequest(req._id, 'APPROVED')}
                    disabled={req.type === "HR_MODULES" && req.managerApproval?.status === 'APPROVED'}
                    className={`px-3 py-1 text-[10px] font-bold rounded ${
                      req.type === "HR_MODULES" && req.managerApproval?.status === 'APPROVED' 
                        ? 'bg-zinc-100 text-zinc-400 cursor-not-allowed' 
                        : 'bg-indigo-600 text-white hover:bg-indigo-700'
                    }`}
                  >
                    {req.type === "HR_MODULES" && req.managerApproval?.status === 'APPROVED' ? 'Approved' : 'Approve'}
                  </button>
                  <button
                    onClick={() => onHandleRequest(req._id, 'REJECTED')}
                    className="px-3 py-1 bg-zinc-100 text-zinc-600 text-[10px] font-bold rounded hover:bg-zinc-200"
                  >
                    Deny
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
      
      <div className="grid gap-4 md:grid-cols-3 mb-8">
        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Total Staff</p>
          <p className="mt-1 text-2xl font-bold text-zinc-900">{deptEmployees.length}</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Active Now</p>
          <p className="mt-1 text-2xl font-bold text-emerald-600">{activeCount}</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Sub-Units</p>
          <p className="mt-1 text-2xl font-bold text-zinc-900">{(department.teams || []).length}</p>
        </div>
      </div>

      <div className="space-y-8">
        <section>
          <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-4">Organizational Units</h3>
          <div className="grid gap-4 md:grid-cols-2">
            {(department.teams || []).map(team => (
              <div key={team.id} className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h4 className="font-bold text-zinc-900">{team.name}</h4>
                    <p className="text-[10px] text-zinc-500">{team.leaderTitle}: {team.leaderEmail || "Unassigned"}</p>
                  </div>
                  <span className="px-2 py-0.5 bg-zinc-100 text-[10px] font-bold rounded">{(team.members || []).length} Members</span>
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

        <section className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-zinc-100 flex justify-between items-center bg-zinc-50/30">
            <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-widest">Department Staff List</h3>
            <span className="text-[10px] font-bold text-zinc-400">{deptEmployees.length} Personnel</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-100">
                  <th className="px-6 py-4 font-bold text-zinc-400 uppercase tracking-widest">Employee</th>
                  <th className="px-6 py-4 font-bold text-zinc-400 uppercase tracking-widest">Position</th>
                  <th className="px-6 py-4 font-bold text-zinc-400 uppercase tracking-widest">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 italic font-medium text-zinc-800">
                {deptEmployees.map(emp => (
                  <tr key={emp.id} className="hover:bg-zinc-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-bold text-zinc-900">{emp.fullName}</div>
                      <div className="text-[10px] text-zinc-400">{emp.email}</div>
                    </td>
                    <td className="px-6 py-4">{emp.position}</td>
                    <td className="px-6 py-4"><StatusBadge status={emp.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </Layout>
  );
}

function AdminDashboard({ employees, departments, employeesPerDepartment, requests, onHandleRequest, alertsSummary, metricsSummary }) {
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
      <section className="mb-8">
        <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-4">Pending Management Requests</h3>
        {pendingRequests.length > 0 ? (
          <div className="space-y-3">
             {pendingRequests.map(req => (
               <div key={req._id} className="flex items-center justify-between p-3 bg-white rounded-lg border border-indigo-100 shadow-sm">
                 <div className="flex gap-4 items-center">
                    <div className="h-8 w-8 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-600">
                      {req.senderName[0].toUpperCase()}
                    </div>
                    <div>
                      <p className="text-[11px] font-bold text-zinc-900">{req.senderName} ({req.senderRole}) requested {req.type.replace('_', ' ')}</p>
                      <p className="text-[10px] text-zinc-500">{req.message}</p>
                      {req.type === "HR_MODULES" && (
                         <div className="flex gap-2 mt-1">
                            <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-bold ${req.managerApproval?.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-700' : 'bg-zinc-100 text-zinc-500'}`}>
                              Manager: {req.managerApproval?.status}
                            </span>
                            <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-bold bg-indigo-50 text-indigo-700 animate-pulse`}>
                              HR Action Required
                            </span>
                         </div>
                      )}
                    </div>
                 </div>
                 <div className="flex gap-2">
                   <button
                     onClick={() => onHandleRequest(req._id, 'APPROVED')}
                     className="px-3 py-1 bg-indigo-600 text-white text-[10px] font-bold rounded hover:bg-indigo-700"
                   >
                     Approve
                   </button>
                   <button
                     onClick={() => onHandleRequest(req._id, 'REJECTED')}
                     className="px-3 py-1 bg-zinc-100 text-zinc-600 text-[10px] font-bold rounded hover:bg-zinc-200"
                   >
                     Deny
                   </button>
                 </div>
               </div>
             ))}
          </div>
        ) : (
          <div className="p-8 text-center rounded-xl border border-dashed border-zinc-200 bg-zinc-50/50">
             <p className="text-xs text-zinc-400 italic">No pending management requests at this time.</p>
          </div>
        )}
      </section>
      <div className="grid gap-4 md:grid-cols-4 mb-4">
        <article className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Headcount</p>
          <div className="mt-2 flex flex-wrap items-baseline gap-2">
            <p className="text-2xl font-bold text-zinc-900 tabular-nums">{employees.length}</p>
            <span className="text-xs text-zinc-500 font-medium">{activeEmployees} active</span>
          </div>
        </article>
        <article className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Monthly Payroll</p>
          <p className="mt-2 text-2xl font-bold text-zinc-900 tabular-nums">
            {new Intl.NumberFormat("en-US", {
              style: "currency",
              currency: "USD",
              maximumFractionDigits: 0,
            }).format(metricsSummary?.totalPayroll || totalPayroll)}
          </p>
        </article>
        <article className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Departments</p>
          <p className="mt-2 text-2xl font-bold text-zinc-900 tabular-nums">{departments.length}</p>
        </article>
        <article className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Average Salary</p>
          <p className="mt-2 text-2xl font-bold text-emerald-600 tabular-nums">
            {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(metricsSummary?.avgSalary || 0)}
          </p>
        </article>
      </div>

      <div className="grid gap-4 md:grid-cols-3 mb-8">
        <Link to="/employees?salaryIncreaseFrom=today" className="block w-full rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-5 shadow-sm hover:shadow-md transition cursor-pointer group">
          <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest flex items-center justify-between">
            Upcoming Salary Increases
            <span className="text-amber-400 group-hover:text-amber-600 transition">→</span>
          </p>
          <p className="mt-2 text-3xl font-black text-amber-900 tabular-nums">{metricsSummary?.upcomingSalaryIncreases || 0}</p>
          <p className="text-xs text-amber-700 mt-1 font-medium italic">Pending within 30 days</p>
        </Link>
        <Link to="/employees?idExpiringSoon=true" className="block w-full rounded-xl border border-red-200 bg-gradient-to-br from-red-50 to-white p-5 shadow-sm hover:shadow-md transition cursor-pointer group">
          <p className="text-[10px] font-bold text-red-600 uppercase tracking-widest flex items-center justify-between">
            IDs Expiring Soon
            <span className="text-red-400 group-hover:text-red-600 transition">→</span>
          </p>
          <p className="mt-2 text-3xl font-black text-red-900 tabular-nums">{metricsSummary?.idExpiringSoon || 0}</p>
          <p className="text-xs text-red-700 mt-1 font-medium italic">Expiring within 60 days</p>
        </Link>
        <Link to="/employees?recentTransfers=true" className="block w-full rounded-xl border border-indigo-200 bg-gradient-to-br from-indigo-50 to-white p-5 shadow-sm hover:shadow-md transition cursor-pointer group">
          <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest flex items-center justify-between">
            Recent Transfers
            <span className="text-indigo-400 group-hover:text-indigo-600 transition">→</span>
          </p>
          <p className="mt-2 text-3xl font-black text-indigo-900 tabular-nums">{alertsSummary?.recentTransfers || 0}</p>
          <p className="text-xs text-indigo-700 mt-1 font-medium italic">Moved within 30 days</p>
        </Link>
      </div>

      <div className="grid gap-6 md:grid-cols-2 mb-8">
        <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="mb-6 text-xs font-bold text-zinc-400 uppercase tracking-widest">Distribution</h2>
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    borderRadius: "12px",
                    border: "1px solid #e4e4e7",
                    fontSize: "12px",
                    boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.05)",
                  }}
                />
                <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: "11px", fontWeight: "600" }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="mb-6 text-xs font-bold text-zinc-400 uppercase tracking-widest">Departments</h2>
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={deptData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f4f4f5" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 10, fill: "#a1a1aa", fontWeight: "600" }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis tick={{ fontSize: 10, fill: "#a1a1aa", fontWeight: "600" }} tickLine={false} axisLine={false} />
                <Tooltip
                  cursor={{ fill: "#f8fafc" }}
                  contentStyle={{
                    borderRadius: "12px",
                    border: "1px solid #e4e4e7",
                    fontSize: "12px",
                  }}
                />
                <Bar dataKey="members" fill="#18181b" radius={[4, 4, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>
    </Layout>
  );
}

export function DashboardPage() {
  const dispatch = useAppDispatch();
  const { currentUser } = useAppSelector((state) => state.identity);
  const { items: employees } = useAppSelector((state) => state.employees);
  const { items: departments } = useAppSelector((state) => state.departments);

  const [requests, setRequests] = useState([]);
  const [alertsSummary, setAlertsSummary] = useState(null);
  const [metricsSummary, setMetricsSummary] = useState(null);

  const refreshRequests = async () => {
    try {
      const res = await fetchWithAuth(`${API_URL}/management-requests`);
      if (res.ok) setRequests(await res.json());
    } catch (e) {
      console.error("Failed to fetch requests", e);
    }
  };

  const handleSendRequest = async (data) => {
    try {
      await fetchWithAuth(`${API_URL}/management-requests`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(data)
      });
      await refreshRequests();
    } catch (e) {
      console.error("Request failed", e);
    }
  };

  const handleUpdateRequest = async (id, status) => {
    try {
      await fetchWithAuth(`${API_URL}/management-requests/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ status })
      });
      await refreshRequests();
    } catch (e) {
      console.error("Update failed", e);
    }
  };

  useEffect(() => {
    void dispatch(fetchDepartmentsThunk());
    void dispatch(fetchEmployeesThunk());
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetchWithAuth(`${API_URL}/management-requests`);
        if (!cancelled && res.ok) setRequests(await res.json());

        const resAlerts = await fetchWithAuth(`${API_URL}/dashboard/alerts`);
        if (!cancelled && resAlerts.ok) setAlertsSummary(await resAlerts.json());

        const resMetrics = await fetchWithAuth(`${API_URL}/dashboard/metrics`);
        if (!cancelled && resMetrics.ok) setMetricsSummary(await resMetrics.json());
      } catch (e) {
        console.error("Failed to fetch dashboard summaries", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [dispatch]);

  const managedDepartments = useMemo(() =>
    departments.filter(d => d.head === currentUser?.email),
    [departments, currentUser]);

  const managedTeams = useMemo(() => {
    const teams = [];
    departments.forEach(dept => {
      (dept.teams || []).forEach(team => {
        if (team.leaderEmail === currentUser?.email) {
          teams.push({ ...team, departmentName: dept.name });
        }
      });
    });
    return teams;
  }, [departments, currentUser]);

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

  const currentUserEmployee = useMemo(() => 
    employees.find(e => e.email === currentUser?.email),
    [employees, currentUser]);

  if (currentUser?.role === "ADMIN" || currentUser?.role === 3) {
    return (
      <AdminDashboard
        employees={employees}
        departments={departments}
        employeesPerDepartment={employeesPerDepartment}
        requests={requests}
        onHandleRequest={handleUpdateRequest}
        alertsSummary={alertsSummary}
        metricsSummary={metricsSummary}
      />
    );
  }

  const isEmployee = currentUser?.role === "EMPLOYEE";

  if (isEmployee) {
    return <EmployeeDashboard currentUser={currentUser} employees={employees} />;
  }

  if (managedDepartments.length > 0) {
    return <DepartmentManagerDashboard
      department={managedDepartments[0]}
      employees={employees}
      requests={requests}
      onHandleRequest={handleUpdateRequest}
      currentUserEmployee={currentUserEmployee}
      alertsSummary={alertsSummary}
      metricsSummary={metricsSummary}
    />;
  }

  // Always show TeamLeaderDashboard for Team Leaders, even if they have no teams yet.
  if (currentUser?.role === "TEAM_LEADER") {
    return <TeamLeaderDashboard
      teams={managedTeams}
      employees={employees}
      currentUserEmployee={currentUserEmployee}
    />;
  }

  return <EmployeeDashboard 
    currentUser={currentUser} 
    requests={requests} 
    onSendRequest={(data) => handleSendRequest({
      ...data,
      departmentId: currentUserEmployee?.departmentId,
      departmentName: currentUserEmployee?.department
    })} 
  />;
}
