import React, { useEffect, useState } from "react";
import { useAppDispatch, useAppSelector } from "@/shared/hooks/reduxHooks";
import { 
  fetchPoliciesThunk, 
  createPolicyThunk, 
  updatePolicyThunk, 
  deletePolicyThunk 
} from "../store";
import { 
  Settings, 
  Plus, 
  RotateCcw, 
  Clock, 
  Moon, 
  Layers, 
  Edit2, 
  Trash2,
  AlertCircle,
  ShieldCheck,
  Zap
} from "lucide-react";
import { PolicyModal } from "../components/PolicyModal";

/**
 * PoliciesPage - High-Performance Attendance Policy Management
 * Allows admins to define shift rules, grace periods, and targeting logic.
 */
const PoliciesPage = () => {
  const dispatch = useAppDispatch();
  const { policies, loading } = useAppSelector((state) => state.attendance);
  
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState(null);

  useEffect(() => {
    dispatch(fetchPoliciesThunk());
  }, [dispatch]);

  const handleSave = async (data) => {
    if (editingPolicy) {
      await dispatch(updatePolicyThunk({ id: editingPolicy.id || editingPolicy._id, data }));
    } else {
      await dispatch(createPolicyThunk(data));
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to delete this policy? This action cannot be undone.")) {
      await dispatch(deletePolicyThunk(id));
    }
  };

  const getShiftIcon = (type) => {
    switch(type) {
      case 'NIGHT': return <Moon className="w-5 h-5 text-indigo-400 group-hover:scale-125 transition-transform" />;
      case 'SPLIT': return <Layers className="w-5 h-5 text-blue-400 group-hover:scale-125 transition-transform" />;
      case 'FLEXIBLE': return <RotateCcw className="w-5 h-5 text-emerald-400 group-hover:scale-125 transition-transform" />;
      default: return <Clock className="w-5 h-5 text-amber-400 group-hover:scale-125 transition-transform" />;
    }
  };

  return (
    <div className="space-y-12 p-4 max-w-[1400px] mx-auto min-h-screen pb-20">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 pt-4">
        <div className="space-y-2">
          <div className="flex items-center gap-3 text-indigo-600 mb-1">
            <div className="p-1.5 bg-indigo-50 rounded-lg">
              <Zap size={16} className="fill-indigo-600" />
            </div>
            <span className="text-[10px] font-black uppercase tracking-[0.3em]">Operational Core</span>
          </div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tighter">Attendance Policies</h1>
          <p className="text-slate-500 font-medium text-sm max-w-xl leading-relaxed">
            Centralized management for shifts, overtime thresholds, and grace periods. These rules directly impact payroll calculations.
          </p>
        </div>

        <button 
          onClick={() => { setEditingPolicy(null); setModalOpen(true); }}
          className="flex items-center justify-center gap-3 px-8 py-5 bg-indigo-600 rounded-[2rem] text-white font-black hover:bg-indigo-700 transition-all hover:translate-y-[-4px] shadow-2xl shadow-indigo-200 uppercase tracking-widest text-[11px] group"
        >
          <div className="p-1 bg-white/20 rounded-md group-hover:rotate-90 transition-transform">
             <Plus className="w-4 h-4" strokeWidth={3} />
          </div>
          Create Policy
        </button>
      </div>

      {/* Policies Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {policies.map((policy) => (
          <div key={policy.id || policy._id} className="group flex flex-col bg-white border border-slate-100/50 rounded-[2.5rem] p-9 shadow-sm hover:shadow-2xl hover:border-slate-200 transition-all relative overflow-hidden">
            
            {/* Status indicators */}
            <div className="flex items-center justify-between mb-8">
               <div className="p-4 bg-slate-50 rounded-2xl group-hover:bg-indigo-50 transition-colors border border-slate-100/50 group-hover:border-indigo-100">
                  {getShiftIcon(policy.shiftType)}
               </div>
               {policy.isDefault ? (
                 <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full border border-emerald-100">
                    <ShieldCheck size={12} fill="currentColor" className="text-emerald-100" />
                    <span className="text-[9px] font-black uppercase tracking-wider">Default</span>
                 </div>
               ) : (
                 <div className="px-3 py-1 bg-slate-50 text-slate-400 rounded-full border border-slate-100">
                    <span className="text-[9px] font-black uppercase tracking-wider">{policy.targeting?.type || 'Targeted'}</span>
                 </div>
               )}
            </div>

            <div className="mb-6">
              <h3 className="text-2xl font-black text-slate-900 tracking-tighter mb-2 group-hover:text-indigo-600 transition-colors">{policy.name}</h3>
              <p className="text-sm font-medium text-slate-400 line-clamp-2 leading-relaxed h-10 italic">
                {policy.description || 'No description provided.'}
              </p>
            </div>

            {/* Metrics Section */}
            <div className="grid grid-cols-2 gap-px bg-slate-100 rounded-3xl overflow-hidden mb-9 border border-slate-100 shadow-inner">
               <div className="bg-white p-5 flex flex-col items-center">
                  <span className="text-[9px] font-black text-slate-300 uppercase tracking-[0.2em] mb-1">Shift Start</span>
                  <span className="text-lg font-black text-slate-700 tracking-tighter">{policy.workStartTime}</span>
               </div>
               <div className="bg-white p-5 flex flex-col items-center border-l border-slate-100">
                  <span className="text-[9px] font-black text-slate-300 uppercase tracking-[0.2em] mb-1">Shift End</span>
                  <span className="text-lg font-black text-slate-700 tracking-tighter">{policy.workEndTime}</span>
               </div>
               <div className="bg-white p-5 flex flex-col items-center border-t border-slate-100">
                  <span className="text-[9px] font-black text-slate-300 uppercase tracking-[0.2em] mb-1">Grace Min</span>
                  <span className="text-lg font-black text-amber-500 tracking-tighter">{policy.graceMinutes}m</span>
               </div>
               <div className="bg-white p-5 flex flex-col items-center border-l border-t border-slate-100">
                  <span className="text-[9px] font-black text-slate-300 uppercase tracking-[0.2em] mb-1">Min Hrs</span>
                  <span className="text-lg font-black text-indigo-500 tracking-tighter">{policy.minHoursForPresent}h</span>
               </div>
            </div>

            {/* Dynamic Days Indicator */}
            <div className="flex gap-1 mb-10 overflow-hidden">
               {['S','M','T','W','T','F','S'].map((d, i) => (
                  <div key={i} className={`flex-1 text-center py-2 rounded-lg text-[9px] font-black uppercase transition-all ${
                    policy.workingDays?.includes(i) ? "bg-slate-950 text-white" : "bg-slate-50 text-slate-300"
                  }`}>
                    {d}
                  </div>
               ))}
            </div>

            {/* Footer Actions */}
            <div className="flex justify-between items-center pt-8 border-t border-slate-50 mt-auto">
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => { setEditingPolicy(policy); setModalOpen(true); }}
                  className="p-3.5 bg-slate-50 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-2xl transition-all shadow-sm"
                  title="Edit Policy"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => handleDelete(policy.id || policy._id)}
                  className={`p-3.5 bg-slate-50 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-2xl transition-all shadow-sm ${policy.isDefault ? "opacity-0 invisible" : ""}`}
                  title="Delete Policy"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <div className="text-[9px] font-black uppercase tracking-[0.1em] text-slate-300 bg-slate-50 px-3 py-1 rounded-full">ID: {(policy.id || policy._id).slice(-4)}</div>
            </div>
          </div>
        ))}

        {/* Empty / Add More Placeholder */}
        <div 
          onClick={() => { setEditingPolicy(null); setModalOpen(true); }}
          className="group flex flex-col items-center justify-center bg-white border-2 border-dashed border-slate-200 rounded-[2.5rem] p-12 text-center hover:bg-slate-50 hover:border-indigo-300 transition-all cursor-pointer shadow-sm hover:shadow-xl"
        >
          <div className="p-6 bg-slate-50 rounded-[2rem] mb-5 shadow-sm group-hover:bg-white group-hover:scale-110 group-hover:shadow-lg transition-all border border-transparent group-hover:border-indigo-100">
             <Plus className="w-10 h-10 text-slate-300 group-hover:text-indigo-500 transition-colors" />
          </div>
          <h4 className="font-black text-slate-400 uppercase tracking-[0.2em] text-xs">Define Custom Rule</h4>
          <p className="text-[10px] text-slate-300 mt-2 font-bold italic group-hover:text-slate-400 transition-colors max-w-[150px]">Target specific Departments, Teams or Individuals</p>
        </div>
      </div>

      <PolicyModal 
        isOpen={modalOpen} 
        onClose={() => setModalOpen(false)} 
        onSave={handleSave} 
        initialData={editingPolicy} 
      />

      {/* Footer Info */}
      <div className="flex items-center justify-center gap-4 text-slate-300 mt-20">
         <div className="w-12 h-px bg-slate-100" />
         <AlertCircle size={14} />
         <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Policies are evaluated in order of specificity</span>
         <div className="w-12 h-px bg-slate-100" />
      </div>
    </div>
  );
};

export default PoliciesPage;
