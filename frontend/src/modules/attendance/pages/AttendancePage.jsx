import { useEffect, useMemo, useState } from "react";
import { Layout } from "@/shared/components/Layout";
import { DataTable } from "@/shared/components/DataTable";
import { useAppDispatch, useAppSelector } from "@/shared/hooks/reduxHooks";
import { useToast } from "@/shared/components/ToastProvider";
import { fetchAttendanceThunk, importAttendanceThunk, createAttendanceThunk, updateAttendanceThunk, deleteAttendanceThunk, bulkDeleteAttendanceThunk } from "../store";
import { Pagination } from "@/shared/components/Pagination";
import { fetchEmployeesThunk } from "@/modules/employees/store";
import { StatusBadge } from "@/shared/components/EntityBadges";
import { FileUp, Trash2, Edit2, Plus, ShieldCheck, AlertTriangle, Download, Info, Search, Clock, CalendarRange, CloudCog } from "lucide-react";
import { downloadAttendanceTemplateApi } from "../api";
import {
  formatAttendanceDate,
  formatTotalHours,
  getAttendanceEmployee,
  getAttendanceRowId,
} from "../utils";

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


  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
console.log(file , "the attendacne file")
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

  return (
    <Layout
      title="Attendance"
      description="Daily check-in/out per employee. Adjust the date range to load records from the server; filters apply to the table below."
      actions={
        isAdmin && (
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
    </Layout>
  );
}
