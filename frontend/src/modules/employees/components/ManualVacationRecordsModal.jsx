import { useEffect, useMemo, useState } from "react";
import { Plane, X, Trash2, Plus, Calendar } from "lucide-react";

const VACATION_TYPE_OPTIONS = [
  { value: "ANNUAL", label: "Annual leave" },
  { value: "SICK", label: "Sick leave" },
  { value: "UNPAID", label: "Unpaid" },
  { value: "MATERNITY", label: "Maternity" },
  { value: "PATERNITY", label: "Paternity" },
  { value: "OTHER", label: "Other" },
];

function toDateInputValue(d) {
  if (!d) return "";
  const x = new Date(d);
  if (Number.isNaN(x.getTime())) return "";
  return x.toISOString().slice(0, 10);
}

/**
 * @param {{
 *   employee: { fullName: string, vacationRecords?: Array<object> },
 *   onClose: () => void,
 *   onPersist: (list: object[]) => Promise<boolean>,
 *   onAddAsLeaveRequest?: (payload: { startDate: string, endDate: string, type: string, notes?: string }) => Promise<boolean>,
 *   onAddExcuseAsLeaveRequest?: (payload: { excuseDate: string, startTime: string, endTime: string, notes?: string }) => Promise<boolean>,
 *   saving: boolean,
 *   recording?: boolean,
 *   recorderEmail?: string,
 * }} props
 */
export function ManualVacationRecordsModal({
  employee,
  onClose,
  onPersist,
  onAddAsLeaveRequest,
  onAddExcuseAsLeaveRequest,
  saving,
  recording = false,
  recorderEmail,
}) {
  const [records, setRecords] = useState(() => [
    ...(employee.vacationRecords || []),
  ]);
  const [newStart, setNewStart] = useState("");
  const [newEnd, setNewEnd] = useState("");
  const [newType, setNewType] = useState("ANNUAL");
  const [newNotes, setNewNotes] = useState("");
  const [excuseDate, setExcuseDate] = useState("");
  const [excuseStartTime, setExcuseStartTime] = useState("");
  const [excuseEndTime, setExcuseEndTime] = useState("");

  useEffect(() => {
    setRecords([...(employee.vacationRecords || [])]);
  }, [employee.vacationRecords]);

  const sorted = useMemo(() => {
    return [...records]
      .map((r, idx) => ({ r, idx }))
      .sort(
        (a, b) =>
          new Date(b.r.startDate).getTime() -
          new Date(a.r.startDate).getTime(),
      );
  }, [records]);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newStart || !newEnd) return;
    if (new Date(newStart) > new Date(newEnd)) return;
    const next = [
      ...records,
      {
        startDate: newStart,
        endDate: newEnd,
        type: newType,
        notes: newNotes.trim() || undefined,
        recordedBy: recorderEmail,
      },
    ];
    const ok = await onPersist(next);
    if (ok) {
      setNewStart("");
      setNewEnd("");
      setNewType("ANNUAL");
      setNewNotes("");
    }
  };

  const handleAddAsLeaveRequest = async (e) => {
    e.preventDefault();
    if (!onAddAsLeaveRequest) return;
    if (!newStart || !newEnd) return;
    if (new Date(newStart) > new Date(newEnd)) return;
    const ok = await onAddAsLeaveRequest({
      startDate: newStart,
      endDate: newEnd,
      type: newType,
      notes: newNotes.trim() || undefined,
    });
    if (ok) {
      setNewStart("");
      setNewEnd("");
      setNewType("ANNUAL");
      setNewNotes("");
    }
  };

  const handleAddExcuseAsLeaveRequest = async (e) => {
    e.preventDefault();
    if (!onAddExcuseAsLeaveRequest) return;
    if (!excuseDate || !excuseStartTime || !excuseEndTime) return;
    const ok = await onAddExcuseAsLeaveRequest({
      excuseDate,
      startTime: excuseStartTime,
      endTime: excuseEndTime,
      notes: newNotes.trim() || undefined,
    });
    if (ok) {
      setExcuseDate("");
      setExcuseStartTime("");
      setExcuseEndTime("");
      setNewNotes("");
    }
  };

  const handleRemove = async (idx) => {
    const next = records.filter((_, i) => i !== idx);
    await onPersist(next);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl bg-white shadow-2xl relative overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-200">
        <div className="absolute right-0 top-0 -mr-16 -mt-16 h-48 w-48 rounded-full bg-sky-500/10 blur-3xl" />

        <div className="relative flex items-start justify-between gap-4 p-6 md:p-8 pb-4 shrink-0 border-b border-slate-100">
          <div className="flex gap-4 min-w-0">
            <div className="flex items-center justify-center shrink-0 w-12 h-12 rounded-full bg-sky-50 text-sky-600 shadow-sm border border-sky-100/50">
              <Plane className="h-6 w-6" strokeWidth={2} />
            </div>
            <div className="min-w-0">
              <h2 className="text-xl font-bold text-slate-900 leading-tight">
                Manual vacation records
              </h2>
              <p className="mt-1.5 text-sm text-slate-500">
                Legacy or HR-entered leave on file for{" "}
                <strong className="text-slate-700">{employee.fullName}</strong> (not the Time off workflow).
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex items-center justify-center h-8 w-8 rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition shrink-0 -mr-2"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="relative flex-1 overflow-y-auto px-6 md:px-8 py-4 space-y-6">
          <form
            onSubmit={handleAdd}
            className="rounded-xl border border-sky-100 bg-sky-50/40 p-4"
          >
            <p className="text-[10px] font-bold uppercase tracking-wider text-sky-800 mb-3 flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" />
              Add vacation / leave
            </p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <label className="flex flex-col gap-1 text-xs">
                <span className="font-semibold text-slate-600">Start</span>
                <input
                  type="date"
                  required
                  value={newStart}
                  onChange={(e) => setNewStart(e.target.value)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs">
                <span className="font-semibold text-slate-600">End</span>
                <input
                  type="date"
                  required
                  value={newEnd}
                  onChange={(e) => setNewEnd(e.target.value)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs sm:col-span-2 lg:col-span-1">
                <span className="font-semibold text-slate-600">Type</span>
                <select
                  value={newType}
                  onChange={(e) => setNewType(e.target.value)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                >
                  {VACATION_TYPE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs sm:col-span-2 lg:col-span-1">
                <span className="font-semibold text-slate-600">Notes (optional)</span>
                <input
                  type="text"
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  placeholder="e.g. Approved by …"
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                />
              </label>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                type="submit"
                disabled={saving || recording}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-sky-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-sky-500/25 transition hover:shadow-xl hover:shadow-sky-500/35 disabled:opacity-50 disabled:pointer-events-none"
              >
                <Plus className="h-4 w-4" />
                Add manual record
              </button>
              {onAddAsLeaveRequest && (
                <button
                  type="button"
                  onClick={handleAddAsLeaveRequest}
                  disabled={saving || recording}
                  className="inline-flex items-center gap-2 rounded-xl border border-teal-200 bg-teal-50 px-5 py-2.5 text-sm font-bold text-teal-800 transition hover:bg-teal-100 disabled:opacity-50 disabled:pointer-events-none"
                >
                  <Plus className="h-4 w-4" />
                  {recording
                    ? "Saving..."
                    : "Save as Leave Request (Direct HR Record)"}
                </button>
              )}
            </div>
          </form>

          {onAddExcuseAsLeaveRequest && (
            <form
              onSubmit={handleAddExcuseAsLeaveRequest}
              className="rounded-xl border border-violet-100 bg-violet-50/40 p-4"
            >
              <p className="text-[10px] font-bold uppercase tracking-wider text-violet-800 mb-3 flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                Save excuse as leave request
              </p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <label className="flex flex-col gap-1 text-xs">
                  <span className="font-semibold text-slate-600">Excuse date</span>
                  <input
                    type="date"
                    required
                    value={excuseDate}
                    onChange={(e) => setExcuseDate(e.target.value)}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm shadow-sm focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs">
                  <span className="font-semibold text-slate-600">Start time</span>
                  <input
                    type="time"
                    required
                    value={excuseStartTime}
                    onChange={(e) => setExcuseStartTime(e.target.value)}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm shadow-sm focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs">
                  <span className="font-semibold text-slate-600">End time</span>
                  <input
                    type="time"
                    required
                    value={excuseEndTime}
                    onChange={(e) => setExcuseEndTime(e.target.value)}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm shadow-sm focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs sm:col-span-2 lg:col-span-1">
                  <span className="font-semibold text-slate-600">Notes (optional)</span>
                  <input
                    type="text"
                    value={newNotes}
                    onChange={(e) => setNewNotes(e.target.value)}
                    placeholder="e.g. Medical appointment"
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm shadow-sm focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                  />
                </label>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <button
                  type="submit"
                  disabled={saving || recording}
                  className="inline-flex items-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-5 py-2.5 text-sm font-bold text-violet-800 transition hover:bg-violet-100 disabled:opacity-50 disabled:pointer-events-none"
                >
                  <Plus className="h-4 w-4" />
                  {recording
                    ? "Saving..."
                    : "Save Excuse as Leave Request (Direct HR Record)"}
                </button>
              </div>
            </form>
          )}

          {sorted.length === 0 ? (
            <div className="py-12 text-center border-2 border-dashed border-slate-100 rounded-2xl">
              <Plane className="h-10 w-10 text-slate-200 mx-auto mb-3" />
              <p className="text-slate-400 italic text-sm">No manual vacation records on file.</p>
            </div>
          ) : (
            <ul className="space-y-3">
              {sorted.map(({ r, idx }) => {
                const typeLabel =
                  VACATION_TYPE_OPTIONS.find((o) => o.value === r.type)?.label ||
                  r.type ||
                  "Leave";
                const start = new Date(r.startDate);
                const end = new Date(r.endDate);
                const days =
                  Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())
                    ? null
                    : Math.max(
                        1,
                        Math.ceil(
                          (end.getTime() - start.getTime()) /
                            (1000 * 60 * 60 * 24),
                        ) + 1,
                      );
                return (
                  <li
                    key={`${idx}-${toDateInputValue(r.startDate)}-${toDateInputValue(r.endDate)}`}
                    className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50/50 p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-sky-100 px-2.5 py-0.5 text-[11px] font-bold text-sky-800">
                          {typeLabel}
                        </span>
                        {days != null && (
                          <span className="text-[11px] font-medium text-slate-500">
                            {days} day{days !== 1 ? "s" : ""}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-sm font-semibold text-slate-800">
                        {toDateInputValue(r.startDate)} → {toDateInputValue(r.endDate)}
                      </p>
                      {r.notes && (
                        <p className="mt-1 text-xs text-slate-600">{r.notes}</p>
                      )}
                      {r.recordedBy && (
                        <p className="mt-1 text-[10px] text-slate-400">
                          Recorded by {r.recordedBy}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => void handleRemove(idx)}
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-50 disabled:opacity-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Remove
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="relative flex items-center justify-end gap-3 p-6 md:px-8 pt-4 border-t border-slate-100 shrink-0 bg-white">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
