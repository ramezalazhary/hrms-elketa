import { useMemo, useState, useEffect, useCallback, memo } from "react";
import { Link } from "react-router-dom";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import {
  Building2,
  Users,
  Layers,
  Wallet,
  UserCheck,
  Plane,
  Briefcase,
  MapPin,
  TrendingUp,
  ArrowRight,
  AlertTriangle,
  Clock,
  ChevronDown,
  ChevronUp,
  Download,
  RefreshCw,
  FileSpreadsheet,
  CalendarCheck,
  ClipboardList,
  FileKey,
  BarChart3,
  Gift,
} from "lucide-react";
import { Layout } from "@/shared/components/Layout";
import { DepartmentBadge, normaliseRoleKey } from "@/shared/components/EntityBadges";
import { downloadBulkTemplateApi, uploadBulkFileApi, getAlertsFeedApi } from "@/modules/bulk/api";
import { useAppSelector } from "@/shared/hooks/reduxHooks";
import {
  canAccessAttendance,
  canAccessOnboardingApprovals,
  canApproveLeaves,
  canManageBonusApprovals,
  canManagePayroll,
  canViewReports,
} from "@/shared/utils/accessControl";

const HR_ROLES = new Set(["HR", "HR_STAFF", "HR_MANAGER", "ADMIN"]);

const CHART_COLORS = ["#6366f1", "#8b5cf6", "#10b981", "#f59e0b", "#ef4444", "#64748b", "#94a3b8"];
const STATUS_COLORS = {
  ACTIVE: "#10b981",
  ON_LEAVE: "#f59e0b",
  RESIGNED: "#64748b",
  TERMINATED: "#ef4444",
};

const CHART_GRADIENTS = {
  indigo: ["#818cf8", "#6366f1"],
  emerald: ["#34d399", "#10b981"],
  amber: ["#fbbf24", "#f59e0b"],
};

function formatMoney(n, currency = "USD") {
  if (n == null || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(n);
}

function yearsSince(dateStr, asOfMs) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  return (asOfMs - d.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
}

/**
 * Rich org + workforce analytics for Admin / HR / managers (data = whatever the API returns for the user).
 */
export function LeadershipOrgOverview({
  currentUser,
  employees,
  departments,
  teams,
  isLoading,
}) {
  const [asOfMs] = useState(() => Date.now());
  const accessToken = useAppSelector((state) => state.identity.accessToken);
  const [alerts, setAlerts] = useState([]);
  const [alertsExpanded, setAlertsExpanded] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  const handleDownloadTemplate = useCallback(async () => {
    try {
      const blob = await downloadBulkTemplateApi();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "HRMS_Template.xlsx";
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error(error);
      alert("Custom template download failed.");
    }
  }, []);

  const handleUploadSync = useCallback(async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const confirmed = window.confirm(
      "⚠️ CRITICAL ACTION: This will PERMANENTLY DELETE organizational data and replace it from the file. The server must have ALLOW_DESTRUCTIVE_BULK=true or the upload will be rejected. \n\nAre you absolutely sure you want to proceed?"
    );

    if (!confirmed) {
      e.target.value = "";
      return;
    }

    setIsSyncing(true);

    try {
      await uploadBulkFileApi(file);
      alert("✓ Synchronization successful. The system has been reset with the new data.");
      window.location.reload();
    } catch (error) {
      console.error(error);
      alert("A network error occurred during the synchronization process.");
    } finally {
      setIsSyncing(false);
      e.target.value = "";
    }
  }, []);

  useEffect(() => {
    async function fetchAlerts() {
      try {
        if (!accessToken) return;
        const data = await getAlertsFeedApi();
        setAlerts(data.alerts || []);
      } catch (e) {
        console.error("Failed to fetch alerts:", e);
      }
    }
    void fetchAlerts();
  }, [accessToken]);

  const teamCountByDepartmentId = useMemo(() => {
    const m = new Map();
    for (const t of teams) {
      const raw = t.departmentId;
      const id = raw != null ? String(raw) : "";
      if (!id) continue;
      m.set(id, (m.get(id) || 0) + 1);
    }
    return m;
  }, [teams]);
  const metrics = useMemo(() => {
    const total = employees.length;
    const byStatus = { ACTIVE: 0, ON_LEAVE: 0, RESIGNED: 0, TERMINATED: 0 };
    const byEmployment = {};
    const byGender = {};
    const byLocation = {};
    let payrollSum = 0;
    let payrollCount = 0;
    let newHires90 = 0;
    const now = asOfMs;
    const ms90 = 90 * 24 * 60 * 60 * 1000;

    for (const e of employees) {
      if (byStatus[e.status] !== undefined) byStatus[e.status]++;
      const et = e.employmentType || "UNKNOWN";
      byEmployment[et] = (byEmployment[et] || 0) + 1;
      const g = e.gender || "UNKNOWN";
      byGender[g] = (byGender[g] || 0) + 1;
      const loc = (e.workLocation || "Not set").trim() || "Not set";
      byLocation[loc] = (byLocation[loc] || 0) + 1;

      const sal = e.financial?.baseSalary;
      if (typeof sal === "number" && sal > 0) {
        payrollSum += sal;
        payrollCount++;
      }
      if (e.dateOfHire) {
        const t = new Date(e.dateOfHire).getTime();
        if (!Number.isNaN(t) && now - t <= ms90) newHires90++;
      }
    }

    const tenureBuckets = { under1: 0, y1_3: 0, y3_5: 0, over5: 0, unknown: 0 };
    for (const e of employees) {
      const y = yearsSince(e.dateOfHire, asOfMs);
      if (y == null) {
        tenureBuckets.unknown++;
        continue;
      }
      if (y < 1) tenureBuckets.under1++;
      else if (y < 3) tenureBuckets.y1_3++;
      else if (y < 5) tenureBuckets.y3_5++;
      else tenureBuckets.over5++;
    }

    const active = byStatus.ACTIVE;
    const onLeave = byStatus.ON_LEAVE;

    return {
      total,
      byStatus,
      byEmployment,
      byGender,
      byLocation,
      payrollSum,
      payrollCount,
      avgSalary: payrollCount ? payrollSum / payrollCount : 0,
      newHires90,
      active,
      onLeave,
      activeRate: total ? Math.round((active / total) * 1000) / 10 : 0,
      tenureBuckets,
    };
  }, [employees, asOfMs]);

  const departmentRows = useMemo(() => {
    const map = new Map();
    for (const d of departments) {
      const did = d.id != null ? String(d.id) : "";
      const fromTeams = did ? teamCountByDepartmentId.get(did) : undefined;
      const nestedTeams = Array.isArray(d.teams) ? d.teams.length : 0;
      map.set(d.name, {
        id: d.id,
        name: d.name,
        head: d.head || "—",
        positionsDefined: Array.isArray(d.positions) ? d.positions.length : 0,
        teamCount: fromTeams ?? nestedTeams,
        headcount: 0,
        active: 0,
        onLeave: 0,
        payroll: 0,
      });
    }
    for (const e of employees) {
      const name = e.department || "—";
      if (!map.has(name)) {
        map.set(name, {
          id: null,
          name,
          head: "—",
          positionsDefined: 0,
          teamCount: 0,
          headcount: 0,
          active: 0,
          onLeave: 0,
          payroll: 0,
        });
      }
      const row = map.get(name);
      row.headcount++;
      if (e.status === "ACTIVE") row.active++;
      if (e.status === "ON_LEAVE") row.onLeave++;
      const sal = e.financial?.baseSalary;
      if (typeof sal === "number" && sal > 0) row.payroll += sal;
    }
    const totalEmp = employees.length || 1;
    return Array.from(map.values())
      .map((r) => ({
        ...r,
        share: Math.round((r.headcount / totalEmp) * 1000) / 10,
      }))
      .sort((a, b) => b.headcount - a.headcount);
  }, [employees, departments, teamCountByDepartmentId]);

  const topDepartmentsChart = useMemo(() => {
    return departmentRows.slice(0, 12).map((r) => ({
      name: r.name.length > 18 ? `${r.name.slice(0, 16)}…` : r.name,
      fullName: r.name,
      employees: r.headcount,
    }));
  }, [departmentRows]);

  const statusPieData = useMemo(() => {
    const m = metrics.byStatus;
    return [
      { name: "Active", value: m.ACTIVE, color: STATUS_COLORS.ACTIVE },
      { name: "On leave", value: m.ON_LEAVE, color: STATUS_COLORS.ON_LEAVE },
      { name: "Resigned", value: m.RESIGNED, color: STATUS_COLORS.RESIGNED },
      { name: "Terminated", value: m.TERMINATED, color: STATUS_COLORS.TERMINATED },
    ].filter((x) => x.value > 0);
  }, [metrics.byStatus]);

  const employmentData = useMemo(() => {
    return Object.entries(metrics.byEmployment)
      .map(([key, value]) => ({
        name: key.replace(/_/g, " "),
        value,
      }))
      .filter((x) => x.value > 0);
  }, [metrics.byEmployment]);

  const genderData = useMemo(() => {
    return Object.entries(metrics.byGender)
      .map(([key, value]) => ({
        name: key.replace(/_/g, " "),
        value,
      }))
      .filter((x) => x.value > 0);
  }, [metrics.byGender]);

  const locationData = useMemo(() => {
    return Object.entries(metrics.byLocation)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [metrics.byLocation]);

  const tenureSeries = useMemo(() => {
    const t = metrics.tenureBuckets;
    return [
      { range: "< 1 yr", count: t.under1 },
      { range: "1–3 yr", count: t.y1_3 },
      { range: "3–5 yr", count: t.y3_5 },
      { range: "5+ yr", count: t.over5 },
      { range: "Unknown", count: t.unknown },
    ];
  }, [metrics.tenureBuckets]);

  const positionMix = useMemo(() => {
    const map = new Map();
    for (const e of employees) {
      const p = (e.position || "Unspecified").trim() || "Unspecified";
      map.set(p, (map.get(p) || 0) + 1);
    }
    return Array.from(map.entries())
      .map(([title, count]) => ({ title, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 15);
  }, [employees]);

  const openPositionsTotal = useMemo(() => {
    return departments.reduce((s, d) => s + (Array.isArray(d.positions) ? d.positions.length : 0), 0);
  }, [departments]);

  const name = currentUser?.email?.split("@")[0] || "User";

  return (
    <Layout
      className="max-w-[min(100%,1550px)]"
      title={`Organization Strategic Intelligence`}
      description={`Workforce and structure snapshot for ${name}.`}
      hideHeader={true}
    >
     {false? <div className="relative overflow-hidden rounded-[2.5rem] bg-slate-950 p-10 shadow-2xl mb-10 group border border-white/10">
        {/* Dynamic Mesh Gradient Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-600/20 via-slate-950 to-slate-950 opacity-100 transition-all duration-500 group-hover:scale-105" />
        <div className="absolute top-0 right-0 -mr-24 -mt-24 h-96 w-96 rounded-full bg-indigo-500/10 blur-[100px] animate-pulse" />
        <div className="absolute bottom-0 left-0 -ml-24 -mb-24 h-96 w-96 rounded-full bg-emerald-500/10 blur-[100px] animate-pulse" style={{ animationDelay: '1s' }} />
        
        <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-10">
          <div className="space-y-4 max-w-2xl">
            <div className="flex items-center gap-3 mb-2">
               <span className="px-3 py-1 bg-white/10 backdrop-blur-md rounded-full text-[10px] font-black uppercase tracking-widest text-indigo-300 border border-white/5">
                 Strategic Intelligence
               </span>
               <span className="flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 backdrop-blur-md rounded-full text-[10px] font-black uppercase tracking-widest text-emerald-400 border border-emerald-500/10">
                 <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,1)]" />
                 Live Synchronization
               </span>
            </div>
            <h1 className="text-4xl md:text-5xl font-black tracking-tight text-white leading-[1.1]">
              Institutional <span className="text-indigo-400">Command</span> Center
            </h1>
            <p className="text-slate-400 text-base font-medium leading-relaxed">
              Monitoring global throughput across <span className="text-white font-bold">{departments.length} departments</span> and <span className="text-white font-bold">{teams.length} operational units</span>. 
              Currently analyzing <span className="text-indigo-300 font-bold">{employees.length} personnel</span> records for strategic optimization.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4 lg:border-l lg:border-white/10 lg:pl-10">
            <Link
              to="/employees"
              className="flex items-center gap-3 px-8 py-4 rounded-2xl bg-white text-slate-950 text-xs font-black uppercase tracking-widest hover:bg-slate-100 transition-all active:scale-95 shadow-xl shadow-white/5 group/btn"
            >
              Personnel Roster <ArrowRight className="h-4 w-4 group-hover/btn:translate-x-1 transition-transform" />
            </Link>
            <div className="flex flex-col gap-4">
              <Link
                to="/organizations"
                className="flex items-center gap-3 px-8 py-4 rounded-2xl bg-white/5 text-white text-xs font-black uppercase tracking-widest border border-white/10 hover:bg-white/10 transition-all active:scale-95 whitespace-nowrap"
              >
                Structure Map <ArrowRight className="h-4 w-4 opacity-50" />
              </Link>
              
              {currentUser?.role === "ADMIN" && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleDownloadTemplate}
                    className="p-3.5 rounded-2xl bg-white/5 text-white border border-white/10 hover:bg-white/10 transition-all active:scale-95"
                    title="Download Template"
                  >
                    <Download className="h-4 w-4" />
                  </button>
                  <div className="relative flex-1">
                    <input
                      type="file"
                      accept=".xlsx"
                      onChange={handleUploadSync}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-wait"
                      disabled={isSyncing}
                    />
                    <button
                      disabled={isSyncing}
                      className={`w-full flex items-center justify-center gap-3 px-6 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition-all active:scale-95 ${
                        isSyncing 
                          ? "bg-indigo-500/20 text-indigo-300 border-indigo-500/30" 
                          : "bg-indigo-600 text-white border-transparent shadow-lg shadow-indigo-600/20 hover:bg-indigo-700"
                      }`}
                    >
                      {isSyncing ? <RefreshCw className="h-4 w-4 animate-spin text-indigo-300" /> : <RefreshCw className="h-4 w-4" />}
                      {isSyncing ? "Syncing..." : "Sync & Reset"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>:null}
      {isLoading ? (
        <div className="rounded-lg border border-zinc-200 bg-white p-12 text-center text-sm text-zinc-500">
          Loading organization data…
        </div>
      ) : (
      <div className="space-y-6 sm:space-y-8">

          {/* Alerts Widget */}
          {alerts.length > 0 && (
            <div className="rounded-2xl sm:rounded-[2rem] border border-white/20 glass-premium shadow-premium overflow-hidden mb-6 sm:mb-8">
              <button
                type="button"
                onClick={() => setAlertsExpanded((p) => !p)}
                className="w-full flex items-center justify-between px-4 sm:px-6 lg:px-8 py-4 sm:py-5 hover:bg-white/40 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-2xl bg-amber-500 flex items-center justify-center text-white shadow-lg shadow-amber-200">
                    <AlertTriangle className="h-5 w-5" />
                  </div>
                  <div className="text-left">
                    <span className="block text-sm font-black text-slate-900 leading-tight">
                      {alerts.length} Active Operational Alert{alerts.length !== 1 ? "s" : ""}
                    </span>
                    <div className="flex gap-2 mt-1">
                      {alerts.filter(a => a.severity === "critical").length > 0 && (
                        <span className="text-[9px] font-black uppercase bg-rose-50 text-rose-600 px-2.5 py-0.5 rounded-full border border-rose-100">
                          {alerts.filter(a => a.severity === "critical").length} Critical
                        </span>
                      )}
                      <span className="text-[9px] font-black uppercase text-amber-600">Verification Required</span>
                    </div>
                  </div>
                </div>
                {alertsExpanded ? <ChevronUp className="h-5 w-5 text-slate-400" /> : <ChevronDown className="h-5 w-5 text-slate-400" />}
              </button>
              {alertsExpanded && (
                <div className="border-t border-white/20 divide-y divide-slate-100 bg-white/20">
                  {alerts.map((alert, idx) => (
                    <div key={idx} className={`flex flex-wrap items-center gap-3 sm:gap-6 px-4 sm:px-6 lg:px-10 py-3 sm:py-4 group hover:bg-white/40 transition-colors`}>
                      <div className={`h-2 w-2 rounded-full shrink-0 ${alert.severity === "critical" ? "bg-rose-500 animate-pulse" : "bg-amber-400"}`} />
                      <span className="flex-1 text-xs font-bold text-slate-800 leading-relaxed">
                        {alert.message}
                      </span>
                      <div className="flex items-center gap-3 shrink-0">
                        {alert.department && (
                          <span className="hidden md:inline-block text-[9px] font-black uppercase tracking-widest text-slate-400 bg-white px-3 py-1 rounded-full border border-slate-100">
                            {alert.department}
                          </span>
                        )}
                        <span className={`text-[10px] font-black tabular-nums rounded-xl px-4 py-1.5 shadow-sm ${
                          alert.daysRemaining <= 7 ? "bg-rose-600 text-white"
                          : alert.daysRemaining <= 14 ? "bg-amber-500 text-white"
                          : "bg-slate-100 text-slate-600"
                        }`}>
                          {alert.daysRemaining} Days
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* HR Quick Actions */}
          {HR_ROLES.has(normaliseRoleKey(currentUser?.role)) && (
            <div className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50/80 to-white p-5 sm:p-6 mb-6">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-indigo-500 mb-4">HR Quick Actions</h3>
              <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                {canApproveLeaves(currentUser) && (
                <Link to="/employees/time-off/approvals" className="flex items-center gap-3 px-4 py-3.5 rounded-xl bg-white border border-slate-100 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all group">
                  <div className="h-9 w-9 rounded-lg bg-amber-50 flex items-center justify-center"><CalendarCheck className="h-4 w-4 text-amber-600" /></div>
                  <div>
                    <p className="text-sm font-bold text-slate-800 group-hover:text-indigo-700">Leave Approvals</p>
                    <p className="text-[10px] text-slate-400">Review pending requests</p>
                  </div>
                </Link>
                )}
                {canAccessOnboardingApprovals(currentUser) && (
                  <Link to="/employees/onboarding" className="flex items-center gap-3 px-4 py-3.5 rounded-xl bg-white border border-slate-100 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all group">
                    <div className="h-9 w-9 rounded-lg bg-emerald-50 flex items-center justify-center"><ClipboardList className="h-4 w-4 text-emerald-600" /></div>
                    <div>
                      <p className="text-sm font-bold text-slate-800 group-hover:text-indigo-700">Onboarding</p>
                      <p className="text-[10px] text-slate-400">Pending submissions</p>
                    </div>
                  </Link>
                )}
                {canAccessAttendance(currentUser) && (
                  <Link to="/attendance" className="flex items-center gap-3 px-4 py-3.5 rounded-xl bg-white border border-slate-100 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all group">
                    <div className="h-9 w-9 rounded-lg bg-indigo-50 flex items-center justify-center"><BarChart3 className="h-4 w-4 text-indigo-600" /></div>
                    <div>
                      <p className="text-sm font-bold text-slate-800 group-hover:text-indigo-700">Attendance</p>
                      <p className="text-[10px] text-slate-400">Monthly report & records</p>
                    </div>
                  </Link>
                )}
                {canManageBonusApprovals(currentUser) && (
                  <Link to="/employees/bonus-approvals" className="flex items-center gap-3 px-4 py-3.5 rounded-xl bg-white border border-slate-100 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all group">
                    <div className="h-9 w-9 rounded-lg bg-violet-50 flex items-center justify-center"><Gift className="h-4 w-4 text-violet-600" /></div>
                    <div>
                      <p className="text-sm font-bold text-slate-800 group-hover:text-indigo-700">Bonus Approvals</p>
                      <p className="text-[10px] text-slate-400">Assessment bonuses</p>
                    </div>
                  </Link>
                )}
                {canManagePayroll(currentUser) && (
                <Link to="/payroll" className="flex items-center gap-3 px-4 py-3.5 rounded-xl bg-white border border-slate-100 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all group">
                  <div className="h-9 w-9 rounded-lg bg-indigo-50 flex items-center justify-center"><Wallet className="h-4 w-4 text-indigo-600" /></div>
                  <div>
                    <p className="text-sm font-bold text-slate-800 group-hover:text-indigo-700">Payroll</p>
                    <p className="text-[10px] text-slate-400">Monthly payroll runs</p>
                  </div>
                </Link>
                )}
                {canViewReports(currentUser) && (
                <Link to="/reports" className="flex items-center gap-3 px-4 py-3.5 rounded-xl bg-white border border-slate-100 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all group">
                  <div className="h-9 w-9 rounded-lg bg-slate-50 flex items-center justify-center"><FileKey className="h-4 w-4 text-slate-600" /></div>
                  <div>
                    <p className="text-sm font-bold text-slate-800 group-hover:text-indigo-700">Reports</p>
                    <p className="text-[10px] text-slate-400">View all reports</p>
                  </div>
                </Link>
                )}
              </div>
            </div>
          )}

          {/* KPI strip */}
          <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 mb-8 mt-2">
            <Kpi icon={Users} label="Total Personnel" value={metrics.total} sub={`${metrics.activeRate}% Operational`} theme="indigo" />
            <Kpi icon={UserCheck} label="Active Duty" value={metrics.active} theme="emerald" />
            <Kpi icon={Plane} label="On Leave" value={metrics.onLeave} theme="amber" />
            <Kpi icon={Building2} label="Departments" value={departments.length} theme="slate" />
            <Kpi icon={Layers} label="Operational Units" value={teams.length} theme="slate" />
            <Kpi
              icon={Wallet}
              label="Gross Payroll"
              value={formatMoney(metrics.payrollSum)}
              sub={`Avg ${formatMoney(metrics.avgSalary)}`}
              theme="indigo"
            />
          </div>

          <div className="grid gap-4 sm:gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-4 mb-8">
            <div className="rounded-[2rem] border border-white/20 glass-premium p-8 shadow-premium hover-lift group relative overflow-hidden">
              <div className="absolute top-0 right-0 -mr-6 -mt-6 h-20 w-20 rounded-full bg-emerald-500/5 blur-xl group-hover:bg-emerald-500/10 transition-colors" />
              <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">
                <TrendingUp className="h-4 w-4 text-emerald-500" />
                Growth (90 Days)
              </div>
              <p className="text-4xl font-black tabular-nums text-slate-900 tracking-tighter">{metrics.newHires90}</p>
              <p className="text-[10px] font-black text-emerald-600 mt-2 uppercase tracking-widest bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100 inline-block">Institutional Expansion</p>
            </div>
            <div className="rounded-[2rem] border border-white/20 glass-premium p-8 shadow-premium hover-lift group relative overflow-hidden">
              <div className="absolute top-0 right-0 -mr-6 -mt-6 h-20 w-20 rounded-full bg-indigo-500/5 blur-xl group-hover:bg-indigo-500/10 transition-colors" />
              <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">
                <Briefcase className="h-4 w-4 text-indigo-500" />
                Defined Roles
              </div>
              <p className="text-4xl font-black tabular-nums text-slate-900 tracking-tighter">{openPositionsTotal}</p>
              <p className="text-[10px] font-black text-indigo-600 mt-2 uppercase tracking-widest bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-100 inline-block">Enterprise Structure</p>
            </div>
            <div className="rounded-2xl sm:rounded-[2rem] border border-white/20 glass-premium p-5 sm:p-8 shadow-premium hover-lift group relative overflow-hidden md:col-span-2">
              <div className="absolute top-0 right-0 -mr-12 -mt-12 h-32 w-32 rounded-full bg-slate-500/5 blur-2xl group-hover:bg-slate-500/10 transition-colors" />
              <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">
                <MapPin className="h-4 w-4 text-slate-500" />
                Operational Node Distribution
              </div>
              <div className="flex flex-wrap gap-3 mt-4">
                {locationData.length === 0
                  ? <span className="text-xs text-slate-400 font-bold italic">No geographic data synchronized.</span>
                  : locationData.slice(0, 4).map((l, i) => (
                      <div key={i} className="px-4 py-2 bg-white rounded-xl border border-slate-100 shadow-sm flex items-center gap-3">
                         <span className="text-xs font-black text-slate-800">{l.name}</span>
                         <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">{l.value}</span>
                      </div>
                    ))}
              </div>
            </div>
          </div>

          <div className="grid gap-6 lg:gap-8 lg:grid-cols-2 mb-8">
            <ChartCard title="Operational Status Distribution">
              <div className="h-[260px] sm:h-[320px] w-full">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie
                      data={statusPieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={80}
                      outerRadius={110}
                      paddingAngle={5}
                      animationDuration={1500}
                    >
                      {statusPieData.map((entry, i) => (
                        <Cell key={entry.name} fill={entry.color || CHART_COLORS[i % CHART_COLORS.length]} stroke="none" />
                      ))}
                    </Pie>
                    <Tooltip 
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="bg-white/80 backdrop-blur-md border border-white/40 p-4 rounded-2xl shadow-premium">
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{payload[0].name}</p>
                              <p className="text-2xl font-black text-indigo-600 tabular-nums">{payload[0].value}</p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Legend 
                      verticalAlign="bottom" 
                      height={36} 
                      iconType="circle"
                      wrapperStyle={{ fontSize: "10px", fontWeight: "900", textTransform: "uppercase", letterSpacing: "0.05em", color: "#64748b", paddingTop: "20px" }} 
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>

            <ChartCard title="Employment Archetypes">
              <div className="h-[260px] sm:h-[320px] w-full mt-2">
                {employmentData.length === 0 ? (
                  <p className="text-xs text-slate-400 font-bold italic flex items-center justify-center h-full">No archetype data synchronized.</p>
                ) : (
                  <ResponsiveContainer>
                    <BarChart data={employmentData} layout="vertical" margin={{ left: 20, right: 30, top: 10, bottom: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" strokeOpacity={0.5} />
                      <XAxis type="number" hide />
                      <YAxis 
                        type="category" 
                        dataKey="name" 
                        width={120} 
                        tick={{ fontSize: 10, fontWeight: '900', fill: '#64748b', textTransform: 'uppercase' }} 
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip 
                        cursor={{ fill: 'rgba(99, 102, 241, 0.05)', radius: 8 }}
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            return (
                              <div className="bg-white/80 backdrop-blur-md border border-white/40 p-4 rounded-2xl shadow-premium">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{payload[0].payload.name}</p>
                                <p className="text-2xl font-black text-indigo-600 tabular-nums">{payload[0].value}</p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Bar dataKey="value" fill="#6366f1" radius={[0, 8, 8, 0]} barSize={24} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </ChartCard>
          </div>

          <ChartCard title="Workforce Concentration (Top 12 Departments)">
            <div className="h-[280px] sm:h-[360px] w-full mt-6">
              <ResponsiveContainer>
                <BarChart data={topDepartmentsChart} margin={{ top: 10, right: 20, left: 0, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" strokeOpacity={0.5} />
                  <XAxis 
                    dataKey="name" 
                    tick={{ fontSize: 9, fontWeight: '900', fill: '#94a3b8', textTransform: 'uppercase' }} 
                    angle={-45} 
                    textAnchor="end" 
                    height={80} 
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis tick={{ fontSize: 10, fontWeight: '900', fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip
                    cursor={{ fill: 'rgba(99, 102, 241, 0.05)', radius: 12 }}
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-white/80 backdrop-blur-md border border-white/40 p-4 rounded-2xl shadow-premium">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{payload[0].payload.fullName}</p>
                            <p className="text-2xl font-black text-indigo-600 tabular-nums">{payload[0].value} <span className="text-xs text-slate-400">Personnel</span></p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="employees" fill="#6366f1" radius={[8, 8, 0, 0]} barSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>

          <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
            <ChartCard title="Tenure (years of service)">
              <div className="h-[220px] sm:h-[240px] w-full">
                <ResponsiveContainer>
                  <BarChart data={tenureSeries} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e4e4e7" />
                    <XAxis dataKey="range" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#3f3f46" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>

            <ChartCard title="Gender (self-reported)">
              <div className="h-[220px] sm:h-[240px] w-full">
                {genderData.length === 0 ? (
                  <p className="text-sm text-zinc-500 flex items-center justify-center h-full">No gender data</p>
                ) : (
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie
                        data={genderData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={78}
                      >
                        {genderData.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </ChartCard>
          </div>

          <div className="rounded-lg border border-zinc-200 bg-white shadow-card overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-100 flex items-center justify-between">
              <h3 className="text-sm font-medium text-zinc-900">Department breakdown</h3>
              <span className="text-xs text-zinc-500">{departmentRows.length} departments</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-zinc-100 bg-zinc-50/80">
                    <th className="px-4 py-3 text-[11px] font-medium text-zinc-500 uppercase tracking-wide">
                      Department
                    </th>
                    <th className="px-4 py-3 text-[11px] font-medium text-zinc-500 uppercase tracking-wide">
                      Head
                    </th>
                    <th className="px-4 py-3 text-[11px] font-medium text-zinc-500 uppercase tracking-wide text-right">
                      People
                    </th>
                    <th className="px-4 py-3 text-[11px] font-medium text-zinc-500 uppercase tracking-wide text-right">
                      Active
                    </th>
                    <th className="px-4 py-3 text-[11px] font-medium text-zinc-500 uppercase tracking-wide text-right">
                      Leave
                    </th>
                    <th className="px-4 py-3 text-[11px] font-medium text-zinc-500 uppercase tracking-wide text-right">
                      % workforce
                    </th>
                    <th className="px-4 py-3 text-[11px] font-medium text-zinc-500 uppercase tracking-wide text-right">
                      Payroll Σ
                    </th>
                    <th className="px-4 py-3 text-[11px] font-medium text-zinc-500 uppercase tracking-wide text-right">
                      Teams
                    </th>
                    <th className="px-4 py-3 text-[11px] font-medium text-zinc-500 uppercase tracking-wide text-right">
                      Roles def.
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {departmentRows.map((row) => (
                    <tr key={row.name} className="hover:bg-zinc-50/80">
                      <td className="px-4 py-2.5">
                        <DepartmentBadge name={row.name} />
                      </td>
                      <td className="px-4 py-2.5 text-zinc-600 text-xs max-w-[140px] truncate" title={row.head}>
                        {row.head}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums font-medium">{row.headcount}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-zinc-600">{row.active}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-zinc-600">{row.onLeave}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-zinc-500">{row.share}%</td>
                      <td className="px-4 py-2.5 text-right text-xs tabular-nums text-zinc-700">
                        {row.payroll > 0 ? formatMoney(row.payroll) : "—"}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-zinc-600">{row.teamCount}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-zinc-600">{row.positionsDefined}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-lg border border-zinc-200 bg-white shadow-card overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-100">
              <h3 className="text-sm font-medium text-zinc-900">Top job titles (headcount)</h3>
              <p className="text-xs text-zinc-500 mt-0.5">Most common position titles in the directory</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-zinc-100 bg-zinc-50/80">
                    <th className="px-4 py-2.5 text-[11px] font-medium text-zinc-500 uppercase tracking-wide">#</th>
                    <th className="px-4 py-2.5 text-[11px] font-medium text-zinc-500 uppercase tracking-wide">
                      Title
                    </th>
                    <th className="px-4 py-2.5 text-[11px] font-medium text-zinc-500 uppercase tracking-wide text-right">
                      People
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {positionMix.map((row, idx) => (
                    <tr key={row.title} className="hover:bg-zinc-50/80">
                      <td className="px-4 py-2 text-zinc-400 tabular-nums">{idx + 1}</td>
                      <td className="px-4 py-2 text-zinc-800">{row.title}</td>
                      <td className="px-4 py-2 text-right tabular-nums font-medium">{row.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-lg border border-zinc-200 bg-zinc-50/80 p-4 text-xs text-zinc-600">
            <p className="font-medium text-zinc-800 mb-1">Reading this dashboard</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Counts and payroll use employee records you are allowed to see (API may scope by role).</li>
              <li>Payroll sums only include employees with a numeric base salary on file.</li>
              <li>Tenure uses hire date; unknown hire dates appear in the “Unknown” bucket.</li>
            </ul>
          </div>
        </div>
      )}
    </Layout>
  );
}

const Kpi = memo(function Kpi({ icon: Icon, label, value, sub, theme = "indigo" }) {
  const themes = {
    indigo: "from-indigo-500/5 text-indigo-500 border-indigo-100",
    emerald: "from-emerald-500/5 text-emerald-500 border-emerald-100",
    amber: "from-amber-500/5 text-amber-500 border-amber-100",
    slate: "from-slate-500/5 text-slate-500 border-slate-100",
  };

  const textThemes = {
    indigo: "text-indigo-600",
    emerald: "text-emerald-600",
    amber: "text-amber-600",
    slate: "text-slate-600",
  };

  return (
    <div className={`rounded-[2rem] border border-white/20 glass-premium p-6 shadow-premium hover-lift group relative overflow-hidden bg-gradient-to-br ${themes[theme]}`}>
      <div className="absolute top-0 right-0 -mr-6 -mt-6 h-16 w-16 rounded-full bg-current opacity-10 blur-xl group-hover:opacity-20 transition-opacity" />
      <div className="flex items-center gap-3 text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 mb-3 relative z-10">
        <Icon className={`h-4 w-4 ${textThemes[theme]}`} strokeWidth={2.5} aria-hidden />
        {label}
      </div>
      <p className="text-3xl font-black tabular-nums text-slate-900 tracking-tighter relative z-10 leading-none">{value}</p>
      {sub ? <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-3 bg-white/50 px-2 py-1 rounded-full border border-white/50 inline-block relative z-10">{sub}</p> : <div className="h-6" />}
    </div>
  );
});

const ChartCard = memo(function ChartCard({ title, children }) {
  return (
    <div className="rounded-[2.5rem] border border-white/20 glass-premium p-10 shadow-premium relative overflow-hidden group">
      <div className="absolute top-0 right-0 -mr-12 -mt-12 h-40 w-40 rounded-full bg-indigo-500/5 blur-3xl group-hover:bg-indigo-500/10 transition-colors" />
      <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-8 flex items-center gap-3">
        <TrendingUp size={14} className="text-indigo-500" />
        {title}
      </h3>
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
});
