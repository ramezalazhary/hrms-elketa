import React, { useEffect, useState } from "react";
import { useAppDispatch, useAppSelector } from "@/shared/hooks/reduxHooks";
import { fetchEventsThunk } from "../store";
import { Database, Search, Filter, Ban, RefreshCw, FileText } from "lucide-react";

const EventsLogPage = () => {
  const dispatch = useAppDispatch();
  const { events, loading } = useAppSelector((state) => state.attendance);
  const [params, setParams] = useState({ limit: 100 });

  useEffect(() => {
    dispatch(fetchEventsThunk(params));
  }, [dispatch, params]);

  return (
    <div className="space-y-6 p-2 max-w-[1600px] mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Database className="w-6 h-6 text-blue-500" />
            Raw Event Log
          </h1>
          <p className="text-slate-500 text-sm font-medium">Immutable audit trail of all check-in/out signals.</p>
        </div>

        <div className="flex gap-2">
          <button className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-lg text-sm font-bold text-slate-700 bg-white hover:bg-slate-50 transition-all">
             <Filter className="w-4 h-4" /> Filter By Machine
          </button>
          <button onClick={() => dispatch(fetchEventsThunk(params))} className="p-2 border border-slate-200 rounded-lg bg-white hover:bg-slate-50 transition-all">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden border-t-4 border-t-blue-500">
        <div className="p-4 border-b border-slate-50 bg-slate-50/50">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search by Employee Code or Device ID..." 
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 transition-all font-medium"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] bg-slate-50/10">
                <th className="px-6 py-4">Timestamp</th>
                <th className="px-6 py-4">Employee</th>
                <th className="px-6 py-4">Event Type</th>
                <th className="px-6 py-4">Source</th>
                <th className="px-6 py-4">Machine/Device</th>
                <th className="px-6 py-4">Metadata</th>
                <th className="px-6 py-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 italic font-mono text-xs">
              {events.map((event) => (
                <tr key={event.id} className={`hover:bg-slate-50 transition-colors ${event.isVoided ? "opacity-50 grayscale" : ""}`}>
                  <td className="px-6 py-4 text-slate-500">{new Date(event.timestamp).toLocaleString()}</td>
                  <td className="px-6 py-4">
                    <span className="font-bold text-slate-800">{event.employeeCode}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-0.5 rounded font-black text-[9px] ${
                      event.eventType.includes('CHECK_IN') ? "bg-emerald-500/10 text-emerald-600" :
                      event.eventType.includes('CHECK_OUT') ? "bg-blue-500/10 text-blue-600" :
                      "bg-amber-500/10 text-amber-600"
                    }`}>
                      {event.eventType}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-400 font-bold tracking-tighter uppercase">{event.source}</td>
                  <td className="px-6 py-4 text-slate-600 font-bold">{event.deviceId || "WEB_SVC_01"}</td>
                  <td className="px-6 py-4 overflow-hidden max-w-[150px] truncate text-slate-300">
                    {JSON.stringify(event.rawPayload || "{}")}
                  </td>
                  <td className="px-6 py-4 text-center">
                    {event.isVoided ? (
                      <span className="flex items-center justify-center gap-1 text-rose-500 font-black tracking-widest uppercase text-[9px]">
                        <Ban className="w-3 h-3" /> VOIDED
                      </span>
                    ) : (
                      <span className="text-emerald-500 font-black tracking-widest uppercase text-[9px]">ACTIVE</span>
                    )}
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

export default EventsLogPage;
