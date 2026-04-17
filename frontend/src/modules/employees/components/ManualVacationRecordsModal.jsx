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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-[20px] border border-zinc-200/90 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-2xl ring-1 ring-zinc-950/[0.06] dark:ring-zinc-800 animate-in zoom-in-95 duration-200">
        <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-zinc-200/40 blur-3xl" />

        <div className="relative flex items-start justify-between gap-4 p-6 md:p-8 pb-4 shrink-0 border-b border-zinc-100 dark:border-zinc-800/50">
          <div className="flex gap-4 min-w-0">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-zinc-200/80 dark:border-zinc-800/80 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 shadow-sm">
              <Plane className="h-6 w-6" strokeWidth={2} />
            </div>
            <div className="min-w-0">
              <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 leading-tight">
                Manual vacation records
              </h2>
              <p className="mt-1.5 text-sm text-zinc-500 dark:text-zinc-400">
                Legacy or HR-entered leave on file for{" "}
                <strong className="text-zinc-700 dark:text-zinc-300">{employee.fullName}</strong> (not the Time off workflow).
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex items-center justify-center h-8 w-8 rounded-full text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-600 dark:hover:text-zinc-400 transition shrink-0 -mr-2"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="relative flex-1 overflow-y-auto px-6 md:px-8 py-4 space-y-6">
          <form
            onSubmit={handleAdd}
            className="rounded-[20px] border border-zinc-200/80 dark:border-zinc-800/80 bg-zinc-50/70 dark:bg-zinc-800/50 p-4 ring-1 ring-zinc-950/[0.04]"
          >
            <p className="mb-3 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-800 dark:text-zinc-200">
              <Calendar className="h-3.5 w-3.5" />
              Add vacation / leave
            </p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <label className="flex flex-col gap-1 text-xs">
                <span className="font-semibold text-zinc-600 dark:text-zinc-400">Start</span>
                <input
                  type="date"
                  required
                  value={newStart}
                  onChange={(e) => setNewStart(e.target.value)}
                  className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-2.5 text-sm shadow-sm outline-none transition focus:border-zinc-400 focus:ring-2 focus:ring-zinc-200/80 dark:focus:ring-zinc-700"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs">
                <span className="font-semibold text-zinc-600 dark:text-zinc-400">End</span>
                <input
                  type="date"
                  required
                  value={newEnd}
                  onChange={(e) => setNewEnd(e.target.value)}
                  className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-2.5 text-sm shadow-sm outline-none transition focus:border-zinc-400 focus:ring-2 focus:ring-zinc-200/80 dark:focus:ring-zinc-700"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs sm:col-span-2 lg:col-span-1">
                <span className="font-semibold text-zinc-600 dark:text-zinc-400">Type</span>
                <select
                  value={newType}
                  onChange={(e) => setNewType(e.target.value)}
                  className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-2.5 text-sm shadow-sm outline-none transition focus:border-zinc-400 focus:ring-2 focus:ring-zinc-200/80 dark:focus:ring-zinc-700"
                >
                  {VACATION_TYPE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs sm:col-span-2 lg:col-span-1">
                <span className="font-semibold text-zinc-600 dark:text-zinc-400">Notes (optional)</span>
                <input
                  type="text"
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  placeholder="e.g. Approved by …"
                  className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-2.5 text-sm shadow-sm outline-none transition focus:border-zinc-400 focus:ring-2 focus:ring-zinc-200/80 dark:focus:ring-zinc-700"
                />
              </label>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                type="submit"
                disabled={saving || recording}
                className="inline-flex items-center gap-2 rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800 disabled:pointer-events-none disabled:opacity-50"
              >
                <Plus className="h-4 w-4" />
                Add manual record
              </button>
              {onAddAsLeaveRequest && (
                <button
                  type="button"
                  onClick={handleAddAsLeaveRequest}
                  disabled={saving || recording}
                  className="inline-flex items-center gap-2 rounded-full border border-zinc-200/90 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-zinc-800 dark:text-zinc-200 shadow-sm transition hover:bg-zinc-50 dark:hover:bg-zinc-800/50 disabled:pointer-events-none disabled:opacity-50"
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
              className="rounded-[20px] border border-zinc-200/80 dark:border-zinc-800/80 bg-zinc-50/70 dark:bg-zinc-800/50 p-4 ring-1 ring-zinc-950/[0.04]"
            >
              <p className="mb-3 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-800 dark:text-zinc-200">
                <Calendar className="h-3.5 w-3.5" />
                Save excuse as leave request
              </p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <label className="flex flex-col gap-1 text-xs">
                  <span className="font-semibold text-zinc-600 dark:text-zinc-400">Excuse date</span>
                  <input
                    type="date"
                    required
                    value={excuseDate}
                    onChange={(e) => setExcuseDate(e.target.value)}
                    className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-2.5 text-sm shadow-sm focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-200/80 dark:focus:ring-zinc-700"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs">
                  <span className="font-semibold text-zinc-600 dark:text-zinc-400">Start time</span>
                  <input
                    type="time"
                    required
                    value={excuseStartTime}
                    onChange={(e) => setExcuseStartTime(e.target.value)}
                    className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-2.5 text-sm shadow-sm focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-200/80 dark:focus:ring-zinc-700"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs">
                  <span className="font-semibold text-zinc-600 dark:text-zinc-400">End time</span>
                  <input
                    type="time"
                    required
                    value={excuseEndTime}
                    onChange={(e) => setExcuseEndTime(e.target.value)}
                    className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-2.5 text-sm shadow-sm focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-200/80 dark:focus:ring-zinc-700"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs sm:col-span-2 lg:col-span-1">
                  <span className="font-semibold text-zinc-600 dark:text-zinc-400">Notes (optional)</span>
                  <input
                    type="text"
                    value={newNotes}
                    onChange={(e) => setNewNotes(e.target.value)}
                    placeholder="e.g. Medical appointment"
                    className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-2.5 text-sm shadow-sm focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-200/80 dark:focus:ring-zinc-700"
                  />
                </label>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <button
                  type="submit"
                  disabled={saving || recording}
                  className="inline-flex items-center gap-2 rounded-full border border-zinc-200/90 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-zinc-800 dark:text-zinc-200 shadow-sm transition hover:bg-zinc-50 dark:hover:bg-zinc-800/50 disabled:pointer-events-none disabled:opacity-50"
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
            <div className="py-12 text-center border-2 border-dashed border-zinc-100 dark:border-zinc-800/50 rounded-2xl">
              <Plane className="h-10 w-10 text-zinc-200 mx-auto mb-3" />
              <p className="text-zinc-400 italic text-sm">No manual vacation records on file.</p>
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
                    className="flex flex-col gap-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/50 p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-zinc-100 dark:bg-zinc-800 px-2.5 py-0.5 text-[11px] font-semibold text-zinc-800 dark:text-zinc-200 ring-1 ring-zinc-200/70">
                          {typeLabel}
                        </span>
                        {days != null && (
                          <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                            {days} day{days !== 1 ? "s" : ""}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                        {toDateInputValue(r.startDate)} → {toDateInputValue(r.endDate)}
                      </p>
                      {r.notes && (
                        <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">{r.notes}</p>
                      )}
                      {r.recordedBy && (
                        <p className="mt-1 text-[10px] text-zinc-400">
                          Recorded by {r.recordedBy}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => void handleRemove(idx)}
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-rose-200 bg-white dark:bg-zinc-900 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-50 disabled:opacity-50"
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

        <div className="relative flex items-center justify-end gap-3 p-6 md:px-8 pt-4 border-t border-zinc-100 dark:border-zinc-800/50 shrink-0 bg-white dark:bg-zinc-900">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-5 py-2.5 text-sm font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
