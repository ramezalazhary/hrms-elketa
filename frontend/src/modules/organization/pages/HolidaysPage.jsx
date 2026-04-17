import { useCallback, useEffect, useState } from "react";
import { Layout } from "@/shared/components/Layout";
import { useToast } from "@/shared/components/ToastProvider";
import { useAppSelector } from "@/shared/hooks/reduxHooks";
import {
  ACCESS_LEVEL,
  canManageHolidays,
  getAccessLevelLabel,
  getHolidaysAccessLevel,
} from "@/shared/utils/accessControl";
import {
  getHolidaysApi,
  createHolidayApi,
  updateHolidayApi,
  deleteHolidayApi,
} from "../api";
import { getDepartmentsApi } from "@/modules/departments/api";
import { getEmployeesApi } from "@/modules/employees/api";
import {
  CalendarOff,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Building2,
  User,
  Globe,
  X,
  CalendarRange,
  AlertTriangle,
} from "lucide-react";

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - 1 + i);
const MONTHS = [
  { value: "", label: "All months" },
  { value: "1", label: "January" },
  { value: "2", label: "February" },
  { value: "3", label: "March" },
  { value: "4", label: "April" },
  { value: "5", label: "May" },
  { value: "6", label: "June" },
  { value: "7", label: "July" },
  { value: "8", label: "August" },
  { value: "9", label: "September" },
  { value: "10", label: "October" },
  { value: "11", label: "November" },
  { value: "12", label: "December" },
];

const SCOPE_CONFIG = {
  COMPANY: { label: "Company-wide", icon: Globe, color: "bg-blue-50 text-blue-700 ring-blue-200" },
  DEPARTMENT: { label: "Department", icon: Building2, color: "bg-violet-50 text-violet-700 ring-violet-200" },
  EMPLOYEE: { label: "Employee", icon: User, color: "bg-teal-50 text-teal-700 ring-teal-200" },
};

function ScopeBadge({ scope }) {
  const cfg = SCOPE_CONFIG[scope] || SCOPE_CONFIG.COMPANY;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${cfg.color}`}>
      <Icon className="h-3 w-3" />
      {cfg.label}
    </span>
  );
}

function formatDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
}

function toInputDate(d) {
  if (!d) return "";
  return new Date(d).toISOString().slice(0, 10);
}

const EMPTY_FORM = {
  title: "",
  startDate: "",
  endDate: "",
  scope: "COMPANY",
  targetDepartmentId: "",
  targetEmployeeId: "",
};

export function HolidaysPage({ embedded = false }) {
  const { currentUser } = useAppSelector((state) => state.identity);
  const canManage = canManageHolidays(currentUser);
  const holidaysAccessLevel = getHolidaysAccessLevel(currentUser);
  const canDeleteHoliday = holidaysAccessLevel === ACCESS_LEVEL.ADMIN;
  const { showToast } = useToast();

  const [filterYear, setFilterYear] = useState(String(CURRENT_YEAR));
  const [filterMonth, setFilterMonth] = useState("");
  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [departments, setDepartments] = useState([]);
  const [employees, setEmployees] = useState([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const fetchHolidays = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getHolidaysApi({
        year: filterYear || undefined,
        month: filterMonth || undefined,
      });
      setHolidays(Array.isArray(data) ? data : []);
    } catch (err) {
      showToast(err.message || "Failed to load holidays", "error");
    } finally {
      setLoading(false);
    }
  }, [filterYear, filterMonth, showToast]);

  useEffect(() => {
    fetchHolidays();
  }, [fetchHolidays]);

  useEffect(() => {
    if (!modalOpen) return;
    if (departments.length === 0) {
      getDepartmentsApi().then((d) => setDepartments(Array.isArray(d) ? d : [])).catch(() => {});
    }
    if (employees.length === 0) {
      getEmployeesApi({ limit: 500 }).then((d) => {
        const list = Array.isArray(d) ? d : (Array.isArray(d?.employees) ? d.employees : []);
        setEmployees(list);
      }).catch(() => {});
    }
  }, [modalOpen]);

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  }

  function openEdit(h) {
    setEditingId(h._id);
    setForm({
      title: h.title || "",
      startDate: toInputDate(h.startDate),
      endDate: toInputDate(h.endDate),
      scope: h.scope || "COMPANY",
      targetDepartmentId: h.targetDepartmentId?._id || h.targetDepartmentId || "",
      targetEmployeeId: h.targetEmployeeId?._id || h.targetEmployeeId || "",
    });
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingId(null);
  }

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return showToast("Title is required", "error");
    if (!form.startDate || !form.endDate) return showToast("Start and end date are required", "error");
    if (form.endDate < form.startDate) return showToast("End date must be on or after start date", "error");
    if (form.scope === "DEPARTMENT" && !form.targetDepartmentId) return showToast("Please select a department", "error");
    if (form.scope === "EMPLOYEE" && !form.targetEmployeeId) return showToast("Please select an employee", "error");

    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        startDate: form.startDate,
        endDate: form.endDate,
        scope: form.scope,
        targetDepartmentId: form.scope === "DEPARTMENT" ? form.targetDepartmentId : null,
        targetEmployeeId: form.scope === "EMPLOYEE" ? form.targetEmployeeId : null,
      };
      if (editingId) {
        await updateHolidayApi(editingId, payload);
        showToast("Holiday updated", "success");
      } else {
        await createHolidayApi(payload);
        showToast("Holiday declared", "success");
      }
      closeModal();
      fetchHolidays();
    } catch (err) {
      showToast(err.message || "Failed to save holiday", "error");
    } finally {
      setSaving(false);
    }
  }, [form, editingId, fetchHolidays, showToast]);

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      await deleteHolidayApi(deleteTarget._id);
      showToast("Holiday removed", "success");
      setDeleteTarget(null);
      fetchHolidays();
    } catch (err) {
      showToast(err.message || "Failed to delete holiday", "error");
    } finally {
      setSaving(false);
    }
  }, [deleteTarget, fetchHolidays, showToast]);

  const content = (
    <>
      {/* Filters */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <select
          value={filterYear}
          onChange={(e) => setFilterYear(e.target.value)}
          className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-zinc-700 dark:text-zinc-300 shadow-sm focus:outline-none focus:ring-2 focus:ring-zinc-300"
        >
          {YEARS.map((y) => (
            <option key={y} value={String(y)}>{y}</option>
          ))}
        </select>
        <select
          value={filterMonth}
          onChange={(e) => setFilterMonth(e.target.value)}
          className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-zinc-700 dark:text-zinc-300 shadow-sm focus:outline-none focus:ring-2 focus:ring-zinc-300"
        >
          {MONTHS.map((m) => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-zinc-400">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Loading holidays…</span>
          </div>
        ) : holidays.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-zinc-400">
            <CalendarOff className="h-10 w-10 text-zinc-300" />
            <p className="text-sm font-medium">No declared holidays for this period</p>
            {canManage && (
              <button
                type="button"
                onClick={openCreate}
                className="mt-1 text-sm font-semibold text-zinc-700 dark:text-zinc-300 underline underline-offset-2 hover:text-zinc-900 dark:hover:text-zinc-100"
              >
                Declare one now
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-zinc-100 dark:divide-zinc-800 text-sm">
              <thead className="bg-zinc-50/80 dark:bg-zinc-800/50 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                <tr>
                  <th className="px-4 py-3">Title</th>
                  <th className="px-4 py-3">Start</th>
                  <th className="px-4 py-3">End</th>
                  <th className="px-4 py-3">Days</th>
                  <th className="px-4 py-3">Scope</th>
                  <th className="px-4 py-3">Applies to</th>
                  {canManage && <th className="w-20 px-4 py-3" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {holidays.map((h) => {
                  const start = new Date(h.startDate);
                  const end = new Date(h.endDate);
                  const days = Math.round((end - start) / 86400000) + 1;
                  const target =
                    h.scope === "DEPARTMENT"
                      ? (h.targetDepartmentId?.name || "—")
                      : h.scope === "EMPLOYEE"
                      ? `${h.targetEmployeeId?.fullName || "—"} (${h.targetEmployeeId?.employeeCode || ""})`
                      : "All employees";

                  return (
                    <tr key={h._id} className="group hover:bg-zinc-50/60 dark:hover:bg-zinc-800/50 transition-colors">
                      <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-100">{h.title}</td>
                      <td className="px-4 py-3 font-mono text-zinc-600 dark:text-zinc-400">{formatDate(h.startDate)}</td>
                      <td className="px-4 py-3 font-mono text-zinc-600 dark:text-zinc-400">{formatDate(h.endDate)}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800 text-xs font-bold text-zinc-700 dark:text-zinc-300">
                          {days}
                        </span>
                      </td>
                      <td className="px-4 py-3"><ScopeBadge scope={h.scope} /></td>
                      <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{target}</td>
                      {canManage && (
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1 opacity-0 transition group-hover:opacity-100">
                            <button
                              type="button"
                              onClick={() => openEdit(h)}
                              className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-700 dark:hover:text-zinc-300"
                              title="Edit"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            {canDeleteHoliday && (
                              <button
                                type="button"
                                onClick={() => setDeleteTarget(h)}
                                className="rounded-md p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-600"
                                title="Delete"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Info banner */}
      <div className="mt-4 flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50/60 px-4 py-3 text-sm text-blue-800">
        <CalendarRange className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
        <p>
          Declared holidays are applied during monthly attendance analysis. Employees covered by a holiday on a given day will show status <strong>HOLIDAY</strong> — no deduction, no absence, and no leave balance consumed.
        </p>
      </div>

      {/* Create / Edit modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-zinc-900 shadow-2xl ring-1 ring-zinc-200/80 dark:ring-zinc-700">
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800/50 px-6 py-4">
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                {editingId ? "Edit Holiday" : "Declare Holiday"}
              </h2>
              <button type="button" onClick={closeModal} className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-600 dark:hover:text-zinc-400">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
              {/* Title */}
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">Title</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                  placeholder="e.g. National Day, Eid Al-Fitr"
                  className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:border-zinc-400 focus:bg-white dark:focus:bg-zinc-900 focus:outline-none"
                  required
                />
              </div>

              {/* Date range */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">Start date</label>
                  <input
                    type="date"
                    value={form.startDate}
                    onChange={(e) => setForm((p) => ({ ...p, startDate: e.target.value }))}
                    className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:border-zinc-400 focus:bg-white dark:focus:bg-zinc-900 focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">End date</label>
                  <input
                    type="date"
                    value={form.endDate}
                    min={form.startDate}
                    onChange={(e) => setForm((p) => ({ ...p, endDate: e.target.value }))}
                    className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:border-zinc-400 focus:bg-white dark:focus:bg-zinc-900 focus:outline-none"
                    required
                  />
                </div>
              </div>

              {/* Scope */}
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">Applies to</label>
                <div className="grid grid-cols-3 gap-2">
                  {Object.entries(SCOPE_CONFIG).map(([key, cfg]) => {
                    const Icon = cfg.icon;
                    const active = form.scope === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setForm((p) => ({ ...p, scope: key, targetDepartmentId: "", targetEmployeeId: "" }))}
                        className={`flex flex-col items-center gap-1.5 rounded-xl border px-3 py-2.5 text-xs font-semibold transition ${
                          active
                            ? "border-zinc-900 bg-zinc-900 text-white"
                            : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                        {cfg.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Department picker */}
              {form.scope === "DEPARTMENT" && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">Department</label>
                  <select
                    value={form.targetDepartmentId}
                    onChange={(e) => setForm((p) => ({ ...p, targetDepartmentId: e.target.value }))}
                    className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:border-zinc-400 focus:bg-white dark:focus:bg-zinc-900 focus:outline-none"
                    required
                  >
                    <option value="">Select department…</option>
                    {departments.map((d) => (
                      <option key={d._id} value={d._id}>{d.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Employee picker */}
              {form.scope === "EMPLOYEE" && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">Employee</label>
                  <select
                    value={form.targetEmployeeId}
                    onChange={(e) => setForm((p) => ({ ...p, targetEmployeeId: e.target.value }))}
                    className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:border-zinc-400 focus:bg-white dark:focus:bg-zinc-900 focus:outline-none"
                    required
                  >
                    <option value="">Select employee…</option>
                    {employees.map((emp) => (
                      <option key={emp._id} value={emp._id}>
                        {emp.fullName} ({emp.employeeCode})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-xl border border-zinc-200 dark:border-zinc-800 px-4 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800 disabled:opacity-50"
                >
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  {editingId ? "Save changes" : "Declare"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-zinc-900 p-6 shadow-2xl ring-1 ring-zinc-200/80 dark:ring-zinc-700">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-50">
                <AlertTriangle className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Remove holiday?</h3>
                <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">This will affect future attendance analysis runs.</p>
              </div>
            </div>
            <p className="mb-5 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 px-3 py-2 text-sm text-zinc-700 dark:text-zinc-300">
              <strong>{deleteTarget.title}</strong>
              <span className="ml-2 text-zinc-400">
                {formatDate(deleteTarget.startDate)}
                {deleteTarget.startDate !== deleteTarget.endDate && ` → ${formatDate(deleteTarget.endDate)}`}
              </span>
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="rounded-xl border border-zinc-200 dark:border-zinc-800 px-4 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
              >
                {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );

  if (embedded) {
    return (
      <section className="space-y-4">
        <div className="flex flex-col gap-3 rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 bg-zinc-50/70 dark:bg-zinc-800/50 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Company holidays</h2>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Access: {getAccessLevelLabel(holidaysAccessLevel)}. Declared holidays are not counted as absence.
            </p>
          </div>
          {canManage && (
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex items-center gap-2 rounded-full bg-zinc-900 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-zinc-800"
            >
              <Plus className="h-3.5 w-3.5" />
              Declare holiday
            </button>
          )}
        </div>
        {content}
      </section>
    );
  }

  return (
    <Layout
      title="Company Holidays"
      description={`Access: ${getAccessLevelLabel(holidaysAccessLevel)} · Declare paid days off for the whole company, a department, or individual employees. These days are never counted as absence and carry no deduction.`}
      actions={
        canManage && (
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800 active:scale-[0.98]"
          >
            <Plus className="h-4 w-4" />
            Declare Holiday
          </button>
        )
      }
    >
      {content}
    </Layout>
  );
}
