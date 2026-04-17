import { useCallback, useEffect, useState } from "react";
import { Layout } from "@/shared/components/Layout";
import { useToast } from "@/shared/components/ToastProvider";
import {
  getBonusApprovalsApi,
  approveBonusApi,
  rejectBonusApi,
} from "../api";
import {
  Loader2,
  Check,
  X,
  Star,
  CalendarDays,
  AlertTriangle,
  Gift,
  Clock,
  Minus,
} from "lucide-react";

const MONTH_NAMES = [
  "", "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export function BonusApprovalsPage() {
  const { showToast } = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(null);
  const [rejectId, setRejectId] = useState(null);
  const [rejectReason, setRejectReason] = useState("");

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getBonusApprovalsApi();
      setItems(data || []);
    } catch (e) {
      showToast("Failed to load bonus approvals", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const handleApprove = async (item) => {
    const key = `${item.employeeId}-${item.assessmentId}`;
    setProcessing(key);
    try {
      await approveBonusApi(item.employeeId, item.assessmentId);
      showToast("Bonus approved successfully", "success");
      setItems((prev) =>
        prev.filter(
          (i) =>
            !(i.employeeId === item.employeeId && i.assessmentId === item.assessmentId)
        )
      );
    } catch (e) {
      showToast(e.message || "Failed to approve", "error");
    } finally {
      setProcessing(null);
    }
  };

  const openReject = (item) => {
    setRejectId(`${item.employeeId}-${item.assessmentId}`);
    setRejectReason("");
  };

  const handleReject = async (item) => {
    const key = `${item.employeeId}-${item.assessmentId}`;
    setProcessing(key);
    try {
      await rejectBonusApi(item.employeeId, item.assessmentId, rejectReason);
      showToast("Bonus rejected", "success");
      setItems((prev) =>
        prev.filter(
          (i) =>
            !(i.employeeId === item.employeeId && i.assessmentId === item.assessmentId)
        )
      );
      setRejectId(null);
    } catch (e) {
      showToast(e.message || "Failed to reject", "error");
    } finally {
      setProcessing(null);
    }
  };

  const fmtPeriod = (p) =>
    p ? `${MONTH_NAMES[p.month] || p.month} ${p.year}` : "—";

  return (
    <Layout>
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 ring-1 ring-zinc-200/80 dark:ring-zinc-700">
            <Gift size={20} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
              Bonus Approvals
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Review and approve/reject assessment-based bonuses before payroll
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="animate-spin text-zinc-400" size={28} />
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-[20px] bg-white dark:bg-zinc-900 px-6 py-16 text-center shadow-sm ring-1 ring-zinc-950/[0.06] dark:ring-zinc-800">
            <Check className="mx-auto mb-3 text-zinc-300" size={36} />
            <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
              No pending bonus approvals
            </p>
            <p className="mt-1 text-xs text-zinc-400">
              All assessment bonuses have been processed
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2 rounded-[20px] bg-amber-50/80 px-4 py-2.5 text-sm text-amber-950 ring-1 ring-amber-200/70">
              <AlertTriangle size={16} className="shrink-0" />
              <span>
                <strong>{items.length}</strong> assessment bonus
                {items.length !== 1 ? "es" : ""} pending your review
              </span>
            </div>

            <div className="divide-y divide-zinc-100 dark:divide-zinc-800 overflow-hidden rounded-[20px] bg-white dark:bg-zinc-900 shadow-sm ring-1 ring-zinc-950/[0.06] dark:ring-zinc-800">
              {items.length > 0 && items?.map((item) => {
                const key = `${item.employeeId}-${item.assessmentId}`;
                const isBusy = processing === key;
                const isRejecting = rejectId === key;

                return (
                  <div
                    key={key}
                    className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start"
                  >
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                          {item.employeeName || "—"}
                        </span>
                        {item.employeeCode && (
                          <span className="rounded-md border border-zinc-200/80 dark:border-zinc-800/80 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-zinc-800 dark:text-zinc-200">
                            {item.employeeCode}
                          </span>
                        )}
                        {item.department && (
                          <span className="text-xs text-zinc-400">
                            {item.department}
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-600 dark:text-zinc-400">
                        <span className="inline-flex items-center gap-1">
                          <CalendarDays size={13} className="text-zinc-400" />
                          {fmtPeriod(item.period)}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Star size={13} className="text-amber-500" />
                          Rating: {item.overall}/5
                        </span>
                        {item.evaluator && (
                          <span className="text-zinc-400">
                            by{" "}
                            {typeof item.evaluator === "object"
                              ? item.evaluator.fullName
                              : item.evaluator}
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-3 text-xs">
                        {item.daysBonus > 0 && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 font-medium text-zinc-800 dark:text-zinc-200 ring-1 ring-zinc-200/70">
                            <Gift size={12} />
                            +{item.daysBonus}d bonus
                          </span>
                        )}
                        {item.overtime > 0 && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-zinc-50 dark:bg-zinc-800/50 px-2 py-0.5 font-medium text-zinc-700 dark:text-zinc-300 ring-1 ring-zinc-200/80 dark:ring-zinc-700">
                            <Clock size={12} />
                            +{item.overtime}d overtime
                          </span>
                        )}
                        {item.deduction > 0 && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 font-medium text-rose-700 ring-1 ring-rose-200">
                            <Minus size={12} />
                            -{item.deduction}d deduction
                          </span>
                        )}
                      </div>

                      {item.feedback && (
                        <p className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
                          {item.feedback}
                        </p>
                      )}

                      {isRejecting && (
                        <div className="mt-2 space-y-2 rounded-lg border border-rose-200 bg-rose-50/60 p-3">
                          <label className="block text-xs font-medium text-rose-700">
                            Rejection Reason
                          </label>
                          <textarea
                            className="w-full rounded-md border border-rose-200 bg-white dark:bg-zinc-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-rose-300"
                            rows={2}
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            placeholder="Provide a reason for rejection..."
                          />
                          <div className="flex gap-2">
                            <button
                              className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-rose-700 disabled:opacity-50"
                              disabled={isBusy}
                              onClick={() => handleReject(item)}
                            >
                              {isBusy ? "Rejecting..." : "Confirm Reject"}
                            </button>
                            <button
                              className="rounded-lg border border-zinc-200 dark:border-zinc-800 px-3 py-1.5 text-xs text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                              onClick={() => setRejectId(null)}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {!isRejecting && (
                      <div className="flex shrink-0 gap-2">
                        <button
                          className="inline-flex items-center gap-1.5 rounded-full bg-zinc-900 px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-zinc-800 disabled:opacity-50"
                          disabled={isBusy}
                          onClick={() => handleApprove(item)}
                        >
                          {isBusy ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <Check size={14} />
                          )}
                          Approve
                        </button>
                        <button
                          className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3.5 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-300 shadow-sm hover:bg-zinc-50 dark:hover:bg-zinc-800/50 disabled:opacity-50"
                          disabled={isBusy}
                          onClick={() => openReject(item)}
                        >
                          <X size={14} />
                          Reject
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
