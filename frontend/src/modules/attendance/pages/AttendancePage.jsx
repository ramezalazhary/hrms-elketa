import React, { useEffect, useMemo, useState } from "react";
import { Layout } from "@/shared/components/Layout";
import { DataTable } from "@/shared/components/DataTable";
import { useAppDispatch, useAppSelector } from "@/shared/hooks/reduxHooks";
import { useToast } from "@/shared/components/ToastProvider";
import {
  fetchAttendanceThunk,
  importAttendanceThunk,
  createAttendanceThunk,
  updateAttendanceThunk,
  deleteAttendanceThunk,
  fetchMonthlyReportThunk,
  updateAttendanceDeductionSourceThunk,
} from "../store";
import { Pagination } from "@/shared/components/Pagination";
import { fetchEmployeesThunk } from "@/modules/employees/store";
import { StatusBadge } from "@/shared/components/EntityBadges";
import { FileUp, Trash2, Edit2, Plus, ShieldCheck, AlertTriangle, Download, Info, Search, Clock, CalendarRange, BarChart3, ChevronDown, ChevronRight, AlertCircle } from "lucide-react";
import { downloadAttendanceTemplateApi, downloadMonthlyReportExcelApi } from "../api";
import { getLeaveRequestByIdApi } from "@/modules/employees/api";
import {
  formatAttendanceDate,
  formatTotalHours,
  getAttendanceEmployee,
  getAttendanceRowId,
  getAttendancePunchIssue,
  summarizeAttendancePunchIssues,
} from "../utils";
import { formatLateTierStoredRange } from "@/shared/utils/lateTierTimeFormat";
import {
  ACCESS_LEVEL,
  canAccessAttendance,
  canManageAttendance,
  canViewAttendanceAnalysis,
  getAccessLevelLabel,
  getAttendanceAccessLevel,
  isHrRole,
} from "@/shared/utils/accessControl";

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

function AttendanceStatusCell({ row }) {
  return (
    <div className="inline-flex items-center gap-1.5">
      <StatusBadge status={row.status} />
      {row?.unpaidLeave && (
        <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-700">
          UNPAID
        </span>
      )}
    </div>
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

  // Pagination
  const [page, setPage] = useState(1);
  const pageSize = 50;
  const [expandedRowId, setExpandedRowId] = useState(null);
  const [linkedLeaveById, setLinkedLeaveById] = useState({});
  const [linkedLeaveLoadingId, setLinkedLeaveLoadingId] = useState(null);


  // Manual Entry State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [deductionDecisionModal, setDeductionDecisionModal] = useState({
    open: false,
    rowId: "",
    source: "SALARY",
    valueType: "DAYS",
    value: "0.25",
    saving: false,
  });
  const [formData, setFormData] = useState({
    employeeId: "",
    date: todayStr,
    checkIn: "09:00:00 AM",
    checkOut: "05:00:00 PM",
    status: "PRESENT",
    remarks: ""
  });

  const canManageAttendanceActions = canManageAttendance(currentUser);
  const canUseAttendancePage = canAccessAttendance(currentUser);
  const canViewMonthlyReport = canViewAttendanceAnalysis(currentUser);
  const attendanceAccessLevel = getAttendanceAccessLevel(currentUser);
  const canDeleteAttendance = attendanceAccessLevel === ACCESS_LEVEL.ADMIN;
  const canResolveDeductionSource =
    isHrRole(currentUser) || attendanceAccessLevel === ACCESS_LEVEL.ADMIN;

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
    if (canManageAttendanceActions && employeeCode.trim()) q.employeeCode = employeeCode.trim();
    return q;
  }, [startDate, endDate, employeeCode, canManageAttendanceActions]);

  useEffect(() => {
    if (!canUseAttendancePage) return;
    void dispatch(fetchAttendanceThunk(listQuery));
    if (canManageAttendanceActions) void dispatch(fetchEmployeesThunk());
    setPage(1); // Reset page on filter change
  }, [dispatch, listQuery, canManageAttendanceActions, canUseAttendancePage]);

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

  const openDeductionDecisionModal = (row, source) => {
    const defaultValueType = source === "VACATION_BALANCE" ? "DAYS" : "DAYS";
    const suggestedValue =
      Number(row?.deductionValue) > 0
        ? String(row.deductionValue)
        : Number(row?.excessExcuseFraction) > 0
          ? String(row.excessExcuseFraction)
          : "0.25";
    setDeductionDecisionModal({
      open: true,
      rowId: row?._id || "",
      source,
      valueType: defaultValueType,
      value: suggestedValue,
      saving: false,
    });
  };

  const closeDeductionDecisionModal = () => {
    setDeductionDecisionModal((prev) => ({ ...prev, open: false, saving: false }));
  };

  const handleResolveDeductionSource = async () => {
    const rowId = deductionDecisionModal.rowId;
    const source = deductionDecisionModal.source;
    if (!rowId) return;
    const deductionValueType = String(deductionDecisionModal.valueType || "").trim().toUpperCase();
    if (!["DAYS", "AMOUNT"].includes(deductionValueType)) {
      showToast("Deduction type must be DAYS or AMOUNT", "error");
      return;
    }
    if (source === "VACATION_BALANCE" && deductionValueType !== "DAYS") {
      showToast("Vacation balance deduction must use DAYS", "error");
      return;
    }
    const deductionValue = Number(deductionDecisionModal.value);
    if (!Number.isFinite(deductionValue) || deductionValue <= 0) {
      showToast("Deduction value must be a positive number", "error");
      return;
    }

    setDeductionDecisionModal((prev) => ({ ...prev, saving: true }));
    try {
      await dispatch(
        updateAttendanceDeductionSourceThunk({
          id: rowId,
          deductionSource: source,
          deductionValueType,
          deductionValue,
        }),
      ).unwrap();
      showToast("Deduction decision saved", "success");
      closeDeductionDecisionModal();
      void dispatch(fetchAttendanceThunk(listQuery));
    } catch (error) {
      showToast(error?.message || "Failed to update deduction source", "error");
      setDeductionDecisionModal((prev) => ({ ...prev, saving: false }));
    }
  };

  const loadLinkedLeave = async (leaveRequestId) => {
    if (!leaveRequestId || linkedLeaveById[leaveRequestId]) return;
    setLinkedLeaveLoadingId(leaveRequestId);
    try {
      const doc = await getLeaveRequestByIdApi(leaveRequestId);
      setLinkedLeaveById((prev) => ({ ...prev, [leaveRequestId]: doc || null }));
    } catch {
      setLinkedLeaveById((prev) => ({ ...prev, [leaveRequestId]: null }));
    } finally {
      setLinkedLeaveLoadingId((prev) => (prev === leaveRequestId ? null : prev));
    }
  };

  const formatWorkDateTime = (value) => {
    if (!value) return "—";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleString(undefined, {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
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
    PRESENT: "bg-zinc-100 text-zinc-800",
    LATE: "bg-amber-50 text-amber-800",
    ABSENT: "bg-red-50 text-red-800",
    ON_LEAVE: "bg-zinc-50 text-zinc-700 ring-1 ring-zinc-200/80",
    EXCUSED: "bg-zinc-100 text-zinc-700",
    PARTIAL_EXCUSED: "bg-violet-50 text-violet-800",
    EARLY_DEPARTURE: "bg-orange-50 text-orange-800",
    INCOMPLETE: "bg-yellow-50 text-yellow-800",
    HOLIDAY: "bg-zinc-100 text-zinc-800",
  };

  return (
    <Layout
      title="Attendance"
      description="Daily check-in/out per employee and monthly attendance analysis (no salary totals on the monthly tab)."
      actions={
        canManageAttendanceActions && activeTab === "daily" && (
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              onClick={() => { 
                setEditingId(null); 
                setFormData({ employeeId: "", date: todayStr, checkIn: "09:00:00 AM", checkOut: "05:00:00 PM", status: "PRESENT", remarks: "" });
                setIsAddModalOpen(true); 
              }}
              className="inline-flex items-center gap-2 rounded-full bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800 active:scale-[0.98] motion-reduce:active:scale-100"
            >
              <Plus size={16} />
              Add Manual
            </button>
            <button
               onClick={handleDownloadTemplate}
               className="inline-flex items-center gap-2 rounded-full border border-zinc-200/90 bg-white px-4 py-2.5 text-sm font-medium text-zinc-800 shadow-sm transition hover:bg-zinc-50"
             >
               <Download size={16} />
               Download Template
             </button>
             <label className="relative cursor-pointer">
               <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImport} disabled={isImporting} />
               <div className={`inline-flex items-center gap-2 rounded-full border border-zinc-200/90 bg-white px-4 py-2.5 text-sm font-medium text-zinc-800 shadow-sm transition hover:bg-zinc-50 ${isImporting ? "pointer-events-none opacity-50" : ""}`}>
                 <FileUp size={16} />
                 {isImporting ? "Importing..." : "Import Excel"}
               </div>
             </label>
          </div>
        )
      }
    >
      {/* Tab bar — segmented */}
      <div className="mb-8 inline-flex w-full max-w-md gap-0.5 rounded-2xl bg-zinc-100/90 p-1 ring-1 ring-zinc-200/80 sm:w-auto">
        <button
          type="button"
          onClick={() => setActiveTab("daily")}
          className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition sm:flex-none ${activeTab === "daily" ? "bg-white text-zinc-900 shadow-sm ring-1 ring-zinc-200/60" : "text-zinc-600 hover:text-zinc-900"}`}
        >
          <CalendarRange size={16} />
          Daily Records
        </button>
        {canViewMonthlyReport && (
          <button
            type="button"
            onClick={() => setActiveTab("monthly")}
            className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition sm:flex-none ${activeTab === "monthly" ? "bg-white text-zinc-900 shadow-sm ring-1 ring-zinc-200/60" : "text-zinc-600 hover:text-zinc-900"}`}
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

      <div className="mb-6 flex flex-col gap-4 rounded-[20px] bg-white p-5 shadow-sm ring-1 ring-zinc-950/[0.06] sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-zinc-100 ring-1 ring-zinc-200/80 text-zinc-700">
            <CalendarRange className="h-5 w-5" strokeWidth={1.75} />
          </div>
          <div>
            <p className="text-[15px] font-semibold tracking-tight text-zinc-900">Records in view</p>
            <p className="mt-0.5 text-xs leading-relaxed text-zinc-500">
              <span className="mr-2 rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 font-semibold text-zinc-700">
                {getAccessLevelLabel(attendanceAccessLevel)}
              </span>
              <span className="font-semibold text-zinc-900">{items.length}</span> row{items.length === 1 ? "" : "s"}{" "}
              · {startDate} → {endDate}
              {canManageAttendanceActions && employeeCode.trim() ? (
                <span className="text-zinc-700"> · code contains “{employeeCode.trim()}”</span>
              ) : null}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs leading-relaxed text-zinc-500">
          <Clock className="h-4 w-4 shrink-0 text-zinc-400" />
          Times are stored as 24h on the server; this table shows the saved values.
        </div>
      </div>

      {punchSummary.affectedRows > 0 && (
        <div
          className="mb-6 flex flex-col gap-3 rounded-[20px] border border-amber-200/80 bg-amber-50/40 p-5 shadow-sm ring-1 ring-amber-900/5 sm:flex-row sm:items-start"
          role="status"
        >
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-800 ring-1 ring-amber-200/80">
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

      {canManageAttendanceActions && (
        <div className="mb-6 flex items-start gap-3 rounded-2xl bg-zinc-100/70 p-4 ring-1 ring-zinc-200/80">
          <Info size={18} className="mt-0.5 shrink-0 text-zinc-400" />
          <div className="text-xs font-medium leading-relaxed text-zinc-600">
            <p className="mb-1 font-semibold text-zinc-900">Import & template</p>
            <p>
              Excel columns (flexible names):{" "}
              <strong>Employee Code</strong>, <strong>Date</strong>, <strong>Check In</strong>, <strong>Check Out</strong>.
              Dates can be YYYY-MM-DD or Excel date cells. Times accept 12h (e.g. 9:00 AM) or 24h. Download the template to match the expected layout.
            </p>
          </div>
        </div>
      )}

      {/* Search & filters */}
      <div className="mb-6 grid grid-cols-1 gap-5 rounded-[20px] bg-white p-5 shadow-sm ring-1 ring-zinc-950/[0.06] md:grid-cols-2 lg:grid-cols-4 sm:p-6">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-zinc-500">Start date</label>
          <input 
            type="date" 
            className="rounded-xl border border-zinc-200 bg-zinc-50/50 px-3 py-2.5 text-sm text-zinc-900 outline-none transition focus:border-zinc-400 focus:bg-white focus:ring-2 focus:ring-zinc-200/80" 
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-zinc-500">Until date</label>
          <input 
            type="date" 
            className="rounded-xl border border-zinc-200 bg-zinc-50/50 px-3 py-2.5 text-sm text-zinc-900 outline-none transition focus:border-zinc-400 focus:bg-white focus:ring-2 focus:ring-zinc-200/80" 
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>

        {canManageAttendanceActions && (
          <div className="flex flex-col gap-1.5 flex-1">
             <label className="text-xs font-medium text-zinc-500">Search employee code</label>
             <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <input 
                  type="text" 
                  placeholder="e.g. #IT-001"
                  value={employeeCode}
                  onChange={(e) => setEmployeeCode(e.target.value)}
                  className="w-full rounded-xl border border-zinc-200 bg-zinc-50/50 py-2.5 pl-10 pr-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-400 focus:bg-white focus:ring-2 focus:ring-zinc-200/80" 
                />
             </div>
          </div>
        )}

        {canManageAttendanceActions && (
          <div className="flex items-center justify-end lg:items-end">
            <div className="flex h-full w-full items-center gap-3 rounded-xl border border-zinc-200/80 bg-zinc-50/50 px-4 py-3 lg:w-auto">
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
        className="overflow-hidden rounded-[24px] border border-zinc-200/70 bg-white/95 shadow-sm ring-1 ring-zinc-950/[0.04] backdrop-blur"
        onRowClick={(row) => {
          const rowId = row?._id;
          if (!rowId) return;
          const leaveRefId = row?.excuseLeaveRequestId || row?.leaveRequestId;
          if (leaveRefId) {
            void loadLinkedLeave(String(leaveRefId));
          }
          setExpandedRowId((prev) => (prev === rowId ? null : rowId));
        }}
        expandedRowKey={expandedRowId}
        renderExpandedRow={(row) => {
          const leaveRefId = String(row?.excuseLeaveRequestId || row?.leaveRequestId || "");
          const linkedLeave = leaveRefId ? linkedLeaveById[leaveRefId] : null;
          const leaveLoading = leaveRefId && linkedLeaveLoadingId === leaveRefId;
          return (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-zinc-200/80 bg-white px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">Date</p>
              <p className="mt-1 text-xs font-semibold text-zinc-900">{formatAttendanceDate(row.date)}</p>
            </div>
            <div className="rounded-xl border border-zinc-200/80 bg-white px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">Attendance status</p>
              <div className="mt-1 flex items-center gap-2">
                <StatusBadge status={row.status} />
                {row?.unpaidLeave && (
                  <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-700">
                    UNPAID
                  </span>
                )}
              </div>
              {row?.status === "PARTIAL_EXCUSED" && (
                <p className="mt-1 text-[11px] font-medium text-violet-700">
                  Overage: {Number(row?.excuseOverageMinutes || 0)} min
                </p>
              )}
            </div>
            <div className="rounded-xl border border-zinc-200/80 bg-white px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">Check window</p>
              <p className="mt-1 text-xs font-semibold text-zinc-900 tabular-nums">
                {row.checkIn || "—"} → {row.checkOut || "—"}
              </p>
            </div>
            <div className="rounded-xl border border-zinc-200/80 bg-white px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">Total hours</p>
              <p className="mt-1 text-xs font-semibold text-zinc-900 tabular-nums">{formatTotalHours(row.totalHours)}</p>
            </div>
            <div className="rounded-xl border border-zinc-200/80 bg-white px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">Punch check</p>
              <div className="mt-1"><PunchIssueBadge issue={getAttendancePunchIssue(row)} /></div>
            </div>
            <div className="rounded-xl border border-zinc-200/80 bg-white px-3 py-2 sm:col-span-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">Employee</p>
              <p className="mt-1 text-xs font-semibold text-zinc-900">
                {getAttendanceEmployee(row)?.fullName || row.employeeCode || "—"}
              </p>
            </div>
            <div className="rounded-xl border border-zinc-200/80 bg-white px-3 py-2 sm:col-span-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">Employee code</p>
              <p className="mt-1 text-xs font-semibold text-zinc-900">{row.employeeCode || "—"}</p>
            </div>
            <div className="rounded-xl border border-zinc-200/80 bg-white px-3 py-2 sm:col-span-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">Notes</p>
              <p className="mt-1 text-xs text-zinc-700">{row.remarks || "No additional notes."}</p>
            </div>
            <div className="rounded-xl border border-zinc-200/80 bg-white px-3 py-2 sm:col-span-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">Created</p>
              <p className="mt-1 text-xs text-zinc-700">{formatWorkDateTime(row.createdAt)}</p>
            </div>
            <div className="rounded-xl border border-zinc-200/80 bg-white px-3 py-2 sm:col-span-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">Last update</p>
              <p className="mt-1 text-xs text-zinc-700">{formatWorkDateTime(row.updatedAt)}</p>
            </div>
            {canManageAttendanceActions && (
              <div className="rounded-xl border border-zinc-200/80 bg-white px-3 py-3 sm:col-span-2 lg:col-span-4">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">Row actions</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleEditClick(row)}
                    className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
                  >
                    <Edit2 size={12} />
                    Edit
                  </button>
                  {canDeleteAttendance && (
                    <button
                      type="button"
                      onClick={() => setDeleteId(row._id)}
                      className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50"
                    >
                      <Trash2 size={12} />
                      Delete
                    </button>
                  )}
                </div>
              </div>
            )}
            {(row?.excuseLeaveRequestId || row?.leaveRequestId) && (
              <div className="rounded-xl border border-violet-200/80 bg-violet-50/50 px-3 py-3 sm:col-span-2 lg:col-span-4">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-violet-500">Linked leave approval</p>
                {leaveLoading ? (
                  <p className="mt-1 text-xs text-violet-700">Loading leave approval details...</p>
                ) : linkedLeave ? (
                  <div className="mt-1 grid gap-2 sm:grid-cols-2 lg:grid-cols-4 text-xs text-zinc-700">
                    <p><span className="font-semibold text-zinc-900">Type:</span> {linkedLeave.kind === "EXCUSE" ? "Excuse" : (linkedLeave.leaveType || linkedLeave.kind || "Leave")}</p>
                    <p><span className="font-semibold text-zinc-900">Request status:</span> {linkedLeave.status || "—"}</p>
                    <p><span className="font-semibold text-zinc-900">Payment:</span> {linkedLeave.effectivePaymentType || "—"}</p>
                    <p><span className="font-semibold text-zinc-900">Source:</span> {row?.excuseLeaveRequestId ? "Excuse coverage" : "Vacation approval"}</p>
                    {linkedLeave.unpaidReason && (
                      <p className="sm:col-span-2 lg:col-span-4">
                        <span className="font-semibold text-zinc-900">Unpaid reason:</span> {linkedLeave.unpaidReason}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="mt-1 text-xs text-violet-700">
                    Leave reference detected ({leaveRefId}), but full approval details are unavailable for your scope.
                  </p>
                )}
              </div>
            )}
            {row?.status === "PARTIAL_EXCUSED" && (
              <div className="rounded-xl border border-violet-200/80 bg-violet-50/60 px-3 py-3 sm:col-span-2 lg:col-span-4">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-violet-500">
                  Deduction decision
                </p>
                <p className="mt-1 text-xs text-violet-900">
                  Source:{" "}
                  <strong>
                    {row?.deductionSource === "SALARY"
                      ? "Salary"
                      : row?.deductionSource === "VACATION_BALANCE"
                        ? "Vacation balance"
                        : "Pending HR decision"}
                  </strong>
                  {row?.deductionValueType && Number(row?.deductionValue) > 0
                    ? ` · Value: ${Number(row.deductionValue).toFixed(2)} ${row.deductionValueType === "AMOUNT" ? "amount" : "day(s)"}`
                    : Number(row?.excessExcuseFraction || 0) > 0
                      ? ` · Suggested: ${Number(row.excessExcuseFraction).toFixed(2)} day(s)`
                      : ""}
                </p>
                {row?.requiresDeductionDecision && (
                  <p className="mt-1 text-xs font-semibold text-amber-700">
                    HR must choose deduction source before payroll finalization.
                  </p>
                )}
                {canResolveDeductionSource && (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openDeductionDecisionModal(row, "SALARY")}
                      className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
                    >
                      Set Salary
                    </button>
                    <button
                      type="button"
                      onClick={() => openDeductionDecisionModal(row, "VACATION_BALANCE")}
                      className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
                    >
                      Set Vacation Balance
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
          );
        }}
        columns={[
          {
            key: "employee",
            header: "Employee",
            cellClassName: "max-w-[12rem] sm:max-w-[16rem]",
            render: (row) => {
              const emp = getAttendanceEmployee(row);
              const name = emp?.fullName;
              const dept = emp?.department;
              return (
                <div className="min-w-0">
                  <p className="truncate font-semibold text-zinc-900">
                    {name || (
                      <span className="text-zinc-500 italic">
                        {row.employeeCode ? `Not linked (${row.employeeCode})` : "No profile"}
                      </span>
                    )}
                  </p>
                  <p className="truncate text-[10px] leading-none text-zinc-500">{dept || "—"}</p>
                </div>
              );
            },
          },
          {
            key: "date",
            header: "Work date",
            cellClassName: "whitespace-nowrap",
            render: (row) => (
              <span className="text-sm font-medium text-zinc-700">
                {formatAttendanceDate(row.date)}
              </span>
            ),
          },
          {
            key: "timeWindow",
            header: "Time window",
            cellClassName: "whitespace-nowrap",
            render: (row) => (
              <div className="rounded-lg border border-zinc-200/80 bg-zinc-50/70 px-2.5 py-1 text-xs font-semibold text-zinc-800 tabular-nums">
                {(row.checkIn || "—")} {"->"} {(row.checkOut || "—")}
              </div>
            ),
          },
          {
            key: "status",
            header: "Status",
            cellClassName: "whitespace-nowrap",
            render: (row) => <AttendanceStatusCell row={row} />,
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
          <div className="w-[480px] max-w-[calc(100vw-2rem)] rounded-[20px] bg-white p-6 shadow-xl ring-1 ring-zinc-950/[0.08] animate-in zoom-in-95 duration-200">
            <h3 className="text-[17px] font-semibold tracking-tight text-zinc-900">{editingId ? "Edit Record" : "Add Manual Attendance"}</h3>
            <p className="mt-1 text-sm leading-relaxed text-zinc-500">Enter explicit check-in/out times for an employee.</p>
            
            <div className="mt-6 space-y-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-zinc-500">Employee</label>
                <select 
                  className="rounded-xl border border-zinc-200 bg-zinc-50/50 px-3 py-2.5 text-sm text-zinc-900 outline-none transition focus:border-zinc-400 focus:bg-white focus:ring-2 focus:ring-zinc-200/80"
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
              
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-zinc-500">Date</label>
                <input type="date" className="rounded-xl border border-zinc-200 bg-zinc-50/50 px-3 py-2.5 text-sm text-zinc-900 outline-none transition focus:border-zinc-400 focus:bg-white focus:ring-2 focus:ring-zinc-200/80" value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} disabled={!!editingId} />
              </div>
              {editingId && formData.status && (
                <div className="flex flex-wrap items-center gap-2 rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-2 text-xs text-zinc-600">
                  <span className="font-semibold text-zinc-700">Saved status</span>
                  <StatusBadge status={formData.status} />
                  <span className="text-zinc-500">Saving recomputes from times and policy.</span>
                </div>
              )}
              <p className="text-xs text-zinc-500 leading-relaxed">
                Present / Late / Early departure / Incomplete is always calculated on the server from the times below and company attendance rules (including approved leave or excuses where applicable).
              </p>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-zinc-500">Check in</label>
                  <input type="text" placeholder="09:00:00 AM or 09:00" className="rounded-xl border border-zinc-200 bg-zinc-50/50 px-3 py-2.5 text-sm text-zinc-900 outline-none transition focus:border-zinc-400 focus:bg-white focus:ring-2 focus:ring-zinc-200/80" value={formData.checkIn} onChange={(e) => setFormData({...formData, checkIn: e.target.value})} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-zinc-500">Check out</label>
                  <input type="text" placeholder="05:00:00 PM or 17:00" className="rounded-xl border border-zinc-200 bg-zinc-50/50 px-3 py-2.5 text-sm text-zinc-900 outline-none transition focus:border-zinc-400 focus:bg-white focus:ring-2 focus:ring-zinc-200/80" value={formData.checkOut} onChange={(e) => setFormData({...formData, checkOut: e.target.value})} />
                </div>
              </div>
            </div>

            <div className="mt-8 flex items-center justify-end gap-3">
              <button 
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="rounded-full px-4 py-2.5 text-sm font-medium text-zinc-600 transition hover:bg-zinc-100"
              >
                Cancel
              </button>
              <button 
                type="button"
                onClick={handleSaveManual}
                className="rounded-full bg-zinc-900 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800 active:scale-[0.98] motion-reduce:active:scale-100"
              >
                {editingId ? "Save Changes" : "Confirm Entry"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteId && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-zinc-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-[400px] max-w-[calc(100vw-2rem)] rounded-[20px] bg-white p-8 shadow-xl ring-1 ring-zinc-950/[0.08] animate-in zoom-in-95 duration-200">
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-600 ring-1 ring-red-100/80">
              <AlertTriangle size={26} />
            </div>
            <h3 className="text-[17px] font-semibold tracking-tight text-zinc-900">Confirm deletion</h3>
            <p className="mt-2 text-sm leading-relaxed text-zinc-500">
              Are you sure you want to delete this attendance record? This action is permanent and cannot be undone.
            </p>
            <div className="mt-8 flex items-center gap-3">
              <button 
                type="button"
                onClick={() => setDeleteId(null)}
                className="flex-1 rounded-full px-4 py-2.5 text-sm font-medium text-zinc-600 transition hover:bg-zinc-100"
              >
                Cancel
              </button>
              <button 
                type="button"
                onClick={handleConfirmDelete}
                className="flex-1 rounded-full bg-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700 active:scale-[0.98] motion-reduce:active:scale-100"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Deduction Decision Modal */}
      {deductionDecisionModal.open && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/35 backdrop-blur-xl animate-in fade-in duration-200">
          <div className="w-[460px] max-w-[calc(100vw-2rem)] rounded-[28px] border border-white/70 bg-white/90 p-6 shadow-2xl ring-1 ring-zinc-950/[0.06] animate-in zoom-in-95 duration-200">
            <div className="mb-5">
              <h3 className="text-[20px] font-semibold tracking-tight text-zinc-900">Deduction Decision</h3>
              <p className="mt-1 text-sm text-zinc-500">
                Set final payroll routing and value for this partial excuse row.
              </p>
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-zinc-200/80 bg-white/70 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Deduction Source</p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {["SALARY", "VACATION_BALANCE"].map((source) => (
                    <button
                      key={source}
                      type="button"
                      onClick={() =>
                        setDeductionDecisionModal((prev) => ({
                          ...prev,
                          source,
                          valueType: source === "VACATION_BALANCE" ? "DAYS" : prev.valueType,
                        }))
                      }
                      className={`rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                        deductionDecisionModal.source === source
                          ? "border-zinc-900 bg-zinc-900 text-white"
                          : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
                      }`}
                    >
                      {source === "SALARY" ? "Salary" : "Vacation Balance"}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-500">Value Type</label>
                  <select
                    value={deductionDecisionModal.valueType}
                    onChange={(e) =>
                      setDeductionDecisionModal((prev) => ({
                        ...prev,
                        valueType: e.target.value,
                      }))
                    }
                    disabled={deductionDecisionModal.source === "VACATION_BALANCE"}
                    className="w-full rounded-xl border border-zinc-200 bg-zinc-50/70 px-3 py-2.5 text-sm text-zinc-900 outline-none transition focus:border-zinc-400 focus:bg-white focus:ring-2 focus:ring-zinc-200/80 disabled:opacity-60"
                  >
                    <option value="DAYS">Days</option>
                    <option value="AMOUNT">Amount</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-500">
                    {deductionDecisionModal.valueType === "AMOUNT" ? "Amount" : "Days"}
                  </label>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={deductionDecisionModal.value}
                    onChange={(e) =>
                      setDeductionDecisionModal((prev) => ({ ...prev, value: e.target.value }))
                    }
                    className="w-full rounded-xl border border-zinc-200 bg-zinc-50/70 px-3 py-2.5 text-sm text-zinc-900 outline-none transition focus:border-zinc-400 focus:bg-white focus:ring-2 focus:ring-zinc-200/80"
                  />
                </div>
              </div>

              <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/70 px-3 py-2 text-xs text-zinc-600">
                {deductionDecisionModal.source === "VACATION_BALANCE"
                  ? "Vacation balance supports DAYS only."
                  : "Salary supports both DAYS and AMOUNT."}
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={closeDeductionDecisionModal}
                disabled={deductionDecisionModal.saving}
                className="rounded-full px-4 py-2 text-sm font-medium text-zinc-600 transition hover:bg-zinc-100 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleResolveDeductionSource}
                disabled={deductionDecisionModal.saving}
                className="rounded-full bg-zinc-900 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800 disabled:opacity-60"
              >
                {deductionDecisionModal.saving ? "Saving..." : "Save Decision"}
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
          <div className="flex flex-col gap-4 rounded-[20px] bg-white p-5 shadow-sm ring-1 ring-zinc-950/[0.06] sm:flex-row sm:items-end sm:justify-between">
            <div className="flex flex-wrap gap-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-500">Year</label>
                <input
                  type="number"
                  min={2020}
                  max={2100}
                  className="w-28 rounded-xl border border-zinc-200 bg-zinc-50/50 px-3 py-2.5 text-sm text-zinc-900 outline-none transition focus:border-zinc-400 focus:bg-white focus:ring-2 focus:ring-zinc-200/80"
                  value={reportYear}
                  onChange={(e) => setReportYear(Number(e.target.value))}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-500">Month</label>
                <select
                  className="w-36 rounded-xl border border-zinc-200 bg-zinc-50/50 px-3 py-2.5 text-sm text-zinc-900 outline-none transition focus:border-zinc-400 focus:bg-white focus:ring-2 focus:ring-zinc-200/80"
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
            <div className="flex flex-wrap gap-2 sm:gap-3">
              <button
                type="button"
                onClick={handleLoadMonthlyReport}
                disabled={monthlyReportLoading}
                className="inline-flex items-center gap-2 rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800 disabled:opacity-50 active:scale-[0.98] motion-reduce:active:scale-100"
              >
                <BarChart3 size={16} />
                {monthlyReportLoading ? "Loading..." : "Generate Report"}
              </button>
              {monthlyReport && (
                <button
                  type="button"
                  onClick={handleExportExcel}
                  disabled={isExporting}
                  className="inline-flex items-center gap-2 rounded-full border border-zinc-200/90 bg-white px-4 py-2.5 text-sm font-medium text-zinc-800 shadow-sm transition hover:bg-zinc-50 disabled:opacity-50"
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
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-[20px] bg-zinc-50/80 px-4 py-3 text-sm text-zinc-800 ring-1 ring-zinc-200/80">
                <span className="font-semibold text-zinc-900">Fiscal period</span>
                <span className="hidden text-zinc-300 sm:inline">·</span>
                <span>{monthlyReport.period.periodStart?.slice(0, 10)} to {monthlyReport.period.periodEnd?.slice(0, 10)}</span>
                <span className="hidden text-zinc-300 sm:inline">·</span>
                <span>{monthlyReport.period.expectedWorkingDays} expected working days</span>
                <span className="hidden text-zinc-300 sm:inline">·</span>
                <span>{monthlyReport.summary?.length || 0} employees</span>
              </div>

              {monthlyPunchSummary.affectedRows > 0 && (
                <div
                  className="flex flex-col gap-2 rounded-[20px] bg-amber-50/80 px-4 py-3 text-sm text-amber-950 ring-1 ring-amber-200/70"
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
                <div className="rounded-[20px] bg-zinc-50/90 px-4 py-3 text-sm text-zinc-800 ring-1 ring-zinc-200/80">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                    <span className="font-semibold text-zinc-900">Attendance rules used</span>
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
                              .map(
                                (tier) =>
                                  `${formatLateTierStoredRange(tier.fromMinutes, tier.toMinutes)}=${tier.deductionDays}d`,
                              )
                              .join(" | ")
                          : "none"}
                      </strong>
                    </span>
                  </div>
                </div>
              )}

              {/* Summary Table */}
              <div className="overflow-x-auto rounded-[20px] bg-white shadow-sm ring-1 ring-zinc-950/[0.06]">
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
                              <span className="rounded-lg border border-zinc-200/80 bg-zinc-100/80 px-2 py-0.5 font-mono text-xs font-semibold text-zinc-800">
                                {s.employeeCode}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 font-medium text-zinc-900">{s.fullName}</td>
                            <td className="px-3 py-2.5 text-zinc-500">{s.department || "—"}</td>
                            <td className="px-3 py-2.5 text-center font-semibold text-zinc-800">{s.presentDays}</td>
                            <td className="px-3 py-2.5 text-center font-semibold text-amber-800">{s.lateDays || "—"}</td>
                            <td className="px-3 py-2.5 text-center font-semibold text-red-700">{s.absentDays || "—"}</td>
                            <td className="px-3 py-2.5 text-center font-semibold text-zinc-700">{s.onLeaveDays || "—"}</td>
                            <td className="px-3 py-2.5 text-center font-semibold text-zinc-700">{s.holidayDays || "—"}</td>
                            <td className="px-3 py-2.5 text-center font-semibold text-orange-700">{s.earlyDepartureDays || "—"}</td>
                            <td className="px-3 py-2.5 text-center font-semibold text-yellow-700">{s.incompleteDays || "—"}</td>
                            <td className="px-3 py-2.5 text-right font-mono text-zinc-700">{s.totalHoursWorked}</td>
                            <td className="px-3 py-2.5 text-right font-semibold text-red-600">
                              {s.deductions.totalDeductionDays > 0 ? `-${s.deductions.totalDeductionDays}` : "0"}
                            </td>
                            <td className="px-3 py-2.5 text-right font-bold text-zinc-900">{s.netEffectiveDays}</td>
                            <td className="px-3 py-2.5 text-right font-mono font-semibold text-zinc-800">
                              {Number.isFinite(Number(s.approvedOvertimeUnits))
                                ? Number(s.approvedOvertimeUnits).toLocaleString()
                                : "—"}
                            </td>
                          </tr>
                          {isExpanded && empDetail && (
                            <tr>
                              <td colSpan={15} className="bg-zinc-50/50 px-4 py-3">
                                <div className="overflow-x-auto rounded-2xl bg-white ring-1 ring-zinc-200/80">
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
                                          <td className="px-3 py-1.5 text-zinc-800">{day.checkIn || "—"}</td>
                                          <td className="px-3 py-1.5 text-zinc-800">{day.checkOut || "—"}</td>
                                          <td className="px-3 py-1.5">
                                            <PunchIssueBadge issue={punchIssue} />
                                          </td>
                                          <td className="px-3 py-1.5 text-right font-mono">{day.rawHours || "—"}</td>
                                          <td className="px-3 py-1.5 text-right font-mono text-zinc-700">{day.excusedMinutes > 0 ? `${day.excusedMinutes}m` : "—"}</td>
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
            <div className="flex flex-col items-center justify-center rounded-[20px] border border-dashed border-zinc-200/90 bg-zinc-50/40 py-16 text-center ring-1 ring-zinc-950/[0.04]">
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
