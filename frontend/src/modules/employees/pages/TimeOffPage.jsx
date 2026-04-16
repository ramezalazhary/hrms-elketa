import { useCallback, useEffect, useMemo, useState } from "react";
import { Layout } from "@/shared/components/Layout";
import { Modal } from "@/shared/components/Modal";
import { useToast } from "@/shared/components/ToastProvider";
import { useAppSelector, useAppDispatch } from "@/shared/hooks/reduxHooks";
import { fetchEmployeesThunk } from "@/modules/employees/store";
import {
  listLeaveRequestsApi,
  createLeaveRequestApi,
  cancelLeaveRequestApi,
  getLeaveBalanceApi,
  getLeaveRequestHistoryApi,
} from "../api";
import { normaliseRoleKey } from "@/shared/components/EntityBadges";
import { Loader2, Plus, Search } from "lucide-react";
import { fmtDate, fmtDateTime, fmtDays, fmtMins } from "../utils/leaveFormatters";
import { LeaveSurface } from "../components/leave/LeaveSurface";
import { LeaveSectionHeader } from "../components/leave/LeaveSectionHeader";
import { LeaveStatusPill } from "../components/leave/LeaveStatusPill";
import { ApprovalTimeline, AuditTimeline } from "../components/leave/ApprovalTimeline";
import "../styles/leaveTheme.css";

const LEAVE_TYPES = [
  { value: "ANNUAL", label: "Annual" },
  { value: "SICK", label: "Sick" },
  { value: "UNPAID", label: "Unpaid" },
  { value: "MATERNITY", label: "Maternity" },
  { value: "PATERNITY", label: "Paternity" },
  { value: "OTHER", label: "Other" },
];

const HR_ROLES = new Set(["HR", "HR_STAFF", "HR_MANAGER", "ADMIN"]);
const HR_MANAGER_ONLY_ROLES = new Set(["HR_MANAGER"]);

function RequestAuditTrail({ requestId }) {
  const [logs, setLogs] = useState(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const load = async () => {
    if (logs) {
      setOpen((v) => !v);
      return;
    }
    setLoading(true);
    try {
      setLogs(await getLeaveRequestHistoryApi(requestId));
      setOpen(true);
    } catch {
      setLogs([]);
      setOpen(true);
    } finally {
      setLoading(false);
    }
  };
  return <AuditTimeline logs={logs} loading={loading} open={open} onToggle={load} />;
}

export function PersonalTimeOffSection() {
  const { showToast } = useToast();
  const dispatch = useAppDispatch();
  const currentUser = useAppSelector((s) => s.identity.currentUser);
  const employees = useAppSelector((s) => s.employees.items);
  const roleKey = currentUser ? normaliseRoleKey(currentUser.role) : "EMPLOYEE";
  const isHr = currentUser && HR_ROLES.has(roleKey);
  const canCancelApproved = currentUser && HR_MANAGER_ONLY_ROLES.has(roleKey);

  const [loading, setLoading] = useState(true);
  const [list, setList] = useState([]);
  const [balance, setBalance] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [kind, setKind] = useState("VACATION");
  const [leaveType, setLeaveType] = useState("ANNUAL");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [excuseDate, setExcuseDate] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");

  const [onBehalf, setOnBehalf] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [empSearch, setEmpSearch] = useState("");

  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelReason, setCancelReason] = useState("");

  useEffect(() => {
    if (isHr && onBehalf && !employees.length) {
      dispatch(fetchEmployeesThunk());
    }
  }, [isHr, onBehalf, employees.length, dispatch]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [data, bal] = await Promise.all([
        listLeaveRequestsApi({ mine: "1", limit: "100" }),
        getLeaveBalanceApi().catch(() => null),
      ]);
      setList(data.requests || []);
      setBalance(bal);
    } catch (e) {
      showToast(e?.error || e?.message || "Failed to load requests", "error");
    } finally { setLoading(false); }
  }, [showToast]);

  useEffect(() => { void load(); }, [load]);

  const onSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const body = kind === "VACATION"
        ? { kind, leaveType, startDate, endDate }
        : { kind, excuseDate, startTime, endTime };
      if (onBehalf && selectedEmployeeId) body.employeeId = selectedEmployeeId;
      await createLeaveRequestApi(body);
      if (onBehalf && selectedEmployeeId) {
        showToast("Request submitted on behalf. View it in Leave Approvals → All Requests.", "success");
      } else {
        showToast("Request submitted", "success");
      }
      setShowForm(false);
      setStartDate(""); setEndDate(""); setExcuseDate("");
      setOnBehalf(false); setSelectedEmployeeId(""); setEmpSearch("");
      void load();
    } catch (err) {
      const msg = typeof err === "object" && err?.error ? err.error : err?.message || "Submit failed";
      showToast(msg, "error");
    } finally { setSubmitting(false); }
  };

  const onCancel = async (id, reason) => {
    try {
      await cancelLeaveRequestApi(id, reason);
      showToast("Request cancelled", "success");
      setCancelTarget(null); setCancelReason("");
      void load();
    } catch (err) {
      showToast(err?.error || err?.message || "Cancel failed", "error");
    }
  };

  const pendingList = list.filter((r) => r.status === "PENDING");
  const approvedHistory = list.filter((r) => r.status === "APPROVED")
    .sort((a, b) => new Date(b.submittedAt || b.createdAt || 0) - new Date(a.submittedAt || a.createdAt || 0));
  const otherList = list.filter((r) => r.status !== "PENDING" && r.status !== "APPROVED");

  const filteredEmployees = employees.filter((emp) =>
    !empSearch || emp.fullName?.toLowerCase().includes(empSearch.toLowerCase()) ||
    emp.email?.toLowerCase().includes(empSearch.toLowerCase())
  ).slice(0, 10);

  const segmented = useMemo(() => {
    const pending = list.filter((r) => r.status === "PENDING");
    const approved = list
      .filter((r) => r.status === "APPROVED")
      .sort((a, b) => new Date(b.submittedAt || b.createdAt || 0) - new Date(a.submittedAt || a.createdAt || 0));
    const closed = list.filter((r) => r.status !== "PENDING" && r.status !== "APPROVED");
    return { pending, approved, closed };
  }, [list]);

  const requestRow = (r, { showCancel }) => (
    <li key={r._id} className="px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="leave-title text-sm font-semibold">
            {r.kind === "VACATION"
              ? `${r.leaveType || "ANNUAL"} · ${fmtDate(r.startDate)} – ${fmtDate(r.endDate)}`
              : `Excuse · ${fmtDate(r.excuseDate)} ${r.startTime}–${r.endTime}`}
          </p>
          <div className="mt-1 flex items-center gap-2 text-xs flex-wrap">
            <p>
              {r.computed?.days != null && r.kind === "VACATION" && `${r.computed.days} day(s) · `}
              {r.computed?.minutes != null && r.kind === "EXCUSE" && `${r.computed.minutes} min · `}
              Status:
            </p>
            <LeaveStatusPill status={r.status} />
            {r.status === "APPROVED" && r.effectivePaymentType ? <LeaveStatusPill status={r.effectivePaymentType} /> : null}
            {r.status === "APPROVED" && r.quotaExceeded ? <LeaveStatusPill status="ESCALATED" label="Quota exceeded" /> : null}
          </div>
          {r.onBehalf && <p className="mt-1 text-xs text-blue-700 font-medium">Submitted on behalf by {r.createdBy}</p>}
          {r.cancellationReason && <p className="mt-1 text-xs text-rose-700">Cancel reason: {r.cancellationReason}</p>}
          {r.approvals?.some((a) => a.status === "REJECTED" && a.comment) && (
            <p className="mt-1 text-xs text-rose-600">
              Rejection: {r.approvals.find((a) => a.status === "REJECTED")?.comment}
            </p>
          )}
          <ApprovalTimeline approvals={r.approvals} />
          <RequestAuditTrail requestId={r._id} />
        </div>
        {showCancel && r.status === "PENDING" ? (
          <button type="button" onClick={() => onCancel(r._id)}
            className="text-xs font-medium text-rose-600 hover:underline shrink-0">Cancel</button>
        ) : null}
        {showCancel && r.status === "APPROVED" && canCancelApproved ? (
          <button type="button" onClick={() => { setCancelTarget(r._id); setCancelReason(""); }}
            className="text-xs font-medium text-rose-600 hover:underline shrink-0">Cancel (HR)</button>
        ) : null}
      </div>
    </li>
  );

  return (
    <section className="leave-ui space-y-6">
      <LeaveSurface elevated className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="leave-title text-lg font-semibold">Time off workspace</h3>
            <p className="leave-meta text-sm">Submit vacation or excuse requests and track progress in one place.</p>
          </div>
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className="leave-transition inline-flex items-center gap-2 rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
          >
            <Plus className="h-4 w-4" />
            {showForm ? "Hide composer" : "New request"}
          </button>
        </div>
      </LeaveSurface>

      {balance ? (
        <LeaveSurface className="p-5">
          <h2 className="leave-title text-base font-semibold">Balance snapshot</h2>
          <div className="mt-3 grid gap-4 sm:grid-cols-2 text-sm">
            <div className="rounded-xl border border-zinc-100 bg-zinc-50 p-3">
              <p className="leave-meta text-xs font-semibold uppercase tracking-wide">Vacation</p>
              <p className="mt-1 leave-title">
                <span className="text-2xl font-semibold">{fmtDays(balance.vacation?.remainingDays)}</span> d left
              </p>
              <p className="leave-meta mt-1 text-xs">
                entitlement {fmtDays(balance.vacation?.entitlementDays)} · approved {fmtDays(balance.vacation?.approvedDays)} · pending {fmtDays(balance.vacation?.pendingDays)}
              </p>
            </div>
            <div className="rounded-xl border border-zinc-100 bg-zinc-50 p-3">
              <p className="leave-meta text-xs font-semibold uppercase tracking-wide">Excuse quota</p>
              <p className="mt-1 leave-title">
                <span className="text-2xl font-semibold">{fmtMins(balance.excuse?.remainingMinutes)}</span> left
              </p>
              <p className="leave-meta mt-1 text-xs">
                cap {fmtMins(balance.excuse?.entitlementMinutes)} · used {fmtMins(balance.excuse?.approvedMinutes)} · pending {fmtMins(balance.excuse?.pendingMinutes)}
              </p>
            </div>
          </div>
        </LeaveSurface>
      ) : null}

      {showForm ? (
        <LeaveSurface className="p-6">
          <form onSubmit={onSubmit} className="space-y-4">
            <LeaveSectionHeader title="Request composer" subtitle="Choose leave type, dates, and optional on-behalf submission." />

            {isHr && (
              <label className="flex items-center gap-2 text-sm text-zinc-700 cursor-pointer">
                <input type="checkbox" checked={onBehalf} onChange={(e) => { setOnBehalf(e.target.checked); setSelectedEmployeeId(""); }}
                  className="rounded border-zinc-300" />
                Submit on behalf of another employee
              </label>
            )}

            {onBehalf && (
              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-1">Select employee</label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-zinc-400" />
                  <input type="text" value={empSearch} onChange={(e) => setEmpSearch(e.target.value)}
                    placeholder="Search by name or email..."
                    className="w-full rounded-lg border border-zinc-200 pl-8 pr-3 py-2 text-sm" />
                </div>
                {empSearch && (
                  <div className="mt-1 max-h-40 overflow-y-auto rounded-lg border border-zinc-200 bg-white shadow-sm">
                    {filteredEmployees.map((emp) => (
                      <button key={emp.id || emp._id} type="button"
                        onClick={() => { setSelectedEmployeeId(emp.id || emp._id); setEmpSearch(emp.fullName || emp.email); }}
                        className={`w-full text-left px-3 py-1.5 text-sm hover:bg-zinc-50 ${selectedEmployeeId === (emp.id || emp._id) ? "bg-zinc-50 font-medium" : ""}`}>
                        {emp.fullName} <span className="text-zinc-400 text-xs">{emp.email}</span>
                      </button>
                    ))}
                    {filteredEmployees.length === 0 && <p className="px-3 py-2 text-xs text-zinc-400">No match</p>}
                  </div>
                )}
                {selectedEmployeeId && <p className="text-xs text-zinc-700 mt-1 font-medium">Selected: {empSearch}</p>}
                <p className="mt-2 text-xs text-zinc-500">On-behalf requests appear in Leave Approvals.</p>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1">Type</label>
              <select value={kind} onChange={(e) => setKind(e.target.value)}
                className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm">
                <option value="VACATION">Vacation (dates)</option>
                <option value="EXCUSE">Excuse (time range)</option>
              </select>
            </div>

            {kind === "VACATION" ? (
              <>
                <div>
                  <label className="block text-xs font-medium text-zinc-500 mb-1">Leave type</label>
                  <select value={leaveType} onChange={(e) => setLeaveType(e.target.value)}
                    className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm">
                    {LEAVE_TYPES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-zinc-500 mb-1">Start date</label>
                    <input type="date" required value={startDate} onChange={(e) => setStartDate(e.target.value)}
                      className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-500 mb-1">End date</label>
                    <input type="date" required value={endDate} onChange={(e) => setEndDate(e.target.value)}
                      className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm" />
                  </div>
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="block text-xs font-medium text-zinc-500 mb-1">Date</label>
                  <input type="date" required value={excuseDate} onChange={(e) => setExcuseDate(e.target.value)}
                    className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm" />
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-zinc-500 mb-1">From (HH:mm)</label>
                    <input type="time" required value={startTime} onChange={(e) => setStartTime(e.target.value)}
                      className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-500 mb-1">To (HH:mm)</label>
                    <input type="time" required value={endTime} onChange={(e) => setEndTime(e.target.value)}
                      className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm" />
                  </div>
                </div>
              </>
            )}

            <button type="submit" disabled={submitting || (onBehalf && !selectedEmployeeId)}
              className="rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800 disabled:opacity-50">
              {submitting ? "Submitting…" : "Submit request"}
            </button>
          </form>
        </LeaveSurface>
      ) : null}

      <LeaveSurface>
        <LeaveSectionHeader title="Pending requests" />
          {loading ? (
            <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-zinc-600" /></div>
          ) : segmented.pending.length === 0 ? (
            <p className="py-8 text-center text-sm text-zinc-500">No pending requests.</p>
          ) : (
            <ul className="divide-y divide-zinc-100">{segmented.pending.map((r) => requestRow(r, { showCancel: true }))}</ul>
          )}
      </LeaveSurface>

      <LeaveSurface>
        <LeaveSectionHeader title="Approved history" />
          {loading ? (
            <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-zinc-600" /></div>
          ) : segmented.approved.length === 0 ? (
            <p className="py-8 text-center text-sm text-zinc-500">No approved leave yet.</p>
          ) : (
            <ul className="divide-y divide-zinc-100">{segmented.approved.map((r) => requestRow(r, { showCancel: true }))}</ul>
          )}
      </LeaveSurface>

      {!loading && segmented.closed.length > 0 ? (
        <LeaveSurface>
          <LeaveSectionHeader title="Closed requests" subtitle="Rejected and cancelled records." />
          <ul className="divide-y divide-zinc-100">{segmented.closed.map((r) => requestRow(r, { showCancel: false }))}</ul>
        </LeaveSurface>
      ) : null}

      <Modal
        open={Boolean(cancelTarget)}
        title="Cancel approved request"
        onClose={() => setCancelTarget(null)}
      >
        <div className="space-y-3">
          <p className="text-sm text-zinc-700">A reason is required for approved request cancellation.</p>
          <textarea
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-rose-200 px-3 py-2 text-sm"
            placeholder="Why is this request being cancelled?"
          />
          <button
            type="button"
            disabled={!cancelReason.trim()}
            onClick={() => onCancel(cancelTarget, cancelReason.trim())}
            className="rounded-lg bg-rose-700 px-3 py-2 text-sm text-white disabled:opacity-50"
          >
            Confirm cancellation
          </button>
        </div>
      </Modal>
    </section>
  );
}

export function TimeOffPage() {
  return (
    <Layout
      title="Time off"
      description="Submit vacation or excuse requests. HR reviews first, then management."
    >
      <PersonalTimeOffSection />
    </Layout>
  );
}
