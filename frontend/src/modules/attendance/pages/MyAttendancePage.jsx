import React, { useEffect, useState } from "react";
import { useAppDispatch, useAppSelector } from "@/shared/hooks/reduxHooks";
import { fetchDailyRecordsThunk } from "../store";
import { 
  History, 
  MapPin, 
  Clock, 
  Calendar, 
  CheckCircle2, 
  XCircle, 
  HelpCircle,
  FileText,
  TrendingUp,
  Activity,
  ArrowRight
} from "lucide-react";

/**
 * MyAttendancePage - Minimalist Personal Edition
 * A refined personal log with clean typography and soft architectural cues.
 */
const MyAttendancePage = () => {
  const dispatch = useAppDispatch();
  const { currentUser } = useAppSelector((state) => state.identity);
  const { dailyRecords, loading } = useAppSelector((state) => state.attendance);
  const [filter, setFilter] = useState({
    employeeId: currentUser?.id,
    from: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split("T")[0],
    to: new Date().toISOString().split("T")[0],
  });

  const [activeTab, setActiveTab] = useState("ALL"); // ALL, LATE, ADJUST

  useEffect(() => {
    if (currentUser?.id) {
      dispatch(fetchDailyRecordsThunk({ ...filter, employeeId: currentUser.id }));
    }
  }, [dispatch, currentUser?.id, filter]);

  const filteredRecords = dailyRecords.filter(r => {
    if (activeTab === "LATE") return r.lateMinutes > 0;
    if (activeTab === "ADJUST") return r.overtimeHours > 0 || r.manualAdjustment;
    return true;
  });

  const summaryStats = {
    present: dailyRecords.filter(r => r.status === 'PRESENT' || r.status === 'LATE' || r.status === 'WFH').length,
    late: dailyRecords.filter(r => r.status === 'LATE').length,
    absent: dailyRecords.filter(r => r.status === 'ABSENT').length,
    totalHours: Math.round(dailyRecords.reduce((acc, r) => acc + (r.workHours || 0), 0) * 10) / 10,
  };

  return (
    <div className="max-w-[1400px] mx-auto p-4 space-y-12 animate-in fade-in duration-700">
      
      {/* Header Profile Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2 text-indigo-600 mb-2">
            <Activity className="w-4 h-4" />
            <span className="text-[10px] font-black uppercase tracking-[0.3em]">Personal Insight</span>
          </div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tighter">Attendance History</h1>
          <p className="text-slate-400 mt-1 font-medium text-sm italic">Historical tracking of your shift engagement and performance metrics.</p>
        </div>

        <div className="bg-white p-2 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-1 group">
          <Calendar className="w-4 h-4 ml-3 text-slate-300 group-focus-within:text-indigo-500 transition-colors" />
          <input 
            type="date" 
            value={filter.from} 
            onChange={(e) => setFilter(f => ({ ...f, from: e.target.value }))}
            className="px-3 py-2 text-[10px] font-black border-none focus:ring-0 text-slate-700 bg-transparent rounded-xl hover:bg-slate-50 cursor-pointer uppercase tracking-tighter"
          />
          <span className="text-slate-200 font-black px-1">→</span>
          <input 
            type="date" 
            value={filter.to} 
            onChange={(e) => setFilter(f => ({ ...f, to: e.target.value }))}
            className="px-3 py-2 text-[10px] font-black border-none focus:ring-0 text-slate-700 bg-transparent rounded-xl hover:bg-slate-50 cursor-pointer uppercase tracking-tighter"
          />
        </div>
      </div>

      {/* Mini Performance Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        {[
          { label: "Stability Rate", value: summaryStats.present, icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50", suffix: " Shifts" },
          { label: "Delayed Logs", value: summaryStats.late, icon: Clock, color: "text-amber-500", bg: "bg-amber-50", suffix: " Records" },
          { label: "Identity Gap", value: summaryStats.absent, icon: XCircle, color: "text-rose-500", bg: "bg-rose-50", suffix: " Days" },
          { label: "Accumulated Work", value: summaryStats.totalHours, icon: FileText, color: "text-indigo-600", bg: "bg-indigo-50", suffix: " Hours" },
        ].map((stat, i) => (
          <div key={i} className="flex flex-col gap-1 p-2">
             <div className="flex items-center gap-2 mb-1">
                <stat.icon size={12} className={stat.color} />
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{stat.label}</span>
             </div>
             <div className="flex items-baseline gap-1">
                <span className="text-4xl font-black text-slate-900 tracking-tighter">{stat.value}</span>
                <span className="text-[9px] font-black text-slate-300 uppercase">{stat.suffix}</span>
             </div>
          </div>
        ))}
      </div>

      {/* Main Content Node */}
      <div className="bg-white rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden min-h-[500px] flex flex-col">
        <div className="p-8 border-b border-slate-50 flex items-center justify-between">
          <div className="flex gap-2 p-1.5 bg-slate-50 rounded-2xl border border-slate-100/50">
            {[
              { id: "ALL", label: "Full Registry" },
              { id: "LATE", label: "Lateness Only" },
              { id: "ADJUST", label: "Financial Syncs" }
            ].map(tab => (
              <button 
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-8 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${
                  activeTab === tab.id 
                    ? "bg-white text-slate-900 shadow-xl shadow-slate-200/50 border border-slate-100" 
                    : "text-slate-400 hover:text-slate-600"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="text-[9px] font-black text-slate-300 uppercase tracking-[0.2em] px-4 py-2 border border-slate-50 rounded-full">
             Records: {filteredRecords.length}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-slate-300 text-[9px] font-black uppercase tracking-[0.3em]">
                <th className="px-10 py-10">Historical Date</th>
                <th className="px-10 py-10">Shift Profile</th>
                <th className="px-10 py-10">Chronology</th>
                <th className="px-10 py-10">Engagement</th>
                <th className="px-10 py-10 text-right">Integrity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-10 py-32 text-center">
                    <div className="flex flex-col items-center justify-center text-slate-100">
                      <History size={60} className="stroke-[1px] mb-6" />
                      <p className="font-black text-slate-300 text-xs uppercase tracking-[0.4em]">Node Data Missing</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredRecords.map((record) => (
                  <tr key={record.id || record._id} className="group hover:bg-slate-50/50 transition-all">
                    <td className="px-10 py-8">
                      <p className="font-black text-slate-900 tracking-tight text-lg leading-none">
                        {new Date(record.date).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                      </p>
                      <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mt-1">
                        {new Date(record.date).toLocaleDateString([], { weekday: 'long' })}
                      </p>
                    </td>
                    <td className="px-10 py-8">
                       <span className="px-3 py-1.5 bg-slate-50 text-slate-500 rounded-lg text-[10px] font-black uppercase tracking-widest border border-slate-100">
                          {record.shiftType || 'Standard'}
                       </span>
                    </td>
                    <td className="px-10 py-8">
                      <div className="flex items-center gap-6">
                        <div className="text-center">
                          <p className="text-[8px] font-black text-slate-300 uppercase mb-1">Entry</p>
                          <p className="text-sm font-black text-slate-700 tracking-tighter">
                            {record.firstCheckIn ? new Date(record.firstCheckIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) : "--:--"}
                          </p>
                        </div>
                        <div className="w-6 h-px bg-slate-100" />
                        <div className="text-center">
                          <p className="text-[8px] font-black text-slate-300 uppercase mb-1">Exit</p>
                          <p className="text-sm font-black text-slate-400 tracking-tighter">
                            {record.lastCheckOut ? new Date(record.lastCheckOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) : "--:--"}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-10 py-8">
                       <div className="flex items-center gap-3">
                          <span className="text-xl font-black text-slate-900 tracking-tighter">{record.workHours}h</span>
                          {record.lateMinutes > 0 && (
                            <span className="text-[10px] font-black text-amber-500 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-100/50">-{record.lateMinutes}m</span>
                          )}
                       </div>
                    </td>
                    <td className="px-10 py-8 text-right">
                       <span className={`px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-wider ${
                         record.status === 'PRESENT' ? 'bg-emerald-50 text-emerald-600' :
                         record.status === 'ABSENT' ? 'bg-rose-50 text-rose-600' :
                         record.status === 'LATE' ? 'bg-amber-50 text-amber-600' :
                         'bg-slate-100 text-slate-500'
                       }`}>
                         {record.status}
                       </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer Branding */}
      <div className="flex items-center justify-between py-10 opacity-30 px-4">
         <div className="flex items-center gap-3">
            <span className="font-black text-slate-900 tracking-tighter text-xl">HRMS <span className="text-indigo-600">PRO</span></span>
            <div className="w-1 h-1 rounded-full bg-slate-300" />
            <span className="text-xs font-bold uppercase tracking-widest text-slate-400 italic">Self-Service Portal</span>
         </div>
         <div className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">Verified Secure Architecture</div>
      </div>
    </div>
  );
};

export default MyAttendancePage;
