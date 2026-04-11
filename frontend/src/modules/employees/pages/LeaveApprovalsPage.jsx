import { useCallback, useEffect, useState } from "react";
import { Layout } from "@/shared/components/Layout";
import { useToast } from "@/shared/components/ToastProvider";
import { useAppSelector } from "@/shared/hooks/reduxHooks";
import {
  listLeaveRequestsApi,
  leaveRequestActionApi,
  directRecordLeaveRequestApi,
  getLeaveRequestHistoryApi,
} from "../api";
import { LeaveBalanceCreditHistory } from "../components/LeaveBalanceCreditHistory";
import { normaliseRoleKey } from "@/shared/components/EntityBadges";
import { Loader2, Check, X, ChevronDown, ChevronUp, Clock, History } from "lucide-react";

const HR_ROLES = new Set(["HR_STAFF", "HR_MANAGER", "ADMIN"]);

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

function fmtDateTime(d) {
  if (!d) return "—";
  return new Date(d).toLocaleString(undefined, {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function stepLabel(role) {
  if (role === "MANAGEMENT") return "Manager or team leader";
  if (role === "HR") return "HR";
  return role || "—";
}

function ApprovalPipeline({ approvals }) {
  if (!approvals?.length) return null;
  return (
    <div className="mt-2 flex items-center gap-1 text-xs">
      {approvals.map((a, i) => {
        const bg =
          a.status === "APPROVED" ? "bg-emerald-100 text-emerald-800 border-emerald-200" :
          a.status === "REJECTED" ? "bg-rose-100 text-rose-800 border-rose-200" :
          "bg-slate-100 text-slate-600 border-slate-200";
        return (
          <div key={i} className="flex items-center gap-1">
            {i > 0 && <span className="text-slate-300">→</span>}
            <span className={`rounded-md border px-2 py-0.5 font-medium ${bg}`}>
              {a.role === "MANAGEMENT" ? "Mgmt" : a.role} · {a.status}
            </span>
            {a.processedBy && (
              <span className="text-slate-400 text-[10px]">{a.processedBy}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function AuditTrail({ requestId }) {
  const [logs, setLogs] = useState(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const load = async () => {
    if (logs) { setOpen(!open); return; }
    setLoading(true);
    try {
      const data = await getLeaveRequestHistoryApi(requestId);
      setLogs(data);
      setOpen(true);
    } catch { setLogs([]); setOpen(true); }
    finally { setLoading(false); }
  };

  return (
    <div className="mt-2">
      <button
        type="button" onClick={load}
        className="inline-flex items-center gap-1 text-xs font-medium text-indigo-700 hover:underline"
      >
        <History className="h-3 w-3" />
        {loading ? "Loading..." : open ? "Hide audit trail" : "View audit trail"}
      </button>
      {open && logs && (
        <div className="mt-1 space-y-1">
          {logs.length === 0 && <p className="text-xs text-slate-400">No history entries.</p>}
          {logs.map((log, i) => (
            <div key={i} className="rounded border border-slate-100 bg-slate-50/60 px-2 py-1 text-[11px] text-slate-600">
              <span className="font-semibold text-slate-800">{log.operation}</span>
              {" by "}
              <span className="font-medium">{log.performedBy}</span>
              {" — "}
              <span>{fmtDateTime(log.performedAt || log.createdAt)}</span>
              {log.newValues?.comment && (
                <span className="ml-1 text-slate-500">"{log.newValues.comment}"</span>
              )}
              {log.newValues?.reason && (
                <span className="ml-1 text-slate-500">Reason: "{log.newValues.reason}"</span>
              )}
              {log.newValues?.forceApproved && (
                <span className="ml-1 font-medium text-amber-700">[HR force-approved]</span>
              )}
              {log.newValues?.onBehalf && (
                <span className="ml-1 font-medium text-blue-700">[on behalf of {log.newValues.targetEmployee}]</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function eligibilityBlock(r) {
  const e = r.eligibility;
  if (!e || e.eligible) return null;
  return (
    <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50/90 px-3 py-2 text-xs text-amber-950">
      <p className="font-semibold">Policy eligibility: not met yet</p>
      <p className="mt-0.5 text-amber-900/90">{e.reason || "Does not meet hire-date rules yet."}</p>
      {e.eligibleAfterDate != null && (
        <p className="mt-1">Eligible from approximately {fmtDate(e.eligibleAfterDate)}</p>
      )}
      {e.daysUntilEligible != null && e.daysUntilEligible > 0 && (
        <p>About {e.daysUntilEligible} calendar day(s) short of policy minimum after hire.</p>
      )}
      {r.preEligibility && (
        <p className="mt-2 font-medium text-amber-900 border-t border-amber-200/80 pt-2">
          If approved, this is recorded but does not deduct from leave balance (pre-eligibility).
        </p>
      )}
    </div>
  );
}

const STATUS_BADGE = {
  PENDING: "bg-amber-100 text-amber-800",
  APPROVED: "bg-emerald-100 text-emerald-800",
  REJECTED: "bg-rose-100 text-rose-800",
  CANCELLED: "bg-slate-200 text-slate-600",
};

export function LeaveApprovalsPage() {
  const { showToast } = useToast();
  const currentUser = useAppSelector((s) => s.identity.currentUser);
  const roleKey = currentUser ? normaliseRoleKey(currentUser.role) : "EMPLOYEE";
  const isHr = currentUser && HR_ROLES.has(roleKey);
  /** Department head or team leader (not HR) — can see team/department leave history. */
  const isMgmtApprover =
    currentUser &&
    !isHr &&
    (roleKey === "TEAM_LEADER" || roleKey === "MANAGER");

  const [tab, setTab] = useState("queue");
  const [loading, setLoading] = useState(true);
  const [list, setList] = useState([]);
  const [rejectId, setRejectId] = useState(null);
  const [rejectComment, setRejectComment] = useState("");
  const [acting, setActing] = useState(false);
  const [balanceByEmployeeId, setBalanceByEmployeeId] = useState({});
  const [expandedId, setExpandedId] = useState(null);

  const [excessModal, setExcessModal] = useState(null);
  const [excessMethod, setExcessMethod] = useState("SALARY");
  const [excessAmount, setExcessAmount] = useState("");

  const [allFilter, setAllFilter] = useState({ status: "", kind: "" });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (tab === "queue") {
        const data = await listLeaveRequestsApi({ queue: "1", limit: "100" });
        setList(data.requests || []);
        setBalanceByEmployeeId(data.balanceByEmployeeId || {});
      } else if (tab === "all" && isHr) {
        const params = { limit: "100" };
        if (allFilter.status) params.status = allFilter.status;
        if (allFilter.kind) params.kind = allFilter.kind;
        const data = await listLeaveRequestsApi(params);
        setList(data.requests || []);
        setBalanceByEmployeeId({});
      } else if (tab === "history" && isMgmtApprover) {
        const params = { managed: "1", limit: "100" };
        if (allFilter.status) params.status = allFilter.status;
        if (allFilter.kind) params.kind = allFilter.kind;
        const data = await listLeaveRequestsApi(params);
        setList(data.requests || []);
        setBalanceByEmployeeId({});
      } else {
        setList([]);
        setBalanceByEmployeeId({});
      }
    } catch (e) {
      showToast(e?.error || e?.message || "Failed to load", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast, tab, allFilter.status, allFilter.kind, isHr, isMgmtApprover]);

  useEffect(() => { void load(); }, [load]);

  const needsExcessDecision = (r) =>
    r.kind === "EXCUSE" && r.quotaExceeded && r.status === "PENDING" && !r.excessDeductionMethod;

  const openExcessModal = (id, mode) => {
    const r = list.find((x) => x._id === id);
    const defaultFraction = r?.computed?.minutes
      ? Number((r.computed.minutes / 480).toFixed(4))
      : 0.25;
    setExcessModal({ id, mode });
    setExcessMethod("SALARY");
    setExcessAmount(String(defaultFraction));
  };

  const approve = async (id) => {
    const r = list.find((x) => x._id === id);
    if (needsExcessDecision(r)) {
      openExcessModal(id, "approve");
      return;
    }
    setActing(true);
    try {
      await leaveRequestActionApi(id, { action: "APPROVE" });
      showToast("Approved", "success");
      void load();
    } catch (err) {
      showToast(err?.error || err?.message || "Action failed", "error");
    } finally { setActing(false); }
  };

  const directRecord = async (id) => {
    const r = list.find((x) => x._id === id);
    if (needsExcessDecision(r)) {
      openExcessModal(id, "direct");
      return;
    }
    setActing(true);
    try {
      await directRecordLeaveRequestApi(id);
      showToast("Recorded directly and approved", "success");
      void load();
    } catch (err) {
      showToast(err?.error || err?.message || "Action failed", "error");
    } finally { setActing(false); }
  };

  const submitExcessApproval = async (e) => {
    e.preventDefault();
    const amt = Number(excessAmount);
    if (!Number.isFinite(amt) || amt <= 0) {
      showToast("Deduction amount must be a positive number", "error");
      return;
    }
    setActing(true);
    try {
      const extras = { excessDeductionMethod: excessMethod, excessDeductionAmount: amt };
      if (excessModal.mode === "direct") {
        await directRecordLeaveRequestApi(excessModal.id, undefined, extras);
      } else {
        await leaveRequestActionApi(excessModal.id, { action: "APPROVE", ...extras });
      }
      showToast("Approved with deduction", "success");
      setExcessModal(null);
      void load();
    } catch (err) {
      showToast(err?.error || err?.message || "Action failed", "error");
    } finally { setActing(false); }
  };

  const submitReject = async (e) => {
    e.preventDefault();
    if (!rejectComment.trim()) { showToast("Comment is required to reject", "error"); return; }
    setActing(true);
    try {
      await leaveRequestActionApi(rejectId, { action: "REJECT", comment: rejectComment.trim() });
      showToast("Rejected", "success");
      setRejectId(null); setRejectComment("");
      void load();
    } catch (err) {
      showToast(err?.error || err?.message || "Action failed", "error");
    } finally { setActing(false); }
  };

  const nextStep = (r) => {
    const a = r.approvals || [];
    const p = a.find((x) => x.status === "PENDING");
    return stepLabel(p?.role);
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
      const ifCancelled = r.status === "PENDING" && days > 0 ? rem + days : null;
      const insufficientBalance = r.status === "PENDING" && (rem <= 0 || rem < days);
      return (
        <div className="mt-2 rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2 text-xs text-slate-600 space-y-0.5">
          <p className="font-medium text-slate-700">Vacation balance</p>
          <p>Entitlement {fmtDays(v.entitlementDays)} d · approved {fmtDays(v.approvedDays)} · pending {fmtDays(v.pendingDays)} · <span className="font-semibold text-slate-800">left {fmtDays(rem)} d</span></p>
          {Number(v.bonusDays) > 0 && <p className="text-teal-800 font-medium">Includes {fmtDays(v.bonusDays)} bonus day(s)</p>}
          {insufficientBalance && (
            <div className="mt-1.5 rounded-md border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-rose-800 font-medium">
              Insufficient balance — if approved, this will be recorded as unpaid leave (salary deduction applies).
            </div>
          )}
          {ifCancelled != null && !insufficientBalance && (
            <p className="text-slate-500">If withdrawn/rejected: left would be <strong className="text-slate-700">{fmtDays(ifCancelled)} d</strong></p>
          )}
          {v.credits?.length > 0 && (
            <LeaveBalanceCreditHistory credits={v.credits} compact maxRows={5} className="mt-2 border-t border-slate-200/80 pt-2" />
          )}
        </div>
      );
    }
    const ex = b.excuse;
    const remM = Number(ex.remainingMinutes);
    const excuseExhausted = r.status === "PENDING" && (remM <= 0 || remM < mins);
    const countExhausted = r.status === "PENDING" && ex.excusesAllowedInPeriod > 0 && ex.excusesUsedInPeriod >= ex.excusesAllowedInPeriod;
    return (
      <div className="mt-2 rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2 text-xs text-slate-600 space-y-0.5">
        <p className="font-medium text-slate-700">Excuse balance (monthly cap)</p>
        <p>Cap {fmtMins(ex.entitlementMinutes)} · used {fmtMins(ex.approvedMinutes)} · pending {fmtMins(ex.pendingMinutes)} · <span className="font-semibold text-slate-800">left {fmtMins(remM)}</span></p>
        {ex.excusesAllowedInPeriod > 0 && (
          <p>Excuses used this period: {ex.excusesUsedInPeriod} / {ex.excusesAllowedInPeriod}</p>
        )}
        {(excuseExhausted || countExhausted) && (
          <div className="mt-1.5 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-amber-800 font-medium">
            Excuse quota exhausted — HR will choose the deduction method (salary or vacation balance) when approving.
          </div>
        )}
      </div>
    );
  };

  const requestRow = (r) => {
    const isExpanded = expandedId === r._id;
    return (
      <li key={r._id} className="px-4 py-4 space-y-1">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-medium text-slate-900">{r.employeeEmail}</p>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_BADGE[r.status] || "bg-slate-100 text-slate-600"}`}>
                {r.status === "PENDING" && r.preEligibility
                  ? "PENDING (RECORDED)"
                  : r.status}
              </span>
              {r.onBehalf && <span className="rounded-full bg-blue-100 text-blue-700 px-2 py-0.5 text-[10px] font-medium">On behalf</span>}
              {r.status === "APPROVED" && r.effectivePaymentType === "UNPAID" && (
                <span className="rounded-full bg-rose-100 text-rose-700 px-2 py-0.5 text-[10px] font-semibold">UNPAID</span>
              )}
              {r.status === "APPROVED" && r.effectivePaymentType === "PAID" && (
                <span className="rounded-full bg-emerald-100 text-emerald-700 px-2 py-0.5 text-[10px] font-semibold">PAID</span>
              )}
              {r.quotaExceeded && (
                <span className="rounded-full bg-amber-100 text-amber-800 px-2 py-0.5 text-[10px] font-semibold">Quota exceeded</span>
              )}
            </div>
            <p className="text-sm text-slate-600 mt-0.5">
              {r.kind === "VACATION"
                ? `${r.leaveType || "ANNUAL"} · ${fmtDate(r.startDate)} – ${fmtDate(r.endDate)} (${r.computed?.days || 0} d)`
                : `Excuse · ${fmtDate(r.excuseDate)} ${r.startTime}–${r.endTime} (${r.computed?.minutes || 0} min)`}
            </p>
            {r.status === "PENDING" && (
              <p className="text-xs text-teal-700 font-medium mt-1">
                <Clock className="inline h-3 w-3 mr-0.5" />
                Waiting for: {nextStep(r)}
              </p>
            )}
            {r.quotaExceeded && r.excessDeductionMethod && (
              <p className="text-xs text-amber-700 mt-1 font-medium">
                Deduction: {r.excessDeductionMethod === "SALARY" ? "Salary" : "Vacation balance"} — {r.excessDeductionAmount} {r.excessDeductionMethod === "SALARY" ? "day(s) fraction" : "day(s)"}
                {r.status === "PENDING" && " (set by HR)"}
              </p>
            )}
            {r.cancellationReason && (
              <p className="text-xs text-rose-700 mt-1">Cancel reason: {r.cancellationReason}</p>
            )}
            <ApprovalPipeline approvals={r.approvals} />
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button type="button" onClick={() => setExpandedId(isExpanded ? null : r._id)}
              className="p-1 text-slate-400 hover:text-slate-600">
              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
            {r.status === "PENDING" && tab === "queue" && (
              <>
                <button type="button" disabled={acting} onClick={() => approve(r._id)}
                  className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm text-white hover:bg-emerald-700 disabled:opacity-50">
                  <Check className="h-4 w-4" /> Approve
                </button>
                <button type="button" disabled={acting}
                  onClick={() => { setRejectId(r._id); setRejectComment(""); }}
                  className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-sm text-rose-700 hover:bg-rose-50 disabled:opacity-50">
                  <X className="h-4 w-4" /> Reject
                </button>
                {isHr && (
                  <button type="button" disabled={acting} onClick={() => directRecord(r._id)}
                    title="Skip remaining steps and approve immediately"
                    className="inline-flex items-center gap-1 rounded-lg border border-teal-200 bg-white px-3 py-1.5 text-sm text-teal-700 hover:bg-teal-50 disabled:opacity-50">
                    <Check className="h-4 w-4" /> Record directly
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {isExpanded && (
          <div className="mt-2 space-y-2">
            {eligibilityBlock(r)}
            {balanceLines(r)}
            <AuditTrail requestId={r._id} />
          </div>
        )}
      </li>
    );
  };

  return (
    <Layout
      title="Leave approvals"
      description="HR first, then manager or team leader. Expand rows to see balance, eligibility, and audit trail."
    >
      <div className="max-w-5xl space-y-4">
        <div className="rounded-lg border border-indigo-100 bg-indigo-50/60 px-4 py-3 text-xs text-indigo-800 leading-relaxed">
          <strong>How the approval pipeline works:</strong> When an employee submits a leave request it first
          goes to <span className="font-semibold">HR</span> for review, then to their
          <span className="font-semibold"> manager or team leader</span> for final approval.
          {isHr
            ? " As HR, you review the first step. Use the \"All Requests\" tab to see every request across the company."
            : isMgmtApprover
              ? " Approve after HR on the pending queue. Use \"Team & department history\" to see all leave and excuses for people you manage (same scope as your approval step)."
              : " You will see requests from your direct reports waiting for your approval step."}
        </div>

        {isHr && (
          <div className="flex gap-2 border-b border-slate-200 pb-2">
            <button type="button" onClick={() => setTab("queue")}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${tab === "queue" ? "bg-teal-700 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}>
              Pending Queue
            </button>
            <button type="button" onClick={() => setTab("all")}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${tab === "all" ? "bg-teal-700 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}>
              All Requests
            </button>
          </div>
        )}

        {isMgmtApprover && (
          <div className="flex gap-2 border-b border-slate-200 pb-2">
            <button type="button" onClick={() => setTab("queue")}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${tab === "queue" ? "bg-teal-700 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}>
              Pending queue
            </button>
            <button type="button" onClick={() => setTab("history")}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${tab === "history" ? "bg-teal-700 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}>
              Team &amp; department history
            </button>
          </div>
        )}

        {(tab === "all" || tab === "history") && (
          <div className="flex flex-wrap gap-2">
            <select value={allFilter.status} onChange={(e) => setAllFilter((p) => ({ ...p, status: e.target.value }))}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm">
              <option value="">All statuses</option>
              <option value="PENDING">Pending</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
            <select value={allFilter.kind} onChange={(e) => setAllFilter((p) => ({ ...p, kind: e.target.value }))}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm">
              <option value="">All types</option>
              <option value="VACATION">Vacation</option>
              <option value="EXCUSE">Excuse</option>
            </select>
          </div>
        )}

        {rejectId && (
          <form onSubmit={submitReject} className="rounded-xl border border-rose-200 bg-rose-50/50 p-4 space-y-2">
            <p className="text-sm font-medium text-rose-900">Reject — comment required</p>
            <textarea value={rejectComment} onChange={(e) => setRejectComment(e.target.value)}
              rows={3} className="w-full rounded-lg border border-rose-200 px-3 py-2 text-sm"
              placeholder="Reason for rejection" required />
            <div className="flex gap-2">
              <button type="submit" disabled={acting}
                className="rounded-lg bg-rose-700 px-3 py-1.5 text-sm text-white hover:bg-rose-800 disabled:opacity-50">
                Confirm reject
              </button>
              <button type="button" onClick={() => { setRejectId(null); setRejectComment(""); }}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm">Cancel</button>
            </div>
          </form>
        )}

        {excessModal && (
          <form onSubmit={submitExcessApproval} className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 space-y-3">
            <p className="text-sm font-semibold text-amber-900">Excuse quota exceeded — choose deduction method</p>
            <p className="text-xs text-amber-800">This employee has exhausted their excuse quota. Choose how to handle the excess.</p>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" name="excessMethod" value="SALARY"
                  checked={excessMethod === "SALARY"} onChange={() => setExcessMethod("SALARY")} />
                <span>Deduct from salary <span className="text-xs text-slate-500">(day-fraction deducted from payroll)</span></span>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" name="excessMethod" value="VACATION_BALANCE"
                  checked={excessMethod === "VACATION_BALANCE"} onChange={() => setExcessMethod("VACATION_BALANCE")} />
                <span>Deduct from vacation balance <span className="text-xs text-slate-500">(days subtracted from leave entitlement)</span></span>
              </label>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Deduction amount ({excessMethod === "SALARY" ? "day-fraction, e.g. 0.25 = quarter day" : "days, e.g. 0.5 = half day"})
              </label>
              <input type="number" step="any" min="0.01" value={excessAmount}
                onChange={(e) => setExcessAmount(e.target.value)}
                className="w-40 rounded-lg border border-slate-200 px-3 py-1.5 text-sm" required />
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={acting}
                className="rounded-lg bg-amber-700 px-3 py-1.5 text-sm text-white hover:bg-amber-800 disabled:opacity-50">
                Approve with deduction
              </button>
              <button type="button" onClick={() => setExcessModal(null)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm">Cancel</button>
            </div>
          </form>
        )}

        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-teal-600" /></div>
          ) : list.length === 0 ? (
            <p className="py-12 text-center text-sm text-slate-500">
              {tab === "queue"
                ? "No pending items in your queue."
                : tab === "history"
                  ? "No leave requests match the filters for your team or department."
                  : "No requests match the current filters."}
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">{list.map(requestRow)}</ul>
          )}
        </div>
      </div>
    </Layout>
  );
}
