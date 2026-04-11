import React from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, TrendingUp, AlertCircle, ArrowRight, ShieldCheck, Zap } from 'lucide-react';

export function DashboardAlerts({ alerts }) {
  if (!alerts) return null;
  
  const { idExpiredCount, idExpirySoon, salaryIncreaseSoon } = alerts;
  const hasAlerts = idExpiredCount > 0 || idExpirySoon > 0 || salaryIncreaseSoon > 0;

  if (!hasAlerts) {
    return (
      <div className="mb-10 p-8 rounded-3xl border border-white/20 glass-premium shadow-premium flex items-center justify-between relative overflow-hidden group">
        <div className="absolute top-0 right-0 -mr-8 -mt-8 h-32 w-32 rounded-full bg-emerald-500/5 blur-2xl group-hover:bg-emerald-500/10 transition-colors" />
        <div className="flex items-center gap-6 relative z-10">
          <div className="h-14 w-14 rounded-2xl bg-emerald-600 flex items-center justify-center text-white shadow-lg shadow-emerald-200 transition-transform group-hover:scale-110">
            <ShieldCheck size={28} />
          </div>
          <div>
            <h3 className="text-lg font-black text-slate-900 tracking-tight">System Fully Compliant</h3>
            <p className="text-sm text-slate-500 font-medium mt-0.5">All personnel records are up to date. Continuous monitoring active.</p>
          </div>
        </div>
        <div className="hidden md:block px-4 py-2 bg-emerald-50 rounded-full border border-emerald-100">
           <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Verified</span>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-12 space-y-5">
      <div className="flex items-center gap-3 px-1">
        <div className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
        <h2 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Institutional Operational Alerts</h2>
      </div>

      <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
        {/* CRITICAL: Expired IDs */}
        {idExpiredCount > 0 && (
          <div className="group relative overflow-hidden rounded-3xl border border-white/20 glass-premium p-6 shadow-premium hover-lift transition-all hover:border-rose-100">
            <div className="absolute top-0 right-0 -mr-6 -mt-6 h-16 w-16 rounded-full bg-rose-500/5 blur-xl group-hover:bg-rose-500/10 transition-colors" />
            <div className="flex items-start justify-between relative z-10">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-rose-600 text-white shadow-lg shadow-rose-200 group-hover:scale-110 transition-transform">
                  <AlertTriangle size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 tracking-tight">Identity Compliance</h3>
                  <p className="mt-1 text-xs text-slate-500 font-semibold">Expired documents detected.</p>
                  <Link 
                    to="/employees?idExpired=true" 
                    className="mt-6 inline-flex items-center gap-2 px-3 py-1.5 bg-rose-50 text-rose-600 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-rose-100 transition-colors"
                  >
                    Fix Issues <ArrowRight size={12} className="group-hover:translate-x-1 transition-transform" />
                  </Link>
                </div>
              </div>
              <div className="text-right">
                <span className="text-3xl font-black text-rose-600 tabular-nums leading-none tracking-tighter">
                  {idExpiredCount}
                </span>
                <p className="text-[8px] font-black uppercase tracking-widest text-rose-400 mt-2">Overdue</p>
              </div>
            </div>
          </div>
        )}

        {/* WARNING: Expiring Soon */}
        {idExpirySoon > 0 && (
          <div className="group relative overflow-hidden rounded-3xl border border-white/20 glass-premium p-6 shadow-premium hover-lift transition-all hover:border-amber-100">
            <div className="absolute top-0 right-0 -mr-6 -mt-6 h-16 w-16 rounded-full bg-amber-500/5 blur-xl group-hover:bg-amber-500/10 transition-colors" />
            <div className="flex items-start justify-between relative z-10">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-500 text-white shadow-lg shadow-amber-200 group-hover:scale-110 transition-transform">
                  <AlertCircle size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 tracking-tight">Renewal Notification</h3>
                  <p className="mt-1 text-xs text-slate-500 font-semibold">Expiring within 60 days.</p>
                  <Link 
                    to="/employees?idExpiringSoon=true" 
                    className="mt-6 inline-flex items-center gap-2 px-3 py-1.5 bg-amber-50 text-amber-600 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-amber-100 transition-colors"
                  >
                    Review <ArrowRight size={12} className="group-hover:translate-x-1 transition-transform" />
                  </Link>
                </div>
              </div>
              <div className="text-right">
                <span className="text-3xl font-black text-amber-600 tabular-nums leading-none tracking-tighter">
                  {idExpirySoon}
                </span>
                <p className="text-[8px] font-black uppercase tracking-widest text-amber-400 mt-2">Pending</p>
              </div>
            </div>
          </div>
        )}

        {/* INFO: Salary Cycle */}
        {salaryIncreaseSoon > 0 && (
          <div className="group relative overflow-hidden rounded-3xl border border-white/20 glass-premium p-6 shadow-premium hover-lift transition-all hover:border-indigo-100">
            <div className="absolute top-0 right-0 -mr-6 -mt-6 h-16 w-16 rounded-full bg-indigo-500/5 blur-xl group-hover:bg-indigo-500/10 transition-colors" />
            <div className="flex items-start justify-between relative z-10">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-200 group-hover:scale-110 transition-transform">
                  <TrendingUp size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 tracking-tight">Compensation Cycle</h3>
                  <p className="mt-1 text-xs text-slate-500 font-semibold">Annual adjustment window.</p>
                  <Link 
                    to="/employees?salaryIncreaseFrom=today" 
                    className="mt-6 inline-flex items-center gap-2 px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-indigo-100 transition-colors"
                  >
                    Process <ArrowRight size={12} className="group-hover:translate-x-1 transition-transform" />
                  </Link>
                </div>
              </div>
              <div className="text-right">
                <span className="text-3xl font-black text-indigo-600 tabular-nums leading-none tracking-tighter">
                  {salaryIncreaseSoon}
                </span>
                <p className="text-[8px] font-black uppercase tracking-widest text-indigo-400 mt-2">Available</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
