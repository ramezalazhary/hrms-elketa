import { useState, useMemo } from "react";
import { useToast } from "@/shared/components/ToastProvider";
import { createAssessmentApi } from "../api";
import { Star, FileText, Calendar } from "lucide-react";

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
      <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest shrink-0 min-w-[8rem]">
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
                  : "text-zinc-300 bg-zinc-50 hover:bg-zinc-100"
              }`}
            >
              <Star size={22} className={value >= star ? "fill-current" : ""} />
            </button>
          ))}
        </div>
        {value > 0 && (
          <span className="text-[10px] text-zinc-500 font-semibold max-w-[10rem] leading-tight">
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
  const [formData, setFormData] = useState({
    periodMonth: now.getMonth() + 1,
    periodYear: now.getFullYear(),
    daysBonus: "",
    overtime: "",
    deduction: "",
    commitment: 0,
    attitude: 0,
    quality: 0,
    overall: 0,
    notesPrevious: "",
    feedback: "",
    getThebounes: false,
  });
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();

  const yearOptions = useMemo(() => {
    const y = now.getFullYear();
    return [y - 1, y, y + 1];
  }, []);

  const setScore = (key) => (v) => setFormData((prev) => ({ ...prev, [key]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    const { commitment, attitude, quality, overall, periodMonth, periodYear } = formData;
    if (!commitment || !attitude || !quality || !overall) {
      showToast("Please score Commitment, Attitude, Quality, and Overall (1–5)", "error");
      return;
    }
    if (!periodMonth || !periodYear) {
      showToast("Please select the assessment period (month & year)", "error");
      return;
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
        daysBonus,
        overtime,
        deduction,
        commitment,
        attitude,
        quality,
        overall,
        notesPrevious: formData.notesPrevious.trim(),
        feedback: formData.feedback.trim(),
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
        className="w-full max-w-lg max-h-[min(90vh,720px)] flex flex-col bg-white rounded-2xl shadow-xl overflow-hidden border border-zinc-200"
      >
        <div className="px-6 py-4 border-b border-zinc-100 bg-zinc-50/50 shrink-0">
          <h2 className="text-sm font-bold text-zinc-900 border-l-2 border-zinc-900 pl-2">
            Performance Review
          </h2>
          <p className="text-[10px] text-zinc-500 mt-1 uppercase tracking-widest pl-2 font-medium">
            Evaluating: {employee.fullName}
          </p>
        </div>

        <div className="p-6 space-y-5 overflow-y-auto flex-1 min-h-0">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">
                Bonus days
              </label>
              <input
                type="number"
                min={0}
                step={0.5}
                value={formData.daysBonus}
                onChange={(e) => setFormData((p) => ({ ...p, daysBonus: e.target.value }))}
                className="w-full rounded-xl border border-zinc-200 bg-zinc-50/50 px-3 py-2 text-sm focus:border-zinc-400 focus:bg-white focus:ring-2 focus:ring-zinc-200/80 outline-none"
                placeholder="0"
              />
              <p className="text-[9px] text-zinc-400 mt-0.5">days × daily rate</p>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">
                Overtime hours
              </label>
              <input
                type="number"
                min={0}
                step={0.5}
                value={formData.overtime}
                onChange={(e) => setFormData((p) => ({ ...p, overtime: e.target.value }))}
                className="w-full rounded-xl border border-zinc-200 bg-zinc-50/50 px-3 py-2 text-sm focus:border-zinc-400 focus:bg-white focus:ring-2 focus:ring-zinc-200/80 outline-none"
                placeholder="0"
              />
              <p className="text-[9px] text-zinc-400 mt-0.5">hours × daily rate</p>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">
                Deduction (EGP)
              </label>
              <input
                type="number"
                min={0}
                step={1}
                value={formData.deduction}
                onChange={(e) => setFormData((p) => ({ ...p, deduction: e.target.value }))}
                className="w-full rounded-xl border border-zinc-200 bg-zinc-50/50 px-3 py-2 text-sm focus:border-zinc-400 focus:bg-white focus:ring-2 focus:ring-zinc-200/80 outline-none"
                placeholder="0"
              />
              <p className="text-[9px] text-zinc-400 mt-0.5">fixed EGP amount</p>
            </div>
          </div>

          <div className="h-px bg-zinc-100" />

          <div className="space-y-4">
            <StarScoreRow
              label="Commitment"
              value={formData.commitment}
              onChange={setScore("commitment")}
            />
            <StarScoreRow
              label="Attitude"
              value={formData.attitude}
              onChange={setScore("attitude")}
            />
            <StarScoreRow
              label="Quality"
              value={formData.quality}
              onChange={setScore("quality")}
            />
            <StarScoreRow
              label="Overall"
              value={formData.overall}
              onChange={setScore("overall")}
            />
          </div>

          <div className="h-px bg-zinc-100" />

          <div>
            <label className="block text-[10px] font-bold text-zinc-700 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
              <Calendar size={12} className="text-zinc-500" /> Assessment period
            </label>
            <div className="grid grid-cols-2 gap-3">
              <select
                value={formData.periodMonth}
                onChange={(e) => setFormData({ ...formData, periodMonth: Number(e.target.value) })}
                className="w-full rounded-xl border border-zinc-200 bg-zinc-50/50 px-3 py-2.5 text-sm focus:border-zinc-400 focus:bg-white focus:ring-2 focus:ring-zinc-200/80 outline-none transition"
              >
                {MONTH_NAMES.map((m, i) => (
                  <option key={i + 1} value={i + 1}>{m}</option>
                ))}
              </select>
              <select
                value={formData.periodYear}
                onChange={(e) => setFormData({ ...formData, periodYear: Number(e.target.value) })}
                className="w-full rounded-xl border border-zinc-200 bg-zinc-50/50 px-3 py-2.5 text-sm focus:border-zinc-400 focus:bg-white focus:ring-2 focus:ring-zinc-200/80 outline-none transition"
              >
                {yearOptions.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-zinc-700 uppercase tracking-widest mb-1.5">
              Notes / previous information
            </label>
            <textarea
              rows={3}
              placeholder="Context from prior reviews, goals, incidents…"
              value={formData.notesPrevious}
              onChange={(e) => setFormData({ ...formData, notesPrevious: e.target.value })}
              className="w-full rounded-xl border border-zinc-200 bg-zinc-50/50 px-4 py-3 text-sm focus:border-zinc-400 focus:bg-white focus:ring-2 focus:ring-zinc-200/80 outline-none transition resize-none"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-zinc-700 uppercase tracking-widest mb-1.5">
              Feedback
            </label>
            <textarea
              required
              rows={4}
              placeholder="Performance feedback for this review…"
              value={formData.feedback}
              onChange={(e) => setFormData({ ...formData, feedback: e.target.value })}
              className="w-full rounded-xl border border-zinc-200 bg-zinc-50/50 px-4 py-3 text-sm focus:border-zinc-400 focus:bg-white focus:ring-2 focus:ring-zinc-200/80 outline-none transition resize-none"
            />
          </div>

          <div className="flex items-center gap-3 rounded-xl border border-zinc-200/90 bg-zinc-50/80 p-3 ring-1 ring-zinc-950/[0.04]">
            <input
              type="checkbox"
              id="getThebounes"
              checked={formData.getThebounes}
              onChange={(e) => setFormData({ ...formData, getThebounes: e.target.checked })}
              className="h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-200/80"
            />
            <label htmlFor="getThebounes" className="cursor-pointer text-xs font-bold text-zinc-800">
              Recommend for financial bonus
            </label>
          </div>
        </div>

        <div className="px-6 py-4 bg-zinc-50/50 border-t border-zinc-100 flex justify-end gap-3 shrink-0">
          <button
            type="button"
            disabled={loading}
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-zinc-600 hover:bg-zinc-100 rounded-xl transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="rounded-full bg-zinc-900 px-5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-zinc-800 disabled:opacity-50"
          >
            {loading ? "Submitting…" : "Submit review"}
          </button>
        </div>
      </form>
    </div>
  );
}
