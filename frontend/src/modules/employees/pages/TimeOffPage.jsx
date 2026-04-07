import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Layout } from "@/shared/components/Layout";
import { useToast } from "@/shared/components/ToastProvider";
import { useAppSelector } from "@/shared/hooks/reduxHooks";
import {
  listLeaveRequestsApi,
  createLeaveRequestApi,
  cancelLeaveRequestApi,
  getLeaveBalanceApi,
} from "../api";
import { LeaveBalanceCreditHistory } from "../components/LeaveBalanceCreditHistory";
import { Loader2, Plane, Plus } from "lucide-react";

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
  return new Date(d).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
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

const HR_BULK_CREDIT_ROLES = new Set(["HR_STAFF", "HR_MANAGER", "ADMIN"]);

export function TimeOffPage() {
  const { showToast } = useToast();
  const currentUser = useAppSelector((s) => s.identity.currentUser);
  const canBulkCredit =
    currentUser &&
    (HR_BULK_CREDIT_ROLES.has(currentUser.role) || currentUser.role === 3);
  const [loading, setLoading] = useState(true);
  const [list, setList] = useState([]);
  const [pagination, setPagination] = useState(null);
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

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [data, bal] = await Promise.all([
        listLeaveRequestsApi({ mine: "1", limit: "100" }),
        getLeaveBalanceApi().catch(() => null),
      ]);
      setList(data.requests || []);
      setPagination(data.pagination || null);
      setBalance(bal);
    } catch (e) {
      showToast(e?.error || e?.message || "Failed to load requests", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    void load();
  }, [load]);

  const onSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const body =
        kind === "VACATION"
          ? { kind, leaveType, startDate, endDate }
          : { kind, excuseDate, startTime, endTime };
      await createLeaveRequestApi(body);
      showToast("Request submitted", "success");
      setShowForm(false);
      setStartDate("");
      setEndDate("");
      setExcuseDate("");
      void load();
    } catch (err) {
      const msg =
        typeof err === "object" && err?.error
          ? err.error
          : err?.message || "Submit failed";
      showToast(msg, "error");
    } finally {
      setSubmitting(false);
    }
  };

  const onCancel = async (id) => {
    try {
      await cancelLeaveRequestApi(id);
      showToast("Request cancelled", "success");
      void load();
    } catch (err) {
      showToast(err?.error || err?.message || "Cancel failed", "error");
    }
  };

  const pendingList = list.filter((r) => r.status === "PENDING");
  const approvedHistory = list
    .filter((r) => r.status === "APPROVED")
    .slice()
    .sort((a, b) => {
      const ta = new Date(a.submittedAt || a.createdAt || 0).getTime();
      const tb = new Date(b.submittedAt || b.createdAt || 0).getTime();
      return tb - ta;
    });
  const otherList = list.filter(
    (r) => r.status !== "PENDING" && r.status !== "APPROVED",
  );

  const requestRow = (r, { showCancel }) => (
    <li key={r._id} className="px-4 py-3 flex flex-wrap items-start justify-between gap-2">
      <div>
        <p className="text-sm font-medium text-slate-900">
          {r.kind === "VACATION"
            ? `${r.leaveType || "ANNUAL"} · ${fmtDate(r.startDate)} – ${fmtDate(r.endDate)}`
            : `Excuse · ${fmtDate(r.excuseDate)} ${r.startTime}–${r.endTime}`}
        </p>
        <p className="text-xs text-slate-500 mt-0.5">
          {r.computed?.days != null && r.kind === "VACATION" && `${r.computed.days} day(s) · `}
          {r.computed?.minutes != null && r.kind === "EXCUSE" && `${r.computed.minutes} min · `}
          Status: <span className="font-semibold text-slate-700">{r.status}</span>
        </p>
        {r.approvals?.length > 0 && (
          <p className="text-[11px] text-slate-400 mt-1">
            Steps:{" "}
            {r.approvals
              .map((a) =>
                `${a.role === "MANAGEMENT" ? "Mgmt" : a.role}:${a.status}`,
              )
              .join(" → ")}
          </p>
        )}
        {r.preEligibility && (
          <p className="text-[11px] text-amber-700 mt-1 font-medium">
            Pre-eligibility: does not use leave balance if approved.
          </p>
        )}
      </div>
      {showCancel && r.status === "PENDING" && (
        <button
          type="button"
          onClick={() => onCancel(r._id)}
          className="text-xs font-medium text-rose-600 hover:underline"
        >
          Cancel
        </button>
      )}
    </li>
  );

  return (
    <Layout
      title="Time off"
      description="Submit vacation or excuse requests. HR reviews first; manager or team leader completes approval. Policy hire rules are shown to HR — you can still submit before you are eligible."
      actions={
        <div className="flex flex-wrap items-center gap-2">
          {canBulkCredit && (
            <Link
              to="/employees/time-off/bulk-credit"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              Bulk credits
            </Link>
          )}
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className="inline-flex items-center gap-2 rounded-xl border border-teal-200 bg-teal-50 px-3 py-2 text-sm font-medium text-teal-800 shadow-sm transition hover:bg-teal-100"
          >
            {showForm ? "Close form" : <><Plus className="h-4 w-4" /> New request</>}
          </button>
        </div>
      }
    >
      <div className="space-y-6 max-w-4xl">
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
                  of {fmtDays(balance.vacation?.entitlementDays)} d · approved {fmtDays(balance.vacation?.approvedDays)} ·
                  pending {fmtDays(balance.vacation?.pendingDays)}
                </p>
                {Number(balance.vacation?.bonusDays) > 0 && (
                  <p className="text-xs text-teal-700 mt-1 font-medium">
                    Includes {fmtDays(balance.vacation.bonusDays)} bonus day(s) (policy base{" "}
                    {fmtDays(balance.vacation.baseEntitlementDays)} d)
                  </p>
                )}
                {balance.vacation?.entitlementVariesByYear &&
                  balance.vacation?.firstVacationYear && (
                    <p className="text-xs text-teal-800 mt-2 font-medium">
                      First year since hire — using first-year entitlement from policy.
                    </p>
                  )}
              </div>
              <div className="rounded-xl bg-white/80 border border-teal-100/80 px-3 py-2">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Excuses (monthly cap)</p>
                <p className="text-slate-800 mt-1">
                  <span className="text-lg font-semibold">{fmtMins(balance.excuse?.remainingMinutes)}</span>
                  <span className="text-slate-600"> left</span>
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  cap {fmtMins(balance.excuse?.entitlementMinutes)} · used {fmtMins(balance.excuse?.approvedMinutes)} ·
                  pending {fmtMins(balance.excuse?.pendingMinutes)}
                </p>
                {Number(balance.excuse?.companyMonthStartDay) > 1 && (
                  <p className="text-[11px] text-slate-500 mt-1">
                    Company month starts on day {balance.excuse.companyMonthStartDay} (UTC); monthly cap applies to this period.
                  </p>
                )}
              </div>
            </div>
            {balance.vacation?.credits?.length > 0 && (
              <LeaveBalanceCreditHistory
                credits={balance.vacation.credits}
                className="mt-4 pt-4 border-t border-teal-100/80"
              />
            )}
          </div>
        )}

        {showForm && (
          <form
            onSubmit={onSubmit}
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4"
          >
            <div className="flex items-center gap-2 text-slate-800 font-semibold">
              <Plane className="h-5 w-5 text-teal-600" />
              New request
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Type</label>
              <select
                value={kind}
                onChange={(e) => setKind(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="VACATION">Vacation (dates)</option>
                <option value="EXCUSE">Excuse (time range)</option>
              </select>
            </div>
            {kind === "VACATION" ? (
              <>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Leave type</label>
                  <select
                    value={leaveType}
                    onChange={(e) => setLeaveType(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  >
                    {LEAVE_TYPES.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Start date</label>
                    <input
                      type="date"
                      required
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">End date</label>
                    <input
                      type="date"
                      required
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    />
                  </div>
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Date</label>
                  <input
                    type="date"
                    required
                    value={excuseDate}
                    onChange={(e) => setExcuseDate(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">From (HH:mm)</label>
                    <input
                      type="time"
                      required
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">To (HH:mm)</label>
                    <input
                      type="time"
                      required
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    />
                  </div>
                </div>
              </>
            )}
            <button
              type="submit"
              disabled={submitting}
              className="rounded-xl bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-50"
            >
              {submitting ? "Submitting…" : "Submit request"}
            </button>
          </form>
        )}

        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-slate-100 px-4 py-3 bg-slate-50/80">
            <h2 className="text-sm font-semibold text-slate-800">Pending</h2>
            {pagination && (
              <p className="text-xs text-slate-500 mt-0.5">{pagination.total} request(s) loaded (up to 100)</p>
            )}
          </div>
          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
            </div>
          ) : pendingList.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">No pending requests.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {pendingList.map((r) => requestRow(r, { showCancel: true }))}
            </ul>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-slate-100 px-4 py-3 bg-slate-50/80">
            <h2 className="text-sm font-semibold text-slate-800">Approved leave history</h2>
            <p className="text-xs text-slate-500 mt-0.5">From your recent requests (same load as above)</p>
          </div>
          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
            </div>
          ) : approvedHistory.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">No approved leave in this list yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {approvedHistory.map((r) => requestRow(r, { showCancel: false }))}
            </ul>
          )}
        </div>

        {!loading && otherList.length > 0 && (
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="border-b border-slate-100 px-4 py-3 bg-slate-50/80">
              <h2 className="text-sm font-semibold text-slate-800">Rejected or cancelled</h2>
            </div>
            <ul className="divide-y divide-slate-100">
              {otherList.map((r) => requestRow(r, { showCancel: false }))}
            </ul>
          </div>
        )}
      </div>
    </Layout>
  );
}
