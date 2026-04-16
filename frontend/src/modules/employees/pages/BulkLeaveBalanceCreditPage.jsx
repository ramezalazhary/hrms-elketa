import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Layout } from "@/shared/components/Layout";
import { useToast } from "@/shared/components/ToastProvider";
import { useAppSelector } from "@/shared/hooks/reduxHooks";
import { getDepartmentsApi } from "@/modules/departments/api";
import { postLeaveBalanceCreditBulkApi } from "../api";
import { ArrowLeft, Gift, Loader2 } from "lucide-react";

const HR_MODES = [
  { value: "department", label: "By department" },
  { value: "ids", label: "By employee IDs" },
];

export function BulkLeaveBalanceCreditPage() {
  const { showToast } = useToast();
  const currentUser = useAppSelector((s) => s.identity.currentUser);
  const isAdmin = currentUser?.role === "ADMIN";

  const [mode, setMode] = useState("department");
  const [departments, setDepartments] = useState([]);
  const [departmentId, setDepartmentId] = useState("");
  const [idsText, setIdsText] = useState("");
  const [days, setDays] = useState("");
  const [reason, setReason] = useState("");
  const [confirmAll, setConfirmAll] = useState(false);
  const [loadingDepts, setLoadingDepts] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [lastResult, setLastResult] = useState(null);

  const loadDepts = useCallback(async () => {
    setLoadingDepts(true);
    try {
      const data = await getDepartmentsApi();
      setDepartments(Array.isArray(data) ? data : data?.departments || []);
    } catch (e) {
      showToast(e?.error || e?.message || "Failed to load departments", "error");
    } finally {
      setLoadingDepts(false);
    }
  }, [showToast]);

  useEffect(() => {
    void loadDepts();
  }, [loadDepts]);

  const parseEmployeeIds = () => {
    const parts = idsText
      .split(/[\s,;]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    return [...new Set(parts)];
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setLastResult(null);
    const n = parseInt(days, 10);
    if (!Number.isFinite(n) || n < 1) {
      showToast("Enter a whole number of days (1 or more).", "error");
      return;
    }
    const r = reason.trim();
    if (!r) {
      showToast("Reason is required.", "error");
      return;
    }

    let body = { days: n, reason: r };

    if (mode === "all") {
      if (!isAdmin) {
        showToast("Only administrators can credit all employees.", "error");
        return;
      }
      if (!confirmAll) {
        showToast("Confirm that you intend to credit every active employee.", "error");
        return;
      }
      body = { ...body, scope: "ALL", confirmAllEmployees: true };
    } else if (mode === "department") {
      if (!departmentId) {
        showToast("Select a department.", "error");
        return;
      }
      body = { ...body, departmentId };
    } else {
      const employeeIds = parseEmployeeIds();
      if (employeeIds.length === 0) {
        showToast("Enter at least one employee id.", "error");
        return;
      }
      body = { ...body, employeeIds };
    }

    setSubmitting(true);
    try {
      const result = await postLeaveBalanceCreditBulkApi(body);
      setLastResult(result);
      showToast(
        result?.message ||
          `Updated ${result?.updatedCount ?? 0} employee record(s).`,
        result?.updatedCount ? "success" : "info",
      );
    } catch (err) {
      showToast(
        typeof err === "object" && err?.error
          ? err.error
          : err?.message || "Bulk credit failed",
        "error",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const modeOptions = isAdmin
    ? [...HR_MODES, { value: "all", label: "All active employees (Admin)" }]
    : HR_MODES;

  return (
    <Layout
      title="Bulk vacation credits"
      description="Add the same manual annual leave credit to many employees at once (active and on-leave only, except when using explicit IDs)."
      actions={
        <Link
          to="/leave-operations"
          className="inline-flex items-center gap-2 rounded-full border border-zinc-200/90 bg-white px-3 py-2 text-sm font-medium text-zinc-800 shadow-sm hover:bg-zinc-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to leave operations
        </Link>
      }
    >
      <div className="max-w-xl space-y-6">
        <div className="flex gap-3 rounded-[20px] bg-zinc-50/80 p-4 ring-1 ring-zinc-200/80">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-700 ring-1 ring-zinc-200/80">
            <Gift className="h-5 w-5" />
          </div>
          <p className="text-sm text-zinc-900">
            Credits are appended to each profile like single-employee credits. Department scope
            matches employees linked to that department or whose legacy{" "}
            <span className="font-medium">department</span> name matches. Explicit IDs update
            those records even if status is not active.
          </p>
        </div>

        <form
          onSubmit={onSubmit}
          className="space-y-5 rounded-[20px] bg-white p-6 shadow-sm ring-1 ring-zinc-950/[0.06]"
        >
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-500 mb-2">
              Scope
            </label>
            <div className="flex flex-col gap-2">
              {modeOptions.map((o) => (
                <label
                  key={o.value}
                  className="flex items-center gap-2 text-sm text-zinc-800 cursor-pointer"
                >
                  <input
                    type="radio"
                    name="bulkScope"
                    value={o.value}
                    checked={mode === o.value}
                    onChange={() => {
                      setMode(o.value);
                      setLastResult(null);
                    }}
                    className="text-zinc-600"
                  />
                  {o.label}
                </label>
              ))}
            </div>
          </div>

          {mode === "department" && (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-500 mb-1">
                Department
              </label>
              {loadingDepts ? (
                <p className="text-sm text-zinc-500 flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading…
                </p>
              ) : (
                <select
                  value={departmentId}
                  onChange={(e) => setDepartmentId(e.target.value)}
                  className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                >
                  <option value="">Select…</option>
                  {departments.map((d) => (
                    <option key={d._id} value={d._id}>
                      {d.name || d._id}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {mode === "ids" && (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-500 mb-1">
                Employee IDs (MongoDB <code className="text-xs">_id</code>, comma or space separated, max 500)
              </label>
              <textarea
                value={idsText}
                onChange={(e) => setIdsText(e.target.value)}
                rows={4}
                placeholder="e.g. 507f1f77bcf86cd799439011"
                className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm font-mono"
              />
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
                I confirm I want to add this credit to <strong>every</strong> employee with
                status Active or On leave.
              </span>
            </label>
          )}

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-500 mb-1">
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
            <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-500 mb-1">
              Reason (audit trail)
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              maxLength={500}
              className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
              placeholder="e.g. Company-wide carryover adjustment 2026"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800 disabled:opacity-60"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Apply bulk credit
          </button>
        </form>

        {lastResult && (
          <div className="rounded-[20px] bg-zinc-50/90 px-4 py-3 text-sm text-zinc-700 ring-1 ring-zinc-200/80">
            <p className="font-semibold text-zinc-900">Last result</p>
            <pre className="mt-2 text-xs overflow-x-auto whitespace-pre-wrap">
              {JSON.stringify(lastResult, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </Layout>
  );
}
