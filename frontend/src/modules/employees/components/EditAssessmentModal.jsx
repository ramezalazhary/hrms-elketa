import { useState } from "react";
import { useToast } from "@/shared/components/ToastProvider";
import { updateAssessmentApi } from "../api";
import { Star, Target, Plus, Trash2 } from "lucide-react";

const LABELS_5 = [
  "Needs Improvement",
  "Fair",
  "Meets Expectations",
  "Exceeds Expectations",
  "Exceptional",
];

const MONTH_NAMES = [
  "", "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
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
              <Star size={20} className={value >= star ? "fill-current" : ""} />
            </button>
          ))}
        </div>
        {value > 0 && (
          <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-semibold">
            {LABELS_5[value - 1]}
          </span>
        )}
      </div>
    </div>
  );
}

export function EditAssessmentModal({ record, onClose, onSuccess }) {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);

  const periodLabel = record.period
    ? `${MONTH_NAMES[record.period.month]} ${record.period.year}`
    : record.reviewPeriod || "—";

  // Dynamic scores from record
  const hasScores = Array.isArray(record.scores) && record.scores.length > 0;

  const [formData, setFormData] = useState({
    scores: hasScores
      ? record.scores.map((s) => ({ ...s }))
      : [],
    feedback: record.feedback || "",
    notesPrevious: record.notesPrevious || "",
    daysBonus: record.daysBonus ?? "",
    overtime: record.overtime ?? "",
    deduction: record.deduction ?? "",
    deductionType: record.deductionType || "AMOUNT",
    getThebounes: record.getThebounes ?? false,
    goalsForNextPeriod: Array.isArray(record.goalsForNextPeriod)
      ? record.goalsForNextPeriod.map((g) => ({ ...g }))
      : [],
  });

  const setScore = (idx, val) => {
    setFormData((prev) => {
      const clone = [...prev.scores];
      clone[idx] = { ...clone[idx], score: val };
      return { ...prev, scores: clone };
    });
  };

  const addGoal = () => {
    setFormData((prev) => ({
      ...prev,
      goalsForNextPeriod: [
        ...prev.goalsForNextPeriod,
        { description: "", status: "PENDING" },
      ],
    }));
  };

  const updateGoal = (idx, field, val) => {
    setFormData((prev) => {
      const arr = [...prev.goalsForNextPeriod];
      arr[idx] = { ...arr[idx], [field]: val };
      return { ...prev, goalsForNextPeriod: arr };
    });
  };

  const removeGoal = (idx) => {
    setFormData((prev) => ({
      ...prev,
      goalsForNextPeriod: prev.goalsForNextPeriod.filter((_, i) => i !== idx),
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (hasScores && formData.scores.some((s) => s.score === 0)) {
      return showToast("Please score all metrics before saving.", "error");
    }

    try {
      setLoading(true);
      await updateAssessmentApi(record.id || record._id, {
        scores: formData.scores,
        feedback: formData.feedback.trim(),
        notesPrevious: formData.notesPrevious.trim(),
        daysBonus: Math.max(0, Number(formData.daysBonus) || 0),
        overtime: Math.max(0, Number(formData.overtime) || 0),
        deduction: Math.max(0, Number(formData.deduction) || 0),
        deductionType: formData.deductionType,
        getThebounes: formData.getThebounes,
        goalsForNextPeriod: formData.goalsForNextPeriod.filter(
          (g) => g.description?.trim()
        ),
      });
      showToast("Assessment updated successfully", "success");
      onSuccess?.();
      onClose();
    } catch (err) {
      showToast(
        err.error || err.message || "Failed to update assessment",
        "error"
      );
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
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800/50 bg-zinc-50/50 dark:bg-zinc-800/50 shrink-0">
          <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 border-l-2 border-amber-500 pl-2">
            Edit Assessment
          </h2>
          <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-1 uppercase tracking-widest pl-2 font-medium">
            Period: {periodLabel}
          </p>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1 min-h-0 bg-white dark:bg-zinc-900">

          {/* Payroll section */}
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
            </div>
          </div>

          <div className="h-px bg-zinc-100 dark:bg-zinc-800" />

          {/* Scores */}
          {hasScores && (
            <div className="space-y-4">
              {formData.scores.map((s, idx) => (
                <StarScoreRow
                  key={idx}
                  label={s.title}
                  value={s.score}
                  onChange={(val) => setScore(idx, val)}
                />
              ))}
            </div>
          )}

          <div className="h-px bg-zinc-100 dark:bg-zinc-800" />

          {/* Goals */}
          <div className="bg-blue-50/30 rounded-xl p-4 border border-blue-100/50">
            <div className="flex items-center justify-between mb-3 border-b border-blue-100/60 pb-2">
              <label className="text-[10px] font-bold text-blue-800 uppercase tracking-widest flex items-center gap-1.5">
                <Target size={12} className="text-blue-500" /> Goals for Next Period
              </label>
              <button
                type="button"
                onClick={addGoal}
                className="text-[10px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1"
              >
                <Plus size={12} /> ADD GOAL
              </button>
            </div>

            {formData.goalsForNextPeriod.length === 0 ? (
              <p className="text-xs text-blue-400/80 italic text-center py-2">
                No specific goals set.
              </p>
            ) : (
              <div className="space-y-2">
                {formData.goalsForNextPeriod.map((g, idx) => (
                  <div key={idx} className="flex gap-2 items-start">
                    <select
                      value={g.status || "PENDING"}
                      onChange={(e) => updateGoal(idx, "status", e.target.value)}
                      className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-2 py-1.5 text-[10px] font-bold outline-none"
                    >
                      <option value="PENDING">Pending</option>
                      <option value="ACHIEVED">Achieved</option>
                      <option value="PARTIAL">Partial</option>
                      <option value="MISSED">Missed</option>
                    </select>
                    <textarea
                      rows={1}
                      placeholder="Objective description..."
                      value={g.description}
                      onChange={(e) => updateGoal(idx, "description", e.target.value)}
                      className="flex-1 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-1.5 text-sm outline-none resize-y"
                    />
                    <button
                      type="button"
                      onClick={() => removeGoal(idx)}
                      className="p-1.5 text-zinc-300 hover:text-rose-500"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Notes + Feedback */}
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-widest mb-1.5">
                Notes / Context
              </label>
              <textarea
                rows={2}
                value={formData.notesPrevious}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, notesPrevious: e.target.value }))
                }
                className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/50 px-3 py-2 text-sm outline-none resize-y"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-widest mb-1.5">
                Manager Feedback
              </label>
              <textarea
                rows={3}
                value={formData.feedback}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, feedback: e.target.value }))
                }
                className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/50 px-3 py-2 text-sm outline-none resize-y"
              />
            </div>
          </div>

          {/* Bonus checkbox */}
          <div className="flex items-center gap-3 rounded-xl border border-zinc-200/90 dark:border-zinc-800/80 bg-emerald-50/30 p-3">
            <input
              type="checkbox"
              id="editGetThebounes"
              checked={formData.getThebounes}
              onChange={(e) =>
                setFormData((p) => ({ ...p, getThebounes: e.target.checked }))
              }
              className="h-4 w-4 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500"
            />
            <label
              htmlFor="editGetThebounes"
              className="cursor-pointer text-xs font-bold text-zinc-800 dark:text-zinc-200"
            >
              Recommend for financial bonus
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-zinc-100 dark:border-zinc-800/50 flex justify-end gap-3 bg-zinc-50/50 dark:bg-zinc-800/50 shrink-0">
          <button
            type="button"
            disabled={loading}
            onClick={onClose}
            className="px-4 py-2 font-semibold text-sm text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-5 py-2 font-semibold text-sm text-white bg-zinc-900 hover:bg-zinc-800 rounded-lg shadow-sm"
          >
            {loading ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </form>
    </div>
  );
}
