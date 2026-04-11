import React, { useEffect, useMemo, useState } from "react";
import { Layout } from "@/shared/components/Layout";
import { DataTable } from "@/shared/components/DataTable";
import { useAppDispatch, useAppSelector } from "@/shared/hooks/reduxHooks";
import { useToast } from "@/shared/components/ToastProvider";
import { fetchAttendanceThunk, importAttendanceThunk, createAttendanceThunk, updateAttendanceThunk, deleteAttendanceThunk, bulkDeleteAttendanceThunk, fetchMonthlyReportThunk } from "../store";
import { Pagination } from "@/shared/components/Pagination";
import { fetchEmployeesThunk } from "@/modules/employees/store";
import { StatusBadge } from "@/shared/components/EntityBadges";
import { FileUp, Trash2, Edit2, Plus, ShieldCheck, AlertTriangle, Download, Info, Search, Clock, CalendarRange, BarChart3, ChevronDown, ChevronRight, AlertCircle } from "lucide-react";
import { downloadAttendanceTemplateApi, downloadMonthlyReportExcelApi } from "../api";
import {
  formatAttendanceDate,
  formatTotalHours,
  getAttendanceEmployee,
  getAttendanceRowId,
  getAttendancePunchIssue,
  summarizeAttendancePunchIssues,
} from "../utils";

function PunchIssueBadge({ issue }) {
  if (!issue) {
    return <span className="text-[10px] font-medium text-zinc-400">OK</span>;
  }
  const map = {
    missing_check_out: {
      className: "border-amber-200 bg-amber-50 text-amber-900",
      label: "No check-out",
      hint: "Exit time missing — add check-out or edit the record.",
    },
    missing_check_in: {
      className: "border-orange-200 bg-orange-50 text-orange-900",
      label: "No check-in",
      hint: "Entry time missing — add check-in or edit the record.",
    },
    identical_times: {
      className: "border-rose-200 bg-rose-50 text-rose-900",
      label: "Same in & out",
      hint: "Check-in and check-out match exactly — verify punch machine or Excel import.",
    },
  };
  const m = map[issue];
  return (
    <span
      title={m.hint}
      className={`inline-flex max-w-[11rem] items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-semibold leading-tight ${m.className}`}
    >
      <AlertCircle className="h-3 w-3 shrink-0 opacity-90" aria-hidden />
      {m.label}
    </span>
  );
}

export function AttendancePage() {
  const dispatch = useAppDispatch();
  const { showToast } = useToast();
  const { items, isLoading, error: fetchError } = useAppSelector((state) => state.attendance);
  const { items: employees } = useAppSelector((state) => state.employees);
  const { currentUser } = useAppSelector((state) => state.identity);

  // Filters
  const now = new Date();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(now.getDate() - 30);

  const todayStr = now.toISOString().split('T')[0];
  const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];

  const [startDate, setStartDate] = useState(thirtyDaysAgoStr);
  const [endDate, setEndDate] = useState(todayStr);
  const [employeeCode, setEmployeeCode] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [isOverwriteEnabled, setIsOverwriteEnabled] = useState(false);

  // Pagination & Selection
  const [page, setPage] = useState(1);
  const pageSize = 50;
  const [selectedIds, setSelectedIds] = useState(new Set());


  // Manual Entry State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    employeeId: "",
    date: todayStr,
    checkIn: "09:00:00 AM",
    checkOut: "05:00:00 PM",
    status: "PRESENT",
    remarks: ""
  });

  const isAdmin = currentUser?.role === "ADMIN" || currentUser?.role === "HR_STAFF";
  const canViewMonthlyReport =
    currentUser?.role === "ADMIN" ||
    currentUser?.role === "HR_STAFF" ||
    currentUser?.role === "HR_MANAGER";

  // Tab state
  const [activeTab, setActiveTab] = useState("daily"); // "daily" | "monthly"

  // Monthly report state
  const { monthlyReport, monthlyReportLoading, monthlyReportError } = useAppSelector((state) => state.attendance);
  const [reportYear, setReportYear] = useState(now.getUTCFullYear());
  const [reportMonth, setReportMonth] = useState(now.getUTCMonth() + 1);
  const [expandedEmpId, setExpandedEmpId] = useState(null);
  const [isExporting, setIsExporting] = useState(false);

  /** Params sent to GET /attendance (empty employee code is omitted so the API filters correctly). */
  const listQuery = useMemo(() => {
    const q = { startDate, endDate };
    if (isAdmin && employeeCode.trim()) q.employeeCode = employeeCode.trim();
    return q;
  }, [startDate, endDate, employeeCode, isAdmin]);

  useEffect(() => {
    void dispatch(fetchAttendanceThunk(listQuery));
    if (isAdmin) void dispatch(fetchEmployeesThunk());
    setPage(1); // Reset page on filter change
    setSelectedIds(new Set()); // Reset selection
  }, [dispatch, listQuery, isAdmin]);

  const pagedItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, page, pageSize]);

  const totalPages = Math.ceil(items.length / pageSize);

  const punchSummary = useMemo(() => summarizeAttendancePunchIssues(items), [items]);

  const monthlyPunchSummary = useMemo(() => {
    const details = monthlyReport?.details;
    if (!Array.isArray(details) || details.length === 0) {
      return {
        missingCheckIn: 0,
        missingCheckOut: 0,
        identicalTimes: 0,
        affectedRows: 0,
        distinctEmployeeDays: 0,
      };
    }
    let missingCheckIn = 0;
    let missingCheckOut = 0;
    let identicalTimes = 0;
    const empDayKeys = new Set();
    for (const block of details) {
      const eid = block?.employeeId != null ? String(block.employeeId) : "";
      for (const day of block.days || []) {
        const issue = getAttendancePunchIssue(day);
        if (!issue) continue;
        if (issue === "missing_check_in") missingCheckIn += 1;
        else if (issue === "missing_check_out") missingCheckOut += 1;
        else if (issue === "identical_times") identicalTimes += 1;
        if (eid && day?.date) empDayKeys.add(`${eid}:${day.date}`);
      }
    }
    return {
      missingCheckIn,
      missingCheckOut,
      identicalTimes,
      affectedRows: missingCheckIn + missingCheckOut + identicalTimes,
      distinctEmployeeDays: empDayKeys.size,
    };
  }, [monthlyReport]);

  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsImporting(true);
    try {
      const result = await dispatch(importAttendanceThunk({ file, overwrite: isOverwriteEnabled })).unwrap();
      showToast(result.message, result.summary.failed > 0 ? "warning" : "success");
      void dispatch(fetchAttendanceThunk(listQuery));
    } catch (error) {
      showToast(error.message || "Failed to import attendance", "error");
    } finally {
      setIsImporting(false);
      e.target.value = "";
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      await downloadAttendanceTemplateApi();
      showToast("Template download started", "success");
    } catch {
      showToast("Failed to download template", "error");
    }
  };

  const handleSaveManual = async () => {
    try {
      if (editingId) {
        await dispatch(updateAttendanceThunk({ id: editingId, data: formData })).unwrap();
        showToast("Record updated successfully", "success");
      } else {
        await dispatch(createAttendanceThunk(formData)).unwrap();
        showToast("Record added successfully", "success");
      }
      setIsAddModalOpen(false);
      setEditingId(null);
      setFormData({ employeeId: "", date: todayStr, checkIn: "09:00:00 AM", checkOut: "05:00:00 PM", status: "PRESENT", remarks: "" });
      void dispatch(fetchAttendanceThunk(listQuery));
    } catch (error) {
      showToast(error.error || error.message || "Operation failed", "error");
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteId) return;
    try {
      await dispatch(deleteAttendanceThunk(deleteId)).unwrap();
      showToast("Record deleted", "success");
      setDeleteId(null);
      void dispatch(fetchAttendanceThunk(listQuery));
    } catch {
      showToast("Delete failed", "error");
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`Are you sure you want to delete ${selectedIds.size} records?`)) return;

    try {
      const ids = Array.from(selectedIds);
      await dispatch(bulkDeleteAttendanceThunk(ids)).unwrap();
      showToast(`Deleted ${ids.length} records`, "success");
      setSelectedIds(new Set());
      void dispatch(fetchAttendanceThunk(listQuery));
    } catch (err) {
      showToast("Bulk delete failed", "error");
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === pagedItems.length && pagedItems.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(pagedItems.map(item => item._id)));
    }
  };

  const toggleSelectItem = (id) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };


  const handleEditClick = (row) => {
    setEditingId(row._id);
    setFormData({
      employeeId: row.employeeId?._id || "",
      date: new Date(row.date).toISOString().split('T')[0],
      checkIn: row.checkIn,
      checkOut: row.checkOut,
      status: row.status,
      remarks: row.remarks || ""
    });
    setIsAddModalOpen(true);
  };

  const handleLoadMonthlyReport = () => {
    dispatch(fetchMonthlyReportThunk({ year: reportYear, month: reportMonth, detail: true }));
    setExpandedEmpId(null);
  };

  const handleExportExcel = async () => {
    setIsExporting(true);
    try {
      await downloadMonthlyReportExcelApi({ year: reportYear, month: reportMonth });
      showToast("Report exported successfully", "success");
    } catch {
      showToast("Failed to export report", "error");
    } finally {
      setIsExporting(false);
    }
  };

  const STATUS_COLORS = {
    PRESENT: "bg-emerald-50 text-emerald-700",
    LATE: "bg-amber-50 text-amber-700",
    ABSENT: "bg-red-50 text-red-700",
    ON_LEAVE: "bg-sky-50 text-sky-700",
    EXCUSED: "bg-teal-50 text-teal-700",
    EARLY_DEPARTURE: "bg-orange-50 text-orange-700",
    INCOMPLETE: "bg-yellow-50 text-yellow-700",
    HOLIDAY: "bg-indigo-50 text-indigo-700",
  };

  return (
    <Layout
      title="Attendance"
      description="Daily check-in/out per employee and monthly attendance analysis (no salary totals on the monthly tab)."
      actions={
        isAdmin && activeTab === "daily" && (
          <div className="flex items-center gap-3">
            <button
              onClick={() => { 
                setEditingId(null); 
                setFormData({ employeeId: "", date: todayStr, checkIn: "09:00:00 AM", checkOut: "05:00:00 PM", status: "PRESENT", remarks: "" });
                setIsAddModalOpen(true); 
              }}
              className="flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 transition"
            >
              <Plus size={16} />
              Add Manual
            </button>
            <button
               onClick={handleDownloadTemplate}
               className="flex items-center gap-2 rounded-md border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-50"
             >
               <Download size={16} />
               Download Template
             </button>
             <label className="cursor-pointer relative group">
               <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImport} disabled={isImporting} />
               <div className={`flex items-center gap-2 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-zinc-800 ${isImporting ? 'opacity-50 cursor-not-allowed' : ''}`}>
                 <FileUp size={16} />
                 {isImporting ? "Importing..." : "Import Excel"}
               </div>
             </label>
             {selectedIds.size > 0 && (
               <button
                 onClick={handleBulkDelete}
                 className="flex items-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-red-700 transition"
               >
                 <Trash2 size={16} />
                 Delete ({selectedIds.size})
               </button>
             )}
          </div>
        )
      }
    >
      {/* Tab Bar */}
      <div className="mb-6 flex gap-1 rounded-xl border border-zinc-200 bg-zinc-50 p-1 shadow-sm">
        <button
          onClick={() => setActiveTab("daily")}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${activeTab === "daily" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"}`}
        >
          <CalendarRange size={16} />
          Daily Records
        </button>
        {canViewMonthlyReport && (
          <button
            onClick={() => setActiveTab("monthly")}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${activeTab === "monthly" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"}`}
          >
            <BarChart3 size={16} />
            Monthly Report
          </button>
        )}
      </div>
      {activeTab === "daily" && (
      <>
      {fetchError && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          Could not load attendance: {fetchError}
        </div>
      )}

      <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-teal-100 bg-gradient-to-r from-teal-50/90 via-white to-cyan-50/80 p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-600 text-white shadow-md">
            <CalendarRange className="h-5 w-5" strokeWidth={1.75} />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">Records in view</p>
            <p className="text-xs text-slate-600">
              <span className="font-semibold text-teal-800">{items.length}</span> row{items.length === 1 ? "" : "s"}{" "}
              · {startDate} → {endDate}
              {isAdmin && employeeCode.trim() ? (
                <span className="text-violet-700"> · code contains “{employeeCode.trim()}”</span>
              ) : null}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Clock className="h-4 w-4 shrink-0 text-teal-600" />
          Times are stored as 24h on the server; this table shows the saved values.
        </div>
      </div>

      {punchSummary.affectedRows > 0 && (
        <div
          className="mb-6 flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50/90 p-4 shadow-sm sm:flex-row sm:items-start"
          role="status"
        >
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white shadow-md">
            <AlertTriangle className="h-5 w-5" strokeWidth={2} aria-hidden />
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            <p className="text-sm font-semibold text-amber-950">
              Punch data needs review ({punchSummary.affectedRows} row
              {punchSummary.affectedRows === 1 ? "" : "s"}
              {punchSummary.distinctEmployees > 0
                ? ` · ${punchSummary.distinctEmployees} employee${punchSummary.distinctEmployees === 1 ? "" : "s"}`
                : ""}
              )
            </p>
            <ul className="list-inside list-disc space-y-1 text-xs font-medium text-amber-900/95">
              {punchSummary.missingCheckOut > 0 && (
                <li>
                  <strong>{punchSummary.missingCheckOut}</strong> with check-in only — add check-out or set the right
                  status.
                </li>
              )}
              {punchSummary.missingCheckIn > 0 && (
                <li>
                  <strong>{punchSummary.missingCheckIn}</strong> with check-out only — add check-in or fix the import.
                </li>
              )}
              {punchSummary.identicalTimes > 0 && (
                <li>
                  <strong>{punchSummary.identicalTimes}</strong> where check-in and check-out are exactly the same —
                  verify hardware / file columns.
                </li>
              )}
            </ul>
            <p className="text-[11px] leading-snug text-amber-800/85">
              Tip: use <strong>Edit</strong> on a row to complete missing times. Filters apply to this list — widen the
              date range to see all issues.
            </p>
          </div>
        </div>
      )}

      {isAdmin && (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-sky-100 bg-sky-50/60 p-4 shadow-sm">
          <Info size={18} className="mt-0.5 shrink-0 text-sky-600" />
          <div className="text-xs font-medium text-sky-900">
            <p className="mb-1 font-semibold text-sky-950">Import & template</p>
            <p>
              Excel columns (flexible names):{" "}
              <strong>Employee Code</strong>, <strong>Date</strong>, <strong>Check In</strong>, <strong>Check Out</strong>.
              Dates can be YYYY-MM-DD or Excel date cells. Times accept 12h (e.g. 9:00 AM) or 24h. Download the template to match the expected layout.
            </p>
          </div>
        </div>
      )}

      {/* Search & Filter Bar */}
      <div className="mb-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Start Date</label>
          <input 
            type="date" 
            className="px-3 py-2 rounded-lg border border-zinc-200 text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none transition" 
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Until Date</label>
          <input 
            type="date" 
            className="px-3 py-2 rounded-lg border border-zinc-200 text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none transition" 
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>

        {isAdmin && (
          <div className="flex flex-col gap-1.5 flex-1">
             <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Search Employee Code</label>
             <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <input 
                  type="text" 
                  placeholder="e.g. #IT-001"
                  value={employeeCode}
                  onChange={(e) => setEmployeeCode(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 rounded-lg border border-zinc-200 text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none transition" 
                />
             </div>
          </div>
        )}

        {isAdmin && (
          <div className="flex items-center justify-end">
            <div className="flex items-center gap-3 px-4 py-2 rounded-lg bg-zinc-50 border border-zinc-200 h-full">
              <div className="flex items-center gap-2">
                 <ShieldCheck size={16} className={isOverwriteEnabled ? "text-amber-600" : "text-zinc-400"} />
                 <span className="text-xs font-bold text-zinc-700">Overwrite</span>
              </div>
              <button 
                onClick={() => setIsOverwriteEnabled(!isOverwriteEnabled)}
                className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${isOverwriteEnabled ? 'bg-amber-500' : 'bg-zinc-200'}`}
              >
                <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${isOverwriteEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
            </div>
          </div>
        )}
      </div>

      <DataTable
        columns={[
          {
            key: "selection",
            header: (
              <input
                type="checkbox"
                className="rounded border-zinc-300 text-teal-600 focus:ring-teal-500"
                checked={pagedItems.length > 0 && selectedIds.size === pagedItems.length}
                onChange={toggleSelectAll}
              />
            ),
            render: (row) => (
              <input
                type="checkbox"
                className="rounded border-zinc-300 text-teal-600 focus:ring-teal-500"
                checked={selectedIds.has(row._id)}
                onChange={() => toggleSelectItem(row._id)}
              />
            ),
          },
          {
            key: "code",
            header: "Code",
            render: (row) => {
              const emp = getAttendanceEmployee(row);
              const code = emp?.employeeCode || row.employeeCode || "—";
              return (
                <span className="rounded-md border border-teal-200/80 bg-teal-50/80 px-2 py-0.5 font-mono text-xs font-semibold text-teal-900">
                  {code}
                </span>
              );
            },
          },
          {
            key: "employee",
            header: "Employee",
            render: (row) => {
              const emp = getAttendanceEmployee(row);
              const name = emp?.fullName;
              const dept = emp?.department;
              return (
                <div>
                  <p className="font-semibold text-zinc-900">
                    {name || (
                      <span className="text-zinc-500 italic">
                        {row.employeeCode ? `Not linked (${row.employeeCode})` : "No profile"}
                      </span>
                    )}
                  </p>
                  <p className="text-[10px] leading-none text-zinc-500">{dept || "—"}</p>
                </div>
              );
            },
          },
          {
            key: "date",
            header: "Work date",
            render: (row) => (
              <span className="whitespace-nowrap text-sm font-medium text-zinc-700">
                {formatAttendanceDate(row.date)}
              </span>
            ),
          },
          {
            key: "in",
            header: "Check in",
            render: (row) => (
              <div className="text-xs font-semibold text-emerald-700">{row.checkIn || "—"}</div>
            ),
          },
          {
            key: "out",
            header: "Check out",
            render: (row) => (
              <div className="text-xs font-semibold text-amber-700">{row.checkOut || "—"}</div>
            ),
          },
          {
            key: "punchAlert",
            header: "Punch check",
            render: (row) => <PunchIssueBadge issue={getAttendancePunchIssue(row)} />,
          },
          {
            key: "hours",
            header: "Hours",
            render: (row) => (
              <span className="font-mono text-sm font-semibold text-slate-700">{formatTotalHours(row.totalHours)}</span>
            ),
          },
          {
            key: "status",
            header: "Status",
            render: (row) => <StatusBadge status={row.status} />,
          },
          {
            key: "remarks",
            header: "Note",
            render: (row) => (
              <span className="line-clamp-2 max-w-[10rem] text-xs text-zinc-500" title={row.remarks || ""}>
                {row.remarks || "—"}
              </span>
            ),
          },
          {
            key: "actions",
            header: "",
            render: (row) => isAdmin && (
              <div className="flex items-center justify-end gap-2">
                <button onClick={() => handleEditClick(row)} className="p-1.5 text-zinc-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition border border-transparent hover:border-indigo-100">
                  <Edit2 size={14} />
                </button>
                <button onClick={() => setDeleteId(row._id)} className="p-1.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-md transition border border-transparent hover:border-red-100">
                  <Trash2 size={14} />
                </button>
              </div>
            ),
          },
        ]}
        data={pagedItems}
        emptyText={
          isLoading
            ? "Loading…"
            : "No rows for this range. widen the dates, clear the employee code filter, or add/import records."
        }
        getRowKey={(row, index) => getAttendanceRowId(row, index)}
      />

      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />

      {/* Manual Add/Edit Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-zinc-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-[480px] rounded-2xl bg-white p-6 shadow-2xl border border-zinc-200 animate-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold text-zinc-900 mb-1">{editingId ? "Edit Record" : "Add Manual Attendance"}</h3>
            <p className="text-sm text-zinc-500 mb-6">Enter explicit check-in/out times for an employee.</p>
            
            <div className="space-y-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-zinc-600 uppercase">Employee</label>
                <select 
                  className="px-3 py-2 rounded-lg border border-zinc-200 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20"
                  value={formData.employeeId}
                  onChange={(e) => setFormData({...formData, employeeId: e.target.value})}
                  disabled={!!editingId}
                >
                  <option value="">Select Employee...</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.fullName} ({emp.employeeCode})</option>
                  ))}
                </select>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-zinc-600 uppercase">Date</label>
                  <input type="date" className="px-3 py-2 rounded-lg border border-zinc-200 text-sm" value={formData.date} onChange={(e) => setFormData({...formData, date: e.target.value})} disabled={!!editingId} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-zinc-600 uppercase">Status</label>
                  <select className="px-3 py-2 rounded-lg border border-zinc-200 text-sm" value={formData.status} onChange={(e) => setFormData({...formData, status: e.target.value})}>
                    <option value="PRESENT">Present</option>
                    <option value="ABSENT">Absent</option>
                    <option value="LATE">Late Arrival</option>
                    <option value="EXCUSED">Excused (approved permission)</option>
                    <option value="EARLY_DEPARTURE">Early Departure</option>
                    <option value="INCOMPLETE">Incomplete (no checkout)</option>
                    <option value="ON_LEAVE">On Leave</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-zinc-600 uppercase">Check in</label>
                  <input type="text" placeholder="09:00:00 AM or 09:00" className="px-3 py-2 rounded-lg border border-zinc-200 text-sm" value={formData.checkIn} onChange={(e) => setFormData({...formData, checkIn: e.target.value})} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-zinc-600 uppercase">Check out</label>
                  <input type="text" placeholder="05:00:00 PM or 17:00" className="px-3 py-2 rounded-lg border border-zinc-200 text-sm" value={formData.checkOut} onChange={(e) => setFormData({...formData, checkOut: e.target.value})} />
                </div>
              </div>
            </div>

            <div className="mt-8 flex items-center justify-end gap-3">
              <button 
                onClick={() => setIsAddModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 rounded-lg transition"
              >
                Cancel
              </button>
              <button 
                onClick={handleSaveManual}
                className="px-6 py-2 text-sm font-bold text-white bg-zinc-900 rounded-lg shadow-lg hover:shadow-zinc-900/20 transition active:scale-[0.98]"
              >
                {editingId ? "Save Changes" : "Confirm Entry"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteId && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-zinc-900/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="w-[400px] rounded-2xl bg-white p-8 shadow-2xl border border-red-100 animate-in zoom-in-95 duration-200">
            <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-red-600">
              <AlertTriangle size={32} />
            </div>
            <h3 className="text-xl font-bold text-zinc-900 mb-2">Confirm Deletion</h3>
            <p className="text-sm text-zinc-500 mb-8 leading-relaxed">
              Are you sure you want to delete this attendance record? This action is permanent and cannot be undone.
            </p>
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setDeleteId(null)}
                className="flex-1 px-4 py-2.5 text-sm font-bold text-zinc-600 bg-zinc-100 hover:bg-zinc-200 rounded-xl transition"
              >
                Cancel
              </button>
              <button 
                onClick={handleConfirmDelete}
                className="flex-1 px-4 py-2.5 text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-lg shadow-red-600/20 transition active:scale-[0.98]"
              >
                Delete Now
              </button>
            </div>
          </div>
        </div>
      )}
      </>
      )}

      {/* ─── Monthly Report Tab ─── */}
      {activeTab === "monthly" && canViewMonthlyReport && (
        <div className="space-y-6">
          {/* Controls */}
          <div className="flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:flex-row sm:items-end sm:justify-between">
            <div className="flex flex-wrap gap-4">
              <div>
                <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Year</label>
                <input
                  type="number"
                  min={2020}
                  max={2100}
                  className="w-28 rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                  value={reportYear}
                  onChange={(e) => setReportYear(Number(e.target.value))}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Month</label>
                <select
                  className="w-36 rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                  value={reportMonth}
                  onChange={(e) => setReportMonth(Number(e.target.value))}
                >
                  {[...Array(12)].map((_, i) => (
                    <option key={i + 1} value={i + 1}>
                      {new Date(2000, i).toLocaleString(undefined, { month: "long" })}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleLoadMonthlyReport}
                disabled={monthlyReportLoading}
                className="flex items-center gap-2 rounded-lg bg-zinc-900 px-5 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-zinc-800 disabled:opacity-50"
              >
                <BarChart3 size={16} />
                {monthlyReportLoading ? "Loading..." : "Generate Report"}
              </button>
              {monthlyReport && (
                <button
                  onClick={handleExportExcel}
                  disabled={isExporting}
                  className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-50 disabled:opacity-50"
                >
                  <Download size={16} />
                  {isExporting ? "Exporting..." : "Export Excel"}
                </button>
              )}
            </div>
          </div>

          {monthlyReportError && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {monthlyReportError}
            </div>
          )}

          {monthlyReport && (
            <>
              {/* Period info */}
              <div className="flex flex-wrap items-center gap-4 rounded-xl border border-teal-100 bg-teal-50/60 px-4 py-3 text-sm text-teal-900">
                <span className="font-semibold">Fiscal Period:</span>
                {monthlyReport.period.periodStart?.slice(0, 10)} to {monthlyReport.period.periodEnd?.slice(0, 10)}
                <span className="text-teal-600">|</span>
                <span>{monthlyReport.period.expectedWorkingDays} expected working days</span>
                <span className="text-teal-600">|</span>
                <span>{monthlyReport.summary?.length || 0} employees</span>
              </div>

              {monthlyPunchSummary.affectedRows > 0 && (
                <div
                  className="flex flex-col gap-2 rounded-xl border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm text-amber-950"
                  role="status"
                >
                  <div className="flex items-center gap-2 font-semibold">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" aria-hidden />
                    Monthly detail: punch issues ({monthlyPunchSummary.affectedRows} employee-day
                    {monthlyPunchSummary.affectedRows === 1 ? "" : "s"})
                  </div>
                  <ul className="list-inside list-disc space-y-0.5 text-xs font-medium text-amber-900/95">
                    {monthlyPunchSummary.missingCheckOut > 0 && (
                      <li>
                        <strong>{monthlyPunchSummary.missingCheckOut}</strong> day(s) check-in only
                      </li>
                    )}
                    {monthlyPunchSummary.missingCheckIn > 0 && (
                      <li>
                        <strong>{monthlyPunchSummary.missingCheckIn}</strong> day(s) check-out only
                      </li>
                    )}
                    {monthlyPunchSummary.identicalTimes > 0 && (
                      <li>
                        <strong>{monthlyPunchSummary.identicalTimes}</strong> day(s) identical check-in/out
                      </li>
                    )}
                  </ul>
                  <p className="text-[11px] text-amber-800/90">
                    Expand an employee and use the <strong>Punch check</strong> column; fix source rows in Daily Records
                    or re-import.
                  </p>
                </div>
              )}

              {monthlyReport.policySnapshot && (
                <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 px-4 py-3 text-sm text-indigo-900">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                    <span className="font-semibold">Attendance Rules Used:</span>
                    <span>
                      Shift:{" "}
                      <strong>
                        {monthlyReport.policySnapshot.standardStartTime || "09:00"} -{" "}
                        {monthlyReport.policySnapshot.standardEndTime || "17:00"}
                      </strong>
                    </span>
                    <span>
                      Grace:{" "}
                      <strong>
                        {monthlyReport.policySnapshot.gracePeriodMinutes ?? 15} min
                      </strong>
                    </span>
                    <span>
                      Working Days/Month:{" "}
                      <strong>
                        {monthlyReport.policySnapshot.workingDaysPerMonth ?? 22}
                      </strong>
                    </span>
                    <span>
                      Absence Deduction:{" "}
                      <strong>
                        {monthlyReport.policySnapshot.absenceDeductionDays ?? 1} day(s)
                      </strong>
                    </span>
                    <span>
                      Early Departure Deduction:{" "}
                      <strong>
                        {monthlyReport.policySnapshot.earlyDepartureDeductionDays ?? 0} day(s)
                      </strong>
                    </span>
                    <span>
                      Incomplete Deduction:{" "}
                      <strong>
                        {monthlyReport.policySnapshot.incompleteRecordDeductionDays ?? 0} day(s)
                      </strong>
                    </span>
                    <span>
                      Late Tiers:{" "}
                      <strong>
                        {Array.isArray(monthlyReport.policySnapshot.lateDeductionTiers) &&
                        monthlyReport.policySnapshot.lateDeductionTiers.length > 0
                          ? monthlyReport.policySnapshot.lateDeductionTiers
                              .map((tier) => `${tier.fromMinutes}-${tier.toMinutes}m=${tier.deductionDays}d`)
                              .join(" | ")
                          : "none"}
                      </strong>
                    </span>
                  </div>
                </div>
              )}

              {/* Summary Table */}
              <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white shadow-sm">
                <table className="min-w-full divide-y divide-zinc-200 text-sm">
                  <thead className="bg-zinc-50 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                    <tr>
                      <th className="px-3 py-3 w-8" />
                      <th className="px-3 py-3">Code</th>
                      <th className="px-3 py-3">Employee</th>
                      <th className="px-3 py-3">Dept</th>
                      <th className="px-3 py-3 text-center">Present</th>
                      <th className="px-3 py-3 text-center">Late</th>
                      <th className="px-3 py-3 text-center">Absent</th>
                      <th className="px-3 py-3 text-center">Leave</th>
                      <th className="px-3 py-3 text-center">Holiday</th>
                      <th className="px-3 py-3 text-center">Early</th>
                      <th className="px-3 py-3 text-center">Incomplete</th>
                      <th className="px-3 py-3 text-right">Hours</th>
                      <th className="px-3 py-3 text-right">Deducted</th>
                      <th className="px-3 py-3 text-right">Net Days</th>
                      <th
                        className="px-3 py-3 text-right"
                        title="Total of the overtime field on HR-approved assessments for this month (informational only; not used as payroll EGP here)."
                      >
                        OT units
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {(monthlyReport.summary || []).map((s) => {
                      const isExpanded = expandedEmpId === String(s.employeeId);
                      const empDetail = isExpanded
                        ? (monthlyReport.details || []).find((d) => String(d.employeeId) === String(s.employeeId))
                        : null;

                      return (
                        <React.Fragment key={s.employeeId}>
                          <tr
                            className="cursor-pointer transition hover:bg-zinc-50/80"
                            onClick={() => setExpandedEmpId(isExpanded ? null : String(s.employeeId))}
                          >
                            <td className="px-3 py-2.5 text-zinc-400">
                              {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                            </td>
                            <td className="px-3 py-2.5">
                              <span className="rounded-md border border-teal-200/80 bg-teal-50/80 px-2 py-0.5 font-mono text-xs font-semibold text-teal-900">
                                {s.employeeCode}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 font-medium text-zinc-900">{s.fullName}</td>
                            <td className="px-3 py-2.5 text-zinc-500">{s.department || "—"}</td>
                            <td className="px-3 py-2.5 text-center font-semibold text-emerald-700">{s.presentDays}</td>
                            <td className="px-3 py-2.5 text-center font-semibold text-amber-700">{s.lateDays || "—"}</td>
                            <td className="px-3 py-2.5 text-center font-semibold text-red-700">{s.absentDays || "—"}</td>
                            <td className="px-3 py-2.5 text-center font-semibold text-sky-700">{s.onLeaveDays || "—"}</td>
                            <td className="px-3 py-2.5 text-center font-semibold text-indigo-700">{s.holidayDays || "—"}</td>
                            <td className="px-3 py-2.5 text-center font-semibold text-orange-700">{s.earlyDepartureDays || "—"}</td>
                            <td className="px-3 py-2.5 text-center font-semibold text-yellow-700">{s.incompleteDays || "—"}</td>
                            <td className="px-3 py-2.5 text-right font-mono text-zinc-700">{s.totalHoursWorked}</td>
                            <td className="px-3 py-2.5 text-right font-semibold text-red-600">
                              {s.deductions.totalDeductionDays > 0 ? `-${s.deductions.totalDeductionDays}` : "0"}
                            </td>
                            <td className="px-3 py-2.5 text-right font-bold text-zinc-900">{s.netEffectiveDays}</td>
                            <td className="px-3 py-2.5 text-right font-mono font-semibold text-violet-800">
                              {Number.isFinite(Number(s.approvedOvertimeUnits))
                                ? Number(s.approvedOvertimeUnits).toLocaleString()
                                : "—"}
                            </td>
                          </tr>
                          {isExpanded && empDetail && (
                            <tr>
                              <td colSpan={15} className="bg-zinc-50/50 px-4 py-3">
                                <div className="overflow-x-auto rounded-xl border border-zinc-200">
                                  <table className="min-w-full divide-y divide-zinc-200 text-xs">
                                    <thead className="bg-zinc-100 text-left text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                                      <tr>
                                        <th className="px-3 py-2">Date</th>
                                        <th className="px-3 py-2">Status</th>
                                        <th className="px-3 py-2">In</th>
                                        <th className="px-3 py-2">Out</th>
                                        <th className="px-3 py-2">Punch check</th>
                                        <th className="px-3 py-2 text-right">Raw Hrs</th>
                                        <th className="px-3 py-2 text-right">Excused</th>
                                        <th className="px-3 py-2 text-right">Effective</th>
                                        <th className="px-3 py-2 text-right">Deduction</th>
                                        <th className="px-3 py-2">Notes</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-zinc-100 bg-white">
                                      {empDetail.days.map((day) => {
                                        const punchIssue = getAttendancePunchIssue(day);
                                        return (
                                        <tr
                                          key={day.date}
                                          className={
                                            punchIssue
                                              ? "bg-amber-50/35 hover:bg-amber-50/55"
                                              : "hover:bg-zinc-50/50"
                                          }
                                        >
                                          <td className="px-3 py-1.5 font-medium text-zinc-700 whitespace-nowrap">{day.date}</td>
                                          <td className="px-3 py-1.5">
                                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_COLORS[day.status] || "bg-zinc-100 text-zinc-600"}`}>
                                              {day.status}
                                            </span>
                                          </td>
                                          <td className="px-3 py-1.5 text-emerald-700">{day.checkIn || "—"}</td>
                                          <td className="px-3 py-1.5 text-amber-700">{day.checkOut || "—"}</td>
                                          <td className="px-3 py-1.5">
                                            <PunchIssueBadge issue={punchIssue} />
                                          </td>
                                          <td className="px-3 py-1.5 text-right font-mono">{day.rawHours || "—"}</td>
                                          <td className="px-3 py-1.5 text-right font-mono text-teal-600">{day.excusedMinutes > 0 ? `${day.excusedMinutes}m` : "—"}</td>
                                          <td className="px-3 py-1.5 text-right font-mono font-semibold">{day.effectiveHours ? Math.round(day.effectiveHours * 100) / 100 : "—"}</td>
                                          <td className="px-3 py-1.5 text-right font-semibold text-red-600">{day.deduction > 0 ? `-${day.deduction}` : "—"}</td>
                                          <td className="px-3 py-1.5 text-zinc-500 max-w-[16rem] truncate" title={day.notes?.join("; ")}>
                                            {day.notes?.length > 0 ? day.notes.join("; ") : "—"}
                                          </td>
                                        </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {!monthlyReport && !monthlyReportLoading && (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-200 bg-zinc-50/30 py-16 text-center">
              <BarChart3 className="h-12 w-12 text-zinc-300" />
              <p className="mt-4 text-sm font-medium text-zinc-600">No report generated yet</p>
              <p className="mt-1 text-sm text-zinc-500">
                Select a year and month, then click "Generate Report" to see the monthly attendance analysis.
              </p>
            </div>
          )}
        </div>
      )}
    </Layout>
  );
}
