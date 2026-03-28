import React, { useEffect, useState } from "react";
import { useAppDispatch, useAppSelector } from "@/shared/hooks/reduxHooks";
import { fetchTodaySnapshotThunk, fetchPeriodSummaryThunk } from "../store";
import { 
  Users, 
  Clock, 
  Calendar, 
  UserX, 
  MapPin, 
  AlertCircle,
  TrendingUp,
  Download,
  Filter,
  ArrowRight,
  Activity
} from "lucide-react";

/**
 * AttendanceDashboard - Minimalist HR Edition
 * Soft tones, high whitespace, and refined typography for a premium professional feel.
 */
const AttendanceDashboard = () => {
  const dispatch = useAppDispatch();
  const { todaySnapshot, periodSummary, loading } = useAppSelector((state) => state.attendance);
  const [dateRange, setDateRange] = useState({
    from: new Date(new Date().setDate(1)).toISOString().split("T")[0],
    to: new Date().toISOString().split("T")[0],
  });

  useEffect(() => {
    dispatch(fetchTodaySnapshotThunk());
    dispatch(fetchPeriodSummaryThunk(dateRange));
  }, [dispatch, dateRange]);

  const stats = [
    { 
      label: "Currently Present", 
      value: todaySnapshot?.counts?.present || 0, 
      icon: Users, 
      color: "text-indigo-600",
      bg: "bg-indigo-50",
      growth: "+12%"
    },
    { 
      label: "Late Arrival", 
      value: todaySnapshot?.counts?.late || 0, 
      icon: Clock, 
      color: "text-amber-600",
      bg: "bg-amber-50",
      growth: "-3%"
    },
    { 
      label: "Absent Today", 
      value: todaySnapshot?.counts?.absent || 0, 
      icon: UserX, 
      color: "text-rose-600",
      bg: "bg-rose-50",
      growth: "+2%"
    },
    { 
      label: "Work From Home", 
      value: todaySnapshot?.counts?.wfh || 0, 
      icon: MapPin, 
      color: "text-slate-600",
      bg: "bg-slate-100",
      growth: "Stable"
    },
  ];

  return (
    <div className="space-y-10 max-w-[1500px] mx-auto p-4 animate-in fade-in duration-700">
      
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-2 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2 text-indigo-600 mb-1">
             <Activity size={16} />
             <span className="text-[10px] font-black uppercase tracking-[0.3em]">Workforce Intelligence</span>
          </div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tighter">Attendance Overview</h1>
          <p className="text-slate-400 text-sm font-medium mt-1">Analytics and real-time monitoring of personnel movements.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-white border border-slate-200 rounded-2xl p-1.5 shadow-sm">
             <button className="px-5 py-2.5 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-indigo-600 transition-colors">7 Days</button>
             <button className="px-5 py-2.5 text-xs font-black uppercase tracking-widest bg-slate-900 text-white rounded-xl shadow-lg">30 Days</button>
          </div>
          <button className="p-3.5 bg-white border border-slate-200 rounded-2xl text-slate-600 hover:bg-slate-50 transition-all shadow-sm">
            <Filter size={18} />
          </button>
          <button className="flex items-center gap-3 px-6 py-3.5 bg-indigo-600 rounded-2xl text-xs font-black uppercase tracking-widest text-white hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100">
            <Download size={16} />
            <span>Generate Report</span>
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, i) => (
          <div key={i} className="bg-white p-8 rounded-[2.5rem] border border-slate-100/60 shadow-sm hover:shadow-xl hover:border-indigo-100 transition-all group">
            <div className="flex justify-between items-start mb-6">
              <div className={`p-4 rounded-2xl ${stat.bg} ${stat.color} transition-transform group-hover:rotate-12`}>
                <stat.icon size={24} />
              </div>
              <span className={`text-[10px] font-black px-2 py-1 rounded-lg ${stat.growth.startsWith('+') ? 'text-emerald-500 bg-emerald-50' : 'text-slate-400 bg-slate-50'}`}>
                {stat.growth}
              </span>
            </div>
            <h3 className="text-4xl font-black text-slate-900 tracking-tighter mb-1">{stat.value}</h3>
            <p className="text-xs font-black text-slate-400 uppercase tracking-wider">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        
        {/* Main Log Table */}
        <div className="lg:col-span-8 space-y-6">
          <div className="flex items-center justify-between px-2">
             <h3 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-3">
               Today's Personnel Log 
               <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
             </h3>
             <button className="text-[10px] font-black uppercase tracking-widest text-indigo-600 hover:underline flex items-center gap-1">
               View All Records <ArrowRight size={12} />
             </button>
          </div>

          <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto px-4 pb-4">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-slate-300 text-[10px] font-black uppercase tracking-[0.2em]">
                    <th className="px-6 py-8">Employee Identity</th>
                    <th className="px-6 py-8">Timeline</th>
                    <th className="px-6 py-8">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {todaySnapshot?.records?.map((record) => (
                    <tr key={record.id} className="group hover:bg-slate-50/50 transition-all">
                      <td className="px-6 py-6">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-sm font-black text-slate-400 group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-inner">
                            {record.employeeName?.split(" ").map(n => n[0]).join("")}
                          </div>
                          <div>
                            <p className="text-sm font-black text-slate-900 tracking-tight">{record.employeeName}</p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{record.department}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-6">
                        <div className="flex items-center gap-4">
                           <div className="text-center">
                              <p className="text-[8px] font-black text-slate-300 uppercase leading-none mb-1">Checked In</p>
                              <p className="text-xs font-black text-slate-700">{record.firstCheckIn ? new Date(record.firstCheckIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) : "--:--"}</p>
                           </div>
                           <div className="w-8 h-px bg-slate-100" />
                           <div className="text-center">
                              <p className="text-[8px] font-black text-slate-300 uppercase leading-none mb-1">Shift Hours</p>
                              <p className="text-xs font-black text-indigo-600">{record.workHours}h</p>
                           </div>
                        </div>
                      </td>
                      <td className="px-6 py-6 text-right">
                        <span className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-tighter ${
                          record.status === 'PRESENT' ? 'bg-emerald-50 text-emerald-600' :
                          record.status === 'LATE' ? 'bg-amber-50 text-amber-600 shadow-sm shadow-amber-100' :
                          record.status === 'WFH' ? 'bg-slate-100 text-slate-600' :
                          'bg-rose-50 text-rose-600'
                        }`}>
                          {record.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Sidebar Mini Analytics */}
        <div className="lg:col-span-4 space-y-8">
           
           <div className="bg-slate-950 p-8 rounded-[2.5rem] text-white overflow-hidden relative group">
              <div className="relative z-10">
                <h3 className="text-xl font-black tracking-tighter mb-6">Period Efficiency</h3>
                
                <div className="space-y-6">
                  <div>
                    <div className="flex justify-between items-end mb-2">
                       <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Target Hours Met</span>
                       <span className="text-lg font-black">{periodSummary?.totalWorkHours || 0}h</span>
                    </div>
                    <div className="w-full bg-slate-900 h-3 rounded-full overflow-hidden p-0.5 border border-white/5">
                       <div className="bg-indigo-500 h-full rounded-full shadow-[0_0_15px_rgba(99,102,241,0.5)]" style={{ width: '84%' }}></div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-4">
                     <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                        <p className="text-[9px] font-black text-slate-500 uppercase mb-1">Avg Lateness</p>
                        <p className="text-xl font-black text-amber-400">{periodSummary?.totalLateMinutes || 0}m</p>
                     </div>
                     <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                        <p className="text-[9px] font-black text-slate-500 uppercase mb-1">Overtime</p>
                        <p className="text-xl font-black text-indigo-400">{periodSummary?.totalOvertimeHours || 0}h</p>
                     </div>
                  </div>
                </div>
              </div>
              <div className="absolute top-[-20px] right-[-20px] w-40 h-40 bg-indigo-600/10 blur-[60px] rounded-full" />
           </div>

           <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden flex flex-col">
              <div className="flex items-center justify-between mb-8">
                <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest">Active Alerts</h4>
                <div className="w-8 h-8 rounded-xl bg-orange-50 flex items-center justify-center text-orange-500">
                   <AlertCircle size={16} />
                </div>
              </div>

              <div className="space-y-6 flex-1">
                 {[
                   { title: "Anomaly Detected", desc: "Unusual check-in pattern in IT Dept.", time: "14m ago" },
                   { title: "Report Ready", desc: "April 2026 Monthly summary generated.", time: "2h ago" },
                   { title: "Policy Update", desc: "Night Shift rules changed by admin.", time: "Jan 12" }
                 ].map((alert, i) => (
                   <div key={i} className="flex gap-4 group cursor-pointer">
                      <div className="w-1.5 h-1.5 rounded-full bg-slate-200 mt-2 group-hover:bg-indigo-500 transition-colors" />
                      <div className="min-w-0">
                         <p className="text-xs font-black text-slate-800 tracking-tight">{alert.title}</p>
                         <p className="text-[10px] text-slate-400 font-medium truncate">{alert.desc}</p>
                      </div>
                   </div>
                 ))}
              </div>

              <button className="mt-8 w-full py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-indigo-600 bg-slate-50 hover:bg-indigo-50 rounded-2xl transition-all">
                 Review History
              </button>
           </div>

        </div>
      </div>
    </div>
  );
};

export default AttendanceDashboard;
