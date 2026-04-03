import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Layout } from "@/shared/components/Layout";
import { Pagination } from "@/shared/components/Pagination";
import { useAppDispatch, useAppSelector } from "@/shared/hooks/reduxHooks";
import { useToast } from "@/shared/components/ToastProvider";
import { fetchEmployeesThunk, deleteEmployeeThunk, processSalaryIncreaseThunk, updateEmployeeThunk } from "../store";
import { DepartmentBadge, StatusBadge } from "@/shared/components/EntityBadges";
import {
  Users, UserPlus, TrendingUp, AlertCircle, AlertTriangle,
  UserX, CalendarX2, RotateCcw, Search, Eye, Pencil,
  ArrowUpDown, ChevronDown, Filter, X, Briefcase, Building2,
  Clock, CreditCard, CalendarDays, MoreHorizontal, UserCheck, UserMinus
} from "lucide-react";
import { FormBuilder } from "@/shared/components/FormBuilder";
import { getDocumentRequirementsApi } from "../../organization/api";
import { SalaryIncreaseModal } from "../components/SalaryIncreaseModal";
import { TerminateEmployeeModal } from "../components/TerminateEmployeeModal";

/* ─── tiny helpers ─── */
const AVATAR_COLORS = [
  "from-violet-500 to-purple-600", "from-teal-500 to-cyan-600",
  "from-rose-500 to-pink-600", "from-amber-500 to-orange-600",
  "from-blue-500 to-indigo-600", "from-emerald-500 to-green-600",
  "from-fuchsia-500 to-pink-600", "from-sky-500 to-blue-600",
];
function getAvatarColor(name) {
  let h = 0;
  for (let i = 0; i < (name || "").length; i++) h = (Math.imul(31, h) + name.charCodeAt(i)) | 0;
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}
function getInitials(name) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return (parts[0]?.[0] + (parts[1]?.[0] || "")).toUpperCase();
}
function formatDate(d) {
  if (!d) return null;
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function EmployeesListPage() {
  const dispatch = useAppDispatch();
  const { showToast } = useToast();
  const employees = useAppSelector((s) => s.employees.items);
  const isLoading = useAppSelector((s) => s.employees.isLoading);
  const role = useAppSelector((s) => s.identity.currentUser?.role);
  const [searchParams, setSearchParams] = useSearchParams();

  const [increaseModalTarget, setIncreaseModalTarget] = useState(null);
  const [terminateModalTarget, setTerminateModalTarget] = useState(null);
  const [orgPolicy, setOrgPolicy] = useState(null);
  const [viewTab, setViewTab] = useState("active");
  const [openActions, setOpenActions] = useState(null); // row id for action dropdown
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    (async () => {
      try { setOrgPolicy(await getDocumentRequirementsApi()); } catch {}
    })();
  }, []);

  const search = searchParams.get("search") || "";
  const departmentFilter = searchParams.get("department") || "all";
  const idExpiringSoon = searchParams.get("idExpiringSoon") === "true";
  const recentTransfers = searchParams.get("recentTransfers") === "true";
  const increasePeriod = searchParams.get("increasePeriod") || "all";

  const [sortBy, setSortBy] = useState("name-asc");
  const [page, setPage] = useState(1);
  const pageSize = 12;

  useEffect(() => {
    void dispatch(fetchEmployeesThunk(Object.fromEntries(searchParams.entries())));
  }, [dispatch, searchParams]);

  const departmentOptions = useMemo(
    () => Array.from(new Set(employees.map((e) => e.department).filter(Boolean))).sort(),
    [employees],
  );

  console.log(employees[0]?.annualAnniversaryDate,'employees data') 
  const activeEmployees = useMemo(() => employees.filter(e => e.status !== "TERMINATED" && e.status !== "RESIGNED"), [employees]);
  const terminatedEmployees = useMemo(() => employees.filter(e => e.status === "TERMINATED" || e.status === "RESIGNED"), [employees]);
  const currentList = viewTab === "active" ? activeEmployees : terminatedEmployees;

  const filtered = useMemo(() => {
    const r = [...currentList];
    r.sort((a, b) => {
      if (sortBy === "name-asc") return (a.fullName || "").localeCompare(b.fullName || "");
      if (sortBy === "name-desc") return (b.fullName || "").localeCompare(a.fullName || "");
      if (sortBy === "salary-increase-asc") {
        const ra = a.nextReviewDate ?? a.yearlySalaryIncreaseDate;
        const rb = b.nextReviewDate ?? b.yearlySalaryIncreaseDate;
        const va = ra ? new Date(ra).getTime() : Infinity;
        const vb = rb ? new Date(rb).getTime() : Infinity;
        return va - vb;
      }
      if (sortBy === "id-expiry-asc") {
        const va = a.nationalIdExpiryDate ? new Date(a.nationalIdExpiryDate).getTime() : Infinity;
        const vb = b.nationalIdExpiryDate ? new Date(b.nationalIdExpiryDate).getTime() : Infinity;
        return va - vb;
      }
      if (sortBy === "termination-desc") {
        const va = a.terminationDate ? new Date(a.terminationDate).getTime() : 0;
        const vb = b.terminationDate ? new Date(b.terminationDate).getTime() : 0;
        return vb - va;
      }
      return 0;
    });
    return r;
  }, [currentList, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);
  const canModify = ["ADMIN", "HR_STAFF", "HR_MANAGER"].includes(role);

  // Close action dropdown on outside click
  useEffect(() => {
    const handler = () => setOpenActions(null);
    if (openActions) document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [openActions]);

  const setFilter = (key, value) => {
    const next = new URLSearchParams(searchParams);
    if (value && value !== "all" && value !== "false") next.set(key, value);
    else next.delete(key);
    setSearchParams(next);
    setPage(1);
  };

  const handleProcessIncrease = async (values) => {
    try {
      await dispatch(processSalaryIncreaseThunk({
        id: increaseModalTarget.id, ...values,
        increasePercentage: values.method === "PERCENT" ? values.value : undefined,
        increaseAmount: values.method === "FIXED" ? values.value : undefined,
      })).unwrap();
      showToast(`Salary increase processed for ${increaseModalTarget.fullName}`, "success");
      setIncreaseModalTarget(null);
    } catch (err) { showToast(err.message || "Failed to process increase", "error"); }
  };

  const handleTerminate = async (values) => {
    try {
      await dispatch(updateEmployeeThunk({
        id: terminateModalTarget.id,
        status: values.status || "TERMINATED",
        terminationDate: values.terminationDate,
        terminationReason: values.terminationReason,
      })).unwrap();
      showToast(`${terminateModalTarget.fullName} marked as ${values.status || "TERMINATED"}`, "success");
      setTerminateModalTarget(null);
    } catch (err) { showToast(err.message || "Failed", "error"); }
  };

  const handleReactivate = async (emp) => {
    if (!window.confirm(`Reactivate ${emp.fullName}?`)) return;
    try {
      await dispatch(updateEmployeeThunk({ id: emp.id, status: "ACTIVE", terminationDate: null, terminationReason: null })).unwrap();
      showToast(`${emp.fullName} reactivated`, "success");
    } catch (err) { showToast(err.message || "Failed", "error"); }
  };

  const activeFiltersCount = [departmentFilter !== "all", idExpiringSoon, recentTransfers, increasePeriod !== "all"].filter(Boolean).length;

  return (
    <Layout
      title="Employees"
      description="Directory, filters, and quick actions for your workforce."
      actions={
        ["ADMIN", "HR_STAFF", "HR_MANAGER"].includes(role) ? (
          <div className="flex gap-2">
            <Link className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50" to="/employees/onboarding">
              <Users className="h-4 w-4 opacity-70" /> Onboarding
            </Link>
            <Link className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-teal-600 to-cyan-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-teal-600/25 transition hover:shadow-xl hover:shadow-teal-600/30" to="/employees/create">
              <UserPlus className="h-4 w-4" /> Add employee
            </Link>
          </div>
        ) : null
      }
    >
      {/* ─── STAT CARDS ─── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total Workforce", value: employees.length, icon: Users, color: "from-slate-600 to-slate-800", bg: "bg-slate-50 border-slate-200" },
          { label: "Active", value: activeEmployees.length, icon: UserCheck, color: "from-emerald-500 to-emerald-700", bg: "bg-emerald-50 border-emerald-200" },
          { label: "On Leave", value: employees.filter(e => e.status === "ON_LEAVE").length, icon: CalendarDays, color: "from-amber-500 to-amber-700", bg: "bg-amber-50 border-amber-200" },
          { label: "Separated", value: terminatedEmployees.length, icon: UserMinus, color: "from-rose-500 to-rose-700", bg: "bg-rose-50 border-rose-200" },
        ].map((stat) => (
          <div key={stat.label} className={`flex items-center gap-3 rounded-xl border p-4 ${stat.bg} transition hover:shadow-sm`}>
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${stat.color} text-white shadow-sm`}>
              <stat.icon className="h-5 w-5" strokeWidth={1.75} />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums text-slate-900">{stat.value}</p>
              <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ─── CONTROLS SECTION ─── */}
      <div className="flex flex-col gap-4">
        {/* ─── TABS + SEARCH BAR ─── */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Tabs */}
          <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1">
            <button type="button" onClick={() => { setViewTab("active"); setPage(1); }}
              className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition ${viewTab === "active" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
              <UserCheck className="h-3.5 w-3.5" /> Active
              <span className={`ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none ${viewTab === "active" ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-500"}`}>{activeEmployees.length}</span>
            </button>
            <button type="button" onClick={() => { setViewTab("terminated"); setPage(1); }}
              className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition ${viewTab === "terminated" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
              <UserX className="h-3.5 w-3.5" /> Separated
              {terminatedEmployees.length > 0 && (
                <span className={`ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none ${viewTab === "terminated" ? "bg-rose-100 text-rose-700" : "bg-slate-200 text-slate-500"}`}>{terminatedEmployees.length}</span>
              )}
            </button>
          </div>

          {/* Search + Filter toggle */}
          <div className="flex items-center gap-2 flex-1 max-w-lg">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text" placeholder="Search name or code…"
                className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-10 text-sm shadow-sm transition focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                value={search}
                onChange={(e) => setFilter("search", e.target.value)}
              />
              {search && (
                <button onClick={() => setFilter("search", "")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <button type="button" onClick={() => setShowFilters(!showFilters)}
              className={`relative flex items-center gap-1.5 rounded-xl border px-3.5 py-2.5 text-sm font-medium transition ${showFilters ? "border-teal-300 bg-teal-50 text-teal-700" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}>
              <Filter className="h-4 w-4" />
              Filters
              {activeFiltersCount > 0 && (
                <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-teal-600 text-[10px] font-bold text-white">{activeFiltersCount}</span>
              )}
            </button>
          </div>
        </div>

        {/* ─── FILTER BAR (collapsible) ─── */}
        {showFilters && (
          <div className="animate-in slide-in-from-top-2 rounded-xl border border-slate-200 bg-white p-4 shadow-sm mt-1">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Refine Results</span>
              {activeFiltersCount > 0 && (
                <button onClick={() => {
                  const next = new URLSearchParams();
                  if (search) next.set("search", search);
                  setSearchParams(next);
                }} className="text-xs font-medium text-rose-600 hover:text-rose-700 transition">
                  Clear all filters
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">Department</label>
                <select value={departmentFilter} onChange={(e) => setFilter("department", e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20">
                  <option value="all">All departments</option>
                  {departmentOptions.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              {viewTab === "active" && (
                <>
                  <div>
                    <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">Quick Flags</label>
                    <div className="flex gap-2">
                      <button onClick={() => setFilter("idExpiringSoon", idExpiringSoon ? "" : "true")}
                        className={`flex-1 rounded-lg border px-3 py-2 text-[11px] font-bold text-center transition ${idExpiringSoon ? "border-amber-300 bg-amber-50 text-amber-700" : "border-slate-200 text-slate-500 hover:bg-slate-50"}`}>
                        ID Expiry ⚠
                      </button>
                      <button onClick={() => setFilter("recentTransfers", recentTransfers ? "" : "true")}
                        className={`flex-1 rounded-lg border px-3 py-2 text-[11px] font-bold text-center transition ${recentTransfers ? "border-indigo-300 bg-indigo-50 text-indigo-700" : "border-slate-200 text-slate-500 hover:bg-slate-50"}`}>
                        Transfers 🔄
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">Salary Period</label>
                    <select value={increasePeriod} onChange={(e) => {
                      const val = e.target.value, next = new URLSearchParams(searchParams), now = new Date();
                      if (val === "all") { next.delete("salaryIncreaseFrom"); next.delete("salaryIncreaseTo"); next.delete("increasePeriod"); }
                      else if (val === "this-month") {
                        next.set("salaryIncreaseFrom", new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]);
                        next.set("salaryIncreaseTo", new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]);
                        next.set("increasePeriod", "this-month");
                      } else if (val === "next-month") {
                        next.set("salaryIncreaseFrom", new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString().split('T')[0]);
                        next.set("salaryIncreaseTo", new Date(now.getFullYear(), now.getMonth() + 2, 0).toISOString().split('T')[0]);
                        next.set("increasePeriod", "next-month");
                      }
                      setSearchParams(next); setPage(1);
                    }}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20">
                      <option value="all">Any time</option>
                      <option value="this-month">This Month</option>
                      <option value="next-month">Next Month</option>
                    </select>
                  </div>
                </>
              )}
              <div>
                <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">Sort By</label>
                <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20">
                  <option value="name-asc">Name (A → Z)</option>
                  <option value="name-desc">Name (Z → A)</option>
                  {viewTab === "active" && <>
                    <option value="salary-increase-asc">Next Increase (Soonest)</option>
                    <option value="id-expiry-asc">ID Expiry (Soonest)</option>
                  </>}
                  {viewTab === "terminated" && <option value="termination-desc">Exit Date (Latest)</option>}
                </select>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ─── LOADING ─── */}
      {isLoading && (
        <div className="flex items-center justify-center gap-2 py-8 text-sm text-slate-500 mt-4">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-teal-500 border-t-transparent" />
          Loading employees…
        </div>
      )}

      {/* ─── EMPLOYEE CARDS / ROWS ─── */}
      {!isLoading && paged.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center mt-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 mb-4">
            <Users className="h-8 w-8" />
          </div>
          <p className="text-sm font-semibold text-slate-700 mb-1">
            {viewTab === "active" ? "No active employees found" : "No separated employees"}
          </p>
          <p className="text-xs text-slate-400 max-w-sm">
            {viewTab === "active" ? "Try adjusting your search or filters, or add a new employee." : "No employees have been terminated or resigned."}
          </p>
        </div>
      )}

      {!isLoading && paged.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm mt-6">
          {/* Table header */}
          <div className="hidden md:grid md:grid-cols-12 gap-4 items-center bg-slate-50/80 border-b border-slate-100 px-6 py-4 text-[11px] font-extrabold uppercase tracking-widest text-slate-400">
            <div className="col-span-4">Employee</div>
            <div className="col-span-2">Department</div>
            <div className="col-span-1">Status</div>
            {viewTab === "active" ? (
              <>
                <div className="col-span-2">Key Dates</div>
                <div className="col-span-3 text-right">Actions</div>
              </>
            ) : (
              <>
                <div className="col-span-2">Exit Date</div>
                <div className="col-span-1">Reason</div>
                <div className="col-span-2 text-right">Actions</div>
              </>
            )}
          </div>

          {/* Rows */}
          {paged.map((emp, idx) => {
            const isLast = idx === paged.length - 1;
            const increaseDateObj =
              emp.nextReviewDate ?? emp.yearlySalaryIncreaseDate
                ? new Date(emp.nextReviewDate ?? emp.yearlySalaryIncreaseDate)
                : null;
            const isIncreaseDue = viewTab === "active" && increaseDateObj && increaseDateObj.getTime() < Date.now() + 15 * 86400000;
            const idExpiryDate = emp.nationalIdExpiryDate ? new Date(emp.nationalIdExpiryDate) : null;
            const isIdExpired = idExpiryDate && idExpiryDate.getTime() < Date.now();
            const isIdExpiringSoon = idExpiryDate && !isIdExpired && idExpiryDate.getTime() < Date.now() + 60 * 86400000;

            return (
              <div key={emp.id}
                className={`group grid grid-cols-1 md:grid-cols-12 gap-3 md:gap-4 items-center px-6 py-4 transition hover:bg-slate-50/80 ${!isLast ? "border-b border-slate-100" : ""}`}>

                {/* Employee */}
                <div className="col-span-4 flex items-center gap-4 min-w-0">
                  <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${getAvatarColor(emp.fullName)} text-sm font-bold text-white shadow-sm ring-2 ring-white`}>
                    {getInitials(emp.fullName)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <Link to={`/employees/${emp.id}`}
                      className="block truncate text-[15px] font-bold text-slate-800 transition hover:text-teal-700">
                      {emp.fullName}
                    </Link>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="font-mono text-[11px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">{emp.employeeCode || "—"}</span>
                      <span className="truncate text-xs text-slate-500 font-medium">{emp.email}</span>
                    </div>
                  </div>
                </div>

                {/* Department */}
                <div className="col-span-2">
                  <DepartmentBadge name={emp.department || "—"} />
                </div>

                {/* Status */}
                <div className="col-span-1">
                  <StatusBadge status={emp.status} />
                </div>

                {viewTab === "active" ? (
                  <>
                    {/* Key Dates */}
                    <div className="col-span-2 flex flex-col gap-0.5">
                      {increaseDateObj && (
                        <div className={`inline-flex items-center gap-1 text-[10px] font-semibold ${isIncreaseDue ? "text-amber-700" : "text-slate-400"}`}>
                          <CreditCard className="h-3 w-3" />
                          <span>
                            {formatDate(
                              emp?.nextReviewDate ,
                            )}
                          </span>
                          {isIncreaseDue && <AlertCircle className="h-3 w-3 text-amber-500" />}
                        </div>
                      )}
                      {idExpiryDate && (
                        <div className={`inline-flex items-center gap-1 text-[10px] font-semibold ${isIdExpired ? "text-rose-600 animate-pulse" : isIdExpiringSoon ? "text-amber-600" : "text-slate-400"}`}>
                          <CalendarDays className="h-3 w-3" />
                          <span>{formatDate(emp.nationalIdExpiryDate)}</span>
                          {isIdExpired && <AlertTriangle className="h-3 w-3" />}
                        </div>
                      )}
                      {!increaseDateObj && !idExpiryDate && <span className="text-[10px] text-slate-300">—</span>}
                    </div>

                    {/* Actions */}
                    <div className="col-span-3 flex items-center justify-end gap-1.5">
                      {isIncreaseDue && canModify && (
                        <button onClick={() => setIncreaseModalTarget(emp)}
                          className="flex items-center gap-1 rounded-lg bg-gradient-to-r from-teal-500 to-teal-600 px-2.5 py-1.5 text-[11px] font-bold text-white shadow-sm transition hover:shadow-md active:scale-[0.97]">
                          <TrendingUp className="h-3 w-3" /> Increase
                        </button>
                      )}
                      <Link to={`/employees/${emp.id}`}
                        className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 transition hover:bg-slate-50 hover:border-slate-300">
                        <Eye className="h-3 w-3" /> View
                      </Link>
                      {canModify && (
                        <div className="relative">
                          <button onClick={(e) => { e.stopPropagation(); setOpenActions(openActions === emp.id ? null : emp.id); }}
                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-400 transition hover:bg-slate-50 hover:text-slate-600 hover:border-slate-300">
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                          {openActions === emp.id && (
                            <div className="absolute right-0 top-full mt-1 w-44 rounded-xl border border-slate-200 bg-white p-1 shadow-xl z-50 animate-in zoom-in-95 fade-in duration-150"
                              onClick={(e) => e.stopPropagation()}>
                              <Link to={`/employees/${emp.id}/edit`}
                                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50">
                                <Pencil className="h-3.5 w-3.5 text-violet-500" /> Edit Profile
                              </Link>
                              <button onClick={() => { setTerminateModalTarget(emp); setOpenActions(null); }}
                                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50">
                                <UserX className="h-3.5 w-3.5" /> Terminate
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    {/* Exit Date */}
                    <div className="col-span-2">
                      <div className="flex items-center gap-1.5 text-sm font-semibold text-rose-700">
                        <CalendarX2 className="h-3.5 w-3.5 text-rose-400" />
                        {emp.terminationDate ? formatDate(emp.terminationDate) : <span className="text-slate-400 italic font-normal text-xs">Not recorded</span>}
                      </div>
                    </div>
                    {/* Reason */}
                    <div className="col-span-1">
                      <span className="text-xs text-slate-500 truncate block max-w-[10rem]" title={emp.terminationReason || ""}>
                        {emp.terminationReason || "—"}
                      </span>
                    </div>
                    {/* Actions */}
                    <div className="col-span-2 flex items-center justify-end gap-1.5">
                      <Link to={`/employees/${emp.id}`}
                        className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 transition hover:bg-slate-50">
                        <Eye className="h-3 w-3" /> View
                      </Link>
                      {canModify && (
                        <button onClick={() => handleReactivate(emp)}
                          className="flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[11px] font-bold text-emerald-700 transition hover:bg-emerald-100">
                          <RotateCcw className="h-3 w-3" /> Reactivate
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />

      {/* ═══ SALARY INCREASE MODAL ═══ */}
      {increaseModalTarget && (
        <SalaryIncreaseModal 
          employee={increaseModalTarget}
          orgPolicy={orgPolicy}
          onClose={() => setIncreaseModalTarget(null)}
          onSubmit={handleProcessIncrease}
        />
      )}

      {/* ═══ TERMINATE MODAL ═══ */}
      {terminateModalTarget && (
        <TerminateEmployeeModal
          employee={terminateModalTarget}
          onClose={() => setTerminateModalTarget(null)}
          onSubmit={handleTerminate}
        />
      )}
    </Layout>
  );
}
