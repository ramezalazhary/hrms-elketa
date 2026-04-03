import { useState } from "react";
import { X, Gift } from "lucide-react";
import { postLeaveBalanceCreditApi } from "../api";

/**
 * HR-only modal to add formal / extra vacation entitlement days.
 */
export function LeaveBalanceCreditModal({
  employeeId,
  employeeName,
  onClose,
  onSuccess,
}) {
  const [days, setDays] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    const n = parseInt(days, 10);
    if (!Number.isFinite(n) || n < 1) {
      setError("Enter a whole number of days (1 or more).");
      return;
    }
    const r = reason.trim();
    if (!r) {
      setError("Reason is required.");
      return;
    }
    setSubmitting(true);
    try {
      const snapshot = await postLeaveBalanceCreditApi({
        employeeId,
        days: n,
        reason: r,
      });
      onSuccess?.(snapshot);
      onClose();
    } catch (err) {
      setError(
        typeof err === "object" && err?.error
          ? err.error
          : err?.message || "Failed to add credit",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl border border-teal-100 bg-white p-6 shadow-2xl relative">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2 mb-1">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-100 text-teal-700">
            <Gift className="h-5 w-5" />
          </div>
          <h2 className="text-lg font-bold text-slate-900">Vacation balance credit</h2>
        </div>
        <p className="text-sm text-slate-600 mb-4">
          Add extra annual leave days for{" "}
          <span className="font-semibold text-slate-800">{employeeName}</span> (e.g. formal
          vacation entitlement). This increases their remaining balance for new requests.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
              Days to add
            </label>
            <input
              type="number"
              min={1}
              max={365}
              step={1}
              value={days}
              onChange={(e) => setDays(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              placeholder="e.g. 3"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
              Reason
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              maxLength={500}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              placeholder="Why is this credit being added?"
              required
            />
          </div>
          {error && (
            <p className="text-sm text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
            >
              {submitting ? "Saving…" : "Add credit"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
