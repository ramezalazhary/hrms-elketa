import React, { useState, useEffect } from "react";
import { X, Save, Clock, Calendar, Shield, Info, Users, Briefcase, User, Plus } from "lucide-react";

export const PolicyModal = ({ isOpen, onClose, onSave, initialData = null }) => {
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    shiftType: "STANDARD",
    workStartTime: "09:00",
    workEndTime: "17:00",
    graceMinutes: 15,
    minHoursForHalfDay: 4,
    minHoursForPresent: 6,
    isDefault: false,
    workingDays: [1, 2, 3, 4, 5], // Mon-Fri
    lateDeductionRules: [], // [{ fromMinutes, toMinutes, deductionValue, deductionUnit }]
    targeting: {
      type: "GLOBAL",
      targetId: null
    }
  });

  useEffect(() => {
    if (initialData) {
      setFormData({
        ...initialData,
        workingDays: initialData.workingDays || [1, 2, 3, 4, 5],
        lateDeductionRules: initialData.lateDeductionRules || [],
        targeting: initialData.targeting || { type: "GLOBAL", targetId: null }
      });
    } else {
      setFormData({
        name: "",
        description: "",
        shiftType: "STANDARD",
        workStartTime: "09:00",
        workEndTime: "17:00",
        graceMinutes: 15,
        minHoursForHalfDay: 4,
        minHoursForPresent: 6,
        isDefault: false,
        workingDays: [1, 2, 3, 4, 5],
        lateDeductionRules: [],
        targeting: { type: "GLOBAL", targetId: null }
      });
    }
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
    onClose();
  };

  const addDeductionRule = () => {
    setFormData(prev => ({
      ...prev,
      lateDeductionRules: [
        ...prev.lateDeductionRules,
        { fromMinutes: 16, toMinutes: 30, deductionValue: 0.25, deductionUnit: "DAYS" }
      ]
    }));
  };

  const removeDeductionRule = (index) => {
    setFormData(prev => ({
      ...prev,
      lateDeductionRules: prev.lateDeductionRules.filter((_, i) => i !== index)
    }));
  };

  const updateRule = (index, field, value) => {
    setFormData(prev => {
      const newRules = [...prev.lateDeductionRules];
      newRules[index] = { ...newRules[index], [field]: value };
      return { ...prev, lateDeductionRules: newRules };
    });
  };

  const toggleDay = (day) => {
    setFormData(prev => ({
      ...prev,
      workingDays: prev.workingDays.includes(day)
        ? prev.workingDays.filter(d => d !== day)
        : [...prev.workingDays, day]
    }));
  };

  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative bg-white w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-[2.5rem] shadow-2xl border border-slate-100 flex flex-col no-scrollbar">
        {/* Header */}
        <div className="p-8 border-b border-slate-50 flex items-center justify-between sticky top-0 bg-white z-10">
          <div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tighter">
              {initialData ? "Edit Policy" : "Create Attendance Policy"}
            </h2>
            <p className="text-slate-500 text-sm font-medium">Define rules for work hours and attendance logic.</p>
          </div>
          <button onClick={onClose} className="p-3 hover:bg-slate-100 rounded-2xl transition-all text-slate-400">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-8">
          {/* General Info */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 text-indigo-600 mb-4">
               <Info size={18} />
               <h3 className="text-xs font-black uppercase tracking-widest">Policy Identity</h3>
            </div>
            <div className="grid grid-cols-1 gap-6">
              <input
                type="text"
                placeholder="Policy Name (e.g., Night Shift - Tech Team)"
                className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 transition-all placeholder:text-slate-300"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                required
              />
              <textarea
                placeholder="Detailed description of when this policy applies..."
                className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 transition-all min-h-[100px] placeholder:text-slate-300"
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
              />
            </div>
          </section>

          {/* Configuration Grid */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 text-amber-500 mb-4">
               <Clock size={18} />
               <h3 className="text-xs font-black uppercase tracking-widest">Shift Parameters</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider ml-4">Shift Type</label>
                <select
                  className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 appearance-none"
                  value={formData.shiftType}
                  onChange={(e) => setFormData({...formData, shiftType: e.target.value})}
                >
                  <option value="STANDARD">Standard Shift</option>
                  <option value="NIGHT">Night Shift</option>
                  <option value="SPLIT">Split Shift</option>
                  <option value="FLEXIBLE">Flexible Hours</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider ml-4">Grace Minutes</label>
                <input
                  type="number"
                  className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500"
                  value={formData.graceMinutes}
                  onChange={(e) => setFormData({...formData, graceMinutes: parseInt(e.target.value)})}
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider ml-4">Start Time</label>
                <input
                  type="time"
                  className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500"
                  value={formData.workStartTime}
                  onChange={(e) => setFormData({...formData, workStartTime: e.target.value})}
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider ml-4">End Time</label>
                <input
                  type="time"
                  className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500"
                  value={formData.workEndTime}
                  onChange={(e) => setFormData({...formData, workEndTime: e.target.value})}
                />
              </div>
            </div>
          </section>

          {/* Working Days */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 text-emerald-500 mb-4">
               <Calendar size={18} />
               <h3 className="text-xs font-black uppercase tracking-widest">Schedule Setup</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {days.map((day, idx) => (
                <button
                  key={day}
                  type="button"
                  onClick={() => toggleDay(idx)}
                  className={`flex-1 min-w-[60px] py-3 rounded-xl text-xs font-black transition-all ${
                    formData.workingDays.includes(idx)
                      ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20"
                      : "bg-slate-50 text-slate-400 hover:bg-slate-100"
                  }`}
                >
                  {day}
                </button>
              ))}
            </div>
          </section>

          {/* Financial Deductions */}
          <section className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-rose-500">
                <Shield size={18} />
                <h3 className="text-xs font-black uppercase tracking-widest">Financial Penalties (Lateness)</h3>
              </div>
              <button
                type="button"
                onClick={addDeductionRule}
                className="flex items-center gap-2 px-4 py-2 bg-rose-50 text-rose-600 rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-rose-100 transition-all"
              >
                <Plus size={14} /> Add Rung
              </button>
            </div>

            <div className="space-y-3">
              {formData.lateDeductionRules.length === 0 ? (
                <div className="p-8 border-2 border-dashed border-slate-100 rounded-[2rem] text-center">
                  <p className="text-xs font-bold text-slate-300 italic">No deduction rungs defined. Lateness will not trigger automatic deductions.</p>
                </div>
              ) : (
                formData.lateDeductionRules.map((rule, idx) => (
                  <div key={idx} className="flex flex-wrap md:flex-nowrap items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100 group">
                    <div className="flex-1 space-y-1">
                      <label className="text-[8px] font-black uppercase text-slate-400 ml-2">From (Min)</label>
                      <input
                        type="number"
                        className="w-full px-3 py-2 bg-white border border-slate-100 rounded-lg font-bold text-xs"
                        value={rule.fromMinutes}
                        onChange={(e) => updateRule(idx, "fromMinutes", parseInt(e.target.value))}
                      />
                    </div>
                    <div className="flex-1 space-y-1">
                      <label className="text-[8px] font-black uppercase text-slate-400 ml-2">To (Min)</label>
                      <input
                        type="number"
                        className="w-full px-3 py-2 bg-white border border-slate-100 rounded-lg font-bold text-xs"
                        value={rule.toMinutes}
                        onChange={(e) => updateRule(idx, "toMinutes", parseInt(e.target.value))}
                      />
                    </div>
                    <div className="flex-1 space-y-1">
                      <label className="text-[8px] font-black uppercase text-slate-400 ml-2">Deduct Value</label>
                      <input
                        type="number"
                        step="0.01"
                        className="w-full px-3 py-2 bg-white border border-slate-100 rounded-lg font-bold text-xs"
                        value={rule.deductionValue}
                        onChange={(e) => updateRule(idx, "deductionValue", parseFloat(e.target.value))}
                      />
                    </div>
                    <div className="flex-1 space-y-1 min-w-[100px]">
                      <label className="text-[8px] font-black uppercase text-slate-400 ml-2">Unit</label>
                      <select
                        className="w-full px-3 py-2 bg-white border border-slate-100 rounded-lg font-bold text-xs appearance-none"
                        value={rule.deductionUnit}
                        onChange={(e) => updateRule(idx, "deductionUnit", e.target.value)}
                      >
                        <option value="DAYS">Days</option>
                        <option value="HOURS">Hours</option>
                        <option value="MINUTES">Minutes</option>
                      </select>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeDeductionRule(idx)}
                      className="mt-4 md:mt-0 p-2 text-slate-300 hover:text-rose-500 transition-colors"
                    >
                      <X size={18} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* Targeting */}
          <section className="space-y-4">
             <div className="flex items-center gap-2 text-rose-500 mb-4">
                <Shield size={18} />
                <h3 className="text-xs font-black uppercase tracking-widest">Policy Scope</h3>
             </div>
             <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {['GLOBAL', 'DEPARTMENT', 'TEAM', 'INDIVIDUAL'].map(type => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setFormData({...formData, targeting: {...formData.targeting, type}})}
                    className={`p-4 rounded-2xl flex flex-col items-center gap-2 border-2 transition-all ${
                      formData.targeting.type === type 
                        ? "border-indigo-600 bg-indigo-50 text-indigo-600" 
                        : "border-slate-50 bg-slate-50 text-slate-400"
                    }`}
                  >
                    {type === 'GLOBAL' && <Shield size={20} />}
                    {type === 'DEPARTMENT' && <Briefcase size={20} />}
                    {type === 'TEAM' && <Users size={20} />}
                    {type === 'INDIVIDUAL' && <User size={20} />}
                    <span className="text-[8px] font-black uppercase">{type === 'INDIVIDUAL' ? 'Personal' : type}</span>
                  </button>
                ))}
             </div>
          </section>

          {/* Default Toggle */}
          <div className="flex items-center justify-between p-6 bg-slate-900 border border-slate-800 rounded-3xl text-white">
             <div>
               <h4 className="font-black tracking-tighter">System Default</h4>
               <p className="text-[10px] text-slate-400">Apply this to all users not covered by other policies.</p>
             </div>
             <button
               type="button"
               onClick={() => setFormData({...formData, isDefault: !formData.isDefault})}
               className={`w-12 h-6 rounded-full relative transition-colors ${formData.isDefault ? "bg-emerald-500" : "bg-slate-700"}`}
             >
                <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${formData.isDefault ? "left-7" : "left-1"}`} />
             </button>
          </div>

          {/* Action Footer */}
          <div className="flex gap-4 pt-8">
            <button 
              type="button" 
              onClick={onClose}
              className="flex-1 px-6 py-5 bg-slate-50 rounded-2xl font-black text-slate-500 hover:bg-slate-100 transition-all uppercase tracking-widest text-xs"
            >
              Discard Changes
            </button>
            <button 
              type="submit"
              className="flex-[2] px-6 py-5 bg-indigo-600 rounded-2xl font-black text-white hover:bg-indigo-700 shadow-xl shadow-indigo-200 transition-all uppercase tracking-widest text-xs flex items-center justify-center gap-3"
            >
              <Save size={18} />
              Save Policy Template
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
