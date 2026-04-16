import { useEffect, useMemo, useState } from "react";
import { Layout } from "@/shared/components/Layout";
import { useAppSelector } from "@/shared/hooks/reduxHooks";
import { getMyAttendanceApi } from "@/modules/attendance/api";
import { getMyPayrollHistoryApi, getMyAdvancesApi } from "@/modules/payroll/api";
import { listMyLeaveRequestsApi, getMyEmployeeProfileApi } from "@/modules/employees/api";
import { getErrorMessage } from "@/shared/api/handleApiResponse";
import { PersonalTimeOffSection } from "@/modules/employees/pages/TimeOffPage";
import { Clock3, Wallet, CircleDollarSign, CalendarRange, UserRound } from "lucide-react";

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
    () => recentAttendance.slice(0, attendanceVisibleCount),
    [recentAttendance, attendanceVisibleCount],
  );

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
    if (status === "APPROVED" || status === "PRESENT") return "bg-emerald-50 text-emerald-700 border-emerald-100";
    if (status === "ON_LEAVE") return "bg-violet-50 text-violet-700 border-violet-100";
    if (status === "REJECTED" || status === "ABSENT") return "bg-rose-50 text-rose-700 border-rose-100";
    if (status === "LATE" || status === "PENDING") return "bg-amber-50 text-amber-700 border-amber-100";
    return "bg-zinc-50 text-zinc-700 border-zinc-200";
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
        <article className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 flex items-center gap-2">
            <Clock3 size={12} className="text-indigo-500" /> Attendance
          </p>
          <p className="mt-2 text-2xl font-black text-zinc-900 tabular-nums">
            {isLoadingPulse ? "..." : pulse.presentDays}
          </p>
          <p className="text-xs text-zinc-500">Present days in last 30 days</p>
          <p className="mt-2 text-[11px] font-semibold text-amber-600">
            {isLoadingPulse ? " " : `${pulse.lateDays} late day(s)`}
          </p>
        </article>
        <article className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 flex items-center gap-2">
            <Wallet size={12} className="text-emerald-500" /> Payroll
          </p>
          <p className="mt-2 text-2xl font-black text-zinc-900 tabular-nums">
            {isLoadingPulse ? "..." : new Intl.NumberFormat("en-EG", { style: "currency", currency: "EGP", maximumFractionDigits: 0 }).format(pulse.latestPayroll || 0)}
          </p>
          <p className="text-xs text-zinc-500">Latest net salary (last month)</p>
        </article>
        <article className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 flex items-center gap-2">
            <CircleDollarSign size={12} className="text-indigo-500" /> Advances
          </p>
          <p className="mt-2 text-2xl font-black text-zinc-900 tabular-nums">
            {isLoadingPulse ? "..." : pulse.pendingAdvances}
          </p>
          <p className="text-xs text-zinc-500">Pending requests in last month</p>
        </article>
        <article className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 flex items-center gap-2">
            <CalendarRange size={12} className="text-violet-500" /> Leave
          </p>
          <p className="mt-2 text-2xl font-black text-zinc-900 tabular-nums">
            {isLoadingPulse ? "..." : pulse.pendingLeaves}
          </p>
          <p className="text-xs text-zinc-500">Pending leave requests in last month</p>
        </article>
      </div>

      <article className="mb-4 sm:mb-6 rounded-2xl border border-zinc-200 bg-white p-5 sm:p-6 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-[11px] font-bold uppercase tracking-widest text-zinc-400 flex items-center gap-2">
            <UserRound size={13} className="text-indigo-500" /> Personal Profile
          </h3>
          <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-zinc-600">
            {personalInfo.status}
          </span>
        </div>
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          <div className="rounded-xl border border-zinc-100 bg-zinc-50/60 px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">Name</p>
            <p className="mt-1 text-sm font-bold text-zinc-900 truncate">{isLoadingPulse ? "..." : personalInfo.fullName}</p>
          </div>
          <div className="rounded-xl border border-zinc-100 bg-zinc-50/60 px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">Employee Code</p>
            <p className="mt-1 text-sm font-bold text-zinc-900">{isLoadingPulse ? "..." : personalInfo.employeeCode}</p>
          </div>
          <div className="rounded-xl border border-zinc-100 bg-zinc-50/60 px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">Position</p>
            <p className="mt-1 text-sm font-bold text-zinc-900 truncate">{isLoadingPulse ? "..." : personalInfo.position}</p>
          </div>
          <div className="rounded-xl border border-zinc-100 bg-zinc-50/60 px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">Department</p>
            <p className="mt-1 text-sm font-bold text-zinc-900 truncate">{isLoadingPulse ? "..." : personalInfo.department}</p>
          </div>
          <div className="rounded-xl border border-zinc-100 bg-zinc-50/60 px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">Team</p>
            <p className="mt-1 text-sm font-bold text-zinc-900 truncate">{isLoadingPulse ? "..." : personalInfo.team}</p>
          </div>
          <div className="rounded-xl border border-zinc-100 bg-zinc-50/60 px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">Manager</p>
            <p className="mt-1 text-sm font-bold text-zinc-900 truncate">{isLoadingPulse ? "..." : personalInfo.managerName}</p>
          </div>
          <div className="rounded-xl border border-zinc-100 bg-zinc-50/60 px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">Hire Date</p>
            <p className="mt-1 text-sm font-bold text-zinc-900">{isLoadingPulse ? "..." : personalInfo.hireDate}</p>
          </div>
          <div className="rounded-xl border border-zinc-100 bg-zinc-50/60 px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">Work Email</p>
            <p className="mt-1 text-sm font-bold text-zinc-900 truncate">{currentUser?.email || "—"}</p>
          </div>
        </div>
      </article>

      <div className="mt-4 sm:mt-6">
        <article className="overflow-hidden rounded-3xl border border-zinc-200/80 bg-white/95 shadow-sm ring-1 ring-zinc-950/[0.03] backdrop-blur">
          <div className="px-5 py-4 border-b border-zinc-100 bg-gradient-to-b from-zinc-50 to-white">
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">
              Last 30 Days Attendance
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="sticky top-0 z-10">
                <tr className="border-b border-zinc-100 bg-white/90 backdrop-blur">
                  <th className="px-5 py-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-400">Date</th>
                  <th className="px-5 py-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-400">Check In</th>
                  <th className="px-5 py-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-400">Check Out</th>
                  <th className="px-5 py-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-400">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100/90">
                {isLoadingPulse ? (
                  <tr>
                    <td colSpan="4" className="px-5 py-10 text-sm text-zinc-400 text-center">Loading attendance...</td>
                  </tr>
                ) : recentAttendance.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="px-5 py-10 text-sm text-zinc-400 text-center">No attendance records in the last 30 days.</td>
                  </tr>
                ) : (
                  visibleAttendance.map((row) => (
                    <tr key={row?._id || `${row?.date}-${row?.checkIn}`} className="transition-colors hover:bg-zinc-50/60">
                      <td className="px-5 py-3.5 text-xs font-semibold text-zinc-900">{fmtDate(row?.date)}</td>
                      <td className="px-5 py-3.5 text-xs text-zinc-700 font-medium tabular-nums">{row?.checkIn || "—"}</td>
                      <td className="px-5 py-3.5 text-xs text-zinc-700 font-medium tabular-nums">{row?.checkOut || "—"}</td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${statusPillClass(row?.status)}`}>
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
            <div className="px-5 py-3.5 border-t border-zinc-100 bg-zinc-50/40">
              <button
                type="button"
                onClick={() => setAttendanceVisibleCount((prev) => Math.min(prev + 10, recentAttendance.length))}
                className="rounded-full border border-zinc-200 bg-white px-3.5 py-1.5 text-[11px] font-semibold text-zinc-700 shadow-sm transition hover:bg-zinc-50"
              >
                Load 10 more days
              </button>
            </div>
          )}
        </article>
      </div>

      <article className="mt-4 sm:mt-6 rounded-2xl border border-zinc-200 bg-white p-5 sm:p-6 shadow-sm">
        <PersonalTimeOffSection />
      </article>
    </Layout>
  );
}
