import { useEffect, useMemo, useState } from "react";
import { Layout } from "@/shared/components/Layout";
import { useAppSelector } from "@/shared/hooks/reduxHooks";
import { getMyAttendanceApi } from "@/modules/attendance/api";
import { getMyPayrollHistoryApi, getMyAdvancesApi } from "@/modules/payroll/api";
import { listMyLeaveRequestsApi, getMyEmployeeProfileApi } from "@/modules/employees/api";
import { getErrorMessage } from "@/shared/api/handleApiResponse";
import { PersonalTimeOffSection } from "@/modules/employees/pages/TimeOffPage";
import { Clock3, Wallet, CircleDollarSign, CalendarRange, UserRound, Star, Eye, ShieldCheck } from "lucide-react";
import { getEmployeeAssessmentsApi } from "@/modules/employees/api";

/**
 * Home is intentionally personal-first for every role.
 */
export function HomePage() {
  const currentUser = useAppSelector((state) => state.identity.currentUser);
  const [isLoadingPulse, setIsLoadingPulse] = useState(true);
  const [attendanceRows, setAttendanceRows] = useState([]);
  const [payrollRows, setPayrollRows] = useState([]);
  const [advanceRows, setAdvanceRows] = useState([]);
  const [leaveRows, setLeaveRows] = useState([]);
  const [myProfile, setMyProfile] = useState(null);
  const [attendanceVisibleCount, setAttendanceVisibleCount] = useState(10);
  const [permissionIssues, setPermissionIssues] = useState([]);
  const [activeTab, setActiveTab] = useState("overview"); // overview, attendance, timeoff, performance
  const [showAttendanceHistory, setShowAttendanceHistory] = useState(false);
  const [assessmentsData, setAssessmentsData] = useState([]);
  const [isAssessmentsLoading, setIsAssessmentsLoading] = useState(false);
  const [isAssessmentsLoaded, setIsAssessmentsLoaded] = useState(false);

  const userName = currentUser?.email?.split("@")[0] || "Member";

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const issues = [];
      try {
        const [attendanceRes, payrollRes, advancesRes, leavesRes, profileRes] =
          await Promise.allSettled([
            getMyAttendanceApi(),
            getMyPayrollHistoryApi(),
            getMyAdvancesApi(),
            listMyLeaveRequestsApi(),
            getMyEmployeeProfileApi(),
          ]);

        const attendance =
          attendanceRes.status === "fulfilled" && Array.isArray(attendanceRes.value)
            ? attendanceRes.value
            : [];
        if (attendanceRes.status === "rejected") {
          issues.push(`Attendance: ${getErrorMessage(attendanceRes.reason, "No access")}`);
        }

        const payroll =
          payrollRes.status === "fulfilled" && Array.isArray(payrollRes.value)
            ? payrollRes.value
            : [];
        if (payrollRes.status === "rejected") {
          issues.push(`Payroll: ${getErrorMessage(payrollRes.reason, "No access")}`);
        }

        const advances =
          advancesRes.status === "fulfilled" && Array.isArray(advancesRes.value)
            ? advancesRes.value
            : [];
        if (advancesRes.status === "rejected") {
          issues.push(`Advances: ${getErrorMessage(advancesRes.reason, "No access")}`);
        }

        const leaves =
          leavesRes.status === "fulfilled" && leavesRes.value
            ? leavesRes.value
            : { requests: [] };
        if (leavesRes.status === "rejected") {
          issues.push(`Leave: ${getErrorMessage(leavesRes.reason, "No access")}`);
        }

        const meProfile =
          profileRes.status === "fulfilled" && profileRes.value && typeof profileRes.value === "object"
            ? profileRes.value
            : null;
        if (profileRes.status === "rejected") {
          issues.push(`Profile: ${getErrorMessage(profileRes.reason, "No access")}`);
        }

        if (cancelled) return;
        setPermissionIssues(issues);
        setAttendanceRows(attendance);
        setPayrollRows(payroll);
        setAdvanceRows(advances);
        setLeaveRows(Array.isArray(leaves?.requests) ? leaves.requests : []);
        setMyProfile(meProfile);
      } finally {
        if (!cancelled) setIsLoadingPulse(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const pulse = useMemo(() => {
    const presentDays = attendanceRows.filter((r) => r?.status === "PRESENT").length;
    const lateDays = attendanceRows.filter((r) => r?.status === "LATE").length;
    const latestPayroll = payrollRows[0]?.netSalary || 0;
    const pendingAdvances = advanceRows.filter((r) => r?.status === "PENDING").length;
    const pendingLeaves = leaveRows.filter((r) => r?.status === "PENDING").length;
    return {
      presentDays,
      lateDays,
      latestPayroll,
      pendingAdvances,
      pendingLeaves,
    };
  }, [attendanceRows, payrollRows, advanceRows, leaveRows]);

  const personalInfo = useMemo(() => {
    const src = myProfile || {};
    const fullName = src.fullName || userName;
    const employeeCode = src.employeeCode || "—";
    const position = src.position || "—";
    const department = src.department || "—";
    const team = src.team || "—";
    const managerName = src.effectiveManager?.fullName || src.managerId?.fullName || "—";
    const status = src.status || "ACTIVE";
    const hireDate = src.dateOfHire
      ? new Date(src.dateOfHire).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" })
      : "—";
    return {
      fullName,
      employeeCode,
      position,
      department,
      team,
      managerName,
      status,
      hireDate,
    };
  }, [myProfile, userName]);

  const recentAttendance = useMemo(
    () =>
      [...attendanceRows]
        .sort((a, b) => new Date(b?.date || 0) - new Date(a?.date || 0))
        .slice(0, 30),
    [attendanceRows],
  );
  const visibleAttendance = useMemo(
    () => (showAttendanceHistory ? recentAttendance.slice(0, attendanceVisibleCount) : []),
    [recentAttendance, attendanceVisibleCount, showAttendanceHistory],
  );

  const fetchPerformance = async () => {
    if (isAssessmentsLoaded) return;
    setIsAssessmentsLoading(true);
    try {
      const data = await getEmployeeAssessmentsApi(myProfile?._id || currentUser.id);
      setAssessmentsData(data || []);
      setIsAssessmentsLoaded(true);
    } catch (err) {
      console.error("Failed to fetch assessments:", err);
    } finally {
      setIsAssessmentsLoading(false);
    }
  };

  const fmtDate = (value) => {
    if (!value) return "—";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString(undefined, {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const statusPillClass = (status) => {
    if (status === "APPROVED" || status === "PRESENT") return "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-100 dark:border-emerald-500/20";
    if (status === "ON_LEAVE") return "bg-violet-50 dark:bg-violet-500/10 text-violet-700 dark:text-violet-400 border-violet-100 dark:border-violet-500/20";
    if (status === "REJECTED" || status === "ABSENT") return "bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-100 dark:border-rose-500/20";
    if (status === "LATE" || status === "PENDING") return "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-100 dark:border-amber-500/20";
    return "bg-zinc-50 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700";
  };

  return (
    <Layout
      title={`Welcome Back`}
      description="Your last-month personal pulse in one calm view."
    >
      {permissionIssues.length > 0 && !isLoadingPulse ? (
        <article className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
          <p className="font-semibold">Some personal sections could not be loaded due to access policy:</p>
          <p className="mt-1">{permissionIssues.join(" | ")}</p>
        </article>
      ) : null}
      <div className="grid gap-4 sm:gap-6 grid-cols-1 md:grid-cols-2 xl:grid-cols-4 mb-4 sm:mb-6">
        <article className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-sm transition-colors duration-300">
          <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-500 dark:text-zinc-400 flex items-center gap-2">
            <Clock3 size={12} className="text-indigo-500" /> Attendance
          </p>
          <p className="mt-2 text-2xl font-black text-zinc-900 dark:text-zinc-50 tabular-nums">
            {isLoadingPulse ? "..." : pulse.presentDays}
          </p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Present days in last 30 days</p>
          <p className="mt-2 text-[11px] font-semibold text-amber-600 dark:text-amber-500">
            {isLoadingPulse ? " " : `${pulse.lateDays} late day(s)`}
          </p>
        </article>
        <article className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-sm transition-colors duration-300">
          <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-500 dark:text-zinc-400 flex items-center gap-2">
            <Wallet size={12} className="text-emerald-500" /> Payroll
          </p>
          <p className="mt-2 text-2xl font-black text-zinc-900 dark:text-zinc-50 tabular-nums">
            {isLoadingPulse ? "..." : new Intl.NumberFormat("en-EG", { style: "currency", currency: "EGP", maximumFractionDigits: 0 }).format(pulse.latestPayroll || 0)}
          </p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Latest net salary (last month)</p>
        </article>
        <article className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-sm transition-colors duration-300">
          <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-500 dark:text-zinc-400 flex items-center gap-2">
            <CircleDollarSign size={12} className="text-indigo-500" /> Advances
          </p>
          <p className="mt-2 text-2xl font-black text-zinc-900 dark:text-zinc-50 tabular-nums">
            {isLoadingPulse ? "..." : pulse.pendingAdvances}
          </p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Pending requests in last month</p>
        </article>
        <article className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-sm transition-colors duration-300">
          <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-500 dark:text-zinc-400 flex items-center gap-2">
            <CalendarRange size={12} className="text-violet-500" /> Leave
          </p>
          <p className="mt-2 text-2xl font-black text-zinc-900 dark:text-zinc-50 tabular-nums">
            {isLoadingPulse ? "..." : pulse.pendingLeaves}
          </p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Pending requests in last month</p>
        </article>
      </div>

      <div className="mb-4 sm:mb-6 border-b border-zinc-200 dark:border-zinc-800">
        <nav className="-mb-px flex gap-6" aria-label="Tabs">
          <button
            onClick={() => setActiveTab("overview")}
            className={`whitespace-nowrap border-b-2 py-3 px-1 text-[13px] font-semibold transition-colors duration-200 flex items-center gap-2 ${activeTab === "overview"
              ? "border-zinc-900 dark:border-indigo-500 text-zinc-900 dark:text-zinc-50"
              : "border-transparent text-zinc-500 dark:text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-700 hover:text-zinc-700 dark:hover:text-zinc-300 dark:hover:text-zinc-300"
              }`}
          >
            <UserRound size={14} /> Profile Overview
          </button>
          <button
            onClick={() => setActiveTab("attendance")}
            className={`whitespace-nowrap border-b-2 py-3 px-1 text-[13px] font-semibold transition-colors duration-200 flex items-center gap-2 ${activeTab === "attendance"
              ? "border-zinc-900 dark:border-indigo-500 text-zinc-900 dark:text-zinc-50"
              : "border-transparent text-zinc-500 dark:text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-700 hover:text-zinc-700 dark:hover:text-zinc-300 dark:hover:text-zinc-300"
              }`}
          >
            <Clock3 size={14} /> Attendance History
          </button>
          <button
            onClick={() => setActiveTab("timeoff")}
            className={`whitespace-nowrap border-b-2 py-3 px-1 text-[13px] font-semibold transition-colors duration-200 flex items-center gap-2 ${activeTab === "timeoff"
              ? "border-zinc-900 dark:border-indigo-500 text-zinc-900 dark:text-zinc-50"
              : "border-transparent text-zinc-500 dark:text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-700 hover:text-zinc-700 dark:hover:text-zinc-300 dark:hover:text-zinc-300"
              }`}
          >
            <CalendarRange size={14} /> Time Off Workspace
          </button>
          <button
            onClick={() => setActiveTab("performance")}
            className={`whitespace-nowrap border-b-2 py-3 px-1 text-[13px] font-semibold transition-colors duration-200 flex items-center gap-2 ${activeTab === "performance"
              ? "border-zinc-900 dark:border-indigo-500 text-zinc-900 dark:text-zinc-50"
              : "border-transparent text-zinc-500 dark:text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-700 hover:text-zinc-700 dark:hover:text-zinc-300 dark:hover:text-zinc-300"
              }`}
          >
            <Star size={14} /> Performance
          </button>
        </nav>
      </div>

      {activeTab === "overview" && (
        <article className="animate-in fade-in slide-in-from-bottom-2 duration-300 rounded-[32px] border border-zinc-200/60 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 sm:p-8 shadow-sm">
          <div className="flex items-center justify-between gap-3 mb-6">
            <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-zinc-400 flex items-center gap-2">
              <UserRound size={13} className="text-indigo-500" /> Personal Identity
            </h3>
            <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest border ${personalInfo.status === "ACTIVE" ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-500/20" : "bg-zinc-50 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border-zinc-100 dark:border-zinc-700"
              }`}>
              {personalInfo.status}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: "Full Name", value: personalInfo.fullName },
              { label: "Employee Code", value: personalInfo.employeeCode },
              { label: "Current Position", value: personalInfo.position },
              { label: "Department", value: personalInfo.department },
              { label: "Active Team", value: personalInfo.team },
              { label: "Direct Manager", value: personalInfo.managerName },
              { label: "Hire Date", value: personalInfo.hireDate },
              { label: "Work Email", value: currentUser?.email || "—" },
            ].map((field) => (
              <div key={field.label} className="rounded-[20px] border border-zinc-50 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/30 px-5 py-4 transition-colors hover:bg-zinc-100/50 dark:hover:bg-zinc-800/80 dark:hover:bg-zinc-800/50">
                <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-500 dark:text-zinc-400 whitespace-nowrap">{field.label}</p>
                <p className="mt-1 text-sm font-black text-zinc-900 dark:text-zinc-100 truncate">{isLoadingPulse ? "..." : field.value}</p>
              </div>
            ))}
          </div>
        </article>
      )}

      {activeTab === "attendance" && (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 mt-4 sm:mt-6">
          {!showAttendanceHistory ? (
            <article className="relative overflow-hidden rounded-[32px] border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8 sm:p-16 text-center shadow-[0_20px_50px_rgba(0,0,0,0.04)] dark:shadow-none">
              {/* Background Glow */}
              <div className="absolute -top-24 -left-24 h-64 w-64 rounded-full bg-indigo-500/5 blur-[100px]" />
              <div className="absolute -bottom-24 -right-24 h-64 w-64 rounded-full bg-purple-500/5 blur-[100px]" />

              <div className="relative z-10">
                <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-[24px] bg-zinc-50 dark:bg-zinc-800 text-indigo-500 dark:text-indigo-400 shadow-inner ring-1 ring-zinc-200/50 dark:ring-zinc-700/50">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white dark:bg-zinc-900 shadow-sm ring-1 ring-zinc-200/50 dark:ring-zinc-700/50">
                    <Clock3 size={24} />
                  </div>
                </div>
                <h4 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 sm:text-2xl">Attendance History</h4>
                <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
                  Your daily logs are currently hidden. Access your historical check-in and check-out data with a single click.
                </p>
                <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                  <button
                    onClick={() => setShowAttendanceHistory(true)}
                    className="inline-flex h-12 items-center justify-center rounded-full bg-zinc-950 dark:bg-indigo-600 px-8 text-sm font-bold text-white shadow-[0_10px_20px_rgba(0,0,0,0.15)] transition-all hover:scale-[1.02] hover:bg-zinc-800 dark:hover:bg-indigo-500 active:scale-[0.98]"
                  >
                    Show My History
                  </button>
                </div>
              </div>
            </article>
          ) : (
            <article className="overflow-hidden rounded-[32px] border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-[0_10px_40px_rgba(0,0,0,0.03)] dark:shadow-none ring-1 ring-zinc-950/[0.03] dark:ring-white/[0.02] backdrop-blur transition-all duration-300">
              <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/30 dark:bg-zinc-800/30">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-xl bg-zinc-900 dark:bg-indigo-600 flex items-center justify-center text-white shadow-sm">
                    <Clock3 size={16} />
                  </div>
                  <h3 className="text-xs font-black uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
                    Last 30 Days Activity
                  </h3>
                </div>
                <button
                  onClick={() => setShowAttendanceHistory(false)}
                  className="group flex items-center gap-2 rounded-full border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-4 py-1.5 text-[10px] font-black uppercase tracking-widest text-zinc-400 dark:text-zinc-500 dark:text-zinc-400 transition-all hover:border-zinc-300 dark:hover:border-zinc-600 hover:text-zinc-600 dark:hover:text-zinc-400 dark:hover:text-zinc-300"
                >
                  <Eye size={12} className="transition-transform group-hover:scale-110" />
                  Hide
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="sticky top-0 z-10">
                    <tr className="border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 backdrop-blur">
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 dark:text-zinc-500 dark:text-zinc-400">Date</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 dark:text-zinc-500 dark:text-zinc-400">Check In</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 dark:text-zinc-500 dark:text-zinc-400">Check Out</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 dark:text-zinc-500 dark:text-zinc-400 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/90 dark:divide-zinc-800/50 text-sm">
                    {isLoadingPulse ? (
                      <tr>
                        <td colSpan="4" className="px-6 py-20 text-zinc-400 dark:text-zinc-500 dark:text-zinc-400 text-center">
                          <div className="flex flex-col items-center gap-2">
                            <div className="h-5 w-5 border-2 border-zinc-200 dark:border-zinc-700 border-t-zinc-900 dark:border-t-indigo-500 rounded-full animate-spin" />
                            Loading records...
                          </div>
                        </td>
                      </tr>
                    ) : recentAttendance.length === 0 ? (
                      <tr>
                        <td colSpan="4" className="px-6 py-20 text-xs text-zinc-400 dark:text-zinc-500 dark:text-zinc-400 text-center uppercase tracking-widest font-black">No records found.</td>
                      </tr>
                    ) : (
                      visibleAttendance.map((row) => (
                        <tr key={row?._id || `${row?.date}-${row?.checkIn}`} className="transition-colors hover:bg-zinc-50/40 dark:hover:bg-zinc-800/50 dark:hover:bg-zinc-800/30">
                          <td className="px-6 py-4 text-xs font-black text-zinc-900 dark:text-zinc-100 whitespace-nowrap">{fmtDate(row?.date)}</td>
                          <td className="px-6 py-4 text-xs text-zinc-600 dark:text-zinc-400 font-bold tabular-nums">{row?.checkIn || "—"}</td>
                          <td className="px-6 py-4 text-xs text-zinc-600 dark:text-zinc-400 font-bold tabular-nums">{row?.checkOut || "—"}</td>
                          <td className="px-6 py-4 text-right">
                            <span className={`inline-flex rounded-full border px-3 py-1 text-[9px] font-black uppercase tracking-widest ${statusPillClass(row?.status)}`}>
                              {row?.status || "—"}
                              {row?.unpaidLeave ? " · UNPAID" : ""}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              {!isLoadingPulse && recentAttendance.length > attendanceVisibleCount && (
                <div className="px-6 py-4 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/30 dark:bg-zinc-800/30">
                  <button
                    type="button"
                    onClick={() => setAttendanceVisibleCount((prev) => Math.min(prev + 10, recentAttendance.length))}
                    className="w-full rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-4 py-2.5 text-[11px] font-black uppercase tracking-widest text-zinc-600 dark:text-zinc-400 shadow-sm transition-all hover:border-zinc-300 dark:hover:border-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 dark:hover:bg-zinc-800 active:scale-[0.99]"
                  >
                    Load More
                  </button>
                </div>
              )}
            </article>
          )}
        </div>
      )}

      {activeTab === "timeoff" && (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
          <article className="mt-4 sm:mt-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 sm:p-6 shadow-sm">
            <PersonalTimeOffSection />
          </article>
        </div>
      )}

      {activeTab === "performance" && (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 mt-4 sm:mt-6">
          {!isAssessmentsLoaded ? (
            <article className="relative overflow-hidden rounded-[32px] border border-amber-100 dark:border-amber-900/30 bg-white dark:bg-zinc-900 p-8 sm:p-16 text-center shadow-[0_20px_50px_rgba(245,158,11,0.03)] dark:shadow-none">
              {/* Warm Glow */}
              <div className="absolute -top-24 -left-24 h-64 w-64 rounded-full bg-amber-500/5 blur-[100px]" />
              <div className="absolute -bottom-24 -right-24 h-64 w-64 rounded-full bg-orange-500/5 blur-[100px]" />

              <div className="relative z-10">
                <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-[24px] bg-amber-50 dark:bg-amber-500/10 text-amber-500 shadow-inner ring-1 ring-amber-200/50 dark:ring-amber-500/20">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white dark:bg-zinc-900 shadow-sm ring-1 ring-amber-200/50 dark:ring-amber-500/20">
                    <Star size={24} className="fill-amber-500 text-amber-500" />
                  </div>
                </div>
                <h4 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-2xl">Performance Reviews</h4>
                <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
                  Evaluation history, bonus details, and manager feedback. Click below to securely load your professional record.
                </p>
                <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                  <button
                    disabled={isAssessmentsLoading}
                    onClick={fetchPerformance}
                    className="inline-flex h-12 items-center justify-center rounded-full bg-amber-500 px-8 text-sm font-bold text-white shadow-[0_10px_20px_rgba(245,158,11,0.2)] transition-all hover:scale-[1.02] hover:bg-amber-600 active:scale-[0.98] disabled:opacity-50"
                  >
                    {isAssessmentsLoading ? (
                      <div className="flex items-center gap-2">
                        <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Decrypting...
                      </div>
                    ) : "Show Performance"}
                  </button>
                </div>
              </div>
            </article>
          ) : (
            <div className="animate-in zoom-in-95 duration-500 rounded-[32px] border border-amber-200/50 dark:border-amber-900/30 bg-white dark:bg-zinc-900 p-6 sm:p-10 shadow-sm overflow-hidden relative">
              <div className="absolute top-0 right-0 p-8 text-amber-50/50 dark:text-amber-500/5 -mr-10 -mt-10">
                <Star size={160} className="fill-current" />
              </div>

              <div className="relative z-10 flex items-center justify-between mb-10">
                <div>
                  <h3 className="text-2xl font-black text-zinc-900 dark:text-zinc-50 tracking-tight">Professional Performance</h3>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 font-medium italic">A historical timeline of evaluations and rewards.</p>
                </div>
                <div className="h-12 w-12 rounded-[20px] bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center text-amber-500 shadow-sm border border-amber-100 dark:border-amber-900/30">
                  <Star size={24} className="fill-current" />
                </div>
              </div>

              {assessmentsData.length === 0 ? (
                <div className="py-20 text-center border-2 border-dashed border-zinc-100 dark:border-zinc-800 rounded-[24px]">
                  <Star className="h-10 w-10 text-zinc-200 dark:text-zinc-800 dark:text-zinc-200 mx-auto mb-3" />
                  <p className="text-zinc-400 dark:text-zinc-600 dark:text-zinc-400 italic text-sm">No assessments on record for you yet.</p>
                </div>
              ) : (
                <div className="space-y-12 relative">
                  {/* Timeline vertical line */}
                  <div className="absolute left-6 top-4 bottom-4 w-0.5 bg-gradient-to-b from-amber-100/50 via-zinc-100 dark:via-zinc-800 to-amber-100/50" />

                  {(() => {
                    const sorted = [...assessmentsData].sort((a, b) => {
                      const ya = a.period?.year ?? 0;
                      const yb = b.period?.year ?? 0;
                      if (yb !== ya) return yb - ya;
                      return (b.period?.month ?? 0) - (a.period?.month ?? 0);
                    });
                    const groups = new Map();
                    for (const rec of sorted) {
                      const key = rec.period ? `${rec.period.year}-${rec.period.month}` : "ungrouped";
                      if (!groups.has(key)) groups.set(key, { label: rec.period ? `${rec.period.year} - Month ${rec.period.month}` : "Other", records: [] });
                      groups.get(key).records.push(rec);
                    }
                    return [...groups.entries()].map(([key, { label, records }]) => (
                      <div key={key} className="relative z-10">
                        <div className="flex items-center gap-4 mb-6">
                          <div className="relative flex h-12 w-12 items-center justify-center">
                            <div className="absolute inset-0 rounded-full bg-amber-50 dark:bg-amber-950 ring-4 ring-white dark:ring-zinc-900 shadow-sm" />
                            <ShieldCheck size={18} className="relative z-10 text-amber-600 dark:text-amber-400" />
                          </div>
                          <h4 className="text-sm font-black text-zinc-900 dark:text-zinc-100 uppercase tracking-[0.2em]">{label}</h4>
                        </div>

                        <div className="pl-6 space-y-6">
                          {records.map((record, idx) => {
                            const overallStars = record.overall ?? record.rating ?? 0;
                            const hasDynamicScores = Array.isArray(record.scores) && record.scores.length > 0;
                            const legacyScores = [
                              record.commitment != null && { title: "Commitment", score: record.commitment },
                              record.attitude != null && { title: "Attitude", score: record.attitude },
                              record.quality != null && { title: "Quality", score: record.quality },
                            ].filter(Boolean);
                            const displayScores = hasDynamicScores ? record.scores : legacyScores;
                            const bonusBadge = record.bonusStatus && record.bonusStatus !== "NONE" ? {
                              PENDING_HR: { bg: "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/20", text: "Pending HR" },
                              APPROVED: { bg: "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20", text: "Approved" },
                              REJECTED: { bg: "bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-500/20", text: "Rejected" },
                            }[record.bonusStatus] : null;

                            return (
                              <div key={record.id || idx} className="rounded-3xl border border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-[0_4px_20px_rgba(0,0,0,0.02)] transition-all hover:shadow-[0_10px_40px_rgba(0,0,0,0.04)] hover:-translate-y-0.5">
                                <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
                                  <div className="flex items-center gap-4">
                                    <div className="h-10 w-10 rounded-2xl bg-amber-500 flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-amber-500/20">
                                      {Math.floor(overallStars)}
                                    </div>
                                    <div>
                                      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-600 block mb-1">Overall Rating</span>
                                      <div className="flex gap-0.5">
                                        {[1, 2, 3, 4, 5].map(star => (
                                          <Star key={star} size={14} className={star <= Math.round(overallStars) ? "text-amber-500 fill-current" : "text-zinc-100"} />
                                        ))}
                                      </div>
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <span className="text-xs font-bold text-zinc-400 block mb-1">DATE</span>
                                    <span className="text-xs font-black text-zinc-900 dark:text-zinc-100 tracking-tight">{record.date}</span>
                                    {bonusBadge && <span className={`mt-2 block text-[8px] font-black px-2 py-0.5 rounded-md border uppercase tracking-widest ${bonusBadge.bg}`}>{bonusBadge.text}</span>}
                                  </div>
                                </div>

                                {displayScores.length > 0 && (
                                  <div className="mb-8 p-4 rounded-2xl bg-zinc-50/50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800/50">
                                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-400 mb-4">Competency Scores</p>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                      {displayScores.map((s, si) => (
                                        <div key={si} className="bg-white dark:bg-zinc-900 rounded-xl p-3 border border-zinc-100 dark:border-zinc-800/50 shadow-sm flex items-center justify-between">
                                          <span className="text-[10px] font-bold text-zinc-600 dark:text-zinc-400 uppercase truncate pr-2">{s.title}</span>
                                          <div className="flex items-center gap-0.5">
                                            <Star size={11} className="text-amber-500 fill-current" />
                                            <span className="text-[10px] font-black text-zinc-900 dark:text-zinc-100 border-l border-zinc-100 dark:border-zinc-800/50 ml-1.5 pl-1.5">{s.score}</span>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                  {[
                                    { l: "Monthly Bonus", v: record.daysBonus ?? 0, unit: "Days" },
                                    { l: "Total Overtime", v: record.overtime ?? 0, unit: "Hours" },
                                    { l: "Salary Deduction", v: record.deduction ?? 0, unit: "EGP" }
                                  ].map((item) => (
                                    <div key={item.l} className="rounded-2xl border border-zinc-100 dark:border-zinc-800/50 bg-white dark:bg-zinc-900 p-4 flex items-center justify-between transition-colors hover:border-amber-200">
                                      <div>
                                        <span className="font-bold text-[9px] text-zinc-400 uppercase tracking-widest block mb-0.5">{item.l}</span>
                                        <span className="font-black text-lg text-zinc-900 dark:text-zinc-100">{item.v}</span>
                                      </div>
                                      <span className="text-[9px] font-black text-amber-500/50 uppercase tracking-tighter">{item.unit}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </Layout>
  );
}
