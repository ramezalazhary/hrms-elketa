import React from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, TrendingUp, AlertCircle, ArrowRight, ShieldCheck, Zap } from 'lucide-react';

export function DashboardAlerts({ alerts }) {
  if (!alerts) return null;
  
  const { idExpiredCount, idExpirySoon, salaryIncreaseSoon } = alerts;
  const hasAlerts = idExpiredCount > 0 || idExpirySoon > 0 || salaryIncreaseSoon > 0;

  if (!hasAlerts) {
    return (
      <div className="mb-8 p-6 rounded-xl border border-emerald-100 bg-emerald-50/30 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="h-10 w-10 rounded-full bg-emerald-500 flex items-center justify-center text-white shadow-sm">
            <ShieldCheck size={20} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-emerald-900">System Fully Compliant</h3>
            <p className="text-xs text-emerald-700/70 mt-0.5">All personnel records are up to date. Continuous monitoring active.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-10 space-y-4">
      <div className="flex items-center gap-2 px-1">
        <div className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse" />
        <h2 className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Operational Alerts</h2>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {/* CRITICAL: Expired IDs */}
        {idExpiredCount > 0 && (
          <div className="group relative overflow-hidden rounded-xl border border-zinc-200 border-l-[6px] border-l-rose-500 bg-white p-5 shadow-sm transition-all hover:shadow-md">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-50 text-rose-600">
                  <AlertTriangle size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-zinc-900 tracking-tight">Identity Compliance</h3>
                  <p className="mt-1 text-xs text-zinc-500 font-medium">Expired documents detected.</p>
                  <Link 
                    to="/employees?idExpired=true" 
                    className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold text-rose-600 hover:text-rose-700 transition-colors"
                  >
                    Fix Issues <ArrowRight size={14} />
                  </Link>
                </div>
              </div>
              <div className="text-right">
                <span className="text-2xl font-black text-rose-600 tabular-nums leading-none tracking-tighter">
                  {idExpiredCount}
                </span>
                <p className="text-[8px] font-black uppercase tracking-tighter text-rose-300 mt-1">Overdue</p>
              </div>
            </div>
          </div>
        )}

        {/* WARNING: Expiring Soon */}
        {idExpirySoon > 0 && (
          <div className="group relative overflow-hidden rounded-xl border border-zinc-200 border-l-[6px] border-l-amber-500 bg-white p-5 shadow-sm transition-all hover:shadow-md">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-600">
                  <AlertCircle size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-zinc-900 tracking-tight">Renewal Notification</h3>
                  <p className="mt-1 text-xs text-zinc-500 font-medium">Expiring within 60 days.</p>
                  <Link 
                    to="/employees?idExpiringSoon=true" 
                    className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold text-amber-600 hover:text-amber-700 transition-colors"
                  >
                    Review <ArrowRight size={14} />
                  </Link>
                </div>
              </div>
              <div className="text-right">
                <span className="text-2xl font-black text-amber-600 tabular-nums leading-none tracking-tighter">
                  {idExpirySoon}
                </span>
                <p className="text-[8px] font-black uppercase tracking-tighter text-amber-300 mt-1">Pending</p>
              </div>
            </div>
          </div>
        )}

        {/* INFO: Salary Cycle */}
        {salaryIncreaseSoon > 0 && (
          <div className="group relative overflow-hidden rounded-xl border border-zinc-200 border-l-[6px] border-l-indigo-500 bg-white p-5 shadow-sm transition-all hover:shadow-md">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
                  <TrendingUp size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-zinc-900 tracking-tight">Compensation Cycle</h3>
                  <p className="mt-1 text-xs text-zinc-500 font-medium">Annual adjustment window.</p>
                  <Link 
                    to="/employees?salaryIncreaseFrom=today" 
                    className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-700 transition-colors"
                  >
                    Process <ArrowRight size={14} />
                  </Link>
                </div>
              </div>
              <div className="text-right">
                <span className="text-2xl font-black text-indigo-600 tabular-nums leading-none tracking-tighter">
                  {salaryIncreaseSoon}
                </span>
                <p className="text-[8px] font-black uppercase tracking-tighter text-indigo-300 mt-1">Available</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
