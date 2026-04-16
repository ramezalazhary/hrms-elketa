import { useCallback, useEffect, useMemo, useState } from "react";
import { Layout } from "@/shared/components/Layout";
import { useToast } from "@/shared/components/ToastProvider";
import { useAppSelector } from "@/shared/hooks/reduxHooks";
import { getDepartmentsApi } from "@/modules/departments/api";
import { getEmployeesApi, postLeaveBalanceCreditBulkApi } from "@/modules/employees/api";
import {
  ACCESS_LEVEL,
  canManageHolidays,
  hasAccessLevel,
  getAccessLevelLabel,
  getHolidaysAccessLevel,
  getLeaveOperationsAccessLevel,
} from "@/shared/utils/accessControl";
import { normaliseRoleKey } from "@/shared/components/EntityBadges";
import { Gift, Loader2, Building2, User, Globe } from "lucide-react";
import { HolidaysPage } from "./HolidaysPage";

const CREDIT_ROLES = new Set(["HR_STAFF", "HR_MANAGER", "ADMIN"]);

export function LeaveOperationsPage() {
  const { showToast } = useToast();
  const currentUser = useAppSelector((state) => state.identity.currentUser);
  const roleKey = normaliseRoleKey(currentUser?.role);
  const leaveOpsAccessLevel = getLeaveOperationsAccessLevel(currentUser);
  const roleEligibleForCredits = CREDIT_ROLES.has(roleKey);
  const canViewCreditsTab =
    roleEligibleForCredits && hasAccessLevel(leaveOpsAccessLevel, ACCESS_LEVEL.VIEW);
  const canManageCredits =
    roleEligibleForCredits && hasAccessLevel(leaveOpsAccessLevel, ACCESS_LEVEL.EDIT);
  const isAdmin = roleKey === "ADMIN";
  const canManageCompanyScope = isAdmin;
  const holidaysAccessLevel = getHolidaysAccessLevel(currentUser);
  const canViewHolidaysTab = hasAccessLevel(holidaysAccessLevel, ACCESS_LEVEL.VIEW);
  const canManageHolidayRecords = canManageHolidays(currentUser);

  const [mode, setMode] = useState("person");
  const [days, setDays] = useState("");
  const [reason, setReason] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [confirmAll, setConfirmAll] = useState(false);
  const [departments, setDepartments] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loadingRefs, setLoadingRefs] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [lastResult, setLastResult] = useState(null);
  const [activeTab, setActiveTab] = useState(canViewCreditsTab ? "credits" : "holidays");

  const modeOptions = useMemo(() => {
    const opts = [
      { value: "person", label: "Person", icon: User },
      { value: "department", label: "Department", icon: Building2 },
    ];
    if (canManageCompanyScope) {
      opts.push({ value: "all", label: "Company", icon: Globe });
    }
    return opts;
  }, [canManageCompanyScope]);

  const loadRefs = useCallback(async () => {
    if (!canManageCredits) return;
    setLoadingRefs(true);
    try {
      const [deps, emps] = await Promise.all([
        getDepartmentsApi().catch(() => []),
        getEmployeesApi({ limit: 500 }).catch(() => []),
      ]);
      setDepartments(Array.isArray(deps) ? deps : deps?.departments || []);
      setEmployees(Array.isArray(emps) ? emps : emps?.employees || []);
    } finally {
      setLoadingRefs(false);
    }
  }, [canManageCredits]);

  useEffect(() => {
    void loadRefs();
  }, [loadRefs]);

  useEffect(() => {
    if (activeTab === "credits" && !canViewCreditsTab && canViewHolidaysTab) {
      setActiveTab("holidays");
    } else if (activeTab === "holidays" && !canViewHolidaysTab && canViewCreditsTab) {
      setActiveTab("credits");
    }
  }, [activeTab, canViewCreditsTab, canViewHolidaysTab]);

  const onSubmitCredit = async (e) => {
    e.preventDefault();
    setLastResult(null);
    const n = parseInt(days, 10);
    if (!Number.isFinite(n) || n < 1) {
      showToast("Enter a whole number of days (1 or more).", "error");
      return;
    }
    const cleanReason = reason.trim();
    if (!cleanReason) {
      showToast("Reason is required.", "error");
      return;
    }

    let body = { days: n, reason: cleanReason };
    if (mode === "person") {
      if (!employeeId) {
        showToast("Select an employee.", "error");
        return;
      }
      body = { ...body, employeeIds: [employeeId] };
    } else if (mode === "department") {
      if (!departmentId) {
        showToast("Select a department.", "error");
        return;
      }
      body = { ...body, departmentId };
    } else {
      if (!canManageCompanyScope) {
        showToast("Only administrators can credit all employees.", "error");
        return;
      }
      if (!confirmAll) {
        showToast("Please confirm company-wide credit.", "error");
        return;
      }
      body = { ...body, scope: "ALL", confirmAllEmployees: true };
    }

    setSubmitting(true);
    try {
      const result = await postLeaveBalanceCreditBulkApi(body);
      setLastResult(result);
      showToast(
        result?.message || `Updated ${result?.updatedCount ?? 0} employee record(s).`,
        result?.updatedCount ? "success" : "info",
      );
    } catch (err) {
      showToast(err?.error || err?.message || "Bulk credit failed", "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Layout
      title="Leave Operations"
      description={`Leave operations access: ${getAccessLevelLabel(leaveOpsAccessLevel)} · Holidays access: ${getAccessLevelLabel(holidaysAccessLevel)}`}
    >
      <div className="space-y-6 max-w-5xl">
        {canViewCreditsTab && canViewHolidaysTab && (
          <div className="inline-flex w-full max-w-md gap-0.5 rounded-2xl bg-zinc-100/90 p-1 ring-1 ring-zinc-200/80 sm:w-auto">
            <button
              type="button"
              onClick={() => setActiveTab("credits")}
              className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-medium transition sm:flex-none ${
                activeTab === "credits"
                  ? "bg-white text-zinc-900 shadow-sm ring-1 ring-zinc-200/60"
                  : "text-zinc-600 hover:text-zinc-900"
              }`}
            >
              Leave balance credits
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("holidays")}
              className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-medium transition sm:flex-none ${
                activeTab === "holidays"
                  ? "bg-white text-zinc-900 shadow-sm ring-1 ring-zinc-200/60"
                  : "text-zinc-600 hover:text-zinc-900"
              }`}
            >
              Company holidays
            </button>
          </div>
        )}

        {canViewCreditsTab && activeTab === "credits" && (
          <article className="rounded-[24px] bg-white p-6 shadow-sm ring-1 ring-zinc-950/[0.06]">
            <div className="mb-4 flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-700 ring-1 ring-zinc-200/80">
                <Gift className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-zinc-900">Leave balance credits</h2>
                <p className="text-xs text-zinc-500">
                  Add extra leave balance by person, department, or company (company scope is Admin only).
                </p>
              </div>
            </div>

            {!canManageCredits ? (
              <p className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
                You can view this page, but you do not have permission to apply leave balance credits.
              </p>
            ) : (
              <form onSubmit={onSubmitCredit} className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {modeOptions.map((opt) => {
                    const Icon = opt.icon;
                    const active = mode === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => {
                          setMode(opt.value);
                          setLastResult(null);
                        }}
                        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold ${
                          active
                            ? "border-zinc-900 bg-zinc-900 text-white"
                            : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
                        }`}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        {opt.label}
                      </button>
                    );
                  })}
                </div>

                {mode === "person" && (
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Employee
                    </label>
                    {loadingRefs ? (
                      <p className="text-sm text-zinc-500 flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" /> Loading employees...
                      </p>
                    ) : (
                      <select
                        value={employeeId}
                        onChange={(e) => setEmployeeId(e.target.value)}
                        className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                      >
                        <option value="">Select employee...</option>
                        {employees.map((emp) => (
                          <option key={emp._id || emp.id} value={emp._id || emp.id}>
                            {emp.fullName || emp.email} ({emp.employeeCode || emp.email})
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                )}

                {mode === "department" && (
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Department
                    </label>
                    {loadingRefs ? (
                      <p className="text-sm text-zinc-500 flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" /> Loading departments...
                      </p>
                    ) : (
                      <select
                        value={departmentId}
                        onChange={(e) => setDepartmentId(e.target.value)}
                        className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                      >
                        <option value="">Select department...</option>
                        {departments.map((d) => (
                          <option key={d._id} value={d._id}>
                            {d.name || d._id}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                )}

                {mode === "all" && (
                  <label className="flex items-start gap-2 text-sm text-zinc-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={confirmAll}
                      onChange={(e) => setConfirmAll(e.target.checked)}
                      className="mt-0.5 text-zinc-600"
                    />
                    <span>
                      I confirm applying this credit to every active or on-leave employee.
                    </span>
                  </label>
                )}

                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Days to add
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={365}
                    value={days}
                    onChange={(e) => setDays(e.target.value)}
                    className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Reason (audit trail)
                  </label>
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={3}
                    maxLength={500}
                    className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800 disabled:opacity-60"
                >
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  Apply credit
                </button>

                {lastResult && (
                  <div className="rounded-[16px] bg-zinc-50/90 px-4 py-3 text-sm text-zinc-700 ring-1 ring-zinc-200/80">
                    <p className="font-semibold text-zinc-900">Last result</p>
                    <pre className="mt-2 text-xs overflow-x-auto whitespace-pre-wrap">
                      {JSON.stringify(lastResult, null, 2)}
                    </pre>
                  </div>
                )}
              </form>
            )}
          </article>
        )}

        {canViewHolidaysTab && activeTab === "holidays" && (
          <article className="rounded-[24px] bg-white p-6 shadow-sm ring-1 ring-zinc-950/[0.06]">
            {!canManageHolidayRecords && (
              <p className="mb-4 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
                You have read-only access for company holidays in this section.
              </p>
            )}
            <HolidaysPage embedded />
          </article>
        )}
      </div>
    </Layout>
  );
}
