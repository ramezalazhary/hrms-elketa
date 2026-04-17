import { useState, useMemo, useEffect } from "react";
import { useToast } from "@/shared/components/ToastProvider";
import { createAssessmentApi } from "../api";
import { Star, Calendar, Target, Plus, Trash2 } from "lucide-react";
import { fetchWithAuth } from "@/shared/api/fetchWithAuth";
import { API_URL } from "@/shared/api/apiBase";

const LABELS_5 = [
  "Needs Improvement",
  "Fair",
  "Meets Expectations",
  "Exceeds Expectations",
  "Exceptional",
];

function StarScoreRow({ label, value, onChange }) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <span className="text-[10px] font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-widest shrink-0 min-w-[8rem]">
        {label} (1–5)
      </span>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex justify-center gap-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => onChange(star)}
              className={`p-1.5 rounded-lg transition-all active:scale-95 ${
                value >= star
                  ? "text-amber-400 bg-amber-50 shadow-inner"
                  : "text-zinc-300 bg-zinc-50 dark:bg-zinc-800/50 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              }`}
            >
              <Star size={22} className={value >= star ? "fill-current" : ""} />
            </button>
          ))}
        </div>
        {value > 0 && (
          <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-semibold max-w-[10rem] leading-tight">
            {LABELS_5[value - 1]}
          </span>
        )}
      </div>
    </div>
  );
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function SubmitAssessmentModal({ employee, onClose, onSuccess }) {
  const now = new Date();
  
  const [templates, setTemplates] = useState([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [assessedPeriods, setAssessedPeriods] = useState([]);
  
  const [formData, setFormData] = useState({
    periodMonth: now.getMonth() === 0 ? 12 : now.getMonth(),
    periodYear: now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear(),
    templateId: "",
    scores: [],
    // Legacy fallback
    commitment: 0,
    attitude: 0,
    quality: 0,
    overall: 0,
    
    daysBonus: "",
    overtime: "",
    deduction: "",
    deductionType: "AMOUNT", // "AMOUNT" = EGP, "DAYS" = Days × Daily Rate
    notesPrevious: "",
    feedback: "",
    goalsForNextPeriod: [],
    getThebounes: false,
  });
  
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        const res = await fetchWithAuth(`${API_URL}/assessment-templates`);
        if (res.ok) {
           const data = await res.json();
           const active = data.filter(t => t.status === "ACTIVE");
           setTemplates(active);
           if (active.length > 0) {
              const def = active.find(t => t.isDefault) || active[0];
              handleTemplateSelect(def, active);
           }
        }
      } catch (err) {
        console.error("Failed to load assessment templates", err);
      } finally {
        setLoadingTemplates(false);
      }
      
      // Also fetch previous assessment for goals
      try {
        const empId = employee.id || employee._id;
        const res = await fetchWithAuth(`${API_URL}/assessments/employee/${empId}`);
        if (res.ok) {
           const history = await res.json();
           if (history && history.length > 0 && history[0].assessment && history[0].assessment.length > 0) {
              const allAssessments = history[0].assessment;
              setAssessedPeriods(allAssessments.map(a => a.period).filter(Boolean));
              
              const prev = allAssessments[0];
              if (prev.goalsForNextPeriod && prev.goalsForNextPeriod.length > 0) {
                  const goalsText = prev.goalsForNextPeriod.map((g, i) => `${i+1}. ${g.description}`).join('\n');
                  setFormData(f => ({ ...f, notesPrevious: `Previous Goals:\n${goalsText}\n\n` }));
              }
           }
        }
      } catch (e) {
          console.error("Failed to load prev assessment");
      }
    };
    fetchTemplates();
  }, []);

  const handleTemplateSelect = (template, allTpl) => {
     const tplList = allTpl || templates;
     const selected = typeof template === "string" ? tplList.find(t => t.id === template) : template;
     if (selected) {
        setFormData(prev => ({
           ...prev,
           templateId: selected.id,
           scores: selected.criteria.map(c => ({
              criterionId: c.id || c._id,   // toJSON exposes 'id', not '_id'
              title: c.title,
              weight: c.weight,
              score: 0
           }))
        }));
     }
  };

  const yearOptions = useMemo(() => {
    const y = now.getFullYear();
    // Only show current and previous year
    return [y - 1, y];
  }, []);

  const availableMonths = useMemo(() => {
     return MONTH_NAMES.map((m, i) => {
        const monthNum = i + 1;
        const selectedYear = formData.periodYear;
        // Block future months
        if (selectedYear > now.getFullYear() || (selectedYear === now.getFullYear() && monthNum > now.getMonth() + 1)) return null;
        // Block already assessed months
        if (assessedPeriods.some(p => p.year === selectedYear && p.month === monthNum)) return null;
        return { label: m, value: monthNum };
     }).filter(Boolean);
  }, [formData.periodYear, assessedPeriods, now.getFullYear(), now.getMonth()]);

  useEffect(() => {
     // If the currently selected month is no longer available, auto-select the first available one
     if (availableMonths.length > 0 && !availableMonths.some(m => m.value === formData.periodMonth)) {
        setFormData(prev => ({ ...prev, periodMonth: availableMonths[availableMonths.length - 1].value }));
     } else if (availableMonths.length === 0) {
        setFormData(prev => ({ ...prev, periodMonth: "" }));
     }
  }, [availableMonths, formData.periodMonth]);

  const setScore = (idx, val) => {
     setFormData(prev => {
        const arr = [...prev.scores];
        arr[idx] = { ...arr[idx], score: val };
        return { ...prev, scores: arr };
     });
  };
  
  const setLegacyScore = (key) => (v) => setFormData((prev) => ({ ...prev, [key]: v }));

  const addGoal = () => {
     setFormData(prev => ({
        ...prev,
        goalsForNextPeriod: [...prev.goalsForNextPeriod, { description: "", status: "PENDING" }]
     }));
  }
  
  const updateGoal = (idx, val) => {
     setFormData(prev => {
        const arr = [...prev.goalsForNextPeriod];
        arr[idx].description = val;
        return { ...prev, goalsForNextPeriod: arr };
     });
  }

  const removeGoal = (idx) => {
     setFormData(prev => ({
        ...prev,
        goalsForNextPeriod: prev.goalsForNextPeriod.filter((_, i) => i !== idx)
     }));
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    const { periodMonth, periodYear, templateId, scores, commitment, attitude, quality, overall, deductionType } = formData;
    
    if (!periodMonth || !periodYear) {
      return showToast("Please select the assessment period", "error");
    }
    
    if (templateId) {
       if (scores.some(s => s.score === 0)) {
           return showToast("Please evaluate all metrics before submitting.", "error");
       }
    } else {
       if (!commitment || !attitude || !quality || !overall) {
           return showToast("Please score Commitment, Attitude, Quality, and Overall (1–5)", "error");
       }
    }

    const daysBonus = Math.max(0, Number(formData.daysBonus) || 0);
    const overtime = Math.max(0, Number(formData.overtime) || 0);
    const deduction = Math.max(0, Number(formData.deduction) || 0);

    try {
      setLoading(true);
      const today = new Date();
      const dd = String(today.getDate()).padStart(2, "0");
      const mm = String(today.getMonth() + 1).padStart(2, "0");
      const yyyy = today.getFullYear();

      await createAssessmentApi({
        employeeId: employee.id || employee._id,
        date: `${dd}:${mm}:${yyyy}`,
        period: { year: Number(periodYear), month: Number(periodMonth) },
        templateId,
        scores,
        commitment,
        attitude,
        quality,
        overall,
        daysBonus,
        overtime,
        deduction,
        deductionType,
        notesPrevious: formData.notesPrevious.trim(),
        feedback: formData.feedback.trim(),
        goalsForNextPeriod: formData.goalsForNextPeriod.filter(g => g.description.trim()),
        getThebounes: formData.getThebounes,
      });

      showToast("Assessment submitted successfully", "success");
      onSuccess?.();
      onClose();
    } catch (err) {
      showToast(err.error || err.message || "Failed to submit assessment", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/40 backdrop-blur-sm animate-in fade-in duration-200">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-xl max-h-[95vh] flex flex-col bg-white dark:bg-zinc-900 rounded-2xl shadow-xl overflow-hidden border border-zinc-200 dark:border-zinc-800"
      >
        <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800/50 bg-zinc-50/50 dark:bg-zinc-800/50 shrink-0 flex items-center justify-between">
           <div>
              <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 border-l-2 border-zinc-900 pl-2">
                Performance Review
              </h2>
              <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-1 uppercase tracking-widest pl-2 font-medium">
                Evaluating: {employee.fullName}
              </p>
           </div>
           
           {!loadingTemplates && templates.length > 0 && (
              <select
                 value={formData.templateId}
                 onChange={(e) => handleTemplateSelect(e.target.value)}
                 className="rounded-lg border border-zinc-300 bg-white dark:bg-zinc-900 px-3 py-1.5 text-xs focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500"
              >
                  {templates.map(t => (
                     <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
              </select>
           )}
        </div>

        <div className="p-6 space-y-6 overflow-y-auto flex-1 min-h-0 bg-white dark:bg-zinc-900">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-1">
                Bonus days
              </label>
              <input
                type="number" min={0} step={0.5}
                value={formData.daysBonus}
                onChange={(e) => setFormData((p) => ({ ...p, daysBonus: e.target.value }))}
                className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/50 px-3 py-2 text-sm focus:border-zinc-400 focus:bg-white dark:focus:bg-zinc-900 focus:ring-2 focus:ring-zinc-200/80 dark:focus:ring-zinc-700 outline-none"
                placeholder="0"
              />
              <p className="text-[9px] text-zinc-400 mt-0.5">days × daily rate</p>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-1">
                Overtime hours
              </label>
              <input
                type="number" min={0} step={0.5}
                value={formData.overtime}
                onChange={(e) => setFormData((p) => ({ ...p, overtime: e.target.value }))}
                className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/50 px-3 py-2 text-sm focus:border-zinc-400 focus:bg-white dark:focus:bg-zinc-900 focus:ring-2 focus:ring-zinc-200/80 dark:focus:ring-zinc-700 outline-none"
                placeholder="0"
              />
              <p className="text-[9px] text-zinc-400 mt-0.5">hours × daily rate</p>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-1">
                Deduction
              </label>
              <div className="flex gap-2">
                <input
                  type="number" min={0} step={1}
                  value={formData.deduction}
                  onChange={(e) => setFormData((p) => ({ ...p, deduction: e.target.value }))}
                  className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/50 px-3 py-2 text-sm focus:border-zinc-400 focus:bg-white dark:focus:bg-zinc-900 focus:ring-2 focus:ring-zinc-200/80 dark:focus:ring-zinc-700 outline-none"
                  placeholder="0"
                />
                <select 
                  value={formData.deductionType}
                  onChange={(e) => setFormData(p => ({ ...p, deductionType: e.target.value }))}
                  className="w-1/3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/50 px-2 py-2 text-sm focus:border-zinc-400 focus:bg-white dark:focus:bg-zinc-900 outline-none"
                >
                  <option value="AMOUNT">EGP</option>
                  <option value="DAYS">Days</option>
                </select>
              </div>
              <p className="text-[9px] text-zinc-400 mt-0.5">
                 {formData.deductionType === "AMOUNT" ? "fixed EGP amount" : "days × daily rate"}
              </p>
            </div>
          </div>

          <div className="h-px bg-zinc-100 dark:bg-zinc-800" />

          {/* Metrics section */}
          <div className="space-y-4">
             {formData.templateId ? (
                <>
                  {formData.scores.map((s, idx) => (
                     <StarScoreRow
                       key={idx}
                       label={s.title}
                       value={s.score}
                       onChange={(val) => setScore(idx, val)}
                     />
                  ))}
                </>
             ) : (
                <>
                  <StarScoreRow label="Commitment" value={formData.commitment} onChange={setLegacyScore("commitment")} />
                  <StarScoreRow label="Attitude" value={formData.attitude} onChange={setLegacyScore("attitude")} />
                  <StarScoreRow label="Quality" value={formData.quality} onChange={setLegacyScore("quality")} />
                  <StarScoreRow label="Overall" value={formData.overall} onChange={setLegacyScore("overall")} />
                </>
             )}
          </div>

          <div className="h-px bg-zinc-100 dark:bg-zinc-800" />
          
          {/* Goals section */}
          <div className="bg-blue-50/30 rounded-xl p-4 border border-blue-100/50">
             <div className="flex items-center justify-between mb-3 border-b border-blue-100/60 pb-2">
                <label className="text-[10px] font-bold text-blue-800 uppercase tracking-widest flex items-center gap-1.5">
                  <Target size={12} className="text-blue-500" /> Goals for Next Period
                </label>
                <button type="button" onClick={addGoal} className="text-[10px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1">
                   <Plus size={12}/> ADD GOAL
                </button>
             </div>
             
             {formData.goalsForNextPeriod.length === 0 ? (
                <p className="text-xs text-blue-400/80 italic text-center py-2">No specific goals set for the next period.</p>
             ) : (
                <div className="space-y-2">
                   {formData.goalsForNextPeriod.map((g, idx) => (
                      <div key={idx} className="flex gap-2 items-start">
                         <div className="mt-2 h-1.5 w-1.5 rounded-full bg-blue-400 shrink-0"/>
                         <textarea
                            rows={1}
                            placeholder="Describe measurable objective..."
                            value={g.description}
                            onChange={(e) => updateGoal(idx, e.target.value)}
                            className="flex-1 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-1.5 text-sm outline-none resize-y"
                         />
                         <button type="button" onClick={() => removeGoal(idx)} className="p-1.5 text-zinc-300 hover:text-rose-500">
                           <Trash2 size={16}/>
                         </button>
                      </div>
                   ))}
                </div>
             )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                <Calendar size={12} className="text-zinc-500 dark:text-zinc-400" /> Assessment period
              </label>
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={formData.periodMonth}
                  onChange={(e) => setFormData({ ...formData, periodMonth: Number(e.target.value) })}
                  className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/50 px-3 py-2 text-sm focus:border-zinc-400 outline-none"
                  disabled={availableMonths.length === 0}
                >
                  {availableMonths.length === 0 ? (
                     <option value="">No unassessed months</option>
                  ) : (
                     availableMonths.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)
                  )}
                </select>
                <select
                  value={formData.periodYear}
                  onChange={(e) => setFormData({ ...formData, periodYear: Number(e.target.value) })}
                  className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/50 px-3 py-2 text-sm focus:border-zinc-400 outline-none"
                >
                  {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            </div>
            
             <div className="flex items-center gap-3 rounded-xl border border-zinc-200/90 dark:border-zinc-800/80 bg-emerald-50/30 p-3 ring-1 ring-zinc-950/[0.04]">
              <input
                type="checkbox"
                id="getThebounes"
                checked={formData.getThebounes}
                onChange={(e) => setFormData({ ...formData, getThebounes: e.target.checked })}
                className="h-4 w-4 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500"
              />
              <label htmlFor="getThebounes" className="cursor-pointer text-xs font-bold text-zinc-800 dark:text-zinc-200">
                Recommend for financial bonus
              </label>
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-widest mb-1.5">
              Feedback & Manager Notes
            </label>
            <textarea
              required
              rows={3}
              placeholder="Provide constructive feedback for this review period..."
              value={formData.feedback}
              onChange={(e) => setFormData({ ...formData, feedback: e.target.value })}
              className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/50 px-4 py-3 text-sm focus:border-zinc-400 focus:bg-white dark:focus:bg-zinc-900 focus:ring-2 focus:ring-zinc-200/80 dark:focus:ring-zinc-700 outline-none resize-none"
            />
          </div>

        </div>

        <div className="px-6 py-4 bg-zinc-50 dark:bg-zinc-800/50 border-t border-zinc-200/80 dark:border-zinc-800/80 flex justify-end gap-3 shrink-0">
          <button
            type="button" disabled={loading} onClick={onClose}
            className="px-4 py-2 text-sm font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/50 rounded-xl transition"
          >
            Cancel
          </button>
          <button
            type="submit" disabled={loading}
            className="rounded-full bg-zinc-900 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800 disabled:opacity-50"
          >
            {loading ? "Submitting…" : "Submit Review"}
          </button>
        </div>
      </form>
    </div>
  );
}
