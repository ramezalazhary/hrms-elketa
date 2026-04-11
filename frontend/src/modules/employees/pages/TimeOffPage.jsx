import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Layout } from "@/shared/components/Layout";
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
import { LeaveBalanceCreditHistory } from "../components/LeaveBalanceCreditHistory";
import { normaliseRoleKey } from "@/shared/components/EntityBadges";
import { Loader2, Plane, Plus, History, Search } from "lucide-react";

const LEAVE_TYPES = [
  { value: "ANNUAL", label: "Annual" },
  { value: "SICK", label: "Sick" },
  { value: "UNPAID", label: "Unpaid" },
  { value: "MATERNITY", label: "Maternity" },
  { value: "PATERNITY", label: "Paternity" },
  { value: "OTHER", label: "Other" },
];

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}
function fmtDateTime(d) {
  if (!d) return "—";
  return new Date(d).toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
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

const HR_ROLES = new Set(["HR_STAFF", "HR_MANAGER", "ADMIN"]);

function ApprovalPipeline({ approvals }) {
  if (!approvals?.length) return null;
  return (
    <div className="mt-1 flex items-center gap-1 text-xs flex-wrap">
      {approvals.map((a, i) => {
        const bg =
          a.status === "APPROVED" ? "bg-emerald-100 text-emerald-800 border-emerald-200" :
          a.status === "REJECTED" ? "bg-rose-100 text-rose-800 border-rose-200" :
          "bg-slate-100 text-slate-600 border-slate-200";
        return (
          <div key={i} className="flex items-center gap-1">
            {i > 0 && <span className="text-slate-300">→</span>}
            <span className={`rounded-md border px-2 py-0.5 font-medium ${bg}`}>
              {a.role === "MANAGEMENT" ? "Mgmt" : a.role}: {a.status}
            </span>
            {a.processedBy && (
              <span className="text-[10px] text-slate-400">{a.processedBy} {a.processedAt ? fmtDate(a.processedAt) : ""}</span>
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
    <div className="mt-1">
      <button type="button" onClick={load}
        className="inline-flex items-center gap-1 text-[11px] font-medium text-indigo-600 hover:underline">
        <History className="h-3 w-3" />
        {loading ? "Loading..." : open ? "Hide trail" : "Audit trail"}
      </button>
      {open && logs && (
        <div className="mt-1 space-y-0.5">
          {logs.length === 0 && <p className="text-[11px] text-slate-400">No entries.</p>}
          {logs.map((log, i) => (
            <div key={i} className="rounded border border-slate-100 bg-slate-50/60 px-2 py-0.5 text-[10px] text-slate-600">
              <span className="font-semibold text-slate-800">{log.operation}</span>
              {" by "}<span className="font-medium">{log.performedBy}</span>
              {" — "}{fmtDateTime(log.performedAt || log.createdAt)}
              {log.newValues?.comment && <span className="ml-1">"{log.newValues.comment}"</span>}
              {log.newValues?.reason && <span className="ml-1">Reason: "{log.newValues.reason}"</span>}
              {log.newValues?.forceApproved && <span className="ml-1 font-medium text-amber-700">[HR force-approved]</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function TimeOffPage() {
  const { showToast } = useToast();
  const dispatch = useAppDispatch();
  const currentUser = useAppSelector((s) => s.identity.currentUser);
  const employees = useAppSelector((s) => s.employees.items);
  const isHr = currentUser && HR_ROLES.has(normaliseRoleKey(currentUser.role));

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

  const requestRow = (r, { showCancel }) => (
    <li key={r._id} className="px-4 py-3 space-y-1">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-900">
            {r.kind === "VACATION"
              ? `${r.leaveType || "ANNUAL"} · ${fmtDate(r.startDate)} – ${fmtDate(r.endDate)}`
              : `Excuse · ${fmtDate(r.excuseDate)} ${r.startTime}–${r.endTime}`}
          </p>
          <div className="flex items-center gap-2 flex-wrap text-xs text-slate-500 mt-0.5">
            <p>
              {r.computed?.days != null && r.kind === "VACATION" && `${r.computed.days} day(s) · `}
              {r.computed?.minutes != null && r.kind === "EXCUSE" && `${r.computed.minutes} min · `}
              Status: <span className="font-semibold text-slate-700">{r.status}</span>
            </p>
            {r.status === "APPROVED" && r.effectivePaymentType === "UNPAID" && (
              <span className="rounded-full bg-rose-100 text-rose-700 px-2 py-0.5 text-[10px] font-semibold">UNPAID</span>
            )}
            {r.status === "APPROVED" && r.effectivePaymentType === "PAID" && (
              <span className="rounded-full bg-emerald-100 text-emerald-700 px-2 py-0.5 text-[10px] font-semibold">PAID</span>
            )}
            {r.status === "APPROVED" && r.quotaExceeded && (
              <span className="rounded-full bg-amber-100 text-amber-800 px-2 py-0.5 text-[10px] font-semibold">Quota exceeded</span>
            )}
          </div>
          {r.onBehalf && <p className="text-[11px] text-blue-700 font-medium">Submitted on behalf by {r.createdBy}</p>}
          {r.cancellationReason && <p className="text-xs text-rose-700 mt-0.5">Cancel reason: {r.cancellationReason}</p>}
          {r.approvals?.some((a) => a.status === "REJECTED" && a.comment) && (
            <p className="text-xs text-rose-600 mt-0.5">
              Rejection: {r.approvals.find((a) => a.status === "REJECTED")?.comment}
            </p>
          )}
          <ApprovalPipeline approvals={r.approvals} />
          <AuditTrail requestId={r._id} />
        </div>
        {showCancel && r.status === "PENDING" && (
          <button type="button" onClick={() => onCancel(r._id)}
            className="text-xs font-medium text-rose-600 hover:underline shrink-0">Cancel</button>
        )}
        {showCancel && r.status === "APPROVED" && isHr && (
          <button type="button" onClick={() => { setCancelTarget(r._id); setCancelReason(""); }}
            className="text-xs font-medium text-rose-600 hover:underline shrink-0">Cancel (HR)</button>
        )}
      </div>
    </li>
  );

  return (
    <Layout
      title="Time off"
      description="Submit vacation or excuse requests. HR reviews first, then management."
      actions={
        <div className="flex flex-wrap items-center gap-2">
          {isHr && (
            <Link to="/employees/time-off/bulk-credit"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50">
              Bulk credits
            </Link>
          )}
          <button type="button" onClick={() => setShowForm((v) => !v)}
            className="inline-flex items-center gap-2 rounded-xl border border-teal-200 bg-teal-50 px-3 py-2 text-sm font-medium text-teal-800 shadow-sm transition hover:bg-teal-100">
            {showForm ? "Close form" : <><Plus className="h-4 w-4" /> New request</>}
          </button>
        </div>
      }
    >
      <div className="space-y-6 max-w-4xl">
        {/* Cancel modal for HR */}
        {cancelTarget && (
          <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-4 space-y-2">
            <p className="text-sm font-medium text-rose-900">Cancel approved request — reason required</p>
            <textarea value={cancelReason} onChange={(e) => setCancelReason(e.target.value)}
              rows={2} className="w-full rounded-lg border border-rose-200 px-3 py-2 text-sm"
              placeholder="Why is this request being cancelled?" required />
            <div className="flex gap-2">
              <button type="button" disabled={!cancelReason.trim()}
                onClick={() => onCancel(cancelTarget, cancelReason.trim())}
                className="rounded-lg bg-rose-700 px-3 py-1.5 text-sm text-white hover:bg-rose-800 disabled:opacity-50">Confirm cancel</button>
              <button type="button" onClick={() => setCancelTarget(null)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm">Dismiss</button>
            </div>
          </div>
        )}

        {/* Balance card */}
        {balance && (
          <div className="rounded-2xl border border-teal-100 bg-teal-50/40 p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-teal-900 mb-3">Your balance (soft reservation)</h2>
            <div className="grid sm:grid-cols-2 gap-4 text-sm">
              <div className="rounded-xl bg-white/80 border border-teal-100/80 px-3 py-2">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Vacation</p>
                <p className="text-slate-800 mt-1">
                  <span className="text-lg font-semibold">{fmtDays(balance.vacation?.remainingDays)}</span>
                  <span className="text-slate-600"> d left</span>
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  of {fmtDays(balance.vacation?.entitlementDays)} d · approved {fmtDays(balance.vacation?.approvedDays)} · pending {fmtDays(balance.vacation?.pendingDays)}
                </p>
                {Number(balance.vacation?.bonusDays) > 0 && (
                  <p className="text-xs text-teal-700 mt-1 font-medium">Includes {fmtDays(balance.vacation.bonusDays)} bonus day(s)</p>
                )}
                {balance.vacation?.entitlementVariesByYear && balance.vacation?.firstVacationYear && (
                  <p className="text-xs text-teal-800 mt-2 font-medium">First year since hire — first-year entitlement.</p>
                )}
                {balance.vacation?.hasBalance === false && (
                  <p className="text-xs text-rose-700 mt-2 font-medium">No remaining balance — new requests will be treated as unpaid leave.</p>
                )}
              </div>
              <div className="rounded-xl bg-white/80 border border-teal-100/80 px-3 py-2">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Excuses (monthly cap)</p>
                <p className="text-slate-800 mt-1">
                  <span className="text-lg font-semibold">{fmtMins(balance.excuse?.remainingMinutes)}</span>
                  <span className="text-slate-600"> left</span>
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  cap {fmtMins(balance.excuse?.entitlementMinutes)} · used {fmtMins(balance.excuse?.approvedMinutes)} · pending {fmtMins(balance.excuse?.pendingMinutes)}
                </p>
                {balance.excuse?.excusesAllowedInPeriod > 0 && (
                  <p className="text-xs text-slate-500 mt-1">
                    Excuses this period: {balance.excuse.excusesUsedInPeriod} / {balance.excuse.excusesAllowedInPeriod}
                  </p>
                )}
                {balance.excuse?.hasQuota === false && (
                  <p className="text-xs text-rose-700 mt-2 font-medium">Quota exhausted — new excuses will incur proportional salary deduction.</p>
                )}
              </div>
            </div>
            {balance.vacation?.credits?.length > 0 && (
              <LeaveBalanceCreditHistory credits={balance.vacation.credits} className="mt-4 pt-4 border-t border-teal-100/80" />
            )}
          </div>
        )}

        {/* Submit form */}
        {showForm && (
          <form onSubmit={onSubmit} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2 text-slate-800 font-semibold">
              <Plane className="h-5 w-5 text-teal-600" /> New request
            </div>

            {isHr && (
              <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                <input type="checkbox" checked={onBehalf} onChange={(e) => { setOnBehalf(e.target.checked); setSelectedEmployeeId(""); }}
                  className="rounded border-slate-300" />
                Submit on behalf of another employee
              </label>
            )}

            {onBehalf && (
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Select employee</label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                  <input type="text" value={empSearch} onChange={(e) => setEmpSearch(e.target.value)}
                    placeholder="Search by name or email..."
                    className="w-full rounded-lg border border-slate-200 pl-8 pr-3 py-2 text-sm" />
                </div>
                {empSearch && (
                  <div className="mt-1 max-h-40 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-sm">
                    {filteredEmployees.map((emp) => (
                      <button key={emp.id || emp._id} type="button"
                        onClick={() => { setSelectedEmployeeId(emp.id || emp._id); setEmpSearch(emp.fullName || emp.email); }}
                        className={`w-full text-left px-3 py-1.5 text-sm hover:bg-teal-50 ${selectedEmployeeId === (emp.id || emp._id) ? "bg-teal-50 font-medium" : ""}`}>
                        {emp.fullName} <span className="text-slate-400 text-xs">{emp.email}</span>
                      </button>
                    ))}
                    {filteredEmployees.length === 0 && <p className="px-3 py-2 text-xs text-slate-400">No match</p>}
                  </div>
                )}
                {selectedEmployeeId && <p className="text-xs text-teal-700 mt-1 font-medium">Selected: {empSearch}</p>}
                <p className="text-[11px] text-slate-500 mt-2">On-behalf requests will appear under Leave Approvals → All Requests, not in your personal list below.</p>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Type</label>
              <select value={kind} onChange={(e) => setKind(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
                <option value="VACATION">Vacation (dates)</option>
                <option value="EXCUSE">Excuse (time range)</option>
              </select>
            </div>

            {kind === "VACATION" ? (
              <>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Leave type</label>
                  <select value={leaveType} onChange={(e) => setLeaveType(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
                    {LEAVE_TYPES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Start date</label>
                    <input type="date" required value={startDate} onChange={(e) => setStartDate(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">End date</label>
                    <input type="date" required value={endDate} onChange={(e) => setEndDate(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                  </div>
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Date</label>
                  <input type="date" required value={excuseDate} onChange={(e) => setExcuseDate(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">From (HH:mm)</label>
                    <input type="time" required value={startTime} onChange={(e) => setStartTime(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">To (HH:mm)</label>
                    <input type="time" required value={endTime} onChange={(e) => setEndTime(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                  </div>
                </div>
              </>
            )}

            <button type="submit" disabled={submitting || (onBehalf && !selectedEmployeeId)}
              className="rounded-xl bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-50">
              {submitting ? "Submitting…" : "Submit request"}
            </button>
          </form>
        )}

        {/* Pending list */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-slate-100 px-4 py-3 bg-slate-50/80">
            <h2 className="text-sm font-semibold text-slate-800">Pending</h2>
          </div>
          {loading ? (
            <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-teal-600" /></div>
          ) : pendingList.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">No pending requests.</p>
          ) : (
            <ul className="divide-y divide-slate-100">{pendingList.map((r) => requestRow(r, { showCancel: true }))}</ul>
          )}
        </div>

        {/* Approved history */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-slate-100 px-4 py-3 bg-slate-50/80">
            <h2 className="text-sm font-semibold text-slate-800">Approved leave history</h2>
          </div>
          {loading ? (
            <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-teal-600" /></div>
          ) : approvedHistory.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">No approved leave yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100">{approvedHistory.map((r) => requestRow(r, { showCancel: true }))}</ul>
          )}
        </div>

        {/* Other */}
        {!loading && otherList.length > 0 && (
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="border-b border-slate-100 px-4 py-3 bg-slate-50/80">
              <h2 className="text-sm font-semibold text-slate-800">Rejected or cancelled</h2>
            </div>
            <ul className="divide-y divide-slate-100">{otherList.map((r) => requestRow(r, { showCancel: false }))}</ul>
          </div>
        )}
      </div>
    </Layout>
  );
}
