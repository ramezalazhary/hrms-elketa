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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/40 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-md rounded-[20px] border border-zinc-200/90 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 p-6 shadow-2xl ring-1 ring-zinc-950/[0.06] dark:ring-zinc-800">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-700 dark:hover:text-zinc-300"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2 mb-1">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 ring-1 ring-zinc-200/80 dark:ring-zinc-700">
            <Gift className="h-5 w-5" />
          </div>
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Vacation balance credit</h2>
        </div>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
          Add extra annual leave days for{" "}
          <span className="font-semibold text-zinc-800 dark:text-zinc-200">{employeeName}</span> (e.g. formal
          vacation entitlement). This increases their remaining balance for new requests.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 mb-1">
              Days to add
            </label>
            <input
              type="number"
              min={1}
              max={365}
              step={1}
              value={days}
              onChange={(e) => setDays(e.target.value)}
              className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 px-3 py-2 text-sm transition focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-200/80 dark:focus:ring-zinc-700"
              placeholder="e.g. 3"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 mb-1">
              Reason
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              maxLength={500}
              className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 px-3 py-2 text-sm transition focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-200/80 dark:focus:ring-zinc-700"
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
              className="rounded-lg border border-zinc-200 dark:border-zinc-800 px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-full bg-zinc-900 px-5 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-50"
            >
              {submitting ? "Saving…" : "Add credit"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
