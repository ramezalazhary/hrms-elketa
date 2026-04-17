import { useEffect, useMemo, useState } from "react";
import { getErrorMessage } from "@/shared/api/handleApiResponse";

import { Link, useSearchParams } from "react-router-dom";
import { Layout } from "@/shared/components/Layout";
import { Pagination } from "@/shared/components/Pagination";
import { useAppDispatch, useAppSelector } from "@/shared/hooks/reduxHooks";
import { useToast } from "@/shared/components/ToastProvider";
import { fetchDepartmentsThunk } from "@/modules/departments/store";
import { getTeamsApi } from "@/modules/teams/api";
import { fetchEmployeesThunk, deleteEmployeeThunk, processSalaryIncreaseThunk, updateEmployeeThunk } from "../store";
import { DepartmentBadge, StatusBadge } from "@/shared/components/EntityBadges";
import {
  Users, UserPlus, TrendingUp, AlertCircle, AlertTriangle,
  UserX, CalendarX2, RotateCcw, Search, Eye, Pencil,
  ArrowUpDown, ChevronDown, Filter, X, Briefcase, Building2,
  Clock, CreditCard, CalendarDays, MoreHorizontal, UserCheck, UserMinus, Star, Trash2,
} from "lucide-react";
import { FormBuilder } from "@/shared/components/FormBuilder";
import { getDocumentRequirementsApi } from "../../organization/api";
import { SalaryIncreaseModal } from "../components/SalaryIncreaseModal";
import { TerminateEmployeeModal } from "../components/TerminateEmployeeModal";
import { SubmitAssessmentModal } from "../components/SubmitAssessmentModal";
import {
  canManagerOrTeamLeaderEvaluateEmployee,
  departmentHeadedByUser,
} from "../utils/evaluationAccess";
import {
  groupStandaloneTeamsByDepartmentId,
  mergedTeamNamesForDepartment,
} from "@/shared/utils/mergeDepartmentTeams";
import {
  ACCESS_LEVEL,
  getAccessLevelLabel,
  getEmployeeDirectoryAccessLevel,
} from "@/shared/utils/accessControl";

/* ─── tiny helpers ─── */
const AVATAR_COLORS = [
  "from-zinc-500 to-zinc-700",
  "from-stone-500 to-stone-700",
  "from-neutral-500 to-neutral-700",
  "from-zinc-600 to-stone-600",
  "from-stone-600 to-zinc-700",
  "from-neutral-600 to-zinc-700",
  "from-zinc-500 to-stone-600",
  "from-stone-500 to-zinc-600",
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
  const departments = useAppSelector((s) => s.departments.items);
  const isLoading = useAppSelector((s) => s.employees.isLoading);
  const role = useAppSelector((s) => s.identity.currentUser?.role);
  const currentUser = useAppSelector((s) => s.identity.currentUser);
  const employeeDirectoryAccessLevel = getEmployeeDirectoryAccessLevel(currentUser);
  const currentUserEmployee = useMemo(
    () =>
      employees.find(
        (e) =>
          (currentUser?.id != null &&
            String(e.id ?? e._id ?? "") === String(currentUser.id)) ||
          (!!currentUser?.email &&
            !!e.email &&
            String(e.email).trim().toLowerCase() ===
              String(currentUser.email).trim().toLowerCase()),
      ),
    [employees, currentUser?.id, currentUser?.email],
  );
  const [searchParams, setSearchParams] = useSearchParams();

  const [increaseModalTarget, setIncreaseModalTarget] = useState(null);
  const [terminateModalTarget, setTerminateModalTarget] = useState(null);
  const [evaluateTarget, setEvaluateTarget] = useState(null);
  const [orgPolicy, setOrgPolicy] = useState(null);
  const [viewTab, setViewTab] = useState("active");
  const [openActions, setOpenActions] = useState(null); // row id for action dropdown
  const [showFilters, setShowFilters] = useState(false);
  /** All standalone teams (one fetch; used for TL/Manager led names + dept-head merge). */
  const [allOrgTeams, setAllOrgTeams] = useState([]);

  useEffect(() => {
    void dispatch(fetchDepartmentsThunk());
  }, [dispatch]);

  useEffect(() => {
    (async () => {
      try { setOrgPolicy(await getDocumentRequirementsApi()); } catch { }
    })();
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const all = await getTeamsApi();
        if (!cancelled && Array.isArray(all)) setAllOrgTeams(all);
      } catch {
        if (!cancelled) setAllOrgTeams([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const teamsByDepartmentId = useMemo(
    () => groupStandaloneTeamsByDepartmentId(allOrgTeams),
    [allOrgTeams],
  );

  const standaloneLedTeamNames = useMemo(() => {
    const rolesThatMayLeadStandaloneTeams = ["TEAM_LEADER", "MANAGER"];
    if (!rolesThatMayLeadStandaloneTeams.includes(currentUser?.role)) return [];
    const uid = currentUser?.id ? String(currentUser.id) : "";
    const email = (currentUser?.email || "").toLowerCase().trim();
    return allOrgTeams
      .filter((t) => {
        if (t.status && t.status !== "ACTIVE") return false;
        const le = (t.leaderEmail || "").toLowerCase().trim();
        const lid = t.leaderId?.id ?? t.leaderId?._id ?? t.leaderId;
        return (
          (email && le === email) ||
          (uid && lid != null && String(lid) === uid)
        );
      })
      .map((t) => t.name)
      .filter(Boolean);
  }, [allOrgTeams, currentUser?.role, currentUser?.email, currentUser?.id]);

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

  const listEvaluateOptions = useMemo(() => {
    const em = (currentUser?.email || "").toLowerCase().trim();
    const embeddedLed = [];
    for (const d of departments) {
      for (const t of d.teams || []) {
        if (
          (t.leaderEmail || "").toLowerCase().trim() === em &&
          t.name
        ) {
          embeddedLed.push(t.name);
        }
      }
    }
    const ledTeamNames = [
      ...new Set([...embeddedLed, ...standaloneLedTeamNames]),
    ];
    const deptHead = [];
    for (const d of departments) {
      if (!departmentHeadedByUser(d, currentUser)) continue;
      const did = String(d.id ?? d._id ?? "");
      const standalone = did ? teamsByDepartmentId.get(did) || [] : [];
      deptHead.push(...mergedTeamNamesForDepartment(d, standalone));
    }
    return {
      ledTeamNames,
      deptHeadTeamNames: [...new Set(deptHead)],
    };
  }, [departments, currentUser, standaloneLedTeamNames, teamsByDepartmentId]);

  const departmentOptions = useMemo(
    () => Array.from(new Set(employees.map((e) => e.department).filter(Boolean))).sort(),
    [employees],
  );



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
  const canModify = employeeDirectoryAccessLevel === ACCESS_LEVEL.EDIT || employeeDirectoryAccessLevel === ACCESS_LEVEL.ADMIN;
  const canDeleteEmployeeRecord = employeeDirectoryAccessLevel === ACCESS_LEVEL.ADMIN;
  const isDevMode = import.meta.env.DEV;

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
    } catch (err) { showToast(getErrorMessage(err, "Failed to process increase"), "error"); }

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
    } catch (err) { showToast(getErrorMessage(err, "Failed"), "error"); }

  };

  const handleReactivate = async (emp) => {
    if (!window.confirm(`Reactivate ${emp.fullName}?`)) return;
    try {
      await dispatch(updateEmployeeThunk({ id: emp.id, status: "ACTIVE", terminationDate: null, terminationReason: null })).unwrap();
      showToast(`${emp.fullName} reactivated`, "success");
    } catch (err) { showToast(getErrorMessage(err, "Failed to reactivate"), "error"); }

  };

  const handleDeleteEmployee = async (emp) => {
    if (!isDevMode) return;
    if (!window.confirm(`Delete ${emp.fullName}? This action cannot be undone.`)) return;
    try {
      await dispatch(deleteEmployeeThunk(emp.id || emp._id)).unwrap();
      showToast(`${emp.fullName} deleted`, "success");
      setOpenActions(null);
    } catch (err) {
      showToast(getErrorMessage(err, "Failed to delete employee"), "error");
    }
  };

  const activeFiltersCount = [departmentFilter !== "all", idExpiringSoon, recentTransfers, increasePeriod !== "all"].filter(Boolean).length;

  return (
    <Layout
      title="Employees"
      description={`Access: ${getAccessLevelLabel(employeeDirectoryAccessLevel)} · Directory, filters, and quick actions for your workforce.`}
      actions={
        canModify ? (
          <div className="flex flex-wrap gap-2">
            <Link className="inline-flex items-center gap-2 rounded-full border border-zinc-200/90 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 px-4 py-2.5 text-sm font-medium text-zinc-800 dark:text-zinc-200 shadow-sm transition hover:bg-zinc-50 dark:hover:bg-zinc-800/50" to="/employees/onboarding">
              <Users className="h-4 w-4 opacity-70" /> Onboarding
            </Link>
            <Link className="inline-flex items-center gap-2 rounded-full bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800" to="/employees/create">
              <UserPlus className="h-4 w-4" /> Add employee
            </Link>
          </div>
        ) : null
      }
    >
      {/* ─── STAT CARDS ─── */}
      <div className="mb-2 grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: "Total workforce", value: employees.length, icon: Users },
          { label: "Active", value: activeEmployees.length, icon: UserCheck },
          { label: "On leave", value: employees.filter(e => e.status === "ON_LEAVE").length, icon: CalendarDays },
          { label: "Separated", value: terminatedEmployees.length, icon: UserMinus },
        ].map((stat) => (
          <div
            key={stat.label}
            className="flex items-center gap-3 rounded-[20px] bg-white dark:bg-zinc-900 p-4 shadow-sm ring-1 ring-zinc-950/[0.06] dark:ring-zinc-800 transition hover:shadow-md"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-zinc-100 dark:bg-zinc-800/80 text-zinc-700 dark:text-zinc-300 ring-1 ring-zinc-200/80 dark:ring-zinc-700">
              <stat.icon className="h-5 w-5" strokeWidth={1.75} />
            </div>
            <div>
              <p className="text-2xl font-semibold tabular-nums tracking-tight text-zinc-900 dark:text-zinc-100">{stat.value}</p>
              <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ─── CONTROLS SECTION ─── */}
      <div className="flex flex-col gap-4">
        {/* ─── TABS + SEARCH BAR ─── */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Tabs */}
          <div className="inline-flex w-full max-w-md gap-0.5 rounded-2xl bg-zinc-100/90 dark:bg-zinc-800/80 p-1 ring-1 ring-zinc-200/80 dark:ring-zinc-700 sm:w-auto overflow-x-auto hidden-scrollbar">
            <button type="button" onClick={() => { setViewTab("active"); setPage(1); }}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-medium transition sm:flex-none ${viewTab === "active" ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-sm ring-1 ring-zinc-200/60 dark:ring-zinc-700" : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 dark:hover:text-zinc-200"}`}>
              <UserCheck className="h-3.5 w-3.5" /> Active
              <span className={`ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none ${viewTab === "active" ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 ring-1 ring-zinc-200/70 dark:ring-zinc-700" : "bg-zinc-200/60 dark:bg-zinc-800/60 text-zinc-500 dark:text-zinc-400"}`}>{activeEmployees.length}</span>
            </button>
            <button type="button" onClick={() => { setViewTab("terminated"); setPage(1); }}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-medium transition sm:flex-none ${viewTab === "terminated" ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-sm ring-1 ring-zinc-200/60 dark:ring-zinc-700" : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 dark:hover:text-zinc-200"}`}>
              <UserX className="h-3.5 w-3.5" /> Separated
              {terminatedEmployees.length > 0 && (
                <span className={`ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none ${viewTab === "terminated" ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 ring-1 ring-zinc-200/70 dark:ring-zinc-700" : "bg-zinc-200/60 dark:bg-zinc-800/60 text-zinc-500 dark:text-zinc-400"}`}>{terminatedEmployees.length}</span>
              )}
            </button>
          </div>

          {/* Search + Filter toggle */}
          <div className="flex items-center gap-2 flex-1 max-w-lg">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 dark:text-zinc-500 dark:text-zinc-400" />
              <input
                type="text" placeholder="Search name or code…"
                className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900 py-2.5 pl-10 pr-10 text-sm text-zinc-900 dark:text-zinc-100 shadow-sm outline-none transition focus:border-zinc-400 dark:focus:border-zinc-600 focus:bg-white dark:focus:bg-zinc-900 dark:focus:bg-zinc-800 focus:ring-2 focus:ring-zinc-200/80 dark:focus:ring-zinc-700 dark:focus:ring-zinc-700"
                value={search}
                onChange={(e) => setFilter("search", e.target.value)}
              />
              {search && (
                <button type="button" onClick={() => setFilter("search", "")} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-500 dark:text-zinc-400 transition hover:text-zinc-700 dark:hover:text-zinc-300 dark:hover:text-zinc-300">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <button type="button" onClick={() => setShowFilters(!showFilters)}
              className={`relative flex items-center gap-1.5 rounded-full border px-3.5 py-2.5 text-sm font-medium shadow-sm transition ${showFilters ? "border-zinc-300 dark:border-zinc-600 bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 ring-1 ring-zinc-200/80 dark:ring-zinc-700" : "border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 dark:hover:bg-zinc-800"}`}>
              <Filter className="h-4 w-4" />
              Filters
              {activeFiltersCount > 0 && (
                <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-zinc-900 dark:bg-indigo-600 text-[10px] font-semibold text-white">{activeFiltersCount}</span>
              )}
            </button>
          </div>
        </div>

        {/* ─── FILTER BAR (collapsible) ─── */}
        {showFilters && (
          <div className="mt-1 animate-in slide-in-from-top-2 rounded-[20px] bg-white dark:bg-zinc-900 p-4 shadow-sm ring-1 ring-zinc-950/[0.06] dark:ring-zinc-800">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Refine results</span>
              {activeFiltersCount > 0 && (
                <button type="button" onClick={() => {
                  const next = new URLSearchParams();
                  if (search) next.set("search", search);
                  setSearchParams(next);
                }} className="text-xs font-medium text-red-600 transition hover:text-red-700">
                  Clear all filters
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-zinc-500 dark:text-zinc-400">Department</label>
                <select value={departmentFilter} onChange={(e) => setFilter("department", e.target.value)}
                  className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/50 px-3 py-2.5 text-sm text-zinc-900 dark:text-zinc-100 outline-none transition focus:border-zinc-400 focus:bg-white dark:focus:bg-zinc-900 focus:ring-2 focus:ring-zinc-200/80 dark:focus:ring-zinc-700">
                  <option value="all">All departments</option>
                  {departmentOptions.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              {viewTab === "active" && (
                <>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-zinc-500 dark:text-zinc-400">Quick flags</label>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setFilter("idExpiringSoon", idExpiringSoon ? "" : "true")}
                        className={`flex-1 rounded-xl border px-3 py-2 text-center text-[11px] font-semibold transition ${idExpiringSoon ? "border-amber-200 bg-amber-50/90 text-amber-900 ring-1 ring-amber-200/70" : "border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"}`}>
                        ID expiry
                      </button>
                      <button type="button" onClick={() => setFilter("recentTransfers", recentTransfers ? "" : "true")}
                        className={`flex-1 rounded-xl border px-3 py-2 text-center text-[11px] font-semibold transition ${recentTransfers ? "border-zinc-300 bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 ring-1 ring-zinc-200/80 dark:ring-zinc-700" : "border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"}`}>
                        Transfers
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-zinc-500 dark:text-zinc-400">Salary period</label>
                    <div className="relative flex items-center gap-1.5">
                      <input
                        type="month"
                        value={increasePeriod !== "all" ? increasePeriod : ""}
                        onChange={(e) => {
                          const val = e.target.value;
                          const next = new URLSearchParams(searchParams);
                          if (!val) {
                            next.delete("salaryIncreaseFrom");
                            next.delete("salaryIncreaseTo");
                            next.delete("increasePeriod");
                          } else {
                            const [year, month] = val.split("-").map(Number);
                            next.set("salaryIncreaseFrom", new Date(year, month - 1, 1).toISOString().split('T')[0]);
                            next.set("salaryIncreaseTo", new Date(year, month, 0).toISOString().split('T')[0]);
                            next.set("increasePeriod", val);
                          }
                          setSearchParams(next);
                          setPage(1);
                        }}
                        className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/50 px-3 py-2.5 text-sm text-zinc-900 dark:text-zinc-100 outline-none transition focus:border-zinc-400 focus:bg-white dark:focus:bg-zinc-900 focus:ring-2 focus:ring-zinc-200/80 dark:focus:ring-zinc-700"
                        placeholder="Any time"
                      />
                      {increasePeriod !== "all" && (
                        <button
                          type="button"
                          onClick={() => {
                            const next = new URLSearchParams(searchParams);
                            next.delete("salaryIncreaseFrom");
                            next.delete("salaryIncreaseTo");
                            next.delete("increasePeriod");
                            setSearchParams(next);
                            setPage(1);
                          }}
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-400 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                          title="Clear month filter"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </>
              )}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-zinc-500 dark:text-zinc-400">Sort by</label>
                <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}
                  className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/50 px-3 py-2.5 text-sm text-zinc-900 dark:text-zinc-100 outline-none transition focus:border-zinc-400 focus:bg-white dark:focus:bg-zinc-900 focus:ring-2 focus:ring-zinc-200/80 dark:focus:ring-zinc-700">
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
        <div className="mt-4 flex items-center justify-center gap-2 py-8 text-sm text-zinc-500 dark:text-zinc-400">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-700" />
          Loading employees…
        </div>
      )}

      {/* ─── EMPLOYEE CARDS / ROWS ─── */}
      {!isLoading && paged.length === 0 && (
        <div className="mt-4 flex flex-col items-center justify-center rounded-[20px] bg-zinc-50/40 dark:bg-zinc-800/50 py-16 text-center ring-1 ring-zinc-950/[0.04]">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-zinc-400 ring-1 ring-zinc-200/80 dark:ring-zinc-700">
            <Users className="h-7 w-7" />
          </div>
          <p className="mb-1 text-sm font-medium text-zinc-800 dark:text-zinc-200">
            {viewTab === "active" ? "No active employees found" : "No separated employees"}
          </p>
          <p className="max-w-sm text-xs text-zinc-500 dark:text-zinc-400">
            {viewTab === "active" ? "Try adjusting your search or filters, or add a new employee." : "No employees have been terminated or resigned."}
          </p>
        </div>
      )}

      {!isLoading && paged.length > 0 && (
        <div className="mt-6 overflow-hidden rounded-[20px] bg-white dark:bg-zinc-900 shadow-sm ring-1 ring-zinc-950/[0.06] dark:ring-zinc-800">
          {/* Table header */}
          <div className="hidden items-center gap-4 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-800/50 px-6 py-4 text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400 md:grid md:grid-cols-12">
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
              <div key={emp._id || emp.id || idx}
                className={`group grid grid-cols-1 items-center gap-3 px-6 py-4 transition hover:bg-zinc-50/70 dark:hover:bg-zinc-800/50 dark:hover:bg-zinc-800/50 md:grid-cols-12 md:gap-4 ${!isLast ? "border-b border-zinc-100 dark:border-zinc-800/80" : ""}`}>

                {/* Employee */}
                <div className="col-span-4 flex items-center gap-4 min-w-0">
                  <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${getAvatarColor(emp.fullName)} text-sm font-semibold text-white shadow-sm ring-2 ring-white dark:ring-zinc-900`}>
                    {getInitials(emp.fullName)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <Link to={`/employees/${emp._id || emp.id}`}
                      className="block truncate text-[15px] font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 transition hover:text-zinc-600 dark:hover:text-zinc-400 dark:hover:text-zinc-300">
                      {emp.fullName}
                    </Link>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="rounded-md bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 ring-1 ring-zinc-200/70 dark:ring-zinc-700">{emp.employeeCode || "—"}</span>
                      <span className="truncate text-xs font-medium text-zinc-500 dark:text-zinc-400">{emp.email}</span>
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
                        <div className={`inline-flex items-center gap-1 text-[10px] font-semibold ${isIncreaseDue ? "text-amber-800" : "text-zinc-400"}`}>
                          <CreditCard className="h-3 w-3" />
                          <span>
                            {formatDate(
                              emp?.nextReviewDate,
                            )}
                          </span>
                          {isIncreaseDue && <AlertCircle className="h-3 w-3 text-amber-500" />}
                        </div>
                      )}
                      {idExpiryDate && (
                        <div className={`inline-flex items-center gap-1 text-[10px] font-semibold ${isIdExpired ? "animate-pulse text-red-700" : isIdExpiringSoon ? "text-amber-700" : "text-zinc-400"}`}>
                          <CalendarDays className="h-3 w-3" />
                          <span>{formatDate(emp.nationalIdExpiryDate)}</span>
                          {isIdExpired && <AlertTriangle className="h-3 w-3" />}
                        </div>
                      )}
                      {!increaseDateObj && !idExpiryDate && <span className="text-[10px] text-zinc-300">—</span>}
                    </div>

                    {/* Actions */}
                    <div className="col-span-3 flex items-center justify-end gap-1.5">
                      {isIncreaseDue && canModify && (
                        <button type="button" onClick={() => setIncreaseModalTarget(emp)}
                          className="flex items-center gap-1 rounded-full bg-zinc-900 dark:bg-indigo-600 px-2.5 py-1.5 text-[11px] font-semibold text-white shadow-sm transition hover:bg-zinc-800 dark:hover:bg-indigo-500 active:scale-[0.97]">
                          <TrendingUp className="h-3 w-3" /> Increase
                        </button>
                      )}
                      {canManagerOrTeamLeaderEvaluateEmployee(emp, currentUser, {
                        excludeHrAdminRoles: true,
                        ledTeamNames: listEvaluateOptions.ledTeamNames,
                        deptHeadTeamNames: listEvaluateOptions.deptHeadTeamNames,
                        departments,
                        teamsByDepartmentId,
                        allOrgTeams,
                        evaluatorEmployee: currentUserEmployee,
                      }) && (
                        <button
                          type="button"
                          onClick={() => { setEvaluateTarget(emp); setOpenActions(null); }}
                          className="flex items-center gap-1 rounded-full border border-amber-200/90 dark:border-amber-500/30 bg-amber-50/90 dark:bg-amber-500/10 px-2.5 py-1.5 text-[11px] font-semibold text-amber-950 dark:text-amber-300 transition hover:bg-amber-100 dark:hover:bg-amber-500/20"
                        >
                          <Star className="h-3 w-3 text-amber-600" /> Evaluate
                        </button>
                      )}
                      <Link to={`/employees/${emp._id || emp.id}`}
                        className="flex items-center gap-1 rounded-full border border-zinc-200/90 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-2.5 py-1.5 text-[11px] font-medium text-zinc-700 dark:text-zinc-300 transition hover:bg-zinc-50 dark:hover:bg-zinc-800/50 dark:hover:bg-zinc-700">
                        <Eye className="h-3 w-3" /> View
                      </Link>
                      {canModify && (
                        <div className="relative">
                          <button type="button" onClick={(e) => { e.stopPropagation(); setOpenActions(openActions === (emp._id || emp.id) ? null : (emp._id || emp.id)); }}
                            className="flex h-8 w-8 items-center justify-center rounded-full border border-zinc-200/90 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 dark:text-zinc-400 transition hover:bg-zinc-50 dark:hover:bg-zinc-800/50 dark:hover:bg-zinc-700 hover:text-zinc-700 dark:hover:text-zinc-300 dark:hover:text-zinc-300">
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                          {openActions === (emp._id || emp.id) && (
                            <div className="absolute right-0 top-full z-50 mt-1 w-44 animate-in fade-in zoom-in-95 rounded-2xl bg-white dark:bg-zinc-800 p-1 shadow-xl ring-1 ring-zinc-950/[0.08] dark:ring-white/10 duration-150"
                              onClick={(e) => e.stopPropagation()}>
                              <Link to={`/employees/${emp._id || emp.id}/edit`}
                                className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 dark:hover:bg-zinc-700">
                                <Pencil className="h-3.5 w-3.5 text-zinc-500 dark:text-zinc-400" /> Edit profile
                              </Link>
                              <button type="button" onClick={() => { setTerminateModalTarget(emp); setOpenActions(null); }}
                                className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10">
                                <UserX className="h-3.5 w-3.5" /> Terminate
                              </button>
                              {isDevMode && canDeleteEmployeeRecord && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteEmployee(emp)}
                                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-red-700 dark:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10"
                                >
                                  <Trash2 className="h-3.5 w-3.5" /> Delete (Dev only)
                                </button>
                              )}
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
                        {emp.terminationDate ? formatDate(emp.terminationDate) : <span className="text-xs font-normal italic text-zinc-400">Not recorded</span>}
                      </div>
                    </div>
                    {/* Reason */}
                    <div className="col-span-1">
                      <span className="block max-w-[10rem] truncate text-xs text-zinc-500 dark:text-zinc-400" title={emp.terminationReason || ""}>
                        {emp.terminationReason || "—"}
                      </span>
                    </div>
                    {/* Actions */}
                    <div className="col-span-2 flex items-center justify-end gap-1.5">
                      <Link to={`/employees/${emp._id || emp.id}`}
                        className="flex items-center gap-1 rounded-full border border-zinc-200/90 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 px-2.5 py-1.5 text-[11px] font-medium text-zinc-700 dark:text-zinc-300 transition hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                        <Eye className="h-3 w-3" /> View
                      </Link>
                      {canModify && (
                        <button type="button" onClick={() => handleReactivate(emp)}
                          className="flex items-center gap-1 rounded-full border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 px-2.5 py-1.5 text-[11px] font-semibold text-zinc-800 dark:text-zinc-200 transition hover:bg-zinc-100 dark:hover:bg-zinc-800">
                          <RotateCcw className="h-3 w-3" /> Reactivate
                        </button>
                      )}
                      {canDeleteEmployeeRecord && isDevMode && (
                        <button
                          type="button"
                          onClick={() => handleDeleteEmployee(emp)}
                          className="flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2.5 py-1.5 text-[11px] font-semibold text-red-700 transition hover:bg-red-100"
                        >
                          <Trash2 className="h-3 w-3" /> Delete
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

      {evaluateTarget && (
        <SubmitAssessmentModal
          employee={evaluateTarget}
          onClose={() => setEvaluateTarget(null)}
        />
      )}
    </Layout>
  );
}
