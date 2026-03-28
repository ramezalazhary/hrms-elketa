import React, { useState, useEffect } from "react";
import { useAppDispatch, useAppSelector } from "@/shared/hooks/reduxHooks";
import attendanceApi from "../api";
import { 
  FileCheck, 
  Calendar, 
  Search, 
  Download, 
  RefreshCw, 
  AlertCircle, 
  CheckCircle2, 
  TrendingUp, 
  TrendingDown,
  Info
} from "lucide-react";

const PayrollReportsPage = () => {
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchSummary = async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await attendanceApi.getPayrollSummary(month);
      setData(resp.data.employees);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, [month]);

  const stats = [
    { label: "Active Records", value: data.length, icon: FileCheck, color: "text-blue-500", bg: "bg-blue-50" },
    { label: "Avg Attendance", value: Math.round(data.reduce((acc, r) => acc + (r.attendanceScore || 0), 0) / (data.length || 1)) + "%", icon: TrendingUp, color: "text-emerald-500", bg: "bg-emerald-50" },
    { label: "Total Overtime", value: Math.round(data.reduce((acc, r) => acc + (r.overtimeHours || 0), 0)) + "h", icon: CheckCircle2, color: "text-indigo-500", bg: "bg-indigo-50" },
    { label: "Late Minutes", value: Math.round(data.reduce((acc, r) => acc + (r.lateMinutes || 0), 0)) + "m", icon: TrendingDown, color: "text-rose-500", bg: "bg-rose-50" },
  ];

  return (
    <div className="max-w-[1600px] mx-auto p-4 space-y-10">
      <div className="flex flex-col md:flex-row md:items-top justify-between gap-8 pb-10 border-b border-slate-100">
        <div className="max-w-xl">
          <div className="flex items-center gap-2 text-indigo-600 mb-2">
            <FileCheck className="w-5 h-5 font-bold" />
            <span className="text-sm font-black uppercase tracking-widest bg-indigo-50 px-2 py-0.5 rounded">Financial Consolidation</span>
          </div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tighter">Payroll-Ready Summaries</h1>
          <p className="text-slate-500 mt-2 font-medium">Consolidated attendance metrics for salary calculations and performance reviews.</p>
        </div>

        <div className="flex items-center gap-4">
           <div className="relative">
              <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-indigo-400" />
              <input 
                type="month" 
                value={month} 
                onChange={(e) => setMonth(e.target.value)}
                className="pl-12 pr-6 py-4 bg-white border-2 border-slate-100 rounded-[2rem] font-black text-slate-800 transition-all focus:ring-4 focus:ring-indigo-50 hover:border-indigo-200 cursor-pointer text-sm"
              />
           </div>
           
           <button onClick={fetchSummary} className="p-4 bg-white border-2 border-slate-100 rounded-3xl hover:bg-slate-50 hover:border-slate-200 transition-all">
              <RefreshCw className={`w-5 h-5 text-slate-500 ${loading ? "animate-spin" : ""}`} />
           </button>
           
           <button className="flex items-center gap-2 px-8 py-4 bg-slate-900 border-none rounded-[2rem] text-white font-black hover:bg-black transition-all hover:translate-y-[-4px] shadow-xl text-xs uppercase tracking-widest">
              <Download className="w-4 h-4" /> Export Batch
           </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {stats.map((stat, i) => (
          <div key={i} className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm relative overflow-hidden group">
            <div className={`p-4 rounded-2xl ${stat.bg} ${stat.color} absolute top-8 right-8 transition-transform group-hover:scale-110`}>
              <stat.icon className="w-6 h-6" />
            </div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">{stat.label}</p>
            <h3 className="text-3xl font-black text-slate-900 tracking-tighter">{stat.value}</h3>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-[3rem] border border-slate-100 shadow-lg overflow-hidden relative border-t-8 border-t-indigo-600">
        <div className="p-8 border-b border-slate-100 flex items-center justify-between">
           <div className="relative w-96 group">
             <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
             <input type="text" placeholder="Filter by Employee, Dept or ID..." className="w-full pl-12 pr-6 py-3 bg-slate-50 border-none rounded-2xl text-sm font-bold focus:ring-4 focus:ring-indigo-50 transition-all" />
           </div>
           <div className="flex gap-2 text-xs font-black uppercase tracking-widest">
              <span className="flex items-center gap-1.5 text-blue-500 bg-blue-50 px-3 py-1.5 rounded-xl border border-blue-100">
                <Info className="w-3 h-3" /> Data Immutable
              </span>
           </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 text-slate-400 text-[10px] font-black uppercase tracking-[0.2em]">
                <th className="px-8 py-5">Employee Context</th>
                <th className="px-8 py-5">Presence Profile</th>
                <th className="px-8 py-5">Work Hours</th>
                <th className="px-8 py-5">Compensation Add/Sub</th>
                <th className="px-8 py-5">Performance Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.map((row) => (
                <tr key={row.employeeId} className="hover:bg-indigo-50/30 transition-colors group">
                  <td className="px-8 py-8">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-[1.25rem] bg-indigo-50 flex items-center justify-center font-black text-indigo-400 text-sm">{row.employeeCode?.slice(-2)}</div>
                      <div>
                        <p className="font-extrabold text-slate-900 tracking-tight">{row.employeeName}</p>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">{row.department} . CID: {row.employeeCode}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-8">
                    <div className="flex items-center gap-4">
                       <div className="text-center">
                          <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Present</span>
                          <span className="font-black text-slate-800 text-lg">{row.totalWorkHours ? Math.round(row.totalWorkHours / 8) : 0}d</span>
                       </div>
                       <div className="w-px h-8 bg-slate-100"></div>
                       <div className="text-center">
                          <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Absent</span>
                          <span className={`${row.absentDays > 0 ? "text-rose-500" : "text-slate-300"} font-black text-lg`}>{row.absentDays}d</span>
                       </div>
                    </div>
                  </td>
                  <td className="px-8 py-8">
                    <div className="flex items-center gap-3">
                      <span className="font-black text-slate-800 text-lg tracking-tighter">{row.totalWorkHours}h</span>
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></div>
                    </div>
                  </td>
                  <td className="px-8 py-8">
                    <div className="space-y-1.5 flex flex-col">
                       {row.approvedOvertimeHours > 0 && (
                        <div className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg w-max border border-emerald-100">
                            <TrendingUp className="w-3 h-3" /> OT: +{row.approvedOvertimeHours}h
                        </div>
                       )}
                       {row.totalLateDeductionDays > 0 && (
                        <div className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-amber-600 bg-amber-50 px-2.5 py-1 rounded-lg w-max border border-amber-100 shadow-sm">
                            <TrendingDown className="w-3 h-3" /> Late: -{row.totalLateDeductionDays}d
                        </div>
                       )}
                       {row.totalAbsentDeductionDays > 0 && (
                        <div className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-rose-600 bg-rose-50 px-2.5 py-1 rounded-lg w-max border border-rose-100 shadow-sm">
                            <TrendingDown className="w-3 h-3" /> Absence: -{row.totalAbsentDeductionDays}d
                        </div>
                       )}
                       {!row.approvedOvertimeHours && !row.totalLateDeductionDays && !row.totalAbsentDeductionDays && (
                        <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest italic">Stable Identity</span>
                       )}
                    </div>
                  </td>
                  <td className="px-8 py-8">
                    <div className="flex items-center gap-4">
                       <div className="flex-1 max-w-[120px] h-2.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className={`h-full transition-all duration-1000 ${
                            row.attendanceScore > 90 ? "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.4)]" :
                            row.attendanceScore > 75 ? "bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.4)]" :
                            "bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.4)]"
                          }`} style={{ width: `${row.attendanceScore}%` }}></div>
                       </div>
                       <span className="font-black text-slate-900 text-lg">{row.attendanceScore}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default PayrollReportsPage;
