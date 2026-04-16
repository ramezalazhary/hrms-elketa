import { useCallback, useEffect, useMemo, useState } from "react";
import { Layout } from "@/shared/components/Layout";
import { Modal } from "@/shared/components/Modal";
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
import { canApproveLeaves } from "@/shared/utils/accessControl";
import { Loader2, Check, X, Clock } from "lucide-react";
import { fmtDate, fmtDateTime, fmtDays, fmtMins } from "../utils/leaveFormatters";
import { LeaveSurface } from "../components/leave/LeaveSurface";
import { LeaveStatusPill } from "../components/leave/LeaveStatusPill";
import { ApprovalTimeline, AuditTimeline } from "../components/leave/ApprovalTimeline";
import "../styles/leaveTheme.css";

const HR_ROLES = new Set(["HR", "HR_STAFF", "HR_MANAGER", "ADMIN"]);
const FORCE_APPROVER_ROLES = new Set(["HR_MANAGER", "ADMIN"]);

function employeeKey(r) {
  const id = r.employeeId;
  if (id && typeof id === "object" && id._id != null) return String(id._id);
  return String(id ?? "");
}

function stepLabel(role) {
  if (role === "MANAGEMENT") return "Manager or team leader";
  if (role === "HR") return "HR";
  return role || "—";
}

function formatLeaveActionError(err, fallback) {
  const raw = String(err?.error || err?.message || "").trim();
  if (!raw) return fallback;
  if (raw.includes("Only HR_MANAGER or ADMIN can resolve escalated requests")) {
    return "Only HR Manager or Admin can resolve escalated requests.";
  }
  if (raw.toLowerCase().includes("escalated excuse requires excess deduction")) {
    return "Escalated excuse approval needs deduction method and amount.";
  }
  if (raw.toLowerCase().includes("modified concurrently")) {
    return "Request changed by another approver. Reload and try again.";
  }
  return raw;
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

  return <AuditTimeline logs={logs} loading={loading} open={open} onToggle={load} />;
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

export function LeaveApprovalsPage() {
  const { showToast } = useToast();
  const currentUser = useAppSelector((s) => s.identity.currentUser);
  const roleKey = currentUser ? normaliseRoleKey(currentUser.role) : "EMPLOYEE";
  const isHr = currentUser && HR_ROLES.has(roleKey);
  const canDirectRecord = currentUser && FORCE_APPROVER_ROLES.has(roleKey);
  const canResolveEscalation = canDirectRecord;
  const canTakeActions = canApproveLeaves(currentUser);
  // Allow manager-history workflow for canonical manager/team-leader roles and
  // for override-based non-HR approvers who can act on queue items.
  const hasManagementRole = roleKey === "TEAM_LEADER" || roleKey === "MANAGER";
  /** Department head or team leader (not HR) — can see team/department leave history. */
  const isMgmtApprover =
    currentUser &&
    !isHr &&
    (hasManagementRole || canTakeActions);
  const preferredTab = canTakeActions ? "queue" : (isHr ? "all" : (isMgmtApprover ? "history" : "all"));

  const [tab, setTab] = useState(() => {
    if (canTakeActions) return "queue";
    if (isHr) return "all";
    if (isMgmtApprover) return "history";
    return "all";
  });
  const [loading, setLoading] = useState(true);
  const [list, setList] = useState([]);
  const [rejectId, setRejectId] = useState(null);
  const [rejectComment, setRejectComment] = useState("");
  const [acting, setActing] = useState(false);
  const [balanceByEmployeeId, setBalanceByEmployeeId] = useState({});
  const [selectedId, setSelectedId] = useState(null);

  const [excessModal, setExcessModal] = useState(null);
  const [excessMethod, setExcessMethod] = useState("SALARY");
  const [excessAmount, setExcessAmount] = useState("");

  const [allFilter, setAllFilter] = useState({ status: "", kind: "" });

  const load = useCallback(async () => {
    if (!currentUser) {
      setList([]);
      setBalanceByEmployeeId({});
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      if (tab === "queue") {
        if (!canTakeActions) {
          setList([]);
          setBalanceByEmployeeId({});
          return;
        }
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
  }, [showToast, tab, allFilter.status, allFilter.kind, isHr, isMgmtApprover, canTakeActions, currentUser]);

  useEffect(() => {
    if (!currentUser) return;
    const validTabs = new Set();
    if (canTakeActions) validTabs.add("queue");
    if (isHr) validTabs.add("all");
    if (isMgmtApprover) validTabs.add("history");
    if (!validTabs.size) validTabs.add("all");

    // Auto-recover only if current tab is invalid for this user state.
    // Do not force-reset when user intentionally switches between valid tabs
    // (e.g. manager/team leader queue <-> history).
    if (!validTabs.has(tab) && tab !== preferredTab) {
      setTab(preferredTab);
    }
  }, [tab, preferredTab, currentUser, canTakeActions, isHr, isMgmtApprover]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (list.length && !list.some((r) => r._id === selectedId)) {
      setSelectedId(list[0]._id);
    }
    if (!list.length) setSelectedId(null);
  }, [list, selectedId]);

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
      showToast(formatLeaveActionError(err, "Action failed"), "error");
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
      showToast(formatLeaveActionError(err, "Action failed"), "error");
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
      showToast(formatLeaveActionError(err, "Action failed"), "error");
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
      showToast(formatLeaveActionError(err, "Action failed"), "error");
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
        <div className="mt-2 rounded-lg border border-zinc-100 bg-zinc-50/80 px-3 py-2 text-xs text-zinc-600 space-y-0.5">
          <p className="font-medium text-zinc-700">Vacation balance</p>
          <p>Entitlement {fmtDays(v.entitlementDays)} d · approved {fmtDays(v.approvedDays)} · pending {fmtDays(v.pendingDays)} · <span className="font-semibold text-zinc-800">left {fmtDays(rem)} d</span></p>
          {Number(v.bonusDays) > 0 && <p className="font-medium text-zinc-800">Includes {fmtDays(v.bonusDays)} bonus day(s)</p>}
          {insufficientBalance && (
            <div className="mt-1.5 rounded-md border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-rose-800 font-medium">
              Insufficient balance — if approved, this will be recorded as unpaid leave (salary deduction applies).
            </div>
          )}
          {ifCancelled != null && !insufficientBalance && (
            <p className="text-zinc-500">If withdrawn/rejected: left would be <strong className="text-zinc-700">{fmtDays(ifCancelled)} d</strong></p>
          )}
          {v.credits?.length > 0 && (
            <LeaveBalanceCreditHistory credits={v.credits} compact maxRows={5} className="mt-2 border-t border-zinc-200/80 pt-2" />
          )}
        </div>
      );
    }
    const ex = b.excuse;
    const remM = Number(ex.remainingMinutes);
    const excuseExhausted = r.status === "PENDING" && (remM <= 0 || remM < mins);
    const countExhausted = r.status === "PENDING" && ex.excusesAllowedInPeriod > 0 && ex.excusesUsedInPeriod >= ex.excusesAllowedInPeriod;
    return (
      <div className="mt-2 rounded-lg border border-zinc-100 bg-zinc-50/80 px-3 py-2 text-xs text-zinc-600 space-y-0.5">
        <p className="font-medium text-zinc-700">Excuse balance (monthly cap)</p>
        <p>Cap {fmtMins(ex.entitlementMinutes)} · used {fmtMins(ex.approvedMinutes)} · pending {fmtMins(ex.pendingMinutes)} · <span className="font-semibold text-zinc-800">left {fmtMins(remM)}</span></p>
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

  const selectedRequest = useMemo(
    () => list.find((r) => r._id === selectedId) || null,
    [list, selectedId],
  );

  const requestSummaryRow = (r) => {
    const active = selectedId === r._id;
    const rowEmployeeId = String(r?.employeeId?._id ?? r?.employeeId ?? "");
    const meId = String(currentUser?.id ?? "");
    const mineById = meId && rowEmployeeId && meId === rowEmployeeId;
    const mineByEmail =
      String(r?.employeeEmail || "").trim().toLowerCase() ===
      String(currentUser?.email || "").trim().toLowerCase();
    const isMine = mineById || mineByEmail;
    let ownerBadge = "HR Queue Request";
    let ownerBadgeClass = "bg-violet-100 text-violet-800";
    if (isMine) {
      ownerBadge = "My Request";
      ownerBadgeClass = "bg-blue-100 text-blue-800";
    } else if (isMgmtApprover) {
      ownerBadge = "Team Request";
      ownerBadgeClass = "bg-emerald-100 text-emerald-800";
    }
    return (
      <button
        key={r._id}
        type="button"
        onClick={() => setSelectedId(r._id)}
        className={`w-full rounded-xl border px-3 py-3 text-left ${active ? "border-zinc-900 bg-zinc-50" : "border-zinc-200 bg-white"}`}
      >
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium text-zinc-900">{r.employeeEmail}</p>
          <LeaveStatusPill status={r.status} />
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${ownerBadgeClass}`}>{ownerBadge}</span>
        </div>
        <p className="mt-1 text-xs text-zinc-600">
          {r.kind === "VACATION"
            ? `${fmtDate(r.startDate)} to ${fmtDate(r.endDate)}`
            : `${fmtDate(r.excuseDate)} ${r.startTime}-${r.endTime}`}
        </p>
      </button>
    );
  };

  return (
    <Layout
      title="Leave approvals"
      description="HR and management decide. If decisions conflict, the request escalates to HR Manager/Admin."
    >
      <div className="leave-ui max-w-6xl space-y-4">
        <div className="rounded-[20px] bg-zinc-50/90 px-4 py-3 text-xs leading-relaxed text-zinc-800 ring-1 ring-zinc-200/80">
          <strong>How the approval pipeline works:</strong> When an employee submits a leave request it first
          goes to <span className="font-semibold">HR</span> for review, then to their
          <span className="font-semibold"> manager or team leader</span> for final approval.
          {" "}If one side approves and the other rejects, the request is marked
          <span className="font-semibold"> ESCALATED</span> for final decision by HR Manager/Admin.
          {isHr
            ? " As HR, you review the first step. Use the \"All Requests\" tab to see every request across the company."
            : isMgmtApprover
              ? " Approve after HR on the pending queue. Use \"Team & department history\" to see all leave and excuses for people you manage (same scope as your approval step)."
              : " You will see requests from your direct reports waiting for your approval step."}
        </div>

        {isHr && (
          <div className="inline-flex w-full max-w-md gap-0.5 rounded-2xl bg-zinc-100/90 p-1 ring-1 ring-zinc-200/80 sm:w-auto">
            {canTakeActions && (
              <button type="button" onClick={() => setTab("queue")}
                className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-medium transition sm:flex-none ${tab === "queue" ? "bg-white text-zinc-900 shadow-sm ring-1 ring-zinc-200/60" : "text-zinc-600 hover:text-zinc-900"}`}>
                Pending queue
              </button>
            )}
            <button type="button" onClick={() => setTab("all")}
              className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-medium transition sm:flex-none ${tab === "all" ? "bg-white text-zinc-900 shadow-sm ring-1 ring-zinc-200/60" : "text-zinc-600 hover:text-zinc-900"}`}>
              All requests
            </button>
          </div>
        )}

        {isMgmtApprover && (
          <div className="inline-flex w-full max-w-lg gap-0.5 rounded-2xl bg-zinc-100/90 p-1 ring-1 ring-zinc-200/80 sm:w-auto">
            {canTakeActions && (
              <button type="button" onClick={() => setTab("queue")}
                className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-medium transition sm:flex-none ${tab === "queue" ? "bg-white text-zinc-900 shadow-sm ring-1 ring-zinc-200/60" : "text-zinc-600 hover:text-zinc-900"}`}>
                Pending queue
              </button>
            )}
            <button type="button" onClick={() => setTab("history")}
              className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-medium transition sm:flex-none ${tab === "history" ? "bg-white text-zinc-900 shadow-sm ring-1 ring-zinc-200/60" : "text-zinc-600 hover:text-zinc-900"}`}>
              Team &amp; department history
            </button>
          </div>
        )}

        {(tab === "all" || tab === "history") && (
          <div className="flex flex-wrap gap-2">
            <select value={allFilter.status} onChange={(e) => setAllFilter((p) => ({ ...p, status: e.target.value }))}
              className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm">
              <option value="">All statuses</option>
              <option value="PENDING">Pending</option>
              <option value="ESCALATED">Escalated</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
            <select value={allFilter.kind} onChange={(e) => setAllFilter((p) => ({ ...p, kind: e.target.value }))}
              className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm">
              <option value="">All types</option>
              <option value="VACATION">Vacation</option>
              <option value="EXCUSE">Excuse</option>
            </select>
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
          <LeaveSurface className="p-3">
            {loading ? (
              <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-zinc-500" /></div>
            ) : list.length === 0 ? (
              <p className="py-12 text-center text-sm text-zinc-500">No requests for current filters.</p>
            ) : (
              <div className="space-y-2">{list.map(requestSummaryRow)}</div>
            )}
          </LeaveSurface>
          <LeaveSurface elevated className="p-5">
            {!selectedRequest ? (
              <p className="text-sm text-zinc-500">Select a request from the left panel.</p>
            ) : (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base font-semibold text-zinc-900">{selectedRequest.employeeEmail}</h3>
                  <LeaveStatusPill status={selectedRequest.status} />
                  {selectedRequest.onBehalf ? <LeaveStatusPill status="PENDING" label="On behalf" /> : null}
                </div>
                <p className="text-sm text-zinc-600">
                  {selectedRequest.kind === "VACATION"
                    ? `${selectedRequest.leaveType || "ANNUAL"} · ${fmtDate(selectedRequest.startDate)} – ${fmtDate(selectedRequest.endDate)}`
                    : `Excuse · ${fmtDate(selectedRequest.excuseDate)} ${selectedRequest.startTime}–${selectedRequest.endTime}`}
                </p>
                {(selectedRequest.status === "PENDING" || selectedRequest.status === "ESCALATED") ? (
                  <p className="text-xs font-medium text-zinc-700">
                    <Clock className="mr-1 inline h-3 w-3" />
                    {selectedRequest.status === "ESCALATED"
                      ? "Escalated and waiting for HR Manager/Admin resolution"
                      : `Waiting for ${nextStep(selectedRequest)}`}
                  </p>
                ) : null}
                <ApprovalTimeline approvals={selectedRequest.approvals} />
                {eligibilityBlock(selectedRequest)}
                {balanceLines(selectedRequest)}
                {selectedRequest.status === "PENDING" || (selectedRequest.status === "ESCALATED" && canResolveEscalation) ? (
                  tab === "queue" && canTakeActions ? (
                    <div className="flex flex-wrap gap-2 pt-2">
                      <button
                        type="button"
                        disabled={acting}
                        onClick={() => approve(selectedRequest._id)}
                        className="inline-flex items-center gap-1 rounded-full bg-zinc-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                      >
                        <Check className="h-4 w-4" />
                        {selectedRequest.status === "ESCALATED" ? "Resolve approve" : "Approve"}
                      </button>
                      <button
                        type="button"
                        disabled={acting}
                        onClick={() => { setRejectId(selectedRequest._id); setRejectComment(""); }}
                        className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-white px-3 py-2 text-sm text-rose-700 disabled:opacity-50"
                      >
                        <X className="h-4 w-4" />
                        {selectedRequest.status === "ESCALATED" ? "Resolve reject" : "Reject"}
                      </button>
                      {canDirectRecord && selectedRequest.status === "PENDING" ? (
                        <button
                          type="button"
                          disabled={acting}
                          onClick={() => directRecord(selectedRequest._id)}
                          className="rounded-full border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-800 disabled:opacity-50"
                        >
                          Record directly
                        </button>
                      ) : null}
                    </div>
                  ) : null
                ) : null}
                <AuditTrail requestId={selectedRequest._id} />
              </div>
            )}
          </LeaveSurface>
        </div>
      </div>

      <Modal open={Boolean(rejectId)} title="Reject request" onClose={() => { setRejectId(null); setRejectComment(""); }}>
        <form onSubmit={submitReject} className="space-y-3">
          <textarea
            value={rejectComment}
            onChange={(e) => setRejectComment(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-rose-200 px-3 py-2 text-sm"
            placeholder="Reason for rejection"
            required
          />
          <button type="submit" disabled={acting} className="rounded-lg bg-rose-700 px-3 py-2 text-sm text-white disabled:opacity-50">
            Confirm reject
          </button>
        </form>
      </Modal>

      <Modal open={Boolean(excessModal)} title="Excuse deduction" onClose={() => setExcessModal(null)}>
        <form onSubmit={submitExcessApproval} className="space-y-3">
          <div className="space-y-2 text-sm">
            <label className="flex items-center gap-2">
              <input type="radio" value="SALARY" checked={excessMethod === "SALARY"} onChange={() => setExcessMethod("SALARY")} />
              Deduct from salary
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" value="VACATION_BALANCE" checked={excessMethod === "VACATION_BALANCE"} onChange={() => setExcessMethod("VACATION_BALANCE")} />
              Deduct from vacation balance
            </label>
          </div>
          <input
            type="number"
            step="any"
            min="0.01"
            value={excessAmount}
            onChange={(e) => setExcessAmount(e.target.value)}
            className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
            required
          />
          <button type="submit" disabled={acting} className="rounded-lg bg-amber-700 px-3 py-2 text-sm text-white disabled:opacity-50">
            Approve with deduction
          </button>
        </form>
      </Modal>
    </Layout>
  );
}
