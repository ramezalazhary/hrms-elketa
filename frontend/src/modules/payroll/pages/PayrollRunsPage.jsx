import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "@/shared/components/Layout";
import { useToast } from "@/shared/components/ToastProvider";
import { useAppSelector } from "@/shared/hooks/reduxHooks";
import {
  ACCESS_LEVEL,
  canManagePayroll,
  getAccessLevelLabel,
  getPayrollAccessLevel,
} from "@/shared/utils/accessControl";
import {
  getPayrollRunsApi,
  createPayrollRunApi,
  deletePayrollRunApi,
} from "../api";
import {
  Loader2,
  Plus,
  Wallet,
  Trash2,
  ChevronRight,
  CalendarDays,
  CheckCircle2,
  Clock,
  FileSpreadsheet,
} from "lucide-react";
import { PayrollHelpPanel } from "../components/PayrollHelpPanel";
import { formatPayrollEgp } from "../payrollVerification";
import { usePayrollDecimalPlaces } from "../usePayrollDecimalPlaces";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const STATUS_STYLES = {
  DRAFT: "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 ring-zinc-200",
  COMPUTED: "bg-amber-50 text-amber-700 ring-amber-200",
  FINALIZED: "bg-emerald-50 text-emerald-700 ring-emerald-200",
};
const STATUS_ICONS = {
  DRAFT: FileSpreadsheet,
  COMPUTED: Clock,
  FINALIZED: CheckCircle2,
};

export function PayrollRunsPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const currentUser = useAppSelector((s) => s.identity.currentUser);
  const payrollAccessLevel = getPayrollAccessLevel(currentUser);
  const canManageRuns = canManagePayroll(currentUser);
  const canDeleteRuns = payrollAccessLevel === ACCESS_LEVEL.ADMIN;
  const payrollDp = usePayrollDecimalPlaces();
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const now = new Date();
  const [filterYear, setFilterYear] = useState(now.getFullYear());
  const [newMonth, setNewMonth] = useState(now.getMonth() + 1);
  const [newYear, setNewYear] = useState(now.getFullYear());

  const fetchRuns = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getPayrollRunsApi({ year: filterYear });
      setRuns(data || []);
    } catch (e) {
      showToast(e.message || "Failed to load runs", "error");
    } finally {
      setLoading(false);
    }
  }, [filterYear, showToast]);

  useEffect(() => {
    fetchRuns();
  }, [fetchRuns]);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const run = await createPayrollRunApi({ year: newYear, month: newMonth });
      showToast("Draft run created", "success");
      navigate(`/payroll/${run.id}`);
    } catch (e) {
      showToast(e.message || "Failed to create run", "error");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm("Delete this draft run?")) return;
    try {
      await deletePayrollRunApi(id);
      showToast("Run deleted", "success");
      setRuns((prev) => prev.filter((r) => (r.id || r._id) !== id));
    } catch (err) {
      showToast(err.message || "Failed to delete", "error");
    }
  };

  const fmt = (n) => formatPayrollEgp(n, payrollDp);

  return (
    <Layout
      title="Payroll"
      description={`Access: ${getAccessLevelLabel(payrollAccessLevel)} · Monthly payroll runs`}
    >
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700">
              <Wallet size={20} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Payroll</h1>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">Monthly payroll runs</p>
            </div>
          </div>

          {/* Create new run */}
          {canManageRuns ? (
            <div className="flex flex-wrap items-center gap-2">
              <select
                className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
                value={newMonth}
                onChange={(e) => setNewMonth(Number(e.target.value))}
              >
                {MONTHS.map((m, i) => (
                  <option key={i} value={i + 1}>{m}</option>
                ))}
              </select>
              <input
                type="number"
                className="w-20 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
                value={newYear}
                onChange={(e) => setNewYear(Number(e.target.value))}
              />
              <button
                className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
                onClick={handleCreate}
                disabled={creating}
              >
                {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                New Run
              </button>
            </div>
          ) : null}
        </div>

        {/* Year filter */}
        <div className="flex items-center gap-2">
          <CalendarDays size={16} className="text-zinc-400" />
          <span className="text-sm text-zinc-500 dark:text-zinc-400">Showing runs for</span>
          <input
            type="number"
            className="w-20 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-2 py-1 text-sm font-semibold"
            value={filterYear}
            onChange={(e) => setFilterYear(Number(e.target.value))}
          />
        </div>

        <PayrollHelpPanel />

        {/* Runs list */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="animate-spin text-zinc-400" size={28} />
          </div>
        ) : runs.length === 0 ? (
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-6 py-16 text-center">
            <Wallet className="mx-auto mb-3 text-zinc-300" size={36} />
            <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">No payroll runs for {filterYear}</p>
            <p className="mt-1 text-xs text-zinc-400">Create a new run to get started</p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
            {runs.map((run) => {
              const rid = run.id || run._id;
              const StatusIcon = STATUS_ICONS[run.status] || FileSpreadsheet;
              return (
                <div
                  key={rid}
                  className="flex cursor-pointer items-center gap-4 px-5 py-4 transition hover:bg-zinc-50/80 dark:hover:bg-zinc-800/50"
                  onClick={() => navigate(`/payroll/${rid}`)}
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                    <StatusIcon size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                        {MONTHS[(run.period?.month || 1) - 1]} {run.period?.year}
                      </span>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${STATUS_STYLES[run.status]}`}>
                        {run.status}
                      </span>
                      {run.departmentId?.name && (
                        <span className="text-xs text-zinc-400">{run.departmentId.name}</span>
                      )}
                    </div>
                    <div className="mt-0.5 flex flex-wrap gap-4 text-xs text-zinc-500 dark:text-zinc-400">
                      {run.totals?.employeeCount > 0 && (
                        <span>{run.totals.employeeCount} employees</span>
                      )}
                      {run.totals?.totalNet > 0 && (
                        <span>Net: EGP {fmt(run.totals.totalNet)}</span>
                      )}
                      <span>Created by {run.createdBy}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {canDeleteRuns && run.status === "DRAFT" && (
                      <button
                        className="rounded-lg p-2 text-zinc-400 hover:bg-red-50 hover:text-red-600 transition"
                        onClick={(e) => handleDelete(rid, e)}
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                    <ChevronRight size={18} className="text-zinc-300" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}
