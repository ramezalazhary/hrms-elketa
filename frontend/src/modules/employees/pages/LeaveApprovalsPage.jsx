import { useCallback, useEffect, useState } from "react";
import { Layout } from "@/shared/components/Layout";
import { useToast } from "@/shared/components/ToastProvider";
import { listLeaveRequestsApi, leaveRequestActionApi } from "../api";
import { LeaveBalanceCreditHistory } from "../components/LeaveBalanceCreditHistory";
import { Loader2, Check, X } from "lucide-react";

function employeeKey(r) {
  const id = r.employeeId;
  if (id && typeof id === "object" && id._id != null) return String(id._id);
  return String(id ?? "");
}

function fmtDays(n) {
  const x = Number(n);
  if (Number.isNaN(x)) return "—";
  return Math.abs(x % 1) < 1e-9 ? String(x) : x.toFixed(1);
}

function fmtMins(m) {
  const x = Number(m);
  if (Number.isNaN(x)) return "—";
  if (x >= 60 && x % 60 === 0) return `${x / 60} h`;
  return `${x} min`;
}

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function LeaveApprovalsPage() {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [list, setList] = useState([]);
  const [rejectId, setRejectId] = useState(null);
  const [rejectComment, setRejectComment] = useState("");
  const [acting, setActing] = useState(false);
  const [balanceByEmployeeId, setBalanceByEmployeeId] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listLeaveRequestsApi({ queue: "1", limit: "100" });
      setList(data.requests || []);
      setBalanceByEmployeeId(data.balanceByEmployeeId || {});
    } catch (e) {
      showToast(e?.error || e?.message || "Failed to load queue", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    void load();
  }, [load]);

  const approve = async (id) => {
    setActing(true);
    try {
      await leaveRequestActionApi(id, { action: "APPROVE" });
      showToast("Approved", "success");
      void load();
    } catch (err) {
      showToast(err?.error || err?.message || "Action failed", "error");
    } finally {
      setActing(false);
    }
  };

  const submitReject = async (e) => {
    e.preventDefault();
    if (!rejectComment.trim()) {
      showToast("Comment is required to reject", "error");
      return;
    }
    setActing(true);
    try {
      await leaveRequestActionApi(rejectId, {
        action: "REJECT",
        comment: rejectComment.trim(),
      });
      showToast("Rejected", "success");
      setRejectId(null);
      setRejectComment("");
      void load();
    } catch (err) {
      showToast(err?.error || err?.message || "Action failed", "error");
    } finally {
      setActing(false);
    }
  };

  const nextStep = (r) => {
    const a = r.approvals || [];
    const p = a.find((x) => x.status === "PENDING");
    return p?.role || "—";
  };

  const balanceLines = (r) => {
    const key = employeeKey(r);
    const b = balanceByEmployeeId[key];
    if (!b) return null;
    const days = r.computed?.days ?? 0;
    const mins = r.computed?.minutes ?? 0;
    if (r.kind === "VACATION") {
      const v = b.vacation;
      const rem = Number(v.remainingDays);
      const ifCancelled =
        r.status === "PENDING" && days > 0 ? rem + days : null;
      return (
        <div className="mt-2 rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2 text-xs text-slate-600 space-y-0.5">
          <p className="font-medium text-slate-700">Vacation balance (policy year view)</p>
          <p>
            Entitlement {fmtDays(v.entitlementDays)} d · approved {fmtDays(v.approvedDays)} ·
            pending {fmtDays(v.pendingDays)} · <span className="font-semibold text-slate-800">left {fmtDays(rem)} d</span>
          </p>
          {Number(v.bonusDays) > 0 && (
            <p className="text-teal-800 font-medium">
              Includes {fmtDays(v.bonusDays)} bonus day(s) (base {fmtDays(v.baseEntitlementDays)} d)
            </p>
          )}
          <p className="text-slate-500">
            This request: {fmtDays(days)} d · If fully approved, <strong className="text-slate-700">left stays {fmtDays(rem)} d</strong> (moves from pending to approved; total reserved unchanged).
            {ifCancelled != null && (
              <>
                {" "}
                If withdrawn/rejected, left would be <strong className="text-slate-700">{fmtDays(ifCancelled)} d</strong>.
              </>
            )}
          </p>
          {v.credits?.length > 0 && (
            <LeaveBalanceCreditHistory
              credits={v.credits}
              compact
              maxRows={5}
              className="mt-2 border-t border-slate-200/80 pt-2"
            />
          )}
        </div>
      );
    }
    const ex = b.excuse;
    const remM = Number(ex.remainingMinutes);
    const ifCancelledM =
      r.status === "PENDING" && mins > 0 ? remM + mins : null;
    return (
      <div className="mt-2 rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2 text-xs text-slate-600 space-y-0.5">
        <p className="font-medium text-slate-700">Excuse balance (per policy monthly cap)</p>
        <p>
          Cap {fmtMins(ex.entitlementMinutes)} · used {fmtMins(ex.approvedMinutes)} ·
          pending {fmtMins(ex.pendingMinutes)} ·{" "}
          <span className="font-semibold text-slate-800">left {fmtMins(remM)}</span>
        </p>
        <p className="text-slate-500">
          This request: {fmtMins(mins)} · If fully approved, <strong className="text-slate-700">left stays {fmtMins(remM)}</strong>.
          {ifCancelledM != null && (
            <>
              {" "}
              If withdrawn/rejected, left would be <strong className="text-slate-700">{fmtMins(ifCancelledM)}</strong>.
            </>
          )}
        </p>
      </div>
    );
  };

  return (
    <Layout
      title="Leave approvals"
      description="Requests waiting for your step in the chain (team leader → manager → HR)."
    >
      <div className="max-w-4xl space-y-4">
        {rejectId && (
          <form
            onSubmit={submitReject}
            className="rounded-xl border border-rose-200 bg-rose-50/50 p-4 space-y-2"
          >
            <p className="text-sm font-medium text-rose-900">Reject — comment required</p>
            <textarea
              value={rejectComment}
              onChange={(e) => setRejectComment(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-rose-200 px-3 py-2 text-sm"
              placeholder="Reason for rejection"
              required
            />
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={acting}
                className="rounded-lg bg-rose-700 px-3 py-1.5 text-sm text-white hover:bg-rose-800 disabled:opacity-50"
              >
                Confirm reject
              </button>
              <button
                type="button"
                onClick={() => { setRejectId(null); setRejectComment(""); }}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
            </div>
          ) : list.length === 0 ? (
            <p className="py-12 text-center text-sm text-slate-500">No pending items in your queue.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {list.map((r) => (
                <li key={r._id} className="px-4 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-slate-900">{r.employeeEmail}</p>
                    <p className="text-sm text-slate-600 mt-0.5">
                      {r.kind === "VACATION"
                        ? `${r.leaveType || "ANNUAL"} · ${fmtDate(r.startDate)} – ${fmtDate(r.endDate)}`
                        : `Excuse · ${fmtDate(r.excuseDate)} ${r.startTime}–${r.endTime}`}
                    </p>
                    <p className="text-xs text-teal-700 font-medium mt-1">Next step: {nextStep(r)}</p>
                    {balanceLines(r)}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      type="button"
                      disabled={acting}
                      onClick={() => approve(r._id)}
                      className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm text-white hover:bg-emerald-700 disabled:opacity-50"
                    >
                      <Check className="h-4 w-4" />
                      Approve
                    </button>
                    <button
                      type="button"
                      disabled={acting}
                      onClick={() => { setRejectId(r._id); setRejectComment(""); }}
                      className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-sm text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                    >
                      <X className="h-4 w-4" />
                      Reject
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Layout>
  );
}
